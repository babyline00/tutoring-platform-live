/**
 * GET /api/sessions/[id]/replay
 *
 * Returns the session + its events in ordinal order plus the pre-computed
 * replay sequence (transitions, badges, content previews). The client uses
 * this to drive the step-by-step replay player without recomputing
 * transitions locally.
 *
 * Response:
 *   {
 *     session: SessionDetailDTO,
 *     steps:   ReplayStep[]
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionDetailToDTO } from "@/lib/session-helpers";
import { buildReplaySequence } from "@/lib/replay";
import type { SessionEventDTO } from "@/lib/types";

export const runtime = "nodejs";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
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

  const detail = sessionDetailToDTO({
    ...session,
    subject: session.subject,
    events: session.events,
  });
  const steps = buildReplaySequence(events);

  return NextResponse.json({ session: detail, steps });
}
