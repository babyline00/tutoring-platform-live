import { test, expect, describe, beforeAll } from "bun:test";
import {
  getTutorProvider,
  __setTutorProviderForTest,
  completeJson,
  type TutorProvider,
} from "../ai";

// Force the mock provider for the whole suite — without this, getTutorProvider()
// would try to construct a ZaiProvider whose complete() calls the real SDK
// (which has no .z-ai-config in the test sandbox and would throw at call-time).
beforeAll(() => {
  process.env.PKC_DISABLE_LLM = "1";
});

/**
 * Tests for the AI layer with the offline MockProvider.
 *
 * The MockProvider recognises a `__mockJson:<base64>__endMock__` marker in
 * the system prompt and returns the decoded JSON string verbatim, so tests
 * can assert on the parsed shape without hitting a real LLM. The default
 * (no marker) returns a tiny `{ mock: true, echo: "…" }` payload.
 */

function encodeMockPayload(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj), "utf-8").toString("base64");
}

class MockTutor implements TutorProvider {
  constructor(private readonly payload: string) {}
  async complete(): Promise<string> {
    return this.payload;
  }
  async *stream() {
    yield this.payload;
  }
}

describe("MockProvider — default behavior", () => {
  test("getTutorProvider returns a provider", () => {
    __setTutorProviderForTest(null);
    const p = getTutorProvider();
    expect(p).toBeDefined();
    expect(typeof p.complete).toBe("function");
  });

  test("default complete returns a JSON string with mock=true", async () => {
    __setTutorProviderForTest(null);
    const p = getTutorProvider();
    const out = await p.complete({ systemPrompt: "sys", userPrompt: "hi" });
    const parsed = JSON.parse(out);
    expect(parsed.mock).toBe(true);
    expect(parsed.echo).toBe("hi");
  });

  test("default complete echoes the first 80 chars of the user prompt", async () => {
    __setTutorProviderForTest(null);
    const p = getTutorProvider();
    const long = "x".repeat(200);
    const out = await p.complete({ systemPrompt: "sys", userPrompt: long });
    const parsed = JSON.parse(out);
    expect(parsed.echo.length).toBeLessThanOrEqual(80);
  });
});

describe("MockProvider — __mockJson hint", () => {
  test("emits a custom JSON payload when the marker is present", async () => {
    __setTutorProviderForTest(null);
    const p = getTutorProvider();
    const payload = encodeMockPayload({ outline: ["a", "b", "c"], misconception: "m", analogy: "an", practiceProblem: "pp" });
    const out = await p.complete({
      systemPrompt: `system prompt __mockJson:${payload}__endMock__`,
      userPrompt: "anything",
    });
    const parsed = JSON.parse(out);
    expect(parsed.outline).toEqual(["a", "b", "c"]);
    expect(parsed.misconception).toBe("m");
  });

  test("stream yields the mock echo", async () => {
    __setTutorProviderForTest(null);
    const p = getTutorProvider();
    const out: string[] = [];
    for await (const d of p.stream({
      systemPrompt: "sys",
      messages: [{ role: "user", content: "stream me" }],
    })) {
      out.push(d);
    }
    expect(out.join("")).toContain("mock tutor");
    expect(out.join("")).toContain("stream me");
  });
});

describe("completeJson — parses the LLM output", () => {
  test("parses a plain JSON object from the mock provider", async () => {
    __setTutorProviderForTest(null);
    const payload = encodeMockPayload({
      outline: ["1", "2", "3"],
      misconception: "students forget to distribute",
      analogy: "like distributing mail into mailboxes",
      practiceProblem: "Solve 2(x+3) = 14",
    });
    const out = await completeJson<{ outline: string[]; misconception: string; analogy: string; practiceProblem: string }>({
      systemPrompt: `__mockJson:${payload}__endMock__`,
      userPrompt: "concept",
    });
    expect(out.outline).toEqual(["1", "2", "3"]);
    expect(out.misconception).toBe("students forget to distribute");
  });

  test("parses a fenced JSON payload", async () => {
    const fenced = "```json\n{\"correctness\":\"correct\",\"feedback\":\"good\"}\n```";
    __setTutorProviderForTest(new MockTutor(fenced));
    const out = await completeJson<{ correctness: string; feedback: string }>({
      systemPrompt: "sys",
      userPrompt: "x",
    });
    expect(out.correctness).toBe("correct");
    expect(out.feedback).toBe("good");
    __setTutorProviderForTest(null);
  });

  test("parses JSON with leading prose", async () => {
    __setTutorProviderForTest(new MockTutor('Sure!\n{"question":"q","hints":["h1","h2"],"workedSolution":"ws"}'));
    const out = await completeJson<{ question: string; hints: string[]; workedSolution: string }>({
      systemPrompt: "sys",
      userPrompt: "x",
    });
    expect(out.question).toBe("q");
    expect(out.hints).toEqual(["h1", "h2"]);
    __setTutorProviderForTest(null);
  });

  test("throws when the provider returns non-JSON text", async () => {
    __setTutorProviderForTest(new MockTutor("this is not json at all"));
    await expect(
      completeJson({ systemPrompt: "sys", userPrompt: "x" }),
    ).rejects.toThrow();
    __setTutorProviderForTest(null);
  });
});

describe("provider caching", () => {
  test("getTutorProvider returns the same instance on repeat calls", () => {
    __setTutorProviderForTest(null);
    const a = getTutorProvider();
    const b = getTutorProvider();
    expect(a).toBe(b);
    __setTutorProviderForTest(null);
  });

  test("__setTutorProviderForTest(null) resets the cache", () => {
    __setTutorProviderForTest(null);
    const a = getTutorProvider();
    __setTutorProviderForTest(null);
    const b = getTutorProvider();
    expect(a).not.toBe(b);
    __setTutorProviderForTest(null);
  });
});
