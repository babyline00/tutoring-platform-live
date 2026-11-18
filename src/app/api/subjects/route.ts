/**
 * GET /api/subjects
 *
 * Returns the full subject catalog as `{ id, name, label, topics: string[] }`.
 * If the table is empty (fresh DB), auto-seeds the 6 hardcoded subjects so the
 * "New session" dialog still renders its dropdown.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SUBJECT_SEEDS } from "@/lib/seed-helpers";
import { ensureSubjectsSeeded, subjectToDTO } from "@/lib/session-helpers";

export const runtime = "nodejs";

export async function GET() {
  let rows = await db.subject.findMany({ orderBy: { name: "asc" } });
  if (rows.length === 0) {
    await ensureSubjectsSeeded(SUBJECT_SEEDS);
    rows = await db.subject.findMany({ orderBy: { name: "asc" } });
  }
  return NextResponse.json({ subjects: rows.map(subjectToDTO) });
}
