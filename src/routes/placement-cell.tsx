import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Bar as ChartBar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Building, CalendarRange, Clock, Mail, MapPin, Phone, UserPlus, Users } from "lucide-react";
import { Shell } from "@/components/dash/Shell";
import { AddMemberDialog } from "@/components/dash/AddMemberDialog";
import { Kpi, Panel, Pill, chartColors, chartCursor, chartTooltip } from "@/components/dash/bits";
import { GateError, GateLoading } from "@/components/load-state";
import {
  getInstitutionOverview,
  getPlacementCellMembers,
  type InstitutionOverview,
  type PlacementCellMember,
} from "@/lib/api";

// Everything on this page is read from /api/institution/overview/ for the signed
// in staff member's own college — the department stats, the office contact and
// the recruiter count. There is no local seed data to drift from the database.
// The pipeline funnel lives on /students instead, where it tracks the filters
// the placement cell is actually looking at.
const RESPONSIBILITIES = [
  "Drive scheduling & student shortlisting",
  "Company onboarding & campus visit management",
  "Mock interview & GD program coordination",
  "Offer letters, acceptance & joining tracking",
  "Readiness assessments & intervention plans",
  "Alumni & industry partnerships",
  "Placement reports & management reviews",
];

const ACCESS_LABEL: Record<string, string> = {
  beta: "Beta access",
  master: "Master access",
};

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((n) => n[0] ?? "")
      .join("")
      .toUpperCase() || "PC"
  );
}

export const Route = createFileRoute("/placement-cell")({
  head: () => ({
    meta: [
      { title: "Placement Cell — TalentBro Placement Dashboard" },
      {
        name: "description",
        content:
          "The Training & Placement Cell behind your college's drives — department analytics, the placement office and who staffs it.",
      },
      { property: "og:title", content: "Placement Cell — TalentBro" },
      {
        property: "og:description",
        content: "Department analytics and the placement office behind your college's drives.",
      },
    ],
  }),
  component: PlacementCellPage,
});

function PlacementCellPage() {
  const [overview, setOverview] = useState<InstitutionOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // The roster is only needed to know whether this account may add members, and
  // to fold a newly-added colleague in without a round trip.
  const [members, setMembers] = useState<PlacementCellMember[] | null>(null);
  const [canAddMembers, setCanAddMembers] = useState(false);
  const [addingMember, setAddingMember] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    getInstitutionOverview()
      .then((data) => {
        if (!cancelled) setOverview(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load the placement cell.");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    let cancelled = false;
    getPlacementCellMembers()
      .then((data) => {
        if (cancelled) return;
        setMembers(data.members);
        setCanAddMembers(data.can_add_members);
      })
      .catch(() => {
        // Not fatal: the page is about the college, and the server independently
        // refuses the add if this account is not a Master. Hiding the button is
        // the right failure mode.
        if (cancelled) return;
        setMembers(null);
        setCanAddMembers(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  if (overview === null && error === null) return <GateLoading />;
  if (overview === null) {
    return (
      <Shell title="Placement Cell" subtitle="The office behind your college's placement season">
        <GateError
          message={error}
          onRetry={() => {
            setReloadKey((n) => n + 1);
          }}
        />
      </Shell>
    );
  }

  const institution = overview.institution;
  const client = overview.client;
  const kpis = overview.kpis;
  const depts = overview.departments.map((d) => ({ ...d, avgCtc: d.avg_expected_ctc }));
  const placed = Math.max(kpis.placed, 1);
  const offerRate = Math.round((kpis.placed / placed) * 100);

  const office = [
    institution.placement_department_name,
    institution.address,
    [institution.city, institution.state, institution.pin_code].filter(Boolean).join(" "),
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");

  return (
    <Shell
      title="Placement Cell"
      subtitle={`${institution.placement_department_name}, ${institution.name}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium">
            <Building className="size-3.5 text-muted-foreground" />
            {institution.institution_type || "Institution"}
          </span>
          {canAddMembers && (
            <button
              onClick={() => setAddingMember(true)}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              <UserPlus className="size-3.5" /> Add Member
            </button>
          )}
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Drives handled"
          value={kpis.active_drives}
          suffix="live"
          icon={CalendarRange}
          hint={`${kpis.recruiters} recruiters on record`}
        />
        <Kpi
          label="Avg. offer rate"
          value={offerRate}
          suffix="%"
          icon={Users}
          hint={`${kpis.placed} of ${kpis.eligible_students} eligible (readiness 40+) placed`}
        />
        <Kpi
          label="Openings"
          value={kpis.total_openings}
          icon={CalendarRange}
          hint={`${kpis.super_dream} super dream recruiters`}
        />
        <Kpi
          label="Verified profiles"
          value={kpis.verified}
          icon={Building}
          hint={`${kpis.unverified} still pending`}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel
          title="Your placement desk"
          description="The officer signed in to this college's account."
          bodyClassName="p-0"
        >
          <ul className="divide-y divide-border">
            {client ? (
              <li className="flex flex-wrap items-center gap-4 px-5 py-4 sm:px-6">
                <div className="grid size-10 shrink-0 place-items-center rounded-md bg-primary font-display text-xs font-bold text-primary-foreground">
                  {initials(client.full_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{client.full_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {client.designation || "Placement Officer"}
                  </p>
                </div>
                <div className="hidden flex-col items-end gap-0.5 md:flex">
                  <a
                    href={`mailto:${client.official_email}`}
                    className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    <Mail className="size-3" />
                    {client.official_email}
                  </a>
                  {client.mobile_number && (
                    <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                      <Phone className="size-3" /> {client.mobile_number}
                    </span>
                  )}
                </div>
                <Pill tone="outline">{ACCESS_LABEL[client.access] ?? client.access}</Pill>
              </li>
            ) : (
              <li className="px-5 py-6 text-sm text-muted-foreground">
                No placement-cell profile is linked to this account yet.
              </li>
            )}
            {institution.placement_office_email && (
              <li className="flex flex-wrap items-center gap-4 px-5 py-4 sm:px-6">
                <div className="grid size-10 shrink-0 place-items-center rounded-md bg-muted font-display text-xs font-bold text-muted-foreground">
                  <Mail className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">Placement office inbox</p>
                  <p className="truncate text-xs text-muted-foreground">
                    Where {institution.name} publishes drive announcements
                  </p>
                </div>
                <a
                  href={`mailto:${institution.placement_office_email}`}
                  className="font-mono text-[11px] text-muted-foreground hover:text-foreground"
                >
                  {institution.placement_office_email}
                </a>
              </li>
            )}
          </ul>
        </Panel>

        <Panel
          title="Office hours & contact"
          description="Walk-in support for students during the placement season."
        >
          <ul className="space-y-3">
            <li className="flex items-center justify-between gap-3 rounded-md border border-border px-3.5 py-2.5">
              <span className="flex items-center gap-2 text-sm">
                <Clock className="size-4 text-muted-foreground" /> Weekdays
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {institution.website ? "See college website" : "During the drive season"}
              </span>
            </li>
            <li className="flex items-center justify-between gap-3 rounded-md border border-border px-3.5 py-2.5">
              <span className="flex items-center gap-2 text-sm">
                <Users className="size-4 text-muted-foreground" /> Students supported
              </span>
              <span className="stat-num text-sm">{kpis.total_students}</span>
            </li>
          </ul>
          <div className="mt-4 space-y-1.5 rounded-md border border-border bg-muted/30 px-3.5 py-3 text-xs text-muted-foreground">
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-3.5 shrink-0" /> {office || "Address not recorded"}
            </p>
            {institution.website && (
              <p className="flex items-center gap-2">
                <Building className="size-3.5" /> {institution.website}
              </p>
            )}
            {institution.placement_office_email && (
              <p className="flex items-center gap-2">
                <Mail className="size-3.5" /> {institution.placement_office_email}
              </p>
            )}
          </div>
        </Panel>
      </div>

      <Panel
        className="mt-4"
        title="What the cell manages"
        description="Every activity that runs between training and a signed offer."
      >
        <ul className="grid gap-2 sm:grid-cols-2">
          {RESPONSIBILITIES.map((r) => (
            <li key={r} className="rounded-md border border-border px-3.5 py-2.5 text-[13px]">
              <span className="mr-2 text-foreground">✓</span>
              {r}
            </li>
          ))}
        </ul>
      </Panel>

      {depts.length > 0 && (
        <Panel
          className="mt-4"
          title="Department Analytics"
          description="Placement rate and average expected CTC by course"
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={depts} margin={{ left: -18, right: 6, top: 6 }}>
              <CartesianGrid stroke={chartColors.grid} vertical={false} />
              <XAxis dataKey="short" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} fontSize={11} />
              <Tooltip contentStyle={chartTooltip} cursor={chartCursor} />
              <ChartBar dataKey="rate" name="Placement %" radius={[4, 4, 0, 0]}>
                {depts.map((d, i) => (
                  <Cell key={d.department} fill={i % 2 ? chartColors.mid : chartColors.ink} />
                ))}
              </ChartBar>
              <ChartBar
                dataKey="avgCtc"
                name="Avg Exp CTC (LPA)"
                fill={chartColors.light}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {depts.map((d) => (
              <div
                key={d.department}
                className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{d.department}</p>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {d.placed}/{d.total} placed · {d.eligible} eligible · ₹{d.avgCtc} LPA avg
                  </p>
                </div>
                <span className="stat-num text-sm">{d.rate}%</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {addingMember && (
        <AddMemberDialog
          onClose={() => setAddingMember(false)}
          onAdded={(member) =>
            setMembers((prev) =>
              prev
                ? [...prev.filter((m) => m.id !== member.id), member].sort((a, b) =>
                    a.full_name.localeCompare(b.full_name),
                  )
                : [member],
            )
          }
        />
      )}
    </Shell>
  );
}
