import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, ChevronRight, Clock, Loader2, Mic, TrendingUp, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { communicationTrainingList, type CommunicationTrainingSession } from "@/lib/api";

const title = "TalentBro | Communication Training History";
const description =
  "Every voice practice session you've had with Maya, with the AI analysis for each one.";

export const Route = createFileRoute("/communication-training-history")({
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

const METRICS: { key: keyof CommunicationTrainingSession; label: string }[] = [
  { key: "clarity", label: "Clarity" },
  { key: "fluency", label: "Fluency" },
  { key: "grammar", label: "Grammar" },
  { key: "vocabulary", label: "Vocabulary" },
  { key: "pronunciation", label: "Pronunciation" },
  { key: "confidence", label: "Confidence" },
  { key: "answer_structure", label: "Answer Structure" },
  { key: "professional_tone", label: "Professional Tone" },
];

const metricColor = (i: number) =>
  ["#38bdf8", "#6366f1", "#a78bfa", "#f472b6", "#34d399", "#fbbf24", "#fb7185", "#60a5fa"][i % 8] ??
  "#38bdf8";

function commLevel(score: number): { label: string; color: string } {
  if (score >= 90) return { label: "Excellent", color: "text-emerald-500" };
  if (score >= 70) return { label: "Advanced", color: "text-sky-500" };
  if (score >= 40) return { label: "Intermediate", color: "text-amber-500" };
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
    queryKey: ["communication-training-history"],
    queryFn: communicationTrainingList,
    staleTime: 30_000,
  });

  // Overall progress across every analysed session (newest-first from the API).
  const analyzed = (data ?? []).filter(
    (s) => s.finalized_at !== null && (s.communication_score ?? 0) > 0,
  );
  const total = analyzed.length;
  const scores = analyzed.map((s) => s.communication_score ?? 0);
  const overall = total ? Math.round(scores.reduce((sum, v) => sum + v, 0) / total) : 0;
  const best = total ? Math.max(...scores) : 0;
  const latest = total ? (scores[0] ?? 0) : 0; // newest first in the list
  const first = total ? (scores[scores.length - 1] ?? 0) : 0;
  const improvement = latest - first;
  const level = commLevel(overall);

  const formatScore = (v: number) => `${v}%`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-foreground text-background">
              <Mic className="size-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold sm:text-2xl">Practice History</h1>
              <p className="text-sm text-muted-foreground">
                Every session you've practiced with Maya, analysed by AI.
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
            <Mic className="size-10 text-muted-foreground" />
            <h2 className="mt-4 text-lg font-semibold">No practice sessions yet</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Head over to Communication Skills and have your first spoken conversation with Maya.
            </p>
            <button
              onClick={() => void navigate({ to: "/communication-training" })}
              className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <Mic className="size-4" /> Start Practicing
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
                    Overall score
                  </p>
                  <p className="mt-1 text-4xl font-semibold tracking-tight">
                    {overall}
                    <span className="text-base text-muted-foreground">/100</span>
                  </p>
                  <p
                    className={`mt-1 font-mono text-[11px] uppercase tracking-widest ${level.color}`}
                  >
                    {level.label}
                  </p>
                  <div className="mt-2.5 h-1.5 w-52 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-500 transition-all duration-1000"
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
                  <span className="text-sm font-semibold tabular-nums">{formatScore(first)}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border bg-background/60 px-3.5 py-2.5">
                  <span className="text-xs font-medium text-muted-foreground">Latest session</span>
                  <span className="text-sm font-semibold tabular-nums">{formatScore(latest)}</span>
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
                    {best}% · {improvement >= 0 ? "+" : ""}
                    {improvement}%
                  </span>
                </div>
              </div>

              <div className="mt-5 flex items-start gap-2 rounded-xl bg-sky-500/10 px-3.5 py-2.5 text-xs text-sky-600 dark:text-sky-400">
                <TrendingUp className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  Averages across all {total} analysed practice sessions. Open any session below for
                  its full AI analysis, feedback, and transcript.
                </span>
              </div>
            </div>

            {/* Averaged delivery metrics */}
            <div className="rounded-2xl border border-border bg-card/60 p-5 shadow-sm">
              <p className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <TrendingUp className="size-4 text-sky-500" /> Delivery analysis (session averages)
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
                    to: "/communication-training-report/$sessionId",
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
  session: CommunicationTrainingSession;
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
  const score = session.communication_score ?? 0;

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
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden text-right sm:block">
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Score
            </div>
            <div className="text-xl font-bold tabular-nums">
              {score}%<span className="text-xs font-medium text-muted-foreground">/100</span>
            </div>
          </div>
          <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
      <div className="mt-3 sm:hidden">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Score
        </div>
        <div className="text-lg font-bold tabular-nums">{score}% / 100</div>
      </div>
    </button>
  );
}
