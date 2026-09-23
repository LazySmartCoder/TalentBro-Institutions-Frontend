import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  Calculator,
  CheckCircle2,
  Lightbulb,
  Loader2,
  MessagesSquare,
  Minus,
  Puzzle,
  RotateCcw,
  Send,
  Shapes,
  Sparkles,
  Star,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AppNavHeader } from "@/components/tb/app-nav";
import { GateError, GateLoading, useQuoteSplash } from "@/components/load-state";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  aplrChat,
  aplrDetail,
  aplrList,
  aplrSkip,
  aplrSkipKeepalive,
  aplrStart,
  me,
  type APLRCategory,
  type APLRTrainingSession,
  type AuthUser,
} from "@/lib/api";

const title = "TalentBro | Aptitude & Logical Reasoning";
const description =
  "Solve aptitude and logical reasoning questions one chat at a time with your AI coach, Ada. Give the answer AND the approach you used — earn XP, stars and streaks.";

export const Route = createFileRoute("/aplr-training")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: AplrPage,
});

const COACH_NAME = "Ada";

const CATEGORY_META: {
  slug: APLRCategory | "";
  label: string;
  icon: typeof Calculator;
  chip: string;
}[] = [
  { slug: "", label: "Surprise me", icon: Sparkles, chip: "bg-violet-500/15 text-violet-500" },
  {
    slug: "quantitative",
    label: "Quantitative Aptitude",
    icon: Calculator,
    chip: "bg-sky-500/15 text-sky-500",
  },
  {
    slug: "logical_reasoning",
    label: "Logical Reasoning",
    icon: BrainCircuit,
    chip: "bg-emerald-500/15 text-emerald-500",
  },
  {
    slug: "verbal",
    label: "Verbal Reasoning",
    icon: MessagesSquare,
    chip: "bg-amber-500/15 text-amber-500",
  },
  {
    slug: "data_interpretation",
    label: "Data Interpretation",
    icon: BarChart3,
    chip: "bg-rose-500/15 text-rose-500",
  },
  { slug: "puzzle", label: "Puzzles", icon: Puzzle, chip: "bg-cyan-500/15 text-cyan-500" },
  {
    slug: "miscellaneous",
    label: "Miscellaneous",
    icon: Shapes,
    chip: "bg-fuchsia-500/15 text-fuchsia-500",
  },
];

const NEXT_DELAY_SECONDS = 4;

type ChatMsg = {
  id: string;
  role: "user" | "ada";
  text: string;
};

type FlowState = "idle" | "thinking" | "starting";

type ResultBanner = {
  solved: boolean;
  gave_up: boolean;
  points: number;
  stars: number;
  solution: string;
} | null;

function deriveStats(sessions: APLRTrainingSession[]) {
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

type CategoryInsight = {
  slug: APLRCategory | "";
  label: string;
  chip: string;
  icon: typeof Calculator;
  attempted: number;
  solved: number;
  skipped: number;
  accuracy: number;
  improvement: number | null;
};

function accOf(list: APLRTrainingSession[]): number {
  if (list.length === 0) return 0;
  return Math.round((list.filter((s) => s.status === "solved").length / list.length) * 100);
}

function deriveCategoryInsights(sessions: APLRTrainingSession[]): CategoryInsight[] {
  const resolved = sessions.filter((s) => s.status !== "active");
  return CATEGORY_META.filter(
    (c) => c.slug !== "" && resolved.some((s) => s.category === c.slug),
  ).map(({ slug, label, chip, icon }) => {
    const list = resolved
      .filter((s) => s.category === slug)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    const attempted = list.length;
    const solved = list.filter((s) => s.status === "solved").length;
    let improvement: number | null = null;
    if (attempted >= 4) {
      const half = Math.floor(attempted / 2);
      const first = list.slice(0, half);
      const second = list.slice(half);
      improvement = accOf(second) - accOf(first);
    }
    return {
      slug,
      label,
      chip,
      icon,
      attempted,
      solved,
      skipped: attempted - solved,
      accuracy: accOf(list),
      improvement,
    };
  });
}

function StarRow({ count, size = "size-4" }: { count: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            size,
            i < count ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30",
          )}
        />
      ))}
    </span>
  );
}

function AplrPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { splash, splashDone } = useQuoteSplash();

  const [sessions, setSessions] = useState<APLRTrainingSession[]>([]);
  const [session, setSession] = useState<APLRTrainingSession | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [flow, setFlow] = useState<FlowState>("idle");
  const [result, setResult] = useState<ResultBanner>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [category, setCategory] = useState<APLRCategory | "">("");
  const [selectedDetail, setSelectedDetail] = useState<APLRTrainingSession | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const startingRef = useRef(false);
  const categoryRef = useRef<APLRCategory | "">("");
  categoryRef.current = category;
  const activeSessionRef = useRef<string | null>(null);
  activeSessionRef.current = session?.status === "active" ? session.id : null;

  const stats = deriveStats(sessions);
  const insights = deriveCategoryInsights(sessions);
  const overallImprovement = (() => {
    const resolved = sessions
      .filter((s) => s.status !== "active")
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (resolved.length < 4) return null;
    const half = Math.floor(resolved.length / 2);
    return accOf(resolved.slice(half)) - accOf(resolved.slice(0, half));
  })();

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, flow, result]);

  // Leaving mid-question (navigate away, close tab or refresh) marks the
  // unanswered question as skipped rather than leaving it in progress.
  useEffect(() => {
    const flush = () => {
      if (activeSessionRef.current) aplrSkipKeepalive(activeSessionRef.current);
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
      if (activeSessionRef.current) {
        void aplrSkip(activeSessionRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    me()
      .then(async (current) => {
        if (cancelled) return;
        if (!current) {
          void navigate({ to: "/candidate-auth", search: { mode: "login" }, replace: true });
          return;
        }
        if (current.profile_complete === false) {
          void navigate({ to: "/onboarding", replace: true });
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
    let list: APLRTrainingSession[] = [];
    try {
      list = await aplrList();
    } catch {
      list = [];
    }
    setSessions(list);
    const active = list.find((s) => s.status === "active");
    if (active) {
      // A question left unanswered on a previous visit is skipped, never resumed.
      try {
        await aplrSkip(active.id);
      } catch {
        /* best-effort */
      }
      try {
        setSessions(await aplrList());
      } catch {
        /* best-effort refresh */
      }
    }
    await startNew();
  }

  function chooseCategory(slug: APLRCategory | "") {
    categoryRef.current = slug;
    setCategory(slug);
    void startNew();
  }

  async function viewSession(id: string) {
    setDetailLoading(true);
    try {
      const detail = await aplrDetail(id);
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
    setFlow("starting");
    setResult(null);
    setCountdown(null);
    setError("");
    try {
      const res = await aplrStart({ category: categoryRef.current });
      setSession(res.session);
      setMessages([{ id: `q-${Date.now()}`, role: "ada", text: res.message }]);
      setInput("");
      setFlow("idle");
      try {
        setSessions(await aplrList());
      } catch {
        /* best-effort refresh */
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not reach the server.";
      setError(msg);
      setFlow("idle");
      setMessages([
        {
          id: `err-${Date.now()}`,
          role: "ada",
          text: `${COACH_NAME}: I couldn't fetch a new question. ${msg} Please try again in a moment.`,
        },
      ]);
    } finally {
      startingRef.current = false;
    }
  }

  async function submit(text: string) {
    const clean = text.trim();
    if (!clean || !session || flow !== "idle") return;
    setFlow("thinking");
    setError("");
    const userMsg: ChatMsg = { id: `u-${Date.now()}`, role: "user", text: clean };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    try {
      const res = await aplrChat(session.id, clean);
      const adaMsg: ChatMsg = { id: `a-${Date.now()}`, role: "ada", text: res.reply };
      setMessages((prev) => [...prev, adaMsg]);
      setFlow("idle");

      if (res.closed) {
        setResult({
          solved: res.solved,
          gave_up: res.gave_up,
          points: res.points_awarded,
          stars: res.star_rating,
          solution: session.solution || "",
        });
        setCountdown(NEXT_DELAY_SECONDS);
        try {
          setSessions(await aplrList());
        } catch {
          /* best-effort refresh */
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not reach the server.";
      setError(msg);
      setFlow("idle");
    }
  }

  // Auto-start the next question once a question is resolved.
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      void startNew();
      return;
    }
    const t = window.setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [countdown]);

  function giveUp() {
    void submit("I give up — please show me the solution.");
  }

  if (!splashDone) return splash;

  if (status === "loading") {
    return <GateLoading />;
  }

  if (status === "error" || !user) {
    return <GateError message={errorMessage} />;
  }

  return (
    <div className="relative min-h-svh bg-background text-foreground">
      {/* Deco environment */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-violet-500/15 blur-3xl" />
        <div className="absolute top-16 left-[12%] h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute top-24 right-[10%] h-48 w-48 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <svg
          className="absolute left-1/2 top-10 h-64 w-[40rem] -translate-x-1/2 text-border"
          viewBox="0 0 640 256"
          fill="none"
          stroke="currentColor"
        >
          {Array.from({ length: 7 }).map((_, i) => (
            <circle
              key={i}
              cx="320"
              cy="128"
              r={24 + i * 26}
              strokeWidth="1"
              strokeDasharray="3 6"
            />
          ))}
          {Array.from({ length: 12 }).map((_, i) => (
            <line
              key={i}
              x1="320"
              y1="128"
              x2={320 + 200 * Math.cos((Math.PI * 2 * i) / 12)}
              y2={128 + 200 * Math.sin((Math.PI * 2 * i) / 12)}
              strokeWidth="1"
            />
          ))}
        </svg>
      </div>

      <AppNavHeader
        current="self-training"
        sticky
        left={
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => void navigate({ to: "/self-training", replace: true })}
              className="grid size-8 cursor-pointer place-items-center rounded-md border border-border/60 bg-background/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Back to Self Training"
            >
              <ArrowLeft className="size-4" />
            </button>
            <span className="grid size-9 place-items-center rounded-lg bg-foreground text-background">
              <BrainCircuit className="size-4" />
            </span>
            <span>
              <p className="text-sm font-semibold leading-tight">Aptitude & Logical Reasoning</p>
            </span>
          </div>
        }
      />

      <main className="relative mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              APLR Training · one question, one chat
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Sharpen your reasoning with {COACH_NAME}.
            </h1>
            <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
              Give the answer <span className="text-foreground">and</span> the approach you used —
              {COACH_NAME} rewards the method, not just the number. Solve a question and a fresh one
              begins automatically.
            </p>
          </div>
        </div>

        <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-1000"
            style={{ width: `${stats.levelProgress}%` }}
          />
        </div>

        {stats.total > 0 && (
          <div className="mb-5 rounded-2xl border border-border bg-card/70 p-4 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <TrendingUp className="size-4 text-violet-500" />
                Category insights
              </div>
              {insights.length > 0 && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest",
                    overallImprovement === null
                      ? "text-muted-foreground"
                      : overallImprovement >= 0
                        ? "text-emerald-500"
                        : "text-destructive",
                  )}
                >
                  {overallImprovement === null
                    ? "Solve 4+ rounds to see your overall trend"
                    : overallImprovement > 0
                      ? `${stats.solved}/${stats.total} solved · +${overallImprovement}% overall`
                      : `${stats.solved}/${stats.total} solved · ${overallImprovement}% overall`}
                </span>
              )}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {insights.map((ins) => {
                const Icon = ins.icon;
                return (
                  <div
                    key={ins.slug}
                    className="rounded-xl border border-border bg-secondary/30 p-3"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "grid size-6 shrink-0 place-items-center rounded-md",
                          ins.chip,
                        )}
                      >
                        <Icon className="size-3.5" />
                      </span>
                      <span className="text-[12.5px] font-medium">{ins.label}</span>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <div className="font-mono text-[11px] text-muted-foreground">
                        <span className="font-semibold text-emerald-500">{ins.solved}</span>
                        <span> solved / {ins.attempted}</span>
                      </div>
                      <div className="font-mono text-lg font-semibold tracking-tight">
                        {ins.accuracy}%
                      </div>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                      {ins.improvement === null ? (
                        <span className="text-muted-foreground">
                          Needs {ins.attempted < 4 ? 4 - ins.attempted : 1} more round
                          {ins.attempted < 4 ? "s" : ""} to measure trend
                        </span>
                      ) : ins.improvement > 0 ? (
                        <span className="inline-flex items-center gap-0.5 font-medium text-emerald-500">
                          <TrendingUp className="size-3.5" /> +{ins.improvement}% vs earlier rounds
                        </span>
                      ) : ins.improvement < 0 ? (
                        <span className="inline-flex items-center gap-0.5 font-medium text-destructive">
                          <TrendingDown className="size-3.5" /> {ins.improvement}% vs earlier rounds
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 font-medium text-amber-500">
                          <Minus className="size-3.5" /> No change vs earlier rounds
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {insights.length === 0 && (
              <p className="mt-3 text-[12px] text-muted-foreground">
                No finished rounds yet — solve or skip a few to see per-category trends.
              </p>
            )}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          {/* Chat + challenge */}
          <section className="flex min-h-[520px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            {/* Question header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/40 px-4 py-3 sm:px-5">
              <div className="flex min-w-0 items-center gap-2.5">
                {session &&
                  (() => {
                    const meta =
                      CATEGORY_META.find((c) => c.slug === session.category) ?? CATEGORY_META[0]!;
                    const Icon = meta.icon;
                    return (
                      <span
                        className={cn(
                          "grid size-9 shrink-0 place-items-center rounded-lg",
                          meta.chip,
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                    );
                  })()}
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {session ? session.category_label : "Question"}
                  </p>
                  <h2 className="truncate text-sm font-semibold">
                    {session?.title ?? "Ready when you are — Ada has a question for you."}
                  </h2>
                </div>
              </div>
            </div>

            {/* Category picker */}
            <div className="flex flex-wrap items-center gap-2 border-b border-border bg-secondary/40 px-4 py-3 sm:px-5">
              <span className="mr-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Category
              </span>
              {CATEGORY_META.map(({ slug, label, icon: Icon, chip }) => {
                const active = category === slug;
                return (
                  <button
                    key={slug || "any"}
                    type="button"
                    onClick={() => chooseCategory(slug)}
                    className={cn(
                      "flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-all",
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                    )}
                  >
                    <span
                      className={cn("grid size-4 place-items-center rounded", active ? "" : chip)}
                    >
                      <Icon className="size-3.5" />
                    </span>
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Transcript */}
            <div
              ref={scrollRef}
              className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-5"
              style={{ maxHeight: "60vh" }}
            >
              {messages.map((m) =>
                m.role === "ada" ? (
                  <div key={m.id} className="flex gap-3">
                    <img
                      src="/Panelists/Ada.png"
                      alt={COACH_NAME}
                      className="mt-0.5 size-8 shrink-0 rounded-full object-cover"
                    />
                    <div className="max-w-[82%] rounded-2xl rounded-tl-sm border border-border bg-secondary/60 px-4 py-3">
                      <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-violet-500">
                        {COACH_NAME}
                      </div>
                      <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{m.text}</p>
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="flex justify-end gap-3">
                    <div className="max-w-[82%] rounded-2xl rounded-tr-sm bg-foreground px-4 py-3 text-background">
                      <div className="mb-1 text-right font-mono text-[10px] uppercase tracking-widest opacity-60">
                        You
                      </div>
                      <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{m.text}</p>
                    </div>
                    {user?.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.name || "You"}
                        className="mt-0.5 size-8 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-foreground/10 font-mono text-[11px] font-semibold text-background">
                        {(user?.name || user?.email || "Y").slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                ),
              )}

              {flow === "thinking" && (
                <div className="flex gap-3">
                  <img
                    src="/Panelists/Ada.png"
                    alt={COACH_NAME}
                    className="mt-0.5 size-8 shrink-0 rounded-full object-cover"
                  />
                  <div className="rounded-2xl rounded-tl-sm border border-border bg-secondary/60 px-4 py-3">
                    <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" />
                      <span className="font-mono text-[10px] uppercase tracking-widest">
                        {COACH_NAME} is checking your approach…
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {flow === "starting" && (
                <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  <span className="font-mono text-[11px] uppercase tracking-[0.2em]">
                    Drafting your next question…
                  </span>
                </div>
              )}
            </div>

            {/* Result banner */}
            {result && (
              <div
                className={cn(
                  "mx-4 mb-3 overflow-hidden rounded-xl border sm:mx-5",
                  result.solved
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : "border-amber-500/40 bg-amber-500/10",
                )}
              >
                <div className="flex flex-wrap items-center gap-4 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "grid size-11 place-items-center rounded-full",
                        result.solved
                          ? "bg-emerald-500/20 text-emerald-500"
                          : "bg-amber-500/20 text-amber-500",
                      )}
                    >
                      {result.solved ? (
                        <CheckCircle2 className="size-6" />
                      ) : (
                        <XCircle className="size-6" />
                      )}
                    </span>
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        {result.solved ? "Question solved" : "Question skipped"}
                        {result.solved && <StarRow count={result.stars} />}
                      </div>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {result.solved
                          ? `+${result.points} XP ${result.stars >= 4 ? "· beautiful conventional approach" : "· keep refining your approach"}`
                          : "Solution revealed below"}
                      </div>
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-3">
                    {countdown !== null && countdown > 0 && (
                      <span className="font-mono text-[12px] text-muted-foreground">
                        next in {countdown}s
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant={result.solved ? "secondary" : "outline"}
                      onClick={() => void startNew()}
                    >
                      Next question
                      <ArrowRight className="size-3.5" />
                    </Button>
                  </div>
                </div>
                {result.gave_up && result.solution && (
                  <div className="border-t border-amber-500/20 px-4 py-3">
                    <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-amber-500">
                      Conventional approach
                    </div>
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground">
                      {result.solution}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Input */}
            <div className="border-t border-border bg-background/60 px-4 py-3 backdrop-blur sm:px-5">
              {error && (
                <p className="mb-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
                  {error}
                </p>
              )}
              <div className="flex items-end gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void submit(input);
                    }
                  }}
                  placeholder='Answer + your approach (e.g. "36 — I added the lengths, divided by time, then converted units")'
                  rows={2}
                  disabled={flow !== "idle" || !session}
                  className="min-h-[52px] flex-1 resize-none"
                />
                <Button
                  size="icon"
                  variant="outline"
                  disabled={flow !== "idle" || !session}
                  onClick={giveUp}
                  title="Give up and see the solution"
                  className="h-[52px] w-11 shrink-0"
                >
                  <Lightbulb className="size-4" />
                </Button>
                <Button
                  size="icon"
                  disabled={flow !== "idle" || !input.trim() || !session}
                  onClick={() => void submit(input)}
                  title="Send answer + approach"
                  className="h-[52px] w-11 shrink-0"
                >
                  <Send className="size-4" />
                </Button>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  Enter to send · Shift+Enter for a new line · {COACH_NAME} also reads hints and
                  give-ups.
                </span>
              </div>
            </div>
          </section>

          {/* Side: recent solved */}
          <aside className="flex flex-col gap-4">
            <div className="rounded-2xl border border-border bg-card shadow-sm">
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <RotateCcw className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">Recent rounds</span>
              </div>
              <div className="max-h-[320px] divide-y divide-border overflow-y-auto">
                {sessions.length === 0 && (
                  <p className="px-4 py-6 text-[12px] text-muted-foreground">
                    No rounds yet — your solved and skipped questions will show up here.
                  </p>
                )}
                {sessions.map((s) => {
                  return (
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
                      {(() => {
                        const meta =
                          CATEGORY_META.find((c) => c.slug === s.category) ?? CATEGORY_META[0]!;
                        const Icon = meta.icon;
                        return (
                          <span
                            className={cn(
                              "grid size-8 shrink-0 place-items-center rounded-lg",
                              meta.chip,
                            )}
                          >
                            <Icon className="size-4" />
                          </span>
                        );
                      })()}
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-2 text-[12.5px] font-medium leading-snug">
                          {s.question || s.title}
                        </div>
                        <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                          <span>{s.category_label}</span>
                        </div>
                      </div>
                      {s.status === "solved" ? (
                        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-emerald-500">
                          <StarRow count={s.star_rating} size="size-3" />+{s.points_awarded}
                        </span>
                      ) : s.status === "gave_up" ? (
                        <span className="shrink-0 font-mono text-[10px] text-amber-500">
                          skipped
                        </span>
                      ) : (
                        <span className="shrink-0 font-mono text-[10px] text-sky-500">
                          in progress
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="size-4 text-violet-500" />
                How it works
              </div>
              <ol className="mt-3 space-y-2.5 text-[12.5px] text-muted-foreground">
                {[
                  "Ada asks exactly one aptitude or reasoning question per chat.",
                  "Reply with your answer AND the approach you used to arrive at it.",
                  "Right answer with a real method = XP + stars. Numbers alone don't count.",
                  "Solved or gave up? A brand-new question starts automatically.",
                ].map((step, i) => (
                  <li key={step} className="flex items-start gap-2">
                    <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-violet-500/20 font-mono text-[9px] text-violet-500">
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
        <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
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
                    {(() => {
                      const meta =
                        CATEGORY_META.find((c) => c.slug === selectedDetail.category) ??
                        CATEGORY_META[0]!;
                      const Icon = meta.icon;
                      return (
                        <span
                          className={cn(
                            "grid size-8 shrink-0 place-items-center rounded-lg",
                            meta.chip,
                          )}
                        >
                          <Icon className="size-4" />
                        </span>
                      );
                    })()}
                    <DialogTitle className="text-base sm:text-lg">
                      {selectedDetail.title || "APLR Question"}
                    </DialogTitle>
                  </div>
                  <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px]">
                    <span>{selectedDetail.category_label}</span>
                    <span>·</span>
                    <span>
                      {selectedDetail.status === "solved"
                        ? `Solved · +${selectedDetail.points_awarded} XP`
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
                  <div className="rounded-xl border border-border bg-secondary/40 p-4">
                    <div className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-violet-500">
                      Question
                    </div>
                    <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">
                      {selectedDetail.question}
                    </p>
                  </div>

                  {selectedDetail.answer && (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                      <div className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-emerald-500">
                        Answer
                      </div>
                      <p className="text-[13.5px] font-semibold leading-relaxed">
                        {selectedDetail.answer}
                      </p>
                    </div>
                  )}

                  {selectedDetail.solution && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                      <div className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-amber-500">
                        Conventional solution
                      </div>
                      <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">
                        {selectedDetail.solution}
                      </p>
                    </div>
                  )}

                  {(selectedDetail.transcript?.length ?? 0) > 0 && (
                    <div className="rounded-xl border border-border p-4">
                      <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        Your conversation with {COACH_NAME}
                      </div>
                      <div className="space-y-2.5">
                        {selectedDetail.transcript!.map((t, i) => (
                          <div
                            key={i}
                            className={cn(
                              "rounded-lg px-3 py-2 text-[12.5px] leading-relaxed",
                              t.role === "assistant"
                                ? "border border-border bg-muted/40"
                                : "bg-foreground text-background",
                            )}
                          >
                            <div
                              className={cn(
                                "mb-0.5 font-mono text-[9px] uppercase tracking-widest",
                                t.role === "assistant" ? "text-violet-500" : "opacity-60",
                              )}
                            >
                              {t.role === "assistant" ? COACH_NAME : "You"}
                            </div>
                            <p className="whitespace-pre-wrap">{t.content}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
