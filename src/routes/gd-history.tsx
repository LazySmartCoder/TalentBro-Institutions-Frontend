import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  CalendarClock,
  ChevronRight,
  History,
  Loader2,
  MessageCircle,
  Users,
} from "lucide-react";
import { AppNavHeader } from "@/components/tb/app-nav";
import { me, gdList, type AuthUser, type GdTrainingRecord } from "@/lib/api";
import { GateLoading, GateError } from "@/components/load-state";
import { cn } from "@/lib/utils";

const title = "TalentBro | Group Discussion History";
const description =
  "Review every group discussion round you've practised — the topic, your scores, strengths and what to work on next.";

export const Route = createFileRoute("/gd-history")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: GdHistoryPage,
});

function gradeTone(grade: string): string {
  const g = (grade || "").toLowerCase();
  if (g.includes("excellent")) return "text-emerald-500";
  if (g.includes("good")) return "text-sky-500";
  if (g.includes("aver")) return "text-amber-500";
  return "text-rose-500";
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

function RoundCard({ round }: { round: GdTrainingRecord }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => void navigate({ to: "/gd-report/$gdId", params: { gdId: round.id } })}
      className="group flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-border bg-card p-5 text-left transition-all hover:border-foreground/40 hover:shadow-lg"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-snug tracking-tight">{round.topic}</p>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CalendarClock className="size-3.5" />
            {formatDate(round.created_at)}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="size-3.5" />
            {round.message_count} lines
          </span>
          {round.overall_score > 0 && (
            <span
              className={cn(
                "font-mono text-[11px] uppercase tracking-widest",
                gradeTone(round.grade),
              )}
            >
              {round.grade || "—"} · {round.overall_score}/100
            </span>
          )}
        </p>
      </div>
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:bg-foreground group-hover:text-background">
        <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}

function GdHistoryPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    data: rounds = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["gd-history"],
    queryFn: gdList,
    staleTime: 30_000,
  });

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
              onClick={() => void navigate({ to: "/gd-training", replace: true })}
              className="grid size-8 cursor-pointer place-items-center rounded-md border border-border/60 bg-background/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Back to Group Discussion"
            >
              <ArrowLeft className="size-4" />
            </button>
            <span className="grid size-9 place-items-center rounded-lg bg-foreground text-background">
              <Users className="size-4" />
            </span>
            <span>
              <p className="text-sm font-semibold leading-tight">Group Discussion History</p>
            </span>
          </div>
        }
      />

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-8 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Your past rounds
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Your GD history.
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
            Every round you've practised is saved here. Tap one to open its graphical report with
            your engagement, scores and improvement tips.
          </p>
        </div>

        {isLoading &&
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="mb-4 h-24 animate-pulse rounded-2xl border border-border bg-muted/50"
            />
          ))}

        {isError && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card/40 px-6 py-16 text-center">
            <BarChart3 className="size-10 text-muted-foreground" />
            <h2 className="mt-4 text-lg font-semibold">Couldn't load your history</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Make sure you're signed in and try again.
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <Loader2 className="size-4" /> Try Again
            </button>
          </div>
        )}

        {!isLoading && !isError && rounds.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card/40 px-6 py-16 text-center">
            <History className="size-10 text-muted-foreground" />
            <h2 className="mt-4 text-lg font-semibold">No rounds yet</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Finish your first group discussion and it will show up here with a full graphical
              report.
            </p>
            <button
              type="button"
              onClick={() => void navigate({ to: "/gd-room" })}
              className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Start a round
            </button>
          </div>
        )}

        <div className="space-y-3">
          {rounds.map((round) => (
            <RoundCard key={round.id} round={round} />
          ))}
        </div>
      </main>
    </div>
  );
}
