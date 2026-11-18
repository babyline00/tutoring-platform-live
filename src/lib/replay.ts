/**
 * Replay step formatter.
 *
 * `formatReplayStep(event, prevEvent?)` turns a single SessionEvent into a
 * UI-friendly step structure for the replay player: the event content, a
 * short transition message describing what changed since the previous step
 * (e.g. "Tutor introduces concept" → "AI suggests an outline"), and the
 * badge metadata reused from the timeline formatter.
 *
 * The transition messages are derived from the (prevType → type) pair so the
 * replay player can show a single-line "what just happened" caption above
 * each event's full content.
 *
 * Pure function — unit-tested without a DB.
 */

import type { SessionEventDTO, SessionEventType } from "@/lib/types";
import {
  formatEventForTimeline,
  EVENT_TYPE_META,
  previewContent,
  type TimelineEventView,
} from "@/lib/event-types";

export interface ReplayStep {
  ordinal: number;
  view: TimelineEventView;
  transition: string;
  isFirst: boolean;
}

const TRANSITIONS: Record<string, string> = {
  // session-start → ...
  "session-start|tutor-concept": "Tutor opens the session and introduces the first concept.",
  "session-start|practice-problem": "Session opens with a practice problem.",

  // tutor-concept → ...
  "tutor-concept|ai-suggestion": "AI drafts a 3-point teaching outline for the concept.",
  "tutor-concept|ai-misconception": "AI flags a misconception to address.",
  "tutor-concept|ai-analogy": "AI offers a real-world analogy.",
  "tutor-concept|practice-problem": "A practice problem is generated for the concept.",

  // ai-* → practice-problem
  "ai-suggestion|practice-problem": "Tutor generates a practice problem based on the outline.",
  "ai-analogy|practice-problem": "Tutor generates a practice problem.",
  "ai-misconception|practice-problem": "Tutor generates a practice problem.",

  // practice-problem → student-answer
  "practice-problem|student-answer": "Student submits an answer to the problem.",

  // student-answer → ai-feedback
  "student-answer|ai-feedback": "AI evaluates the student's answer.",

  // ai-feedback → ai-followup
  "ai-feedback|ai-followup": "AI assigns a follow-up problem to close the gap.",

  // follow-up → student-answer
  "ai-followup|student-answer": "Student attempts the follow-up problem.",

  // → session-summary
  "ai-feedback|session-summary": "Tutor ends the session and requests a summary.",
  "ai-followup|session-summary": "Tutor ends the session and requests a summary.",
  "student-answer|session-summary": "Tutor ends the session and requests a summary.",
  "practice-problem|session-summary": "Tutor ends the session and requests a summary.",
};

export function buildTransition(
  prevType: string | undefined,
  type: string,
): string {
  if (!prevType) {
    return `Session begins — ${EVENT_TYPE_META[type as SessionEventType]?.label ?? type}.`;
  }
  const key = `${prevType}|${type}`;
  if (TRANSITIONS[key]) return TRANSITIONS[key];
  // Generic fallback: "Previous label → new label".
  const prevLabel = EVENT_TYPE_META[prevType as SessionEventType]?.label ?? prevType;
  const newLabel = EVENT_TYPE_META[type as SessionEventType]?.label ?? type;
  return `${prevLabel} → ${newLabel}.`;
}

export function formatReplayStep(
  event: SessionEventDTO,
  prevEvent?: SessionEventDTO | null,
): ReplayStep {
  const view = formatEventForTimeline(event);
  const transition = buildTransition(prevEvent?.type, event.type);
  return {
    ordinal: event.ordinal,
    view,
    transition,
    isFirst: !prevEvent,
  };
}

/** Bulk helper — produces the full ordered replay sequence. */
export function buildReplaySequence(
  events: SessionEventDTO[],
): ReplayStep[] {
  const sorted = [...events].sort((a, b) => a.ordinal - b.ordinal);
  return sorted.map((e, i) => formatReplayStep(e, i > 0 ? sorted[i - 1] : null));
}

/** Short caption for the replay progress bar (e.g. "Step 3 of 9"). */
export function replayProgressCaption(
  current: number,
  total: number,
): string {
  if (total <= 0) return "No events to replay";
  const clamped = Math.max(1, Math.min(current, total));
  return `Step ${clamped} of ${total}`;
}

/** Truncate a content string for the replay step card title. */
export function replayStepTitle(content: string, max = 80): string {
  return previewContent(content, max);
}
