import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, Fragment, type ReactNode } from "react";
import { ArrowLeft, ArrowUpRight, BookOpen, GraduationCap, PlayCircle } from "lucide-react";

import { AppNavHeader } from "@/components/tb/app-nav";
import { GateError, GateLoading } from "@/components/load-state";
import { courseSegments, me, type AuthUser, type CourseWeaknessSegment } from "@/lib/api";

const title = "TalentBro | Learning";
const description =
  "Pick how you want to learn: personalized video tutorials picked for you, or full courses from top universities and companies.";

export const Route = createFileRoute("/learning")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: LearningPage,
});

type Choice = {
  key: "youtube" | "courses";
  to: "/tutorials" | "/courses";
  title: string;
  blurb: string;
  cta: string;
  icon: ReactNode;
};

const CHOICES: Choice[] = [
  {
    key: "youtube",
    to: "/tutorials",
    title: "YouTube",
    blurb:
      "Short, focused videos picked for you from your recent interviews and conversations, so you can fix one weak spot at a time.",
    cta: "Browse tutorials",
    icon: <PlayCircle className="size-5" />,
  },
  {
    key: "courses",
    to: "/courses",
    title: "Courses",
    blurb:
      "Full-length courses and specialisations from top universities and companies, with real ratings, durations and skills.",
    cta: "Browse courses",
    icon: <BookOpen className="size-5" />,
  },
];

/**
 * The tracked weaknesses, as links rather than buttons: each one carries the
 * search phrase that addresses it, so picking an area carries you straight to
 * the videos/courses for it instead of the generic feed.
 */
function WeakAreaChips({
  segments,
  base,
}: {
  segments: CourseWeaknessSegment[];
  base: "youtube" | "courses";
}) {
  if (segments.length === 0) return null;

  const chipClass =
    "inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted";

  return (
    <div className="w-full border-t border-border pt-4">
      <p className="dash-mono-label">Built from your training</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Your weakest areas, straight from your interview and self-training scores.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {segments.map((segment) => (
          <Fragment key={segment.key}>
            {base === "youtube" ? (
              <Link to="/tutorials" search={{ q: segment.query }} className={chipClass}>
                {segment.label}
                <span className="font-mono text-muted-foreground">{segment.score}%</span>
              </Link>
            ) : (
              <Link to="/courses" search={{ q: segment.query }} className={chipClass}>
                {segment.label}
                <span className="font-mono text-muted-foreground">{segment.score}%</span>
              </Link>
            )}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function LearningPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [segments, setSegments] = useState<CourseWeaknessSegment[]>([]);

  // Candidates only. Institution staff are redirected to their own dashboard.
  useEffect(() => {
    let cancelled = false;
    me()
      .then(async (current) => {
        if (cancelled) return;
        if (!current) {
          void navigate({ to: "/candidate-auth", search: { mode: "login" }, replace: true });
          return;
        }
        if (current.role !== "student") {
          void navigate({ to: "/dashboard", replace: true });
          return;
        }
        if (current.profile_complete === false) {
          void navigate({ to: "/onboarding", replace: true });
          return;
        }
        setUser(current);
        setStatus("ready");
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

  // Weakness tracking is an enhancement, never a gate: if it fails the chooser
  // still works, it just does not show the personalised areas.
  useEffect(() => {
    if (status !== "ready") return;
    let cancelled = false;
    courseSegments()
      .then((result) => {
        if (!cancelled) setSegments(result.segments ?? []);
      })
      .catch(() => {
        // Fall back to the neutral feed links.
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

  if (status === "loading") return <GateLoading />;

  if (status === "error" || !user) return <GateError message={errorMessage} />;

  return (
    <div className="min-h-svh bg-background text-foreground">
      <AppNavHeader
        current="learning"
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
              <GraduationCap className="size-4" />
            </span>
            <span>
              <p className="text-sm font-semibold leading-tight">Learning</p>
            </span>
          </div>
        }
      />

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="mb-8 max-w-2xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Learn your way
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Videos or courses?
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Both options are built from the same thing: the areas you scored lowest on. Pick how you
            want to work through them, or jump straight to one of your weak spots.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {CHOICES.map((choice) => (
            <div
              key={choice.key}
              className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 transition-colors hover:border-foreground/30"
            >
              <span className="grid size-10 place-items-center rounded-lg bg-foreground text-background">
                {choice.icon}
              </span>

              <div>
                <h2 className="text-lg font-semibold">{choice.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {choice.blurb}
                </p>
              </div>

              <Link
                to={choice.to}
                className="inline-flex items-center justify-center gap-1.5 bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-85"
              >
                {choice.cta}
                <ArrowUpRight className="size-3.5" />
              </Link>

              <WeakAreaChips segments={segments} base={choice.key} />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
