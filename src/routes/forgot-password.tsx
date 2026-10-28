import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Mail, Send } from "lucide-react";
import { useState, type FormEvent } from "react";

import { GridField } from "@/components/graphics";
import { Input } from "@/components/ui/input";
import { ApiError, requestPasswordReset } from "@/lib/api";

const title = "Forgot Password | TalentBro";
const description = "Reset the password for your TalentBro student account.";

export const Route = createFileRoute("/forgot-password")({
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
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [detail, setDetail] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await requestPasswordReset(email.trim());
      setDetail(result.detail);
      setSent(true);
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
          <Mail className="size-5" />
        </span>

        <h1 className="mt-6 font-[family-name:var(--font-display)] text-4xl tracking-tight">
          Reset your password<span className="italic text-muted-foreground">.</span>
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Enter the email connected to your student account. We will send you a secure link to
          choose a new password.
        </p>

        {sent ? (
          <div className="mt-8 space-y-5">
            <div
              role="status"
              className="flex items-start gap-3 border border-border bg-background px-4 py-4"
            >
              <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
              <div>
                <strong className="text-sm font-semibold">Check your email</strong>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
              The link expires in 1 hour. If you do not see the email, check your spam folder or try
              again with the correct address.
            </p>

            <button
              type="button"
              onClick={() => {
                setSent(false);
                setDetail("");
              }}
              className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold underline decoration-muted-foreground/40 underline-offset-4 transition-colors hover:text-foreground"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="reset-email"
                className="mb-2 block text-[10px] tracking-[0.25em] text-muted-foreground uppercase"
              >
                Email
              </label>
              <Input
                id="reset-email"
                type="email"
                placeholder="you@college.edu"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="h-12 rounded-none border-border bg-transparent px-4 text-sm tracking-wide placeholder:text-muted-foreground/50 focus-visible:ring-foreground"
              />
            </div>

            {error ? (
              <div
                role="alert"
                className="border border-red-500/40 bg-red-500/5 px-4 py-3 text-xs leading-relaxed text-red-500"
              >
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 bg-foreground text-[11px] font-medium tracking-[0.2em] text-background uppercase transition-transform duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send reset link"} <Send className="size-3.5" />
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
