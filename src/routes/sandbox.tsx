import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/sandbox")({
  head: () => ({
    meta: [
      { title: "Sandbox | TalentBro Institutions" },
      {
        name: "description",
        content: "Explore the TalentBro Institutions sandbox experience.",
      },
    ],
  }),
  component: SandboxPage,
});

function SandboxPage() {
  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="bg-ink px-5 py-20 text-paper md:px-10 lg:px-14 lg:py-28">
        <div className="mx-auto max-w-[880px]">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-paper/50 transition-colors hover:text-paper"
          >
            <ArrowLeft className="size-4" /> Back to Home
          </Link>
          <p className="eyebrow eyebrow-dark mt-12">TalentBro Institutions</p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight md:text-6xl">Product Sandbox</h1>
          <p className="mt-5 max-w-xl text-paper/55">
            A live, self-contained walkthrough of the TalentBro Institutions experience — coming soon.
          </p>
        </div>
      </header>

      <section className="flex flex-1 items-center justify-center px-5 py-16 md:px-10 lg:px-14">
        <div className="mx-auto max-w-md text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full border border-border">
            <span className="live-dot" />
          </span>
          <h2 className="mt-6 text-2xl font-semibold">Sandbox in progress</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            The interactive sandbox is being prepared. When it's ready you'll be able to explore student
            training, talent intelligence, and drive management here on sample data.
          </p>
          <Link
            to="/"
            className="mt-8 inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go back home
          </Link>
        </div>
      </section>

      <footer className="bg-ink px-5 pb-8 pt-10 text-paper md:px-10 lg:px-14">
        <div className="mx-auto flex max-w-[880px] flex-col items-center justify-between gap-5 border-t border-paper/10 pt-8 sm:flex-row">
          <Link to="/" className="text-sm font-bold">
            TalentBro <span className="font-medium text-muted-foreground">Institutions</span>
          </Link>
          <p className="text-xs text-paper/35">© 2026 TalentBro. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}