import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowLeft,
  ChevronRight,
  Clock,
  Gauge,
  Loader2,
  Mic,
  MessagesSquare,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  mockInterviewStats,
  type MockInterviewScoredPoint,
  type MockInterviewStats,
} from "@/lib/api";
import { categoryBreakdown, INTERVIEW_CATEGORIES } from "@/lib/interview-rubric";
import { usePagedScroll } from "@/lib/use-paged-scroll";
import { cn } from "@/lib/utils";

const title = "TalentBro | Interview History";
const description =
  "Every mock interview you have run, and an overall performance score built from your own record.";

/**
 * How many interviews the "All interviews" list holds per page. The record grows
 * without bound — a student who practises weekly reaches hundreds of rows — so
 * the list is pulled a page at a time as the reader reaches the end of it. The
 * rollups above are never paged.
 */
const INTERVIEW_PAGE_SIZE = 50;

/**
 * Recharts paints its hover card white on the default theme, which is unreadable
 * once the app goes dark. These point it at the theme's own tokens instead, so
 * the radar and the score trend read the same in light and dark.
 */
const CHART_TIP = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "0.5rem",
  fontSize: "0.75rem",
  color: "var(--card-foreground)",
  boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.15)",
};
const CHART_TIP_LABEL = { color: "var(--muted-foreground)" };
const CHART_TIP_ITEM = { color: "var(--card-foreground)", paddingBlock: 0 };

/**
 * The weights behind the overall performance index.
 *
 * These are a judgement call, not a measurement, so they are printed in the UI
 * next to the number they produce: a performance score a candidate cannot
 * explain is just a vibe with a decimal point.
 */
const INDEX_WEIGHTS = {
  score: 0.45,
  completion: 0.2,
  depth: 0.2,
  panel: 0.15,
} as const;

type Component = {
  key: keyof typeof INDEX_WEIGHTS;
  label: string;
  value: number | null;
  weight: number;
  hint: string;
};

const PANEL_COLOURS = {
  positive: "text-emerald-600",
  neutral: "text-amber-600",
  negative: "text-red-500",
} as const;

const STATUS_META: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> =
  {
    completed: { label: "Scored", variant: "default" },
    not_scored: { label: "Not scored", variant: "secondary" },
    active: { label: "In progress", variant: "outline" },
    finished: { label: "Finished", variant: "secondary" },
  };

const rating = (p: number) =>
  p >= 80 ? "text-emerald-600" : p >= 60 ? "text-amber-600" : "text-red-500";

function perfLevel(score: number) {
  if (score >= 85) return { label: "Excellent", className: "text-emerald-600" };
  if (score >= 70) return { label: "Advanced", className: "text-sky-600" };
  if (score >= 45) return { label: "Intermediate", className: "text-amber-600" };
  return { label: "Building", className: "text-indigo-600" };
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });

/**
 * Build the overall index from the candidate's own record. Four components,
 * each expressed 0-100, then a weighted mean.
 *
 * A component is `null` when the record cannot support it, and null components
 * are dropped and the remaining weights renormalised rather than being scored
 * zero. Someone on their very first interview has no panel history yet; making
 * them start at 30 because of data that does not exist yet would punish them
 * for a blank slate.
 *
 * Every input here is a whole-record figure, never a page of the interview list,
 * so the index does not move as the reader scrolls.
 */
function buildComponents(data: MockInterviewStats): Component[] {
  const { totals, tones, scored } = data;

  const avgScore = scored.length
    ? scored.reduce((sum, point) => sum + point.score, 0) / scored.length
    : null;

  // Completion is "of the interviews that finished, how many earned a score".
  const finished = totals.completed + totals.not_scored;
  const completion = finished ? (totals.completed / finished) * 100 : null;

  // Depth is answers given against the target for that session's own length, so
  // a short session is not measured against a long session's target.
  const depth = totals.avg_depth;

  // Panel sentiment excludes neutral: a flat turn tells you nothing about how
  // the answer landed, and folding it in would dilute a clear signal.
  const toned = tones.positive + tones.negative;
  const panel = toned ? (tones.positive / toned) * 100 : null;

  return [
    {
      key: "score",
      label: "Answer quality",
      value: avgScore,
      weight: INDEX_WEIGHTS.score,
      hint: `Average of the ${scored.length} scored ${
        scored.length === 1 ? "interview" : "interviews"
      } on the panel's own 34-dimension rubric.`,
    },
    {
      key: "completion",
      label: "Completion rate",
      value: completion,
      weight: INDEX_WEIGHTS.completion,
      hint: `Share of your ${finished} finished ${
        finished === 1 ? "interview" : "interviews"
      } that reached a scoreable finish.`,
    },
    {
      key: "depth",
      label: "Answer depth",
      value: depth,
      weight: INDEX_WEIGHTS.depth,
      hint: "Answers given against the exchange target for each session's own length.",
    },
    {
      key: "panel",
      label: "Panel response",
      value: panel,
      weight: INDEX_WEIGHTS.panel,
      hint: "Share of the panel's own verdicts that were positive rather than negative.",
    },
  ];
}

function overallIndex(components: Component[]) {
  const live = components.filter((c): c is Component & { value: number } => c.value !== null);
  if (!live.length) return null;
  const weight = live.reduce((sum, c) => sum + c.weight, 0);
  return Math.round(live.reduce((sum, c) => sum + c.value * c.weight, 0) / weight);
}

/** Per-category averages across every scored interview, with a coverage count. */
function skillAverages(scored: MockInterviewScoredPoint[]) {
  const sums: Record<string, number> = {};
  const counts: Record<string, number> = {};
  for (const point of scored) {
    for (const row of categoryBreakdown(point.dimensions)) {
      if (!row.dimensions) continue;
      sums[row.category] = (sums[row.category] ?? 0) + row.score;
      counts[row.category] = (counts[row.category] ?? 0) + 1;
    }
  }
  return Object.keys(INTERVIEW_CATEGORIES).map((category) => {
    const count = counts[category] ?? 0;
    return {
      category,
      score: count ? Math.round((sums[category] ?? 0) / count) : 0,
      interviews: count,
    };
  });
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-3">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
      {sub ? <p className="text-[11px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-8">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-48 w-full" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

export const Route = createFileRoute("/candidate/mock-interview-history")({
  head: () => ({
    meta: [{ title }, { name: "description", content: description }],
  }),
  component: MockInterviewHistoryPage,
});

function MockInterviewHistoryPage() {
  // The interview list is paged; the rollups come back whole on every page, so
  // the performance index and both charts describe the entire record no matter
  // how far down the reader has scrolled.
  const query = useInfiniteQuery({
    queryKey: ["mock-interview-stats"],
    queryFn: ({ pageParam }) =>
      mockInterviewStats({ limit: INTERVIEW_PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.has_more ? all.length * INTERVIEW_PAGE_SIZE : undefined),
  });
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  const listEnd = usePagedScroll(loadMore, hasNextPage !== false);

  // Every page carries the same whole-record rollups, so the newest page is
  // enough to drive them and they cannot drift between pages.
  const stats = query.data?.pages.at(-1);
  const interviews = useMemo(
    () => query.data?.pages.flatMap((page) => page.interviews) ?? [],
    [query.data],
  );

  const components = useMemo(() => (stats ? buildComponents(stats) : []), [stats]);
  const index = useMemo(() => overallIndex(components), [components]);
  const skills = useMemo(() => (stats ? skillAverages(stats.scored) : []), [stats]);

  // The same transcript the starter screen opens for a past interview, so a
  // candidate reading their record and a candidate reading the setup screen are
  // looking at the same chat.
  const navigate = useNavigate();
  function showChats(interviewId: string) {
    void navigate({ to: "/mock-interview-transcript/$interviewId", params: { interviewId } });
  }

  if (query.isPending) return <Loading />;

  if (query.isError) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-10">
        <Link
          to="/candidate/mock-interview"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to mock interview
        </Link>
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            We could not load your interview history. Please refresh and try again.
          </CardContent>
        </Card>
      </div>
    );
  }

  const data = stats;
  if (!data) return <Loading />;

  const { totals, tones, by_role } = data;
  const level = index !== null ? perfLevel(index) : null;
  const ranked = skills.filter((s) => s.interviews > 0);
  const strongest = [...ranked].sort((a, b) => b.score - a.score)[0];
  const weakest = [...ranked].sort((a, b) => a.score - b.score)[0];

  // Scored interviews oldest-first, so the trend reads left to right. This comes
  // from the whole record, so the line never redraws itself mid-scroll.
  const trend = data.scored.map((point) => ({
    label: point.company_name || "Session",
    date: fmtDate(point.created_at),
    score: point.score,
  }));

  // Moved over the whole record, so the badge is honest even across a gap.
  const firstScore = trend.at(0)?.score ?? null;
  const lastScore = trend.at(-1)?.score ?? null;
  const delta =
    trend.length > 1 && firstScore !== null && lastScore !== null ? lastScore - firstScore : null;

  const avgUserTurns = totals.interviews ? totals.user_turns / totals.interviews : 0;
  const avgWords = totals.user_turns ? Math.round(totals.user_words / totals.user_turns) : 0;
  const tonedTotal = tones.positive + tones.neutral + tones.negative;

  if (!totals.interviews) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-10">
        <Link
          to="/candidate/mock-interview"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to mock interview
        </Link>
        <Card>
          <CardContent className="flex flex-col items-start gap-3 pt-6">
            <h1 className="text-xl font-semibold">No mock interviews yet</h1>
            <p className="text-sm text-muted-foreground">
              Run your first mock interview and this page will chart your scores, answer depth and
              panel response across every session.
            </p>
            <Button asChild className="mt-1">
              <Link to="/candidate/mock-interview">Start a mock interview</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to="/candidate/mock-interview"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to mock interview
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Interview history</h1>
          <p className="text-sm text-muted-foreground">
            {totals.interviews} {totals.interviews === 1 ? "interview" : "interviews"} on record
            {totals.companies ? ` across ${totals.companies} companies` : ""}
            {totals.roles ? ` and ${totals.roles} roles` : ""}.
          </p>
        </div>
      </header>

      {/* Overall performance. Everything below the number is shown too, so it
          can be checked rather than trusted. */}
      <Card>
        <CardContent className="space-y-5 pt-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Overall performance
              </p>
              <div className="mt-1 flex items-baseline gap-3">
                <span className="text-5xl font-semibold tabular-nums">
                  {index !== null ? index : "—"}
                </span>
                <span className="text-lg text-muted-foreground">/ 100</span>
                {level ? (
                  <span className={cn("text-sm font-medium", level.className)}>{level.label}</span>
                ) : null}
              </div>
            </div>
            <p className="max-w-sm text-xs text-muted-foreground">
              A weighted mean of four things measured in your own record. Nothing here is written by
              a model &mdash; every number is arithmetic over scores the panel already gave you.
            </p>
          </div>

          {index !== null ? (
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-foreground transition-[width] duration-700"
                style={{ width: `${index}%` }}
              />
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {components.map((component) => (
              <div
                key={component.key}
                className="rounded-xl border border-border/60 bg-background/40 p-3"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {component.label}
                  </p>
                  <p className="text-[10px] tabular-nums text-muted-foreground">
                    {Math.round(component.weight * 100)}%
                  </p>
                </div>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {component.value !== null ? Math.round(component.value) : "—"}
                </p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-muted-foreground/60"
                    style={{ width: `${component.value ?? 0}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  {component.hint}
                </p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Interviews"
              value={String(totals.interviews)}
              sub={`${totals.scored} scored`}
            />
            <Stat
              label="Answers given"
              value={String(totals.user_turns)}
              sub={`${avgUserTurns.toFixed(1)} per interview`}
            />
            <Stat
              label="Words answered"
              value={String(totals.user_words)}
              sub={avgWords ? `${avgWords} per answer` : "No answers yet"}
            />
            <Stat
              label="Panel verdicts"
              value={String(tonedTotal)}
              sub={`${tones.positive} positive · ${tones.negative} negative`}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Skills across all interviews</CardTitle>
          </CardHeader>
          <CardContent>
            {ranked.length ? (
              <>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={skills} outerRadius="72%">
                      <PolarGrid stroke="var(--border)" />
                      <PolarAngleAxis
                        dataKey="category"
                        tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                      />
                      <PolarRadiusAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                      />
                      <Radar
                        name="Score"
                        dataKey="score"
                        stroke="var(--foreground)"
                        fill="var(--foreground)"
                        fillOpacity={0.18}
                      />
                      <Tooltip
                        cursor={{ stroke: "var(--border)", strokeOpacity: 0.5 }}
                        contentStyle={CHART_TIP}
                        labelStyle={CHART_TIP_LABEL}
                        itemStyle={CHART_TIP_ITEM}
                        formatter={(value: number, _name, item) => [
                          `${value}/100`,
                          `${(item?.payload as { interviews?: number } | undefined)?.interviews ?? 0} interviews`,
                        ]}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                {strongest && weakest ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-border/60 bg-background/40 p-3">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        Strongest
                      </p>
                      <p className="mt-1 text-sm font-medium">{strongest.category}</p>
                      <p
                        className={cn(
                          "text-lg font-semibold tabular-nums",
                          rating(strongest.score),
                        )}
                      >
                        {strongest.score}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-background/40 p-3">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        Weakest
                      </p>
                      <p className="mt-1 text-sm font-medium">{weakest.category}</p>
                      <p
                        className={cn("text-lg font-semibold tabular-nums", rating(weakest.score))}
                      >
                        {weakest.score}
                      </p>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No scored interview yet, so there is nothing to chart here.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Score trend</CardTitle>
            {trend.length > 1 ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5" />
                {delta !== null && delta >= 0 ? "+" : ""}
                {delta} since your first
              </span>
            ) : null}
          </CardHeader>
          <CardContent>
            {trend.length > 1 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--foreground)" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="var(--foreground)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    />
                    <Tooltip
                      cursor={{ stroke: "var(--border)", strokeOpacity: 0.5 }}
                      contentStyle={CHART_TIP}
                      labelStyle={CHART_TIP_LABEL}
                      itemStyle={CHART_TIP_ITEM}
                      formatter={(value: number, _name, item) => [
                        `${value}/100`,
                        (item?.payload as { label?: string } | undefined)?.label ?? "",
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="var(--foreground)"
                      strokeWidth={2}
                      fill="url(#scoreFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {trend.length === 1
                  ? "One scored interview so far. A trend appears after your next one."
                  : "No scored interview yet, so there is no trend to draw."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activity and integrity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Panel sentiment
              </p>
              {tonedTotal ? (
                <>
                  <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="flex h-full">
                      <div
                        className="bg-emerald-500"
                        style={{ width: `${(tones.positive / tonedTotal) * 100}%` }}
                      />
                      <div
                        className="bg-amber-500"
                        style={{ width: `${(tones.neutral / tonedTotal) * 100}%` }}
                      />
                      <div
                        className="bg-red-500"
                        style={{ width: `${(tones.negative / tonedTotal) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-[11px]">
                    {(["positive", "neutral", "negative"] as const).map((tone) => (
                      <span key={tone} className={cn("tabular-nums", PANEL_COLOURS[tone])}>
                        {tones[tone]} {tone}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  The panel has not recorded a verdict yet.
                </p>
              )}
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/40 p-3">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {totals.violations === 0
                    ? "Clean record"
                    : `${totals.violations} Suspicion detected`}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {totals.violations === 0
                    ? "No focus loss was recorded across your interviews. Leaving the tab is flagged because it is the usual way to look up an answer."
                    : "These are counted but never scored: your interview still ran and your answers still counted."}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Completed" value={String(totals.completed)} />
              <Stat label="Not scored" value={String(totals.not_scored)} />
              <Stat label="In progress" value={String(totals.active)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">By role</CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const rows = by_role;
              if (!rows.length) {
                return (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Nothing to break down yet.
                  </p>
                );
              }
              const max = Math.max(...rows.map((r) => r.avg_user_turns));
              return (
                <div className="space-y-3">
                  {rows.map((row) => (
                    <div key={row.name || "Unlabelled"}>
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                          <Gauge className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          {row.name || "Unlabelled"}
                        </p>
                        <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {row.avg_score !== null ? (
                            <span className={cn("font-medium", rating(row.avg_score))}>
                              {row.avg_score}
                            </span>
                          ) : (
                            <span>not scored</span>
                          )}
                        </p>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-muted-foreground/60"
                            style={{ width: `${(row.avg_user_turns / max) * 100}%` }}
                          />
                        </div>
                        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                          {row.interviews} {row.interviews === 1 ? "interview" : "interviews"} ·{" "}
                          {row.avg_user_turns.toFixed(1)} answers
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* Every interview, not a top-N. Paged, so only the next handful arrive
          when the reader reaches the end of the list. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            All interviews
            <span className="ml-2 text-xs font-normal text-muted-foreground">{data.total}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {interviews.map((interview) => {
              const meta = STATUS_META[interview.status] ?? {
                label: interview.status,
                variant: "secondary" as const,
              };
              const score = interview.analysis?.overall_score ?? null;
              const reached = interview.target_exchanges
                ? Math.min(
                    100,
                    Math.round((interview.user_turns / interview.target_exchanges) * 100),
                  )
                : 0;
              return (
                <li key={interview.id}>
                  <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-background/40 p-3 transition-colors hover:bg-muted/40">
                    <Link
                      to="/interview-analysis/$interviewId"
                      params={{ interviewId: interview.id }}
                      className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium">
                            {interview.company_name || "General mock interview"}
                          </p>
                          <Badge variant={meta.variant}>{meta.label}</Badge>
                          {interview.suspection ? (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground"
                              title="A tab switch was recorded for this interview. It is not scored."
                            >
                              <ShieldAlert className="h-3 w-3" /> tab switch
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          {interview.role ? <span>{interview.role}</span> : null}
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {fmtDate(interview.created_at)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Mic className="h-3 w-3" />
                            {interview.user_turns} answers
                          </span>
                          {interview.duration ? <span>{interview.duration}</span> : null}
                          <span>{reached}% of target</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {score !== null ? (
                          <span className={cn("text-xl font-semibold tabular-nums", rating(score))}>
                            {score}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not scored</span>
                        )}
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </div>
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => showChats(interview.id)}
                    >
                      <MessagesSquare className="h-3.5 w-3.5" /> Show Chats
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
          {/* Reaching this row means the reader has seen every interview loaded
              so far, so the next page goes out and the spinner sits here until
              it lands. */}
          <div ref={listEnd} aria-hidden className="flex justify-center py-4">
            {isFetchingNextPage ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
