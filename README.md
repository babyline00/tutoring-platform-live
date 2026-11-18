# AI-Powered Tutoring Platform (Live)

A live, AI-assisted tutoring platform built as a single-route Next.js 16 MVP. A tutor opens a session scoped to a subject + topic + difficulty + student level, and the AI assists at every step: drafting a teaching outline when the tutor types a concept, generating practice problems, evaluating student answers, recording every interaction to a replayable timeline, and producing a structured end-of-session summary.

> Rebuild of Project #109 from the 110-project portfolio plan. Text-based MVP — real-time whiteboard, voice, and multi-user collaboration are intentionally out of scope (see [Stretch goals](#stretch-goals--what-id-do-differently)).

---

## MVP scope

| Feature | Status |
| --- | --- |
| Session creation (subject + topic + difficulty + student level + names) | MVP |
| AI-assisted tutor panel (concept → 3-bullet outline + misconception + analogy + practice problem) | MVP |
| Practice problem generation (question + hints + worked solution) | MVP |
| Student workspace (answer → correctness + feedback + optional follow-up) | MVP |
| Session timeline (every interaction persisted as a `SessionEvent`, rendered chronologically with type badges) | MVP |
| Session recording + replay (step through events one at a time, with transitions) | MVP |
| Session summary (topics covered, problems attempted, correct/incorrect ratio, suggested next steps) | MVP |
| Real-time shared whiteboard (tldraw) | stretch |
| Voice (WebRTC) | stretch |
| Multi-student classrooms (Liveblocks / Yjs) | stretch |
| Adaptive curriculum that re-plans based on correctness trends | stretch |

---

## Features

- **3-panel live workspace.** Tutor panel (concept → AI suggestions) on the left, student workspace (problem generation + answer evaluation) in the middle, session timeline on the right. Every AI call is persisted as discrete `SessionEvent` rows so the timeline + replay are always a faithful recording of the session.
- **AI-assisted tutor panel.** The tutor types a concept they're about to explain. A single LLM call returns a 4-part teaching plan: a 3-bullet outline, a common misconception to address proactively, a real-world analogy, and a practice problem. Each part is persisted as its own timeline event so the tutor can scan the arc of the lesson.
- **Practice problem generation.** "Generate practice problem" calls the LLM with the session's topic + difficulty + student level and returns `{ question, hints[], workedSolution }`. The worked solution is stored in the event metadata and reused as ground truth by the answer evaluator — no re-prompting needed.
- **Answer evaluation.** The student types an answer. The evaluator sends `{ studentAnswer, problemQuestion, workedSolution }` to the LLM and returns `{ correctness, feedback, followUpProblem? }`. A follow-up problem is only generated when the answer is wrong or partially correct, targeting the specific gap.
- **Session timeline.** Every event (`session-start`, `tutor-concept`, `ai-suggestion`, `ai-misconception`, `ai-analogy`, `practice-problem`, `student-answer`, `ai-feedback`, `ai-followup`, `session-summary`) is rendered with a typed badge and a content preview. Click any event to expand the full content + metadata JSON.
- **Session replay.** A dedicated dialog loads the full ordered event sequence and steps through them one at a time, with a transition caption ("AI drafts a 3-point teaching outline for the concept.") above each step. Play / pause / prev / next / restart controls, plus a progress bar.
- **Session summary.** "End & summarize" calls the LLM with the full event log and returns `{ topicsCovered, problemsAttempted, correctCount, incorrectCount, suggestedNextSteps, narrative }`. The session is marked completed, `completedAt` is stamped, and the summary is stored on both the `Session.summary` field and a `session-summary` event.
- **Offline-safe.** When the z-ai-web-dev-sdk has no config, a deterministic `MockProvider` returns parseable JSON so the UI and the test suite stay demoable. Tests force the mock via `PKC_DISABLE_LLM=1`.

---

## Tech stack

- **Next.js 16** (App Router) — single user-visible route (`/`).
- **TypeScript 5** throughout.
- **Tailwind CSS 4** + **shadcn/ui** (New York style, copied from the parent sandbox).
- **Prisma 6** + **SQLite** — fully isolated DB file inside this project's `db/` directory.
- **z-ai-web-dev-sdk** — server-only, used for both non-streaming JSON completions (suggest / problem / evaluate / summary) and the optional streaming tutor chat.
- **bun test** — the test runner (no Jest / Vitest).
- **eslint-config-next** — code style.

---

## Architecture (ASCII)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            /  (single route)                            │
│                                                                         │
│  ┌──────────────┐  ┌───────────────────────┐  ┌──────────────────────┐  │
│  │  Session     │  │     3-panel workspace │  │   Replay dialog      │  │
│  │  list +      │  │                       │  │   (steps through     │  │
│  │  subject     │  │  ┌────────┐ ┌───────┐ │  │   events one at a    │  │
│  │  filter      │  │  │ Tutor  │ │Student│ │  │   time, transitions  │  │
│  │  (left rail) │  │  │ panel  │ │ work- │ │  │   + progress bar)    │  │
│  │              │  │  │        │ │space  │ │  └──────────────────────┘  │
│  │              │  │  └────┬───┘ └──┬───┘ │                            │
│  │              │  │       │        │     │  ┌──────────────────────┐  │
│  │              │  │       └────────┴──── │  │   Timeline panel     │  │
│  │              │  │          (timeline)  │  │   (right of workspace)│  │
│  └──────────────┘  └───────────────────────┘  └──────────────────────┘  │
└─────────┬───────────────────┬───────────────────────┬───────────────────┘
          │                   │                       │
          ▼                   ▼                       ▼
┌─────────────────┐ ┌─────────────────────┐ ┌──────────────────────────┐
│ /api/sessions   │ │ /api/sessions/[id]/ │ │ /api/sessions/[id]/      │
│  GET, POST      │ │  suggest            │ │  replay (GET)            │
└────────┬────────┘ │  generate-problem   │ └──────────────────────────┘
         │          │  evaluate           │
         │          │  summary            │
         │          │  route.ts (GET/     │
         │          │   PATCH/DELETE)     │
         │          └──────────┬──────────┘
         │                     │
         ▼                     ▼
┌──────────────────────────────────────────────────────────┐
│                    src/lib/                              │
│  ai.ts (TutorProvider: Zai / Mock)                      │
│  parser.ts (parseLlmJson — fence / prose tolerant)      │
│  suggest-builder / problem-generator /                  │
│  evaluate-builder / summary-builder (pure prompt fns)   │
│  event-types.ts (timeline badge + preview)              │
│  replay.ts (transition + step formatter)                │
│  session-helpers.ts (nextOrdinal, appendEvent, DTOs)    │
│  seed-helpers.ts (6 subjects + validation)              │
└──────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│  Prisma 6  →  SQLite (db/custom.db, project-isolated)    │
│  Subject / Session / SessionEvent                        │
└──────────────────────────────────────────────────────────┘
```

---

## Setup

```bash
# 1. Install deps (the sandbox already has these — only needed for a fresh clone).
bun install

# 2. Configure the DB URL. The repo ships an .env that pins DATABASE_URL to an
#    absolute path inside this project's db/ directory so the SQLite file is
#    fully isolated from the parent sandbox.
cat .env

# 3. Push the schema + seed the 6 subjects.
bun run db:push
bun run seed

# 4. Run the dev server (the sandbox runs this for you — do not run it manually).
# bun run dev   # → http://localhost:3000

# 5. Run the test suite.
bun test
```

The `db:push` / `db:generate` / `seed` scripts inline `DATABASE_URL="$(pwd)/db/custom.db"` so they work even if you forget to source `.env`.

---

## Tests

`bun test` runs the full suite from the project root. Aim: 45+ tests; current count is over 100 across 9 files.

| File | What it covers |
| --- | --- |
| `parser.test.ts` | `parseLlmJson` — plain / fenced / leading-prose / trailing-prose / nested / array / escaped-quote / error paths + `stripCodeFence` |
| `suggest-builder.test.ts` | `buildSuggestPrompt` returns concept + 4-field JSON schema |
| `problem-generator.test.ts` | `buildProblemPrompt` returns topic + question/hints/workedSolution schema |
| `evaluate-builder.test.ts` | `buildEvaluatePrompt` returns student answer + correctness enum + feedback + followUp |
| `summary-builder.test.ts` | `buildSummaryPrompt` includes the ordered event log as context |
| `event-types.test.ts` | `formatEventForTimeline` returns type label + badge class + content preview; no indigo/blue; metadata parsing |
| `subject.test.ts` | All 6 seeded subjects have name + label + topics array; validation helpers; serialize/parse roundtrip |
| `replay.test.ts` | `formatReplayStep` + `buildReplaySequence` + transitions + progress caption |
| `ai.test.ts` | `MockProvider` streams / completes deterministic JSON; `completeJson` parses fenced + prose responses; provider caching |

---

## Environment variables

| Var | Required | Default | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | `file:/home/z/my-project/apps/109-tutoring-platform-live/db/custom.db` | Absolute path to the SQLite file. Pinned in `.env`. |
| `PKC_DISABLE_LLM` | no | unset | Set to `1` to force the `MockProvider` (used by the test suite). |
| `ZAI_API_KEY` / `ZAI_BASE_URL` / `ZAI_CHAT_ID` / `ZAI_USER_ID` | no | unset | Optional z-ai-web-dev-sdk overrides. The SDK also reads `.z-ai-config` if present. |

---

## Project structure

```
109-tutoring-platform-live/
├─ prisma/schema.prisma            # Subject / Session / SessionEvent
├─ scripts/seed-subjects.ts        # 6 hardcoded subjects upsert
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx                # Root layout + sonner Toaster
│  │  ├─ page.tsx                   # Single client route — 3-panel workspace
│  │  ├─ globals.css                # Tailwind 4 + shadcn tokens + scrollbar
│  │  └─ api/
│  │     ├─ subjects/route.ts       # GET list subjects (auto-seeds if empty)
│  │     ├─ stats/route.ts          # GET { sessions, completed, events }
│  │     └─ sessions/
│  │        ├─ route.ts             # GET list / POST create
│  │        └─ [id]/
│  │           ├─ route.ts          # GET / PATCH / DELETE
│  │           ├─ suggest/route.ts
│  │           ├─ generate-problem/route.ts
│  │           ├─ evaluate/route.ts
│  │           ├─ summary/route.ts
│  │           └─ replay/route.ts
│  ├─ components/ui/               # shadcn/ui (New York, copied from parent)
│  └─ lib/
│     ├─ ai.ts                      # TutorProvider (Zai + Mock) + completeJson
│     ├─ db.ts                      # Prisma singleton
│     ├─ types.ts                   # Shared DTOs + LLM JSON contracts
│     ├─ parser.ts                  # parseLlmJson (fence / prose tolerant)
│     ├─ suggest-builder.ts         # buildSuggestPrompt
│     ├─ problem-generator.ts      # buildProblemPrompt
│     ├─ evaluate-builder.ts       # buildEvaluatePrompt
│     ├─ summary-builder.ts        # buildSummaryPrompt
│     ├─ event-types.ts            # formatEventForTimeline + badge meta
│     ├─ replay.ts                 # formatReplayStep + transitions
│     ├─ seed-helpers.ts           # 6 subjects + validation + topic ser/de
│     ├─ session-helpers.ts        # nextOrdinal / appendEvent / DTOs
│     └─ __tests__/                # 9 test files
├─ .env / .env.example
├─ package.json / tsconfig.json / next.config.ts / postcss.config.mjs / tailwind.config.ts / components.json / eslint.config.mjs
├─ LICENSE (MIT)
└─ README.md
```

---

## Case study — the parts worth reading

### AI-assisted tutor panel + practice problem generation

The interesting design decision is that **one LLM call produces four timeline events**. When the tutor types a concept, the suggest endpoint asks the model for `{ outline, misconception, analogy, practiceProblem }` in a single JSON object, then persists each field as its own `SessionEvent` row (`ai-suggestion`, `ai-misconception`, `ai-analogy`, `practice-problem`). This keeps the timeline a true record of discrete pedagogical moves rather than a single blob, and lets the replay player caption each step individually ("AI drafts a 3-point teaching outline for the concept" → "AI flags a misconception to address" → "AI offers a real-world analogy" → "A practice problem is generated for the concept").

The practice problem generator stores `workedSolution` in the event's `metadata` JSON column. The evaluate endpoint then reads it back out as ground truth — without re-prompting the model — so a student's answer is always judged against the exact solution the tutor assigned, not a freshly hallucinated one.

### Session replay

Replay is a pure client-side player over a server-computed `ReplayStep[]`. The server's `buildReplaySequence` walks the ordered events and synthesises a transition caption for each `(prevType, type)` pair from a small lookup table, falling back to a generic "prevLabel → newLabel" caption for pairs the table doesn't cover. This means the replay UI shows a one-line "what just happened" summary above each event's full content, and the client doesn't have to recompute anything — it just steps through an array.

### Stretch goals — what I'd do differently

- **Real-time whiteboard (tldraw).** The text-based MVP lets a tutor describe a concept and generate problems, but a math / physics session really wants a shared canvas. tldraw's `@tldraw/tldraw` + the multiplayer sync layer would let both tutor and student annotate; each stroke would become a `SessionEvent` with `type: "whiteboard-stroke"` and a serialised point array in `metadata`, so the timeline + replay still work unchanged.
- **Voice (WebRTC).** A live tutoring session is fundamentally a conversation. WebRTC peer-to-peer audio (with a SFU for >2 participants) plus the optional streaming `TutorProvider.stream()` I already wired up would let the AI tutor panel react in real time as the tutor speaks. Whisper-class ASR could transcribe the session and feed the summary builder.
- **Multi-student classrooms (Liveblocks / Yjs).** The schema already has a `SessionEvent` append log, which is the right shape for a CRDT — migrating to Yjs + a Liveblocks-style presence layer would let multiple students collaborate on the same problem set in real time, with each student's answer preserved as its own event.
- **Adaptive curriculum.** The summary builder already computes `correctCount` / `incorrectCount` per session. A next iteration would feed those counts (plus per-topic correctness) into the problem generator's prompt, so the next practice problem is calibrated to the student's demonstrated weak spots rather than a flat difficulty.

### Resume bullet

> Built a live AI-assisted tutoring platform on Next.js 16 + Prisma + SQLite where a single LLM call produces a 4-part teaching plan (outline + misconception + analogy + practice problem) persisted as discrete timeline events; added practice-problem generation with worked-solution-as-ground-truth answer evaluation, a server-computed step-by-step replay player with synthesised transitions, and an end-of-session LLM summary (topics / correctness ratio / next steps) — 100+ unit tests covering the prompt builders, the fence-tolerant LLM JSON parser, and the offline mock provider.

---

## License

MIT — see [LICENSE](./LICENSE).

---

## Push to GitHub

```bash
gh repo create tutoring-platform-live --public --source=. --remote=origin --push
```
