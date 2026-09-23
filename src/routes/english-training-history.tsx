import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  ChevronRight,
  Clock,
  Languages,
  Loader2,
  MessagesSquare,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { englishTrainingList, type EnglishTrainingSession } from "@/lib/api";

const title = "TalentBro | English Training History";
const description =
  "Every English writing practice session you've had with Maya, with her AI analysis of the mistakes and how to fix them.";

export const Route = createFileRoute("/english-training-history")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: HistoryPage,
});

const METRICS: { key: keyof EnglishTrainingSession; label: string }[] = [
  { key: "clarity", label: "Clarity" },
  { key: "structure", label: "Structure" },
  { key: "grammar", label: "Grammar" },
  { key: "vocabulary", label: "Vocabulary" },
  { key: "spelling", label: "Spelling & Punctuation" },
  { key: "conciseness", label: "Conciseness" },
  { key: "task_focus", label: "Task Focus" },
  { key: "professional_tone", label: "Professional Tone" },
];

const metricColor = (i: number) =>
  ["#f59e0b", "#f97316", "#fb7185", "#a78bfa", "#38bdf8", "#34d399", "#fbbf24", "#60a5fa"][i % 8] ??
  "#f59e0b";

function level(score: number): { label: string; color: string } {
  if (score >= 90) return { label: "Polished", color: "text-emerald-500" };
  if (score >= 70) return { label: "Proficient", color: "text-sky-500" };
  if (score >= 40) return { label: "Developing", color: "text-amber-500" };
  return { label: "Beginner", color: "text-indigo-500" };
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function HistoryPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["english-training-history"],
    queryFn: englishTrainingList,
    staleTime: 30_000,
  });

  // Overall progress across every analysed session (newest-first from the API).
  const analyzed = (data ?? []).filter(
    (s) => s.finalized_at !== null && (s.writing_score ?? 0) > 0,
  );
  const total = analyzed.length;
  const scores = analyzed.map((s) => s.writing_score ?? 0);
  const overall = total ? Math.round(scores.reduce((sum, v) => sum + v, 0) / total) : 0;
  const best = total ? Math.max(...scores) : 0;
  const latest = total ? (scores[0] ?? 0) : 0;
  const first = total ? (scores[scores.length - 1] ?? 0) : 0;
  const improvement = latest - first;
  const totalMistakes = analyzed.reduce((sum, s) => sum + (s.mistake_count ?? 0), 0);
  const scoreLevel = level(overall);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-amber-500/15 text-amber-500">
              <Languages className="size-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold sm:text-2xl">English Writing History</h1>
              <p className="text-sm text-muted-foreground">
                Every session you've practised with Maya, with the mistakes she caught and how to
                fix them.
              </p>
            </div>
          </div>
        </div>

        {isLoading &&
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="mb-3 h-28 w-full rounded-2xl" />
          ))}

        {isError && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card/40 px-6 py-16 text-center">
            <BarChart3 className="size-10 text-muted-foreground" />
            <h2 className="mt-4 text-lg font-semibold">Couldn't load your history</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Make sure you're signed in and try again.
            </p>
            <button
              onClick={() => void refetch()}
              className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <Loader2 className="size-4" /> Try Again
            </button>
          </div>
        )}

        {!isLoading && !isError && (data ?? []).length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card/40 px-6 py-20 text-center">
            <Languages className="size-10 text-muted-foreground" />
            <h2 className="mt-4 text-lg font-semibold">No practice sessions yet</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Head over to English Trainer and write your first piece with Maya — emails, messages,
              letters and more.
            </p>
            <button
              onClick={() => void navigate({ to: "/english-training" })}
              className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <MessagesSquare className="size-4" /> Start Practicing
            </button>
          </div>
        )}

        {!isLoading && !isError && total > 0 && (
          <div className="mb-4 grid gap-4">
            {/* Overall progress */}
            <div className="rounded-2xl border border-border bg-card/60 p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Overall writing score
                  </p>
                  <p className="mt-1 text-4xl font-semibold tracking-tight">
                    {overall}
                    <span className="text-base text-muted-foreground">/100</span>
                  </p>
                  <p
                    className={`mt-1 font-mono text-[11px] uppercase tracking-widest ${scoreLevel.color}`}
                  >
                    {scoreLevel.label}
                  </p>
                  <div className="mt-2.5 h-1.5 w-52 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-1000"
                      style={{ width: `${overall}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-xl border border-border bg-background/60 px-4 py-2.5">
                    <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                      Practices
                    </p>
                    <p className="mt-0.5 text-xl font-semibold tabular-nums">{total}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-background/60 px-4 py-2.5">
                    <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                      Last practiced
                    </p>
                    <p className="mt-1 text-[11px] font-medium leading-tight text-muted-foreground">
                      {formatDate(analyzed[0]?.finalized_at)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Progress trend chips */}
              <div className="mt-5 grid gap-2 sm:grid-cols-3">
                <div className="flex items-center justify-between rounded-xl border border-border bg-background/60 px-3.5 py-2.5">
                  <span className="text-xs font-medium text-muted-foreground">First session</span>
                  <span className="text-sm font-semibold tabular-nums">{first}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border bg-background/60 px-3.5 py-2.5">
                  <span className="text-xs font-medium text-muted-foreground">Latest session</span>
                  <span className="text-sm font-semibold tabular-nums">{latest}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border bg-background/60 px-3.5 py-2.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Best &amp; change
                  </span>
                  <span
                    className={`text-sm font-semibold tabular-nums ${
                      improvement >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {best} · {improvement >= 0 ? "+" : ""}
                    {improvement}
                  </span>
                </div>
              </div>

              <div className="mt-5 flex items-start gap-2 rounded-xl bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-600 dark:text-amber-400">
                <TrendingUp className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  Averages across all {total} analysed practice sessions ({totalMistakes}
                  {totalMistakes === 1 ? " mistake" : " mistakes"} flagged). Open any session below
                  for its full analysis — where you went wrong and how to improve.
                </span>
              </div>
            </div>

            {/* Averaged writing metrics */}
            <div className="rounded-2xl border border-border bg-card/60 p-5 shadow-sm">
              <p className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <TrendingUp className="size-4 text-amber-500" /> Writing analysis (session averages)
              </p>
              <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {METRICS.map((m, i) => {
                  const value = Math.round(
                    analyzed.reduce((sum, s) => sum + (Number(s[m.key]) || 0), 0) / total,
                  );
                  return (
                    <div key={m.key}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium text-muted-foreground">{m.label}</span>
                        <span className="font-semibold tabular-nums">{value}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${value}%`, backgroundColor: metricColor(i) }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {!isLoading && !isError && (data ?? []).length > 0 && (
          <div className="grid gap-3">
            {(data ?? []).map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onClick={() =>
                  void navigate({
                    to: "/english-training-report/$sessionId",
                    params: { sessionId: session.id },
                  })
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SessionCard({
  session,
  onClick,
}: {
  session: EnglishTrainingSession;
  onClick: () => void;
}) {
  const date = new Date(session.created_at).toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const finalized = session.finalized_at !== null;
  const score = session.writing_score ?? 0;
  const mistakes = session.mistake_count ?? 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full cursor-pointer rounded-2xl border border-border bg-card/50 px-5 py-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`grid size-11 shrink-0 place-items-center rounded-full ${
              finalized
                ? "bg-foreground/10 text-foreground"
                : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
            }`}
          >
            {finalized ? <Trophy className="size-5" /> : <Clock className="size-5" />}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold sm:text-base">{session.title}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{date}</span>
              {!finalized && (
                <Badge variant="outline" className="gap-1 text-amber-600 dark:text-amber-400">
                  <Clock className="size-3" /> Analysis pending
                </Badge>
              )}
              {finalized && mistakes > 0 && (
                <Badge variant="secondary" className="gap-1 text-rose-600 dark:text-rose-400">
                  {mistakes} mistake{mistakes === 1 ? "" : "s"} to review
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden text-right sm:block">
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Score
            </div>
            <div className="text-xl font-bold tabular-nums">
              {score}
              <span className="text-xs font-medium text-muted-foreground">/100</span>
            </div>
          </div>
          <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
      <div className="mt-3 sm:hidden">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Score
        </div>
        <div className="text-lg font-bold tabular-nums">{score} / 100</div>
      </div>
    </button>
  );
}
