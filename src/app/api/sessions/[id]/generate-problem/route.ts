/**
 * POST /api/sessions/[id]/generate-problem
 *
 * Body: { topic?, difficulty?, studentLevel? }
 *  — overrides the session's defaults when the tutor wants a problem on a
 *    sub-topic or at a different difficulty.
 *
 * The LLM returns:
 *   { question: string, hints: string[], workedSolution: string }
 *
 * Persisted as a single "practice-problem" event. The worked solution is
 * stored in metadata so the evaluate endpoint can use it as ground truth
 * without re-prompting the model.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { completeJson } from "@/lib/ai";
import { buildProblemPrompt } from "@/lib/problem-generator";
import { appendEvent, sessionDetailToDTO } from "@/lib/session-helpers";
import type { GeneratedProblem } from "@/lib/types";

export const runtime = "nodejs";

interface Ctx {
  params: Promise<{ id: string }>;
}

interface GenBody {
  topic?: string;
  difficulty?: string;
  studentLevel?: string;
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  let body: GenBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const session = await db.session.findUnique({
    where: { id },
    include: { subject: { select: { id: true, name: true, label: true } } },
  });
  if (!session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }
  if (session.status === "completed") {
    return NextResponse.json({ error: "session is completed" }, { status: 409 });
  }

  const topic = (body.topic ?? session.topic).trim();
  const difficulty = (body.difficulty ?? session.difficulty).trim();
  const studentLevel = (body.studentLevel ?? session.studentLevel).trim();

  const prompt = buildProblemPrompt(topic, difficulty, studentLevel);

  let problem: GeneratedProblem;
  try {
    problem = await completeJson<GeneratedProblem>(prompt);
  } catch (e) {
    return NextResponse.json(
      { error: "LLM JSON parse failed", detail: (e as Error).message },
      { status: 502 },
    );
  }

  const question = typeof problem.question === "string" ? problem.question : "";
  const hints = Array.isArray(problem.hints)
    ? problem.hints.filter((h): h is string => typeof h === "string")
    : [];
  const workedSolution =
    typeof problem.workedSolution === "string" ? problem.workedSolution : "";

  if (!question) {
    return NextResponse.json(
      { error: "LLM returned no question", raw: problem },
      { status: 502 },
    );
  }

  await appendEvent({
    sessionId: id,
    type: "practice-problem",
    content: question,
    metadata: {
      hints,
      workedSolution,
      topic,
      difficulty,
      studentLevel,
      source: "generate-problem",
    },
  });

  const refreshed = await db.session.findUnique({
    where: { id },
    include: {
      subject: { select: { id: true, name: true, label: true } },
      events: { orderBy: { ordinal: "asc" } },
    },
  });
  if (!refreshed) {
    return NextResponse.json({ error: "session vanished mid-write" }, { status: 500 });
  }

  return NextResponse.json({
    problem: { question, hints, workedSolution },
    session: sessionDetailToDTO({
      ...refreshed,
      subject: refreshed.subject,
      events: refreshed.events,
    }),
  });
}
