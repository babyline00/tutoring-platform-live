/**
 * Prompt builder for the AI-assisted tutor panel.
 *
 * When the tutor types a concept they're about to explain, the LLM returns
 * a JSON object with four fields:
 *
 *   - outline: string[] — 3 bullet points covering the key ideas to teach.
 *   - misconception: string — a common student misconception to proactively
 *     address during the explanation.
 *   - analogy: string — a real-world analogy that makes the concept click.
 *   - practiceProblem: string — a short practice problem to assign.
 *
 * The builder is a pure function so it can be unit-tested without an LLM.
 */

import type { BuiltPrompt } from "@/lib/types";

export function buildSuggestPrompt(
  concept: string,
  subject: string,
  difficulty: string,
  studentLevel: string,
): BuiltPrompt {
  const safeConcept = concept.trim() || "(no concept provided)";
  const systemPrompt = [
    "You are an expert pedagogy assistant embedded in a live tutoring platform.",
    `The active session is in the subject "${subject}" at "${difficulty}" difficulty for a "${studentLevel}" student.`,
    "The tutor has just typed a concept they are about to explain. Your job is to give them a tight, high-signal teaching plan — NOT to explain the concept to the student yourself.",
    "",
    "Respond with a single JSON object and NOTHING else. Do not wrap it in markdown fences.",
    "Schema:",
    "{",
    '  "outline": string[],           // exactly 3 bullet points (strings), each one key idea to cover',
    '  "misconception": string,        // one common student misconception about this concept, written as a single sentence',
    '  "analogy": string,              // one concrete real-world analogy the tutor can use',
    '  "practiceProblem": string       // a short practice problem (1-3 sentences) the tutor can assign',
    "}",
    "Keep each field concise. The outline array MUST have exactly 3 items.",
  ].join("\n");

  const userPrompt = `Concept to teach: ${safeConcept}`;

  return { systemPrompt, userPrompt };
}
