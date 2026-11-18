/**
 * Prompt builder for practice problem generation.
 *
 * Given a topic + difficulty + student level, the LLM returns a JSON object:
 *
 *   - question: string — the practice problem statement.
 *   - hints: string[] — 2-3 progressive hints (don't give away the answer).
 *   - workedSolution: string — a fully worked solution the tutor can reveal
 *     and which is later used as the ground-truth for answer evaluation.
 *
 * Pure function — unit-tested without an LLM.
 */

import type { BuiltPrompt } from "@/lib/types";

export function buildProblemPrompt(
  topic: string,
  difficulty: string,
  studentLevel: string,
): BuiltPrompt {
  const safeTopic = topic.trim() || "(no topic provided)";
  const systemPrompt = [
    "You are a curriculum designer embedded in a live tutoring platform.",
    `Generate ONE practice problem on the requested topic, calibrated to "${difficulty}" difficulty for a "${studentLevel}" student.`,
    "The problem must be self-contained, solvable in under 5 minutes, and have a single best answer (or a clearly correct worked solution for free-response items).",
    "",
    "Respond with a single JSON object and NOTHING else. Do not wrap it in markdown fences.",
    "Schema:",
    "{",
    '  "question": string,         // the problem statement (1-4 sentences)',
    '  "hints": string[],          // 2-3 progressive hints, ordered from nudge to near-answer. NEVER reveal the final answer in a hint.',
    '  "workedSolution": string    // a fully worked solution explaining each step. Use plain text, not LaTeX.',
    "}",
    "The hints array MUST contain between 2 and 3 items.",
  ].join("\n");

  const userPrompt = `Topic: ${safeTopic}`;

  return { systemPrompt, userPrompt };
}
