import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  CalendarClock,
  Clock3,
  Gauge,
  GraduationCap,
  Lightbulb,
  Loader2,
  MessageCircle,
  Radar as RadarIcon,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart as RechartsRadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { gdDetail, gdList, type GdTrainingRecord } from "@/lib/api";
import { cn } from "@/lib/utils";

const title = "TalentBro | Group Discussion Report";
const description =
  "Graphical report for a practised group discussion: your engagement, the eight scored dimensions, progress across rounds, and what to improve next.";

export const Route = createFileRoute("/gd-report/$gdId")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: GdReportPage,
});

const gradeTone = (grade: string) => {
  const g = (grade || "").toLowerCase();
  if (g.includes("excellent")) return "text-emerald-500";
  if (g.includes("good")) return "text-sky-500";
  if (g.includes("aver")) return "text-amber-500";
  return "text-rose-500";
};

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

type TooltipEntry = {
  name?: string;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
};

function ChartTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  if (!entry) return null;
  const raw = (entry.payload ?? {}) as Record<string, unknown>;
  const name = (raw["label"] as string) ?? (raw["name"] as string) ?? entry.name ?? label;
  const value = (raw["score"] as number) ?? (raw["value"] as number) ?? entry.value;
  const suffix = typeof value === "number" && !String(name).includes("Round") ? "/ 100" : "";
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs shadow-xl">
      <div className="font-medium text-foreground">{name}</div>
      <div className="mt-0.5 font-mono font-medium tabular-nums text-foreground">
        {value ?? "—"} {suffix}
      </div>
    </div>
  );
}

const CRITERIA_TIPS: Record<string, string> = {
  "Content Quality":
    "Back every point with a concrete fact, number or recent example instead of general statements.",
  Reasoning:
    "Practice the 'because…' chain — every claim should be followed by one clear reason and an example.",
  Communication:
    "Keep lines short and sharp; one idea per turn always lands better than three muddled ones.",
  Confidence: "Open strongly with a clear stance. State your first point early in the discussion.",
  Teamwork: "Build on what a panelist said before adding your own idea. Acknowledge good points.",
  Initiative: "Volunteer early. Don't wait to be asked — take the floor after someone finishes.",
  "Active Listening":
    "Reference the last speaker's idea by name and agree or push back directly on it.",
  "Build / Challenge":
    "Politely challenge weak arguments and add nuance — this separates top performers.",
};

function GdReportPage() {
  const { gdId } = Route.useParams();

  const {
    data: round,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["gd-report", gdId],
    queryFn: () => gdDetail(gdId),
    staleTime: 30_000,
  });

  const { data: allRounds = [] } = useQuery({
    queryKey: ["gd-history"],
    queryFn: gdList,
    staleTime: 30_000,
  });

  const transcript = round?.transcript ?? [];
  const userLines = transcript.filter((t) => t.role === "user");
  const aiLines = transcript.filter((t) => t.role === "assistant");
  const userWords = userLines.reduce(
    (sum, t) =>
      sum +
      String(t.content || "")
        .split(/\s+/)
        .filter(Boolean).length,
    0,
  );
  const aiSpeakers = new Set(aiLines.map((t) => t.speaker || "Panelist")).size;

  const airtime = [
    { name: "You", value: userLines.length, color: "#f97316" },
    { name: "AI Panelists", value: aiLines.length, color: "#38bdf8" },
  ];

  const criteria = round?.criteria ?? [];
  const weakCriteria = criteria.filter((c) => c.score < 70);

  const chronological = [...allRounds].reverse();
  const progress = chronological.map((r, i) => ({
    name: `Round ${i + 1}`,
    score: r.overall_score ?? 0,
  }));

  if (isLoading && !round) return <ReportSkeleton />;

  if (isError && !round) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card/40 px-6 py-20 text-center">
            <BarChart3 className="size-10 text-muted-foreground" />
            <h2 className="mt-4 text-lg font-semibold">Couldn't load this round</h2>
            <button
              type="button"
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

  if (!round) return null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <Link
          to="/gd-history"
          className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to Group Discussion History
        </Link>

        <div className="grid gap-4">
          <HeaderCard round={round} />

          <div className="grid gap-4 lg:grid-cols-2">
            <EngagementCard
              airtime={airtime}
              userLines={userLines.length}
              aiLines={aiLines.length}
              userWords={userWords}
              aiSpeakers={aiSpeakers}
              total={transcript.length}
            />
            <RadarCard criteria={criteria} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ProgressCard progress={progress} />
            <CoachCard round={round} weak={weakCriteria} />
          </div>

          {(round.strengths?.length > 0 || round.improvement_areas?.length > 0) && (
            <div className="grid gap-4 sm:grid-cols-2">
              <StrengthsCard items={round.strengths ?? []} />
              <ImproveCard items={round.improvement_areas ?? []} />
            </div>
          )}

          <TranscriptCard transcript={transcript} />
        </div>
      </div>
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <Skeleton className="mb-5 h-5 w-52" />
        <div className="grid gap-4">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <div className="grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-72 w-full rounded-2xl" />
            <Skeleton className="h-72 w-full rounded-2xl" />
            <Skeleton className="h-72 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

function HeaderCard({ round }: { round: GdTrainingRecord }) {
  const level = gradeTone(round.grade);
  const overall = round.overall_score ?? 0;
  return (
    <Card className="overflow-hidden rounded-2xl border-border">
      <CardContent className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <Sparkles className="size-3.5 text-orange-500" /> Group Discussion Report
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{round.topic}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="secondary" className="gap-1">
                <CalendarClock className="size-3" /> {formatDate(round.created_at)}
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Clock3 className="size-3" /> {round.duration_minutes || 15} min round
              </Badge>
              <Badge variant="outline" className="gap-1">
                <MessageCircle className="size-3" /> {round.message_count} lines
              </Badge>
              <Badge
                variant="outline"
                className={cn("gap-1 font-mono uppercase tracking-wide", level)}
              >
                <Trophy className="size-3" /> {round.grade || "—"}
              </Badge>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <div className="relative grid size-24 place-items-center">
              <svg className="size-24 -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  className="stroke-muted"
                  strokeWidth="10"
                  fill="none"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  className="stroke-orange-500 transition-all duration-1000"
                  strokeWidth="10"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray="276.46"
                  strokeDashoffset={276.46 * (1 - overall / 100)}
                />
              </svg>
              <div className="absolute text-center">
                <p className="text-2xl font-bold tabular-nums">{overall}</p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">/ 100</p>
              </div>
            </div>
            <div className="hidden sm:block">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Overall score
              </p>
              <p
                className={cn(
                  "mt-0.5 font-mono text-sm font-semibold uppercase tracking-widest",
                  level,
                )}
              >
                {round.grade || "Unrated"}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EngagementCard({
  airtime,
  userLines,
  aiLines,
  userWords,
  aiSpeakers,
  total,
}: {
  airtime: { name: string; value: number; color: string }[];
  userLines: number;
  aiLines: number;
  userWords: number;
  aiSpeakers: number;
  total: number;
}) {
  const share = total > 0 ? Math.round((userLines / total) * 100) : 0;
  return (
    <Card className="rounded-2xl border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="size-4 text-orange-500" /> Your Engagement
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          How much of the discussion you drove versus the AI panelists.
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip content={<ChartTip />} />
              <Pie
                data={airtime}
                dataKey="value"
                nameKey="name"
                innerRadius="58%"
                outerRadius="88%"
                paddingAngle={3}
                stroke="transparent"
              >
                {airtime.map((slice) => (
                  <Cell key={slice.name} fill={slice.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex items-center justify-center gap-5 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-orange-500" /> You — {userLines} lines
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-sky-400" /> Panelists — {aiLines} lines
          </span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat label="Your share" value={`${share}%`} />
          <Stat label="Your words" value={String(userWords)} />
          <Stat label="Panelists" value={`${aiSpeakers} speakers`} />
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/60 px-2 py-2.5">
      <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function RadarCard({ criteria }: { criteria: { label: string; score: number }[] }) {
  return (
    <Card className="rounded-2xl border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <RadarIcon className="size-4 text-orange-500" /> Skill Radar
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsRadarChart data={criteria} outerRadius="70%">
              <PolarGrid stroke="currentColor" strokeOpacity={0.15} />
              <PolarAngleAxis dataKey="label" tick={{ fontSize: 10, fill: "currentColor" }} />
              <PolarRadiusAxis
                domain={[0, 100]}
                tickCount={5}
                tick={{ fontSize: 10, fill: "currentColor", opacity: 0.5 }}
              />
              <Tooltip
                content={<ChartTip />}
                cursor={{ stroke: "currentColor", strokeOpacity: 0.25 }}
              />
              <Radar dataKey="score" stroke="#f97316" fill="#f97316" fillOpacity={0.35} />
            </RechartsRadarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function ProgressCard({ progress }: { progress: { name: string; score: number }[] }) {
  const hasMultiple = progress.length > 1;
  const latest = progress.length ? (progress[progress.length - 1]?.score ?? 0) : 0;
  const delta = hasMultiple ? latest - (progress[0]?.score ?? latest) : 0;
  return (
    <Card className="rounded-2xl border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="size-4 text-orange-500" /> Score Progress
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {hasMultiple
            ? `Trend across your ${progress.length} rounds — you're ${delta >= 0 ? "up" : "down"} ${Math.abs(delta)} points from your first round.`
            : "Complete more rounds to see your upward trend here."}
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={progress} margin={{ left: -18, right: 8 }}>
              <CartesianGrid stroke="currentColor" strokeOpacity={0.1} vertical={false} />
              <XAxis
                dataKey="name"
                stroke="currentColor"
                tick={{ fontSize: 10, fill: "currentColor" }}
              />
              <YAxis
                domain={[0, 100]}
                stroke="currentColor"
                tick={{ fontSize: 10, fill: "currentColor" }}
              />
              <Tooltip content={<ChartTip />} />
              <Area
                type="monotone"
                dataKey="score"
                stroke="#f97316"
                fill="#f97316"
                fillOpacity={0.2}
                strokeWidth={2}
                dot={{ r: 3, fill: "#f97316" }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function CoachCard({
  round,
  weak,
}: {
  round: GdTrainingRecord;
  weak: { label: string; score: number }[];
}) {
  const tips =
    weak.length > 0
      ? weak.map((c) => ({
          label: c.label,
          tip:
            CRITERIA_TIPS[c.label] ?? "Keep practising this dimension to push your score above 70.",
        }))
      : [
          {
            label: "Keep it up!",
            tip: "You scored 70+ on every dimension. Now focus on deepening content and building on others' ideas.",
          },
        ];
  return (
    <Card className="rounded-2xl border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="size-4 text-amber-500" /> Coach's Playbook
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Focused tips on your weakest dimensions to lift this score next round.
        </p>
      </CardHeader>
      <CardContent className="grid gap-2.5">
        {tips.map((t) => (
          <div
            key={t.label}
            className="flex items-start gap-2.5 rounded-xl border border-border bg-background/60 px-3 py-2.5"
          >
            <Target className="mt-0.5 size-4 shrink-0 text-orange-500" />
            <div>
              <p className="text-sm font-semibold">{t.label}</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{t.tip}</p>
            </div>
          </div>
        ))}
        {!round.topic && (
          <p className="text-xs text-muted-foreground">
            Complete a round to unlock personalised tips.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function StrengthsCard({ items }: { items: string[] }) {
  return (
    <Card className="rounded-2xl border-emerald-500/30 bg-emerald-500/5">
      <CardHeader>
        <CardTitle className="text-base text-emerald-700 dark:text-emerald-400">
          <Sparkles className="mb-0.5 inline size-4" /> Strengths
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {items.map((s, i) => (
          <p key={i} className="flex items-start gap-2 text-sm">
            <GraduationCap className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            {s}
          </p>
        ))}
      </CardContent>
    </Card>
  );
}

function ImproveCard({ items }: { items: string[] }) {
  return (
    <Card className="rounded-2xl border-amber-500/30 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="text-base text-amber-700 dark:text-amber-400">
          <Gauge className="mb-0.5 inline size-4" /> Improve Next
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {items.map((s, i) => (
          <p key={i} className="flex items-start gap-2 text-sm">
            <Target className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            {s}
          </p>
        ))}
      </CardContent>
    </Card>
  );
}

function TranscriptCard({ transcript }: { transcript: GdTrainingRecord["transcript"] }) {
  return (
    <Card className="rounded-2xl border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="size-4 text-orange-500" /> Transcript
        </CardTitle>
        <p className="text-xs text-muted-foreground">Replay the full discussion, line by line.</p>
      </CardHeader>
      <CardContent>
        <div className="max-h-96 space-y-2.5 overflow-y-auto no-scrollbar">
          {(transcript ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No messages were recorded for this round.
            </p>
          ) : (
            (transcript ?? []).map((t, i) =>
              t.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2.5 text-sm leading-relaxed text-primary-foreground">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/70">
                      You
                    </p>
                    {t.content}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="mt-1 grid size-7 shrink-0 place-items-center rounded-full bg-orange-500/15 text-[11px] font-bold uppercase text-orange-600 dark:text-orange-400">
                    {(t.speaker || "AI").charAt(0)}
                  </span>
                  <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-border bg-background px-3.5 py-2.5 text-sm leading-relaxed">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t.speaker || "Panelist"}
                    </p>
                    {t.content}
                  </div>
                </div>
              ),
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
}
