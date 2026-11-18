import { test, expect, describe } from "bun:test";
import { buildSuggestPrompt } from "../suggest-builder";

describe("buildSuggestPrompt", () => {
  test("returns a { systemPrompt, userPrompt } object", () => {
    const p = buildSuggestPrompt("gravity", "physics", "intermediate", "high-school");
    expect(typeof p.systemPrompt).toBe("string");
    expect(typeof p.userPrompt).toBe("string");
    expect(p.systemPrompt.length).toBeGreaterThan(0);
    expect(p.userPrompt.length).toBeGreaterThan(0);
  });

  test("user prompt includes the concept", () => {
    const p = buildSuggestPrompt("Newton's second law", "physics", "advanced", "undergraduate");
    expect(p.userPrompt).toContain("Newton's second law");
  });

  test("system prompt includes the subject context", () => {
    const p = buildSuggestPrompt("x", "chemistry", "beginner", "middle-school");
    expect(p.systemPrompt).toContain("chemistry");
    expect(p.systemPrompt).toContain("beginner");
    expect(p.systemPrompt).toContain("middle-school");
  });

  test("system prompt instructs the LLM to respond as JSON", () => {
    const p = buildSuggestPrompt("x", "math", "intermediate", "high-school");
    expect(p.systemPrompt.toLowerCase()).toContain("json");
  });

  test("system prompt requests the four output fields", () => {
    const p = buildSuggestPrompt("x", "math", "intermediate", "high-school");
    expect(p.systemPrompt).toContain("outline");
    expect(p.systemPrompt).toContain("misconception");
    expect(p.systemPrompt).toContain("analogy");
    expect(p.systemPrompt).toContain("practiceProblem");
  });

  test("outline field is declared as a string array", () => {
    const p = buildSuggestPrompt("x", "math", "intermediate", "high-school");
    expect(p.systemPrompt).toContain('"outline": string[]');
  });

  test("asks for exactly 3 outline bullets", () => {
    const p = buildSuggestPrompt("x", "math", "intermediate", "high-school");
    expect(p.systemPrompt).toMatch(/3 (bullet|items)/i);
  });

  test("handles empty concept gracefully (non-empty user prompt)", () => {
    const p = buildSuggestPrompt("", "math", "intermediate", "high-school");
    expect(p.userPrompt.length).toBeGreaterThan(0);
  });
});
