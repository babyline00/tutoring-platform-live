import { test, expect, describe } from "bun:test";
import { buildSummaryPrompt } from "../summary-builder";
import type { SessionEventDTO } from "../types";

function mkEvent(ordinal: number, type: string, content: string, metadata?: Record<string, unknown>): SessionEventDTO {
  return {
    id: `e${ordinal}`,
    sessionId: "s1",
    ordinal,
    type,
    content,
    metadata: metadata ? JSON.stringify(metadata) : null,
    createdAt: new Date(2025, 0, 1, 0, 0, ordinal).toISOString(),
  };
}

describe("buildSummaryPrompt", () => {
  test("returns a { systemPrompt, userPrompt } object", () => {
    const p = buildSummaryPrompt([mkEvent(1, "session-start", "started")]);
    expect(typeof p.systemPrompt).toBe("string");
    expect(typeof p.userPrompt).toBe("string");
  });

  test("user prompt includes the events as context", () => {
    const events = [
      mkEvent(1, "session-start", "Session started"),
      mkEvent(2, "tutor-concept", "gravity"),
      mkEvent(3, "ai-suggestion", "outline"),
    ];
    const p = buildSummaryPrompt(events);
    expect(p.userPrompt).toContain("gravity");
    expect(p.userPrompt).toContain("outline");
    expect(p.userPrompt).toContain("session-start");
  });

  test("events are numbered by ordinal", () => {
    const events = [
      mkEvent(5, "student-answer", "answer 5"),
      mkEvent(1, "session-start", "start"),
      mkEvent(3, "tutor-concept", "concept"),
    ];
    const p = buildSummaryPrompt(events);
    expect(p.userPrompt).toContain("1. [session-start]");
    expect(p.userPrompt).toContain("3. [tutor-concept]");
    expect(p.userPrompt).toContain("5. [student-answer]");
  });

  test("empty events produce a safe fallback line", () => {
    const p = buildSummaryPrompt([]);
    expect(p.userPrompt.toLowerCase()).toContain("no events");
  });

  test("system prompt requests the summary schema fields", () => {
    const p = buildSummaryPrompt([]);
    expect(p.systemPrompt).toContain("topicsCovered");
    expect(p.systemPrompt).toContain("problemsAttempted");
    expect(p.systemPrompt).toContain("correctCount");
    expect(p.systemPrompt).toContain("incorrectCount");
    expect(p.systemPrompt).toContain("suggestedNextSteps");
    expect(p.systemPrompt).toContain("narrative");
  });

  test("instructs LLM to respond as JSON", () => {
    const p = buildSummaryPrompt([]);
    expect(p.systemPrompt.toLowerCase()).toContain("json");
  });

  test("explains how to derive the counts from the event log", () => {
    const p = buildSummaryPrompt([]);
    expect(p.systemPrompt).toContain("practice-problem");
    expect(p.systemPrompt).toContain("ai-feedback");
    expect(p.systemPrompt).toContain("metadata.correctness");
  });
});
