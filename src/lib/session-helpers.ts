/**
 * Server-side helpers for working with Sessions + SessionEvents.
 *
 * These wrap the Prisma calls the API routes need most often so the route
 * handlers stay tiny and the "compute next ordinal" logic isn't duplicated.
 * All functions are async and assume a live `db` client.
 */

import { db } from "@/lib/db";
import {
  parseTopics,
  serializeTopics,
} from "@/lib/seed-helpers";
import type {
  SessionDetailDTO,
  SessionEventDTO,
  SessionListItemDTO,
  SubjectDTO,
  SubjectSeed,
} from "@/lib/types";

// --- Subjects ---------------------------------------------------------------

export function subjectSeedToCreateData(seed: SubjectSeed) {
  return {
    name: seed.name,
    label: seed.label,
    topics: serializeTopics(seed.topics),
  };
}

export function subjectToDTO(s: {
  id: string;
  name: string;
  label: string;
  topics: string;
}): SubjectDTO {
  return {
    id: s.id,
    name: s.name,
    label: s.label,
    topics: parseTopics(s.topics),
  };
}

// --- Sessions ---------------------------------------------------------------

export async function nextOrdinal(sessionId: string): Promise<number> {
  const last = await db.sessionEvent.findFirst({
    where: { sessionId },
    orderBy: { ordinal: "desc" },
    select: { ordinal: true },
  });
  return (last?.ordinal ?? 0) + 1;
}

export interface AppendEventArgs {
  sessionId: string;
  type: string;
  content: string;
  metadata?: Record<string, unknown> | null;
}

export async function appendEvent(
  args: AppendEventArgs,
): Promise<SessionEventDTO> {
  const ordinal = await nextOrdinal(args.sessionId);
  const created = await db.sessionEvent.create({
    data: {
      sessionId: args.sessionId,
      ordinal,
      type: args.type,
      content: args.content,
      metadata:
        args.metadata == null ? null : JSON.stringify(args.metadata),
    },
  });
  return {
    id: created.id,
    sessionId: created.sessionId,
    ordinal: created.ordinal,
    type: created.type,
    content: created.content,
    metadata: created.metadata,
    createdAt: created.createdAt.toISOString(),
  };
}

export function sessionListItemToDTO(s: {
  id: string;
  subjectId: string;
  topic: string;
  difficulty: string;
  studentLevel: string;
  tutorName: string;
  studentName: string;
  status: string;
  summary: string | null;
  startedAt: Date;
  completedAt: Date | null;
  subject: { id: string; name: string; label: string };
  _count?: { events: number };
  eventCount?: number;
}): SessionListItemDTO {
  return {
    id: s.id,
    subjectId: s.subjectId,
    subjectName: s.subject.name,
    subjectLabel: s.subject.label,
    topic: s.topic,
    difficulty: s.difficulty,
    studentLevel: s.studentLevel,
    tutorName: s.tutorName,
    studentName: s.studentName,
    status: s.status,
    summary: s.summary,
    startedAt: s.startedAt.toISOString(),
    completedAt: s.completedAt ? s.completedAt.toISOString() : null,
    eventCount: s.eventCount ?? s._count?.events ?? 0,
  };
}

export function sessionDetailToDTO(s: {
  id: string;
  subjectId: string;
  topic: string;
  difficulty: string;
  studentLevel: string;
  tutorName: string;
  studentName: string;
  status: string;
  summary: string | null;
  startedAt: Date;
  completedAt: Date | null;
  subject: { id: string; name: string; label: string };
  events: {
    id: string;
    sessionId: string;
    ordinal: number;
    type: string;
    content: string;
    metadata: string | null;
    createdAt: Date;
  }[];
}): SessionDetailDTO {
  const base = sessionListItemToDTO({
    ...s,
    eventCount: s.events.length,
  });
  return {
    ...base,
    events: [...s.events]
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((e) => ({
        id: e.id,
        sessionId: e.sessionId,
        ordinal: e.ordinal,
        type: e.type,
        content: e.content,
        metadata: e.metadata,
        createdAt: e.createdAt.toISOString(),
      })),
  };
}

/**
 * Idempotently upsert the seed subjects. Used by the seed script and as a
 * lazy auto-seed inside the API routes so a fresh DB still renders the
 * subject dropdown.
 */
export async function ensureSubjectsSeeded(
  seeds: SubjectSeed[],
): Promise<number> {
  let upserted = 0;
  for (const seed of seeds) {
    await db.subject.upsert({
      where: { name: seed.name },
      create: subjectSeedToCreateData(seed),
      update: subjectSeedToCreateData(seed),
    });
    upserted++;
  }
  return upserted;
}
