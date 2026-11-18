import { test, expect, describe } from "bun:test";
import { parseLlmJson, ParseError, stripCodeFence } from "../parser";

describe("parseLlmJson — happy paths", () => {
  test("parses plain JSON object", () => {
    const out = parseLlmJson<{ a: number; b: string }>('{"a":1,"b":"x"}');
    expect(out).toEqual({ a: 1, b: "x" });
  });

  test("parses JSON inside ```json fences", () => {
    const out = parseLlmJson<{ ok: boolean }>('```json\n{"ok":true}\n```');
    expect(out).toEqual({ ok: true });
  });

  test("parses JSON inside bare ``` fences (no language tag)", () => {
    const out = parseLlmJson<{ v: number }>("```\n{\"v\":42}\n```");
    expect(out).toEqual({ v: 42 });
  });

  test("parses JSON with leading prose", () => {
    const out = parseLlmJson<{ a: number }>(
      'Sure! Here is the JSON you asked for:\n{"a":7}\nLet me know if you need more.',
    );
    expect(out).toEqual({ a: 7 });
  });

  test("parses JSON with trailing prose", () => {
    const out = parseLlmJson<{ a: number }>('{"a":3}\n\nHope this helps!');
    expect(out).toEqual({ a: 3 });
  });

  test("parses JSON with both leading AND trailing prose", () => {
    const out = parseLlmJson<{ a: number }>(
      'Here you go:\n{"a":99}\n\nThat is all.',
    );
    expect(out).toEqual({ a: 99 });
  });

  test("parses nested objects with braces inside strings", () => {
    const out = parseLlmJson<{ outer: { inner: string } }>(
      '{"outer":{"inner":"has a } in it"}}',
    );
    expect(out.outer.inner).toBe("has a } in it");
  });

  test("parses a top-level JSON array", () => {
    const out = parseLlmJson<number[]>("[1, 2, 3]");
    expect(out).toEqual([1, 2, 3]);
  });

  test("parses a JSON array with leading prose", () => {
    const out = parseLlmJson<number[]>("Here:\n[1, 2, 3]");
    expect(out).toEqual([1, 2, 3]);
  });

  test("handles escaped quotes inside string values", () => {
    const out = parseLlmJson<{ q: string }>('{"q":"He said \\"hi\\" to me"}');
    expect(out.q).toBe('He said "hi" to me');
  });
});

describe("parseLlmJson — error paths", () => {
  test("throws ParseError on empty input", () => {
    expect(() => parseLlmJson("")).toThrow(ParseError);
  });

  test("throws ParseError when no JSON is present", () => {
    expect(() => parseLlmJson("Just plain prose with no braces.")).toThrow(ParseError);
  });

  test("throws ParseError on unbalanced braces", () => {
    expect(() => parseLlmJson('{"a":1')).toThrow(ParseError);
  });

  test("throws ParseError on null/undefined input", () => {
    expect(() => parseLlmJson(null as unknown as string)).toThrow(ParseError);
  });
});

describe("stripCodeFence", () => {
  test("removes ```json fences", () => {
    expect(stripCodeFence("```json\n{x}\n```")).toBe("{x}");
  });

  test("removes bare ``` fences", () => {
    expect(stripCodeFence("```\n{x}\n```")).toBe("{x}");
  });

  test("returns input unchanged when no fence", () => {
    expect(stripCodeFence('{"a":1}')).toBe('{"a":1}');
  });

  test("trims surrounding whitespace", () => {
    expect(stripCodeFence('  ```\n{x}\n```  ')).toBe("{x}");
  });
});
