"use client";

/**
 * AI-Powered Tutoring Platform (Live) — single-route MVP.
 *
 * Layout:
 *   - Header: platform title + stats + "New session" button.
 *   - Left rail:  session list with subject filter + status + summary snippet.
 *   - Center:     3-panel workspace
 *                  • Tutor panel      — concept → AI suggestions
 *                  • Student workspace — generate problem / evaluate answer
 *                  • Timeline         — chronological events with badges + expand
 *   - Footer:     "End session & generate summary" + "Replay session".
 *
 * All API calls hit relative paths under /api/* on the same Next.js server.
 * The page is a single client component so state across the three panels +
 * the left rail stays in sync without a state library.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Plus, Sparkles, FileQuestion, CheckCircle2, XCircle, Play, ChevronRight, ChevronDown, Clock, ListChecks, RefreshCw, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import {
  DIFFICULTIES,
  STUDENT_LEVELS,
  type SessionDetailDTO,
  type SessionEventDTO,
  type SessionListItemDTO,
  type SessionSummary,
  type SubjectDTO,
  type SuggestionResult,
  type GeneratedProblem,
  type EvaluationResult,
} from "@/lib/types";
import { formatEventForTimeline, EVENT_TYPE_META } from "@/lib/event-types";
import type { ReplayStep } from "@/lib/replay";

// ---------------------------------------------------------------------------
// tiny fetch wrapper
// ---------------------------------------------------------------------------

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      // not JSON; fall through
    }
  }
  if (!res.ok) {
    const message =
      (json && typeof json === "object" && "error" in json
        ? String((json as { error: unknown }).error)
        : null) ?? `${res.status} ${res.statusText}`;
    throw new Error(message);
  }
  return json as T;
}

// ---------------------------------------------------------------------------
// page
// ---------------------------------------------------------------------------

export default function Page() {
  const [subjects, setSubjects] = useState<SubjectDTO[]>([]);
  const [sessions, setSessions] = useState<SessionListItemDTO[]>([]);
  const [stats, setStats] = useState<{ sessions: number; completed: number; events: number }>({ sessions: 0, completed: 0, events: 0 });
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<SessionDetailDTO | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [replayOpen, setReplayOpen] = useState(false);

  // --- data loaders --------------------------------------------------------

  const loadSubjects = useCallback(async () => {
    try {
      const data = await api<{ subjects: SubjectDTO[] }>("/api/subjects");
      setSubjects(data.subjects);
    } catch (e) {
      toast.error(`Failed to load subjects: ${(e as Error).message}`);
    }
  }, []);

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const qs = new URLSearchParams();
      if (subjectFilter !== "all") qs.set("subject", subjectFilter);
      const path = `/api/sessions${qs.toString() ? `?${qs.toString()}` : ""}`;
      const data = await api<{ sessions: SessionListItemDTO[] }>(path);
      setSessions(data.sessions);
    } catch (e) {
      toast.error(`Failed to load sessions: ${(e as Error).message}`);
    } finally {
      setLoadingSessions(false);
    }
  }, [subjectFilter]);

  const loadStats = useCallback(async () => {
    try {
      const data = await api<{ sessions: number; completed: number; events: number }>("/api/stats");
      setStats(data);
    } catch {
      // stats are best-effort
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    try {
      const data = await api<{ session: SessionDetailDTO }>(`/api/sessions/${id}`);
      setSelectedSession(data.session);
    } catch (e) {
      toast.error(`Failed to load session: ${(e as Error).message}`);
      setSelectedSession(null);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    void loadSubjects();
    void loadStats();
  }, [loadSubjects, loadStats]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setSelectedSession(null);
  }, [selectedId, loadDetail]);

  // --- session actions -----------------------------------------------------

  const refreshAfterMutation = useCallback(
    async (sessionId?: string) => {
      await Promise.all([loadSessions(), loadStats()]);
      if (sessionId) await loadDetail(sessionId);
    },
    [loadSessions, loadStats, loadDetail],
  );

  const handleCreated = useCallback(
    (sessionId: string) => {
      setSelectedId(sessionId);
      void refreshAfterMutation(sessionId);
    },
    [refreshAfterMutation],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("Delete this session and all its events?")) return;
      try {
        await api(`/api/sessions/${id}`, { method: "DELETE" });
        if (selectedId === id) setSelectedId(null);
        await refreshAfterMutation();
        toast.success("Session deleted");
      } catch (e) {
        toast.error(`Delete failed: ${(e as Error).message}`);
      }
    },
    [selectedId, refreshAfterMutation],
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-30">
        <div className="flex items-center justify-between gap-4 px-4 sm:px-6 h-14">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-8 rounded-md bg-primary text-primary-foreground grid place-items-center shrink-0">
              <Sparkles className="size-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold leading-tight truncate">
                AI-Powered Tutoring Platform
              </h1>
              <p className="text-xs text-muted-foreground leading-tight truncate">
                Live · {stats.sessions} sessions · {stats.completed} completed · {stats.events} events
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {selectedSession && (
              <>
                <Button variant="outline" size="sm" onClick={() => setReplayOpen(true)}>
                  <Play className="size-4" /> Replay
                </Button>
                <EndSessionButton
                  sessionId={selectedSession.id}
                  disabled={selectedSession.status === "completed"}
                  onDone={() => refreshAfterMutation(selectedSession.id)}
                />
              </>
            )}
            <NewSessionDialog
              open={newOpen}
              onOpenChange={setNewOpen}
              subjects={subjects}
              onCreated={handleCreated}
            />
          </div>
        </div>
      </header>

      {/* Main 3-pane workspace */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-0 min-h-0">
        {/* Left rail: session list */}
        <aside className="border-r bg-card flex flex-col min-h-0 max-h-[calc(100vh-3.5rem)]">
          <div className="p-3 border-b space-y-2">
            <Label className="text-xs text-muted-foreground">Filter by subject</Label>
            <Select value={subjectFilter} onValueChange={setSubjectFilter}>
              <SelectTrigger className="h-8 text-xs w-full">
                <SelectValue placeholder="All subjects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All subjects</SelectItem>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.name}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ScrollArea className="flex-1 scroll-area-thin">
            <div className="p-2 space-y-2">
              {loadingSessions ? (
                <div className="space-y-2 p-2">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : sessions.length === 0 ? (
                <p className="text-xs text-muted-foreground p-4 text-center">
                  No sessions yet. Click <span className="font-medium">New session</span> to start.
                </p>
              ) : (
                sessions.map((s) => (
                  <SessionListItem
                    key={s.id}
                    item={s}
                    active={s.id === selectedId}
                    onSelect={() => setSelectedId(s.id)}
                    onDelete={() => handleDelete(s.id)}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </aside>

        {/* Center: 3-panel workspace */}
        <section className="flex flex-col min-h-0 min-w-0 max-h-[calc(100vh-3.5rem)]">
          {!selectedId ? (
            <EmptyWorkspace />
          ) : loadingDetail || !selectedSession ? (
            <div className="flex-1 grid place-items-center p-6">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Workspace session={selectedSession} onMutated={() => refreshAfterMutation(selectedSession.id)} />
          )}
        </section>
      </main>

      {/* Replay dialog (only meaningful when a session is selected) */}
      {selectedSession && (
        <ReplayDialog
          open={replayOpen}
          onOpenChange={setReplayOpen}
          sessionId={selectedSession.id}
          sessionLabel={`${selectedSession.subjectLabel} · ${selectedSession.topic}`}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty workspace placeholder
// ---------------------------------------------------------------------------

function EmptyWorkspace() {
  return (
    <div className="flex-1 grid place-items-center p-6 text-center">
      <div className="max-w-sm space-y-3">
        <div className="mx-auto size-12 rounded-full bg-accent grid place-items-center">
          <Sparkles className="size-6 text-muted-foreground" />
        </div>
        <h2 className="text-base font-semibold">No session selected</h2>
        <p className="text-sm text-muted-foreground">
          Pick a session from the left, or click <span className="font-medium">New session</span> in the header to start a live AI-assisted tutoring session.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Session list item
// ---------------------------------------------------------------------------

function SessionListItem({
  item,
  active,
  onSelect,
  onDelete,
}: {
  item: SessionListItemDTO;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const completed = item.status === "completed";
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-md border p-3 transition-colors hover:bg-accent/60 ${
        active ? "border-primary bg-accent" : "border-transparent bg-card"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
          {item.subjectLabel}
        </Badge>
        <div className="flex items-center gap-1">
          {completed ? (
            <Badge variant="secondary" className="text-[10px]">completed</Badge>
          ) : (
            <Badge className="text-[10px]">active</Badge>
          )}
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                onDelete();
              }
            }}
            className="text-muted-foreground hover:text-destructive cursor-pointer p-1 rounded"
            aria-label="Delete session"
          >
            <Trash2 className="size-3.5" />
          </span>
        </div>
      </div>
      <p className="mt-2 text-sm font-medium line-clamp-1">{item.topic}</p>
      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
        {item.summary ? item.summary.replace(/\s+/g, " ").slice(0, 120) : `${item.tutorName} ↔ ${item.studentName} · ${item.difficulty} · ${item.studentLevel}`}
      </p>
      <p className="text-[10px] text-muted-foreground mt-1">
        {item.eventCount} events · {new Date(item.startedAt).toLocaleString()}
      </p>
    </button>
  );
}

// ---------------------------------------------------------------------------
// New session dialog
// ---------------------------------------------------------------------------

function NewSessionDialog({
  open,
  onOpenChange,
  subjects,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  subjects: SubjectDTO[];
  onCreated: (sessionId: string) => void;
}) {
  const [subjectId, setSubjectId] = useState<string>("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<string>("intermediate");
  const [studentLevel, setStudentLevel] = useState<string>("high-school");
  const [tutorName, setTutorName] = useState("Tutor");
  const [studentName, setStudentName] = useState("Student");
  const [submitting, setSubmitting] = useState(false);
  const [suggestedTopics, setSuggestedTopics] = useState<string[]>([]);

  // when subject changes, surface its curated topic suggestions
  useEffect(() => {
    const s = subjects.find((x) => x.id === subjectId);
    setSuggestedTopics(s?.topics ?? []);
  }, [subjectId, subjects]);

  // auto-pick first subject once the list loads
  useEffect(() => {
    if (!subjectId && subjects.length) setSubjectId(subjects[0].id);
  }, [subjects, subjectId]);

  const submit = async () => {
    if (!subjectId || !topic.trim()) {
      toast.error("Pick a subject and enter a topic");
      return;
    }
    setSubmitting(true);
    try {
      const data = await api<{ session: SessionDetailDTO }>(`/api/sessions`, {
        method: "POST",
        body: JSON.stringify({
          subjectId,
          topic: topic.trim(),
          difficulty,
          studentLevel,
          tutorName: tutorName.trim() || "Tutor",
          studentName: studentName.trim() || "Student",
        }),
      });
      toast.success("Session started");
      onCreated(data.session.id);
      onOpenChange(false);
      setTopic("");
    } catch (e) {
      toast.error(`Failed to start session: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> New session
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start a new tutoring session</DialogTitle>
          <DialogDescription>
            Pick a subject, enter a topic, and tune the difficulty + student level. The AI tutor panel will open once the session starts.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="ns-subject">Subject</Label>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger id="ns-subject">
                <SelectValue placeholder="Select subject" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ns-topic">Topic</Label>
            <Input
              id="ns-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Newton's second law"
            />
            {suggestedTopics.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {suggestedTopics.slice(0, 6).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTopic(t)}
                    className="text-[11px] px-2 py-0.5 rounded-full border bg-accent hover:bg-accent/70 text-accent-foreground"
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="ns-difficulty">Difficulty</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger id="ns-difficulty">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIFFICULTIES.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ns-level">Student level</Label>
              <Select value={studentLevel} onValueChange={setStudentLevel}>
                <SelectTrigger id="ns-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STUDENT_LEVELS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="ns-tutor">Tutor name</Label>
              <Input id="ns-tutor" value={tutorName} onChange={(e) => setTutorName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ns-student">Student name</Label>
              <Input id="ns-student" value={studentName} onChange={(e) => setStudentName(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Start session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// End session + summary button
// ---------------------------------------------------------------------------

function EndSessionButton({
  sessionId,
  disabled,
  onDone,
}: {
  sessionId: string;
  disabled: boolean;
  onDone: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const click = async () => {
    if (!confirm("End this session and generate an AI summary?")) return;
    setBusy(true);
    try {
      await api<{ summary: SessionSummary }>(`/api/sessions/${sessionId}/summary`, { method: "POST" });
      toast.success("Session ended. Summary generated.");
      await onDone();
    } catch (e) {
      toast.error(`Summary failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button size="sm" variant="secondary" onClick={click} disabled={disabled || busy}>
      {busy ? <Loader2 className="size-4 animate-spin" /> : <ListChecks className="size-4" />}
      End &amp; summarize
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Workspace — 3 panels (tutor / student / timeline)
// ---------------------------------------------------------------------------

function Workspace({ session, onMutated }: { session: SessionDetailDTO; onMutated: () => void }) {
  return (
    <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-3 gap-0">
      <TutorPanel session={session} onMutated={onMutated} />
      <StudentWorkspace session={session} onMutated={onMutated} />
      <TimelinePanel session={session} />
    </div>
  );
}

// --- Tutor panel ------------------------------------------------------------

function TutorPanel({ session, onMutated }: { session: SessionDetailDTO; onMutated: () => void }) {
  const [concept, setConcept] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastSuggestion, setLastSuggestion] = useState<SuggestionResult | null>(null);

  const submit = async () => {
    if (!concept.trim()) {
      toast.error("Enter a concept first");
      return;
    }
    setBusy(true);
    try {
      const data = await api<{ suggestion: SuggestionResult }>(`/api/sessions/${session.id}/suggest`, {
        method: "POST",
        body: JSON.stringify({ concept: concept.trim() }),
      });
      setLastSuggestion(data.suggestion);
      toast.success("AI suggestions ready");
      onMutated();
    } catch (e) {
      toast.error(`Suggest failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const completed = session.status === "completed";

  return (
    <div className="flex flex-col min-h-0 border-r xl:border-r border-b xl:border-b-0 bg-card">
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-md bg-primary text-primary-foreground grid place-items-center shrink-0">
            <Sparkles className="size-3.5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold leading-tight">Tutor panel</h2>
            <p className="text-[11px] text-muted-foreground leading-tight truncate">
              {session.subjectLabel} · {session.tutorName}
            </p>
          </div>
        </div>
      </div>
      <ScrollArea className="flex-1 scroll-area-thin">
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tp-concept">Concept to explain</Label>
            <Textarea
              id="tp-concept"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="e.g. Why does multiplication distribute over addition?"
              className="min-h-24"
              disabled={completed}
            />
            <Button onClick={submit} disabled={busy || completed} className="w-full">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Get AI suggestions
            </Button>
            {completed && (
              <p className="text-xs text-muted-foreground">Session is completed — suggestions disabled.</p>
            )}
          </div>

          {lastSuggestion && (
            <Card className="bg-background">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Latest AI suggestion</CardTitle>
                <CardDescription className="text-xs">4-part teaching plan for the concept above.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Outline</p>
                  <ol className="list-decimal list-inside mt-1 space-y-0.5">
                    {lastSuggestion.outline.map((o, i) => (
                      <li key={i}>{o}</li>
                    ))}
                  </ol>
                </div>
                <Separator />
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Common misconception</p>
                  <p className="mt-1">{lastSuggestion.misconception}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Analogy</p>
                  <p className="mt-1">{lastSuggestion.analogy}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Practice problem</p>
                  <p className="mt-1">{lastSuggestion.practiceProblem}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Show any prior tutor-concept + ai-suggestion events for context */}
          <PriorConcepts session={session} />
        </div>
      </ScrollArea>
    </div>
  );
}

function PriorConcepts({ session }: { session: SessionDetailDTO }) {
  const concepts = session.events.filter((e) => e.type === "tutor-concept");
  if (concepts.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase text-muted-foreground">Concepts raised this session</p>
      {concepts.map((c) => (
        <div key={c.id} className="rounded-md border bg-background p-2 text-xs">
          <span className="text-muted-foreground">#{c.ordinal}</span> {c.content}
        </div>
      ))}
    </div>
  );
}

// --- Student workspace -----------------------------------------------------

function StudentWorkspace({ session, onMutated }: { session: SessionDetailDTO; onMutated: () => void }) {
  const [answer, setAnswer] = useState("");
  const [busyProblem, setBusyProblem] = useState(false);
  const [busyEval, setBusyEval] = useState(false);
  const [problem, setProblem] = useState<GeneratedProblem | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);

  // surface the most recent practice-problem from the session if the
  // local state hasn't been populated (e.g. after a page reload).
  useEffect(() => {
    if (problem) return;
    const last = [...session.events]
      .reverse()
      .find((e) => e.type === "practice-problem");
    if (last) {
      let hints: string[] = [];
      let workedSolution = "";
      try {
        const meta = last.metadata ? JSON.parse(last.metadata) : null;
        if (meta) {
          if (Array.isArray(meta.hints)) hints = meta.hints;
          if (typeof meta.workedSolution === "string") workedSolution = meta.workedSolution;
        }
      } catch {
        // ignore
      }
      setProblem({ question: last.content, hints, workedSolution });
    }
  }, [session.events, problem]);

  const generate = async () => {
    setBusyProblem(true);
    try {
      const data = await api<{ problem: GeneratedProblem }>(
        `/api/sessions/${session.id}/generate-problem`,
        { method: "POST", body: JSON.stringify({}) },
      );
      setProblem(data.problem);
      setEvaluation(null);
      setAnswer("");
      toast.success("Practice problem generated");
      onMutated();
    } catch (e) {
      toast.error(`Generate failed: ${(e as Error).message}`);
    } finally {
      setBusyProblem(false);
    }
  };

  const evaluate = async () => {
    if (!answer.trim()) {
      toast.error("Type an answer first");
      return;
    }
    setBusyEval(true);
    try {
      const data = await api<{ evaluation: EvaluationResult }>(
        `/api/sessions/${session.id}/evaluate`,
        {
          method: "POST",
          body: JSON.stringify({
            studentAnswer: answer.trim(),
            problemQuestion: problem?.question,
            workedSolution: problem?.workedSolution,
          }),
        },
      );
      setEvaluation(data.evaluation);
      toast.success("Answer evaluated");
      onMutated();
    } catch (e) {
      toast.error(`Evaluate failed: ${(e as Error).message}`);
    } finally {
      setBusyEval(false);
    }
  };

  const completed = session.status === "completed";

  return (
    <div className="flex flex-col min-h-0 border-r xl:border-r-0 border-b xl:border-b-0 xl:border-l bg-card">
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-md bg-accent text-accent-foreground grid place-items-center shrink-0">
            <FileQuestion className="size-3.5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold leading-tight">Student workspace</h2>
            <p className="text-[11px] text-muted-foreground leading-tight truncate">
              {session.studentName} · {session.difficulty} · {session.studentLevel}
            </p>
          </div>
        </div>
      </div>
      <ScrollArea className="flex-1 scroll-area-thin">
        <div className="p-4 space-y-4">
          <Button onClick={generate} disabled={busyProblem || completed} variant="outline" className="w-full">
            {busyProblem ? <Loader2 className="size-4 animate-spin" /> : <FileQuestion className="size-4" />}
            Generate practice problem
          </Button>

          {problem && (
            <Card className="bg-background">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Practice problem</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="whitespace-pre-wrap">{problem.question}</p>
                {problem.hints.length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground">Show hints ({problem.hints.length})</summary>
                    <ol className="list-decimal list-inside mt-1 space-y-0.5">
                      {problem.hints.map((h, i) => (
                        <li key={i}>{h}</li>
                      ))}
                    </ol>
                  </details>
                )}
                {problem.workedSolution && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground">Show worked solution</summary>
                    <p className="mt-1 whitespace-pre-wrap">{problem.workedSolution}</p>
                  </details>
                )}
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            <Label htmlFor="sw-answer">Student answer</Label>
            <Textarea
              id="sw-answer"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type the answer + brief reasoning here…"
              className="min-h-24"
              disabled={completed}
            />
            <Button onClick={evaluate} disabled={busyEval || completed} className="w-full">
              {busyEval ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              Evaluate answer
            </Button>
          </div>

          {evaluation && (
            <Card className="bg-background">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">AI evaluation</CardTitle>
                  <CorrectnessBadge correctness={evaluation.correctness} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="whitespace-pre-wrap">{evaluation.feedback}</p>
                {evaluation.followUpProblem && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Follow-up problem</p>
                      <p className="mt-1 whitespace-pre-wrap">{evaluation.followUpProblem}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function CorrectnessBadge({ correctness }: { correctness: EvaluationResult["correctness"] }) {
  if (correctness === "correct") {
    return (
      <Badge className="bg-emerald-600 text-white">
        <CheckCircle2 className="size-3" /> correct
      </Badge>
    );
  }
  if (correctness === "partially-correct") {
    return (
      <Badge className="bg-amber-600 text-white">
        <Clock className="size-3" /> partial
      </Badge>
    );
  }
  return (
    <Badge variant="destructive">
      <XCircle className="size-3" /> incorrect
    </Badge>
  );
}

// --- Timeline panel --------------------------------------------------------

function TimelinePanel({ session }: { session: SessionDetailDTO }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const summaryEvent = useMemo(
    () => session.events.find((e) => e.type === "session-summary") ?? null,
    [session.events],
  );

  const views = useMemo(
    () => formatEventForTimelineList(session.events),
    [session.events],
  );

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col min-h-0 bg-card xl:border-l">
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-md bg-secondary text-secondary-foreground grid place-items-center shrink-0">
            <Clock className="size-3.5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold leading-tight">Session timeline</h2>
            <p className="text-[11px] text-muted-foreground leading-tight truncate">
              {session.events.length} events · chronological
            </p>
          </div>
        </div>
      </div>
      <ScrollArea className="flex-1 scroll-area-thin">
        <div className="p-3 space-y-2">
          {views.length === 0 ? (
            <p className="text-xs text-muted-foreground p-4 text-center">No events yet.</p>
          ) : (
            views.map((v) => {
              const isOpen = expanded.has(v.id);
              return (
                <div key={v.id} className="rounded-md border bg-background">
                  <button
                    type="button"
                    onClick={() => toggle(v.id)}
                    className="w-full text-left p-2.5 flex items-start gap-2 hover:bg-accent/50 transition-colors"
                  >
                    <span className="text-[10px] text-muted-foreground font-mono pt-0.5 shrink-0">
                      #{v.ordinal}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge className={v.badgeClass}>{v.typeLabel}</Badge>
                      </div>
                      <p className="text-xs mt-1 line-clamp-2">{v.contentPreview}</p>
                    </div>
                    {isOpen ? (
                      <ChevronDown className="size-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-3 -mt-1 text-xs space-y-2">
                      <Separator />
                      <div>
                        <p className="text-muted-foreground text-[10px] uppercase">Full content</p>
                        <p className="mt-1 whitespace-pre-wrap break-words">{v.content}</p>
                      </div>
                      {v.metadata && Object.keys(v.metadata).length > 0 && (
                        <div>
                          <p className="text-muted-foreground text-[10px] uppercase">Metadata</p>
                          <pre className="mt-1 text-[10px] bg-muted/50 rounded p-2 overflow-x-auto">
                            {JSON.stringify(v.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(v.createdAt).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {summaryEvent && (
            <Alert className="mt-2">
              <AlertTitle className="text-sm">Session summary</AlertTitle>
              <AlertDescription className="text-xs whitespace-pre-wrap">
                {summaryEvent.content}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function formatEventForTimelineList(events: SessionEventDTO[]) {
  return [...events].sort((a, b) => a.ordinal - b.ordinal).map(formatEventForTimeline);
}

// ---------------------------------------------------------------------------
// Replay dialog — steps through events one at a time
// ---------------------------------------------------------------------------

function ReplayDialog({
  open,
  onOpenChange,
  sessionId,
  sessionLabel,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sessionId: string;
  sessionLabel: string;
}) {
  const [steps, setSteps] = useState<ReplayStep[]>([]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load the replay sequence whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setSteps([]);
    setIdx(0);
    setPlaying(false);
    api<{ steps: ReplayStep[] }>(`/api/sessions/${sessionId}/replay`)
      .then((data) => {
        if (!cancelled) setSteps(data.steps ?? []);
      })
      .catch((e) => toast.error(`Replay load failed: ${(e as Error).message}`))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [open, sessionId]);

  // Auto-advance loop.
  useEffect(() => {
    if (!playing) return;
    if (idx >= steps.length - 1) {
      setPlaying(false);
      return;
    }
    timer.current = setTimeout(() => setIdx((i) => Math.min(i + 1, steps.length - 1)), 1400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [playing, idx, steps.length]);

  const step = steps[idx];
  const total = steps.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="size-4" /> Replay session
          </DialogTitle>
          <DialogDescription className="truncate">{sessionLabel}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {loading ? (
            <div className="grid place-items-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : total === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No events to replay.</p>
          ) : (
            <>
              {/* progress */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-mono shrink-0">
                  {idx + 1} / {total}
                </span>
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${((idx + 1) / total) * 100}%` }}
                  />
                </div>
              </div>

              {/* current step card */}
              {step && (
                <Card className="bg-background">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={step.view.badgeClass}>{step.view.typeLabel}</Badge>
                      <span className="text-xs text-muted-foreground">#{step.ordinal}</span>
                    </div>
                    <CardDescription className="text-xs">{step.transition}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap break-words">{step.view.content}</p>
                    {step.view.metadata && Object.keys(step.view.metadata).length > 0 && (
                      <pre className="mt-2 text-[10px] bg-muted/50 rounded p-2 overflow-x-auto">
                        {JSON.stringify(step.view.metadata, null, 2)}
                      </pre>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* controls */}
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIdx(0);
                    setPlaying(false);
                  }}
                  disabled={idx === 0 && !playing}
                >
                  <RotateCcw className="size-4" /> Restart
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIdx((i) => Math.max(0, i - 1))}
                    disabled={idx === 0}
                  >
                    <ChevronDown className="size-4 rotate-90" /> Prev
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (idx >= total - 1) {
                        setIdx(0);
                        setPlaying(true);
                      } else {
                        setPlaying((p) => !p);
                      }
                    }}
                  >
                    {playing ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Pause
                      </>
                    ) : idx >= total - 1 ? (
                      <>
                        <RefreshCw className="size-4" /> Replay
                      </>
                    ) : (
                      <>
                        <Play className="size-4" /> Play
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}
                    disabled={idx >= total - 1}
                  >
                    <ChevronRight className="size-4" /> Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
