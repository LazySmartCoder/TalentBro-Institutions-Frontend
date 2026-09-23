import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Ban,
  BookOpenCheck,
  CalendarClock,
  Check,
  Languages,
  Lightbulb,
  Navigation,
  PenLine,
  Target,
} from "lucide-react";

const title = "TalentBro | English Writing Tips";
const description =
  "Master clear, correct and professional written English with practical tips from Maya, your AI coach.";

export const Route = createFileRoute("/english-training-tips")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: TipsPage,
});

/* ─── Data ──────────────────────────────────────────────────────────── */

const ERRORS = [
  "He don't know",
  "She go office",
  "I am agree",
  "Since two years",
  "much people",
  "more better",
];

const DO_DONT: { do: string; dont: string }[] = [
  { do: "She goes to work every day", dont: "She go to work every day" },
  { do: "I have lived here for two years", dont: "I am living here since two years" },
  { do: "Do you like this movie?", dont: "You like this movie?" },
  { do: "He is a good student", dont: "He is good student" },
  { do: "I agree with you", dont: "I am agree with you" },
  { do: "The meeting is at 5 o'clock", dont: "The meeting is in 5 o'clock" },
];

const SECTIONS: {
  icon: typeof Target;
  color: string;
  bg: string;
  title: string;
  tips: string[];
}[] = [
  {
    icon: Target,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    title: "Subject–Verb Agreement",
    tips: [
      "Always match the subject and verb: she GOES, they go, I am, he is.",
      "Third-person singular takes -s: He works, she plays, it rains.",
      "Keep the subject in every sentence — don't drop it in your writing.",
    ],
  },
  {
    icon: CalendarClock,
    color: "text-red-500",
    bg: "bg-red-500/10",
    title: "Tense Consistency",
    tips: [
      "Keep one timeline per sentence — don't mix past and present tenses.",
      "Use the past tense for finished events: 'Yesterday I went to college'.",
      "Use present perfect for recent results: 'I have finished my work'.",
    ],
  },
  {
    icon: BookOpenCheck,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    title: "Articles: a / an / the",
    tips: [
      "Use 'a/an' on first mention of a singular noun: 'I saw a dog'.",
      "Use 'the' when you mean something specific: 'The dog barked at me'.",
      "Skip articles before plurals used generally: 'I love books', not 'I love the books'.",
    ],
  },
  {
    icon: Navigation,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    title: "Prepositions",
    tips: [
      "Use 'at' for points in time and places: at 5 o'clock, at the door.",
      "Use 'in' for months, years, and inside spaces: in June, in the room.",
      "Use 'for' durations and 'since' starting points: for two years, since 2024.",
    ],
  },
  {
    icon: Languages,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    title: "Word Order & Questions",
    tips: [
      "Questions bring the auxiliary first: 'Do you like tea?', not 'You like tea?'.",
      "Keep adjectives before nouns: 'a red car', not 'a car red'.",
      "Place time phrases naturally: 'I wake up at 7', not 'At 7 I wake up'.",
    ],
  },
  {
    icon: PenLine,
    color: "text-pink-500",
    bg: "bg-pink-500/10",
    title: "Natural Word Choice",
    tips: [
      "Don't translate word-for-word from Hindi — 'I am agree' should be 'I agree'.",
      "Learn natural collocations: 'make a decision', not 'do a decision'.",
      "Use simple, everyday words you write confidently, not formal ones you stumble over.",
    ],
  },
];

/* ─── Page ──────────────────────────────────────────────────────────── */

function TipsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Grid backdrop */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(var(--color-foreground) 1px, transparent 1px), linear-gradient(90deg, var(--color-foreground) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Hero */}
        <div className="relative mb-10 overflow-hidden rounded-3xl border border-border bg-card/50 px-6 py-10 sm:px-10 sm:py-14">
          <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-foreground/[0.03] blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 size-48 rounded-full bg-foreground/[0.04] blur-2xl" />

          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-10">
            <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-foreground text-background shadow-lg">
              <Lightbulb className="size-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">Maya's English Writing Tips</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Write clearly and professionally: correct grammar, proper tense, and the right
                words. Use these tips to ace your English writing sessions with Maya.
              </p>
            </div>
          </div>

          {/* Quick stat chips */}
          <div className="relative mt-8 flex flex-wrap gap-2">
            {[
              { icon: Target, text: "Subject–Verb" },
              { icon: CalendarClock, text: "Tense" },
              { icon: BookOpenCheck, text: "Articles" },
              { icon: Languages, text: "Word Order" },
            ].map(({ icon: I, text }) => (
              <span
                key={text}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-medium"
              >
                <I className="size-3.5 text-muted-foreground" />
                {text}
              </span>
            ))}
          </div>
        </div>

        {/* Errors to Fix Banner */}
        <div className="mb-8 rounded-2xl border border-red-500/20 bg-red-500/5 px-6 py-5">
          <div className="flex items-start gap-3">
            <Ban className="mt-0.5 size-5 shrink-0 text-red-500" />
            <div>
              <h2 className="text-sm font-semibold text-red-600 dark:text-red-400">
                Common Errors to Fix
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                These mistakes show up often — write them the grammatical way instead.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {ERRORS.map((f) => (
                  <span
                    key={f}
                    className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-600 line-through dark:text-red-400"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Main tip sections grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SECTIONS.map((sec) => (
            <div
              key={sec.title}
              className="rounded-2xl border border-border bg-card/50 p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <span className={`grid size-9 place-items-center rounded-xl ${sec.bg}`}>
                  <sec.icon className={`size-4.5 ${sec.color}`} />
                </span>
                <h3 className="text-sm font-semibold">{sec.title}</h3>
              </div>
              <ul className="mt-4 space-y-2.5">
                {sec.tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Do / Don't Table */}
        <div className="mt-10 rounded-2xl border border-border bg-card/50 p-6 sm:p-8">
          <h2 className="text-lg font-bold sm:text-xl">Write This, Not That</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Side-by-side comparison of what reads correctly and what doesn't.
          </p>
          <div className="mt-6 grid gap-3 sm:gap-4">
            {DO_DONT.map((row, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-2 sm:gap-4">
                <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    {row.do}
                  </span>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
                  <Ban className="mt-0.5 size-4 shrink-0 text-red-500" />
                  <span className="text-sm font-medium text-red-700 dark:text-red-400">
                    {row.dont}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Recap */}
        <div className="mt-8 rounded-2xl border border-border bg-card/50 p-6 sm:p-8">
          <h2 className="text-lg font-bold sm:text-xl">The 30-Second Recap</h2>
          <div className="mt-4 space-y-3">
            {[
              "Match subject and verb: she goes, they go.",
              "Keep tenses consistent within a sentence.",
              "Use a/an on first mention, the for specific things.",
              "Choose between at, in, on, for, and since by time and place.",
              "Question word order: Do you…? Is it…?",
              "Write it naturally — don't translate word-for-word from Hindi.",
            ].map((line, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-foreground/10 text-xs font-bold tabular-nums">
                  {i + 1}
                </span>
                <span className="text-sm">{line}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-10 flex flex-col items-center gap-4 pb-10 text-center">
          <p className="text-sm text-muted-foreground">Ready to put these tips into practice?</p>
          <button
            type="button"
            onClick={() => void navigate({ to: "/english-training" })}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-foreground px-6 py-3 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 hover:opacity-90 active:scale-95"
          >
            <PenLine className="size-4" /> Start Writing
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
