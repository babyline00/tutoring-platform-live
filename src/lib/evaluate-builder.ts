/**
 * Prompt builder for answer evaluation.
 *
 * Given the student's answer (and optionally the original problem + worked
 * solution as ground truth), the LLM returns:
 *
 *   - correctness: "correct" | "partially-correct" | "incorrect"
 *   - feedback: string — concise, encouraging, actionable feedback.
 *   - followUpProblem?: string — only included when the answer is wrong or
 *     partially correct; a short follow-up problem that targets the gap.
 *
 * Pure function — unit-tested without an LLM.
 */

import type { BuiltPrompt } from "@/lib/types";

export function buildEvaluatePrompt(
  studentAnswer: string,
  problemQuestion?: string,
  workedSolution?: string,
): BuiltPrompt {
  const safeAnswer = studentAnswer.trim() || "(empty answer)";
  const contextLines: string[] = [];
  if (problemQuestion && problemQuestion.trim()) {
    contextLines.push(`Problem: ${problemQuestion.trim()}`);
  }
  if (workedSolution && workedSolution.trim()) {
    contextLines.push(`Reference worked solution: ${workedSolution.trim()}`);
  }
  const context = contextLines.length ? contextLines.join("\n") : "(no reference solution provided — evaluate on soundness of reasoning alone)";

  const systemPrompt = [
    "You are a grader embedded in a live tutoring platform.",
    "Evaluate the student's answer against the reference worked solution (if provided).",
    "Be encouraging but precise. Credit partially-correct reasoning.",
    "",
    "Respond with a single JSON object and NOTHING else. Do not wrap it in markdown fences.",
    "Schema:",
    "{",
    '  "correctness": "correct" | "partially-correct" | "incorrect",',
    '  "feedback": string,                         // 2-4 sentences: what was right, what was wrong, the fix',
    '  "followUpProblem": string                   // ONLY when correctness is "incorrect" or "partially-correct".',
    '                                              // A short follow-up problem targeting the gap. Omit the field',
    '                                              // entirely when the answer is fully correct.',
    "}",
    "The correctness field MUST be one of exactly: \"correct\", \"partially-correct\", \"incorrect\".",
  ].join("\n");

  const userPrompt = [
    "=== Context ===",
    context,
    "",
    "=== Student answer ===",
    safeAnswer,
  ].join("\n");

  return { systemPrompt, userPrompt };
}
