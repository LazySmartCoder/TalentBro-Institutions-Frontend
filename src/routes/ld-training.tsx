import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, CalendarDays, Sparkles, TrendingUp, Users } from "lucide-react";
import {
  Bar as ChartBar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
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
import { Shell } from "@/components/dash/Shell";
import {
  Bar,
  Kpi,
  Panel,
  Pill,
  chartColors,
  chartCursor,
  chartFill,
  chartTooltip,
} from "@/components/dash/bits";
import { GateError, GateLoading } from "@/components/load-state";
import {
  getInstitutionOverview,
  getStudents,
  type InstitutionOverview,
  type StudentRecord,
} from "@/lib/api";

// The board is rebuilt from the live batch: every track is one of the
// self-training modules the backend already scores per student, so enrolment and
// progress here are the same numbers the student's own dashboard is built on.
const TRACKS = [
  {
    key: "aplr",
    label: "Aptitude & Logical Reasoning",
    track: "APL",
    focus: "Quantitative · logical reasoning · puzzles",
  },
  {
    key: "basic_math",
    label: "Basic Mathematics",
    track: "BMT",
    focus: "Arithmetic · mensuration · speed drills",
  },
  {
    key: "situational",
    label: "Situational Problem Solving",
    track: "SPS",
    focus: "Case judgement · workplace scenarios",
  },
  {
    key: "technical",
    label: "Technical / Coding",
    track: "TEC",
    focus: "Core CS · system design · implementation",
  },
  {
    key: "dsa",
    label: "Data Structures & Algorithms",
    track: "DSA",
    focus: "Arrays · hash maps · recursion · DP",
  },
  {
    key: "communication",
    label: "Communication Skills",
    track: "CDP",
    focus: "Voice · structure · STAR storytelling",
  },
  {
    key: "english",
    label: "English Writing",
    track: "EWP",
    focus: "Writing · email etiquette · workplace tone",
  },
  {
    key: "gd",
    label: "Group Discussion",
    track: "GDA",
    focus: "Panel GD practice · personal pitch · HR rounds",
  },
] as const;

const PILLARS = [
  { key: "score", label: "Readiness" },
  { key: "coverage", label: "Coverage" },
  { key: "mock_interview", label: "Mock interview" },
  { key: "self_training", label: "Self-training" },
  { key: "chat", label: "Chat practice" },
] as const;

// A student counts as needing help on a pillar below this score.
const AT_RISK_BELOW = 60;

type TrackStat = {
  key: string;
  label: string;
  track: string;
  focus: string;
  score: number;
  practised: number;
  gap: number;
};

function trackStats(rows: StudentRecord[]): TrackStat[] {
  return TRACKS.map((t) => {
    let total = 0;
    let practised = 0;
    for (const row of rows) {
      const module = row.performance?.modules?.find((m) => m.key === t.key);
      if (!module) continue;
      total += module.score;
      practised += 1;
    }
    const score = practised > 0 ? Math.round(total / practised) : 0;
    return {
      key: t.key,
      label: t.label,
      track: t.track,
      focus: t.focus,
      score,
      practised,
      gap: 100 - score,
    };
  });
}

function statusOf(stat: TrackStat): { label: string; tone: "solid" | "outline" | "muted" } {
  if (stat.practised === 0) return { label: "Not started", tone: "muted" };
  if (stat.score >= AT_RISK_BELOW) return { label: "Live", tone: "solid" };
  return { label: "Needs attention", tone: "outline" };
}

export const Route = createFileRoute("/ld-training")({
  head: () => ({
    meta: [
      { title: "L&D Training — TalentBro Placement Dashboard" },
      {
        name: "description",
        content:
          "Learning & Development readiness for your batch — training tracks, cohort coverage and the sessions to run next.",
      },
      { property: "og:title", content: "L&D Training — TalentBro" },
      {
        property: "og:description",
        content: "Training tracks, readiness pillars and the sessions to run next.",
      },
    ],
  }),
  component: LdTrainingPage,
});

function LdTrainingPage() {
  const [rows, setRows] = useState<StudentRecord[] | null>(null);
  const [overview, setOverview] = useState<InstitutionOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    Promise.all([getStudents(), getInstitutionOverview()])
      .then(([students, ov]) => {
        if (cancelled) return;
        setRows(students.students);
        setOverview(ov);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load the L&D board.");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  if (rows === null && error === null) return <GateLoading />;
  if (rows === null) {
    return (
      <Shell title="L&D Training" subtitle="Readiness and training coverage for your batch">
        <GateError
          message={error}
          onRetry={() => {
            setReloadKey((n) => n + 1);
          }}
        />
      </Shell>
    );
  }

  const scored = rows.filter((r) => r.performance);
  const tracks = trackStats(rows);
  const activeTracks = tracks.filter((t) => t.practised > 0);
  const needsAttention = tracks.filter((t) => t.practised > 0 && t.score < AT_RISK_BELOW);

  const radar = PILLARS.map((p) => {
    const values = scored
      .map((r) => r.performance?.[p.key])
      .filter((v): v is number => typeof v === "number");
    return {
      area: p.label,
      score: values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0,
      atRisk: values.filter((v) => v < AT_RISK_BELOW).length,
      measured: values.length,
    };
  });
  const radarMax = Math.max(1, ...radar.map((r) => r.score));
  const maxAtRisk = Math.max(1, ...radar.map((r) => r.atRisk));

  const totalPractised = tracks.reduce((a, t) => a + t.practised, 0);
  const readiness = scored.length
    ? Math.round(scored.reduce((a, r) => a + (r.performance?.score ?? 0), 0) / scored.length)
    : 0;
  const cohort = overview?.batch;
  const termLabel = cohort ? `Batch ${cohort.year} · ${cohort.students} students` : "Current batch";

  return (
    <Shell
      title="L&D Training"
      subtitle={`Learning & Development readiness for ${overview?.institution.name ?? "your college"}`}
      actions={
        <span className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium">
          <CalendarDays className="size-3.5 text-muted-foreground" /> {termLabel}
        </span>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Active programs"
          value={activeTracks.length}
          suffix="tracks"
          icon={BookOpen}
          hint={`${tracks.length} tracks in the library`}
        />
        <Kpi
          label="Students enrolled"
          value={overview?.kpis.total_students ?? rows.length}
          icon={Users}
          hint={`${scored.length} with readiness scores`}
        />
        <Kpi
          label="Module enrolments"
          value={totalPractised}
          suffix="starts"
          icon={Sparkles}
          hint="track × student, from live practice"
        />
        <Kpi
          label="Avg. readiness"
          value={readiness}
          suffix="%"
          icon={TrendingUp}
          hint="composite score across the batch"
        />
      </div>

      <Panel
        className="mt-4"
        title="Skill radar"
        description="Batch average per readiness pillar, and how many students sit below the intervention threshold"
      >
        <div className="grid items-center gap-4 lg:grid-cols-2">
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={radar} outerRadius="68%">
              <PolarGrid stroke={chartColors.grid} />
              <PolarAngleAxis dataKey="area" tick={{ fontSize: 11, fill: "oklch(0.45 0 0)" }} />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={{ fontSize: 10 }}
                stroke={chartColors.grid}
              />
              <Tooltip contentStyle={chartTooltip} cursor={chartCursor} />
              <Radar
                dataKey="score"
                name="Batch average"
                stroke={chartColors.ink}
                fill={chartColors.ink}
                fillOpacity={0.16}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
          <div className="space-y-2">
            {radar.map((p) => (
              <div key={p.area} className="rounded-md border border-border px-3.5 py-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{p.area}</p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {p.measured} students measured · {p.atRisk} below {AT_RISK_BELOW}
                    </p>
                  </div>
                  <span className="stat-num text-sm">{p.score}</span>
                </div>
                <div className="mt-2">
                  <Bar value={p.atRisk} max={maxAtRisk} />
                </div>
              </div>
            ))}
            {radarMax === 0 && (
              <p className="py-2 text-xs text-muted-foreground">
                No readiness scores recorded yet — students appear here once they start practice.
              </p>
            )}
          </div>
        </div>
      </Panel>

      <Panel
        className="mt-4"
        title="Training programs"
        description="Every self-training track, with the batch's own average score and how many students have opened it."
      >
        <div className="grid gap-3 lg:grid-cols-2">
          {tracks.map((t) => {
            const status = statusOf(t);
            return (
              <div key={t.key} className="rounded-lg border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      {t.track}
                    </p>
                    <h3 className="mt-1 text-sm font-semibold">{t.label}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t.focus}</p>
                  </div>
                  <Pill tone={status.tone}>{status.label}</Pill>
                </div>
                <div className="mt-4 flex items-center gap-4 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Users className="size-3.5" /> {t.practised} practising
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="size-3.5" /> avg {t.score}
                  </span>
                </div>
                <div className="mt-3">
                  <Bar value={t.score} />
                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{t.practised > 0 ? `${t.gap} points to close` : "No activity yet"}</span>
                    <span className="font-mono">{t.score}% avg score</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel
        className="mt-4"
        title="Suggestions for next training sessions"
        description="Tracks with the largest gap between the batch average and a full score, worst first"
      >
        {needsAttention.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <ResponsiveContainer width="100%" height={230}>
              <BarChart
                data={needsAttention}
                layout="vertical"
                margin={{ top: 2, right: 34, bottom: 0, left: 0 }}
              >
                <CartesianGrid stroke={chartColors.grid} horizontal={false} />
                <XAxis type="number" dataKey="gap" hide />
                <YAxis
                  type="category"
                  dataKey="track"
                  width={64}
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  tick={{ fill: "oklch(0.4 0 0)" }}
                />
                <Tooltip
                  contentStyle={chartTooltip}
                  cursor={chartCursor}
                  formatter={(value) => [`${value} points to close`, "Gap to 100"]}
                />
                <ChartBar dataKey="gap" radius={[0, 4, 4, 0]} barSize={20}>
                  {needsAttention.map((s, i) => (
                    <Cell key={s.key} fill={chartFill(i)} />
                  ))}
                  <LabelList dataKey="gap" position="right" fontSize={11} fill="oklch(0.35 0 0)" />
                </ChartBar>
              </BarChart>
            </ResponsiveContainer>

            <div className="space-y-2">
              {needsAttention.map((t) => (
                <div key={t.key} className="rounded-md border border-border px-3.5 py-2.5">
                  <div className="flex items-center gap-3">
                    <Pill tone="outline">{t.track}</Pill>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{t.label}</p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{t.focus}</p>
                    </div>
                    <span className="stat-num text-sm">{t.gap}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex-1">
                      <Bar value={100 - t.gap} />
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {t.practised} practising
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {activeTracks.length > 0
              ? "Every active track is already at or above the intervention threshold."
              : "No training activity recorded for this batch yet."}
          </p>
        )}
      </Panel>
    </Shell>
  );
}
