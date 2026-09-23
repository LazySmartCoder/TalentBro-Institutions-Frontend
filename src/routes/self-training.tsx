import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Binary,
  BrainCircuit,
  Calculator,
  Code2,
  Compass,
  Dumbbell,
  Languages,
  MessageSquare,
  Users,
  ArrowRight,
} from "lucide-react";
import { AppNavHeader } from "@/components/tb/app-nav";
import { me, type AuthUser } from "@/lib/api";
import { GateLoading, GateError, QuoteSplash } from "@/components/load-state";

const title = "TalentBro | Self Training";
const description =
  "Practice on your own with skill cards covering communication, aptitude, mathematics, English writing, and problem solving.";

export const Route = createFileRoute("/self-training")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: SelfTrainingPage,
});

function LoadingScreen() {
  return <GateLoading />;
}

function ErrorScreen({ message }: { message?: string | null }) {
  return <GateError message={message} />;
}

type TrainingCard = {
  id: string;
  icon: typeof MessageSquare;
  title: string;
  description: string;
  iconBg: string;
  iconColor: string;
  to?: string;
};

const CARDS: TrainingCard[] = [
  {
    id: "communication",
    icon: MessageSquare,
    title: "Communication Skills",
    description:
      "Sharpen how you speak, listen and express yourself. Perfect for HR rounds, group discussions and everyday confidence.",
    iconBg: "bg-sky-500/15",
    iconColor: "text-sky-500",
    to: "/communication-training",
  },
  {
    id: "group-discussion",
    icon: Users,
    title: "Group Discussion",
    description:
      "Discuss current affairs with AI panelists and sharpen your confidence, reasoning, teamwork and fair-share airtime.",
    iconBg: "bg-orange-500/15",
    iconColor: "text-orange-500",
    to: "/gd-training",
  },
  {
    id: "aptitude",
    icon: BrainCircuit,
    title: "Aptitude & Logical Reasoning",
    description:
      "Practice the quantitative, verbal and logical patterns that appear in almost every campus placement written test.",
    iconBg: "bg-violet-500/15",
    iconColor: "text-violet-500",
    to: "/aplr-training",
  },
  {
    id: "basic-maths",
    icon: Calculator,
    title: "Mathematics",
    description:
      "Build speed and accuracy with arithmetic, percentages, ratios, averages and mental calculation drills.",
    iconBg: "bg-emerald-500/15",
    iconColor: "text-emerald-500",
    to: "/basic-math-training",
  },

  {
    id: "english-trainer",
    icon: Languages,
    title: "English Trainer",
    description:
      "Write professional emails, messages and letters with Maya, get focused corrections on grammar, tone and structure, and track a running score.",
    iconBg: "bg-amber-500/15",
    iconColor: "text-amber-500",
    to: "/english-training",
  },
  {
    id: "situational",
    icon: Compass,
    title: "Situational Problem Solving Skills (Management)",
    description:
      "Work through real workplace scenarios, team conflicts and leadership dilemmas to build management judgement.",
    iconBg: "bg-rose-500/15",
    iconColor: "text-rose-500",
    to: "/situational-training",
  },
  {
    id: "technical",
    icon: Code2,
    title: "Problem Solving Skills (Technical)",
    description:
      "Solve coding and technical puzzles, debug real scenarios and build the logic recruiters test in technical rounds.",
    iconBg: "bg-teal-500/15",
    iconColor: "text-teal-500",
    to: "/technical-training",
  },
  {
    id: "dsa",
    icon: Binary,
    title: "DSA (Data Structure & Algorithms)",
    description:
      "Master arrays, linked lists, trees, graphs, sorting and searching — the core patterns asked in every coding interview.",
    iconBg: "bg-cyan-500/15",
    iconColor: "text-cyan-500",
    to: "/dsa-training",
  },
];

function SelfTrainingPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingNav, setPendingNav] = useState<string | null>(null);

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

  if (status === "loading") return <LoadingScreen />;

  if (status === "error" || !user) return <ErrorScreen message={errorMessage} />;

  // Group Discussion gets a short motivation-quote splash before the rules page.
  if (pendingNav) {
    return (
      <QuoteSplash
        onDone={() => {
          const to = pendingNav;
          setPendingNav(null);
          void navigate({ to });
        }}
      />
    );
  }

  return (
    <div className="min-h-svh bg-background text-foreground">
      <AppNavHeader
        current="self-training"
        sticky
        left={
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => void navigate({ to: "/chat", replace: true })}
              className="grid size-8 cursor-pointer place-items-center rounded-md border border-border/60 bg-background/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Back to Home"
            >
              <ArrowLeft className="size-4" />
            </button>
            <span className="grid size-9 place-items-center rounded-lg bg-foreground text-background">
              <Dumbbell className="size-4" />
            </span>
            <span>
              <p className="text-sm font-semibold leading-tight">Self Training</p>
            </span>
          </div>
        }
      />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-8 max-w-2xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Practice on your own
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Train yourself, at your pace.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Pick a skill area and start practicing. Each card focuses on a core placement skill so
            you can build the base recruiters look for — one session at a time.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => {
                  if (!card.to) return;
                  if (card.id === "group-discussion") {
                    setPendingNav(card.to);
                    return;
                  }
                  void navigate({ to: card.to });
                }}
                className="group flex cursor-pointer flex-col items-start gap-4 rounded-2xl border border-border bg-card p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-foreground/40 hover:shadow-lg"
              >
                <span
                  className={`grid size-12 place-items-center rounded-xl ${card.iconBg} ${card.iconColor}`}
                >
                  <Icon className="size-6" />
                </span>
                <span>
                  <span className="flex items-center gap-2 text-base font-semibold tracking-tight">
                    {card.title}
                    <ArrowRight className="size-4 text-muted-foreground transition-transform duration-300 group-hover:translate-x-1 group-hover:text-foreground" />
                  </span>
                  <span className="mt-2 block text-[13px] leading-relaxed text-muted-foreground">
                    {card.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
