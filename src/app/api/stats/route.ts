/**
 * GET /api/stats
 *
 * Returns high-level platform counters used by the header banner:
 *   { sessions, completed, events }
 *
 * `sessions`  — total number of sessions (any status).
 * `completed` — sessions with status == "completed".
 * `events`    — total SessionEvent rows across all sessions.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const [sessions, completed, events] = await Promise.all([
    db.session.count(),
    db.session.count({ where: { status: "completed" } }),
    db.sessionEvent.count(),
  ]);
  return NextResponse.json({ sessions, completed, events });
}
