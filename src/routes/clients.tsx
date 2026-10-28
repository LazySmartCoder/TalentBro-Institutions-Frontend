import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Bot,
  Building2,
  CalendarRange,
  ChartColumn,
  Check,
  Crosshair,
  Download,
  GraduationCap,
  Landmark,
  Presentation,
  ReceiptIndianRupee,
  Search,
  ShieldCheck,
  Target,
  UserCheck,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { ClientsFooter, ClientsHeader, ContactChannels } from "@/components/clients/public";
import { CLIENT_CONTACT } from "@/lib/client-contact";

export const Route = createFileRoute("/clients")({
  head: () => ({
    meta: [
      { title: "Clients | TalentBro Institutions" },
      {
        name: "description",
        content:
          "All TalentBro institution services in one place: student intelligence, drives, shortlisting, L&D training, analytics, billing and more.",
      },
      { property: "og:title", content: "Clients | TalentBro Institutions" },
      {
        property: "og:description",
        content:
          "See every service available to placement cells on TalentBro, plus our partner institutions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClientsPage,
});

type ClientService = { icon: LucideIcon; title: string; copy: string };

const partnerClients = [
  {
    name: "Presidency College",
    location: "Bangalore",
    logo: "https://upload.wikimedia.org/wikipedia/commons/0/0b/Presidency_college_Bangalore_hebbal.jpg",
  },
  {
    name: "Presidency University",
    location: "Bangalore",
    logo: "https://presidencyuniversity.in/assets/images/overview-logo.webp",
  },
];

const serviceGroups: { label: string; copy: string; items: ClientService[] }[] = [
  {
    label: "Understand",
    copy: "Know exactly where every student stands.",
    items: [
      {
        icon: GraduationCap,
        title: "Student Intelligence",
        copy: "Skills, readiness and eligibility in one live record.",
      },
      {
        icon: UserCheck,
        title: "Eligibility Matching",
        copy: "Match students to drives by CGPA, backlogs and readiness.",
      },
      {
        icon: Target,
        title: "Skill-Gap Insights",
        copy: "See which skills need intervention, by branch or batch.",
      },
      {
        icon: Activity,
        title: "Activity & Evidence",
        copy: "Module-by-module practice history behind every score.",
      },
      {
        icon: ChartColumn,
        title: "Reports & Analytics",
        copy: "Placement rate, CTC, recruiter mix, industry and departments.",
      },
    ],
  },
  {
    label: "Run",
    copy: "Move drives, targets and training without spreadsheets.",
    items: [
      {
        icon: UsersRound,
        title: "Student Management",
        copy: "Add students, bulk invite, search, filter and track.",
      },
      {
        icon: Building2,
        title: "Companies & Recruiters",
        copy: "A full network with tiers, CTC, openings and contacts.",
      },
      {
        icon: CalendarRange,
        title: "Placement Drives",
        copy: "Plan, run and audit every campus hiring drive.",
      },
      {
        icon: Crosshair,
        title: "Ready Pool & Shortlisting",
        copy: "Eligible, unplaced talent ready for the next company.",
      },
      {
        icon: Target,
        title: "Launch Targets",
        copy: "Assign practice by department or student, with deadlines.",
      },
      {
        icon: Presentation,
        title: "L&D Training",
        copy: "Readiness by department, skill radar and classroom sessions.",
      },
      {
        icon: Landmark,
        title: "Placement Cell Workspace",
        copy: "Roster, office hours and the cell's full remit.",
      },
    ],
  },
  {
    label: "Connect",
    copy: "Reach students, search talent and keep everyone aligned.",
    items: [
      {
        icon: Search,
        title: "AI Talent Search",
        copy: "Ask for students by skill, score or eligibility in plain English.",
      },
      {
        icon: Bot,
        title: "Institution Chat",
        copy: "An AI copilot for talent queries and placement decisions.",
      },
      {
        icon: Bell,
        title: "Notifications",
        copy: "Reach students and staff with one tracked update.",
      },
      {
        icon: ReceiptIndianRupee,
        title: "Institute Billing",
        copy: "Pay-as-you-go usage, advance and payable in one view.",
      },
      {
        icon: Building2,
        title: "Institution Profile & Onboarding",
        copy: "Branding, logo, staff accounts and setup.",
      },
      {
        icon: Download,
        title: "Export & Print",
        copy: "Reports and lists ready for meetings and accreditation.",
      },
    ],
  },
];

const highlights = [
  { value: "18", label: "Client services" },
  { value: "1", label: "Live student record" },
  { value: "0", label: "Spreadsheets to chase" },
  { value: "24/7", label: "Placement visibility" },
];

const steps = [
  {
    title: "Onboard",
    copy: "Import students, invite staff and set up your institution profile.",
  },
  {
    title: "Assign",
    copy: "Target practice by department, batch or individual student.",
  },
  {
    title: "Run",
    copy: "Shortlist eligible talent and manage every drive from one place.",
  },
  {
    title: "Report",
    copy: "Track readiness, outcomes and recruiter relationships as they happen.",
  },
];

function ClientsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <ClientsHeader />

      <section className="relative overflow-hidden border-b border-border">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-40 -top-48 size-[34rem] rounded-full border border-border"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-24 size-[18rem] rounded-full border border-border"
        />

        <div className="relative mx-auto grid w-full max-w-[1200px] gap-12 px-5 py-16 md:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-24">
          <div>
            <p className="eyebrow">For placement cells</p>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.04] tracking-[-0.03em] text-ink sm:text-5xl lg:text-6xl">
              Every client service.
              <br />
              <span className="text-muted-foreground">One placement workflow.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
              TalentBro gives your placement cell one connected view of student readiness,
              companies, drives and outcomes. No spreadsheets to chase, no blind spots before the
              season.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/clients/apply" className="cta-ink cta-large">
                Apply as a client <ArrowRight className="size-4" />
              </Link>
              <a
                href="#services"
                className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-semibold text-ink transition-colors hover:bg-muted"
              >
                Explore all services
              </a>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
              {[
                "Institution-only onboarding",
                "Role-based staff access",
                "Live readiness data",
              ].map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground"
                >
                  <Check className="size-3.5 text-ink" /> {item}
                </span>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="rounded-xl border border-border bg-paper p-5 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.35)]">
              <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    Placement command center
                  </p>
                  <p className="mt-1 text-sm font-semibold text-ink">
                    Batch 2026 · All departments
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-ink" /> Live
                </span>
              </div>

              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md bg-border">
                {[
                  ["1,248", "Students tracked"],
                  ["78%", "Batch readiness"],
                  ["36", "Hiring partners"],
                  ["12", "Active drives"],
                ].map(([value, label]) => (
                  <div key={label} className="bg-background p-4">
                    <p className="text-2xl font-semibold tracking-tight text-ink">{value}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                      {label}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-2">
                {[
                  { title: "Eligibility check", meta: "CSE · 24 students", tag: "Ready" },
                  { title: "Shortlist · Infosys", meta: "Final year · 48 matched", tag: "Review" },
                  {
                    title: "L&D focus · ECE",
                    meta: "Communication · 86 students",
                    tag: "On track",
                  },
                ].map((row) => (
                  <div
                    key={row.title}
                    className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2.5"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-md bg-ink text-paper">
                      <Check className="size-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-ink">{row.title}</p>
                      <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                        {row.meta}
                      </p>
                    </div>
                    <span className="ml-auto shrink-0 rounded-full border border-border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                      {row.tag}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="partners" className="border-b border-border bg-paper px-5 py-14 md:px-8">
        <div className="mx-auto w-full max-w-[1200px]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow">Partner clients</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                Institutions already on TalentBro
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Partner campuses use TalentBro to prepare students, coordinate placement cells and
              give recruiters a clearer picture of available talent.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {partnerClients.map((client) => (
              <article
                key={client.name}
                className="flex items-center gap-5 rounded-lg border border-border bg-background p-5 transition-colors hover:bg-muted"
              >
                <div className="grid h-16 w-24 shrink-0 place-items-center rounded-md border border-border bg-paper p-2">
                  <img
                    src={client.logo}
                    alt={`${client.name} logo`}
                    loading="lazy"
                    decoding="async"
                    width={96}
                    height={48}
                    className="max-h-12 w-auto max-w-full object-contain grayscale"
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-ink">{client.name}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{client.location}</p>
                  <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    <ShieldCheck className="size-3" /> Partner institution
                  </span>
                </div>
              </article>
            ))}
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            More campuses are onboarding for the 2026 placement season.{" "}
            <Link
              to="/clients/apply"
              className="font-semibold text-ink underline decoration-border underline-offset-4"
            >
              Add your institution
            </Link>
            .
          </p>
        </div>
      </section>

      <section id="services" className="px-5 py-16 md:px-8 lg:py-24">
        <div className="mx-auto w-full max-w-[1200px]">
          <div className="max-w-2xl">
            <p className="eyebrow">All client services</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Eighteen services. Three simple jobs.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Understand your talent, run the placement season and connect everyone involved. Every
              service below is available to your placement cell on one platform.
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {serviceGroups.map((group, index) => (
              <div
                key={group.label}
                className="overflow-hidden rounded-lg border border-border bg-background"
              >
                <div className="border-b border-border bg-paper p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                      0{index + 1}
                    </span>
                    <span className="rounded-full border border-border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                      {group.items.length} services
                    </span>
                  </div>
                  <h3 className="mt-4 text-xl font-semibold text-ink">{group.label}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{group.copy}</p>
                </div>

                <ul className="divide-y divide-border">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <li
                        key={item.title}
                        className="flex items-start gap-3 p-4 transition-colors hover:bg-muted"
                      >
                        <span className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-paper text-ink">
                          <Icon className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink">{item.title}</p>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            {item.copy}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-3 rounded-lg border border-border bg-paper p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              <strong className="text-ink">All 18 services, one connected record.</strong> Practice,
              scores and drives update the same student profile.
            </p>
            <Link
              to="/clients/apply"
              className="inline-flex items-center gap-2 text-sm font-semibold text-ink"
            >
              Apply as a client <ArrowUpRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-ink px-5 py-12 text-paper md:px-8">
        <div className="mx-auto grid w-full max-w-[1200px] gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {highlights.map((item) => (
            <div key={item.label} className="border-l border-paper/15 pl-5">
              <p className="text-3xl font-semibold tracking-tight">{item.value}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-paper/45">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-b border-border bg-paper px-5 py-16 md:px-8 lg:py-24">
        <div className="mx-auto w-full max-w-[1200px]">
          <div className="max-w-2xl">
            <p className="eyebrow">How it works</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Onboard in days. Run the season in one place.
            </h2>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <div key={step.title} className="rounded-lg border border-border bg-background p-5">
                <span className="grid size-9 place-items-center rounded-full bg-ink text-xs font-bold text-paper">
                  0{index + 1}
                </span>
                <h3 className="mt-5 text-base font-semibold text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="px-5 py-16 md:px-8 lg:py-20">
        <div className="mx-auto w-full max-w-[1200px] overflow-hidden rounded-xl bg-ink text-paper">
          <div className="grid gap-10 p-6 md:p-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:p-12">
            <div>
              <p className="eyebrow eyebrow-dark">Talk to us</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                Ready to run a better placement season?
              </h2>
              <p className="mt-4 max-w-lg text-sm leading-relaxed text-paper/55">
                Tell us about your campus and we will walk you through the platform, the onboarding
                process and the services that fit your placement cell.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link to="/clients/apply" className="cta-light cta-large">
                  Apply as a client <ArrowRight className="size-4" />
                </Link>
                <a
                  href={CLIENT_CONTACT.whatsapp}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-paper/25 px-5 py-3 text-sm font-semibold text-paper transition-colors hover:bg-paper/10"
                >
                  Chat on WhatsApp
                </a>
              </div>

              <p className="mt-5 text-xs text-paper/35">
                For institutions and placement cells only.
              </p>
            </div>

            <ContactChannels tone="dark" />
          </div>
        </div>
      </section>

      <ClientsFooter />
    </main>
  );
}
