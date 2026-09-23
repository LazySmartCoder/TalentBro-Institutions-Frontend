import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Clock3,
  History,
  ListChecks,
  MessagesSquare,
  Play,
  Target,
  Users,
} from "lucide-react";
import { AppNavHeader } from "@/components/tb/app-nav";
import { me, type AuthUser } from "@/lib/api";
import { GateLoading, GateError } from "@/components/load-state";

const title = "TalentBro | Group Discussion Training";
const description =
  "Practice structured group discussions on current affairs with AI panelists and sharpen your confidence, reasoning and teamwork.";

export const Route = createFileRoute("/gd-training")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: GdTrainingPage,
});

const INSTRUCTIONS = [
  {
    icon: Target,
    title: "One random topic",
    body: "Each round hands you a single current-affairs topic picked at random. No preparation — build, present and defend your points on the spot.",
  },
  {
    icon: Users,
    title: "AI panel & moderator",
    body: "Discuss with six AI panelists, moderated by an AI moderator. Everyone gets a fair turn, including you.",
  },
  {
    icon: MessagesSquare,
    title: "Make your points count",
    body: "State a clear stance, back it with reasons and examples, build on others' points, and respectfully challenge weak arguments.",
  },
  {
    icon: ListChecks,
    title: "Judged on 8 dimensions",
    body: "Content quality, reasoning, communication, confidence, teamwork, initiative, active listening, and build / challenge.",
  },
  {
    icon: Clock3,
    title: "Up to 15 minutes",
    body: "A round runs for 15 minutes or until you end it early. You'll get a full scorecard the moment the discussion closes.",
  },
];

function GdTrainingPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
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
        setUser(current);
        if (!cancelled) setStatus("ready");
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

  if (status === "loading") return <GateLoading />;

  if (status === "error" || !user) return <GateError message={errorMessage} />;

  return (
    <div className="min-h-svh bg-background text-foreground">
      <AppNavHeader
        current="self-training"
        sticky
        left={
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => void navigate({ to: "/self-training", replace: true })}
              className="grid size-8 cursor-pointer place-items-center rounded-md border border-border/60 bg-background/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Back to Self Training"
            >
              <ArrowLeft className="size-4" />
            </button>
            <span className="grid size-9 place-items-center rounded-lg bg-foreground text-background">
              <Users className="size-4" />
            </span>
            <span>
              <p className="text-sm font-semibold leading-tight">Group Discussion</p>
            </span>
          </div>
        }
      />

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-8 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Group discussion · practice round
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            How your round works.
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
            Read the rules, then hit begin. You'll drop into a live discussion with AI panelists and
            get scored the moment it ends.
          </p>
        </div>

        <div className="space-y-3">
          {INSTRUCTIONS.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.title}
                className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-foreground">
                  <Icon className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold tracking-tight">{step.title}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => void navigate({ to: "/gd-room" })}
          className="group mt-8 flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl border border-foreground bg-foreground px-6 py-4 text-sm font-semibold uppercase tracking-[0.18em] text-background transition-all hover:shadow-lg"
        >
          <Play className="size-4 transition-transform group-hover:translate-x-0.5" />
          Begin
        </button>

        <button
          type="button"
          onClick={() => void navigate({ to: "/gd-history" })}
          className="group mt-3 flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl border border-border bg-card px-6 py-4 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground transition-all hover:border-foreground/40 hover:text-foreground"
        >
          <History className="size-4 transition-transform group-hover:-rotate-12" />
          History
        </button>

        <p className="mt-3 text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          AI-powered practice · Your analysis is being stored
        </p>
      </main>
    </div>
  );
}
