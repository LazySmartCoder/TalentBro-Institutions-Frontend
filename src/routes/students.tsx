import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Download, Search, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/dash/Shell";
import { Kpi, Panel, Pill } from "@/components/dash/bits";
import { getStudents, type PlacementStatus, type StudentRecord } from "@/lib/api";
import { DEPARTMENTS } from "@/lib/data";

export const Route = createFileRoute("/students")({
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

const STATUS_LABEL: Record<PlacementStatus, string> = {
  placed: "Placed",
  shortlisted: "Shortlisted",
  applying: "Applying",
  not_started: "Not Started",
};

function statusTone(status: PlacementStatus): "solid" | "outline" | "muted" {
  if (status === "placed") return "solid";
  if (status === "not_started") return "muted";
  return "outline";
}

function StudentsPage() {
  const [rows, setRows] = useState<StudentRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [dept, setDept] = useState<string>("All");
  const [status, setStatus] = useState<string>("All");
  const [minCgpa, setMinCgpa] = useState(0);
  const [sort, setSort] = useState<"name" | "cgpa" | "expected_ctc" | "performance">("cgpa");
  const [selected, setSelected] = useState<StudentRecord | null>(null);
  const [page, setPage] = useState(0);
  const searchRef = useRef("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      searchRef.current = q;
      setPage(0);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    const query: Parameters<typeof getStudents>[0] = {
      q: searchRef.current,
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
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load students.");
        setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [dept, status, minCgpa, sort, q]);

  const filtered = rows ?? [];
  const inSelection = filtered.filter(
    (s) => s.placement_status === "shortlisted" || s.placement_status === "applying",
  );
  const placed = filtered.filter((s) => s.placement_status === "placed");
  const cgpas = filtered.map((s) => s.cgpa).filter((c): c is number => c !== null);
  const avgCgpa = cgpas.length ? cgpas.reduce((a, b) => a + b, 0) / cgpas.length : 0;
  const eligible = filtered.filter((s) => s.placement_eligible).length;

  const pageSize = 12;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages - 1);
  const rowsOnPage = filtered.slice(current * pageSize, current * pageSize + pageSize);

  return (
    <Shell
      title="Students"
      subtitle={`${filtered.length} of the live batch match the current filters`}
      actions={
        <button
          onClick={() => toast.success(`Exported ${filtered.length} student records to CSV`)}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3.5 py-2 text-xs font-medium transition-colors hover:bg-accent"
        >
          <Download className="size-3.5" /> Export
        </button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="In Selection" value={filtered.length} hint="matching filters" />
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
        <Kpi label="Eligible" value={eligible} hint="placement-ready students" />
      </div>

      <Panel className="mt-4" bodyClassName="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, department, program or email…"
              className="h-9 w-full rounded-md border border-input bg-card pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/20"
            />
          </div>
          <select
            value={dept}
            onChange={(e) => setDept(e.target.value)}
            className="h-9 rounded-md border border-input bg-card px-3 text-sm outline-none"
          >
            <option value="All">All departments</option>
            {DEPARTMENTS.map((d) => (
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
                    {s.placement_eligible ? (
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
                    {error ?? "No students match these filters."}
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
            ["Placement eligible", student.placement_eligible ? "Yes" : "No"],
            ["ID verified", student.id_verified ? "Yes" : "Pending"],
            ["Phone", student.mobile_number ?? "—"],
            ["Gender", student.gender ? student.gender.replace("_", " ") : "—"],
            ["Account", student.account_status ? student.account_status.replace("_", " ") : "—"],
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

        <div className="flex flex-wrap justify-end gap-2 border-t border-border px-6 py-4">
          <button
            onClick={() => toast.success(`Resume of ${student.full_name} shared with recruiters`)}
            className="rounded-md border border-border px-3.5 py-2 text-xs font-medium hover:bg-accent"
          >
            Share resume
          </button>
          <button
            onClick={() => toast.success(`${student.full_name} shortlisted for the next drive`)}
            className="rounded-md bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            Shortlist for drive
          </button>
        </div>
      </div>
    </div>
  );
}
