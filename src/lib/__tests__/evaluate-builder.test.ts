import { test, expect, describe } from "bun:test";
import { buildEvaluatePrompt } from "../evaluate-builder";

describe("buildEvaluatePrompt", () => {
  test("returns a { systemPrompt, userPrompt } object", () => {
    const p = buildEvaluatePrompt("42", "What is 6*7?", "6*7 = 42");
    expect(typeof p.systemPrompt).toBe("string");
    expect(typeof p.userPrompt).toBe("string");
  });

  test("user prompt includes the student answer", () => {
    const p = buildEvaluatePrompt("The answer is 42 because 6*7=42", "What is 6*7?", "6*7=42");
    expect(p.userPrompt).toContain("The answer is 42");
  });

  test("user prompt includes the problem question when provided", () => {
    const p = buildEvaluatePrompt("42", "What is 6*7?", "6*7=42");
    expect(p.userPrompt).toContain("What is 6*7?");
  });

  test("user prompt includes the worked solution when provided", () => {
    const p = buildEvaluatePrompt("42", "What is 6*7?", "6*7=42");
    expect(p.userPrompt).toContain("6*7=42");
  });

  test("handles missing problem/solution gracefully", () => {
    const p = buildEvaluatePrompt("some answer");
    expect(p.userPrompt.toLowerCase()).toContain("no reference");
    expect(p.userPrompt).toContain("some answer");
  });

  test("requests correctness, feedback, and followUpProblem fields", () => {
    const p = buildEvaluatePrompt("42", "q", "s");
    expect(p.systemPrompt).toContain("correctness");
    expect(p.systemPrompt).toContain("feedback");
    expect(p.systemPrompt).toContain("followUpProblem");
  });

  test("restricts correctness to the three enum values", () => {
    const p = buildEvaluatePrompt("42", "q", "s");
    expect(p.systemPrompt).toContain("correct");
    expect(p.systemPrompt).toContain("partially-correct");
    expect(p.systemPrompt).toContain("incorrect");
  });

  test("instructs LLM to respond as JSON", () => {
    const p = buildEvaluatePrompt("42", "q", "s");
    expect(p.systemPrompt.toLowerCase()).toContain("json");
  });

  test("handles empty student answer gracefully (non-empty user prompt)", () => {
    const p = buildEvaluatePrompt("");
    expect(p.userPrompt.length).toBeGreaterThan(0);
  });
});
