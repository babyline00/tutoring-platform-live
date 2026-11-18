/**
 * /api/sessions
 *
 * GET  — list sessions, optional filters: ?subject=<name|id>&status=active|completed
 * POST — create a new session and emit a "session-start" event.
 *
 * POST body: { subjectId, topic, difficulty?, studentLevel?, tutorName?, studentName? }
 * POST resp: { session: SessionDetailDTO } (includes the initial session-start event)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  appendEvent,
  sessionDetailToDTO,
  sessionListItemToDTO,
} from "@/lib/session-helpers";
import { SUBJECT_SEEDS } from "@/lib/seed-helpers";
import {
  DIFFICULTIES,
  STUDENT_LEVELS,
  type Difficulty,
  type StudentLevel,
} from "@/lib/types";

export const runtime = "nodejs";

// --- GET --------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const subject = searchParams.get("subject");
  const status = searchParams.get("status");

  const where: { subjectId?: string; subject?: { name?: string }; status?: string } = {};
  if (subject) {
    // Subject filter accepts either the subject id or its name.
    const byId = await db.subject.findUnique({ where: { id: subject } });
    if (byId) {
      where.subjectId = byId.id;
    } else {
      where.subject = { name: subject };
    }
  }
  if (status === "active" || status === "completed") {
    where.status = status;
  }

  const rows = await db.session.findMany({
    where,
    orderBy: { startedAt: "desc" },
    include: {
      subject: { select: { id: true, name: true, label: true } },
      _count: { select: { events: true } },
    },
  });

  return NextResponse.json({
    sessions: rows.map((s) =>
      sessionListItemToDTO({
        ...s,
        subject: s.subject,
        _count: s._count,
      }),
    ),
  });
}

// --- POST -------------------------------------------------------------------

interface CreateBody {
  subjectId?: string;
  topic?: string;
  difficulty?: string;
  studentLevel?: string;
  tutorName?: string;
  studentName?: string;
}

export async function POST(req: NextRequest) {
  let body: CreateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const subjectId = (body.subjectId ?? "").trim();
  const topic = (body.topic ?? "").trim();
  if (!subjectId) {
    return NextResponse.json({ error: "subjectId is required" }, { status: 400 });
  }
  if (!topic) {
    return NextResponse.json({ error: "topic is required" }, { status: 400 });
  }

  // Validate subject existence; lazy-auto-seed if the table is empty.
  let subject = await db.subject.findUnique({ where: { id: subjectId } });
  if (!subject) {
    const seeded = await db.subject.findMany();
    if (seeded.length === 0) {
      for (const seed of SUBJECT_SEEDS) {
        await db.subject.upsert({
          where: { name: seed.name },
          create: { name: seed.name, label: seed.label, topics: JSON.stringify(seed.topics) },
          update: { name: seed.name, label: seed.label, topics: JSON.stringify(seed.topics) },
        });
      }
      subject = await db.subject.findUnique({ where: { id: subjectId } });
    }
  }
  if (!subject) {
    return NextResponse.json({ error: "subject not found" }, { status: 404 });
  }

  const difficulty = normalizeDifficulty(body.difficulty);
  const studentLevel = normalizeStudentLevel(body.studentLevel);
  const tutorName = (body.tutorName ?? "Tutor").trim() || "Tutor";
  const studentName = (body.studentName ?? "Student").trim() || "Student";

  const session = await db.session.create({
    data: {
      subjectId,
      topic,
      difficulty,
      studentLevel,
      tutorName,
      studentName,
      status: "active",
    },
    include: {
      subject: { select: { id: true, name: true, label: true } },
      events: true,
    },
  });

  // Emit the initial session-start event so the timeline + replay show
  // the genesis of the session.
  await appendEvent({
    sessionId: session.id,
    type: "session-start",
    content: `Session started — ${subject.label}: ${topic} (${difficulty}, ${studentLevel}). Tutor: ${tutorName}, Student: ${studentName}.`,
    metadata: {
      subjectId,
      topic,
      difficulty,
      studentLevel,
      tutorName,
      studentName,
    },
  });

  // Re-fetch with the new event attached.
  const refreshed = await db.session.findUnique({
    where: { id: session.id },
    include: {
      subject: { select: { id: true, name: true, label: true } },
      events: { orderBy: { ordinal: "asc" } },
    },
  });
  if (!refreshed) {
    return NextResponse.json({ error: "session create race — row vanished" }, { status: 500 });
  }

  return NextResponse.json(
    { session: sessionDetailToDTO({ ...refreshed, subject: refreshed.subject, events: refreshed.events }) },
    { status: 201 },
  );
}

function normalizeDifficulty(v?: string): Difficulty {
  const fallback: Difficulty = "intermediate";
  if (!v) return fallback;
  return (DIFFICULTIES as readonly string[]).includes(v) ? (v as Difficulty) : fallback;
}

function normalizeStudentLevel(v?: string): StudentLevel {
  const fallback: StudentLevel = "high-school";
  if (!v) return fallback;
  return (STUDENT_LEVELS as readonly string[]).includes(v) ? (v as StudentLevel) : fallback;
}
