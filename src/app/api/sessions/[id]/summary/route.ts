/**
 * POST /api/sessions/[id]/summary
 *
 * Asks the LLM to summarize the entire session using the ordered event log.
 * Returns:
 *   { topicsCovered: string[], problemsAttempted: number,
 *     correctCount: number, incorrectCount: number,
 *     suggestedNextSteps: string[], narrative: string }
 *
 * Persists the summary as a "session-summary" event, updates the session's
 * `summary` field, and sets `status = "completed"` + `completedAt = now()`.
 *
 * If the session has no events, we still mark it completed but emit a
 * minimal "no events" summary so the timeline + replay have a closing row.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { completeJson } from "@/lib/ai";
import { buildSummaryPrompt } from "@/lib/summary-builder";
import { appendEvent, sessionDetailToDTO } from "@/lib/session-helpers";
import type { SessionEventDTO, SessionSummary } from "@/lib/types";

export const runtime = "nodejs";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;

  const session = await db.session.findUnique({
    where: { id },
    include: {
      subject: { select: { id: true, name: true, label: true } },
      events: { orderBy: { ordinal: "asc" } },
    },
  });
  if (!session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }

  const events: SessionEventDTO[] = session.events.map((e) => ({
    id: e.id,
    sessionId: e.sessionId,
    ordinal: e.ordinal,
    type: e.type,
    content: e.content,
    metadata: e.metadata,
    createdAt: e.createdAt.toISOString(),
  }));

  let summary: SessionSummary;
  try {
    summary = await completeJson<SessionSummary>(buildSummaryPrompt(events));
  } catch (e) {
    return NextResponse.json(
      { error: "LLM JSON parse failed", detail: (e as Error).message },
      { status: 502 },
    );
  }

  // Defensive defaults so a partial payload doesn't break the UI.
  const topicsCovered = Array.isArray(summary.topicsCovered)
    ? summary.topicsCovered.filter((t): t is string => typeof t === "string")
    : [];
  const problemsAttempted =
    typeof summary.problemsAttempted === "number" && Number.isFinite(summary.problemsAttempted)
      ? Math.max(0, summary.problemsAttempted)
      : 0;
  const correctCount =
    typeof summary.correctCount === "number" && Number.isFinite(summary.correctCount)
      ? Math.max(0, summary.correctCount)
      : 0;
  const incorrectCount =
    typeof summary.incorrectCount === "number" && Number.isFinite(summary.incorrectCount)
      ? Math.max(0, summary.incorrectCount)
      : 0;
  const suggestedNextSteps = Array.isArray(summary.suggestedNextSteps)
    ? summary.suggestedNextSteps.filter((s): s is string => typeof s === "string")
    : [];
  const narrative = typeof summary.narrative === "string" ? summary.narrative : "";

  const summaryContent = [
    narrative || "(no narrative)",
    "",
    `Topics covered: ${topicsCovered.join(", ") || "(none)"}`,
    `Problems attempted: ${problemsAttempted}`,
    `Correct: ${correctCount} · Incorrect/partial: ${incorrectCount}`,
    suggestedNextSteps.length
      ? `Suggested next steps:\n${suggestedNextSteps.map((s, i) => `  ${i + 1}. ${s}`).join("\n")}`
      : "Suggested next steps: (none)",
  ].join("\n");

  // Persist the summary as a discrete event.
  await appendEvent({
    sessionId: id,
    type: "session-summary",
    content: summaryContent,
    metadata: {
      topicsCovered,
      problemsAttempted,
      correctCount,
      incorrectCount,
      suggestedNextSteps,
      narrative,
    },
  });

  // Update session status + summary + completedAt.
  await db.session.update({
    where: { id },
    data: {
      status: "completed",
      summary: summaryContent,
      completedAt: new Date(),
    },
  });

  // Re-fetch with the new event.
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
    summary: {
      topicsCovered,
      problemsAttempted,
      correctCount,
      incorrectCount,
      suggestedNextSteps,
      narrative,
    },
    session: sessionDetailToDTO({
      ...refreshed,
      subject: refreshed.subject,
      events: refreshed.events,
    }),
  });
}
