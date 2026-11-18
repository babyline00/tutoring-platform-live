/**
 * Maps a raw SessionEvent row into a UI-friendly timeline view.
 *
 * Each event type gets:
 *   - a short human-readable label (rendered as the timeline badge text)
 *   - a Tailwind color class string used for the badge (we avoid indigo /
 *     blue per the project styling rules and lean on neutral + semantic
 *     tones that already exist in the shadcn token set)
 *   - a content preview (first ~120 chars, single line) for collapsed rows
 *
 * `formatEventForTimeline` is a pure function — unit-tested without a DB.
 */

import type { SessionEventDTO, SessionEventType } from "@/lib/types";

export interface TimelineEventView {
  id: string;
  ordinal: number;
  type: string;
  typeLabel: string;
  badgeClass: string;
  contentPreview: string;
  content: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export const EVENT_TYPE_META: Record<
  SessionEventType,
  { label: string; badgeClass: string }
> = {
  "session-start": {
    label: "Session start",
    badgeClass:
      "border-transparent bg-secondary text-secondary-foreground",
  },
  "tutor-concept": {
    label: "Tutor concept",
    badgeClass:
      "border-transparent bg-accent text-accent-foreground",
  },
  "ai-suggestion": {
    label: "AI outline",
    badgeClass:
      "border-transparent bg-primary text-primary-foreground",
  },
  "ai-misconception": {
    label: "AI misconception",
    badgeClass:
      "border-transparent bg-accent text-accent-foreground",
  },
  "ai-analogy": {
    label: "AI analogy",
    badgeClass:
      "border-transparent bg-secondary text-secondary-foreground",
  },
  "practice-problem": {
    label: "Practice problem",
    badgeClass:
      "border-transparent bg-primary text-primary-foreground",
  },
  "student-answer": {
    label: "Student answer",
    badgeClass:
      "border-transparent bg-accent text-accent-foreground",
  },
  "ai-feedback": {
    label: "AI feedback",
    badgeClass:
      "border-transparent bg-primary text-primary-foreground",
  },
  "ai-followup": {
    label: "AI follow-up",
    badgeClass:
      "border-transparent bg-secondary text-secondary-foreground",
  },
  "session-summary": {
    label: "Session summary",
    badgeClass:
      "border-transparent bg-primary text-primary-foreground",
  },
};

const UNKNOWN_TYPE_META = {
  label: "Event",
  badgeClass: "border bg-muted text-muted-foreground",
};

export function previewContent(content: string, max = 120): string {
  const single = content.replace(/\s+/g, " ").trim();
  if (single.length <= max) return single;
  return single.slice(0, max) + "…";
}

export function parseMetadata(
  raw: string | null,
): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { value: parsed };
  } catch {
    return { raw };
  }
}

export function formatEventForTimeline(
  event: SessionEventDTO,
): TimelineEventView {
  const meta =
    EVENT_TYPE_META[event.type as SessionEventType] ?? UNKNOWN_TYPE_META;
  return {
    id: event.id,
    ordinal: event.ordinal,
    type: event.type,
    typeLabel: meta.label,
    badgeClass: meta.badgeClass,
    contentPreview: previewContent(event.content),
    content: event.content,
    metadata: parseMetadata(event.metadata),
    createdAt: event.createdAt,
  };
}

/** Bulk helper — sorts by ordinal and maps every event. */
export function formatTimeline(
  events: SessionEventDTO[],
): TimelineEventView[] {
  return [...events]
    .sort((a, b) => a.ordinal - b.ordinal)
    .map(formatEventForTimeline);
}
