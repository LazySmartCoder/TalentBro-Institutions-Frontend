import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  BookOpenCheck,
  Clock,
  Gauge,
  Loader2,
  MessageCircle,
  Radar as RadarIcon,
  Sparkles,
  TrendingUp,
  Volume2,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart as RechartsRadarChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { communicationTrainingDetail, type CommunicationTrainingSession } from "@/lib/api";

const title = "TalentBro | Communication Analysis";
const description =
  "Maya's AI analysis of your spoken communication session: scores, speech metrics, strengths and next steps.";

export const Route = createFileRoute("/communication-training-report/$sessionId")({
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

const CHART_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"] as const;
const metricColor = (i: number) => CHART_COLORS[i % CHART_COLORS.length] ?? "#3b82f6";

type Metric = { key: keyof CommunicationTrainingSession; label: string };

const METRICS: Metric[] = [
  { key: "clarity", label: "Clarity" },
  { key: "fluency", label: "Fluency" },
  { key: "grammar", label: "Grammar" },
  { key: "vocabulary", label: "Vocabulary" },
  { key: "pronunciation", label: "Pronunciation" },
  { key: "confidence", label: "Confidence" },
  { key: "answer_structure", label: "Answer Structure" },
  { key: "relevance", label: "Relevance" },
  { key: "speaking_rate", label: "Speaking Rate" },
  { key: "pause_frequency", label: "Pause Frequency" },
  { key: "intonation", label: "Intonation" },
  { key: "speech_rhythm", label: "Speech Rhythm" },
  { key: "voice_modulation", label: "Voice Modulation" },
  { key: "listening_skills", label: "Listening Skills" },
  { key: "response_quality", label: "Response Quality" },
  { key: "professional_tone", label: "Professional Tone" },
  { key: "conversational_skills", label: "Conversational Skills" },
  { key: "vocabulary_diversity", label: "Vocabulary Diversity" },
  { key: "pronunciation_accuracy", label: "Pronunciation Accuracy" },
  { key: "workplace_communication_readiness", label: "Workplace Readiness" },
  { key: "interview_readiness", label: "Interview Readiness" },
  { key: "improvement_rate", label: "Improvement Rate" },
];

const CATEGORIES: { category: string; metrics: Metric[] }[] = [
  {
    category: "Clarity & Fluency",
    metrics: METRICS.filter((m) => ["clarity", "fluency"].includes(m.key)),
  },
  {
    category: "Vocabulary & Grammar",
    metrics: METRICS.filter((m) =>
      ["vocabulary", "vocabulary_diversity", "grammar"].includes(m.key),
    ),
  },
  {
    category: "Pronunciation",
    metrics: METRICS.filter((m) => ["pronunciation", "pronunciation_accuracy"].includes(m.key)),
  },
  {
    category: "Confidence & Tone",
    metrics: METRICS.filter((m) =>
      ["confidence", "intonation", "voice_modulation"].includes(m.key),
    ),
  },
  {
    category: "Structure & Relevance",
    metrics: METRICS.filter((m) =>
      ["answer_structure", "relevance", "response_quality"].includes(m.key),
    ),
  },
  {
    category: "Pacing & Rhythm",
    metrics: METRICS.filter((m) =>
      ["speaking_rate", "pause_frequency", "speech_rhythm"].includes(m.key),
    ),
  },
  {
    category: "Listening & Interaction",
    metrics: METRICS.filter((m) =>
      ["listening_skills", "conversational_skills", "professional_tone"].includes(m.key),
    ),
  },
];

const scoreOf = (s: CommunicationTrainingSession, key: keyof CommunicationTrainingSession) =>
  typeof s[key] === "number" ? (s[key] as number) : 0;

const categoryRadar = (session: CommunicationTrainingSession) =>
  CATEGORIES.map(({ category, metrics }) => {
    const scored = metrics.map((m) => scoreOf(session, m.key));
    const avg = scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : 0;
    return { category, score: avg };
  });

const rating = (p: number) =>
  p >= 80 ? "text-emerald-600" : p >= 60 ? "text-amber-600" : "text-red-500";

const scoreTone = (p: number) =>
  p >= 80
    ? { ring: "#22c55e", hex: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" }
    : p >= 60
      ? { ring: "#3b82f6", hex: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10" }
      : p >= 40
        ? { ring: "#f59e0b", hex: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" }
        : { ring: "#ef4444", hex: "text-red-600 dark:text-red-400", bg: "bg-red-500/10" };

function ScoreBar({ percentage, color }: { percentage: number; color: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${percentage}%`, backgroundColor: color }}
      />
    </div>
  );
}

function ReportPage() {
  const { sessionId } = Route.useParams();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["communication-training-report", sessionId],
    queryFn: () => communicationTrainingDetail(sessionId),
    staleTime: 30_000,
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <GridBackdrop />
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5"></div>

        {isLoading && <ReportSkeleton />}

        {isError && !data && (
          <EmptyState onRetry={() => void refetch()} message="We couldn't load this report." />
        )}

        {!isLoading && !isError && !data && (
          <EmptyState onRetry={() => void refetch()} message="No report found for this session." />
        )}

        {data && <ReportView session={data} />}
      </div>
    </div>
  );
}

function GridBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.06),transparent_50%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:44px_44px]" />
    </div>
  );
}

function EmptyState({ onRetry, message }: { onRetry: () => void; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card/40 px-6 py-20 text-center">
      <BarChart3 className="size-10 text-muted-foreground" />
      <h2 className="mt-4 text-lg font-semibold">{message}</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        Reports are generated automatically once a practice session is completed.
      </p>
      <button
        onClick={onRetry}
        className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        <Loader2 className="size-4" /> Load Report
      </button>
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-36 w-full rounded-2xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
      <Skeleton className="h-96 w-full rounded-2xl" />
    </div>
  );
}

function ReportView({ session }: { session: CommunicationTrainingSession }) {
  const analyzed = session.finalized_at !== null && session.communication_score > 0;
  const radarData = categoryRadar(session);
  const barData = [...METRICS]
    .map((m) => ({ label: m.label, score: scoreOf(session, m.key) }))
    .sort((a, b) => b.score - a.score);
  const metricRows = METRICS.map((m, i) => ({
    ...m,
    score: scoreOf(session, m.key),
    color: metricColor(i),
  }));
  const strengths = metricRows.filter((m) => m.score >= 80).sort((a, b) => b.score - a.score);
  const weak = metricRows.filter((m) => m.score < 60).sort((a, b) => a.score - b.score);

  return (
    <div className="grid gap-4">
      {!analyzed && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          <Clock className="size-4 shrink-0" />
          This session hasn't been analysed yet — finish a practice session to unlock the full AI
          report.
        </div>
      )}

      <HeaderCard session={session} />

      <div className="grid gap-4 lg:grid-cols-3">
        <GaugeCard session={session} />
        <div className="grid gap-4 lg:col-span-2">
          <MetricsCard session={session} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RadarCard data={radarData} />
        <BarCard data={barData} />
      </div>

      <SpeechMetricsCard session={session} />

      {(strengths.length > 0 || weak.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {strengths.length > 0 && <StrengthsCard rows={strengths} />}
          {weak.length > 0 && <WeakCard rows={weak} />}
        </div>
      )}

      <FeedbackCards session={session} />

      <DimensionList rows={metricRows} />

      <TranscriptCard session={session} />
    </div>
  );
}

function HeaderCard({ session }: { session: CommunicationTrainingSession }) {
  const date = new Date(session.created_at).toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <Card className="overflow-hidden rounded-2xl border-border">
      <CardContent className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <Sparkles className="size-3.5 text-primary" /> Communication Analysis
            </div>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{session.title}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="outline" className="gap-1">
                <MessageCircle className="size-3" />
                {(session.transcript ?? []).filter((t) => t.role === "user").length} spoken turns
              </Badge>
              <Badge variant="outline">{date}</Badge>
              {session.status === "completed" ? (
                <Badge variant="secondary" className="gap-1 text-emerald-700 dark:text-emerald-400">
                  <TrendingUp className="size-3" /> Analysed
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-amber-600 dark:text-amber-400">
                  <Clock className="size-3" /> Ongoing
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function GaugeCard({ session }: { session: CommunicationTrainingSession }) {
  const score = session.communication_score ?? 0;
  const tone = scoreTone(score);
  return (
    <Card className="rounded-2xl border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Gauge className="size-4 text-primary" /> Overall Score
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <div className="relative h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              data={[{ name: "Communication", value: score, fill: tone.ring }]}
              startAngle={90}
              endAngle={-270}
              innerRadius="74%"
              outerRadius="100%"
              barSize={14}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar
                dataKey="value"
                cornerRadius={14}
                background={{ fill: "currentColor", fillOpacity: 0.08 }}
              />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className={`text-5xl font-bold tabular-nums ${tone.hex}`}>{score}</div>
            <div className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              / 100
            </div>
          </div>
        </div>
        <div className={`mt-2 rounded-full px-3 py-1 text-xs font-medium ${tone.bg} ${tone.hex}`}>
          {score >= 80
            ? "Excellent communicator"
            : score >= 60
              ? "Good — keep improving"
              : score >= 40
                ? "Building confidence"
                : "Early stage"}
        </div>
      </CardContent>
    </Card>
  );
}

function MetricsCard({ session }: { session: CommunicationTrainingSession }) {
  const ready = [
    { label: "Worplace Readiness", value: session.workplace_communication_readiness ?? 0 },
    { label: "Interview Readiness", value: session.interview_readiness ?? 0 },
    { label: "Improvement Rate", value: session.improvement_rate ?? 0 },
  ];
  return (
    <Card className="rounded-2xl border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="size-4 text-primary" /> Readiness & Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5 sm:grid-cols-3">
        {ready.map((r) => (
          <div
            key={r.label}
            className="flex flex-col items-center rounded-xl border border-border bg-card/40 p-4"
          >
            <div className={`text-3xl font-bold tabular-nums ${scoreTone(r.value).hex}`}>
              {r.value}%
            </div>
            <div className="mt-1 text-center text-xs font-medium text-muted-foreground">
              {r.label}
            </div>
            <div className="mt-3 w-full">
              <ScoreBar percentage={r.value} color={scoreTone(r.value).ring} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

type TooltipEntry = { name?: string; value?: number | string; payload?: Record<string, unknown> };

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
  const name = (raw["category"] as string) ?? (raw["label"] as string) ?? entry.name ?? label;
  const value = (raw["score"] as number) ?? (raw["percentage"] as number) ?? entry.value;
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs shadow-xl">
      <div className="font-medium text-foreground">{name}</div>
      <div className="mt-0.5 font-mono font-medium tabular-nums text-foreground">
        {value} <span className="text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

function RadarCard({ data }: { data: { category: string; score: number }[] }) {
  return (
    <Card className="rounded-2xl border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <RadarIcon className="size-4 text-primary" /> Skill Radar by Category
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsRadarChart data={data} outerRadius="70%">
              <PolarGrid stroke="currentColor" strokeOpacity={0.15} />
              <PolarAngleAxis dataKey="category" tick={{ fontSize: 10, fill: "currentColor" }} />
              <PolarRadiusAxis
                domain={[0, 100]}
                tickCount={5}
                tick={{ fontSize: 9, fill: "currentColor", opacity: 0.6 }}
              />
              <Tooltip
                content={<ChartTip />}
                cursor={{ stroke: "currentColor", strokeOpacity: 0.25 }}
              />
              <Radar dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.35} />
            </RechartsRadarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Average of the individual scores within each group.
        </p>
      </CardContent>
    </Card>
  );
}

function BarCard({ data }: { data: { label: string; score: number }[] }) {
  return (
    <Card className="rounded-2xl border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="size-4 text-primary" /> Dimension Scores
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 20 }}>
              <CartesianGrid stroke="currentColor" strokeOpacity={0.1} horizontal={false} />
              <XAxis type="number" domain={[0, 100]} stroke="currentColor" tick={false} />
              <YAxis
                type="category"
                dataKey="label"
                width={120}
                stroke="currentColor"
                tick={{ fontSize: 10, fill: "currentColor" }}
              />
              <Tooltip
                content={<ChartTip />}
                cursor={{ fill: "currentColor", fillOpacity: 0.06 }}
              />
              <Bar
                dataKey="score"
                name="Score"
                radius={[0, 4, 4, 0]}
                label={{ position: "right", fontSize: 10, fill: "currentColor" }}
              >
                {data.map((d, i) => (
                  <Cell key={d.label} fill={metricColor(i)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function SpeechMetricsCard({ session }: { session: CommunicationTrainingSession }) {
  const items = [
    { label: "Filler Words", value: String(session.filler_words ?? 0), icon: null },
    { label: "Repeated Words", value: String(session.repeated_words ?? 0), icon: null },
    { label: "Sentence Restarts", value: String(session.sentence_restarts ?? 0), icon: null },
    { label: "Grammar Errors", value: String(session.grammar_error_count ?? 0), icon: null },
    {
      label: "Avg Pause Duration",
      value: `${Number(session.average_pause_duration ?? 0).toFixed(1)}s`,
      icon: null,
    },
  ];
  return (
    <Card className="rounded-2xl border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Volume2 className="size-4 text-primary" /> Speech Habits
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          What your spoken delivery sounded like during the session.
        </p>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {items.map((it) => (
          <div
            key={it.label}
            className="flex flex-col items-center rounded-xl border border-border bg-card/40 p-4 text-center"
          >
            <div className="text-2xl font-bold tabular-nums text-foreground">{it.value}</div>
            <div className="mt-1 text-[11px] font-medium text-muted-foreground">{it.label}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function StrengthsCard({ rows }: { rows: { label: string; score: number; color: string }[] }) {
  return (
    <Card className="rounded-2xl border-emerald-500/30 bg-emerald-500/5">
      <CardHeader>
        <CardTitle className="text-base text-emerald-700 dark:text-emerald-400">
          Key Strengths
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2.5">
        {rows.map((m) => (
          <div key={m.label} className="text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium">{m.label}</span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                {m.score}%
              </span>
            </div>
            <ScoreBar percentage={m.score} color="#22c55e" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function WeakCard({ rows }: { rows: { label: string; score: number; color: string }[] }) {
  return (
    <Card className="rounded-2xl border-red-500/30 bg-red-500/5">
      <CardHeader>
        <CardTitle className="text-base text-red-700 dark:text-red-400">
          Needs Improvement
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2.5">
        {rows.map((m) => (
          <div key={m.label} className="text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium">{m.label}</span>
              <span className="font-semibold text-red-700 dark:text-red-400">{m.score}%</span>
            </div>
            <ScoreBar percentage={m.score} color="#ef4444" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function textSection(label: string, value: string, tone: string) {
  return (
    <div className={`rounded-xl border p-4 ${tone}`}>
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
        {label}
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
        {value || "No note from Maya yet."}
      </p>
    </div>
  );
}

function FeedbackCards({ session }: { session: CommunicationTrainingSession }) {
  return (
    <Card className="rounded-2xl border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpenCheck className="size-4 text-primary" /> Maya's Coaching Notes
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {textSection("Strengths", session.strengths, "border-emerald-500/60 bg-emerald-500/5")}
        {textSection(
          "Areas for Improvement",
          session.areas_for_improvement,
          "border-amber-500/60 bg-amber-500/5",
        )}
        {textSection(
          "Recurring Mistakes",
          session.recurring_mistakes,
          "border-red-500/60 bg-red-500/5",
        )}
        {textSection(
          "Practice Priorities",
          session.practice_priorities,
          "border-blue-500/60 bg-blue-500/5",
        )}
        <div className="sm:col-span-2">
          {textSection(
            "AI Recommendations",
            session.ai_recommendations,
            "border-violet-500/60 bg-violet-500/5",
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DimensionList({ rows }: { rows: { label: string; score: number; color: string }[] }) {
  return (
    <Card className="rounded-2xl border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-primary" /> Dimension Breakdown
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Every scored dimension of this session at a glance.
        </p>
      </CardHeader>
      <CardContent className="grid gap-2">
        {rows.map((m) => (
          <div
            key={m.label}
            className="grid gap-2 rounded-xl border border-border bg-card/40 p-3.5 sm:grid-cols-[220px_1fr] sm:items-center"
          >
            <div className="flex items-center justify-between gap-2 sm:block">
              <div className="text-sm font-medium">{m.label}</div>
              <div className={`sm:mt-1 text-xl font-bold tabular-nums ${rating(m.score)}`}>
                {m.score}%
              </div>
            </div>
            <div className="sm:pr-4">
              <ScoreBar percentage={m.score} color={m.color} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function TranscriptCard({ session }: { session: CommunicationTrainingSession }) {
  const turns = session.transcript ?? [];
  if (turns.length === 0) return null;
  return (
    <Card className="rounded-2xl border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="size-4 text-primary" /> Conversation Transcript
        </CardTitle>
      </CardHeader>
      <CardContent className="flex max-h-96 flex-col gap-2.5 overflow-y-auto pr-1">
        {turns.map((t, i) => (
          <div key={i} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                t.role === "user"
                  ? "rounded-br-sm bg-primary text-primary-foreground"
                  : "rounded-bl-sm border border-border bg-card/60 text-foreground"
              }`}
            >
              {t.content}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
