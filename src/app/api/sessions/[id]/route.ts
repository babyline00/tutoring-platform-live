/**
 * /api/sessions/[id]
 *
 * GET    — session + all events (ordered by ordinal).
 * PATCH  — update status (to "completed") + optional summary; sets completedAt.
 * DELETE — cascade removes the session and all its events.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionDetailToDTO } from "@/lib/session-helpers";

export const runtime = "nodejs";

interface Ctx {
  params: Promise<{ id: string }>;
}

// --- GET --------------------------------------------------------------------

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
  return NextResponse.json({
    session: sessionDetailToDTO({
      ...session,
      subject: session.subject,
      events: session.events,
    }),
  });
}

// --- PATCH ------------------------------------------------------------------

interface PatchBody {
  status?: string;
  summary?: string;
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  let body: PatchBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const session = await db.session.findUnique({ where: { id } });
  if (!session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }

  const data: { status?: string; summary?: string; completedAt?: Date | null } = {};
  if (body.status === "active" || body.status === "completed") {
    data.status = body.status;
    data.completedAt = body.status === "completed" ? new Date() : null;
  }
  if (typeof body.summary === "string") {
    data.summary = body.summary;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "no updatable fields provided" }, { status: 400 });
  }

  const updated = await db.session.update({
    where: { id },
    data,
    include: {
      subject: { select: { id: true, name: true, label: true } },
      events: { orderBy: { ordinal: "asc" } },
    },
  });

  return NextResponse.json({
    session: sessionDetailToDTO({
      ...updated,
      subject: updated.subject,
      events: updated.events,
    }),
  });
}

// --- DELETE -----------------------------------------------------------------

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    await db.session.delete({ where: { id } });
  } catch (e: unknown) {
    const code = (e as { code?: string }).code;
    if (code === "P2025") {
      return NextResponse.json({ error: "session not found" }, { status: 404 });
    }
    throw e;
  }
  return NextResponse.json({ ok: true });
}
