import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Ban,
  Check,
  Eye,
  Lightbulb,
  MessageSquare,
  Mic,
  Pause,
  ShieldCheck,
  Sparkles,
  Target,
  Volume2,
} from "lucide-react";

const title = "TalentBro | Communication Tips";
const description = "Master spoken communication with practical tips from Maya, your AI coach.";

export const Route = createFileRoute("/communication-training-tips")({
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

const FILLERS = ["like", "hmm", "ahmm", "umm", "you know", "actually", "So…"];

const DO_DONT: { do: string; dont: string }[] = [
  { do: "Start answers directly — no preamble", dont: 'Begin every answer with "So…"' },
  { do: "Pause briefly to think", dont: "Fill silence with umm, ahmm, like…" },
  { do: "Use short, complete sentences", dont: "Rambling with run-on sentences" },
  { do: "Answer the question first, then add examples", dont: "Trail off without a clear ending" },
  { do: "Sound natural and confident", dont: "Imitate accents or sound overly formal" },
  { do: "Use concrete examples and evidence", dont: "Be vague or generic without specifics" },
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
    title: "Clarity & Directness",
    tips: [
      "Answer the question directly in your first sentence.",
      "Support your point with a specific example or fact.",
      "Keep one idea per sentence — short is better than long.",
      "Conclude your answer clearly rather than trailing off.",
    ],
  },
  {
    icon: Ban,
    color: "text-red-500",
    bg: "bg-red-500/10",
    title: "Fillers to Eliminate",
    tips: [
      'Never say "like", "hmm", "ahmm", "umm", or "you know" as fillers.',
      'Avoid excessive "actually" — use it only when it matters.',
      'Don\'t habitually begin answers with "So" — start confidently.',
      "Replace filler silence with a brief, intentional pause.",
    ],
  },
  {
    icon: MessageSquare,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    title: "Sentence Structure",
    tips: [
      "Use short, complete sentences with a clear subject and verb.",
      "Maintain logical flow between ideas.",
      "Avoid unnecessary repetition and sentence restarts.",
      "Don't overuse complex words — keep it natural.",
    ],
  },
  {
    icon: Volume2,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    title: "Pace & Rhythm",
    tips: [
      "Maintain a moderate, steady speaking pace.",
      "Brief pauses while thinking are fine — they're natural.",
      "Don't rush to fill silence — let the listener absorb.",
      "Vary your tone slightly to keep the listener engaged.",
    ],
  },
  {
    icon: ShieldCheck,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    title: "Confidence & Tone",
    tips: [
      "Speak with conviction — avoid hedging language.",
      "Use a professional yet conversational tone.",
      "Keep your voice steady — no trailing off at the end.",
      "Believe in what you're saying — authenticity shows.",
    ],
  },
  {
    icon: Sparkles,
    color: "text-pink-500",
    bg: "bg-pink-500/10",
    title: "Authenticity",
    tips: [
      "Be yourself — don't imitate accents or over-perform.",
      "Sound composed and spontaneous, not rehearsed.",
      "Communication should be easy for the listener to follow.",
      "Clarity and authenticity beat formality every time.",
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
              <h1 className="text-2xl font-bold sm:text-3xl">Maya's Communication Tips</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Good communication is clear, concise, confident, structured, relevant, and natural.
                Use these tips to ace your spoken practice sessions.
              </p>
            </div>
          </div>

          {/* Quick stat chips */}
          <div className="relative mt-8 flex flex-wrap gap-2">
            {[
              { icon: Eye, text: "Clarity" },
              { icon: Target, text: "Directness" },
              { icon: Pause, text: "Natural Pauses" },
              { icon: Sparkles, text: "Authenticity" },
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

        {/* Filler Ban Banner */}
        <div className="mb-8 rounded-2xl border border-red-500/20 bg-red-500/5 px-6 py-5">
          <div className="flex items-start gap-3">
            <Ban className="mt-0.5 size-5 shrink-0 text-red-500" />
            <div>
              <h2 className="text-sm font-semibold text-red-600 dark:text-red-400">
                Words to Eliminate
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                These fillers weaken your delivery — count every one and cut them out.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {FILLERS.map((f) => (
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
          <h2 className="text-lg font-bold sm:text-xl">Do This, Not That</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Side-by-side comparison of what works and what doesn't.
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
              "Start directly — no fillers, no preamble.",
              "Short, complete sentences. Logical flow.",
              "Pause to think instead of filling silence.",
              "Answer the question, give an example, then stop.",
              "Sound like yourself — confident, calm, natural.",
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
            onClick={() => void navigate({ to: "/communication-training" })}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-foreground px-6 py-3 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 hover:opacity-90 active:scale-95"
          >
            <Mic className="size-4" /> Start Practicing
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
