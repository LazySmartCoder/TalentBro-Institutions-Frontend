import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, CalendarClock, Loader2, Search, Target, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/dash/Shell";
import { Bar, Panel, Pill } from "@/components/dash/bits";
import { GateError, GateLoading } from "@/components/load-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  addStudentTarget,
  getStudents,
  getStudentTargets,
  removeStudentTarget,
  type StudentTarget,
  type StudentTargets,
  type StudentRecord,
} from "@/lib/api";

// The ceiling the server enforces on every count, repeated here so the input caps
// at the same number rather than letting a typed 400 come back as an error toast.
const MAX_COUNT = 100;

// Days added to today for the default deadline. Two weeks is long enough to be
// worth setting numbers against and short enough that the progress on the board is
// still moving when the officer comes back to look.
const DEFAULT_WINDOW_DAYS = 14;

/**
 * `YYYY-MM-DD` for today in the browser's own timezone.
 *
 * `toISOString` would give the UTC date, which is the previous day for anyone east
 * of Greenwich before midday — so a target launched from an Indian college in the
 * morning would default to a deadline one day earlier than the one on screen.
 */
function todayIso(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/** `todayIso` shifted by whole days, for the same reason. */
function isoDaysFromNow(days: number): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000 + days * 86_400_000);
  return local.toISOString().slice(0, 10);
}

type AudienceMode = "department" | "students";

type Draft = {
  title: string;
  department: string;
  notes: string;
  starts_on: string;
  due_on: string;
  /** Count per module key, plus `mock` for the mock-interview row. */
  counts: Record<string, number>;
};

function emptyDraft(moduleKeys: string[]): Draft {
  return {
    title: "",
    // No department preselected: the officer has to choose, and an accidental
    // "CSE" on a campus-wide target would be a target nobody else ever sees.
    department: "",
    notes: "",
    starts_on: "",
    due_on: isoDaysFromNow(DEFAULT_WINDOW_DAYS),
    counts: Object.fromEntries([...moduleKeys, "mock"].map((key) => [key, 0])),
  };
}

/** How a target's remaining time reads on a board row. */
function deadlineLabel(target: StudentTarget): { text: string; overdue: boolean } {
  if (target.days_left < 0) {
    const days = -target.days_left;
    return { text: `${days} day${days === 1 ? "" : "s"} ago`, overdue: true };
  }
  if (target.days_left === 0) return { text: "Due today", overdue: false };
  return { text: `${target.days_left} days left`, overdue: false };
}

/** The counts on a target, as chips, skipping the ones set to zero. */
function countChips(target: StudentTarget, modules: { key: string; short: string }[]) {
  const chips = modules
    .filter((module) => (target.modules[module.key] ?? 0) > 0)
    .map((module) => `${(target.modules[module.key] ?? 0) * 1} ${module.short}`);
  if (target.mock_interview_count > 0) {
    chips.push(`${target.mock_interview_count} mock`);
  }
  return chips;
}

export const Route = createFileRoute("/client/launch-targets")({
  head: () => ({
    meta: [
      { title: "Launch Targets — TalentBro Placement Dashboard" },
      {
        name: "description",
        content:
          "Set practice targets for a department or a hand-picked set of students, and track them to a deadline.",
      },
      { property: "og:title", content: "Launch Targets — TalentBro" },
      {
        property: "og:description",
        content: "Set and track practice targets for your batch.",
      },
    ],
  }),
  component: LaunchTargetsPage,
});

/**
 * One launched target.
 *
 * The headline number is how many of the covered students have met every part of
 * the target, not how much practice has been logged in total: a batch can log a
 * great deal and still fail, and an officer acts on the students, not the sum.
 */
function TargetCard({
  target,
  modules,
  removingId,
  onRequestRemove,
}: {
  target: StudentTarget;
  modules: { key: string; short: string }[];
  removingId: string | null;
  onRequestRemove: (id: string) => void;
}) {
  const deadline = deadlineLabel(target);
  const chips = countChips(target, modules);
  const { progress } = target;

  return (
    <div className={`rounded-lg border border-border p-4 ${target.is_open ? "" : "bg-muted/25"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={`text-sm font-semibold ${target.is_open ? "" : "text-muted-foreground"}`}
            >
              {target.title}
            </h3>
            {!target.is_open && <Pill tone="muted">Closed</Pill>}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-3.5" />
              {target.audience_label}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 ${
                deadline.overdue ? "font-medium text-destructive" : ""
              }`}
            >
              <CalendarClock className="size-3.5" />
              {target.due_on_display} · {deadline.text}
            </span>
            {target.created_by && <span>Set by {target.created_by}</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onRequestRemove(target.id)}
          disabled={removingId === target.id}
          aria-label={`Withdraw ${target.title}`}
          className="shrink-0 rounded-md border border-border p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
        >
          {removingId === target.id ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Trash2 className="size-3.5" />
          )}
        </button>
      </div>

      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <Pill key={chip} tone="outline">
              {chip}
            </Pill>
          ))}
        </div>
      )}

      <div className="mt-3.5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs">
              {progress.students_met} of {progress.students} student
              {progress.students === 1 ? "" : "s"} on target
            </p>
            <span className="stat-num text-sm">
              {progress.percent_met === null ? "—" : `${progress.percent_met}%`}
            </span>
          </div>
          <div className="mt-1.5">
            {/* Keyed to the student count so the bar does not read as full for a
                target nobody has been assigned to. */}
            <Bar value={progress.students_met} max={Math.max(1, progress.students)} />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground sm:text-right">
          Self-training {progress.self_training_done}/{progress.self_training_target} · mock{" "}
          {progress.mock_done}/{progress.mock_target}
        </p>
      </div>

      {target.notes && (
        <p className="mt-3 whitespace-pre-line text-xs text-muted-foreground">{target.notes}</p>
      )}
    </div>
  );
}

function LaunchTargetsPage() {
  const [board, setBoard] = useState<StudentTargets | null>(null);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  // Kept apart from the in-flight flag so the confirmation dialog can stay open and
  // disable its buttons while the delete runs.
  const [pendingRemoval, setPendingRemoval] = useState<StudentTarget | null>(null);
  const [removingBusy, setRemovingBusy] = useState(false);

  const [mode, setMode] = useState<AudienceMode>("department");
  const [studentQuery, setStudentQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);

  // The module catalogue arrives with the board, so the form is only built once
  // the server has said which modules there are. It cannot be rendered from a
  // hard-coded list without the two drifting apart.
  const modules = board?.modules ?? [];

  useEffect(() => {
    let cancelled = false;
    setError(null);
    // The roster is fetched alongside the board rather than inside it: the board
    // endpoint scopes targets to the college and has no business returning every
    // student profile with them.
    Promise.all([getStudentTargets(), getStudents()])
      .then(([targets, roster]) => {
        if (cancelled) return;
        setBoard(targets);
        setStudents(roster.students);
        setDraft((prev) => prev ?? emptyDraft(targets.modules.map((m) => m.key)));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load the targets board.");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const setCount = (key: string, value: number) =>
    setDraft((prev) =>
      prev ? { ...prev, counts: { ...prev.counts, [key]: clampCount(value) } } : prev,
    );

  function clampCount(value: number): number {
    if (!Number.isFinite(value) || value < 0) return 0;
    return Math.min(Math.floor(value), MAX_COUNT);
  }

  function toggleStudent(id: string) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  // The picker only lists the students a search or department filter leaves, so a
  // chosen student dropping out of view is a real possibility — the chosen count is
  // printed from `picked` rather than from the visible rows for that reason.
  const roster = useMemo(() => {
    const needle = studentQuery.trim().toLowerCase();
    return students
      .filter((s) => !needle || s.full_name.toLowerCase().includes(needle))
      .filter((s) => !draft?.department || (s.department ?? "") === draft.department)
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [students, studentQuery, draft?.department]);

  const totalAsked = useMemo(
    () => Object.values(draft?.counts ?? {}).reduce((sum, n) => sum + n, 0),
    [draft?.counts],
  );

  const hasAudience = mode === "department" ? Boolean(draft?.department) : picked.length > 0;
  const canSubmit = Boolean(draft && hasAudience && totalAsked > 0 && draft.due_on && !saving);

  /**
   * Slot a newly created target into the board the server would have returned.
   *
   * The server sorts open targets by deadline and closed ones the other way, so
   * the new row is placed rather than appended: a target due next week belongs
   * above one due next term, and re-sorting the whole list here would duplicate
   * the server's rule in the client where it could quietly disagree with it.
   */
  function onTargetAdded(target: StudentTarget) {
    setBoard((prev) => {
      if (!prev) return prev;
      const rest = [...prev.targets.filter((row) => row.id !== target.id)];
      const index = prev.targets.findIndex((row) => row.is_open !== target.is_open);
      const at = index === -1 ? rest.length : index;
      const targets = [...rest.slice(0, at), target, ...rest.slice(at)];
      return {
        ...prev,
        targets,
        counts: {
          open: prev.counts.open + (target.is_open ? 1 : 0),
          closed: prev.counts.closed + (target.is_open ? 0 : 1),
        },
      };
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft || saving) return;
    if (!draft.due_on) {
      toast.error("Pick the date this target is due by.");
      return;
    }
    if (!hasAudience) {
      toast.error(
        mode === "department"
          ? "Choose the department this target is for."
          : "Pick at least one student.",
      );
      return;
    }
    if (totalAsked === 0) {
      toast.error("Set at least one number before launching a target.");
      return;
    }

    // The module keys are split back out from the draft's flat count map so the
    // server receives the shape it validates against, with `mock` handled
    // separately from the module keys.
    const { mock: mockCount, ...moduleCounts } = draft.counts;

    setSaving(true);
    try {
      const res = await addStudentTarget({
        title: draft.title.trim(),
        department: mode === "department" ? draft.department : "",
        candidate_ids: mode === "students" ? picked : [],
        modules: moduleCounts,
        mock_interview_count: mockCount ?? 0,
        starts_on: draft.starts_on,
        due_on: draft.due_on,
        notes: draft.notes.trim(),
      });
      onTargetAdded(res.target);
      // Cleared back to the defaults rather than kept, so the next target is a
      // fresh decision and the officer cannot relaunch the last one by accident.
      setDraft((prev) =>
        prev ? { ...emptyDraft(Object.keys(prev.counts)), due_on: prev.due_on } : prev,
      );
      setPicked([]);
      setStudentQuery("");
      toast.success(`Launched “${res.target.title}”`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not launch the target.");
    } finally {
      setSaving(false);
    }
  }

  async function onRemove() {
    if (!pendingRemoval || removingBusy) return;
    const target = pendingRemoval;
    setRemovingBusy(true);
    try {
      await removeStudentTarget(target.id);
      setBoard((prev) =>
        prev
          ? {
              ...prev,
              targets: prev.targets.filter((row) => row.id !== target.id),
              counts: {
                open: prev.counts.open - (target.is_open ? 1 : 0),
                closed: prev.counts.closed - (target.is_open ? 0 : 1),
              },
            }
          : prev,
      );
      toast.success("Target withdrawn");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not withdraw the target.");
    } finally {
      setRemovingBusy(false);
      setPendingRemoval(null);
    }
  }

  if (board === null && error === null) return <GateLoading audience="staff" />;
  if (board === null) {
    return (
      <Shell title="Launch Targets" subtitle="Set targets for your batch">
        <GateError
          message={error}
          onRetry={() => {
            setReloadKey((n) => n + 1);
          }}
        />
      </Shell>
    );
  }

  const openTargets = board.targets.filter((row) => row.is_open);
  const closedTargets = board.targets.filter((row) => !row.is_open);
  const inAudience =
    mode === "department"
      ? students.filter((s) => !draft?.department || (s.department ?? "") === draft.department)
      : students;

  return (
    <Shell
      title="Launch Targets"
      subtitle="Set what your students must practise, by department or student, and watch it to the deadline"
      actions={
        <Link
          to="/client/ld-training"
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium transition-colors hover:bg-accent"
        >
          <ArrowLeft className="size-3.5" /> L&D board
        </Link>
      }
    >
      <Panel
        title="Launch a target"
        description="One target is one record: a department or a hand-picked set of students, the numbers to practise, and the date it is judged against"
      >
        <form onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mono-label" htmlFor="lt-title">
                Name
              </label>
              <input
                id="lt-title"
                value={draft?.title ?? ""}
                onChange={(e) =>
                  setDraft((prev) => (prev ? { ...prev, title: e.target.value } : prev))
                }
                placeholder="Leave blank and we will name it after the audience"
                className="mt-1.5 h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring/20"
              />
            </div>

            {/* --- who it covers --------------------------------------------- */}
            <div className="sm:col-span-2">
              <span className="mono-label">Who it covers</span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {(
                  [
                    { value: "department" as const, label: "A department" },
                    { value: "students" as const, label: "Specific students" },
                  ] satisfies { value: AudienceMode; label: string }[]
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setMode(option.value)}
                    aria-pressed={mode === option.value}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                      mode === option.value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:bg-accent"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {mode === "department" ? (
              <div className="sm:col-span-2">
                <label className="mono-label" htmlFor="lt-department">
                  Department
                </label>
                <select
                  id="lt-department"
                  value={draft?.department ?? ""}
                  onChange={(e) =>
                    setDraft((prev) => (prev ? { ...prev, department: e.target.value } : prev))
                  }
                  className="mt-1.5 h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring/20"
                >
                  <option value="">Choose a department…</option>
                  {board.departments.map((dept) => (
                    <option key={dept.name} value={dept.name}>
                      {dept.name} — {dept.students} student{dept.students === 1 ? "" : "s"}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Everyone in that department is covered, including students who join it after the
                  target is launched.
                </p>
              </div>
            ) : (
              <div className="sm:col-span-2">
                <label className="mono-label" htmlFor="lt-student-search">
                  Students
                </label>
                <div className="relative mt-1.5">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="lt-student-search"
                    value={studentQuery}
                    onChange={(e) => setStudentQuery(e.target.value)}
                    placeholder="Search by name"
                    className="h-9 w-full rounded-md border border-input bg-card pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/20"
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {picked.length} selected
                  {draft?.department
                    ? ` · showing ${draft.department}, ${inAudience.length} in the college`
                    : ` · ${inAudience.length} in the college`}
                </p>
                <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-border">
                  {roster.length === 0 ? (
                    <p className="px-3.5 py-3 text-xs text-muted-foreground">
                      No student matches that search.
                    </p>
                  ) : (
                    roster.map((student) => (
                      <label
                        key={student.id}
                        className="flex cursor-pointer items-center gap-2.5 border-b border-border px-3.5 py-2 text-xs last:border-b-0 hover:bg-accent/40"
                      >
                        <input
                          type="checkbox"
                          checked={picked.includes(student.id)}
                          onChange={() => toggleStudent(student.id)}
                          className="size-3.5 accent-foreground"
                        />
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {student.full_name}
                        </span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {student.department ?? "—"}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* --- the numbers ---------------------------------------------- */}
            <div className="sm:col-span-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="mono-label">What to practise</span>
                <span className="text-[11px] text-muted-foreground">
                  {totalAsked} item{totalAsked === 1 ? "" : "s"} in total
                </span>
              </div>
              <div className="mt-2 grid gap-2.5 sm:grid-cols-3">
                {modules.map((module) => (
                  <div key={module.key}>
                    <label
                      className="mono-label block truncate"
                      htmlFor={`lt-count-${module.key}`}
                      title={module.label}
                    >
                      {module.short}
                    </label>
                    <input
                      id={`lt-count-${module.key}`}
                      type="number"
                      min={0}
                      max={MAX_COUNT}
                      value={draft?.counts[module.key] ?? 0}
                      onChange={(e) => setCount(module.key, Number(e.target.value))}
                      className="mt-1.5 h-9 w-full rounded-md border border-input bg-card px-3 text-sm tabular-nums outline-none focus:ring-2 focus:ring-ring/20"
                    />
                  </div>
                ))}
                <div>
                  <label className="mono-label block truncate" htmlFor="lt-count-mock">
                    Mock interviews
                  </label>
                  <input
                    id="lt-count-mock"
                    type="number"
                    min={0}
                    max={MAX_COUNT}
                    value={draft?.counts["mock"] ?? 0}
                    onChange={(e) => setCount("mock", Number(e.target.value))}
                    className="mt-1.5 h-9 w-full rounded-md border border-input bg-card px-3 text-sm tabular-nums outline-none focus:ring-2 focus:ring-ring/20"
                  />
                </div>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Leave a number at zero to leave that module out of the target. Question modules
                count only once the question is solved.
              </p>
            </div>

            {/* --- the window ------------------------------------------------ */}
            <div>
              <label className="mono-label" htmlFor="lt-starts">
                Counts from
              </label>
              <input
                id="lt-starts"
                type="date"
                value={draft?.starts_on ?? ""}
                onChange={(e) =>
                  setDraft((prev) => (prev ? { ...prev, starts_on: e.target.value } : prev))
                }
                className="mt-1.5 h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring/20"
              />
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Blank means today, the day you launch it.
              </p>
            </div>
            <div>
              <label className="mono-label" htmlFor="lt-due">
                Due by
              </label>
              <input
                id="lt-due"
                type="date"
                required
                min={draft?.starts_on || todayIso()}
                value={draft?.due_on ?? ""}
                onChange={(e) =>
                  setDraft((prev) => (prev ? { ...prev, due_on: e.target.value } : prev))
                }
                className="mt-1.5 h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring/20"
              />
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Progress is measured between the two dates, not over the student&rsquo;s whole time
                on the platform.
              </p>
            </div>

            <div className="sm:col-span-2">
              <label className="mono-label" htmlFor="lt-notes">
                Notes
              </label>
              <textarea
                id="lt-notes"
                rows={2}
                value={draft?.notes ?? ""}
                onChange={(e) =>
                  setDraft((prev) => (prev ? { ...prev, notes: e.target.value } : prev))
                }
                placeholder="Anything to go with the numbers, e.g. which topics to cover"
                className="mt-1.5 w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/20"
              />
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Target className="size-3.5" />
              )}
              {saving ? "Launching…" : "Launch target"}
            </button>
          </div>
        </form>
      </Panel>

      <Panel
        className="mt-4"
        title="Launched targets"
        description="What is still open, soonest deadline first, and what has closed underneath"
        action={
          <Pill tone={board.counts.open ? "solid" : "muted"}>
            {board.counts.open} open · {board.counts.closed} closed
          </Pill>
        }
      >
        {board.targets.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Nothing launched yet. Set a target above and it appears here with its progress.
          </p>
        ) : (
          <div className="space-y-5">
            <section>
              <div className="mb-2 flex items-center gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Open
                </h3>
                <Pill tone="muted">{openTargets.length}</Pill>
              </div>
              {openTargets.length === 0 ? (
                <p className="px-3.5 py-3 text-xs text-muted-foreground">
                  No target is running right now.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {openTargets.map((target) => (
                    <TargetCard
                      key={target.id}
                      target={target}
                      modules={modules}
                      removingId={
                        removingBusy && pendingRemoval?.id === target.id ? target.id : null
                      }
                      onRequestRemove={(id) =>
                        setPendingRemoval(board.targets.find((row) => row.id === id) ?? null)
                      }
                    />
                  ))}
                </div>
              )}
            </section>

            {closedTargets.length > 0 && (
              <section>
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Closed
                  </h3>
                  <Pill tone="muted">{closedTargets.length}</Pill>
                </div>
                <div className="space-y-2.5">
                  {closedTargets.map((target) => (
                    <TargetCard
                      key={target.id}
                      target={target}
                      modules={modules}
                      removingId={
                        removingBusy && pendingRemoval?.id === target.id ? target.id : null
                      }
                      onRequestRemove={(id) =>
                        setPendingRemoval(board.targets.find((row) => row.id === id) ?? null)
                      }
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </Panel>

      {/* Withdrawing a target takes a running commitment off the board, so a stray
          click on a small icon must not do it silently. */}
      <AlertDialog
        open={pendingRemoval !== null}
        onOpenChange={(open) => {
          if (!open && !removingBusy) setPendingRemoval(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Withdraw this target?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemoval ? `“${pendingRemoval.title}” comes off the board.` : ""} The students
              keep everything they have practised, and no student is notified. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removingBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void onRemove();
              }}
              disabled={removingBusy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removingBusy ? "Withdrawing…" : "Withdraw target"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Shell>
  );
}
