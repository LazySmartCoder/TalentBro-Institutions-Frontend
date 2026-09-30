import { useState, type FormEvent } from "react";
import { Copy, Loader2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import {
  addPlacementCellMember,
  type PlacementCellMember,
  type PlacementCellMemberPayload,
} from "@/lib/api";

const EMPTY = {
  full_name: "",
  official_email: "",
  designation: "",
  mobile_number: "",
  employee_staff_id: "",
  access: "beta",
};

type Draft = typeof EMPTY;

const inputCls =
  "h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring/20";

/**
 * Add a colleague to the placement department.
 *
 * The member is created as a ClientProfile on this same institution, so they
 * land in the same dashboards the owner is looking at. They start with Beta
 * (read-only) access unless the owner deliberately grants Master.
 */
export function AddMemberDialog({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: (member: PlacementCellMember) => void;
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [issued, setIssued] = useState<{ member: PlacementCellMember; password: string } | null>(
    null,
  );

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const payload: PlacementCellMemberPayload = {
        full_name: draft.full_name.trim(),
        official_email: draft.official_email.trim(),
        designation: draft.designation.trim(),
        mobile_number: draft.mobile_number.trim(),
        employee_staff_id: draft.employee_staff_id.trim(),
        access: draft.access as NonNullable<PlacementCellMemberPayload["access"]>,
      };
      const res = await addPlacementCellMember(payload);
      setIssued({ member: res.member, password: res.temporary_password });
      onAdded(res.member);
      toast.success(`Added ${res.member.full_name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add the member.");
    } finally {
      setSaving(false);
    }
  }

  // The temporary password is shown exactly once and never stored, so the owner
  // has to copy it down before the dialog closes.
  if (issued) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center">
        <div className="panel w-full max-w-md">
          <div className="flex items-start justify-between border-b border-border px-6 py-5">
            <div>
              <h2 className="text-lg font-bold">{issued.member.full_name} added</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                They can sign in at the institution portal with this password, then change it from
                their profile.
              </p>
            </div>
            <button onClick={onClose} aria-label="Close" className="rounded-md p-1 hover:bg-accent">
              <X className="size-4" />
            </button>
          </div>
          <div className="px-6 py-5">
            <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-4 py-3">
              <code className="select-all font-mono text-sm">{issued.password}</code>
              <button
                onClick={() => {
                  void navigator.clipboard.writeText(issued.password);
                  toast.success("Password copied");
                }}
                aria-label="Copy temporary password"
                className="rounded-md p-1.5 hover:bg-accent"
              >
                <Copy className="size-3.5" />
              </button>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              This password is shown once and is not stored in plain text. Share it with{" "}
              {issued.member.full_name.split(" ")[0]} over a channel you trust.
            </p>
          </div>
          <div className="flex justify-end border-t border-border px-6 py-4">
            <button
              onClick={onClose}
              className="rounded-md bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center">
      <div className="panel w-full max-w-lg overflow-y-auto">
        <form onSubmit={submit}>
          <div className="flex items-start justify-between border-b border-border px-6 py-5">
            <div>
              <h2 className="text-lg font-bold">Add a placement cell member</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                They join this college's placement department and can sign in straight away.
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
              <label className="mono-label" htmlFor="am-name">
                Full name
              </label>
              <input
                id="am-name"
                required
                value={draft.full_name}
                onChange={(e) => set("full_name", e.target.value)}
                placeholder="e.g. Priya Menon"
                className={`${inputCls} mt-1.5`}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mono-label" htmlFor="am-email">
                Official email
              </label>
              <input
                id="am-email"
                type="email"
                required
                value={draft.official_email}
                onChange={(e) => set("official_email", e.target.value)}
                placeholder="name@college.edu"
                className={`${inputCls} mt-1.5`}
              />
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                This is also their sign-in username.
              </p>
            </div>
            <div>
              <label className="mono-label" htmlFor="am-designation">
                Designation
              </label>
              <input
                id="am-designation"
                required
                value={draft.designation}
                onChange={(e) => set("designation", e.target.value)}
                placeholder="e.g. Placement Coordinator"
                className={`${inputCls} mt-1.5`}
              />
            </div>
            <div>
              <label className="mono-label" htmlFor="am-mobile">
                Mobile number
              </label>
              <input
                id="am-mobile"
                required
                inputMode="numeric"
                value={draft.mobile_number}
                onChange={(e) => set("mobile_number", e.target.value)}
                placeholder="10-digit number"
                className={`${inputCls} mt-1.5`}
              />
            </div>
            <div>
              <label className="mono-label" htmlFor="am-empid">
                Employee ID
              </label>
              <input
                id="am-empid"
                value={draft.employee_staff_id}
                onChange={(e) => set("employee_staff_id", e.target.value)}
                placeholder="Optional"
                className={`${inputCls} mt-1.5`}
              />
            </div>
            <div>
              <label className="mono-label" htmlFor="am-access">
                Access level
              </label>
              <select
                id="am-access"
                value={draft.access}
                onChange={(e) => set("access", e.target.value)}
                className={`${inputCls} mt-1.5`}
              >
                <option value="beta">Beta — view only</option>
                <option value="master">Master — full access</option>
              </select>
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
                <UserPlus className="size-3.5" />
              )}
              {saving ? "Adding…" : "Add member"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
