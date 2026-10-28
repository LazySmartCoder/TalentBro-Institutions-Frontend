import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, HandCoins, Wallet } from "lucide-react";

import { ClientsFooter, ClientsHeader, WhatsAppIcon } from "@/components/clients/public";
import { CLIENT_CONTACT } from "@/lib/client-contact";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing | TalentBro Institutions" },
      {
        name: "description",
        content:
          "Simple, standard pricing for TalentBro Institutions. Choose a decided deal or pay as you go for up to 1,000 students, with a 2-week free trial and clear payment terms.",
      },
      { property: "og:title", content: "Pricing | TalentBro Institutions" },
      {
        property: "og:description",
        content:
          "One standard plan, transparent pricing and payment terms that respect your funds.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PricingPage,
});

const inclusions = [
  "One batch of up to 1,000 students",
  "Full platform access for the entire year",
  "Uninterrupted service",
  "2 weeks free trial",
  "Cancel after the trial — no questions asked",
  "Billing visible in your institution dashboard",
];

const paymentTerms = [
  {
    icon: HandCoins,
    label: "Option 01",
    title: "Decided deal",
    copy: "After onboarding, pay 40% in advance. The remaining balance is paid in equal quarterly instalments across the year.",
  },
  {
    icon: Wallet,
    label: "Option 02",
    title: "Pay as you go",
    copy: "Pay per month as per the billing shown in your institution dashboard.",
  },
];

function PricingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <ClientsHeader />

      <section className="border-b border-border bg-paper px-5 py-12 md:px-8 lg:py-16">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow">Pricing</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.03em] text-ink sm:text-5xl">
              Simple pricing. Respect for your funds.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              One standard plan for your institution. Choose a decided deal or pay as you go, start
              with a free trial and keep everything transparent from day one.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 self-start rounded-full border border-border bg-background px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground lg:self-auto">
            No hidden add-ons
          </div>
        </div>
      </section>

      <section className="px-5 py-12 md:px-8 lg:py-16">
        <div className="mx-auto grid w-full max-w-[1200px] gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <article className="overflow-hidden rounded-lg border border-border bg-background">
            <div className="flex items-center justify-between gap-4 bg-ink px-5 py-4 text-paper md:px-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-paper/50">
                Standard plan
              </p>
              <span className="rounded-full border border-paper/20 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-paper/70">
                2 payment options
              </span>
            </div>

            <div className="p-5 md:p-6">
              <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
                <span className="pb-2 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Approx.
                </span>
                <strong className="text-5xl font-semibold tracking-[-0.04em] text-ink">
                  ₹2,00,000
                </strong>
                <span className="pb-1.5 text-sm text-muted-foreground">per year</span>
              </div>
              <p className="mt-4 text-2xl font-semibold tracking-[-0.02em] text-ink">
                Up to 1,000 students
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                One batch for the entire year. No per-student surprises.
              </p>

              <ul className="mt-7 grid gap-3">
                {inclusions.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-foreground">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-ink text-paper">
                      <Check className="size-3" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>

              <div className="mt-8 border-t border-border pt-5">
                <Link to="/clients/apply" className="cta-ink cta-large">
                  Start your 2-week trial <ArrowRight className="size-4" />
                </Link>
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                  Trial first. Decide after. Cancel after the trial with no questions asked.
                </p>
              </div>
            </div>
          </article>

          <div className="space-y-6">
            <div className="rounded-lg border border-border bg-paper p-5 md:p-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Payment terms
              </p>
              <div className="mt-5 grid gap-5">
                {paymentTerms.map(({ icon: Icon, label, title, copy }) => (
                  <div key={title} className="flex gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-background text-ink">
                      <Icon className="size-4" />
                    </span>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                        {label}
                      </p>
                      <h2 className="mt-0.5 text-sm font-semibold text-ink">{title}</h2>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{copy}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-5 border-t border-border pt-4 text-[11px] leading-relaxed text-muted-foreground">
                Both options include the 2-week free trial and uninterrupted service.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-ink p-5 text-paper md:p-6">
              <p className="text-sm font-semibold">We respect your funds.</p>
              <p className="mt-2 text-xs leading-relaxed text-paper/55">
                No hidden charges, no unexpected add-ons. You pay for a clear plan, and you can walk
                away after the trial if it is not the right fit.
              </p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link to="/clients/apply" className="cta-light">
                  Apply as a client <ArrowRight className="size-4" />
                </Link>
                <a
                  href={CLIENT_CONTACT.whatsapp}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-paper/65 transition-colors hover:text-paper"
                >
                  <WhatsAppIcon className="size-4" /> Ask a question
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-6 flex w-full max-w-[1200px] flex-col gap-3 rounded-lg border border-border bg-paper px-5 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            Standard pricing applies to one batch of up to 1,000 students. Choose a decided deal or
            pay as you go.
          </p>
          <p className="font-semibold text-ink">Mon–Sat, 10:00–18:00 IST</p>
        </div>
      </section>

      <ClientsFooter />
    </main>
  );
}
