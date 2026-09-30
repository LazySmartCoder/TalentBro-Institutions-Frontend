import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CircleAlert,
  Download,
  ExternalLink,
  Loader2,
  Search,
  SlidersHorizontal,
  Upload,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/dash/Shell";
import {
  Kpi,
  Panel,
  Pill,
  chartColors,
  chartCursor,
  chartFill,
  chartTooltip,
} from "@/components/dash/bits";
import { addStudents, checkStudentsExist, getInstitutionOverview, getStudents } from "@/lib/api";
import type { ExistingStudent, PlacementStatus, StudentRecord } from "@/lib/api";

export const Route = createFileRoute("/students")({
  // The header search in the dashboard shell lands here with a ?q= term, so the
  // directory keeps whatever the user typed and stays shareable as a URL.
  validateSearch: (search: Record<string, unknown>): { q?: string } => {
    const q = typeof search["q"] === "string" ? search["q"].trim() : "";
    return q ? { q } : {};
  },
  head: () => ({
    meta: [
      { title: "Students — TalentBro Placement Dashboard" },
      {
        name: "description",
        content:
          "Search, filter and review student profiles with CGPA, eligibility, skills and placement status from the live database.",
      },
      { property: "og:title", content: "Students — TalentBro" },
      {
        property: "og:description",
        content: "Searchable student directory with CGPA, eligibility and placement status.",
      },
    ],
  }),
  component: StudentsPage,
});

const STATUS_OPTIONS: { value: "All" | "placed" | "not_placed"; label: string }[] = [
  { value: "All", label: "All statuses" },
  { value: "placed", label: "Placed" },
  { value: "not_placed", label: "Not Placed" },
];

// The stored key stays "not_started" for historical rows; it reads as
// "Ineligible" in the UI because that is what the eligibility rule now means by
// it - a not_started candidate is ineligible whatever their readiness score is.
const STATUS_LABEL: Record<PlacementStatus, string> = {
  placed: "Placed",
  shortlisted: "Shortlisted",
  applying: "Applying",
  not_started: "Ineligible",
};

function statusTone(status: PlacementStatus): "solid" | "outline" | "muted" {
  if (status === "placed") return "solid";
  if (status === "not_started") return "muted";
  return "outline";
}

/** Lifetime platform minutes as "2h 15m" / "45 min". */
function fmtDuration(minutes?: number | null) {
  const total = Math.max(0, Math.round(minutes ?? 0));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return hours === 0 ? `${mins} min` : `${hours}h ${mins}m`;
}

/** AI spend in INR to the paisa; it accrues in fractions of a rupee. */
function fmtInr(value?: number | null) {
  if (value == null) return "—";
  return `₹${value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// Whether this student counts as placement eligible anywhere in the product.
// Eligibility is decided once, server-side, from the readiness score
// (score >= 40). Reading the resolved flag rather than recomputing it here is
// what stops this page from drifting from the dashboard, reports and drive
// pools: there is only one rule and only one implementation of it.
function isEligible(s: StudentRecord): boolean {
  return s.placement_eligible;
}

const CSV_COLUMNS: [keyof StudentRecord | ((s: StudentRecord) => unknown), string][] = [
  ["id", "Candidate ID"],
  ["full_name", "Name"],
  ["department", "Department"],
  ["program", "Program"],
  ["cgpa", "CGPA"],
  ["performance_score", "Readiness"],
  ["overall_rank", "Institute rank"],
  ["placement_status", "Placement status"],
  [(s) => (isEligible(s) ? "Yes" : "No"), "Eligible"],
  ["expected_ctc", "Expected CTC (LPA)"],
  ["end_year", "Graduating"],
  ["mobile_number", "Phone"],
];

function csvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadStudentsCsv(rows: StudentRecord[], fileLabel: string) {
  if (rows.length === 0) {
    toast.error("There are no matching students to export.");
    return;
  }
  const body = [
    CSV_COLUMNS.map(([, header]) => header).join(","),
    ...rows.map((row) =>
      CSV_COLUMNS.map(([key]) => csvCell(typeof key === "function" ? key(row) : row[key])).join(
        ",",
      ),
    ),
  ].join("\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${body}`], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `talentbro-students-${fileLabel}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
  toast.success(`Exported ${rows.length} student records.`);
}

function StudentsPage() {
  const navigate = useNavigate();
  const { q: qFromUrl } = Route.useSearch();
  const [rows, setRows] = useState<StudentRecord[] | null>(null);
  const [collegeTotal, setCollegeTotal] = useState<number | null>(null);
  const [collegeStrength, setCollegeStrength] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState(qFromUrl ?? "");
  const [dept, setDept] = useState<string>("All");
  const [status, setStatus] = useState<string>("All");
  const [minCgpa, setMinCgpa] = useState(0);
  const [sort, setSort] = useState<"name" | "cgpa" | "expected_ctc" | "performance">("cgpa");
  const [selected, setSelected] = useState<StudentRecord | null>(null);
  const [addingStudents, setAddingStudents] = useState(false);
  const [page, setPage] = useState(0);
  // The college's own departments, as configured on the institution record. Both
  // the branch chart and the department filter are built from this list, so they
  // show exactly the departments the college declared instead of whatever the
  // filtered rows happen to contain.
  const [institutionDepartments, setInstitutionDepartments] = useState<string[]>([]);
  const [institutionName, setInstitutionName] = useState<string | null>(null);
  // Bumped after a bulk add so the directory re-reads the roll and the new
  // students show up without the placement cell having to reload by hand.
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getInstitutionOverview()
      .then((res) => {
        if (cancelled) return;
        setInstitutionDepartments((res.institution.departments ?? []).map((d) => d.trim()));
        setInstitutionName(res.institution.name || null);
      })
      // Non-fatal: the chart and filter then fall back to having no departments.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const incoming = qFromUrl ?? "";
    setQ((current) => (current === incoming ? current : incoming));
  }, [qFromUrl]);

  // Searching is an explicit submit — the button beside the box, or Enter in it.
  // Typing only fills the box, so nothing refetches until the term is committed.
  //
  // `resetScroll: false` is the load-bearing part: the router treats this as a
  // navigation and would otherwise scroll the window back to the top, yanking
  // the table out from under the user. `replace` keeps a search from burying the
  // page under history entries.
  function submitSearch() {
    const term = q.trim();
    setPage(0);
    void navigate({
      to: "/students",
      search: term ? { q: term } : {},
      replace: true,
      resetScroll: false,
    });
  }

  useEffect(() => {
    let cancelled = false;
    setError(null);
    const query: Parameters<typeof getStudents>[0] = {
      q: qFromUrl ?? "",
      dept,
      status,
      eligible: false,
      sort,
    };
    if (minCgpa > 0) query.min_cgpa = minCgpa;
    getStudents(query)
      .then((res) => {
        if (cancelled) return;
        setRows(res.students);
        setCollegeTotal(res.total);
        setCollegeStrength(res.approximate_student_strength);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load students.");
        setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [dept, status, minCgpa, sort, qFromUrl, reloadToken]);

  const filtered = rows ?? [];
  const placed = filtered.filter((s) => s.placement_status === "placed");
  const cgpas = filtered.map((s) => s.cgpa).filter((c): c is number => c !== null);
  const avgCgpa = cgpas.length ? cgpas.reduce((a, b) => a + b, 0) / cgpas.length : 0;
  // Students in the selection whose readiness score clears the placement bar.
  const eligible = filtered.filter(isEligible).length;

  // Same pipeline as before, computed off whatever the filters currently select.
  // "Eligible" reuses the KPI figure above rather than re-deriving it, so this
  // chart and the card beside it can never print two different numbers for the
  // same word. The first bar is Ineligible - everyone in the selection who did
  // not clear the readiness bar - so the chart opens with the split that decides
  // the rest of the pipeline.
  const inSelection = filtered.filter(
    (s) =>
      s.placement_status === "applying" ||
      s.placement_status === "shortlisted" ||
      s.placement_status === "placed",
  ).length;
  const shortlisted = filtered.filter((s) => s.placement_status === "shortlisted").length;
  const momentum = [
    { stage: "Ineligible", value: filtered.length - eligible },
    { stage: "Eligible", value: eligible },
    { stage: "Applied", value: inSelection },
    { stage: "Shortlisted", value: shortlisted },
    { stage: "Placed", value: placed.length },
  ];
  const momentumMax = Math.max(1, ...momentum.map((m) => m.value));

  // The chart shows exactly the departments listed on the institution record and
  // nothing else: one bar per configured department, counting only the students
  // sitting in that department. A student whose department is not in the list is
  // left out of the chart rather than inventing a branch the college never set up.
  const branches = institutionDepartments
    .filter(Boolean)
    .map((department) => {
      const key = department.toLowerCase();
      const inBranch = filtered.filter((s) => (s.department?.trim().toLowerCase() ?? "") === key);
      return {
        label: department,
        total: inBranch.length,
        placed: inBranch.filter((s) => s.placement_status === "placed").length,
      };
    })
    .sort((a, b) => b.total - a.total);

  const pageSize = 12;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages - 1);
  const rowsOnPage = filtered.slice(current * pageSize, current * pageSize + pageSize);

  return (
    <Shell
      title="Students"
      subtitle={
        rows === null
          ? "Loading the live batch…"
          : `${filtered.length} of the live batch match the current filters`
      }
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAddingStudents(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <UserPlus className="size-3.5" /> Add Students
          </button>
          <button
            onClick={() => downloadStudentsCsv(filtered, new Date().toISOString().slice(0, 10))}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3.5 py-2 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
          >
            <Download className="size-3.5" /> Export CSV
          </button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Total Students"
          value={(collegeTotal ?? filtered.length).toLocaleString("en-IN")}
          hint={`out of ${collegeStrength?.toLocaleString("en-IN") ?? "—"}`}
        />
        <Kpi
          label="Placed"
          value={placed.length}
          hint={`${Math.round((placed.length / Math.max(1, filtered.length)) * 100)}% of selection`}
        />
        <Kpi
          label="Average CGPA"
          value={avgCgpa ? avgCgpa.toFixed(2) : "—"}
          hint="matching filters"
        />
        <Kpi label="Eligible" value={eligible} hint="readiness score 40 or above" />
      </div>

      {branches.length > 1 && (
        <Panel
          className="mt-4"
          title="Students by branch"
          description="Headcount and placements for the departments listed on your institution record"
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={branches} margin={{ left: -22, right: 6, top: 6 }}>
              <CartesianGrid stroke={chartColors.grid} vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                fontSize={10}
                angle={-35}
                textAnchor="end"
                interval={0}
                height={64}
              />
              <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={chartTooltip} cursor={chartCursor} />
              <Bar
                dataKey="total"
                name="Students"
                fill={chartColors.ink}
                radius={[4, 4, 0, 0]}
                barSize={28}
              />
              <Bar
                dataKey="placed"
                name="Placed"
                fill={chartColors.mid}
                radius={[4, 4, 0, 0]}
                barSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      )}

      <Panel
        className="mt-4"
        title="Placement Momentum"
        description="Students at each stage of this season's pipeline"
      >
        {filtered.length > 0 ? (
          <ResponsiveContainer width="100%" height={268}>
            <BarChart data={momentum} margin={{ left: -18, right: 6, top: 6 }}>
              <CartesianGrid stroke={chartColors.grid} vertical={false} />
              <XAxis dataKey="stage" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} fontSize={11} domain={[0, momentumMax]} />
              <Tooltip contentStyle={chartTooltip} cursor={chartCursor} />
              <Bar dataKey="value" name="Students" radius={[4, 4, 0, 0]} barSize={44}>
                {momentum.map((d, i) => (
                  <Cell key={d.stage} fill={chartFill(i)} />
                ))}
                <LabelList dataKey="value" position="top" fontSize={11} fill="oklch(0.35 0 0)" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No students match the current filters, so there is no pipeline to chart.
          </p>
        )}
      </Panel>

      <Panel className="mt-4" bodyClassName="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitSearch();
            }}
            className="flex min-w-[220px] flex-1 items-center gap-2"
          >
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name, candidate ID or branch…"
                aria-label="Search students"
                className="h-9 w-full rounded-md border border-input bg-card pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/20"
              />
            </div>
            <button
              type="submit"
              aria-label="Search"
              title="Search"
              className="grid size-9 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Search className="size-4" />
            </button>
          </form>
          <select
            value={dept}
            onChange={(e) => setDept(e.target.value)}
            aria-label="Filter by department"
            className="h-9 rounded-md border border-input bg-card px-3 text-sm outline-none"
          >
            <option value="All">All departments</option>
            {institutionDepartments.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-9 rounded-md border border-input bg-card px-3 text-sm outline-none"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <label className="flex h-9 items-center gap-2 rounded-md border border-input bg-card px-3 text-xs">
            <SlidersHorizontal className="size-3.5 text-muted-foreground" />
            CGPA ≥ <span className="font-mono font-semibold">{minCgpa.toFixed(1)}</span>
            <input
              type="range"
              min={0}
              max={9.5}
              step={0.5}
              value={minCgpa}
              onChange={(e) => setMinCgpa(Number(e.target.value))}
              className="w-24 accent-foreground"
            />
          </label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="h-9 rounded-md border border-input bg-card px-3 text-sm outline-none"
          >
            <option value="cgpa">Sort: CGPA</option>
            <option value="performance">Sort: Readiness</option>
            <option value="name">Sort: Name</option>
            <option value="expected_ctc">Sort: Expected CTC</option>
          </select>
        </div>
      </Panel>

      <Panel className="mt-4" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {[
                  "Student",
                  "Department",
                  "CGPA",
                  "Readiness",
                  "Rank",
                  "Status",
                  "Expected CTC",
                  "Eligibility",
                  "",
                ].map((h) => (
                  <th key={h} className="mono-label px-5 py-3 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rowsOnPage.map((s) => (
                <tr key={s.id} className="transition-colors hover:bg-muted/60">
                  <td className="px-5 py-3">
                    <p className="font-medium">{s.full_name}</p>
                  </td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">
                    {s.department ?? "—"}
                    <span className="block text-[10px]">{s.program}</span>
                  </td>
                  <td className="px-5 py-3 font-mono tabular-nums">{s.cgpa?.toFixed(2) ?? "—"}</td>
                  <td className="px-5 py-3 font-mono tabular-nums">
                    {s.performance_score != null ? s.performance_score.toFixed(1) : "—"}
                  </td>
                  <td className="px-5 py-3 text-xs">
                    {s.overall_rank != null ? (
                      <>
                        <span className="font-mono font-semibold tabular-nums">
                          #{s.overall_rank}
                        </span>
                        <span className="text-muted-foreground"> / {s.overall_total}</span>
                        {s.department_rank != null && (
                          <span className="block text-[10px] text-muted-foreground">
                            Dept #{s.department_rank} / {s.department_total}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <Pill tone={statusTone(s.placement_status)}>
                      {STATUS_LABEL[s.placement_status] ?? s.placement_status}
                    </Pill>
                  </td>
                  <td className="px-5 py-3 text-xs">
                    {s.expected_ctc ? (
                      <span className="font-medium">₹{s.expected_ctc.toFixed(1)} LPA</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {isEligible(s) ? (
                      <Pill tone="solid">Eligible</Pill>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => setSelected(s)}
                      className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
                    >
                      Profile
                    </button>
                  </td>
                </tr>
              ))}
              {rowsOnPage.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-sm text-muted-foreground">
                    {rows === null ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" /> Loading students…
                      </span>
                    ) : (
                      (error ?? "No students match these filters.")
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs">
          <span className="text-muted-foreground">
            Page {current + 1} of {pages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
              className="rounded-md border border-border px-3 py-1.5 font-medium disabled:opacity-40"
            >
              Previous
            </button>
            <button
              disabled={current >= pages - 1}
              onClick={() => setPage(current + 1)}
              className="rounded-md border border-border px-3 py-1.5 font-medium disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </Panel>

      {selected && <StudentModal student={selected} onClose={() => setSelected(null)} />}
      {addingStudents && (
        <AddStudentsModal
          institutionName={institutionName}
          onClose={() => setAddingStudents(false)}
          onSaved={() => setReloadToken((n) => n + 1)}
        />
      )}
    </Shell>
  );
}

function StudentModal({ student, onClose }: { student: StudentRecord; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center">
      <div className="panel max-h-[88vh] w-full max-w-2xl overflow-y-auto">
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="grid size-12 place-items-center rounded-md bg-primary font-display text-sm font-bold text-primary-foreground">
              {student.full_name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
            </div>
            <div>
              <h2 className="text-lg font-bold">{student.full_name}</h2>
              <p className="font-mono text-xs text-muted-foreground">
                {student.department ?? "—"}
                {student.program ? ` · ${student.program}` : ""}
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 hover:bg-accent">
            <X className="size-4" />
          </button>
        </div>

        {student.bio && (
          <div className="border-b border-border px-6 py-4">
            <p className="mono-label">Headline</p>
            <p className="mt-1.5 text-sm italic text-muted-foreground">{student.bio}</p>
          </div>
        )}

        <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
          {[
            ["CGPA", student.cgpa?.toFixed(2) ?? "—"],
            [
              "Readiness score",
              student.performance_score != null ? student.performance_score.toFixed(1) : "—",
            ],
            [
              "All Institute Rank",
              student.overall_rank != null
                ? `#${student.overall_rank} of ${student.overall_total}`
                : "—",
            ],
            [
              "Department rank",
              student.department_rank != null
                ? `#${student.department_rank} of ${student.department_total}`
                : "—",
            ],
            ["Batch", `${student.start_year ?? "—"} – ${student.end_year ?? "—"}`],
            [
              "Status",
              student.placement_status
                ? (STATUS_LABEL[student.placement_status] ?? student.placement_status)
                : "—",
            ],
            [
              "Expected CTC",
              student.expected_ctc ? `₹${student.expected_ctc.toFixed(1)} LPA` : "—",
            ],
            ["Placement eligible", isEligible(student) ? "Yes" : "No"],
            ["ID verified", student.id_verified ? "Yes" : "Pending"],
            ["Phone", student.mobile_number ?? "—"],
            ["Gender", student.gender ? student.gender.replace(/_/g, " ") : "—"],
            ["Account", student.account_status ? student.account_status.replace(/_/g, " ") : "—"],
            ["Preferred language", student.preferred_language ?? "—"],
            ["Joined", fmtDate(student.created_at)],
            ["Time on platform", fmtDuration(student.time_spent)],
            ["AI cost consumed", fmtInr(student.cost_incurred)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-md border border-border px-3.5 py-2.5">
              <p className="mono-label">{label}</p>
              <p className="mt-1 truncate text-sm font-medium">{value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 px-6 pb-5 sm:grid-cols-2">
          <div>
            <p className="mono-label">Skills</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(student.skills?.length ?? 0) > 0 ? (
                student.skills.map((s) => (
                  <Pill key={s} tone="outline">
                    {s}
                  </Pill>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No skills recorded.</span>
              )}
            </div>
          </div>
          <div>
            <p className="mono-label">Preferred roles</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(student.preferred_roles?.length ?? 0) > 0 ? (
                student.preferred_roles.map((r) => (
                  <Pill key={r} tone="outline">
                    {r}
                  </Pill>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">None recorded.</span>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 px-6 pb-5 sm:grid-cols-2">
          <div>
            <p className="mono-label">Preferred locations</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(student.preferred_locations?.length ?? 0) > 0 ? (
                student.preferred_locations.map((loc) => (
                  <Pill key={loc} tone="outline">
                    {loc}
                  </Pill>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">None recorded.</span>
              )}
            </div>
          </div>
          <div>
            <p className="mono-label">Extracurricular activities</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(student.extracurricular_activities?.length ?? 0) > 0 ? (
                student.extracurricular_activities.map((a) => (
                  <Pill key={a} tone="outline">
                    {a}
                  </Pill>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">None recorded.</span>
              )}
            </div>
          </div>
        </div>

        {student.performance && (
          <div className="px-6 pb-5">
            <p className="mono-label">Readiness breakdown</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {(
                [
                  [
                    "Mock interviews",
                    student.performance.mock_interview,
                    `${student.performance.mock_interviews} analysed`,
                  ],
                  [
                    "Self-training",
                    student.performance.self_training,
                    `${student.performance.modules.length} modules`,
                  ],
                  [
                    "TalentBro chat",
                    student.performance.chat,
                    `${student.performance.chat_messages} messages`,
                  ],
                ] as [string, number | null, string][]
              ).map(([label, score, detail]) => (
                <div key={label} className="rounded-md border border-border px-3.5 py-2.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-xs font-medium">{label}</span>
                    <span className="font-mono text-xs font-semibold tabular-nums">
                      {score != null ? Math.round(score) : "—"}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{
                        width: `${score != null ? Math.max(0, Math.min(100, score)) : 0}%`,
                      }}
                    />
                  </div>
                  {detail && <p className="mt-1 text-[10px] text-muted-foreground">{detail}</p>}
                </div>
              ))}
            </div>
            {student.performance.modules.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {student.performance.modules.map((m) => (
                  <Pill key={m.key} tone="outline">
                    {m.label} · {m.score}
                  </Pill>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-6 py-4">
          <Link
            to="/student-message"
            search={{ peer: student.id }}
            onClick={onClose}
            className="rounded-md border border-border px-3.5 py-2 text-xs font-medium transition-colors hover:bg-accent"
          >
            Message student
          </Link>
          <Link
            to="/student-detail/$studentId"
            params={{ studentId: student.id }}
            onClick={onClose}
            className="rounded-md bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Open readiness profile
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Add students ────────────────────────────────────────────────────────────
// Staff collect the email addresses of the students they want on the platform
// either by typing them one at a time (each one becomes a tag) or by uploading
// a sheet exported from Excel. Both paths feed the same list, de-duplicated on
// the normalised address so a spreadsheet and a few typed extras can be mixed.

// Deliberately permissive: this only has to catch the shape of an address, the
// real validation happens once the address is turned into an account.
const EMAIL_SHAPE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;
// Used to lift addresses out of an uploaded sheet, where they sit in a cell
// alongside commas, quotes and a header row that simply will not match.
const EMAIL_SCAN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const EMAIL_INPUT_SPLIT = /[\s,;]+/;

function normalizeEmail(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/^["'(]+|["'),;]+$/g, "")
    .toLowerCase();
}

// Show a college's site as its host rather than the full URL, keeping the line
// readable. Bare hosts are passed through unchanged.
function websiteLabel(url: string): string {
  try {
    return new URL(url.includes("://") ? url : `https://${url}`).host;
  } catch {
    return url;
  }
}

// Merge a batch of addresses into the tag list, keeping the first spelling of
// each address and silently dropping the repeats a sheet or a paste produces.
function mergeEmails(current: string[], incoming: string[]): string[] {
  const seen = new Set(current);
  const next = [...current];
  for (const value of incoming) {
    const email = normalizeEmail(value);
    if (!EMAIL_SHAPE.test(email) || seen.has(email)) continue;
    seen.add(email);
    next.push(email);
  }
  return next;
}

function AddStudentsModal({
  institutionName,
  onClose,
  onSaved,
}: {
  institutionName: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [rejected, setRejected] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileNote, setFileNote] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  // Addresses that already sit on a candidate profile, keyed by address. The
  // check runs as the list changes so a clash is visible before saving, not
  // discovered as a silent skip afterwards.
  const [existing, setExisting] = useState<Record<string, ExistingStudent>>({});
  const [checking, setChecking] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Debounced so typing a list does not fire a request per keystroke, and so a
  // pasted sheet settles into one check.
  useEffect(() => {
    if (emails.length === 0) {
      setExisting({});
      setChecking(false);
      return;
    }
    let cancelled = false;
    setChecking(true);
    const timer = window.setTimeout(() => {
      checkStudentsExist(emails)
        .then((res) => {
          if (cancelled) return;
          const next: Record<string, ExistingStudent> = {};
          for (const row of res.existing) next[row.email] = row;
          setExisting(next);
        })
        // A failed check is not worth interrupting the flow over: the save path
        // still refuses to duplicate anyone.
        .catch(() => {
          if (!cancelled) setExisting({});
        })
        .finally(() => {
          if (!cancelled) setChecking(false);
        });
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [emails]);

  const existingList = emails.map((email) => existing[email]).filter((row) => row !== undefined);
  const clashing = existingList.filter((row) => !row.same_college);
  const alreadyHere = existingList.filter((row) => row.same_college);
  // Addresses that are genuinely new, i.e. what a save will actually add.
  const addable = emails.filter((email) => existing[email] === undefined);

  // Commit the address currently being typed. Anything that is not an address
  // is parked in `rejected` so the staff member can see it was dropped rather
  // than watching the keystrokes disappear.
  function commitDraft() {
    const raw = draft;
    setDraft("");
    const parts = raw.split(EMAIL_INPUT_SPLIT).map(normalizeEmail).filter(Boolean);
    if (parts.length === 0) return;
    const good = parts.filter((part) => EMAIL_SHAPE.test(part));
    const bad = parts.filter((part) => !EMAIL_SHAPE.test(part));
    if (good.length > 0) setEmails((current) => mergeEmails(current, good));
    if (bad.length > 0) {
      setRejected((current) => {
        const next = [...current];
        for (const part of bad) if (!next.includes(part)) next.push(part);
        return next;
      });
    }
  }

  function onDraftKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "," || e.key === ";") {
      e.preventDefault();
      commitDraft();
      return;
    }
    // Backspace on an empty field peels off the last tag, the usual tag-input
    // behaviour.
    if (e.key === "Backspace" && draft === "" && emails.length > 0) {
      setEmails((current) => current.slice(0, -1));
    }
  }

  function removeEmail(email: string) {
    setEmails((current) => current.filter((e) => e !== email));
  }

  async function readFile(file: File) {
    setFileName(file.name);
    // A .xlsx is a zip archive, not text, so it cannot be read without a
    // spreadsheet parser. Say so plainly instead of silently finding nothing.
    if (/\.xlsx?$/i.test(file.name)) {
      setFileNote(
        "Excel workbooks (.xlsx) can't be read here. In Excel choose File → Save As → CSV, then upload that file.",
      );
      return;
    }
    const text = await file.text();
    const found = text.match(EMAIL_SCAN) ?? [];
    if (found.length === 0) {
      setFileNote(`No email addresses found in ${file.name}.`);
      return;
    }
    setEmails((current) => mergeEmails(current, found));
    setFileNote(
      `Added ${found.length} address${found.length === 1 ? "" : "es"} from ${file.name}. Duplicates were skipped.`,
    );
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void readFile(file);
    // Reset so re-picking the same file still fires a change event.
    e.target.value = "";
  }

  async function submit() {
    if (draft.trim()) commitDraft();
    // commitDraft clears `draft` asynchronously, so read the list as it stands
    // and fall back to the just-typed address when it was the only one.
    const batch = draft.trim() ? mergeEmails(emails, [draft]) : emails;
    if (batch.length === 0) return;
    // Only send the addresses the check says are new, so the "already on a roll"
    // rows are never even part of the write.
    const fresh = batch.filter((email) => existing[email] === undefined);
    if (fresh.length === 0) {
      toast.warning("Nothing to add", {
        description: "Every address you entered is already on a candidate profile.",
      });
      return;
    }
    setSaving(true);
    try {
      const res = await addStudents(fresh);
      const parts = [`${res.created} student${res.created === 1 ? "" : "s"} added`];
      if (res.skipped > 0) {
        parts.push(`${res.skipped} already on a roll`);
      }
      if (res.invalid.length > 0) {
        parts.push(`${res.invalid.length} not an email address`);
      }
      if (res.created > 0) toast.success(parts.join(" · "));
      else toast.warning("Nothing was added", { description: parts.join(" · ") });
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add students.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center">
      <div className="panel max-h-[88vh] w-full max-w-xl overflow-y-auto">
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div>
            <h2 className="text-lg font-bold">Add Students</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Type the email addresses below, or upload a sheet of them.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 hover:bg-accent">
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div>
            <p className="mono-label">Email addresses</p>
            <div className="mt-2 flex flex-wrap gap-1.5 rounded-md border border-input bg-card p-2 focus-within:ring-2 focus-within:ring-ring/20">
              {emails.map((email) => (
                <span
                  key={email}
                  className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs"
                >
                  {email}
                  <button
                    onClick={() => removeEmail(email)}
                    aria-label={`Remove ${email}`}
                    className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onDraftKeyDown}
                onBlur={commitDraft}
                placeholder={emails.length === 0 ? "student@college.edu" : "Add another…"}
                aria-label="Student email address"
                className="h-7 min-w-[180px] flex-1 bg-transparent px-1 text-sm outline-none"
              />
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              Press Enter, comma or space after each address. Backspace removes the last one.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <div>
            <p className="mono-label">Upload a sheet</p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,.tsv,text/csv,text/plain"
              onChange={onFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) void readFile(file);
              }}
              className={`mt-2 flex w-full flex-col items-center gap-1.5 rounded-md border border-dashed px-4 py-7 text-center transition-colors ${
                dragging ? "border-foreground bg-accent" : "border-border hover:bg-accent"
              }`}
            >
              <Upload className="size-4 text-muted-foreground" />
              <span className="text-xs font-medium">
                {fileName ?? "Click to upload, or drop a file here"}
              </span>
              <span className="text-[10px] text-muted-foreground">
                CSV or TXT exported from Excel — one address per row
              </span>
            </button>
            {fileNote && <p className="mt-2 text-[10px] text-muted-foreground">{fileNote}</p>}
          </div>

          {rejected.length > 0 && (
            <div className="rounded-md border border-border px-3.5 py-2.5">
              <p className="mono-label">Not an email address</p>
              <p className="mt-1 text-xs text-muted-foreground">{rejected.join(", ")}</p>
            </div>
          )}

          {/* Addresses that already sit on a candidate profile. The clash is
              shown here, while the list is being built, rather than only
              surfacing as a silent skip when the save comes back. */}
          {(checking || existingList.length > 0) && (
            <div className="rounded-md border border-border px-3.5 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="mono-label">Already in the candidate profile</p>
                {checking && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
              </div>

              {checking && existingList.length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">Checking…</p>
              )}

              {!checking && existingList.length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  None of these addresses are on a candidate profile yet.
                </p>
              )}

              {alreadyHere.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium">
                    {alreadyHere.length} already on {institutionName ?? "your"} roll
                  </p>
                  <ul className="mt-1 space-y-1">
                    {alreadyHere.map((row) => (
                      <li key={row.email} className="text-[11px] text-muted-foreground">
                        <span className="mono">{row.email}</span>
                        <span> — {row.college || "Unassigned"}</span>
                        {row.website && (
                          <a
                            href={row.website}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="ml-1 inline-flex items-center gap-0.5 underline hover:text-foreground"
                          >
                            {websiteLabel(row.website)}
                            <ExternalLink className="size-2.5" />
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {clashing.length > 0 && (
                <div className="mt-2.5">
                  <p className="flex items-center gap-1.5 text-xs font-medium">
                    <CircleAlert className="size-3.5 shrink-0" />
                    {clashing.length} already on another college's roll
                  </p>
                  <ul className="mt-1 space-y-1">
                    {clashing.map((row) => (
                      <li key={row.email} className="text-[11px] text-muted-foreground">
                        <span className="mono">{row.email}</span>
                        <span> — exists in the candidate profile of </span>
                        <span className="font-medium text-foreground">
                          {row.college || "an unassigned college"}
                        </span>
                        {row.website && (
                          <a
                            href={row.website}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="ml-1 inline-flex items-center gap-0.5 underline hover:text-foreground"
                          >
                            {websiteLabel(row.website)}
                            <ExternalLink className="size-2.5" />
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    These will be left where they are. They will not be moved to your college.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-6 py-4">
          <span className="text-xs text-muted-foreground">
            {addable.length} of {emails.length} new
            {emails.length - addable.length > 0 &&
              ` · ${emails.length - addable.length} already in the candidate profile`}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="rounded-md border border-border px-3.5 py-2 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={saving || addable.length === 0}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              {saving
                ? "Adding…"
                : addable.length === 0 && emails.length > 0
                  ? "Nothing to add"
                  : `Add ${addable.length} student${addable.length === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
