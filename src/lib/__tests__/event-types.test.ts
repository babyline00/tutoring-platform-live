import { test, expect, describe } from "bun:test";
import {
  formatEventForTimeline,
  formatTimeline,
  previewContent,
  parseMetadata,
  EVENT_TYPE_META,
} from "../event-types";
import type { SessionEventDTO, SessionEventType } from "../types";

function mk(ordinal: number, type: string, content: string, metadata?: string): SessionEventDTO {
  return {
    id: `e${ordinal}`,
    sessionId: "s1",
    ordinal,
    type,
    content,
    metadata: metadata ?? null,
    createdAt: new Date(2025, 0, 1, 0, 0, ordinal).toISOString(),
  };
}

describe("formatEventForTimeline", () => {
  test("returns a view with id, ordinal, type, typeLabel, badgeClass, content, contentPreview, metadata, createdAt", () => {
    const view = formatEventForTimeline(mk(1, "tutor-concept", "gravity"));
    expect(view.id).toBe("e1");
    expect(view.ordinal).toBe(1);
    expect(view.type).toBe("tutor-concept");
    expect(view.typeLabel).toBe("Tutor concept");
    expect(typeof view.badgeClass).toBe("string");
    expect(view.badgeClass.length).toBeGreaterThan(0);
    expect(view.content).toBe("gravity");
    expect(view.contentPreview).toBe("gravity");
    expect(view.metadata).toBeNull();
  });

  test("contentPreview truncates long content with an ellipsis", () => {
    const long = "x".repeat(200);
    const view = formatEventForTimeline(mk(1, "ai-suggestion", long));
    expect(view.contentPreview.length).toBeLessThanOrEqual(123);
    expect(view.contentPreview.endsWith("…")).toBe(true);
  });

  test("contentPreview collapses whitespace to a single line", () => {
    const view = formatEventForTimeline(mk(1, "ai-suggestion", "line one\nline two\ttabbed"));
    expect(view.contentPreview).toContain("line one line two tabbed");
    expect(view.contentPreview).not.toContain("\n");
  });

  test("parses valid JSON metadata into an object", () => {
    const view = formatEventForTimeline(mk(1, "ai-feedback", "ok", JSON.stringify({ correctness: "correct" })));
    expect(view.metadata).toEqual({ correctness: "correct" });
  });

  test("handles malformed metadata gracefully", () => {
    const view = formatEventForTimeline(mk(1, "ai-feedback", "ok", "{not json"));
    expect(view.metadata).toEqual({ raw: "{not json" });
  });

  test("falls back to a generic label + badge for unknown event types", () => {
    const view = formatEventForTimeline(mk(1, "mystery-type", "x"));
    expect(view.typeLabel).toBe("Event");
    expect(view.badgeClass).toContain("bg-muted");
  });
});

describe("formatTimeline", () => {
  test("sorts events by ordinal ascending", () => {
    const events = [
      mk(3, "tutor-concept", "c"),
      mk(1, "session-start", "s"),
      mk(2, "ai-suggestion", "a"),
    ];
    const out = formatTimeline(events);
    expect(out.map((o) => o.ordinal)).toEqual([1, 2, 3]);
  });

  test("returns an empty array for empty input", () => {
    expect(formatTimeline([])).toEqual([]);
  });
});

describe("EVENT_TYPE_META coverage", () => {
  test("every SessionEventType has a meta entry with a non-empty label + badgeClass", () => {
    const types: SessionEventType[] = [
      "session-start",
      "tutor-concept",
      "ai-suggestion",
      "ai-misconception",
      "ai-analogy",
      "practice-problem",
      "student-answer",
      "ai-feedback",
      "ai-followup",
      "session-summary",
    ];
    for (const t of types) {
      const meta = EVENT_TYPE_META[t];
      expect(meta).toBeDefined();
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.badgeClass.length).toBeGreaterThan(0);
    }
  });

  test("no event type badge uses indigo or blue colors", () => {
    const types = Object.keys(EVENT_TYPE_META) as SessionEventType[];
    for (const t of types) {
      const cls = EVENT_TYPE_META[t].badgeClass.toLowerCase();
      expect(cls).not.toContain("indigo");
      expect(cls).not.toContain("blue");
    }
  });
});

describe("previewContent + parseMetadata helpers", () => {
  test("previewContent respects custom max length", () => {
    expect(previewContent("abcdefghij", 5)).toBe("abcde…");
    expect(previewContent("abc", 5)).toBe("abc");
  });

  test("parseMetadata returns null for null input", () => {
    expect(parseMetadata(null)).toBeNull();
  });

  test("parseMetadata wraps non-object JSON in { value }", () => {
    expect(parseMetadata(JSON.stringify("hello"))).toEqual({ value: "hello" });
    expect(parseMetadata(JSON.stringify([1, 2]))).toEqual({ value: [1, 2] });
  });
});
