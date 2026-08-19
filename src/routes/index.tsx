import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  CompanyMarquee,
  CompanyReadinessTable,
  HeroVisual,
  ImprovementLoop,
  InterventionFlow,
  JourneyRail,
  OfficerDashboard,
  RankingCard,
  ReportsGrid,
  SkillRadar,
  StudentDotGrid,
  StudentProfileCard,
} from "@/components/tb/visuals";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TalentBro Institutions — Placement Readiness Intelligence" },
      {
        name: "description",
        content:
          "AI-powered placement readiness and intelligence for universities: skill mapping, company-specific mocks, rankings, dashboards and placement reports.",
      },
      { property: "og:title", content: "TalentBro Institutions — Know Who's Placement Ready" },
      {
        property: "og:description",
        content:
          "Institutional placement intelligence: measure, rank and improve the placement readiness of every student.",
      },
    ],
  }),
  component: Index,
});

function Section({
  id,
  index,
  eyebrow,
  title,
  copy,
  children,
  bare,
}: {
  id: string;
  index: string;
  eyebrow: string;
  title: string;
  copy?: string;
  children?: ReactNode;
  bare?: boolean;
}) {
  return (
    <section id={id} className="border-t border-border">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_1fr] lg:gap-14">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] text-muted-foreground">{index}</span>
              <span className="h-px w-8 bg-border" />
              <span className="eyebrow">{eyebrow}</span>
            </div>
            <h2 className="mt-5 text-2xl font-semibold sm:text-3xl">{title}</h2>
            {copy ? (
              <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{copy}</p>
            ) : null}
          </div>
          <div className={bare ? "" : "min-w-0"}>{children}</div>
        </div>
      </div>
    </section>
  );
}

function DemoButton({ variant = "solid" }: { variant?: "solid" | "ghost" }) {
  return (
    <a
      href="#demo"
      className={
        variant === "solid"
          ? "inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-85"
          : "inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-medium transition-colors hover:bg-secondary"
      }
    >
      Book a Demo
      <span aria-hidden>→</span>
    </a>
  );
}

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <a href="#top" className="flex items-baseline gap-2">
            <span className="text-[15px] font-semibold tracking-tight">TalentBro</span>
            <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              Institutions
            </span>
          </a>
          <nav className="hidden gap-7 text-[13px] text-muted-foreground md:flex">
            <a href="#journey" className="hover:text-foreground">
              Journey
            </a>
            <a href="#skills" className="hover:text-foreground">
              Skill Mapping
            </a>
            <a href="#dashboard" className="hover:text-foreground">
              Dashboard
            </a>
            <a href="#reports" className="hover:text-foreground">
              Reports
            </a>
          </nav>
          <a
            href="#demo"
            className="rounded-full bg-foreground px-4 py-2 text-[13px] font-medium text-background transition-opacity hover:opacity-85"
          >
            Book a Demo
          </a>
        </div>
      </header>

      <main id="top">
        {/* 1 — Hero */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 grid-paper opacity-40 [mask-image:radial-gradient(ellipse_at_top,black,transparent_72%)]" />
          <div className="relative mx-auto max-w-6xl px-5 pt-16 pb-16 sm:px-8 sm:pt-24 sm:pb-24">
            <div className="max-w-3xl animate-rise">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-foreground animate-pulse-soft" />
                Placement intelligence platform for institutions
              </span>
              <h1 className="mt-6 text-[2.6rem] leading-[1.02] font-semibold sm:text-6xl lg:text-7xl">
                Know Who&rsquo;s
                <br />
                Placement Ready.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                AI-powered placement readiness &amp; intelligence for institutions — measured per
                student, aggregated across every department.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <DemoButton />
                <a
                  href="#dashboard"
                  className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-medium transition-colors hover:bg-secondary"
                >
                  See the dashboard
                </a>
              </div>
            </div>
            <div
              className="mt-12 animate-rise sm:mt-16"
              style={{ animationDelay: "140ms" }}
            >
              <HeroVisual />
            </div>
            <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
              {[
                ["1,000+", "students per cohort"],
                ["6", "skill dimensions"],
                ["24", "company simulations"],
                ["1", "source of truth"],
              ].map(([v, l]) => (
                <div key={l} className="bg-card p-5">
                  <dt className="text-2xl font-semibold tracking-tight">{v}</dt>
                  <dd className="mt-1 text-[11px] text-muted-foreground">{l}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* 2 — Problem */}
        <Section
          id="problem"
          index="01"
          eyebrow="The Problem"
          title="1,000+ students. Almost no visibility."
          copy="Institutions know attendance, marks and CGPA. What they cannot see is who is actually ready to clear a real interview — and who will fail the drive next month."
        >
          <StudentDotGrid />
        </Section>

        {/* 3 — Journey */}
        <Section
          id="journey"
          index="02"
          eyebrow="Placement Journey"
          title="One measured path, cohort to placement drive."
          copy="Every stage produces data. Every stage feeds the next."
        >
          <JourneyRail />
        </Section>

        {/* 4 — Skill Mapping */}
        <Section
          id="skills"
          index="03"
          eyebrow="Skill Mapping"
          title="Six dimensions, assessed by AI."
          copy="Technical, Communication, Problem Solving, Behavioral, Aptitude and Interview Performance — scored from real interview evidence, not self-reporting."
        >
          <SkillRadar />
        </Section>

        {/* 5 — Personalized Preparation */}
        <Section
          id="preparation"
          index="04"
          eyebrow="Personalized Preparation"
          title="Every student gets their own roadmap."
          copy="Strengths, weaknesses, recommendations and a week-by-week improvement plan generated per student."
        >
          <StudentProfileCard />
        </Section>

        {/* 6 — Company Preparation */}
        <Section
          id="companies"
          index="05"
          eyebrow="Company Preparation"
          title="Prepared for the companies actually visiting."
          copy="Company-oriented simulations modelled on the rounds, rubrics and question patterns of upcoming recruiters."
        >
          <CompanyReadinessTable />
        </Section>
        <CompanyMarquee />

        {/* 7 — Continuous Improvement */}
        <Section
          id="improvement"
          index="06"
          eyebrow="Continuous Improvement"
          title="Practice, measure, improve — on loop."
          copy="Readiness is not a one-time test. Progression is tracked across every attempt."
        >
          <ImprovementLoop />
        </Section>

        {/* 8 — Rankings */}
        <Section
          id="rankings"
          index="07"
          eyebrow="Student Rankings"
          title="Rank, in context."
          copy="University rank, department rank and skill-wise rank make readiness comparable and actionable."
        >
          <RankingCard />
        </Section>

        {/* 9 — Dashboard */}
        <Section
          id="dashboard"
          index="08"
          eyebrow="Placement Officer Dashboard"
          title="The whole cohort on one screen."
          copy="Cohort overview, readiness scores, department analytics, skill heatmaps, company readiness, mock participation, rankings and student progress."
        >
          <OfficerDashboard />
        </Section>

        {/* 10 — Intervention */}
        <Section
          id="intervention"
          index="09"
          eyebrow="Student Intervention"
          title="Act before the drive, not after."
          copy="Identify students needing attention, recommend the intervention, assign preparation and track improvement."
        >
          <InterventionFlow />
        </Section>

        {/* 11 — Reports */}
        <Section
          id="reports"
          index="10"
          eyebrow="Reports & Intelligence"
          title="Evidence for every decision."
          copy="Student reports, interview transcripts, department analytics, company readiness and placement reports — exportable for management review."
        >
          <ReportsGrid />
        </Section>

        {/* 12 — Final CTA */}
        <section id="demo" className="border-t border-border bg-foreground text-background">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
            <h2 className="max-w-3xl text-3xl leading-[1.06] font-semibold sm:text-5xl">
              Your Students Are Preparing.
              <br />
              Are You Measuring Their Readiness?
            </h2>
            <p className="mt-5 max-w-lg text-sm leading-relaxed opacity-70 sm:text-base">
              See TalentBro Institutions on your own cohort data.
            </p>
            <div className="mt-8">
              <a
                href="#top"
                className="inline-flex items-center gap-2 rounded-full bg-background px-7 py-3.5 text-sm font-medium text-foreground transition-opacity hover:opacity-85"
              >
                Book a Demo <span aria-hidden>→</span>
              </a>
            </div>
            <div className="mt-16 grid gap-px overflow-hidden rounded-xl bg-background/20 sm:grid-cols-3">
              {[
                ["Institutional, not individual", "Built for placement cells and management."],
                ["Measured, not assumed", "Readiness from interview evidence."],
                ["Actionable, not decorative", "Every metric maps to an intervention."],
              ].map(([t, d]) => (
                <div key={t} className="bg-foreground p-5">
                  <div className="text-sm font-medium">{t}</div>
                  <p className="mt-1.5 text-[12px] leading-relaxed opacity-65">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-8 text-[12px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>
            <span className="font-semibold text-foreground">TalentBro</span> Institutions —
            placement readiness intelligence.
          </span>
          <span className="font-mono text-[10px] tracking-widest uppercase">© 2026</span>
        </div>
      </footer>
    </div>
  );
}
