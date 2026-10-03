import { useMemo, useState, type FormEvent } from "react";
import { CalendarPlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  addClassroomLDSession,
  type ClassroomLDSession,
  type ClassroomLDSessionPayload,
} from "@/lib/api";

const inputCls =
  "h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring/20";

const EMPTY = {
  topic: "",
  agenda: "",
  venue: "",
  department: "",
  faculty_name: "",
  session_date: "",
  start_time: "",
};

type Draft = typeof EMPTY;

/**
 * How long a session runs when the officer only picks a start hour.
 *
 * The board prints a start and an end time and the API needs both, so with a
 * single time field one of the two has to be implied somewhere. One hour is the
 * length a classroom slot normally takes.
 */
const DURATION_MINUTES = 60;

/**
 * Glue the two fields into one wall-clock moment.
 *
 * `date` and `time` inputs both yield bare strings, and read joined together as
 * `YYYY-MM-DDTHH:mm` that is the browser's own timezone with no offset attached.
 * Left alone it would be read as UTC, so a session typed for 10am would land a
 * few hours off wherever the machine's zone sits. This is the inverse: read the
 * officer's own wall-clock reading and say so, letting the browser attach the
 * offset.
 */
function combine(date: string, time: string): Date | null {
  if (!date || !time) return null;
  const at = new Date(`${date}T${time}`);
  return Number.isNaN(at.getTime()) ? null : at;
}

/**
 * Schedule one classroom L&D session.
 *
 * Only `topic`, the date and the time are required: venue, department and
 * faculty are often not settled when a session is put on the calendar, and a
 * half-filled row that exists is more useful than one blocked on a form nobody
 * has finished.
 */
export function ClassroomSessionDialog({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: (session: ClassroomLDSession) => void;
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const start = useMemo(
    () => combine(draft.session_date, draft.start_time),
    [draft.session_date, draft.start_time],
  );
  const end = useMemo(
    () => (start ? new Date(start.getTime() + DURATION_MINUTES * 60_000) : null),
    [start],
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!start || !end) {
      toast.error("Enter both a date and a time.");
      return;
    }
    setSaving(true);
    try {
      const payload: ClassroomLDSessionPayload = {
        topic: draft.topic.trim(),
        agenda: draft.agenda.trim(),
        venue: draft.venue.trim(),
        department: draft.department.trim(),
        faculty_name: draft.faculty_name.trim(),
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
      };
      const res = await addClassroomLDSession(payload);
      onAdded(res.session);
      toast.success(`Scheduled ${res.session.topic}`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not schedule the session.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center">
      <div className="panel max-h-[90vh] w-full max-w-lg overflow-y-auto">
        <form onSubmit={submit}>
          <div className="flex items-start justify-between border-b border-border px-6 py-5">
            <div>
              <h2 className="text-lg font-bold">Schedule a classroom session</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                It shows on your L&amp;D board under upcoming, and moves to done once it finishes.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-md p-1 hover:bg-accent"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mono-label" htmlFor="cs-topic">
                Topic
              </label>
              <input
                id="cs-topic"
                required
                value={draft.topic}
                onChange={(e) => set("topic", e.target.value)}
                placeholder="e.g. Aptitude mock test and review"
                className={`${inputCls} mt-1.5`}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mono-label" htmlFor="cs-agenda">
                Agenda
              </label>
              <textarea
                id="cs-agenda"
                rows={3}
                value={draft.agenda}
                onChange={(e) => set("agenda", e.target.value)}
                placeholder="What the session covers, in order"
                className="mt-1.5 w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/20"
              />
            </div>
            <div>
              <label className="mono-label" htmlFor="cs-date">
                Date
              </label>
              <input
                id="cs-date"
                type="date"
                required
                value={draft.session_date}
                onChange={(e) => set("session_date", e.target.value)}
                className={`${inputCls} mt-1.5`}
              />
            </div>
            <div>
              <label className="mono-label" htmlFor="cs-time">
                Time
              </label>
              <input
                id="cs-time"
                type="time"
                required
                value={draft.start_time}
                onChange={(e) => set("start_time", e.target.value)}
                className={`${inputCls} mt-1.5`}
              />
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Runs for {DURATION_MINUTES} minutes.
              </p>
            </div>
            <div>
              <label className="mono-label" htmlFor="cs-venue">
                Venue
              </label>
              <input
                id="cs-venue"
                value={draft.venue}
                onChange={(e) => set("venue", e.target.value)}
                placeholder="e.g. Seminar Hall B"
                className={`${inputCls} mt-1.5`}
              />
            </div>
            <div>
              <label className="mono-label" htmlFor="cs-department">
                Department
              </label>
              <input
                id="cs-department"
                value={draft.department}
                onChange={(e) => set("department", e.target.value)}
                placeholder="e.g. CSE, or leave for all"
                className={`${inputCls} mt-1.5`}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mono-label" htmlFor="cs-faculty">
                Faculty
              </label>
              <input
                id="cs-faculty"
                value={draft.faculty_name}
                onChange={(e) => set("faculty_name", e.target.value)}
                placeholder="Who is taking it"
                className={`${inputCls} mt-1.5`}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-3.5 py-2 text-xs font-medium hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CalendarPlus className="size-3.5" />
              )}
              {saving ? "Scheduling…" : "Schedule session"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
