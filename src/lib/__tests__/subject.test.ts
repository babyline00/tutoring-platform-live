import { test, expect, describe } from "bun:test";
import {
  SUBJECT_SEEDS,
  validateSeed,
  validateAllSeeds,
  serializeTopics,
  parseTopics,
} from "../seed-helpers";

describe("SUBJECT_SEEDS", () => {
  test("contains exactly 6 subjects", () => {
    expect(SUBJECT_SEEDS).toHaveLength(6);
  });

  test("every seed has a non-empty name", () => {
    for (const s of SUBJECT_SEEDS) {
      expect(typeof s.name).toBe("string");
      expect(s.name.length).toBeGreaterThan(0);
    }
  });

  test("every seed has a non-empty label", () => {
    for (const s of SUBJECT_SEEDS) {
      expect(typeof s.label).toBe("string");
      expect(s.label.length).toBeGreaterThan(0);
    }
  });

  test("every seed has a non-empty topics array", () => {
    for (const s of SUBJECT_SEEDS) {
      expect(Array.isArray(s.topics)).toBe(true);
      expect(s.topics.length).toBeGreaterThan(0);
    }
  });

  test("every topic is a non-empty string", () => {
    for (const s of SUBJECT_SEEDS) {
      for (const t of s.topics) {
        expect(typeof t).toBe("string");
        expect(t.trim().length).toBeGreaterThan(0);
      }
    }
  });

  test("includes the 6 named subjects from the spec", () => {
    const names = SUBJECT_SEEDS.map((s) => s.name).sort();
    expect(names).toEqual(
      ["chemistry", "general", "languages", "math", "physics", "programming"].sort(),
    );
  });

  test("subject names are unique", () => {
    const names = SUBJECT_SEEDS.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("validateSeed", () => {
  test("returns no errors for a valid seed", () => {
    const errs = validateSeed({ name: "x", label: "X", topics: ["a"] });
    expect(errs).toEqual([]);
  });

  test("flags empty name", () => {
    const errs = validateSeed({ name: "", label: "X", topics: ["a"] });
    expect(errs.some((e) => e.includes("name"))).toBe(true);
  });

  test("flags empty label", () => {
    const errs = validateSeed({ name: "x", label: "", topics: ["a"] });
    expect(errs.some((e) => e.includes("label"))).toBe(true);
  });

  test("flags empty topics array", () => {
    const errs = validateSeed({ name: "x", label: "X", topics: [] });
    expect(errs.some((e) => e.includes("topics"))).toBe(true);
  });

  test("flags non-string topics", () => {
    const errs = validateSeed({ name: "x", label: "X", topics: ["a", 5 as unknown as string] });
    expect(errs.some((e) => e.includes("topics[1]"))).toBe(true);
  });
});

describe("validateAllSeeds", () => {
  test("returns no errors for the real SUBJECT_SEEDS", () => {
    expect(validateAllSeeds(SUBJECT_SEEDS)).toEqual([]);
  });

  test("flags duplicate names", () => {
    const dup = [
      { name: "math", label: "Math", topics: ["a"] },
      { name: "math", label: "Math 2", topics: ["b"] },
    ];
    const errs = validateAllSeeds(dup);
    expect(errs.some((e) => e.includes("duplicate"))).toBe(true);
  });
});

describe("serializeTopics / parseTopics roundtrip", () => {
  test("roundtrips a topic array", () => {
    const topics = ["Algebra", "Geometry", "Calculus"];
    const raw = serializeTopics(topics);
    expect(parseTopics(raw)).toEqual(topics);
  });

  test("parseTopics returns [] for invalid JSON", () => {
    expect(parseTopics("not json")).toEqual([]);
  });

  test("parseTopics returns [] for a JSON non-array", () => {
    expect(parseTopics(JSON.stringify({ a: 1 }))).toEqual([]);
  });

  test("parseTopics filters out non-string entries", () => {
    expect(parseTopics(JSON.stringify(["a", 1, "b", null, true]))).toEqual(["a", "b"]);
  });
});
