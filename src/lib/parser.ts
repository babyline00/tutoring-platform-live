/**
 * `parseLlmJson(text)` — defensively extract a JSON object from an LLM
 * response that may be:
 *
 *   1. Plain JSON:            `{"a": 1}`
 *   2. Fenced JSON:           ` ```json\n{"a": 1}\n``` `
 *   3. Fenced (no lang):      ` ```\n{"a": 1}\n``` `
 *   4. JSON with leading prose: `Sure! Here you go:\n{"a": 1}`
 *   5. JSON with trailing prose: `{"a": 1}\n\nLet me know if...`
 *
 * Strategy: strip ``` fences if present, then find the first `{` and the
 * last `}` and attempt to parse the substring. We prefer balanced-brace
 * scanning over a naive regex so nested objects / arrays survive.
 */

export function parseLlmJson<T = unknown>(text: string): T {
  if (text == null) throw new ParseError("parseLlmJson: text is null/undefined");
  const raw = stripCodeFence(text).trim();
  if (!raw) throw new ParseError("parseLlmJson: empty input");

  // Fast path — the whole thing is already valid JSON.
  try {
    return JSON.parse(raw) as T;
  } catch {
    // fall through to substring scan
  }

  const start = raw.indexOf("{");
  if (start === -1) {
    // Some models emit a JSON array instead of an object for lists.
    const arrStart = raw.indexOf("[");
    if (arrStart !== -1) {
      const candidate = balanceArray(raw, arrStart);
      try {
        return JSON.parse(candidate) as T;
      } catch {
        // continue
      }
    }
    throw new ParseError(
      `parseLlmJson: no opening '{' or '[' found in "${preview(raw)}"`,
    );
  }

  const candidate = balanceObject(raw, start);
  try {
    return JSON.parse(candidate) as T;
  } catch (e) {
    throw new ParseError(
      `parseLlmJson: failed to parse candidate "${preview(candidate)}" — ${
        (e as Error).message
      }`,
    );
  }
}

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

/** Remove leading/trailing ``` fences (with or without a language tag). */
export function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:[a-zA-Z0-9_+-]*)?\s*\n([\s\S]*?)\n?```\s*$/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }
  return trimmed;
}

/**
 * Walk from `start` (the position of the opening `{`) through the string,
 * respecting nested braces + string literals, returning the substring that
 * represents the balanced top-level object.
 */
function balanceObject(s: string, start: number): string {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return s.slice(start, i + 1);
      }
    }
  }
  // Unbalanced — return the tail and let JSON.parse throw a clearer error.
  return s.slice(start);
}

function balanceArray(s: string, start: number): string {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === "[") {
      depth++;
    } else if (ch === "]") {
      depth--;
      if (depth === 0) {
        return s.slice(start, i + 1);
      }
    }
  }
  return s.slice(start);
}

function preview(s: string): string {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > 120 ? one.slice(0, 120) + "…" : one;
}
