import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Binary,
  BrainCircuit,
  BriefcaseBusiness,
  CalendarDays,
  Calculator,
  CheckCircle2,
  Clock,
  Code2,
  Compass,
  Flag,
  Languages,
  MapPin,
  MessageSquare,
  Route as RouteIcon,
  Swords,
  Target,
  Trophy,
  Zap,
} from "lucide-react";
import { AppNavHeader } from "@/components/tb/app-nav";
import { GateError, GateLoading } from "@/components/load-state";
import { me, getCandidateRoadmap, type AuthUser, type CandidateRoadmap } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";

const title = "TalentBro | Roadmap Drill";
const description =
  "Your personalised placement-preparation route — milestones, daily drills, mock battles and the whole roadmap the AI built for you.";

export const Route = createFileRoute("/roadmap-drill")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: RoadmapDrillPage,
});

const MODULE_META: {
  id: string;
  label: string;
  icon: typeof MessageSquare;
  iconBg: string;
  iconColor: string;
}[] = [
  {
    id: "communication",
    label: "Communication",
    icon: MessageSquare,
    iconBg: "bg-sky-500/15",
    iconColor: "text-sky-500",
  },
  {
    id: "english",
    label: "English Writing",
    icon: Languages,
    iconBg: "bg-amber-500/15",
    iconColor: "text-amber-500",
  },
  {
    id: "aplr",
    label: "Aptitude & Reasoning",
    icon: BrainCircuit,
    iconBg: "bg-violet-500/15",
    iconColor: "text-violet-500",
  },
  {
    id: "basic_math",
    label: "Mathematics",
    icon: Calculator,
    iconBg: "bg-emerald-500/15",
    iconColor: "text-emerald-500",
  },
  {
    id: "situational",
    label: "Situational",
    icon: Compass,
    iconBg: "bg-rose-500/15",
    iconColor: "text-rose-500",
  },
  {
    id: "technical",
    label: "Technical",
    icon: Code2,
    iconBg: "bg-teal-500/15",
    iconColor: "text-teal-500",
  },
  {
    id: "dsa",
    label: "DSA",
    icon: Binary,
    iconBg: "bg-cyan-500/15",
    iconColor: "text-cyan-500",
  },
  {
    id: "mock_interview",
    label: "Mock Interview",
    icon: Swords,
    iconBg: "bg-orange-500/15",
    iconColor: "text-orange-500",
  },
];

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

type RoadmapPhase = {
  period?: string;
  focus?: string;
  modules?: string[];
  goals?: string[];
};

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function LoadingScreen() {
  return <GateLoading />;
}

function ErrorScreen({ message }: { message?: string | null }) {
  return <GateError message={message} />;
}

function RoadmapDrillPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [roadmap, setRoadmap] = useState<CandidateRoadmap | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "empty">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
        const found = await getCandidateRoadmap().catch((err: unknown) => {
          if (!cancelled) {
            setErrorMessage(err instanceof Error ? err.message : null);
            setStatus("error");
          }
          return null;
        });
        if (cancelled) return;
        setUser(current);
        if (found) {
          setRoadmap(found);
          setStatus("ready");
        } else {
          setStatus("empty");
        }
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
  }, [navigate]);

  if (status === "loading") return <LoadingScreen />;
  if (status === "error") return <ErrorScreen message={errorMessage} />;

  if (status === "empty" || !roadmap) {
    return (
      <div className="min-h-svh bg-background text-foreground">
        <AppNavHeader current="chat" left={<BackButton />} />
        <main className="mx-auto grid min-h-[60svh] max-w-xl place-items-center px-4 py-16 text-center">
          <div className="space-y-5">
            <span className="mx-auto grid size-16 place-items-center rounded-2xl border border-dashed border-border bg-card text-muted-foreground">
              <RouteIcon className="size-8" />
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">No route built yet</h1>
            <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
              Tell the AI coach about your placement goals — target companies, the month you want to
              be ready by, and how much time you can practice. Once a roadmap exists, it will show
              up here as your personal drill route.
            </p>
            <button
              type="button"
              onClick={() =>
                void navigate({
                  to: "/chat",
                  search: {
                    prompt:
                      "Help me develop a comprehensive preparation roadmap and plan for my placement goals.",
                  },
                })
              }
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-transform hover:translate-y-[-1px]"
            >
              <Zap className="size-4" /> Start a roadmap chat
            </button>
          </div>
        </main>
      </div>
    );
  }

  const phases: RoadmapPhase[] = Array.isArray(roadmap.roadmap?.phases)
    ? (roadmap.roadmap.phases as RoadmapPhase[])
    : [];
  const schedule = roadmap.roadmap?.weekly_schedule as Record<string, string[]> | undefined;

  const statCards = [
    {
      label: "Target companies",
      value: roadmap.company_target.length > 0 ? String(roadmap.company_target.length) : "Any",
      sub: roadmap.company_target.join(", ") || "Yet to be decided",
      icon: Target,
      accent: "text-emerald-500",
    },
    {
      label: "Mock battles",
      value: String(roadmap.mocks_required),
      sub: "full-length mocks until you're ready",
      icon: Swords,
      accent: "text-orange-500",
    },
    {
      label: "Daily grind",
      value: `${roadmap.daily_practice_session_duration} min`,
      sub: "focused practice every single day",
      icon: Clock,
      accent: "text-sky-500",
    },
    {
      label: "Ready by",
      value: fmtDate(roadmap.target_date) || "Target month",
      sub: roadmap.timeline_target || "As soon as possible",
      icon: CalendarDays,
      accent: "text-violet-500",
    },
  ];

  const requiredCount = Object.values(roadmap.self_training_required).filter(
    (m) => m?.required,
  ).length;

  return (
    <div className="min-h-svh bg-background text-foreground">
      <AppNavHeader current="chat" left={<BackButton />} />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-3xl border border-border bg-card">
          <div
            className={cn(
              "pointer-events-none absolute -right-24 -top-24 size-72 rounded-full blur-3xl",
              theme === "dark" ? "bg-primary/15" : "bg-primary/10",
            )}
          />
          <div className="pointer-events-none absolute -left-20 bottom-0 size-64 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="relative flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.2em] text-foreground/70 uppercase">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
                Active Roadmap · updated {fmtDate(roadmap.updated_at)}
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Your placement route
              </h1>
              {roadmap.goal_statement ? (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-foreground">Mission: </span>
                  {roadmap.goal_statement}
                </p>
              ) : null}
              {roadmap.summary ? (
                <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
                  {roadmap.summary}
                </p>
              ) : null}
            </div>
            <div>
              <button
                type="button"
                onClick={() =>
                  void navigate({
                    to: "/chat",
                    search: {
                      prompt: `Refine my placement roadmap. I want to be ${roadmap.timeline_target || "placement ready"}.`,
                    },
                  })
                }
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background/70 px-4 py-2.5 text-sm font-semibold transition-colors hover:border-foreground/40 hover:bg-muted"
              >
                <RouteIcon className="size-4" /> Refine with AI
              </button>
            </div>
          </div>
        </section>

        {/* Stat strip */}
        <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-foreground/30"
              >
                <span
                  className={cn(
                    "grid size-11 shrink-0 place-items-center rounded-xl bg-muted",
                    card.accent,
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-lg font-semibold leading-tight">
                    {card.value}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {card.label}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground/70">
                    {card.sub}
                  </span>
                </span>
              </div>
            );
          })}
        </section>

        {/* Phase hint */}
        {phases.length > 0 ? (
          <section className="mt-10">
            <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
              <MapPin className="size-3.5" /> The road ahead
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Drive through each milestone
            </h2>
          </section>
        ) : null}

        {/* The Road */}
        {phases.length > 0 ? (
          <section className="relative mt-6">
            <svg
              className="pointer-events-none absolute left-1/2 top-0 h-full w-[420px] -translate-x-1/2 max-w-full"
              viewBox="0 0 420 1000"
              preserveAspectRatio="none"
              aria-hidden
            >
              <path
                d="M60 0 C 380 120, 40 260, 60 400 C 380 540, 40 680, 60 820 C 200 900, 340 940, 380 1000"
                fill="none"
                stroke="currentColor"
                strokeWidth="26"
                strokeLinecap="round"
                className="text-border/70"
              />
              <path
                d="M60 0 C 380 120, 40 260, 60 400 C 380 540, 40 680, 60 820 C 200 900, 340 940, 380 1000"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray="10 14"
                strokeLinecap="round"
                className="text-foreground/20 animate-dash"
              />
            </svg>

            <div className="relative space-y-10">
              <div className="flex justify-center">
                <span className="grid size-12 place-items-center rounded-full border border-emerald-500/40 bg-emerald-500/15 text-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.35)]">
                  <Flag className="size-5" />
                </span>
              </div>
              {phases.map((phase, i) => {
                const left = i % 2 === 0;
                return (
                  <div
                    key={`${phase.period ?? "phase"}-${i}`}
                    className="grid grid-cols-[1fr_48px_1fr] items-start gap-3 sm:gap-6"
                  >
                    <div className={cn("sm:py-2", left ? "col-start-1" : "col-start-3")}>
                      <article
                        className={cn(
                          "group rounded-2xl border border-border bg-card p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:border-foreground/40 hover:shadow-lg",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                            Milestone {i + 1}
                          </span>
                          <span className="rounded-full border border-foreground/15 bg-muted px-2 py-0.5 font-mono text-[10px] font-semibold text-foreground/80">
                            {phase.period || "Phase"}
                          </span>
                        </div>
                        <h3 className="mt-2 text-base font-semibold tracking-tight">
                          {phase.focus || "Keep pushing"}
                        </h3>
                        {Array.isArray(phase.modules) && phase.modules.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {phase.modules.map((m) => (
                              <span
                                key={m}
                                className="rounded-md border border-border bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground"
                              >
                                {m}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {Array.isArray(phase.goals) && phase.goals.length > 0 ? (
                          <ul className="mt-3 space-y-1.5">
                            {phase.goals.slice(0, 4).map((goal) => (
                              <li
                                key={goal}
                                className="flex items-start gap-2 text-[13px] leading-relaxed text-muted-foreground"
                              >
                                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                                {goal}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </article>
                    </div>
                    <div className="relative col-start-2 flex h-full justify-center">
                      <span className="absolute top-0 bottom-0 w-0.5 bg-gradient-to-b from-border/0 via-border to-border/0" />
                      <span
                        className={cn(
                          "relative z-10 mt-6 size-4 rounded-full border-2 border-background shadow-[0_0_18px_rgba(139,92,246,0.6)]",
                          left ? "bg-violet-500" : "bg-fuchsia-500",
                        )}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="flex justify-center">
                <span className="grid size-12 place-items-center rounded-full border border-amber-400/40 bg-amber-500/15 text-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.35)]">
                  <Trophy className="size-5" />
                </span>
              </div>
            </div>
          </section>
        ) : null}

        {/* Power-ups: self-training */}
        <section className="mt-12">
          <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
            <Zap className="size-3.5" /> Training loadout
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            {requiredCount > 0
              ? `${requiredCount} modules to drill weekly`
              : "No weekly drills assigned"}
          </h2>
          {requiredCount === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Ask the AI coach in chat to break down your weekly practice into modules.
            </p>
          ) : null}
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {MODULE_META.map((module) => {
              const Icon = module.icon;
              const entry = roadmap.self_training_required?.[module.id];
              const required = Boolean(entry?.required);
              const sessions = Number(entry?.sessions_per_week) || 0;
              if (
                !required &&
                sessions === 0 &&
                !(Array.isArray(entry?.focus_areas) && entry!.focus_areas!.length > 0)
              ) {
                return null;
              }
              const focusAreas = Array.isArray(entry?.focus_areas) ? entry!.focus_areas! : [];
              return (
                <article
                  key={module.id}
                  className="rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:-translate-y-1 hover:border-foreground/40 hover:shadow-lg"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "grid size-10 place-items-center rounded-xl",
                        module.iconBg,
                        module.iconColor,
                      )}
                    >
                      <Icon className="size-5" />
                    </span>
                    {required ? (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wide text-emerald-500 uppercase">
                        Required
                      </span>
                    ) : (
                      <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                        Backup
                      </span>
                    )}
                  </div>
                  <h3 className="mt-3 text-sm font-semibold tracking-tight">{module.label}</h3>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {sessions > 0
                      ? `${sessions} session${sessions > 1 ? "s" : ""}/week`
                      : "focus only"}
                  </p>
                  {focusAreas.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {focusAreas.slice(0, 4).map((area) => (
                        <span
                          key={area}
                          className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {area}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        {/* Weekly schedule */}
        {schedule &&
        WEEKDAYS.some((day) => Array.isArray(schedule[day]) && schedule[day].length > 0) ? (
          <section className="mt-12">
            <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
              <CalendarDays className="size-3.5" /> Race week
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Your weekly schedule</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {WEEKDAYS.map((day) => {
                const items = Array.isArray(schedule[day]) ? schedule[day] : [];
                if (items.length === 0) return null;
                return (
                  <article
                    key={day}
                    className="rounded-2xl border border-border bg-card p-4 transition-colors hover:border-foreground/30"
                  >
                    <p className="font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
                      {day}
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {items.slice(0, 5).map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-1.5 text-[12px] leading-relaxed text-foreground/80"
                        >
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-foreground/40" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Footer CTA */}
        <section className="mt-12 rounded-2xl border border-dashed border-border p-6 text-center">
          <BriefcaseBusiness className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">This route updates as you talk to the AI coach</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-muted-foreground">
            Every roadmap chat refines this plan in place — tell the coach about new targets, new
            companies, or a shifted timeline and it re-routes your road.
          </p>
        </section>
      </main>
    </div>
  );
}

function BackButton() {
  const navigate = useNavigate();
  return (
    <div className="flex items-center gap-2.5">
      <button
        type="button"
        onClick={() => void navigate({ to: "/chat", replace: true })}
        className="grid size-8 cursor-pointer place-items-center rounded-md border border-border/60 bg-background/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Back to Chat"
      >
        <ArrowLeft className="size-4" />
      </button>
      <span className="grid size-9 place-items-center rounded-lg bg-foreground text-background">
        <RouteIcon className="size-4" />
      </span>
      <span>
        <p className="text-sm font-semibold leading-tight">Roadmap Drill</p>
      </span>
    </div>
  );
}
