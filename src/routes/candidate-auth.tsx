import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { GridField } from "@/components/graphics";
import { Input } from "@/components/ui/input";
import { ApiError, login, me, signup } from "@/lib/api";
import { GateLoading } from "@/components/load-state";

const title = "TalentBro | Student Login or Create Account";
const description =
  "Sign in or create your TalentBro student account to build your profile, take AI interviews and get placement ready.";

type AuthMode = "login" | "signup";

export const Route = createFileRoute("/candidate-auth")({
  validateSearch: (search: Record<string, unknown>): { mode?: AuthMode } => {
    if (search["mode"] === "signup" || search["mode"] === "login") {
      return { mode: search["mode"] };
    }
    return {};
  },
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
  component: AuthPage,
});

const panelists = [
  ["Albert", "Technical Architect"],
  ["Peter", "Management & Leadership"],
  ["Daniel", "Decision Science"],
  ["Maya", "Communication & HR"],
  ["Ada", "Analytical & Logical Thinking"],
  ["Carl", "Behavioral Intelligence"],
];

function AuthPage() {
  const { mode: initialMode } = Route.useSearch();
  const [mode, setMode] = useState<AuthMode>(initialMode ?? "login");
  const navigate = useNavigate();
  const updateSearch = Route.useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let cancelled = false;
    me()
      .then((current) => {
        if (cancelled) return;
        if (current) {
          if (current.profile_complete === false) {
            navigate({ to: "/onboarding", replace: true });
          } else {
            navigate({ to: "/chat", replace: true });
          }
        } else {
          setCheckingSession(false);
        }
      })
      .catch(() => {
        if (!cancelled) setCheckingSession(false);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setError("");
    setShowPassword(false);
  };

  const switchMode = (next: AuthMode) => {
    if (next === mode) return;
    setMode(next);
    resetForm();
    updateSearch({ search: (prev) => ({ ...prev, mode: next }), replace: true });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "signup") {
        await signup({
          institutionName: "",
          fullName: "",
          email,
          password,
          userType: "student",
        });
      } else {
        await login({ email, password, userType: "student" });
      }
      const current = await me();
      if (current?.role !== "student") {
        navigate({ to: "/dashboard", replace: true });
      } else if (current?.profile_complete === false) {
        navigate({ to: "/onboarding" });
      } else {
        navigate({ to: "/chat" });
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return <GateLoading />;
  }

  return (
    <main className="tg-grain relative flex min-h-screen bg-background text-foreground">
      <GridField className="pointer-events-none absolute inset-x-0 top-0 h-[60vh] w-full text-foreground opacity-40" />
      <div
        aria-hidden
        className="tg-drift pointer-events-none absolute -top-40 left-1/4 h-[36rem] w-[36rem] rounded-full opacity-[0.08] blur-3xl"
        style={{ background: "radial-gradient(circle, var(--color-foreground), transparent 62%)" }}
      />
      {/* Brand panel */}
      <aside className="relative z-10 hidden w-[44%] max-w-xl flex-col justify-between border-r border-border px-10 py-10 lg:flex xl:px-14">
        <Reveal>
          <div className="tg-rule mt-8 h-px w-full bg-border" />
        </Reveal>

        <div>
          <Reveal delay={120}>
            <h2 className="max-w-md font-[family-name:var(--font-display)] text-5xl leading-[1.05] tracking-tight xl:text-6xl">
              Your expert panel is{" "}
              <span className="italic text-muted-foreground">already seated.</span>
            </h2>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Albert, Peter, Daniel, Maya, Ada and Carl interview you on every dimension — attention
              to detail, leadership, communication and more.
            </p>
          </Reveal>

          <ul className="mt-12">
            {panelists.map(([name, role], i) => (
              <Reveal as="li" key={name} delay={200 + i * 70}>
                <div className="grid grid-cols-[3rem_minmax(0,10rem)_1fr] items-baseline gap-4 border-t border-border py-3 transition-colors duration-500 hover:bg-secondary/60">
                  <span className="font-[family-name:var(--font-display)] text-sm text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-sm tracking-wide">{name}</span>
                  <span className="truncate text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
                    {role}
                  </span>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>

        <Reveal delay={620}>
          <p className="text-[10px] leading-relaxed tracking-[0.22em] text-muted-foreground uppercase">
            AI-powered interviews · Ranked reports · Integrity monitoring
          </p>
        </Reveal>
      </aside>

      {/* Form panel */}
      <section className="relative z-10 flex flex-1 flex-col px-5 py-8 sm:px-8 lg:py-10">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
          {/* Mode switch */}
          <Reveal delay={80}>
            <div className="relative grid grid-cols-2 border border-border p-1">
              <span
                aria-hidden
                className={`absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] bg-foreground transition-transform duration-300 ease-out ${
                  mode === "signup" ? "translate-x-full" : "translate-x-0"
                }`}
              />
              {(
                [
                  ["login", "Sign In"],
                  ["signup", "Enroll"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => switchMode(value)}
                  className={`relative z-10 cursor-pointer py-2.5 text-[11px] font-medium tracking-[0.18em] uppercase transition-colors duration-300 ${
                    mode === value
                      ? "text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Reveal>

          {/* Heading + form — remounts per mode so tg-reveal replays */}
          <div key={mode} className="tg-reveal mt-10">
            <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight sm:text-5xl">
              {mode === "login" ? (
                <>
                  Welcome back<span className="italic text-muted-foreground">.</span>
                </>
              ) : (
                <>
                  Enroll yourself<span className="italic text-muted-foreground">.</span>
                </>
              )}
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {mode === "login"
                ? "Sign in to access your AI interview panel and placement readiness dashboard."
                : "Set up your account and start AI-powered interviews in minutes."}
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label
                  htmlFor="auth-email"
                  className="mb-2 block text-[10px] tracking-[0.25em] text-muted-foreground uppercase"
                >
                  Email
                </label>
                <Input
                  id="auth-email"
                  type="email"
                  placeholder="you@college.edu"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 rounded-none border-border bg-transparent px-4 text-sm tracking-wide placeholder:text-muted-foreground/50 focus-visible:ring-foreground"
                />
              </div>
              <div>
                <label
                  htmlFor="auth-password"
                  className="mb-2 block text-[10px] tracking-[0.25em] text-muted-foreground uppercase"
                >
                  Password
                </label>
                <div className="relative">
                  <Input
                    id="auth-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="h-12 rounded-none border-border bg-transparent pr-12 pl-4 text-sm tracking-wide placeholder:text-muted-foreground/50 focus-visible:ring-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer p-1 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {mode === "signup" && (
                  <p className="mt-2 text-[11px] text-muted-foreground">Minimum 8 characters.</p>
                )}
              </div>

              {error && (
                <div
                  role="alert"
                  className="border border-red-500/40 bg-red-500/5 px-4 py-3 text-xs leading-relaxed text-red-500"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="!mt-8 h-12 w-full cursor-pointer bg-foreground text-[11px] font-medium tracking-[0.2em] text-background uppercase transition-transform duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Enroll"}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              {mode === "login" ? (
                <>
                  Forgot your password?{" "}
                  <span className="cursor-pointer underline decoration-muted-foreground/40 underline-offset-2 transition-colors hover:text-foreground">
                    Reset it
                  </span>
                </>
              ) : (
                "By creating an account, you agree to our Terms & Privacy Policy."
              )}
            </p>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => switchMode(mode === "login" ? "signup" : "login")}
                className="cursor-pointer underline decoration-muted-foreground/40 underline-offset-2 transition-colors hover:text-foreground"
              >
                {mode === "login" ? "Create one" : "Sign in"}
              </button>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
