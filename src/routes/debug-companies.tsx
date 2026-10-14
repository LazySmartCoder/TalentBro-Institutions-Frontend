import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ArrowLeft, Briefcase, Building2, ChevronRight, Globe, IndianRupee, MapPin } from "lucide-react";
import { AppNavHeader } from "@/components/tb/app-nav";
import { CompanyMark } from "@/components/dash/CompanyMark";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/debug-companies")({
  component: DebugCompanies,
});

const TIER_LABEL: Record<string, string> = {
  super_dream: "Super Dream",
  dream: "Dream",
  core: "Core",
  mass: "Mass",
};

function ctcBand(min: number | null, max: number | null): string {
  if (min == null && max == null) return "Not disclosed";
  if (min != null && max != null) return `₹${min} – ₹${max} LPA`;
  return min != null ? `From ₹${min} LPA` : `Up to ₹${max} LPA`;
}

const MOCK = [
  {
    id: 1,
    company_name: "Tata Consultancy Services",
    company_logo: "",
    tier: "mass",
    industry: "IT Services",
    work_location: "Bengaluru, India",
    salary_min: 3.5,
    salary_max: 7,
    drive_count: 2,
    website: "https://www.tcs.com/careers/india/campus-hiring-2026-engineering/apply-now",
  },
  {
    id: 2,
    company_name: "Zoho",
    company_logo: "",
    tier: "dream",
    industry: "Software",
    work_location: "Chennai",
    salary_min: null,
    salary_max: null,
    drive_count: 0,
    website: "https://zoho.com",
  },
  {
    id: 3,
    company_name: "Generic",
    company_logo: "",
    tier: "core",
    industry: "Consulting",
    work_location: "Pune",
    salary_min: 5,
    salary_max: 9,
    drive_count: 1,
    website: "",
  },
];

function TabButton({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        "flex cursor-pointer items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium transition-colors",
        active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function DebugCompanies() {
  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background text-foreground">
      <AppNavHeader
        current="chat"
        sticky
        left={
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              className="grid size-8 place-items-center rounded-md border border-border/60 bg-background/60 text-muted-foreground"
            >
              <ArrowLeft className="size-4" />
            </button>
            <span className="grid size-9 place-items-center rounded-lg bg-foreground text-background">
              <Building2 className="size-4" />
            </span>
            <span>
              <p className="text-sm font-semibold leading-tight">Companies &amp; Drives</p>
            </span>
          </div>
        }
      />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8">
          <p className="text-sm text-muted-foreground">
            Every recruiter your college is registered with, and the hiring drives they run.
          </p>

          <div className="mt-6 inline-flex rounded-lg border border-border bg-card p-1">
            <TabButton active>
              <Building2 className="size-4" />
              Companies
              <span className="ml-1 text-xs text-muted-foreground">{MOCK.length}</span>
            </TabButton>
            <TabButton active={false}>
              <Briefcase className="size-4" />
              Drives
              <span className="ml-1 text-xs text-muted-foreground">0</span>
            </TabButton>
          </div>

          <div className="mt-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {MOCK.map((c) => (
                <div key={c.id} className="group relative">
                  <Card className="h-full transition-colors group-hover:border-foreground/30">
                    <CardContent className="flex h-full gap-3 p-4">
                      <CompanyMark
                        company={c}
                        className="size-10 shrink-0 rounded-lg border border-border"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="truncate font-display text-base font-bold">
                            {c.company_name}
                          </h3>
                          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Badge variant="secondary">{TIER_LABEL[c.tier]}</Badge>
                          {c.industry && (
                            <span className="text-xs text-muted-foreground">{c.industry}</span>
                          )}
                        </div>
                        <div className="mt-2.5 space-y-1 text-xs text-muted-foreground">
                          {c.work_location && (
                            <p className="flex items-center gap-1.5">
                              <MapPin className="size-3.5" /> {c.work_location}
                            </p>
                          )}
                          <p className="flex items-center gap-1.5">
                            <IndianRupee className="size-3.5" />
                            {ctcBand(c.salary_min, c.salary_max)}
                          </p>
                          <p className="flex items-center gap-1.5">
                            <Briefcase className="size-3.5" />
                            {c.drive_count
                              ? `${c.drive_count} drive${c.drive_count === 1 ? "" : "s"} recorded`
                              : "No drives scheduled yet"}
                          </p>
                          {c.website && (
                            <a
                              href={c.website}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="relative z-10 flex w-fit items-center gap-1.5 font-mono underline-offset-2 hover:text-foreground hover:underline"
                            >
                              <Globe className="size-3.5" /> {c.website}
                            </a>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
