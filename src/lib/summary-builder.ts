/**
 * Prompt builder for the end-of-session summary.
 *
 * Takes the full ordered list of SessionEvent rows and asks the LLM to
 * produce a structured summary: topics covered, problems attempted, the
 * correct/incorrect ratio, and suggested next steps. The events are
 * rendered as a compact numbered log so the model sees the full session
 * arc without being flooded with metadata.
 *
 * Pure function — unit-tested without an LLM.
 */

import type { BuiltPrompt, SessionEventDTO } from "@/lib/types";

export function buildSummaryPrompt(events: SessionEventDTO[]): BuiltPrompt {
  const logLines = events.map((e) => {
    const preview = e.content.replace(/\s+/g, " ").trim();
    return `${e.ordinal}. [${e.type}] ${preview}`;
  });
  const log = logLines.length
    ? logLines.join("\n")
    : "(no events recorded)";

  const systemPrompt = [
    "You are the summarization engine for a live tutoring platform.",
    "You will receive the ordered event log of a single tutoring session.",
    "Produce a structured summary that a tutor or student could skim to recall the session.",
    "",
    "Respond with a single JSON object and NOTHING else. Do not wrap it in markdown fences.",
    "Schema:",
    "{",
    '  "topicsCovered": string[],     // the distinct topics / concepts taught in the session',
    '  "problemsAttempted": number,   // count of practice problems the student attempted',
    '  "correctCount": number,        // count of student answers graded "correct"',
    '  "incorrectCount": number,      // count of student answers graded "incorrect" or "partially-correct"',
    '  "suggestedNextSteps": string[],// 2-4 concrete next steps for the student',
    '  "narrative": string            // 2-4 sentence plain-English recap of the session',
    "}",
    "Derive problemsAttempted / correctCount / incorrectCount from the event log:",
    '  - Each "practice-problem" event counts as one attempt IF a later "student-answer" event exists for it.',
    '  - Each "ai-feedback" event with metadata.correctness == "correct" adds to correctCount.',
    '  - Each "ai-feedback" event with metadata.correctness in ["incorrect","partially-correct"] adds to incorrectCount.',
    "When the log is empty, return zero counts and an empty topics array.",
  ].join("\n");

  const userPrompt = ["=== Session event log ===", log].join("\n");

  return { systemPrompt, userPrompt };
}
