/**
 * POST /api/sessions/[id]/suggest
 *
 * Body: { concept: string }
 *
 * The tutor types a concept they're about to explain. The LLM returns:
 *   { outline: string[], misconception: string, analogy: string, practiceProblem: string }
 *
 * Each of the four fields is persisted as its own SessionEvent row so the
 * timeline + replay show them as four discrete steps. Response includes the
 * parsed suggestion + the four new events.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { completeJson } from "@/lib/ai";
import { buildSuggestPrompt } from "@/lib/suggest-builder";
import { appendEvent, sessionDetailToDTO } from "@/lib/session-helpers";
import type { SuggestionResult } from "@/lib/types";

export const runtime = "nodejs";

interface Ctx {
  params: Promise<{ id: string }>;
}

interface SuggestBody {
  concept?: string;
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  let body: SuggestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const concept = (body.concept ?? "").trim();
  if (!concept) {
    return NextResponse.json({ error: "concept is required" }, { status: 400 });
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

  // 1. Persist the tutor concept event first (so it precedes the AI events).
  await appendEvent({ sessionId: id, type: "tutor-concept", content: concept });

  // 2. Build the prompt with subject + difficulty + student level context.
  const prompt = buildSuggestPrompt(
    concept,
    session.subject.name,
    session.difficulty,
    session.studentLevel,
  );

  let suggestion: SuggestionResult;
  try {
    suggestion = await completeJson<SuggestionResult>(prompt);
  } catch (e) {
    return NextResponse.json(
      { error: "LLM JSON parse failed", detail: (e as Error).message },
      { status: 502 },
    );
  }

  // Defensive defaults so a partial LLM payload doesn't break the timeline.
  const outline = Array.isArray(suggestion.outline)
    ? suggestion.outline.filter((x): x is string => typeof x === "string").slice(0, 3)
    : [];
  const misconception = typeof suggestion.misconception === "string" ? suggestion.misconception : "";
  const analogy = typeof suggestion.analogy === "string" ? suggestion.analogy : "";
  const practiceProblem = typeof suggestion.practiceProblem === "string" ? suggestion.practiceProblem : "";

  // 3. Persist the four AI suggestion events (each as a discrete row).
  await appendEvent({
    sessionId: id,
    type: "ai-suggestion",
    content: outline.length ? outline.map((o, i) => `${i + 1}. ${o}`).join("\n") : "(no outline returned)",
    metadata: { outline },
  });
  await appendEvent({
    sessionId: id,
    type: "ai-misconception",
    content: misconception || "(no misconception returned)",
  });
  await appendEvent({
    sessionId: id,
    type: "ai-analogy",
    content: analogy || "(no analogy returned)",
  });
  await appendEvent({
    sessionId: id,
    type: "practice-problem",
    content: practiceProblem || "(no practice problem returned)",
    metadata: { source: "suggest" },
  });

  // 4. Re-fetch the full session with all events and return.
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
    suggestion: {
      outline,
      misconception,
      analogy,
      practiceProblem,
    },
    session: sessionDetailToDTO({
      ...refreshed,
      subject: refreshed.subject,
      events: refreshed.events,
    }),
  });
}
