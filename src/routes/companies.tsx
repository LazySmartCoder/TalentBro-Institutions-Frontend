import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Building2, Copy, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/dash/Shell";
import { Kpi, Panel, Pill } from "@/components/dash/bits";
import { companies as fallbackCompanies, type Company as SeedCompany } from "@/lib/data";
import {
  createCompany,
  getCompanies,
  type DriveCompanyTier,
  type PlacementCompany,
} from "@/lib/api";

export const Route = createFileRoute("/companies")({
  head: () => ({
    meta: [
      { title: "Companies — TalentBro Recruiter Network" },
      {
        name: "description",
        content:
          "Track recruiter relationships, hiring tiers, CTC bands, SPOC contacts and offer counts across every campus partner.",
      },
      { property: "og:title", content: "Companies — TalentBro" },
      {
        property: "og:description",
        content: "Recruiter network with tiers, CTC bands, SPOC contacts and offer history.",
      },
    ],
  }),
  component: CompanyPage,
});

const TIERS = ["All", "Super Dream", "Dream", "Core", "Mass"];
const STATUS = ["All", "Upcoming", "Ongoing", "Completed", "Cancelled"];

const TIER_LABEL: Record<DriveCompanyTier, string> = {
  super_dream: "Super Dream",
  dream: "Dream",
  core: "Core",
  mass: "Mass",
};

const STATUS_LABEL: Record<string, string> = {
  upcoming: "Upcoming",
  ongoing: "Ongoing",
  completed: "Completed",
  cancelled: "Cancelled",
};

const WORK_MODE_LABEL: Record<string, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "On-site",
  field: "Field / Outside",
};

const PLACEMENT_MODE_LABEL: Record<string, string> = {
  full_time: "Full-time",
  internship_ppo: "Internship + PPO",
  contract: "Contract",
};

const OFFER_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  offered: "Offered",
  on_hold: "On Hold",
  revoked: "Revoked",
};

const SEED_TIER: Record<SeedCompany["tier"], DriveCompanyTier> = {
  "Super Dream": "super_dream",
  Dream: "dream",
  Core: "core",
  Mass: "mass",
};

const SEED_STATUS: Record<string, string> = {
  Active: "ongoing",
  Onboarding: "upcoming",
  Archived: "cancelled",
};

// Offline fallback so the page stays usable while the backend is down.
function seedToPlacement(c: SeedCompany): PlacementCompany {
  return {
    id: Number(c.id.replace("cmp-", "")) || 0,
    company_id: c.id,
    company_name: c.name,
    industry: c.sector,
    company_description: `Recruiter partner in ${c.sector}, headquartered at ${c.hq}.`,
    job_roles: c.openRoles,
    eligible_courses: ["B.Tech", "MCA"],
    eligible_branches: ["CSE", "IT", "ECE"],
    minimum_cgpa: 6.5,
    maximum_backlogs: 2,
    graduation_year: 2026,
    required_skills: ["SQL", "Java"],
    preferred_skills: [],
    salary_min: c.ctcMin,
    salary_max: c.ctcMax,
    work_location: c.hq,
    work_mode: "onsite",
    number_of_openings: c.offers2026,
    selection_rounds: ["Aptitude Test", "Technical Interview", "HR Round"],
    application_deadline: null,
    campus_visit_date: null,
    recruitment_status: SEED_STATUS[c.status] ?? "upcoming",
    placement_mode: "full_time",
    offer_status: "pending",
    tier: SEED_TIER[c.tier],
    institution: null,
    created_at: "",
    updated_at: "",
  };
}

function fmtDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function lpa(value: number | null): string {
  return value == null ? "—" : `₹${value} LPA`;
}

function CompanyPage() {
  const [list, setList] = useState<PlacementCompany[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState("");
  const [tier, setTier] = useState("All");
  const [status, setStatus] = useState("All");
  const [view, setView] = useState<"grid" | "table">("grid");
  const [selected, setSelected] = useState<PlacementCompany | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    company_name: "",
    industry: "",
    work_location: "",
    tier: "core",
    salary_min: "",
    salary_max: "",
    number_of_openings: "",
    job_roles: "",
  });

  const inputCls =
    "h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring/20";

  async function submitCompany(e: FormEvent) {
    e.preventDefault();
    if (!draft.company_name.trim() || saving) return;
    setSaving(true);
    try {
      const created = await createCompany({
        company_name: draft.company_name.trim(),
        industry: draft.industry.trim(),
        work_location: draft.work_location.trim(),
        tier: draft.tier as DriveCompanyTier,
        salary_min: draft.salary_min ? Number(draft.salary_min) : null,
        salary_max: draft.salary_max ? Number(draft.salary_max) : null,
        number_of_openings: draft.number_of_openings ? Number(draft.number_of_openings) : null,
        job_roles: draft.job_roles
          .split(",")
          .map((r) => r.trim())
          .filter(Boolean),
      });
      setList((prev) => [created, ...prev]);
      toast.success(`Added ${created.company_name}`);
      setDraft({
        company_name: "",
        industry: "",
        work_location: "",
        tier: "core",
        salary_min: "",
        salary_max: "",
        number_of_openings: "",
        job_roles: "",
      });
      setAdding(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add the company.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    getCompanies()
      .then((data) => {
        if (cancelled) return;
        setList(data.companies);
        setLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setList(fallbackCompanies.map(seedToPlacement));
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const shown = useMemo(
    () =>
      list.filter(
        (c) =>
          `${c.company_name} ${c.industry} ${c.work_location} ${c.job_roles.join(" ")}`
            .toLowerCase()
            .includes(q.toLowerCase()) &&
          (tier === "All" || TIER_LABEL[c.tier] === tier) &&
          (status === "All" ||
            (STATUS_LABEL[c.recruitment_status] ?? c.recruitment_status) === status),
      ),
    [list, q, tier, status],
  );

  const openings = shown.reduce((a, b) => a + (b.number_of_openings ?? 0), 0);
  const topCtc = shown.reduce((a, b) => Math.max(a, b.salary_max ?? 0), 0);

  return (
    <Shell
      title="Companies"
      subtitle="Recruiter network and campus hiring partners"
      actions={
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="size-3.5" /> Add Company
        </button>
      }
    >
      {!loaded ? (
        <div className="grid min-h-[50vh] place-items-center">
          <span className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
            Loading companies…
          </span>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Partners" value={shown.length} hint="in selection" icon={Building2} />
            <Kpi label="Openings" value={openings} hint="across drives" />
            <Kpi label="Highest CTC" value={topCtc ? lpa(topCtc) : "—"} hint="ceiling offered" />
            <Kpi
              label="Super Dream"
              value={shown.filter((c) => c.tier === "super_dream").length}
              hint="₹12 LPA+ bracket"
            />
          </div>

          <Panel className="mt-4" bodyClassName="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search companies, industries, roles…"
                  className="h-9 w-full rounded-md border border-input bg-card pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/20"
                />
              </div>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value)}
                className="h-9 rounded-md border border-input bg-card px-3 text-sm"
              >
                {TIERS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-9 rounded-md border border-input bg-card px-3 text-sm"
              >
                {STATUS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <div className="flex rounded-md border border-border p-0.5">
                {(["grid", "table"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={`rounded px-3 py-1.5 text-xs font-medium capitalize ${
                      view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </Panel>

          {view === "grid" ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className="panel p-5 text-left transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 place-items-center rounded-md bg-muted font-display text-xs font-bold">
                        {c.company_name.slice(0, 2).toUpperCase()}
                      </span>
                      <div>
                        <p className="text-sm font-semibold leading-tight">{c.company_name}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">
                          {c.industry} · {c.work_location}
                        </p>
                      </div>
                    </div>
                    <Pill tone={c.tier === "super_dream" ? "solid" : "outline"}>
                      {TIER_LABEL[c.tier]}
                    </Pill>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-md bg-muted py-2">
                      <p className="stat-num text-sm">{lpa(c.salary_max)}</p>
                      <p className="mono-label">Max CTC</p>
                    </div>
                    <div className="rounded-md bg-muted py-2">
                      <p className="stat-num text-sm">{c.number_of_openings ?? "—"}</p>
                      <p className="mono-label">Openings</p>
                    </div>
                    <div className="rounded-md bg-muted py-2">
                      <p className="stat-num text-sm">{c.minimum_cgpa ?? "—"}</p>
                      <p className="mono-label">Min CGPA</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {c.job_roles.slice(0, 3).map((r) => (
                      <Pill key={r}>{r}</Pill>
                    ))}
                  </div>
                  <p className="mt-3 border-t border-border pt-2 text-[11px] text-muted-foreground">
                    {PLACEMENT_MODE_LABEL[c.placement_mode] ?? c.placement_mode} ·{" "}
                    {STATUS_LABEL[c.recruitment_status] ?? c.recruitment_status} · visit{" "}
                    {fmtDate(c.campus_visit_date)}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <Panel className="mt-4" bodyClassName="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      {["Company", "Tier", "Industry", "CTC Band", "Openings", "Status", ""].map(
                        (h) => (
                          <th key={h} className="mono-label px-5 py-3 font-normal">
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {shown.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/60">
                        <td className="px-5 py-3 font-medium">{c.company_name}</td>
                        <td className="px-5 py-3">
                          <Pill tone={c.tier === "super_dream" ? "solid" : "outline"}>
                            {TIER_LABEL[c.tier]}
                          </Pill>
                        </td>
                        <td className="px-5 py-3 text-xs text-muted-foreground">{c.industry}</td>
                        <td className="px-5 py-3 font-mono text-xs">
                          {lpa(c.salary_min)} – {lpa(c.salary_max)}
                        </td>
                        <td className="px-5 py-3 font-mono">{c.number_of_openings ?? "—"}</td>
                        <td className="px-5 py-3">
                          <Pill tone={c.recruitment_status === "ongoing" ? "solid" : "muted"}>
                            {STATUS_LABEL[c.recruitment_status] ?? c.recruitment_status}
                          </Pill>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => setSelected(c)}
                            className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </>
      )}

      {adding && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center">
          <form
            onSubmit={submitCompany}
            className="panel max-h-[90vh] w-full max-w-lg overflow-y-auto"
          >
            <div className="flex items-start justify-between border-b border-border px-6 py-5">
              <div>
                <h2 className="text-lg font-bold">Add company</h2>
                <p className="font-mono text-xs text-muted-foreground">
                  Record a new campus partner for your institution
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAdding(false)}
                aria-label="Close"
                className="rounded-md p-1 hover:bg-accent"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mono-label" htmlFor="cc-name">
                  Company name *
                </label>
                <input
                  id="cc-name"
                  value={draft.company_name}
                  onChange={(e) => setDraft({ ...draft, company_name: e.target.value })}
                  placeholder="e.g. TCS"
                  className={`${inputCls} mt-1.5`}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mono-label" htmlFor="cc-industry">
                  Industry
                </label>
                <input
                  id="cc-industry"
                  value={draft.industry}
                  onChange={(e) => setDraft({ ...draft, industry: e.target.value })}
                  placeholder="e.g. IT Services"
                  className={`${inputCls} mt-1.5`}
                />
              </div>
              <div>
                <label className="mono-label" htmlFor="cc-tier">
                  Hiring tier
                </label>
                <select
                  id="cc-tier"
                  value={draft.tier}
                  onChange={(e) => setDraft({ ...draft, tier: e.target.value })}
                  className={`${inputCls} mt-1.5`}
                >
                  {(["core", "mass", "dream", "super_dream"] as const).map((t) => (
                    <option key={t} value={t}>
                      {TIER_LABEL[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mono-label" htmlFor="cc-location">
                  Work location
                </label>
                <input
                  id="cc-location"
                  value={draft.work_location}
                  onChange={(e) => setDraft({ ...draft, work_location: e.target.value })}
                  placeholder="e.g. Bangalore"
                  className={`${inputCls} mt-1.5`}
                />
              </div>
              <div>
                <label className="mono-label" htmlFor="cc-salary-min">
                  Min CTC (LPA)
                </label>
                <input
                  id="cc-salary-min"
                  type="number"
                  min="0"
                  step="0.5"
                  value={draft.salary_min}
                  onChange={(e) => setDraft({ ...draft, salary_min: e.target.value })}
                  placeholder="e.g. 4"
                  className={`${inputCls} mt-1.5`}
                />
              </div>
              <div>
                <label className="mono-label" htmlFor="cc-salary-max">
                  Max CTC (LPA)
                </label>
                <input
                  id="cc-salary-max"
                  type="number"
                  min="0"
                  step="0.5"
                  value={draft.salary_max}
                  onChange={(e) => setDraft({ ...draft, salary_max: e.target.value })}
                  placeholder="e.g. 8"
                  className={`${inputCls} mt-1.5`}
                />
              </div>
              <div>
                <label className="mono-label" htmlFor="cc-openings">
                  Openings
                </label>
                <input
                  id="cc-openings"
                  type="number"
                  min="0"
                  value={draft.number_of_openings}
                  onChange={(e) => setDraft({ ...draft, number_of_openings: e.target.value })}
                  placeholder="e.g. 20"
                  className={`${inputCls} mt-1.5`}
                />
              </div>
              <div>
                <label className="mono-label" htmlFor="cc-roles">
                  Job roles
                </label>
                <input
                  id="cc-roles"
                  value={draft.job_roles}
                  onChange={(e) => setDraft({ ...draft, job_roles: e.target.value })}
                  placeholder="SDE, Analyst (comma separated)"
                  className={`${inputCls} mt-1.5`}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="rounded-md border border-border px-3.5 py-2 text-xs font-medium hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !draft.company_name.trim()}
                className="rounded-md bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving…" : "Add company"}
              </button>
            </div>
          </form>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center">
          <div className="panel max-h-[90vh] w-full max-w-xl overflow-y-auto">
            <div className="flex items-start justify-between border-b border-border px-6 py-5">
              <div>
                <h2 className="text-lg font-bold">{selected.company_name}</h2>
                <p className="font-mono text-xs text-muted-foreground">
                  {selected.industry} · {selected.work_location} · {selected.company_id}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                aria-label="Close"
                className="rounded-md p-1 hover:bg-accent"
              >
                <X className="size-4" />
              </button>
            </div>
            {selected.company_description && (
              <p className="border-b border-border px-6 py-4 text-sm text-muted-foreground">
                {selected.company_description}
              </p>
            )}
            <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
              {[
                ["Hiring tier", TIER_LABEL[selected.tier]],
                ["CTC band", `${lpa(selected.salary_min)} – ${lpa(selected.salary_max)}`],
                ["Openings", String(selected.number_of_openings ?? "—")],
                ["Work location", selected.work_location || "—"],
                ["Work mode", WORK_MODE_LABEL[selected.work_mode] ?? selected.work_mode],
                [
                  "Placement mode",
                  PLACEMENT_MODE_LABEL[selected.placement_mode] ?? selected.placement_mode,
                ],
                [
                  "Recruitment status",
                  STATUS_LABEL[selected.recruitment_status] ?? selected.recruitment_status,
                ],
                [
                  "Offer status",
                  OFFER_STATUS_LABEL[selected.offer_status] ?? selected.offer_status,
                ],
                ["Min CGPA", String(selected.minimum_cgpa ?? "—")],
                ["Max backlogs", String(selected.maximum_backlogs ?? "—")],
                ["Batch year", String(selected.graduation_year ?? "—")],
                ["Application deadline", fmtDate(selected.application_deadline)],
                ["Campus visit", fmtDate(selected.campus_visit_date)],
                ["Eligible courses", selected.eligible_courses.join(", ") || "—"],
                ["Eligible branches", selected.eligible_branches.join(", ") || "—"],
                ["Required skills", selected.required_skills.join(", ") || "—"],
                ["Preferred skills", selected.preferred_skills.join(", ") || "—"],
                ["Job roles", selected.job_roles.join(", ") || "—"],
                ["Selection rounds", selected.selection_rounds.join(" → ") || "—"],
              ].map(([l, v]) => (
                <div key={l} className="rounded-md border border-border px-3.5 py-2.5">
                  <p className="mono-label">{l}</p>
                  <p className="mt-1 truncate text-sm font-medium">{v}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(
                    `${selected.company_name} — ${selected.company_id}`,
                  );
                  toast.success(`Copied ${selected.company_name} details`);
                }}
                className="inline-flex items-center gap-2 rounded-md border border-border px-3.5 py-2 text-xs font-medium hover:bg-accent"
              >
                <Copy className="size-3.5" /> Copy details
              </button>
              <button
                onClick={() => {
                  toast.success(`Drive request raised with ${selected.company_name}`);
                  setSelected(null);
                }}
                className="rounded-md bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground hover:opacity-90"
              >
                Invite for drive
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
