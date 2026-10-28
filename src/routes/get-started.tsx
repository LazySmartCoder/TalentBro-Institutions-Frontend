import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Building2, GraduationCap, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Reveal } from "@/components/Reveal";
import { GridField } from "@/components/graphics";
import { GateLoading } from "@/components/load-state";
import { me, type AuthUser } from "@/lib/api";

const title = "TalentBro | Get Started";
const description = "Choose how you'd like to join TalentBro — as an institution or as a student.";

type AuthenticatedDestination =
  "/candidate/onboarding" | "/candidate/chat" | "/client/onboarding" | "/client/chat";

function destinationFor(user: AuthUser): AuthenticatedDestination {
  if (user.role === "student") {
    return user.profile_complete === false ? "/candidate/onboarding" : "/candidate/chat";
  }
  return user.profile_complete === false ? "/client/onboarding" : "/client/chat";
}

export const Route = createFileRoute("/get-started")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GetStartedPage,
});

function GetStartedPage() {
  const navigate = useNavigate();
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let cancelled = false;

    me()
      .then((current) => {
        if (cancelled) return;
        if (!current) {
          setCheckingSession(false);
          return;
        }
        void navigate({ to: destinationFor(current), replace: true });
      })
      .catch(() => {
        if (!cancelled) setCheckingSession(false);
      });

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (checkingSession) {
    return <GateLoading audience="staff" />;
  }

  return (
    <main className="tg-grain relative flex min-h-dvh flex-col overflow-hidden bg-background text-foreground">
      <GridField className="pointer-events-none absolute inset-x-0 top-0 h-[60vh] w-full text-foreground opacity-40" />
      <div
        aria-hidden
        className="tg-drift pointer-events-none absolute -top-40 left-1/4 h-[36rem] w-[36rem] max-w-full rounded-full opacity-[0.08] blur-3xl"
        style={{ background: "radial-gradient(circle, var(--color-foreground), transparent 62%)" }}
      />

      <section className="relative z-10 flex flex-1 items-center justify-center px-5 py-12 sm:px-8">
        <div className="mx-auto w-full max-w-3xl text-center">
          <Reveal delay={90}>
            <h1 className="font-[family-name:var(--font-display)] text-[2rem] leading-tight tracking-tight sm:text-6xl">
              Who&rsquo;s getting started<span className="italic text-muted-foreground">?</span>
            </h1>
          </Reveal>

          <div className="mt-8 grid gap-4 sm:mt-10 sm:grid-cols-2">
            <Reveal delay={180}>
              <button
                type="button"
                onClick={() => void navigate({ to: "/client/institution-auth" })}
                className="group flex h-full w-full cursor-pointer flex-col items-start gap-5 border border-border bg-card p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-foreground/40 hover:shadow-lg sm:p-8"
              >
                <span className="grid size-12 place-items-center border border-border bg-background transition-colors group-hover:bg-foreground group-hover:text-background">
                  <Building2 className="size-5" />
                </span>
                <span>
                  <span className="flex items-center gap-2 text-xl font-semibold tracking-tight">
                    Institution
                    <ArrowRight className="size-4 text-muted-foreground transition-transform duration-300 group-hover:translate-x-1 group-hover:text-foreground" />
                  </span>
                  <span className="mt-2 block text-sm leading-relaxed text-muted-foreground">
                    For placement cells, TPOs &amp; management — get the full picture of your campus
                    talent, track readiness, and level up your placement game.
                  </span>
                </span>
              </button>
            </Reveal>

            <Reveal delay={260}>
              <button
                type="button"
                onClick={() => void navigate({ to: "/candidate/auth" })}
                className="group flex h-full w-full cursor-pointer flex-col items-start gap-5 border border-border bg-card p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-foreground/40 hover:shadow-lg sm:p-8"
              >
                <span className="grid size-12 place-items-center border border-border bg-background transition-colors group-hover:bg-foreground group-hover:text-background">
                  <GraduationCap className="size-5" />
                </span>
                <span>
                  <span className="flex items-center gap-2 text-xl font-semibold tracking-tight">
                    Student
                    <ArrowRight className="size-4 text-muted-foreground transition-transform duration-300 group-hover:translate-x-1 group-hover:text-foreground" />
                  </span>
                  <span className="mt-2 block text-sm leading-relaxed text-muted-foreground">
                    For students — build your profile, challenge yourself with AI-powered training
                    &amp; interviews, and get placement-ready before the real game begins.
                  </span>
                </span>
              </button>
            </Reveal>
          </div>
        </div>
      </section>
    </main>
  );
}
