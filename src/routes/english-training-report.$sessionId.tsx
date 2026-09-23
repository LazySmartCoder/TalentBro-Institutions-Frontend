import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  CheckCheck,
  Languages,
  Loader2,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  englishTrainingSessionDetail,
  type EnglishTrainingMistake,
  type EnglishTrainingSession,
} from "@/lib/api";

const title = "TalentBro | English Session Report";
const description =
  "Maya's AI analysis of one English writing session: your scores, every mistake highlighted, and how to write it better.";

export const Route = createFileRoute("/english-training-report/$sessionId")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: ReportPage,
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

const CATEGORY_STYLES: Record<string, string> = {
  grammar: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  spelling: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  punctuation: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  vocabulary: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  structure: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  tone: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
};

function categoryStyle(category: string): string {
  return CATEGORY_STYLES[category] ?? "bg-muted text-muted-foreground";
}

function scoreLevel(score: number): { label: string; color: string } {
  if (score >= 90) return { label: "Polished", color: "text-emerald-500" };
  if (score >= 70) return { label: "Proficient", color: "text-sky-500" };
  if (score >= 40) return { label: "Developing", color: "text-amber-500" };
  return { label: "Beginner", color: "text-indigo-500" };
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ReportPage() {
  const navigate = useNavigate();
  const { sessionId } = Route.useParams();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["english-training-session", sessionId],
    queryFn: () => englishTrainingSessionDetail(sessionId!),
    enabled: !!sessionId,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
          <Skeleton className="mb-4 h-8 w-40 rounded-lg" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="mb-3 h-32 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
          <BackButton />
          <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-border bg-card/40 px-6 py-16 text-center">
            <BarChart3 className="size-10 text-muted-foreground" />
            <h2 className="mt-4 text-lg font-semibold">Couldn't load this session</h2>
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
        </div>
      </div>
    );
  }

  const score = data.writing_score ?? 0;
  const level = scoreLevel(score);
  const mistakes = data.mistakes ?? [];
  const analyzed = (data.finalized_at ?? null) !== null && score > 0;
  const turnCount = (data.transcript ?? []).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <BackButton />

        {/* Session header */}
        <div className="mt-2 mb-5 rounded-2xl border border-border bg-card/60 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-amber-500/15 text-amber-500">
                <Languages className="size-5" />
              </span>
              <div>
                <h1 className="text-xl font-bold sm:text-2xl">{data.title}</h1>
                <p className="text-sm text-muted-foreground">{formatDate(data.created_at)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Session score
              </p>
              <p className="text-3xl font-semibold tracking-tight">
                {score}
                <span className="text-sm text-muted-foreground">/100</span>
              </p>
              <p className={`font-mono text-[11px] uppercase tracking-widest ${level.color}`}>
                {level.label}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {METRICS.map((m, i) => {
              const value = Number(data[m.key]) || 0;
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

        {!analyzed ? (
          <div className="flex items-start gap-2 rounded-xl border border-border bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-600 dark:text-amber-400">
            <ClockIcon />
            <span>
              This session's analysis hasn't been generated yet. Head back to history in a moment —
              or keep practising and Maya analyses it as soon as you finish.
            </span>
          </div>
        ) : (
          <div className="grid gap-4">
            {/* Mistakes & improvements */}
            <div className="rounded-2xl border border-border bg-card/60 p-5 shadow-sm">
              <div className="mb-1 flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <CheckCheck className="size-4 text-amber-500" /> Mistake fixes
                </p>
                {mistakes.length > 0 && (
                  <Badge variant="secondary">
                    {mistakes.length} mistake{mistakes.length === 1 ? "" : "s"}
                  </Badge>
                )}
              </div>
              <p className="mb-4 text-xs text-muted-foreground">
                Where you slipped and exactly how to say it better.
              </p>

              {mistakes.length === 0 ? (
                <div className="rounded-xl border border-border bg-emerald-500/5 px-4 py-4 text-sm text-emerald-600 dark:text-emerald-400">
                  <p className="font-semibold">Clean writing — no mistakes flagged.</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Maya found no grammar, spelling or tone slips worth calling out. Keep an eye on
                    Maya's feedback below for the next level of polish.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {mistakes.map((m, i) => (
                    <MistakeCard key={i} mistake={m} />
                  ))}
                </div>
              )}
            </div>

            {/* Transcript with inline mistake annotations */}
            <div className="rounded-2xl border border-border bg-card/60 shadow-sm">
              <div className="border-b border-border px-5 py-3.5">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <TrendingUp className="size-4 text-amber-500" /> Your writing, turn by turn
                  <Badge variant="secondary" className="ml-auto font-normal">
                    {turnCount} turns
                  </Badge>
                </p>
              </div>
              <div className="max-h-[36rem] overflow-y-auto p-5 no-scrollbar">
                {turnCount === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No conversation recorded for this session.
                  </p>
                ) : (
                  <div className="flex flex-col gap-4">
                    <Transcript
                      session={data}
                      renderTurnMistakes={(turnMistakes) => (
                        <InlineMistakes mistakes={turnMistakes} />
                      )}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Maya's narrative feedback */}
            <div className="rounded-2xl border border-border bg-card/60 p-5 shadow-sm">
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <BookOpenCheck className="size-4 text-amber-500" /> Maya's feedback
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <FeedbackBlock
                  title="Strengths"
                  text={data.strengths}
                  tone="text-emerald-600 dark:text-emerald-400"
                />
                <FeedbackBlock
                  title="Areas to improve"
                  text={data.areas_for_improvement}
                  tone="text-amber-600 dark:text-amber-400"
                />
                <FeedbackBlock
                  title="Recurring mistakes"
                  text={data.recurring_mistakes}
                  tone="text-rose-600 dark:text-rose-400"
                />
                <FeedbackBlock
                  title="AI recommendations"
                  text={data.ai_recommendations}
                  tone="text-sky-600 dark:text-sky-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 pb-2">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Sparkles className="size-3.5 text-amber-500" />
                Analysed at {formatDate(data.finalized_at)}
              </p>
              <button
                type="button"
                onClick={() => void navigate({ to: "/english-training-history" })}
                className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                Back to history <ArrowRight className="size-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ClockIcon() {
  return <span className="mt-0.5 size-3.5 shrink-0 rounded-full border-2 border-current" />;
}

function BackButton() {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => void navigate({ to: "/english-training-history" })}
      className="inline-flex cursor-pointer items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> History
    </button>
  );
}

function MistakeCard({ mistake }: { mistake: EnglishTrainingMistake }) {
  return (
    <div className="rounded-xl border border-border bg-background/60 px-4 py-3.5">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={`${categoryStyle(mistake.category)} capitalize`}>
          {mistake.category || "writing"}
        </Badge>
        {typeof mistake.turn_index === "number" && (
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            In message #{mistake.turn_index + 1}
          </span>
        )}
      </div>
      <div className="grid gap-2.5 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <div className="min-w-0 rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-rose-500">As you wrote</p>
          <p className="mt-0.5 text-sm leading-relaxed text-rose-700 line-through decoration-rose-400/70 dark:text-rose-300">
            {mistake.original}
          </p>
        </div>
        <ArrowRight className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
        <div className="min-w-0 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-emerald-500">Better</p>
          <p className="mt-0.5 text-sm leading-relaxed font-medium text-emerald-700 dark:text-emerald-300">
            {mistake.corrected}
          </p>
        </div>
      </div>
      {mistake.explanation && (
        <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Why: </span>
          {mistake.explanation}
        </p>
      )}
    </div>
  );
}

function InlineMistakes({ mistakes }: { mistakes: EnglishTrainingMistake[] }) {
  if (mistakes.length === 0) return null;
  return (
    <div className="mt-2 flex w-[85%] flex-col gap-1.5">
      {mistakes.map((m, i) => (
        <div
          key={i}
          className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-xs"
        >
          <span className="text-rose-600 line-through decoration-rose-400/70 dark:text-rose-300">
            {m.original}
          </span>
          <span className="mx-1.5 text-muted-foreground">→</span>
          <span className="font-medium text-emerald-600 dark:text-emerald-400">{m.corrected}</span>
          {m.explanation && (
            <p className="mt-1 leading-relaxed text-muted-foreground">{m.explanation}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function Transcript({
  session,
  renderTurnMistakes,
}: {
  session: EnglishTrainingSession;
  renderTurnMistakes: (mistakes: EnglishTrainingMistake[]) => ReactNode;
}) {
  const turns = session.transcript ?? [];
  let userIndex = -1;
  return turns.map((t, i) => {
    if (t.role === "user") userIndex += 1;
    const turnMistakes =
      t.role === "user"
        ? (session.mistakes ?? []).filter((m) => (m.turn_index ?? -1) === userIndex)
        : [];
    if (t.role === "assistant") {
      return (
        <div key={i} className="flex items-start gap-2.5">
          <img
            src="/Panelists/Maya.png"
            alt="Maya"
            className="mt-1 size-8 shrink-0 rounded-full object-cover"
          />
          <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-border bg-background px-3.5 py-2.5 text-sm leading-relaxed">
            {t.content}
            <p className="mt-1.5 text-[10px] text-muted-foreground">{formatDate(t.created_at)}</p>
          </div>
        </div>
      );
    }
    return (
      <div key={i} className="flex flex-col items-end">
        <div className="flex items-end gap-2">
          <div className="flex-col">
            <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2.5 text-sm leading-relaxed text-primary-foreground">
              {t.content}
              <p className="mt-1.5 text-right text-[10px] text-primary-foreground/60">
                {formatDate(t.created_at)}
              </p>
            </div>
            {renderTurnMistakes(turnMistakes)}
          </div>
        </div>
      </div>
    );
  });
}

function FeedbackBlock({ title, text, tone }: { title: string; text: string; tone: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/60 px-3.5 py-3">
      <p className={`text-xs font-semibold uppercase tracking-wide ${tone}`}>{title}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{text?.trim() || "—"}</p>
    </div>
  );
}
