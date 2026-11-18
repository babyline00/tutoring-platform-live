/**
 * Shared domain types for the tutoring platform.
 *
 * These mirror the LLM JSON contracts (returned by suggest / problem /
 * evaluate / summary) and the persisted SessionEvent shape so the API routes,
 * the lib prompt builders, and the React UI all share one source of truth.
 */

export type Difficulty = "beginner" | "intermediate" | "advanced";

export type StudentLevel =
  | "elementary"
  | "middle-school"
  | "high-school"
  | "undergraduate"
  | "graduate"
  | "adult-learner";

export const DIFFICULTIES: Difficulty[] = [
  "beginner",
  "intermediate",
  "advanced",
];

export const STUDENT_LEVELS: StudentLevel[] = [
  "elementary",
  "middle-school",
  "high-school",
  "undergraduate",
  "graduate",
  "adult-learner",
];

export type SessionStatus = "active" | "completed";

// A Subject row from the DB. `topics` is the raw JSON string; helpers expose
// the parsed array.
export interface SubjectDTO {
  id: string;
  name: string;
  label: string;
  topics: string[];
}

// A Session row projected for the left-rail session list.
export interface SessionListItemDTO {
  id: string;
  subjectId: string;
  subjectName: string;
  subjectLabel: string;
  topic: string;
  difficulty: string;
  studentLevel: string;
  tutorName: string;
  studentName: string;
  status: string;
  summary: string | null;
  startedAt: string;
  completedAt: string | null;
  eventCount: number;
}

// A full session with all events, returned by GET /api/sessions/[id].
export interface SessionDetailDTO extends SessionListItemDTO {
  events: SessionEventDTO[];
}

// A SessionEvent row projected for the timeline + replay UI.
export interface SessionEventDTO {
  id: string;
  sessionId: string;
  ordinal: number;
  type: string;
  content: string;
  metadata: string | null;
  createdAt: string;
}

// A structured prompt returned by the builder functions. The AI layer's
// `complete({ systemPrompt, userPrompt })` consumes this shape directly.
export interface BuiltPrompt {
  systemPrompt: string;
  userPrompt: string;
}

// --- LLM JSON contracts -----------------------------------------------------

export interface SuggestionResult {
  outline: string[];
  misconception: string;
  analogy: string;
  practiceProblem: string;
}

export interface GeneratedProblem {
  question: string;
  hints: string[];
  workedSolution: string;
}

export type Correctness = "correct" | "partially-correct" | "incorrect";

export interface EvaluationResult {
  correctness: Correctness;
  feedback: string;
  followUpProblem?: string;
}

export interface SessionSummary {
  topicsCovered: string[];
  problemsAttempted: number;
  correctCount: number;
  incorrectCount: number;
  suggestedNextSteps: string[];
  narrative: string;
}

// --- Session event type taxonomy -------------------------------------------
//
// Drives the timeline badge, color, and replay step label.
export type SessionEventType =
  | "session-start"
  | "tutor-concept"
  | "ai-suggestion"
  | "ai-misconception"
  | "ai-analogy"
  | "practice-problem"
  | "student-answer"
  | "ai-feedback"
  | "ai-followup"
  | "session-summary";

export const SESSION_EVENT_TYPES: SessionEventType[] = [
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
