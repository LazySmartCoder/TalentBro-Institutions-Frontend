import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound } from "lucide-react";
import { useState, type FormEvent } from "react";

import { GridField } from "@/components/graphics";
import { Input } from "@/components/ui/input";
import { ApiError, resetPassword } from "@/lib/api";

const title = "Choose a New Password | TalentBro";
const description = "Choose a new password for your TalentBro student account.";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>): { uid: string; token: string } => ({
    uid: typeof search["uid"] === "string" ? search["uid"] : "",
    token: typeof search["token"] === "string" ? search["token"] : "",
  }),
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
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { uid, token } = Route.useSearch();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const hasLink = Boolean(uid && token);
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (newPassword.length < 8) {
      setError("Your new password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await resetPassword(uid, token, newPassword);
      setDone(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="tg-grain relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-5 py-12 text-foreground">
      <GridField className="pointer-events-none absolute inset-x-0 top-0 h-[60vh] w-full text-foreground opacity-40" />
      <div
        aria-hidden
        className="tg-drift pointer-events-none absolute -top-40 left-1/4 h-[36rem] w-[36rem] max-w-full rounded-full opacity-[0.08] blur-3xl"
        style={{ background: "radial-gradient(circle, var(--color-foreground), transparent 62%)" }}
      />

      <section className="relative z-10 w-full max-w-md border border-border bg-card p-6 sm:p-8">
        <Link
          to="/candidate/auth"
          className="inline-flex items-center gap-2 text-[10px] font-medium tracking-[0.18em] text-muted-foreground uppercase transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Back to sign in
        </Link>

        <span className="mt-8 grid size-12 place-items-center border border-border bg-background">
          <KeyRound className="size-5" />
        </span>

        <h1 className="mt-6 font-[family-name:var(--font-display)] text-4xl tracking-tight">
          Choose a new password<span className="italic text-muted-foreground">.</span>
        </h1>

        {!hasLink ? (
          <div className="mt-6 space-y-5">
            <div
              role="alert"
              className="border border-red-500/40 bg-red-500/5 px-4 py-3 text-xs leading-relaxed text-red-500"
            >
              This reset link is incomplete or invalid. Request a fresh link to continue.
            </div>
            <Link
              to="/forgot-password"
              className="inline-flex h-11 items-center justify-center bg-foreground px-5 text-[11px] font-medium tracking-[0.18em] text-background uppercase transition-transform duration-300 hover:-translate-y-0.5"
            >
              Request a new link
            </Link>
          </div>
        ) : done ? (
          <div className="mt-6 space-y-5">
            <div
              role="status"
              className="flex items-start gap-3 border border-border bg-background px-4 py-4"
            >
              <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
              <div>
                <strong className="text-sm font-semibold">Password updated</strong>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Your new password is ready. Sign in with it to continue.
                </p>
              </div>
            </div>
            <Link
              to="/candidate/auth"
              className="inline-flex h-11 items-center justify-center bg-foreground px-5 text-[11px] font-medium tracking-[0.18em] text-background uppercase transition-transform duration-300 hover:-translate-y-0.5"
            >
              Sign in
            </Link>
          </div>
        ) : (
          <>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Choose a strong password with at least 8 characters.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label
                  htmlFor="new-password"
                  className="mb-2 block text-[10px] tracking-[0.25em] text-muted-foreground uppercase"
                >
                  New password
                </label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    required
                    minLength={8}
                    className="h-12 rounded-none border-border bg-transparent pr-12 pl-4 text-sm tracking-wide placeholder:text-muted-foreground/50 focus-visible:ring-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer p-1 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirm-password"
                  className="mb-2 block text-[10px] tracking-[0.25em] text-muted-foreground uppercase"
                >
                  Confirm new password
                </label>
                <Input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  minLength={8}
                  className="h-12 rounded-none border-border bg-transparent px-4 text-sm tracking-wide placeholder:text-muted-foreground/50 focus-visible:ring-foreground"
                />
                {mismatch ? (
                  <p className="mt-2 text-[11px] text-red-500">The passwords do not match.</p>
                ) : null}
              </div>

              {error ? (
                <div
                  role="alert"
                  className="border border-red-500/40 bg-red-500/5 px-4 py-3 text-xs leading-relaxed text-red-500"
                >
                  {error}
                  {/invalid|expired/i.test(error) ? (
                    <>
                      {" "}
                      <Link
                        to="/forgot-password"
                        className="font-semibold underline decoration-red-500/40 underline-offset-2"
                      >
                        Request a new link
                      </Link>
                      .
                    </>
                  ) : null}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="h-12 w-full cursor-pointer bg-foreground text-[11px] font-medium tracking-[0.2em] text-background uppercase transition-transform duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Updating..." : "Update password"}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
