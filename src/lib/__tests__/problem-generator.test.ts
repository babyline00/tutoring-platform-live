import { test, expect, describe } from "bun:test";
import { buildProblemPrompt } from "../problem-generator";

describe("buildProblemPrompt", () => {
  test("returns a { systemPrompt, userPrompt } object", () => {
    const p = buildProblemPrompt("quadratics", "intermediate", "high-school");
    expect(typeof p.systemPrompt).toBe("string");
    expect(typeof p.userPrompt).toBe("string");
  });

  test("user prompt includes the topic", () => {
    const p = buildProblemPrompt("Pythagorean theorem", "beginner", "middle-school");
    expect(p.userPrompt).toContain("Pythagorean theorem");
  });

  test("system prompt includes difficulty + student level context", () => {
    const p = buildProblemPrompt("x", "advanced", "graduate");
    expect(p.systemPrompt).toContain("advanced");
    expect(p.systemPrompt).toContain("graduate");
  });

  test("requests question, hints, and worked solution fields", () => {
    const p = buildProblemPrompt("x", "intermediate", "high-school");
    expect(p.systemPrompt).toContain("question");
    expect(p.systemPrompt).toContain("hints");
    expect(p.systemPrompt).toContain("workedSolution");
  });

  test("instructs LLM to respond as JSON", () => {
    const p = buildProblemPrompt("x", "intermediate", "high-school");
    expect(p.systemPrompt.toLowerCase()).toContain("json");
  });

  test("declares hints as a string array", () => {
    const p = buildProblemPrompt("x", "intermediate", "high-school");
    expect(p.systemPrompt).toContain('"hints": string[]');
  });

  test("constrains hints to 2-3 items", () => {
    const p = buildProblemPrompt("x", "intermediate", "high-school");
    expect(p.systemPrompt).toMatch(/2.*3/);
  });

  test("handles empty topic gracefully", () => {
    const p = buildProblemPrompt("", "intermediate", "high-school");
    expect(p.userPrompt.length).toBeGreaterThan(0);
  });
});
