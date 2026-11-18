import { test, expect, describe } from "bun:test";
import {
  formatReplayStep,
  buildReplaySequence,
  buildTransition,
  replayProgressCaption,
  replayStepTitle,
} from "../replay";
import type { SessionEventDTO } from "../types";

function mk(ordinal: number, type: string, content: string): SessionEventDTO {
  return {
    id: `e${ordinal}`,
    sessionId: "s1",
    ordinal,
    type,
    content,
    metadata: null,
    createdAt: new Date(2025, 0, 1, 0, 0, ordinal).toISOString(),
  };
}

describe("formatReplayStep", () => {
  test("returns { ordinal, view, transition, isFirst }", () => {
    const step = formatReplayStep(mk(1, "session-start", "begin"));
    expect(step.ordinal).toBe(1);
    expect(step.view.id).toBe("e1");
    expect(typeof step.transition).toBe("string");
    expect(step.transition.length).toBeGreaterThan(0);
    expect(step.isFirst).toBe(true);
  });

  test("isFirst is false when prevEvent is provided", () => {
    const step = formatReplayStep(mk(2, "tutor-concept", "gravity"), mk(1, "session-start", "begin"));
    expect(step.isFirst).toBe(false);
  });

  test("transition references both previous and current event types", () => {
    const step = formatReplayStep(mk(2, "ai-suggestion", "outline"), mk(1, "tutor-concept", "gravity"));
    expect(step.transition.toLowerCase()).toContain("outline");
  });

  test("view is the formatted timeline view", () => {
    const step = formatReplayStep(mk(1, "tutor-concept", "gravity"));
    expect(step.view.typeLabel).toBe("Tutor concept");
  });
});

describe("buildTransition — known pairs", () => {
  test("tutor-concept → ai-suggestion has a friendly transition", () => {
    const t = buildTransition("tutor-concept", "ai-suggestion");
    expect(t.toLowerCase()).toContain("outline");
  });

  test("practice-problem → student-answer references the answer submission", () => {
    const t = buildTransition("practice-problem", "student-answer");
    expect(t.toLowerCase()).toContain("student");
    expect(t.toLowerCase()).toContain("answer");
  });

  test("student-answer → ai-feedback references the evaluation", () => {
    const t = buildTransition("student-answer", "ai-feedback");
    expect(t.toLowerCase()).toContain("evaluat");
  });

  test("first event transition starts with 'Session begins'", () => {
    const t = buildTransition(undefined, "session-start");
    expect(t).toContain("Session begins");
  });
});

describe("buildTransition — fallback", () => {
  test("unknown pair falls back to 'prevLabel → newLabel'", () => {
    const t = buildTransition("ai-followup", "ai-analogy");
    expect(t).toContain("→");
  });
});

describe("buildReplaySequence", () => {
  test("sorts events by ordinal and marks the first step", () => {
    const events = [
      mk(3, "ai-suggestion", "c"),
      mk(1, "session-start", "a"),
      mk(2, "tutor-concept", "b"),
    ];
    const seq = buildReplaySequence(events);
    expect(seq.map((s) => s.ordinal)).toEqual([1, 2, 3]);
    expect(seq[0].isFirst).toBe(true);
    expect(seq[1].isFirst).toBe(false);
    expect(seq[2].isFirst).toBe(false);
  });

  test("returns empty array for empty input", () => {
    expect(buildReplaySequence([])).toEqual([]);
  });

  test("each step's transition builds on the previous step's type", () => {
    const events = [
      mk(1, "tutor-concept", "c"),
      mk(2, "ai-suggestion", "o"),
    ];
    const seq = buildReplaySequence(events);
    expect(seq[1].transition.toLowerCase()).toContain("outline");
  });
});

describe("replayProgressCaption", () => {
  test("returns 'Step N of M'", () => {
    expect(replayProgressCaption(3, 9)).toBe("Step 3 of 9");
  });

  test("clamps current to [1, total]", () => {
    expect(replayProgressCaption(0, 5)).toBe("Step 1 of 5");
    expect(replayProgressCaption(99, 5)).toBe("Step 5 of 5");
  });

  test("returns a placeholder for total <= 0", () => {
    expect(replayProgressCaption(1, 0)).toBe("No events to replay");
  });
});

describe("replayStepTitle", () => {
  test("truncates long content with an ellipsis", () => {
    expect(replayStepTitle("x".repeat(200), 50)).toBe("x".repeat(50) + "…");
  });

  test("returns short content unchanged", () => {
    expect(replayStepTitle("short", 80)).toBe("short");
  });
});
