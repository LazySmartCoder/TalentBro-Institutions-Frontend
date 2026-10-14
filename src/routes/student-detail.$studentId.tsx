import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Award,
  BadgeCheck,
  Briefcase,
  Building2,
  Calendar,
  FolderGit2,
  GraduationCap,
  IndianRupee,
  Languages,
  Mail,
  MessageCircle,
  Radar as RadarIcon,
  Target,
  TrendingUp,
  User,
} from "lucide-react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getReadinessLeaderboard,
  me,
  type LeaderboardStudent,
  type PerformanceComponents,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { GateError, GateLoading } from "@/components/load-state";
import { chartTooltipProps } from "@/components/dash/bits";
import { AppNavHeader, AppNavIconButton } from "@/components/tb/app-nav";

const title = "Candidate | TalentBro";
const description = "A candidate's placement readiness breakdown and training activity.";

export const Route = createFileRoute("/student-detail/$studentId")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
    ],
  }),
  component: StudentDetailPage,
});

function initialsOf(name?: string) {
  const source = (name || "?").trim();
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();
}

function fmtCtc(value?: number | null) {
  if (value == null) return null;
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 1 })} LPA`;
}

const PLACEMENT_LABELS: Record<string, string> = {
  not_started: "Ineligible",
  applying: "Applying",
  shortlisted: "Shortlisted",
  placed: "Placed",
};

const SELF_TRAINING_MODULES = [
  { key: "aplr", label: "Aptitude & Logical Reasoning" },
  { key: "basic_math", label: "Mathematics" },
  { key: "situational", label: "Situational Problem Solving Skills (Management)" },
  { key: "technical", label: "Problem Solving Skills (Technical)" },
  { key: "dsa", label: "DSA (Data Structure & Algorithms)" },
  { key: "communication", label: "Communication Skills" },
  { key: "english", label: "English Trainer" },
  { key: "gd", label: "Group Discussion" },
];

function GridBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.06),transparent_50%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:44px_44px]" />
    </div>
  );
}

function DetailBar({
  label,
  score,
  detail,
  tone = "emerald",
}: {
  label: string;
  score: number | null;
  detail: string;
  tone?: "emerald" | "primary";
}) {
  return (
    <div className="rounded-xl border border-border bg-card/40 px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-sm font-semibold tabular-nums">
          {score != null ? `${Math.round(score)}/100` : "Not started"}
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            tone === "emerald" ? "bg-emerald-500" : "bg-primary",
          )}
          style={{ width: `${score != null ? Math.max(0, Math.min(100, score)) : 0}%` }}
        />
      </div>
      {detail && <p className="mt-1.5 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

function wrapLabel(text: string, maxChars: number, maxLines: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (line && next.length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    return [
      `${lines
        .slice(0, maxLines)
        .join(" ")
        .slice(0, maxChars * 2 + 3)
        .trimEnd()}…`,
    ];
  }
  return lines;
}

function RadarTick({
  x = 0,
  y = 0,
  textAnchor = "middle",
  payload,
}: {
  x?: number;
  y?: number;
  textAnchor?: "inherit" | "start" | "end" | "middle";
  payload?: { value?: string };
}) {
  const lines = wrapLabel(payload?.value ?? "", 16, 2);
  const blockOffset = -(lines.length - 1) * 4.5;
  return (
    <text x={x} y={y} dy={blockOffset} fill="currentColor" fontSize={8.5} textAnchor={textAnchor}>
      {lines.map((line, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : 8.5} dominantBaseline="central">
          {line}
        </tspan>
      ))}
    </text>
  );
}

function SkillRadar({ perf }: { perf: PerformanceComponents | null }) {
  const scores = new Map<string, number>();
  for (const m of perf?.modules ?? []) scores.set(m.key, m.score);
  const data = SELF_TRAINING_MODULES.map((mod) => ({
    axis: mod.label,
    score: scores.get(mod.key) ?? 0,
  }));

  return (
    <Card className="h-full rounded-2xl border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <RadarIcon className="size-4 text-primary" /> Skill Radar
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Self-training modules and mock interviews behind this readiness score
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data} outerRadius="70%">
              <PolarGrid stroke="currentColor" strokeOpacity={0.15} />
              <PolarAngleAxis dataKey="axis" tick={<RadarTick />} />
              <PolarRadiusAxis
                domain={[0, 100]}
                tickCount={5}
                tick={{ fontSize: 9, fill: "currentColor", opacity: 0.4 }}
              />
              <Tooltip
                {...chartTooltipProps}
                formatter={(value: number | string | Array<number | string>) => [
                  `${Number(value).toFixed(1)}/100`,
                  "Skill score",
                ]}
              />
              <Radar
                dataKey="score"
                stroke="oklch(0.62 0.19 160)"
                fill="oklch(0.62 0.19 160)"
                fillOpacity={0.35}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  sub?: string | undefined;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5 text-primary" />
        {label}
      </div>
      <div className="mt-2 font-display text-2xl font-bold tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function FactRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}

function scalarText(value: unknown): string | null {
  if (value == null) return null;
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  const trimmed = text.trim();
  return trimmed ? trimmed : null;
}

function entryField(item: unknown, keys: string[]): string | null {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    const record = item as Record<string, unknown>;
    for (const key of keys) {
      const text = scalarText(record[key]);
      if (text) return text;
    }
  }
  return null;
}

function fallbackEntryText(item: unknown): string | null {
  if (Array.isArray(item)) {
    const parts = item.map((v) => scalarText(v)).filter(Boolean) as string[];
    return parts.length ? parts.join(", ") : null;
  }
  if (item && typeof item === "object") {
    for (const value of Object.values(item as Record<string, unknown>)) {
      const text = scalarText(value);
      if (text) return text;
    }
    return null;
  }
  return scalarText(item);
}

type EntryKind = "project" | "internship";

// Which keys of a free-form project/internship entry are worth showing, in
// order: heading, subheading, body. Entries can be plain strings too.
const ENTRY_KEYS: Record<EntryKind, [string[], string[], string[]]> = {
  project: [
    ["title", "name", "project"],
    ["tech", "stack", "description"],
    ["description", "link", "url"],
  ],
  internship: [
    ["company", "role", "org", "title"],
    ["role", "position", "duration"],
    ["period", "duration", "description", "summary"],
  ],
};

function EntryCards({ items, kind }: { items: unknown[]; kind: EntryKind }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing added yet.</p>;
  }
  const [headingKeys, subKeys, bodyKeys] = ENTRY_KEYS[kind];
  return (
    <div className="space-y-2.5">
      {items.map((item, index) => {
        const heading = entryField(item, headingKeys) ?? fallbackEntryText(item);
        const sub = entryField(item, subKeys);
        const body = entryField(item, bodyKeys);
        return (
          <div key={index} className="rounded-xl border border-border/70 bg-card/40 px-4 py-3">
            <p className="text-sm font-semibold text-foreground">{heading ?? "—"}</p>
            {sub && sub !== heading && (
              <p className="mt-0.5 text-[13px] text-muted-foreground">{sub}</p>
            )}
            {body && body !== sub && body !== heading && (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground/80">{body}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ExperienceSection({
  icon: Icon,
  title: sectionTitle,
  children,
}: {
  icon: typeof Award;
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5 text-primary" />
        {sectionTitle}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function CertificationChips({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing added yet.</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, index) => (
        <Badge key={`${item}-${index}`} variant="secondary" className="gap-1">
          <BadgeCheck className="size-3" />
          {item}
        </Badge>
      ))}
    </div>
  );
}

function StudentDetailPage() {
  const navigate = useNavigate();
  const { studentId } = Route.useParams();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [student, setStudent] = useState<LeaderboardStudent | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const current = await me();
        if (cancelled) return;
        if (!current) {
          void navigate({ to: "/candidate/auth", search: { mode: "login" }, replace: true });
          return;
        }
        const board = await getReadinessLeaderboard();
        if (cancelled) return;
        const found = (board.students ?? []).find((s) => s.id === studentId) ?? null;
        if (cancelled) return;
        setStudent(found);
        setStatus("ready");
      } catch (err) {
        if (!cancelled) {
          setErrorMessage(err instanceof Error ? err.message : null);
          setStatus("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, studentId]);

  useEffect(() => {
    if (student) {
      document.title = `${student.full_name || "Candidate"} | TalentBro`;
    }
  }, [student]);

  if (status === "loading") return <GateLoading audience="staff" />;
  if (status === "error")
    return (
      <GateError
        message={errorMessage}
        onRetry={() => void navigate({ to: "/student-detail/$studentId", params: { studentId } })}
      />
    );

  if (!student) {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <GridBackdrop />
        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 text-center">
          <User className="size-10 text-muted-foreground" />
          <h1 className="mt-4 text-lg font-semibold">Candidate not found</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This student isn&apos;t on the readiness board. They may not have started training yet.
          </p>
          <Link
            to="/candidate/leaderboard"
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <ArrowLeft className="size-4" /> Back to leaderboard
          </Link>
        </div>
      </div>
    );
  }

  const perf = student.performance;
  const pillars: Array<[string, number | null, string]> = [
    [
      "Mock Interviews",
      perf?.mock_interview ?? null,
      student.pillars?.mock_interview?.rank != null
        ? `Rank #${student.pillars.mock_interview.rank} of ${student.pillars.mock_interview.total} mock-scored students · ${perf?.mock_interviews ?? 0} interviews`
        : `${perf?.mock_interviews ?? 0} interviews · not ranked`,
    ],
    [
      "Self-Training",
      perf?.self_training ?? null,
      student.pillars?.self_training?.rank != null
        ? `Rank #${student.pillars.self_training.rank} of ${student.pillars.self_training.total} trained students · ${perf?.modules.length ?? 0} skill modules`
        : `${perf?.modules.length ?? 0} skill modules · not ranked`,
    ],
    [
      "TalentBro Chat",
      perf?.chat ?? null,
      `${perf?.chat_messages ?? 0} messages · ${perf?.chat_sessions ?? 0} sessions`,
    ],
  ];
  const deptBadge = [student.department, student.program].filter(Boolean).join(" · ");
  const ctc = fmtCtc(student.expected_ctc);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <GridBackdrop />
      <AppNavHeader
        sticky
        left={
          <div className="flex min-w-0 items-center gap-2.5">
            <AppNavIconButton
              label="Back to Leaderboard"
              onClick={() => void navigate({ to: "/candidate/leaderboard" })}
            >
              <ArrowLeft className="size-4" />
            </AppNavIconButton>
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-foreground text-background">
              <User className="size-4" />
            </span>
            <span className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">
                {student.full_name || "Candidate"}
              </p>
            </span>
          </div>
        }
        actions={
          !student.is_self ? (
            <button
              type="button"
              onClick={() =>
                void navigate({
                  to: "/candidate/student-message",
                  search: { peer: student.id },
                })
              }
              aria-label="Message this candidate"
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground transition-all hover:bg-primary/90"
            >
              <MessageCircle className="size-4" />
              <span className="hidden sm:inline">Chat</span>
            </button>
          ) : null
        }
      />
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <Card className="overflow-hidden rounded-2xl border-border">
          <CardContent className="p-6 sm:p-8">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                <div className="flex items-start gap-4">
                  <Avatar className="size-16 rounded-2xl sm:size-20">
                  {student.avatar ? (
                    <AvatarImage
                      src={student.avatar}
                      alt={student.full_name || "Candidate"}
                      className="rounded-2xl object-cover"
                    />
                  ) : null}
                  <AvatarFallback className="rounded-2xl bg-primary font-display text-xl font-bold text-primary-foreground">
                    {initialsOf(student.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-2xl font-bold sm:text-3xl">
                    {student.full_name || "Candidate"}
                  </h1>
                  {deptBadge && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Building2 className="size-3.5" /> {deptBadge}
                    </div>
                  )}
                  {student.bio && (
                    <p className="mt-2 max-w-lg text-sm font-semibold text-muted-foreground">
                      {student.bio}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {student.cgpa != null && (
                      <Badge variant="secondary" className="gap-1">
                        <GraduationCap className="size-3" /> CGPA {student.cgpa}
                      </Badge>
                    )}
                    {student.start_year && (
                      <Badge variant="outline" className="gap-1">
                        <Calendar className="size-3" />
                        {student.start_year}–{student.end_year ?? ""}
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={cn(
                        "gap-1 capitalize",
                        student.placement_status === "placed" &&
                          "border-emerald-500/50 text-emerald-600 dark:text-emerald-400",
                      )}
                    >
                      <BadgeCheck className="size-3" />
                      {PLACEMENT_LABELS[student.placement_status] ?? student.placement_status}
                    </Badge>
                    {student.placement_eligible && (
                      <Badge variant="outline" className="gap-1">
                        <Target className="size-3" />
                        Placement eligible
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="w-full md:w-auto md:ml-auto">
                <div className="rounded-2xl bg-emerald-500/10 px-6 py-4 text-center border border-emerald-500/30 w-full md:min-w-[180px]">
                  <div className="text-xs uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Readiness</div>
                  <div className="mt-1 font-display text-3xl sm:text-4xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                    {student.performance_score != null ? student.performance_score.toFixed(1) : "—"}
                    <span className="text-lg text-emerald-600/70 dark:text-emerald-400/70">/100</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            icon={Award}
            label="AIR"
            value={student.overall_rank != null ? `#${student.overall_rank}` : "—"}
            sub={student.overall_total > 0 ? `of ${student.overall_total} students` : undefined}
          />
          <StatTile
            icon={TrendingUp}
            label="Dept rank"
            value={student.department_rank != null ? `#${student.department_rank}` : "—"}
            sub={
              student.department_total > 0 ? `of ${student.department_total} students` : undefined
            }
          />
          <StatTile
            icon={Target}
            label="Training signals"
            value={String(
              (perf?.mock_interviews ?? 0) +
                (perf?.modules?.length ?? 0) +
                (perf?.chat_sessions ?? 0),
            )}
            sub={
              perf
                ? `${perf.modules.length} modules · ${perf.mock_interviews} interviews`
                : "Not training yet"
            }
          />
          <StatTile
            icon={IndianRupee}
            label="Expected CTC"
            value={ctc ?? "—"}
            sub={student.placement_status === "placed" ? "Placed" : undefined}
          />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <SkillRadar perf={perf} />
          </div>
          <Card className="rounded-2xl border-border lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="size-4 text-primary" /> Readiness Breakdown
              </CardTitle>
              <p className="text-xs text-muted-foreground">How this readiness score is built up</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {perf ? (
                pillars.map(([label, score, detail]) => (
                  <DetailBar
                    key={label}
                    label={label}
                    score={score}
                    detail={detail}
                    tone={label === "Self-Training" ? "primary" : "emerald"}
                  />
                ))
              ) : (
                <p className="py-4 text-sm text-muted-foreground">
                  No readiness signals yet — this student hasn&apos;t started training.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card className="rounded-2xl border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Briefcase className="size-4 text-primary" /> Experience & Credentials
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Certifications, projects and internships this candidate has added
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <ExperienceSection icon={Award} title="Certifications">
                <CertificationChips items={student.certifications} />
              </ExperienceSection>
              <ExperienceSection icon={FolderGit2} title="Projects">
                <EntryCards items={student.projects} kind="project" />
              </ExperienceSection>
              <ExperienceSection icon={Briefcase} title="Internships">
                <EntryCards items={student.internships} kind="internship" />
              </ExperienceSection>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="size-4 text-primary" /> Profile Facts
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              {student.cgpa != null && <FactRow label="CGPA" value={student.cgpa} />}
              {student.start_year && (
                <FactRow label="Batch" value={`${student.start_year}–${student.end_year ?? "—"}`} />
              )}
              {student.gender && <FactRow label="Gender" value={student.gender} />}
              {student.mobile_number && <FactRow label="Mobile" value={student.mobile_number} />}
              <div className="py-2.5">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Skills</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {student.skills.length > 0 ? (
                    student.skills.map((s) => (
                      <Badge key={s} variant="secondary">
                        {s}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </div>
              </div>
              <div className="py-2.5">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Preferred roles
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {student.preferred_roles.length > 0 ? (
                    student.preferred_roles.map((r) => (
                      <Badge key={r} variant="outline">
                        {r}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </div>
              </div>
              {student.preferred_language && (
                <FactRow
                  label="Preferred language"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <Languages className="size-3.5 text-muted-foreground" />
                      {student.preferred_language}
                    </span>
                  }
                />
              )}
              {ctc && <FactRow label="Expected CTC" value={ctc} />}
              <div className="py-2.5">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Extracurricular activities
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {student.extracurricular_activities.length > 0 ? (
                    student.extracurricular_activities.map((a) => (
                      <Badge key={a} variant="outline">
                        {a}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <Mail className="size-3" /> Have a question about this candidate? Use the chat bubble to
          send them a message.
        </p>
      </div>
    </div>
  );
}
