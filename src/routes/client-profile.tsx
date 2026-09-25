import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  Briefcase,
  Building2,
  Check,
  IdCard,
  Landmark,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ShieldCheck,
  X,
} from "lucide-react";
import { clientOnboarding, me, type AuthUser, type ClientProfile } from "@/lib/api";
import { Shell } from "@/components/dash/Shell";
import { GateLoading } from "@/components/load-state";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/client-profile")({
  head: () => ({
    meta: [
      { title: "Your profile | TalentBro Institutions" },
      {
        name: "description",
        content: "Your institution staff profile and placement cell details.",
      },
    ],
  }),
  component: ClientProfilePage,
});

const INSTITUTION_TYPES = [
  "University",
  "Deemed University",
  "Autonomous College",
  "College",
  "Institute",
  "Polytechnic",
  "ITI",
  "Other",
];

type Draft = {
  institution_name: string;
  institution_type: string;
  website: string;
  email_domain: string;
  address: string;
  city: string;
  state: string;
  pin_code: string;
  logo: string;
  placement_department_name: string;
  placement_office_email: string;
  approximate_student_strength: string;
  mobile_number: string;
  designation: string;
  employee_staff_id: string;
};

function draftFromProfile(p: ClientProfile | undefined): Draft {
  const inst = p?.institution;
  const name = inst?.name ?? "";
  const domain =
    inst?.email_domain ||
    (inst?.website ? inst.website.replace(/^https?:\/\//i, "").replace(/\/.*$/, "") : "");
  return {
    institution_name: name,
    institution_type: inst?.institution_type ?? "",
    website: inst?.website ?? "",
    email_domain: domain,
    address: inst?.address ?? "",
    city: inst?.city ?? "",
    state: inst?.state ?? "",
    pin_code: inst?.pin_code ?? "",
    logo: inst?.logo ?? "",
    placement_department_name: inst?.placement_department_name ?? "",
    placement_office_email: inst?.placement_office_email ?? "",
    approximate_student_strength:
      inst?.approximate_student_strength != null ? String(inst.approximate_student_strength) : "",
    mobile_number: p?.mobile_number ?? "",
    designation: p?.designation ?? "",
    employee_staff_id: p?.employee_staff_id ?? "",
  };
}

const inputClass =
  "h-9 w-full rounded-md border border-input bg-card px-2.5 text-sm outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-ring/25";

const labelClass = "mb-1 block text-xs font-medium text-muted-foreground";

function Field({
  id,
  label,
  required,
  options,
  textarea,
  value,
  onChange,
  placeholder,
  readOnly,
  type = "text",
  inputMode,
}: {
  id: string;
  label: string;
  required?: boolean;
  options?: string[];
  textarea?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  type?: string;
  inputMode?: "numeric" | "tel" | "email" | "url" | "text";
}) {
  let control: ReactNode;
  if (options) {
    control = (
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(inputClass, "cursor-pointer")}
      >
        {value && !options.includes(value) ? <option value={value}>{value}</option> : null}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  } else if (textarea) {
    control = (
      <textarea
        id={id}
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className={cn(inputClass, "h-auto resize-none py-2")}
      />
    );
  } else {
    control = (
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        inputMode={inputMode}
        className={cn(
          inputClass,
          readOnly && "cursor-not-allowed bg-muted/40 text-muted-foreground",
        )}
      />
    );
  }
  return (
    <label htmlFor={id} className="block">
      <span className={labelClass}>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </span>
      {control}
    </label>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
          {label}
        </p>
        <p className="mt-0.5 truncate text-sm text-foreground">{value || "—"}</p>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  description,
  action,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="dash-panel">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Icon className="size-4" />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
        </div>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function ClientProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const current = await me();
        if (cancelled) return;
        if (!current) {
          void navigate({ to: "/institution-auth", search: { mode: "login" }, replace: true });
          return;
        }
        if (current.role !== "institution_staff") {
          void navigate({ to: "/candidate-auth", search: { mode: "login" }, replace: true });
          return;
        }
        if (current.profile_complete === false) {
          void navigate({ to: "/client-onboarding", replace: true });
          return;
        }
        setUser(current);
        setDraft(draftFromProfile(current.profile as ClientProfile | undefined));
        setStatus("ready");
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setSaveError("");
    setSaved(false);
  }

  function startEdit() {
    const p = user?.profile as ClientProfile | undefined;
    setDraft(draftFromProfile(p));
    setEditing(true);
    setSaveError("");
    setSaved(false);
  }

  async function save() {
    if (!draft) return;
    const missing = [
      ["institution_name", draft.institution_name],
      ["institution_type", draft.institution_type],
      ["website", draft.website],
      ["email_domain", draft.email_domain],
      ["address", draft.address],
      ["city", draft.city],
      ["state", draft.state],
      ["pin_code", draft.pin_code],
      ["placement_department_name", draft.placement_department_name],
      ["placement_office_email", draft.placement_office_email],
      ["mobile_number", draft.mobile_number],
      ["designation", draft.designation],
      ["employee_staff_id", draft.employee_staff_id],
    ].filter(([, v]) => !String(v).trim());
    if (missing.length > 0) {
      setSaveError("Please fill in all required fields before saving.");
      return;
    }
    if (
      !draft.approximate_student_strength.trim() ||
      Number(draft.approximate_student_strength) < 1
    ) {
      setSaveError("Approximate student strength must be at least 1.");
      return;
    }
    if (!/^[1-9][0-9]{5}$/.test(draft.pin_code)) {
      setSaveError("PIN code should be 6 digits and can't start with 0.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const updated = await clientOnboarding({
        ...draft,
        approximate_student_strength: Number(draft.approximate_student_strength),
      });
      setUser(updated);
      setDraft(draftFromProfile(updated.profile as ClientProfile | undefined));
      setEditing(false);
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save your profile.");
    } finally {
      setSaving(false);
    }
  }

  if (status === "loading") {
    return <GateLoading />;
  }

  if (status === "error" || !user || !draft) {
    return (
      <Shell title="Your profile">
        <div className="dash-panel p-10 text-center">
          <p className="text-sm font-semibold">Profile unavailable</p>
          <p className="mt-2 text-sm text-muted-foreground">
            We couldn't load your profile. Please refresh to try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
          >
            Refresh
          </button>
        </div>
      </Shell>
    );
  }

  const profile = user.profile as ClientProfile | undefined;
  const inst = profile?.institution;
  const p = (
    <dl className="divide-y divide-border">
      <Row icon={Mail} label="Official email" value={user.email} />
      <Row icon={Phone} label="Mobile number" value={draft.mobile_number} />
      <Row icon={Briefcase} label="Designation" value={draft.designation} />
      <Row icon={IdCard} label="Employee / staff ID" value={draft.employee_staff_id} />
      <Row
        icon={ShieldCheck}
        label="Access level"
        value={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
            {profile?.access === "master" ? "Master" : "Beta"}
            {profile?.has_master_access ? " · full editing access" : " · read-only"}
          </span>
        }
      />
    </dl>
  );

  const i = (
    <dl className="divide-y divide-border">
      <Row icon={Building2} label="Institution name" value={inst?.name} />
      <Row icon={Landmark} label="Institution type" value={inst?.institution_type} />
      <Row icon={Building2} label="Website" value={inst?.website} />
      <Row icon={Mail} label="Email domain" value={inst?.email_domain} />
      <Row icon={MapPin} label="Address" value={inst?.address} />
      <Row
        icon={MapPin}
        label="City / State / PIN"
        value={[inst?.city, inst?.state, inst?.pin_code].filter(Boolean).join(", ")}
      />
      <Row icon={Mail} label="Placement office email" value={inst?.placement_office_email} />
      <Row icon={Building2} label="Placement department" value={inst?.placement_department_name} />
      <Row
        icon={Building2}
        label="Student strength"
        value={inst?.approximate_student_strength?.toLocaleString("en-IN")}
      />
      <Row icon={Building2} label="Logo" value={inst?.logo} />
    </dl>
  );

  const profileEditForm = (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        id="mobile_number"
        label="Mobile number"
        required
        placeholder="+91 9876543210"
        value={draft.mobile_number}
        onChange={(v) => set("mobile_number", v)}
      />
      <Field
        id="designation"
        label="Designation"
        required
        placeholder="e.g. Training & Placement Officer"
        value={draft.designation}
        onChange={(v) => set("designation", v)}
      />
      <Field
        id="employee_staff_id"
        label="Employee / staff ID"
        required
        placeholder="e.g. EMP-2024-018"
        value={draft.employee_staff_id}
        onChange={(v) => set("employee_staff_id", v)}
      />
      <Field
        id="official_email"
        label="Official email"
        value={user.email}
        onChange={() => undefined}
        readOnly
      />
    </div>
  );

  const institutionEditForm = (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        id="institution_name"
        label="Institution name"
        required
        placeholder="e.g. Sardar Vallabhbhai Institute of Technology"
        value={draft.institution_name}
        onChange={(v) => set("institution_name", v)}
      />
      <Field
        id="institution_type"
        label="Institution type"
        required
        options={INSTITUTION_TYPES}
        value={draft.institution_type}
        onChange={(v) => set("institution_type", v)}
      />
      <Field
        id="website"
        label="Website"
        required
        type="url"
        placeholder="https://www.institution.edu.in"
        value={draft.website}
        onChange={(v) => set("website", v)}
      />
      <Field
        id="email_domain"
        label="Official email domain"
        required
        placeholder="institution.edu.in"
        value={draft.email_domain}
        onChange={(v) => set("email_domain", v)}
      />
      <Field
        id="address"
        label="Address"
        required
        textarea
        placeholder="Street, area, landmark…"
        value={draft.address}
        onChange={(v) => set("address", v)}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          id="city"
          label="City"
          required
          placeholder="e.g. Pune"
          value={draft.city}
          onChange={(v) => set("city", v)}
        />
        <Field
          id="state"
          label="State"
          required
          placeholder="e.g. Maharashtra"
          value={draft.state}
          onChange={(v) => set("state", v)}
        />
        <Field
          id="pin_code"
          label="PIN code"
          required
          inputMode="numeric"
          placeholder="411001"
          value={draft.pin_code}
          onChange={(v) => set("pin_code", v.replace(/\D/g, "").slice(0, 6))}
        />
      </div>
      <Field
        id="placement_department_name"
        label="Placement department name"
        required
        placeholder="e.g. Career Development & Placement Cell"
        value={draft.placement_department_name}
        onChange={(v) => set("placement_department_name", v)}
      />
      <Field
        id="placement_office_email"
        label="Placement office email"
        required
        type="email"
        placeholder="placement@institution.edu.in"
        value={draft.placement_office_email}
        onChange={(v) => set("placement_office_email", v)}
      />
      <Field
        id="approximate_student_strength"
        label="Approximate student strength"
        required
        type="number"
        inputMode="numeric"
        placeholder="e.g. 5000"
        value={draft.approximate_student_strength}
        onChange={(v) => set("approximate_student_strength", v)}
      />
      <Field
        id="logo"
        label="Logo URL"
        type="url"
        placeholder="https://www.institution.edu.in/logo.png"
        value={draft.logo}
        onChange={(v) => set("logo", v)}
      />
    </div>
  );

  return (
    <Shell
      title="Your profile"
      subtitle={`${draft.institution_name || "Your institution"} · ${draft.designation || "Institution staff"}`}
      actions={
        editing ? (
          <>
            <button
              type="button"
              onClick={() => {
                setDraft(draftFromProfile(user.profile as ClientProfile | undefined));
                setEditing(false);
                setSaveError("");
                setSaved(false);
              }}
              disabled={saving}
              className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3.5 text-xs font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X className="size-3.5" /> Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md bg-primary px-3.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Check className="size-3.5" /> Save changes
                </>
              )}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={startEdit}
            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3.5 text-xs font-medium transition-colors hover:bg-muted"
          >
            <Pencil className="size-3.5" /> Edit profile
          </button>
        )
      }
    >
      {saved && (
        <div className="mb-5 flex items-center gap-2.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <Check className="size-4" /> Your profile has been updated.
        </div>
      )}
      {saveError && (
        <div
          role="alert"
          className="mb-5 rounded-md border border-red-500/40 bg-red-500/5 px-4 py-3 text-xs leading-relaxed text-red-500"
        >
          {saveError}
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-5">
        <div className="grid size-14 place-items-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
          {user.name
            ? user.name
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0] ?? "")
                .join("")
                .toUpperCase()
            : (user.email || "TB").slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold">{user.name || user.email}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" />
            {profile?.access === "master" ? "Master" : "Beta"} access ·{" "}
            {inst?.name ?? user.institution ?? "Institution staff"}
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section
          icon={Briefcase}
          title="Your profile"
          description="Your placement-cell staff details"
        >
          {editing ? profileEditForm : p}
        </Section>

        <Section
          icon={Building2}
          title="Institution"
          description="Details students see during their own onboarding"
        >
          {editing ? institutionEditForm : i}
        </Section>
      </div>

      <p className="mt-4 font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
        Required fields are marked with * · official email can't be changed here
      </p>
    </Shell>
  );
}
