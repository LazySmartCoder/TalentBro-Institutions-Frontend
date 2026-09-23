import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  Loader2,
  MessageCircle,
  Radar as RadarIcon,
  Sparkles,
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
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { mockInterviewAnalysis, mockInterviewDetail, type MockInterviewAnalysis } from "@/lib/api";

const title = "TalentBro | Interview Analysis";
const description =
  "Detailed AI assessment of your mock interview: 34 scored dimensions with evidence, plus a SWOT breakdown.";

export const Route = createFileRoute("/interview-analysis/$interviewId")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: AnalysisPage,
});

const CHART_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"] as const;

const metricColor = (i: number) => CHART_COLORS[i % CHART_COLORS.length] ?? "#3b82f6";

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
  const name = (raw["dimension"] as string) ?? (raw["category"] as string) ?? entry.name ?? label;
  const value = (raw["percentage"] as number) ?? (raw["score"] as number) ?? entry.value;
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs shadow-xl">
      <div className="font-medium text-foreground">{name}</div>
      <div className="mt-0.5 font-mono font-medium tabular-nums text-foreground">
        {value} <span className="text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

const CATEGORIES: Record<string, string[]> = {
  Communication: [
    "Communication Skills",
    "Verbal Fluency",
    "Conciseness",
    "Vocabulary",
    "Listening",
    "Ability to Structure an Answer",
  ],
  "Critical Thinking": [
    "Clarity of Thought",
    "Analytical & Problem-Solving Ability",
    "Logical Reasoning",
    "Ability to Defend an Opinion",
  ],
  Knowledge: ["Knowledge & Awareness", "Subject Knowledge", "General Awareness"],
  "Presence & Attitude": ["Confidence", "Personality & Presence", "Attitude", "Energy"],
  "Leadership & Influence": ["Leadership & Initiative", "Ability to Influence", "Ambition"],
  "Emotional Intelligence": [
    "Emotional Maturity",
    "Self-Awareness",
    "Empathy",
    "Conflict Management",
  ],
  "Teamwork & Values": [
    "Teamwork & Interpersonal Skills",
    "Integrity & Values",
    "Respect for Others",
    "Responsibility",
    "Discipline",
  ],
  "Growth & Adaptability": [
    "Motivation & Fit",
    "Curiosity",
    "Creativity",
    "Adaptability",
    "Learning Orientation",
  ],
};

function categoryRadar(metrics: MockInterviewAnalysis["metrics"]) {
  return Object.entries(CATEGORIES).map(([category, dims]) => {
    const scored = metrics.filter((m) => dims.includes(m.dimension));
    const avg = scored.length
      ? Math.round(scored.reduce((sum, m) => sum + m.percentage, 0) / scored.length)
      : 0;
    return { category, score: avg };
  });
}

const rating = (p: number) =>
  p >= 80 ? "text-emerald-600" : p >= 60 ? "text-amber-600" : "text-red-500";

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

function AnalysisPage() {
  const navigate = useNavigate();
  const { interviewId } = Route.useParams();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["mock-interview-analysis", interviewId],
    queryFn: () => mockInterviewAnalysis(interviewId),
    staleTime: 30_000,
  });

  const analysis = data ?? null;

  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    document.title = analysis ? `Analysis — ${analysis.company_name}` : title;
  }, [analysis]);

  async function openChat() {
    if (chatLoading) return;
    setChatLoading(true);
    try {
      const detail = await mockInterviewDetail(interviewId);
      const questions = detail.questions ?? [];
      const picked =
        questions.length > 0
          ? (questions[Math.floor(Math.random() * questions.length)] as string)
          : "";
      const shortened = picked.length > 160 ? `${picked.slice(0, 157).trimEnd()}…` : picked;

      const d = new Date(detail.created_at);
      const pad = (n: number) => String(n).padStart(2, "0");
      const timestampId = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

      const prompt = [
        "How could have i answerd this quesiton by atlas better?",
        "",
        "Mock Interview Details",
        `Interview ID: MI-${timestampId}`,
        `Company: ${detail.company_name || "N/A"}`,
        `Role: ${detail.role || "N/A"}`,
        shortened ? `Question: ${shortened}` : "",
        `Conducted on: ${d.toLocaleString()}`,
      ]
        .filter((line) => line !== "")
        .join("\n");

      await navigate({
        to: "/chat",
        search: { prompt },
      });
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <GridBackdrop />
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-center justify-between">
          <Link
            to="/mock-interview"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Back to Mock Interviews
          </Link>
          {analysis ? (
            <button
              onClick={() => void openChat()}
              disabled={chatLoading}
              className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {chatLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <MessageCircle className="size-4" />
              )}
              Chat about this interview
            </button>
          ) : null}
        </div>

        {isLoading && <AnalysisSkeleton />}

        {isError && !analysis && (
          <EmptyState onRetry={() => void refetch()} message="We couldn't load this analysis." />
        )}

        {!isLoading && !isError && !analysis && (
          <EmptyState
            onRetry={() => void refetch()}
            message="No analysis found for this interview."
          />
        )}

        {analysis && <AnalysisView analysis={analysis} />}
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
        The analysis is generated automatically once a mock interview is completed.
      </p>
      <button
        onClick={onRetry}
        className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        <Loader2 className="size-4" /> Load Analysis
      </button>
    </div>
  );
}

function AnalysisSkeleton() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-28 w-full rounded-2xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
      <Skeleton className="h-96 w-full rounded-2xl" />
    </div>
  );
}

function AnalysisView({ analysis }: { analysis: MockInterviewAnalysis }) {
  const radarData = categoryRadar(analysis.metrics);
  const barData = [...analysis.metrics]
    .sort((a, b) => b.percentage - a.percentage)
    .map((m) => ({ ...m }));

  const strengths = analysis.metrics.filter((m) => m.percentage >= 80);
  const weak = analysis.metrics.filter((m) => m.percentage < 80);

  return (
    <div className="grid gap-4">
      <HeaderCard analysis={analysis} />

      {analysis.swot.strengths || analysis.swot.weaknesses ? (
        <SWOTCard swot={analysis.swot} />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <RadarCard data={radarData} />
        <BarCard data={barData} />
      </div>

      <DimensionList metrics={analysis.metrics} />

      {(strengths.length > 0 || weak.length > 0) && (
        <div className="grid gap-4">
          {strengths.length > 0 && <StrengthsCard metrics={strengths} />}
          {weak.length > 0 && <WeakCard metrics={weak} />}
        </div>
      )}
    </div>
  );
}

function HeaderCard({ analysis }: { analysis: MockInterviewAnalysis }) {
  const date = new Date(analysis.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  return (
    <Card className="overflow-hidden rounded-2xl border-border">
      <CardContent className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <Sparkles className="size-3.5 text-primary" /> Interview Analysis
            </div>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
              {analysis.company_name || "Mock Interview"} — {analysis.role || "N/A"}
            </h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="secondary" className="gap-1">
                <Building2 className="size-3" /> {analysis.company_name || "N/A"}
              </Badge>
              <Badge variant="outline" className="gap-1">
                <BriefcaseBusiness className="size-3" /> {analysis.role || "N/A"}
              </Badge>
              <Badge variant="outline">{date}</Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SWOTCard({ swot }: { swot: MockInterviewAnalysis["swot"] }) {
  const items = [
    { label: "Strengths", value: swot.strengths, color: "border-emerald-500/60 bg-emerald-500/5" },
    { label: "Weaknesses", value: swot.weaknesses, color: "border-red-500/60 bg-red-500/5" },
    {
      label: "Opportunities",
      value: swot.opportunities,
      color: "border-blue-500/60 bg-blue-500/5",
    },
    { label: "Threats", value: swot.threats, color: "border-amber-500/60 bg-amber-500/5" },
  ] as const;
  return (
    <Card className="rounded-2xl border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-primary" /> SWOT Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {items.map((it) => (
          <div key={it.label} className={`rounded-xl border p-3.5 ${it.color}`}>
            <div className="text-xs font-semibold uppercase tracking-wide">{it.label}</div>
            <p className="mt-1.5 whitespace-pre-wrap text-sm text-muted-foreground">
              {it.value || "—"}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
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
              <PolarAngleAxis dataKey="category" tick={{ fontSize: 11, fill: "currentColor" }} />
              <PolarRadiusAxis
                domain={[0, 100]}
                tickCount={5}
                tick={{ fontSize: 10, fill: "currentColor", opacity: 0.6 }}
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
          Average score across the dimensions in each group.
        </p>
      </CardContent>
    </Card>
  );
}

function BarCard({ data }: { data: MockInterviewAnalysis["metrics"] }) {
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
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid stroke="currentColor" strokeOpacity={0.1} horizontal={false} />
              <XAxis type="number" domain={[0, 100]} stroke="currentColor" tick={false} />
              <YAxis
                type="category"
                dataKey="dimension"
                width={190}
                stroke="currentColor"
                tick={{ fontSize: 11, fill: "currentColor" }}
              />
              <Tooltip
                content={<ChartTip />}
                cursor={{ fill: "currentColor", fillOpacity: 0.06 }}
              />
              <Bar
                dataKey="percentage"
                name="Score"
                radius={[0, 4, 4, 0]}
                label={{ position: "right", fontSize: 11, fill: "currentColor" }}
              >
                {data.map((m, i) => (
                  <Cell key={m.dimension} fill={metricColor(i)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function DimensionList({ metrics }: { metrics: MockInterviewAnalysis["metrics"] }) {
  return (
    <Card className="rounded-2xl border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-primary" /> Dimension Breakdown
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Each dimension shows its percentage with the evidence-based description of why it was
          earned during this interview.
        </p>
      </CardHeader>
      <CardContent className="grid gap-2">
        {metrics.map((m, i) => (
          <div
            key={m.dimension}
            className="grid gap-2 rounded-xl border border-border bg-card/40 p-3.5 sm:grid-cols-[220px_1fr] sm:items-center"
          >
            <div>
              <div className="text-sm font-medium">{m.dimension}</div>
              <div className="mt-1 text-2xl font-bold">
                <span className={rating(m.percentage)}>{m.percentage}%</span>
              </div>
            </div>
            <div className="sm:pr-4">
              <ScoreBar percentage={m.percentage} color={metricColor(i)} />
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                {m.description || "No description provided."}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function StrengthsCard({ metrics }: { metrics: MockInterviewAnalysis["metrics"] }) {
  return (
    <Card className="rounded-2xl border-emerald-500/30 bg-emerald-500/5">
      <CardHeader>
        <CardTitle className="text-base text-emerald-700 dark:text-emerald-400">
          Key Strengths
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2.5">
        {metrics.map((m) => (
          <div key={m.dimension} className="text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium">{m.dimension}</span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                {m.percentage}%
              </span>
            </div>
            <ScoreBar percentage={m.percentage} color="#22c55e" />
            <p className="mt-1.5 text-muted-foreground">{m.description}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function WeakCard({ metrics }: { metrics: MockInterviewAnalysis["metrics"] }) {
  return (
    <Card className="rounded-2xl border-red-500/30 bg-red-500/5">
      <CardHeader>
        <CardTitle className="text-base text-red-700 dark:text-red-400">
          Needs Improvement
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2.5">
        {metrics.map((m) => (
          <div key={m.dimension} className="text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium">{m.dimension}</span>
              <span className="font-semibold text-red-700 dark:text-red-400">{m.percentage}%</span>
            </div>
            <ScoreBar percentage={m.percentage} color="#ef4444" />
            <p className="mt-1.5 text-muted-foreground">{m.description}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
