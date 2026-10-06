import { Link } from "@tanstack/react-router";
import { ArrowRight, RefreshCw, Wrench } from "lucide-react";

/**
 * The downtime page — the one place every route is sent while the site is off.
 *
 * Deliberately self-contained: it must not reach for a session, a nav or a
 * fresh API call, because the API is the thing most likely to be mid-deploy.
 * The only thing it does is re-run the site status check, which is a single
 * cheap GET.
 *
 * Layout is built from the same primitives as the marketing home page
 * (`hero-shell`, `hero-kicker`, `hero-title`, `hg-*` rings, the company
 * marquee) so downtime reads as part of the site rather than as a browser error
 * that wandered in. The asymmetry is the point: headline off to the left and
 * slightly high, the orbiting graphic pushed up and right, ticker along the
 * bottom edge — the eye lands on the headline, then the pause, then the retry.
 */
export function DowntimeScreen({
  message,
  /** Re-check whether the site is back. Wired to the "Try again" button. */
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  const detail =
    message.trim() ||
    "We are carrying out scheduled maintenance on TalentBro. Everything will be back shortly.";

  return (
    <main id="top" className="hero-shell relative flex min-h-[640px] flex-col bg-background text-ink">
      <nav className="relative z-30 mx-auto flex w-full max-w-[1500px] items-center justify-between px-5 py-6 md:px-10 lg:px-14">
        <Link to="/" className="group flex items-center gap-2" aria-label="TalentBro home">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary transition-transform group-hover:rotate-12">
            <img
              src="/favicon.ico"
              alt=""
              width={26}
              height={26}
              className="size-6.5 rounded-full object-cover"
            />
          </span>
          <span className="text-sm font-bold">
            TalentBro <span className="font-medium text-ink/45">Institutions</span>
          </span>
        </Link>
        <Link to="/" className="cta-ink">
          Home <ArrowRight className="size-3.5" />
        </Link>
      </nav>

      <div className="hero-curves" aria-hidden="true">
        <span className="hero-curve hero-curve-one" />
        <span className="hero-curve hero-curve-two" />
        <span className="hero-curve hero-curve-three" />
        <span className="hero-curve hero-curve-dash" />
      </div>

      <div className="relative z-20 mx-auto grid w-full max-w-[1500px] flex-1 items-center gap-8 px-6 pb-28 pt-4 md:grid-cols-[1.05fr_0.95fr] md:px-10 lg:px-14">
        <div className="-translate-y-6 text-center md:-translate-y-10 md:text-left">
          <p className="hero-kicker">SERVICE PAUSED · PLEASE TRY AGAIN SHORTLY</p>
          <h1 className="hero-title">
            We&rsquo;ll be
            <br />
            <span>right back.</span>
          </h1>
          <p className="hero-sub mx-auto md:mx-0">{detail}</p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 md:justify-start">
            <button type="button" onClick={onRetry} className="cta-ink">
              <RefreshCw className="size-3.5" />
              Try again
            </button>
            <span className="inline-flex items-center gap-2 text-[11px] text-ink/45">
              <i className="size-1.5 rounded-full bg-ink" />
              or just wait — we check every 30s
            </span>
          </div>
        </div>

        <div className="hero-graphic -top-10 md:-top-16" aria-hidden="true">
          <span className="hg-ring hg-ring-outer" />
          <span className="hg-ring hg-ring-mid" />
          <span className="hg-ring hg-ring-dash" />
          <span className="hg-arc" />
          <span className="hg-orbit">
            <i />
          </span>
          <div className="hg-core">
            <Wrench className="size-7" strokeWidth={1.6} />
            <small>held</small>
          </div>
          <span className="hg-chip hg-chip-ai">
            <i className="hg-live" />
            Deploy paused
          </span>
          <span className="hg-chip hg-chip-matches">Auto-retry on</span>
          <span className="hg-chip hg-chip-skill">Back shortly</span>
        </div>
      </div>

      {/* Three things a visitor might be wondering about, answered in one line
          each so nobody has to guess whether their work is safe. */}
      <div className="relative z-20 mx-auto grid w-full max-w-[1500px] grid-cols-1 gap-px overflow-hidden rounded-xl border border-ink/10 bg-ink/10 px-0 sm:grid-cols-3">
        {[
          ["Home page", "Still open"],
          ["Your data", "Untouched"],
          ["Everything else", "Temporarily off"],
        ].map(([label, value]) => (
          <div key={label} className="bg-background px-5 py-4 text-center sm:px-6">
            <div className="text-[10px] uppercase tracking-widest text-ink/40">{label}</div>
            <div className="mt-1 text-sm font-semibold">{value}</div>
          </div>
        ))}
      </div>

      <div className="relative z-20 mt-px border-y border-ink/10 py-5">
        <div className="flex w-max animate-marquee gap-12 pr-12">
          {[0, 1].map((copy) => (
            <span key={copy} className="flex shrink-0 items-center gap-12">
              {["We’ll be right back", "Nothing you saved is lost", "Thank you for your patience"].map(
                (line) => (
                  <span
                    key={line}
                    className="text-sm font-semibold tracking-tight whitespace-nowrap text-ink/35"
                  >
                    {line}
                  </span>
                ),
              )}
            </span>
          ))}
        </div>
      </div>

      <footer className="relative z-20 mx-auto w-full max-w-[1500px] px-5 pb-8 md:px-10 lg:px-14">
        <p className="text-xs text-ink/35">
          &copy; {new Date().getFullYear()} TalentBro. Built for better placements.
        </p>
      </footer>
    </main>
  );
}