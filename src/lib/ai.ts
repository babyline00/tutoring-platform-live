/**
 * AI layer for the tutoring platform.
 *
 * The `TutorProvider` interface exposes two methods:
 *
 *   - `complete({ systemPrompt, userPrompt })` — non-streaming single-turn
 *     completion. Used by the suggest / generate-problem / evaluate / summary
 *     endpoints where the LLM is asked to return a strict JSON object.
 *
 *   - `stream({ systemPrompt, messages })` — async generator of text deltas
 *     for the optional live tutor chat panel. Mirrors the ChatProvider shape
 *     from the parent sandbox so streaming code can be reused verbatim.
 *
 * `ZaiProvider` implements both using the z-ai-web-dev-sdk. `MockProvider`
 * emits deterministic JSON / text so the platform (and the test suite) stays
 * demoable offline when the SDK config is unavailable.
 *
 * The contract is intentionally minimal and pluggable so a future Vercel AI
 * SDK or OpenAI direct integration can be dropped in without touching the
 * route handlers or the prompt builders.
 */

import { parseLlmJson } from "@/lib/parser";

export interface CompleteArgs {
  systemPrompt: string;
  userPrompt: string;
}

export interface TutorProvider {
  /** Single-turn completion. Returns the raw assistant text. */
  complete(args: CompleteArgs): Promise<string>;

  /** Multi-turn streaming completion. Yields text deltas. */
  stream(args: {
    systemPrompt: string;
    messages: { role: "user" | "assistant" | "system"; content: string }[];
  }): AsyncGenerator<string, void, unknown>;
}

let cachedProvider: TutorProvider | null = null;

// --- ZaiProvider -----------------------------------------------------------

class ZaiProvider implements TutorProvider {
  async complete(args: CompleteArgs): Promise<string> {
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "system", content: args.systemPrompt },
        { role: "user", content: args.userPrompt },
      ],
      thinking: { type: "disabled" },
      stream: false,
    });
    const content = (completion as any)?.choices?.[0]?.message?.content;
    if (typeof content === "string") return content;
    // Some SDK versions return the string directly.
    if (typeof completion === "string") return completion;
    throw new Error("zai.complete: unexpected completion shape");
  }

  async *stream(args: {
    systemPrompt: string;
    messages: { role: "user" | "assistant" | "system"; content: string }[];
  }): AsyncGenerator<string, void, unknown> {
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    const zai = await ZAI.create();
    const messages = [
      { role: "system" as const, content: args.systemPrompt },
      ...args.messages,
    ];
    const completion = await zai.chat.completions.create({
      messages,
      stream: true,
      thinking: { type: "disabled" },
    });

    if (typeof completion === "string") {
      yield completion;
      return;
    }
    let body: ReadableStream<Uint8Array> | undefined;
    if (completion && typeof (completion as any).getReader === "function") {
      body = completion as ReadableStream<Uint8Array>;
    } else {
      body = (completion as any)?.body ?? (completion as any)?._body;
    }
    if (!body) {
      const content = (completion as any)?.choices?.[0]?.message?.content;
      if (typeof content === "string" && content.length > 0) yield content;
      return;
    }
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") return;
        try {
          const obj = JSON.parse(payload);
          const delta = obj?.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta.length > 0) {
            yield delta;
          }
        } catch {
          // ignore partial JSON
        }
      }
    }
  }
}

// --- MockProvider -----------------------------------------------------------

/**
 * Deterministic offline provider. The mock `complete()` returns a JSON
 * string derived from the user prompt so tests can assert on parsed shape
 * without hitting a real LLM. Recognises a `__mockJson` hint in the system
 * prompt to emit fully custom payloads.
 */
class MockProvider implements TutorProvider {
  async complete(args: CompleteArgs): Promise<string> {
    // Allow tests / callers to override the mock payload by embedding
    // `__mockJson:<base64>` in the system prompt. This keeps the mock
    // flexible without coupling it to a specific prompt shape.
    const marker = "__mockJson:";
    const idx = args.systemPrompt.indexOf(marker);
    if (idx !== -1) {
      const tail = args.systemPrompt.slice(idx + marker.length);
      const end = tail.indexOf("__endMock__");
      const payload = end === -1 ? tail : tail.slice(0, end);
      try {
        const decoded = Buffer.from(payload, "base64").toString("utf-8");
        return decoded;
      } catch {
        // fall through to default
      }
    }
    // Default: echo a minimal valid JSON that callers can parse.
    return JSON.stringify({ mock: true, echo: args.userPrompt.slice(0, 80) });
  }

  async *stream(args: {
    systemPrompt: string;
    messages: { role: "user" | "assistant" | "system"; content: string }[];
  }): AsyncGenerator<string, void, unknown> {
    const lastUser = [...args.messages].reverse().find((m) => m.role === "user");
    const text = lastUser?.content ?? "";
    yield `[mock tutor] echo: ${text.slice(0, 160)}`;
  }
}

export function getTutorProvider(): TutorProvider {
  if (cachedProvider) return cachedProvider;
  if (process.env.PKC_DISABLE_LLM === "1") {
    cachedProvider = new MockProvider();
    return cachedProvider;
  }
  try {
    cachedProvider = new ZaiProvider();
  } catch (e) {
    console.warn(
      "[tutor-ai] ZaiProvider unavailable, using MockProvider:",
      (e as Error).message,
    );
    cachedProvider = new MockProvider();
  }
  return cachedProvider;
}

/** Test-only. */
export function __setTutorProviderForTest(p: TutorProvider | null) {
  cachedProvider = p;
}

/**
 * Convenience: call `complete()` then parse the result as JSON. Used by all
 * four JSON-returning endpoints (suggest / problem / evaluate / summary) so
 * the route handlers can stay tiny.
 */
export async function completeJson<T = unknown>(
  args: CompleteArgs,
): Promise<T> {
  const raw = await getTutorProvider().complete(args);
  return parseLlmJson<T>(raw);
}
