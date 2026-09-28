import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BarChart,
  Bar as ChartBar,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Building2, Filter, Loader2, Search } from "lucide-react";
import { Shell } from "@/components/dash/Shell";
import {
  Bar,
  Kpi,
  Panel,
  Pill,
  chartColors,
  chartCursor,
  chartTooltip,
} from "@/components/dash/bits";
import { getDrives, type DriveCompanyTier, type PlacementDrive } from "@/lib/api";

export const Route = createFileRoute("/drives")({
  head: () => ({
    meta: [
      { title: "Placement Drives — TalentBro" },
      {
        name: "description",
        content:
          "Campus drives derived from the companies the placement cell recorded, with eligible-candidate pools per drive.",
      },
      { property: "og:title", content: "Placement Drives — TalentBro" },
      {
        property: "og:description",
        content: "Track every campus drive and the eligible student pool behind it.",
      },
    ],
  }),
  component: DrivesPage,
});

const FILTERS = ["All", "Live", "Upcoming", "Completed", "Cancelled"] as const;

const TIER_META: Record<DriveCompanyTier, { label: string; tone: "solid" | "outline" | "muted" }> =
  {
    super_dream: { label: "Super Dream", tone: "solid" },
    dream: { label: "Dream", tone: "outline" },
    core: { label: "Core", tone: "muted" },
    mass: { label: "Mass", tone: "muted" },
  };

function fmtDate(iso: string | null): string {
  if (!iso) return "TBD";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function visitParts(iso: string): { month: string; day: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { month: "—", day: "—" };
  return { month: MONTHS[d.getMonth()] ?? "—", day: String(d.getDate()) };
}

function DrivesPage() {
  const [list, setList] = useState<PlacementDrive[] | null>(null);
  const [driveCount, setDriveCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    getDrives()
      .then((res) => {
        if (cancelled) return;
        setList(res.drives);
        setDriveCount(res.drive_count);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load drives.");
        setList([]);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const all = list ?? [];
  const shown = all.filter(
    (d) =>
      (filter === "All" || d.status === filter) &&
      (q.trim() === "" ||
        `${d.company_name} ${d.industry} ${d.roles.join(" ")} ${d.location ?? ""}`
          .toLowerCase()
          .includes(q.trim().toLowerCase())),
  );
  const active = all.find((d) => d.company_id === activeId) ?? shown[0] ?? null;
  const bestPool = Math.max(1, ...all.map((d) => d.eligible_count));

  if (list === null) {
    return (
      <Shell title="Placement Drives" subtitle="Plan, run and audit every campus hiring drive">
        <div className="grid min-h-[50vh] place-items-center">
          <span className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
            <Loader2 className="size-3.5 animate-spin" /> Loading drives…
          </span>
        </div>
      </Shell>
    );
  }

  if (error !== null) {
    return (
      <Shell title="Placement Drives" subtitle="Plan, run and audit every campus hiring drive">
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{error}</p>
            <button
              onClick={() => {
                setList(null);
                setReloadKey((n) => n + 1);
              }}
              className="rounded-md border border-border px-3.5 py-2 text-xs font-medium hover:bg-accent"
            >
              Try again
            </button>
          </div>
        </Panel>
      </Shell>
    );
  }

  const totalOpenings = all.reduce((a, d) => a + (d.openings ?? 0), 0);
  const eligiblePool = all.reduce((a, d) => a + d.eligible_count, 0);

  const tierMix = (Object.keys(TIER_META) as DriveCompanyTier[])
    .map((tier) => ({
      tier,
      label: TIER_META[tier].label,
      drives: all.filter((d) => d.tier === tier).length,
      openings: all.filter((d) => d.tier === tier).reduce((a, d) => a + (d.openings ?? 0), 0),
    }))
    .filter((row) => row.drives > 0);
  const upcomingVisits = all
    .filter((d) => d.campus_visit_date)
    .sort((a, b) => (a.campus_visit_date ?? "").localeCompare(b.campus_visit_date ?? ""))
    .slice(0, 4);

  return (
    <Shell
      title="Placement Drives"
      subtitle="Drives come from the companies recorded on the Companies page — with the eligible pool standing behind each one"
      actions={
        <Link
          to="/companies"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          <Building2 className="size-3.5" /> Add Company
        </Link>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Total Drives" value={driveCount} hint="drive records for this college" />
        <Kpi
          label="Live Now"
          value={all.filter((d) => d.status === "Live").length}
          hint="in progress"
        />
        <Kpi label="Openings" value={totalOpenings} hint="open roles across drives" />
        <Kpi label="Eligible Pool" value={eligiblePool} hint="readiness 40+ and unplaced" />
      </div>

      {tierMix.length > 1 && (
        <Panel
          className="mt-4"
          title="Hiring mix by tier"
          description="Drives and openings announced per recruiter tier"
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={tierMix} margin={{ left: -22, right: 6, top: 6 }}>
              <CartesianGrid stroke={chartColors.grid} vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={chartTooltip} cursor={chartCursor} />
              <ChartBar
                dataKey="drives"
                name="Drives"
                fill={chartColors.ink}
                radius={[4, 4, 0, 0]}
                barSize={40}
              />
              <ChartBar
                dataKey="openings"
                name="Openings"
                fill={chartColors.light}
                radius={[4, 4, 0, 0]}
                barSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      )}

      <Panel className="mt-4" bodyClassName="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search drives by company, role or location…"
              aria-label="Search drives"
              className="h-9 w-full rounded-md border border-input bg-card pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/20"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="size-3.5 text-muted-foreground" />
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  filter === f
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:bg-accent"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </Panel>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {shown.map((d) => (
            <button
              key={d.company_id}
              onClick={() => setActiveId(d.company_id)}
              className={`panel block w-full p-5 text-left transition-shadow hover:shadow-md ${
                active?.company_id === d.company_id ? "ring-2 ring-ring/30" : ""
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">
                    {d.company_name}
                    {d.roles.length > 0 ? (
                      <span className="text-muted-foreground"> — {d.roles.join(", ")}</span>
                    ) : (
                      <span className="text-muted-foreground"> — {d.industry}</span>
                    )}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    {fmtDate(d.campus_visit_date)} · {d.mode} · {d.location ?? "Location TBD"} · ₹
                    {d.ctc_min ?? "—"}–{d.ctc_max ?? "—"} LPA
                    {d.minimum_cgpa !== null ? ` · CGPA ≥ ${d.minimum_cgpa}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Pill tone={d.status === "Live" ? "solid" : "outline"}>{d.status}</Pill>
                  <Pill tone={TIER_META[d.tier]?.tone ?? "muted"}>
                    {TIER_META[d.tier]?.label ?? d.tier}
                  </Pill>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Openings", d.openings ?? 0, d.openings ?? 0],
                  ["Eligible", d.eligible_count, bestPool],
                  [
                    "Selection rounds",
                    d.selection_rounds.length,
                    Math.max(1, d.selection_rounds.length),
                  ],
                  ["Backlogs allowed", d.maximum_backlogs ?? 0, 1],
                ].map(([l, v, max]) => (
                  <div key={l as string}>
                    <p className="mono-label">{l}</p>
                    <p className="stat-num text-lg">{v}</p>
                    <div className="mt-1.5">
                      <Bar value={Number(v)} max={Number(max) || 1} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {d.eligible_branches.length > 0 ? (
                  d.eligible_branches.map((b) => <Pill key={b}>{b}</Pill>)
                ) : (
                  <Pill>All branches</Pill>
                )}
                {d.eligible_courses.length > 0
                  ? d.eligible_courses.map((c) => <Pill key={c}>all {c}</Pill>)
                  : null}
              </div>
            </button>
          ))}
          {shown.length === 0 && (
            <Panel>
              <p className="py-8 text-center text-sm text-muted-foreground">
                {all.length === 0
                  ? "No drives yet — record a company and its drive appears here automatically."
                  : "No drives match this filter or search."}
              </p>
              {all.length === 0 && (
                <div className="flex justify-center pb-6">
                  <Link
                    to="/companies"
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground hover:opacity-90"
                  >
                    <Building2 className="size-3.5" /> Add Company
                  </Link>
                </div>
              )}
            </Panel>
          )}
        </div>

        <div className="space-y-4">
          <Panel
            title="Drive Snapshot"
            description={active ? active.company_name : "Select a drive"}
          >
            {active ? (
              <div className="space-y-3">
                {[
                  ["Open roles", String(active.openings ?? 0)],
                  ["Eligible candidates", `${active.eligible_count} students`],
                  [
                    "Minimum CGPA",
                    active.minimum_cgpa !== null ? String(active.minimum_cgpa) : "—",
                  ],
                  ["Backlogs allowed", String(active.maximum_backlogs ?? 0)],
                  ["Apply by", fmtDate(active.application_deadline)],
                  ["Campus visit", fmtDate(active.campus_visit_date)],
                  [
                    "Offer status",
                    active.offer_status ? active.offer_status.replace("_", " ") : "—",
                  ],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md border border-border px-3.5 py-2.5">
                    <p className="mono-label">{label}</p>
                    <p className="mt-1 truncate text-sm font-medium">{value}</p>
                  </div>
                ))}
                <div className="pt-1">
                  <div className="flex justify-between text-xs">
                    <span>Front of the queue</span>
                    <span className="font-mono text-muted-foreground">
                      {active.eligible_count} of {bestPool} highest pool
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <Bar value={active.eligible_count} max={bestPool} />
                  </div>
                </div>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No drive selected.</p>
            )}
          </Panel>

          <Panel
            title="Selection Rounds"
            description={active ? active.company_name : "Select a drive"}
            bodyClassName="p-0"
          >
            {active && active.selection_rounds.length > 0 ? (
              <ul className="divide-y divide-border">
                {active.selection_rounds.map((r, i) => (
                  <li key={`${r}-${i}`} className="flex items-center gap-3 px-5 py-3">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted font-mono text-[11px] font-bold">
                      {i + 1}
                    </span>
                    <span className="text-xs font-medium">{r}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                {active ? "No rounds recorded." : "No drive selected."}
              </p>
            )}
          </Panel>

          <Panel
            title="Next Campus Visits"
            description="Scheduled visits from the drives on record"
            bodyClassName="p-0"
          >
            {upcomingVisits.length > 0 ? (
              <ul className="divide-y divide-border">
                {upcomingVisits.map((d) => {
                  const { month, day } = visitParts(d.campus_visit_date as string);
                  return (
                    <li
                      key={`${d.company_id}-${d.campus_visit_date}`}
                      className="flex gap-3 px-5 py-3.5"
                    >
                      <div className="grid w-16 shrink-0 place-items-center rounded-md border border-border px-1 py-1 text-center">
                        <span className="font-mono text-[9px] uppercase text-muted-foreground">
                          {month}
                        </span>
                        <span className="stat-num text-sm">{day}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{d.company_name}</p>
                        <p className="truncate font-mono text-[11px] text-muted-foreground">
                          {d.mode} · {d.location ?? "Location TBD"}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                No campus visits scheduled yet.
              </p>
            )}
          </Panel>
        </div>
      </div>
    </Shell>
  );
}
