/**
 * POST /api/sessions/[id]/evaluate
 *
 * Body: { studentAnswer: string, problemQuestion?: string, workedSolution?: string }
 *  — if the problem question + worked solution are not provided, the
 *    endpoint auto-loads the most recent "practice-problem" event in the
 *    session and reads them out of its metadata.
 *
 * The LLM returns:
 *   { correctness: "correct" | "partially-correct" | "incorrect",
 *     feedback: string,
 *     followUpProblem?: string }
 *
 * Persisted as up to THREE events:
 *   1. "student-answer"  — the raw student answer.
 *   2. "ai-feedback"     — the LLM's correctness + feedback.
 *   3. "ai-followup"     — (only if correctness != "correct") the follow-up problem.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { completeJson } from "@/lib/ai";
import { buildEvaluatePrompt } from "@/lib/evaluate-builder";
import { appendEvent, sessionDetailToDTO } from "@/lib/session-helpers";
import type { Correctness, EvaluationResult } from "@/lib/types";

export const runtime = "nodejs";

interface Ctx {
  params: Promise<{ id: string }>;
}

interface EvalBody {
  studentAnswer?: string;
  problemQuestion?: string;
  workedSolution?: string;
}

const VALID_CORRECTNESS: Correctness[] = [
  "correct",
  "partially-correct",
  "incorrect",
];

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  let body: EvalBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const studentAnswer = (body.studentAnswer ?? "").trim();
  if (!studentAnswer) {
    return NextResponse.json({ error: "studentAnswer is required" }, { status: 400 });
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

  // Resolve the reference problem from the body OR from the latest
  // practice-problem event's metadata so the caller doesn't have to thread
  // state through the client.
  let problemQuestion = body.problemQuestion ?? "";
  let workedSolution = body.workedSolution ?? "";
  if (!problemQuestion || !workedSolution) {
    const lastProblem = await db.sessionEvent.findFirst({
      where: { sessionId: id, type: "practice-problem" },
      orderBy: { ordinal: "desc" },
    });
    if (lastProblem) {
      if (!problemQuestion) problemQuestion = lastProblem.content;
      if (!workedSolution) {
        try {
          const meta = lastProblem.metadata ? JSON.parse(lastProblem.metadata) : null;
          if (meta && typeof meta.workedSolution === "string") {
            workedSolution = meta.workedSolution;
          }
        } catch {
          // ignore
        }
      }
    }
  }

  // 1. Persist the student answer first so it precedes the AI feedback.
  await appendEvent({
    sessionId: id,
    type: "student-answer",
    content: studentAnswer,
    metadata: { problemQuestion: problemQuestion || null },
  });

  // 2. Build the evaluation prompt.
  const prompt = buildEvaluatePrompt(studentAnswer, problemQuestion, workedSolution);

  let result: EvaluationResult;
  try {
    result = await completeJson<EvaluationResult>(prompt);
  } catch (e) {
    return NextResponse.json(
      { error: "LLM JSON parse failed", detail: (e as Error).message },
      { status: 502 },
    );
  }

  const correctness: Correctness = VALID_CORRECTNESS.includes(result.correctness as Correctness)
    ? (result.correctness as Correctness)
    : "incorrect";
  const feedback = typeof result.feedback === "string" ? result.feedback : "";
  const followUpProblem =
    correctness !== "correct" && typeof result.followUpProblem === "string"
      ? result.followUpProblem
      : undefined;

  // 3. Persist the AI feedback event.
  await appendEvent({
    sessionId: id,
    type: "ai-feedback",
    content: feedback || `(${correctness})`,
    metadata: { correctness, problemQuestion: problemQuestion || null },
  });

  // 4. Persist the follow-up problem (if any).
  if (followUpProblem) {
    await appendEvent({
      sessionId: id,
      type: "ai-followup",
      content: followUpProblem,
      metadata: { triggeredBy: correctness },
    });
  }

  // 5. Re-fetch the full session with all events.
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
    evaluation: {
      correctness,
      feedback,
      followUpProblem,
    },
    session: sessionDetailToDTO({
      ...refreshed,
      subject: refreshed.subject,
      events: refreshed.events,
    }),
  });
}
