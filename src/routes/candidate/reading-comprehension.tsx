import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Lightbulb,
  Loader2,
  RotateCcw,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePagedHistoryState, type PracticeRollupRow } from "@/lib/paged-history";
import { AppNavHeader } from "@/components/tb/app-nav";
import { GateError, GateLoading, useQuoteSplash } from "@/components/load-state";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  me,
  readingDetail,
  readingList,
  readingSkip,
  readingSkipKeepalive,
  readingStart,
  readingSubmit,
  type AuthUser,
  type ReadingComprehensionSession,
  type ReadingVocabWord,
} from "@/lib/api";

const title = "TalentBro | Reading Comprehension";
const description =
  "Read an engaging story packed with advanced vocabulary, hover any highlighted word for its meaning, then answer five simple questions to earn XP.";

export const Route = createFileRoute("/candidate/reading-comprehension")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: ReadingComprehensionPage,
});

const COACH_NAME = "Albert";
const QUESTION_COUNT = 5;
const NEXT_DELAY_SECONDS = 4;

// Vocab tokens orbiting the open book in the decorative hero.
const FLOATING_WORDS = [
  "arduous",
  "candid",
  "pristine",
  "serene",
  "fervent",
  "ingenious",
  "ephemeral",
  "resolute",
];

type Phase = "reading" | "quiz" | "result";

type ResultState = {
  correct: number;
  points: number;
  stars: number;
};

function StarRow({ count, size = "size-4" }: { count: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={cn(
            size,
            "grid place-items-center leading-none",
            i < count ? "text-amber-500" : "text-muted-foreground/30",
          )}
        >
          ★
        </span>
      ))}
    </span>
  );
}

function deriveStats(sessions: PracticeRollupRow[]) {
  const solved = sessions.filter((s) => s.status === "solved");
  const gaveUp = sessions.filter((s) => s.status === "gave_up");
  const xp = sessions.reduce((acc, s) => acc + s.points_awarded, 0);
  const total = solved.length + gaveUp.length;
  const accuracy = total ? Math.round((solved.length / total) * 100) : 0;
  const avgStars = solved.length
    ? solved.reduce((acc, s) => acc + s.star_rating, 0) / solved.length
    : 0;
  const levelProgress = ((xp % 150) / 150) * 100; // 0–100
  return {
    solved: solved.length,
    gaveUp: gaveUp.length,
    total,
    xp,
    accuracy,
    avgStars,
    levelProgress,
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Render the passage with every vocab word highlighted. Each word carries its
// own tooltip, so hovering a word only reveals that word's meaning.
function PassageText({ passage, vocab }: { passage: string; vocab: ReadingVocabWord[] }) {
  return (
    <TooltipProvider delayDuration={0} skipDelayDuration={200}>
      {buildPassage(passage, vocab)}
    </TooltipProvider>
  );
}

function buildPassage(passage: string, vocab: ReadingVocabWord[]): React.ReactNode {
  if (vocab.length === 0) {
    return <p className="text-[15px] leading-[1.9]">{passage}</p>;
  }
  const sorted = [...vocab].sort((a, b) => b.word.length - a.word.length);
  const pattern = new RegExp(`\\b(${sorted.map((v) => escapeRegExp(v.word)).join("|")})\\b`, "gi");
  const meaningOf = new Map(sorted.map((v) => [v.word.toLowerCase(), v.meaning]));
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(passage)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(passage.slice(lastIndex, match.index));
    }
    const word = match[0];
    const meaning = meaningOf.get(word.toLowerCase());
    const highlighted = (
      <span
        tabIndex={0}
        className={cn(
          "relative inline-block cursor-help rounded px-0.5",
          "bg-amber-500/15 text-amber-700 underline decoration-amber-500/60 decoration-dotted underline-offset-4",
          "dark:text-amber-300",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60",
        )}
      >
        {word}
      </span>
    );
    nodes.push(
      meaning ? (
        <Tooltip key={key++}>
          <TooltipTrigger asChild>{highlighted}</TooltipTrigger>
          <TooltipContent
            side="top"
            sideOffset={6}
            className="max-w-[min(20rem,80vw)] border border-amber-500/30 bg-background px-2.5 py-1.5 text-[11px] font-medium text-foreground shadow-lg"
          >
            {meaning}
          </TooltipContent>
        </Tooltip>
      ) : (
        <span key={key++}>{highlighted}</span>
      ),
    );
    lastIndex = match.index + word.length;
  }
  if (lastIndex < passage.length) nodes.push(passage.slice(lastIndex));
  return <p className="text-[15px] leading-[1.9]">{nodes}</p>;
}

function ReadingComprehensionPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { splash, splashDone } = useQuoteSplash();

  const {
    sessions,
    rollup,
    isLoadingMore,
    refresh: refreshSessions,
    listEnd,
  } = usePagedHistoryState<ReadingComprehensionSession, PracticeRollupRow>({
    queryFn: readingList,
  });
  const [session, setSession] = useState<ReadingComprehensionSession | null>(null);
  const [phase, setPhase] = useState<Phase>("reading");
  const [answers, setAnswers] = useState<number[]>(Array(QUESTION_COUNT).fill(-1));
  const [result, setResult] = useState<ResultState | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [selectedDetail, setSelectedDetail] = useState<ReadingComprehensionSession | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const startingRef = useRef(false);
  const activeSessionRef = useRef<string | null>(null);
  activeSessionRef.current = session?.status === "active" ? session.id : null;

  const stats = deriveStats(rollup);

  // Leaving mid-passage (navigate away, close tab or refresh) marks the
  // unanswered round as skipped rather than leaving it in progress.
  useEffect(() => {
    const flush = () => {
      if (activeSessionRef.current) readingSkipKeepalive(activeSessionRef.current);
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
      if (activeSessionRef.current) {
        void readingSkip(activeSessionRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    me()
      .then(async (current) => {
        if (cancelled) return;
        if (!current) {
          void navigate({ to: "/candidate/auth", search: { mode: "login" }, replace: true });
          return;
        }
        if (current.profile_complete === false) {
          void navigate({ to: "/candidate/onboarding", replace: true });
          return;
        }
        setUser(current);
        await initialize();
        if (!cancelled) setStatus("ready");
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setErrorMessage(err instanceof Error ? err.message : null);
          setStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  async function initialize() {
    let list: ReadingComprehensionSession[] = [];
    try {
      list = await refreshSessions();
    } catch {
      list = [];
    }
    const active = list.find((s) => s.status === "active");
    if (active) {
      // A passage left unanswered on a previous visit is skipped, never resumed.
      try {
        await readingSkip(active.id);
      } catch {
        /* best-effort */
      }
      try {
        await refreshSessions();
      } catch {
        /* best-effort refresh */
      }
    }
    await startNew();
  }

  async function viewSession(id: string) {
    setDetailLoading(true);
    try {
      const detail = await readingDetail(id);
      setSelectedDetail(detail);
    } catch {
      /* no-op */
    } finally {
      setDetailLoading(false);
    }
  }

  async function startNew() {
    if (startingRef.current) return;
    startingRef.current = true;
    setPhase("reading");
    setResult(null);
    setCountdown(null);
    setError("");
    setAnswers(Array(QUESTION_COUNT).fill(-1));
    try {
      const res = await readingStart();
      setSession(res.session);
      try {
        await refreshSessions();
      } catch {
        /* best-effort refresh */
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not reach the server.";
      setError(msg);
    } finally {
      startingRef.current = false;
    }
  }

  function chooseAnswer(questionIndex: number, optionIndex: number) {
    if (phase !== "quiz") return;
    setAnswers((prev) => {
      const next = [...prev];
      next[questionIndex] = optionIndex;
      return next;
    });
  }

  async function submitAnswers() {
    if (!session || phase !== "quiz") return;
    if (answers.some((a) => a < 0)) return;
    setPhase("result");
    setError("");
    try {
      const res = await readingSubmit(session.id, answers);
      setSession(res.session);
      setResult({ correct: res.correct, points: res.points_awarded, stars: res.star_rating });
      setCountdown(NEXT_DELAY_SECONDS);
      try {
        await refreshSessions();
      } catch {
        /* best-effort refresh */
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not reach the server.";
      setError(msg);
      setPhase("quiz");
    }
  }

  function skipRound() {
    void startNew();
  }

  // Auto-start the next passage once a round is resolved.
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      void startNew();
      return;
    }
    const t = window.setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  if (status === "loading") {
    return (
      <GateLoading splash={splash} onSplashDone={splashDone} label="Opening your reading room…" />
    );
  }
  if (status === "error") {
    return (
      <GateError
        splash={splash}
        onSplashDone={splashDone}
        title="Reading Comprehension"
        message={errorMessage}
        backTo="/candidate/self-training"
        backLabel="Back to Self Training"
      />
    );
  }

  const answeredCount = answers.filter((a) => a >= 0).length;
  const allAnswered = answeredCount === QUESTION_COUNT;

  return (
    <div className="relative min-h-svh bg-background text-foreground">
      {/* Deco reading room: amber glow + floating vocabulary words */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-amber-500/15 blur-3xl" />
        <div className="absolute top-16 left-[12%] h-48 w-48 rounded-full bg-orange-500/10 blur-3xl" />
        <div className="absolute top-24 right-[10%] h-48 w-48 rounded-full bg-yellow-500/10 blur-3xl" />
        <svg
          className="absolute left-1/2 top-10 h-64 w-[40rem] -translate-x-1/2 text-border"
          viewBox="0 0 640 256"
          fill="none"
          stroke="currentColor"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <circle
              key={i}
              cx="320"
              cy="128"
              r={30 + i * 30}
              strokeWidth="1"
              strokeDasharray="4 6"
            />
          ))}
          {FLOATING_WORDS.map((word, i) => {
            const angle = (Math.PI * 2 * i) / FLOATING_WORDS.length;
            const x = 320 + 210 * Math.cos(angle);
            const y = 128 + 210 * Math.sin(angle);
            return (
              <text
                key={word}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-muted-foreground/25"
                fontSize="11"
                stroke="none"
              >
                {word}
              </text>
            );
          })}
          <circle cx="320" cy="128" r="7" className="fill-amber-500/40" stroke="none" />
        </svg>
      </div>

      <AppNavHeader
        current="self-training"
        sticky
        left={
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => void navigate({ to: "/candidate/self-training", replace: true })}
              className="grid size-8 cursor-pointer place-items-center rounded-md border border-border/60 bg-background/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Back to Self Training"
            >
              <ArrowLeft className="size-4" />
            </button>
            <span className="grid size-9 place-items-center rounded-lg bg-foreground text-background">
              <BookOpen className="size-4" />
            </span>
            <span>
              <p className="text-sm font-semibold leading-tight">Reading Comprehension</p>
            </span>
          </div>
        }
      />

      <main className="relative mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Reading Comprehension · one passage, five questions
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Read smart. Learn new words. Earn XP.
            </h1>
            <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
              Each round is a short story rich with advanced vocabulary. Hover any highlighted word
              to see its meaning, press “I have Read”, then answer five simple questions. Finish the
              round and a fresh passage begins automatically.
            </p>
          </div>
        </div>

        <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-1000"
            style={{ width: `${stats.levelProgress}%` }}
          />
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {[
            { label: "Passages read", value: `${stats.solved}`, icon: BookOpen },
            { label: "Accuracy", value: `${stats.accuracy}%`, icon: TrendingUp },
            { label: "Total XP", value: `${stats.xp}`, icon: TrendingUp },
            {
              label: "Avg stars",
              value: stats.avgStars ? `${stats.avgStars.toFixed(1)} / 5` : "—",
              icon: StarRowIcon,
            },
          ].map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="flex flex-1 items-center gap-2.5 rounded-xl border border-border bg-card/70 px-3.5 py-2.5 backdrop-blur min-w-[140px]"
            >
              {label === "Avg stars" ? (
                <StarRow count={Math.round(stats.avgStars)} size="size-3.5" />
              ) : (
                <Icon className="size-4 text-amber-500" />
              )}
              <div>
                <div className="font-mono text-[13px] font-semibold leading-none">{value}</div>
                <div className="mt-1 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  {label}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          {/* Passage / quiz card */}
          <section className="flex min-h-[520px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            {/* Round header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/40 px-4 py-3 sm:px-5">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-500/15">
                  <BookOpen className="size-4 text-amber-500" />
                </span>
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {phase === "reading"
                      ? "Read the passage"
                      : phase === "quiz"
                        ? "Quick quiz"
                        : "Round complete"}
                  </p>
                  <h2 className="truncate text-sm font-semibold">
                    {session?.title ?? "Opening a fresh passage…"}
                  </h2>
                </div>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-widest text-amber-500">
                {vocabCount(session)} words highlighted
              </span>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-5" style={{ maxHeight: "62vh" }}>
              {phase === "reading" && session && (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3">
                    <img
                      src="/Panelists/Albert.png"
                      alt={COACH_NAME}
                      className="mt-0.5 size-8 shrink-0 rounded-full object-cover"
                    />
                    <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                      Here’s your passage —{" "}
                      <span className="font-semibold text-foreground">“{session.title}”</span>.
                      Advanced vocabulary is highlighted; hover any highlighted word to see its
                      meaning. Take your time, then press <b>I have Read</b> for the questions.
                    </p>
                  </div>
                  <article className="rounded-xl border border-border bg-secondary/20 px-5 py-5">
                    <h3 className="mb-3 text-lg font-semibold leading-snug">{session.title}</h3>
                    <PassageText passage={session.passage} vocab={session.vocab} />
                  </article>
                </div>
              )}

              {phase === "quiz" && session && (
                <div className="space-y-5">
                  <p className="text-[12.5px] text-muted-foreground">
                    Answer all {QUESTION_COUNT} questions, then submit. ({answeredCount}/
                    {QUESTION_COUNT} answered)
                  </p>
                  {session.questions.map((q, qi) => (
                    <div key={qi} className="rounded-xl border border-border bg-secondary/20 p-4">
                      <div className="mb-2.5 flex items-start gap-2">
                        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-amber-500/20 font-mono text-[10px] font-bold text-amber-500">
                          {qi + 1}
                        </span>
                        <p className="text-[13.5px] font-medium leading-relaxed">{q.question}</p>
                      </div>
                      <div className="ml-7 grid gap-1.5">
                        {q.options.map((option, oi) => {
                          const selected = answers[qi] === oi;
                          return (
                            <button
                              key={oi}
                              type="button"
                              onClick={() => chooseAnswer(qi, oi)}
                              className={cn(
                                "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-[12.5px] transition-all",
                                selected
                                  ? "border-amber-500 bg-amber-500/15 text-foreground"
                                  : "border-border bg-card text-muted-foreground hover:border-amber-500/40 hover:text-foreground",
                              )}
                            >
                              <span
                                className={cn(
                                  "grid size-5 shrink-0 place-items-center rounded-full border font-mono text-[10px] font-bold",
                                  selected
                                    ? "border-amber-500 bg-amber-500 text-background"
                                    : "border-border text-muted-foreground",
                                )}
                              >
                                {String.fromCharCode(65 + oi)}
                              </span>
                              {option}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {phase === "result" && session && result && (
                <div className="space-y-4">
                  <div
                    className={cn(
                      "overflow-hidden rounded-xl border",
                      result.correct >= 3
                        ? "border-amber-500/40 bg-amber-500/10"
                        : "border-orange-500/40 bg-orange-500/10",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-4 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "grid size-11 place-items-center rounded-full",
                            result.correct >= 3
                              ? "bg-amber-500/20 text-amber-500"
                              : "bg-orange-500/20 text-orange-500",
                          )}
                        >
                          {result.correct >= 3 ? (
                            <CheckCircle2 className="size-6" />
                          ) : (
                            <XCircle className="size-6" />
                          )}
                        </span>
                        <div>
                          <div className="flex items-center gap-2 text-sm font-semibold">
                            {result.correct}/{result.total} correct
                            <StarRow count={result.stars} />
                          </div>
                          <div className="font-mono text-[11px] text-muted-foreground">
                            +{result.points} XP ·{" "}
                            {result.correct === result.total
                              ? "perfect read!"
                              : result.correct >= 3
                                ? "solid comprehension"
                                : "reread the highlights and try again"}
                          </div>
                        </div>
                      </div>
                      <div className="ml-auto flex items-center gap-3">
                        {countdown !== null && countdown > 0 && (
                          <span className="font-mono text-[12px] text-muted-foreground">
                            next in {countdown}s
                          </span>
                        )}
                        <Button size="sm" variant="secondary" onClick={() => void startNew()}>
                          Next passage
                          <ArrowRight className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {session.questions.map((q, qi) => {
                    const given = session.answers[qi] ?? -1;
                    const isCorrect = given === q.answer_index;
                    return (
                      <div
                        key={qi}
                        className={cn(
                          "rounded-xl border p-4",
                          isCorrect
                            ? "border-amber-500/30 bg-amber-500/5"
                            : "border-orange-500/30 bg-orange-500/5",
                        )}
                      >
                        <div className="mb-1.5 flex items-start gap-2">
                          {isCorrect ? (
                            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-amber-500" />
                          ) : (
                            <XCircle className="mt-0.5 size-4 shrink-0 text-orange-500" />
                          )}
                          <p className="text-[13px] font-medium leading-relaxed">{q.question}</p>
                        </div>
                        <div className="ml-6 space-y-1 text-[12.5px] text-muted-foreground">
                          <p>
                            Your answer:{" "}
                            <span
                              className={
                                isCorrect
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-orange-600 dark:text-orange-400"
                              }
                            >
                              {given >= 0 ? q.options[given] : "—"}
                            </span>
                          </p>
                          {!isCorrect && (
                            <p>
                              Correct:{" "}
                              <span className="font-semibold text-foreground">
                                {q.options[q.answer_index]}
                              </span>
                            </p>
                          )}
                          {q.explanation && <p className="italic">{q.explanation}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {(phase === "reading" || phase === "quiz") && !session && (
                <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  <span className="font-mono text-[11px] uppercase tracking-[0.2em]">
                    Fetching your passage…
                  </span>
                </div>
              )}
            </div>

            {/* Action bar */}
            <div className="border-t border-border bg-background/60 px-4 py-3 backdrop-blur sm:px-5">
              {error && (
                <p className="mb-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
                  {error}
                </p>
              )}
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={skipRound}
                  className="cursor-pointer text-[12px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  Skip this passage
                </button>
                {phase === "reading" && (
                  <Button
                    disabled={!session || !session.passage}
                    onClick={() => setPhase("quiz")}
                    className="bg-amber-500 text-background hover:bg-amber-600"
                  >
                    I have Read
                    <ArrowRight className="size-4" />
                  </Button>
                )}
                {phase === "quiz" && (
                  <Button
                    disabled={!allAnswered}
                    onClick={() => void submitAnswers()}
                    className="bg-amber-500 text-background hover:bg-amber-600"
                  >
                    Submit answers ({answeredCount}/{QUESTION_COUNT})
                    <ArrowRight className="size-4" />
                  </Button>
                )}
                {phase === "result" && (
                  <Button disabled variant="outline" className="opacity-60">
                    Round complete
                    <CheckCircle2 className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          </section>

          {/* Side: recent rounds + how it works */}
          <aside className="flex flex-col gap-4">
            <div className="rounded-2xl border border-border bg-card shadow-sm">
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <RotateCcw className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">Recent rounds</span>
              </div>
              <div className="max-h-[320px] divide-y divide-border overflow-y-auto">
                {sessions.length === 0 && (
                  <p className="px-4 py-6 text-[12px] text-muted-foreground">
                    No rounds yet — your finished passages will show up here.
                  </p>
                )}
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                    onClick={() => void viewSession(s.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        void viewSession(s.id);
                      }
                    }}
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-amber-500/15">
                      <BookOpen className="size-4 text-amber-500" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-[12.5px] font-medium leading-snug">
                        {s.title}
                      </div>
                      <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                        {s.vocab.length} words · {s.questions.length || QUESTION_COUNT} questions
                      </div>
                    </div>
                    {s.status === "solved" ? (
                      <span className="inline-flex shrink-0 flex-col items-end text-[11px] font-semibold text-amber-500">
                        <span>
                          {s.correct_count}/{QUESTION_COUNT}
                        </span>
                        <span className="font-mono text-[10px] font-normal">
                          +{s.points_awarded}
                        </span>
                      </span>
                    ) : s.status === "gave_up" ? (
                      <span className="shrink-0 font-mono text-[10px] text-orange-500">
                        skipped
                      </span>
                    ) : (
                      <span className="shrink-0 font-mono text-[10px] text-sky-500">
                        in progress
                      </span>
                    )}
                  </div>
                ))}
                <div ref={listEnd} aria-hidden className="flex justify-center py-3">
                  {isLoadingMore ? (
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <BookOpen className="size-4 text-amber-500" />
                How it works
              </div>
              <ol className="mt-3 space-y-2.5 text-[12.5px] text-muted-foreground">
                {[
                  "Read the story slowly — every highlighted word teaches you new vocabulary.",
                  "Hover a highlighted word to see its meaning without leaving the passage.",
                  "Press “I have Read”, then answer all five simple questions about the story.",
                  "Score 4–5 correct for big XP + stars. A fresh passage starts automatically.",
                ].map((step, i) => (
                  <li key={step} className="flex items-start gap-2">
                    <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-amber-500/20 font-mono text-[9px] text-amber-500">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        </div>
      </main>

      {/* Round detail */}
      <Dialog
        open={selectedDetail !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedDetail(null);
        }}
      >
        <DialogContent className="group max-h-[85vh] max-w-xl overflow-y-auto">
          {detailLoading && !selectedDetail ? (
            <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <span className="font-mono text-[11px] uppercase tracking-[0.2em]">
                Loading round…
              </span>
            </div>
          ) : (
            selectedDetail && (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-2">
                    <span className="grid size-8 place-items-center rounded-lg bg-amber-500/15">
                      <BookOpen className="size-4 text-amber-500" />
                    </span>
                    <DialogTitle className="text-base sm:text-lg">
                      {selectedDetail.title || "Reading Passage"}
                    </DialogTitle>
                  </div>
                  <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px]">
                    <span>{selectedDetail.vocab.length} vocabulary words</span>
                    <span>·</span>
                    <span>
                      {selectedDetail.status === "solved"
                        ? `${selectedDetail.correct_count}/${QUESTION_COUNT} correct · +${selectedDetail.points_awarded} XP`
                        : selectedDetail.status === "gave_up"
                          ? "Skipped"
                          : "In progress"}
                    </span>
                    {selectedDetail.status === "solved" && (
                      <>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <StarRow count={selectedDetail.star_rating} size="size-3" />
                        </span>
                      </>
                    )}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <article className="rounded-xl border border-border bg-secondary/20 px-4 py-4">
                    <PassageText passage={selectedDetail.passage} vocab={selectedDetail.vocab} />
                  </article>

                  {selectedDetail.questions.map((q, qi) => {
                    const given = selectedDetail.answers?.[qi] ?? -1;
                    const solved = selectedDetail.status === "solved";
                    const isCorrect = given === q.answer_index;
                    return (
                      <div
                        key={qi}
                        className={cn(
                          "rounded-xl border p-4",
                          solved
                            ? isCorrect
                              ? "border-amber-500/30 bg-amber-500/5"
                              : "border-orange-500/30 bg-orange-500/5"
                            : "border-border bg-secondary/20",
                        )}
                      >
                        <div className="mb-1.5 flex items-start gap-2">
                          {solved &&
                            (isCorrect ? (
                              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-amber-500" />
                            ) : (
                              <XCircle className="mt-0.5 size-4 shrink-0 text-orange-500" />
                            ))}
                          <p className="text-[13px] font-medium leading-relaxed">{q.question}</p>
                        </div>
                        <div className="ml-6 space-y-1 text-[12.5px] text-muted-foreground">
                          {solved && (
                            <p>
                              Your answer:{" "}
                              <span
                                className={
                                  isCorrect
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-orange-600 dark:text-orange-400"
                                }
                              >
                                {given >= 0 ? q.options[given] : "—"}
                              </span>
                            </p>
                          )}
                          {!isCorrect && (
                            <p>
                              Correct:{" "}
                              <span className="font-semibold text-foreground">
                                {q.options[q.answer_index]}
                              </span>
                            </p>
                          )}
                          {q.explanation && <p className="italic">{q.explanation}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StarRowIcon({ className }: { className?: string }) {
  return <span className={cn("text-amber-500", className)}>★</span>;
}

function vocabCount(session: ReadingComprehensionSession | null): number {
  return session?.vocab.length ?? 0;
}
