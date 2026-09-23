import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Award,
  Briefcase,
  Calendar,
  Code2,
  ExternalLink,
  FolderGit2,
  Gauge,
  GraduationCap,
  IndianRupee,
  Languages,
  Link2,
  Lock,
  Mail,
  MapPin,
  MessageSquare,
  Pencil,
  Phone,
  Save,
  Sparkles,
  Trash2,
  User,
  X,
} from "lucide-react";
import { AppNavHeader } from "@/components/tb/app-nav";
import {
  changePassword,
  deleteAccount,
  getProfile,
  me,
  searchInstitutions,
  updateProfile,
  type AuthUser,
  type CandidateProfilePayload,
  type PerformanceComponents,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { COURSES_OFFERED } from "@/lib/data";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { GateError, GateLoading } from "@/components/load-state";

const title = "My Profile | TalentBro";

export const Route = createFileRoute("/candidate-profile")({
  head: () => ({
    meta: [
      { title },
      { property: "og:title", content: title },
      { property: "og:type", content: "website" },
    ],
  }),
  component: CandidateProfilePage,
});

function initialsOf(name?: string, email?: string) {
  const source = (name || email || "?").trim();
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();
}

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtCtc(value?: number | null) {
  if (value == null) return "—";
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 1 })} LPA`;
}

type Nicety = Record<string, unknown> & {
  [key: string]: unknown;
};

const LANGUAGE_LABELS: Record<string, string> = {
  english: "English",
  hindi: "Hindi",
  bengali: "Bengali",
  tamil: "Tamil",
  telugu: "Telugu",
  marathi: "Marathi",
  kannada: "Kannada",
  gujarati: "Gujarati",
  malayalam: "Malayalam",
  punjabi: "Punjabi",
  odia: "Odia",
  assamese: "Assamese",
  urdu: "Urdu",
};

function languageLabel(value?: string): string {
  if (!value) return "—";
  return (
    LANGUAGE_LABELS[value] ?? value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function itemLabel(item: unknown, fallbacks: string[]): string {
  if (typeof item === "string") return item;
  if (item && typeof item === "object") {
    const record = item as Nicety;
    for (const key of fallbacks) {
      const value = record[key];
      if (typeof value === "string" && value) return value;
      if (typeof value === "number") return String(value);
    }
  }
  return "—";
}

function oc(section: string, status: string): string;
function oc(section: string, status: string, label?: string): string {
  const base: Record<string, string> = {
    bg: "bg-background",
    card: "rounded-xl border border-border bg-card",
    label: "font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase",
    chip: "inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px]",
  };
  switch (status) {
    case "card":
      return base["card"]!;
    case "label":
      return base["label"]!;
    case "chip":
      return base["chip"]!;
    case "value":
      return "text-sm font-medium";
    default:
      return (base as Record<string, string>)[status] ?? "";
  }
}

function Section({
  icon,
  title: sectionTitle,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="flex items-center gap-2.5 border-b border-border px-4 py-3">
        <span className="grid size-7 place-items-center rounded-md bg-muted text-muted-foreground">
          {icon}
        </span>
        <h2 className="text-sm font-semibold">{sectionTitle}</h2>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 py-2.5 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-[13px] font-medium text-foreground">{value ?? "—"}</span>
    </div>
  );
}

function PillarBar({
  label,
  score,
  detail,
}: {
  label: string;
  score: number | null;
  detail: string;
}) {
  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium text-foreground">{label}</span>
        <span className="text-xs font-semibold tabular-nums">
          {score != null ? `${Math.round(score)}/100` : "Not started"}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-emerald-500"
          style={{ width: `${score != null ? Math.max(0, Math.min(100, score)) : 0}%` }}
        />
      </div>
      {detail && <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>}
    </div>
  );
}

function ReadinessBreakdown({ performance }: { performance: PerformanceComponents | null }) {
  if (!performance) {
    return (
      <Section icon={<Gauge className="size-4" />} title="Readiness breakdown">
        <p className="text-xs text-muted-foreground">
          Complete a mock interview, finish a self-training module, or chat with TalentBro to start
          building your readiness score.
        </p>
      </Section>
    );
  }
  return (
    <Section icon={<Gauge className="size-4" />} title="Readiness breakdown">
      <div className="divide-y divide-border/60">
        <PillarBar
          label="Mock Interviews"
          score={performance.mock_interview}
          detail={
            performance.mock_interviews
              ? `${performance.mock_interviews} analysed`
              : "No mock interviews analysed yet"
          }
        />
        <PillarBar
          label="Self-Training"
          score={performance.self_training}
          detail={
            performance.modules.length
              ? performance.modules.map((m) => `${m.label} ${m.score}`).join(" · ")
              : "No modules completed yet"
          }
        />
        <PillarBar
          label="TalentBro Chat"
          score={performance.chat}
          detail={`${performance.chat_messages} messages across ${performance.chat_sessions} sessions`}
        />
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Weighted blend of mock interviews, self-training and chat engagement, renormalised over the
        pillars you have started.
      </p>
    </Section>
  );
}

function Chips({ items }: { items: string[] }) {
  if (!items.length) return <p className="text-xs text-muted-foreground">Nothing added yet.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, i) => (
        <span key={`${item}-${i}`} className={oc("", "chip")}>
          {item}
        </span>
      ))}
    </div>
  );
}

function ItemCards({ items, type }: { items: unknown[]; type: "project" | "intern" | "work" }) {
  if (!items.length) return <p className="text-xs text-muted-foreground">Nothing added yet.</p>;
  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const first = itemLabel(
          item,
          type === "project" ? ["title", "name", "project"] : ["company", "role", "org", "title"],
        );
        const second = itemLabel(
          item,
          type === "project" ? ["tech", "stack", "description"] : ["role", "position", "duration"],
        );
        const third = itemLabel(
          item,
          type === "project"
            ? ["description", "link", "url"]
            : ["period", "duration", "description", "summary"],
        );
        return (
          <div key={i} className="rounded-lg border border-border/70 bg-muted/30 px-4 py-3.5">
            <p className="text-sm font-semibold">{first}</p>
            {second !== first && second !== "—" && (
              <p className="mt-1 text-[13px] text-muted-foreground">{second}</p>
            )}
            {third !== first && third !== second && third !== "—" && (
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground/80">{third}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- edit form draft ---------------------------------------------------------
type Draft = {
  full_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  gender: string;
  college: string;
  department: string;
  program: string;
  start_year: string;
  end_year: string;
  cgpa: string;
  linkedin_url: string;
  github_url: string;
  portfolio_url: string;
  skills: string;
  certifications: string;
  expected_ctc: string;
  preferred_roles: string;
  preferred_locations: string;
  preferred_language: string;
};

function draftFrom(payload: CandidateProfilePayload): Draft {
  const p = payload.profile;
  const empty: Omit<Draft, "full_name" | "email"> = {
    phone: "",
    date_of_birth: "",
    gender: "",
    college: "",
    department: "",
    program: "",
    start_year: "",
    end_year: "",
    cgpa: "",
    linkedin_url: "",
    github_url: "",
    portfolio_url: "",
    skills: "",
    certifications: "",
    expected_ctc: "",
    preferred_roles: "",
    preferred_locations: "",
    preferred_language: "",
  };
  const toCsv = (list: string[]) => list.join(", ");
  const fill = {
    ...empty,
    ...(p
      ? {
          phone: p.phone,
          date_of_birth: p.date_of_birth ?? "",
          gender: p.gender,
          college: p.college,
          department: p.department,
          program: p.program,
          start_year: p.start_year != null ? String(p.start_year) : "",
          end_year: p.end_year != null ? String(p.end_year) : "",
          cgpa: p.cgpa != null ? String(p.cgpa) : "",
          linkedin_url: p.linkedin_url,
          github_url: p.github_url,
          portfolio_url: p.portfolio_url,
          skills: toCsv(p.skills),
          certifications: toCsv(p.certifications),
          expected_ctc: p.expected_ctc != null ? String(p.expected_ctc) : "",
          preferred_roles: toCsv(p.preferred_roles),
          preferred_locations: toCsv(p.preferred_locations),
          preferred_language: p.preferred_language ?? "",
        }
      : {}),
  };
  return {
    full_name: payload.user.first_name || p?.full_name || "",
    email: payload.user.email,
    ...fill,
  };
}

function csvToList(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

const GENDERS = ["", "male", "female", "other", "prefer_not_to_say"];

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  readOnly,
  step,
  required,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  readOnly?: boolean;
  step?: string;
  required?: boolean;
  options?: string[];
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </span>
      {id === "gender" ? (
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-card px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/25"
        >
          {GENDERS.map((g) => (
            <option key={g} value={g}>
              {g
                ? g.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                : "Prefer not to say"}
            </option>
          ))}
        </select>
      ) : options ? (
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-card px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/25"
        >
          {value && !options.includes(value) ? <option value={value}>{value}</option> : null}
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          readOnly={readOnly}
          step={step}
          className="h-9 w-full rounded-md border border-input bg-card px-2.5 text-sm outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-60"
        />
      )}
    </label>
  );
}

function CandidateProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [payload, setPayload] = useState<CandidateProfilePayload | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [delPassword, setDelPassword] = useState("");
  const [delError, setDelError] = useState("");
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdOld, setPwdOld] = useState("");
  const [pwdNew, setPwdNew] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdError, setPwdError] = useState("");
  const [pwdSuccess, setPwdSuccess] = useState("");
  const [deptOptions, setDeptOptions] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const current = await me();
        if (cancelled) return;
        if (!current) {
          void navigate({ to: "/candidate-auth", search: { mode: "login" }, replace: true });
          return;
        }
        if (current.profile_complete === false) {
          void navigate({ to: "/onboarding", replace: true });
          return;
        }
        const [profilePayload] = await Promise.all([getProfile()]);
        if (cancelled) return;
        setUser(current);
        setPayload(profilePayload);
        setStatus("ready");
      } catch (err) {
        if (!cancelled) {
          setErrorMessage(err instanceof Error ? err.message : null);
          setStatus("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [editing]);

  function startEdit() {
    if (!payload) return;
    const d = draftFrom(payload);
    setDraft(d);
    setEditing(true);
    setError("");
    setDeptOptions([]);
    if (d.college) {
      searchInstitutions(d.college)
        .then((institutions) => {
          const match = institutions.find((i) => i.name.toLowerCase() === d.college.toLowerCase());
          setDeptOptions(match?.departments ?? []);
        })
        .catch(() => setDeptOptions([]));
    }
  }

  function setD(key: keyof Draft) {
    return (value: string) => setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  async function save() {
    if (!draft || saving) return;
    const requiredFields = [
      ["department", "Department"],
      ["program", "Program"],
      ["start_year", "Start year"],
      ["end_year", "End year"],
      ["phone", "Mobile number"],
      ["date_of_birth", "Date of birth"],
      ["gender", "Gender"],
      ["cgpa", "CGPA"],
      ["linkedin_url", "LinkedIn URL"],
    ] as const;
    const missing = requiredFields.filter(([key]) => !draft[key]?.trim()).map(([, label]) => label);
    if (missing.length) {
      setError(`Please fill in the required fields: ${missing.join(", ")}`);
      return;
    }
    setSaving(true);
    setError("");
    const body: Record<string, unknown> = {
      phone: draft.phone,
      date_of_birth: draft.date_of_birth || null,
      gender: draft.gender,
      department: draft.department,
      program: draft.program,
      start_year: draft.start_year ? Number(draft.start_year) : null,
      end_year: draft.end_year ? Number(draft.end_year) : null,
      cgpa: draft.cgpa ? Number(draft.cgpa) : null,
      linkedin_url: draft.linkedin_url,
      github_url: draft.github_url,
      portfolio_url: draft.portfolio_url,
      skills: csvToList(draft.skills),
      certifications: csvToList(draft.certifications),
      preferred_roles: csvToList(draft.preferred_roles),
      preferred_locations: csvToList(draft.preferred_locations),
      preferred_language: draft.preferred_language.trim(),
      expected_ctc: draft.expected_ctc ? Number(draft.expected_ctc) : null,
    };
    try {
      const updated = await updateProfile(body);
      setPayload(updated);
      setEditing(false);
      setDraft(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleting) return;
    if (!delPassword.trim()) {
      setDelError("Please enter your password to confirm deletion.");
      return;
    }
    setDeleting(true);
    setDelError("");
    try {
      await deleteAccount(delPassword);
    } catch (err) {
      setDeleting(false);
      setDelError(err instanceof Error ? err.message : "Failed to delete account.");
      return;
    }
    setDeleteOpen(false);
    void navigate({ to: "/", replace: true });
  }

  async function handleChangePassword() {
    if (pwdSaving) return;
    if (!pwdOld.trim()) {
      setPwdError("Please enter your current password.");
      return;
    }
    if (!pwdNew) {
      setPwdError("Please enter a new password.");
      return;
    }
    if (pwdNew !== pwdConfirm) {
      setPwdError("New passwords do not match.");
      return;
    }
    setPwdSaving(true);
    setPwdError("");
    setPwdSuccess("");
    try {
      await changePassword(pwdOld, pwdNew);
      setPwdOld("");
      setPwdNew("");
      setPwdConfirm("");
      setPwdSuccess("Your password has been updated successfully.");
    } catch (err) {
      setPwdError(err instanceof Error ? err.message : "Failed to update password.");
    } finally {
      setPwdSaving(false);
    }
  }

  if (status === "loading") {
    return <GateLoading />;
  }

  if (status === "error" || !user || !payload) {
    return <GateError message={errorMessage} />;
  }

  const p = payload.profile;
  const stats = payload.stats;
  const education = [p?.program, p?.college].filter(Boolean).join(" · ");
  const profileMeta = [
    { icon: Mail, label: "Email", value: payload.user.email, href: `mailto:${payload.user.email}` },
    { icon: Phone, label: "Phone", value: p?.phone || "—" },
    { icon: Calendar, label: "Date of birth", value: fmtDate(p?.date_of_birth) },
    {
      icon: User,
      label: "Gender",
      value: p?.gender ? p.gender.replace(/_/g, " ") : "—",
    },
  ];
  const presenceLinks = [
    { label: "LinkedIn", value: p?.linkedin_url },
    { label: "GitHub", value: p?.github_url },
    { label: "Portfolio", value: p?.portfolio_url },
  ].filter((link) => link.value);

  const ranks = payload.ranks;
  const performance = payload.performance;

  const kpis = [
    {
      label: "Readiness Score",
      value: ranks.score != null ? ranks.score.toFixed(1) : "—",
      hint: "TalentBro composite",
    },
    {
      label: "Department Rank",
      value: ranks.department != null ? `#${ranks.department}` : "—",
      hint:
        ranks.department != null
          ? `of ${ranks.department_total} in ${p?.department || "your department"}`
          : "within your college",
    },
    {
      label: "All Institute Rank (AIR)",
      value: ranks.overall != null ? `#${ranks.overall}` : "—",
      hint: ranks.total ? `of ${ranks.total} in your college` : "within your college",
    },
    { label: "Chat Sessions", value: stats.chat_sessions, hint: "coach chats" },
  ];

  return (
    <div className="min-h-svh bg-background text-foreground">
      <AppNavHeader
        current="profile"
        sticky
        left={
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => void navigate({ to: "/chat", replace: true })}
              className="grid size-8 cursor-pointer place-items-center rounded-md border border-border/60 bg-background/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Back to Home"
            >
              <ArrowLeft className="size-4" />
            </button>
            <span className="grid size-9 place-items-center rounded-lg bg-foreground text-background">
              <User className="size-4" />
            </span>
            <span>
              <p className="text-sm font-semibold leading-tight">My Profile</p>
            </span>
          </div>
        }
      />

      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        {editing && draft ? (
          /* ---------------------------------- EDIT ---------------------------------- */
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold">Edit profile</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Keep your placement profile complete and up to date.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {error && <span className="text-xs text-red-500">{error}</span>}
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setDraft(null);
                    setError("");
                  }}
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted"
                >
                  <X className="size-3.5" /> Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  <Save className="size-3.5" /> {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/50 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
              <MessageSquare className="mt-0.5 size-4 shrink-0" />
              <p>
                Projects and internships can only be updated by chatting with us. Tell us about your
                work and we'll add it to your profile.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Section icon={<User className="size-4" />} title="Basic details">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    id="phone"
                    label="Mobile number"
                    value={draft.phone}
                    onChange={setD("phone")}
                    placeholder="+91…"
                    required
                  />
                  <Field
                    id="date_of_birth"
                    label="Date of birth"
                    type="date"
                    value={draft.date_of_birth}
                    onChange={setD("date_of_birth")}
                    required
                  />
                  <Field
                    id="gender"
                    label="Gender"
                    value={draft.gender}
                    onChange={setD("gender")}
                    required
                  />
                </div>
              </Section>

              <Section icon={<GraduationCap className="size-4" />} title="Education">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    id="department"
                    label="Department"
                    value={draft.department}
                    onChange={setD("department")}
                    options={deptOptions}
                    required
                  />
                  <Field
                    id="program"
                    label="Program"
                    value={draft.program}
                    onChange={setD("program")}
                    options={COURSES_OFFERED}
                    required
                  />
                  <Field
                    id="start_year"
                    label="Start year"
                    type="number"
                    value={draft.start_year}
                    onChange={setD("start_year")}
                    required
                  />
                  <Field
                    id="end_year"
                    label="End year"
                    type="number"
                    value={draft.end_year}
                    onChange={setD("end_year")}
                    required
                  />
                  <Field
                    id="cgpa"
                    label="CGPA"
                    type="number"
                    step="0.1"
                    value={draft.cgpa}
                    onChange={setD("cgpa")}
                    required
                  />
                </div>
              </Section>

              <Section icon={<Link2 className="size-4" />} title="Resume & online presence">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    id="linkedin_url"
                    label="LinkedIn"
                    value={draft.linkedin_url}
                    onChange={setD("linkedin_url")}
                    required
                  />
                  <Field
                    id="github_url"
                    label="GitHub"
                    value={draft.github_url}
                    onChange={setD("github_url")}
                  />
                  <Field
                    id="portfolio_url"
                    label="Portfolio"
                    value={draft.portfolio_url}
                    onChange={setD("portfolio_url")}
                  />
                </div>
              </Section>

              <Section
                icon={<Sparkles className="size-4" />}
                title="Skills, certifications & preferences"
              >
                <div className="grid gap-3">
                  <Field
                    id="skills"
                    label="Skills (comma separated)"
                    value={draft.skills}
                    onChange={setD("skills")}
                    placeholder="Python, DSA, Communication"
                  />
                  <Field
                    id="certifications"
                    label="Certifications (comma separated)"
                    value={draft.certifications}
                    onChange={setD("certifications")}
                  />
                  <Field
                    id="preferred_roles"
                    label="Preferred roles (comma separated)"
                    value={draft.preferred_roles}
                    onChange={setD("preferred_roles")}
                    placeholder="SDE, Data Analyst"
                  />
                  <Field
                    id="preferred_locations"
                    label="Preferred locations (comma separated)"
                    value={draft.preferred_locations}
                    onChange={setD("preferred_locations")}
                    placeholder="Pune, Bangalore"
                  />
                  <Field
                    id="preferred_language"
                    label="Preferred language"
                    value={draft.preferred_language}
                    onChange={setD("preferred_language")}
                    placeholder="e.g. English"
                  />
                  <Field
                    id="expected_ctc"
                    label="Expected CTC (LPA)"
                    type="number"
                    value={draft.expected_ctc}
                    onChange={setD("expected_ctc")}
                    placeholder="e.g. 8"
                  />
                </div>
              </Section>
            </div>
          </div>
        ) : (
          /* ---------------------------------- VIEW ---------------------------------- */
          <div className="space-y-4">
            {/* Hero */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center gap-4">
                <Avatar className="size-16 rounded-2xl">
                  {payload.user.avatar ? (
                    <AvatarImage src={payload.user.avatar} alt={payload.user.name || "Profile"} />
                  ) : null}
                  <AvatarFallback className="rounded-2xl bg-primary font-display text-xl font-bold text-primary-foreground">
                    {initialsOf(payload.user.name, payload.user.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                    {payload.user.name}
                  </h1>
                  <p className="text-sm text-muted-foreground">{payload.user.email}</p>
                  {education && (
                    <p className="mt-1 text-[13px] text-muted-foreground/80">{education}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    title="Preferred language"
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground"
                  >
                    <Languages className="size-3.5" />
                    {languageLabel(p?.preferred_language || "english")}
                  </span>
                  <button
                    type="button"
                    onClick={startEdit}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-foreground px-3.5 py-2 text-xs font-medium text-background transition-opacity hover:opacity-90"
                  >
                    <Pencil className="size-3.5" /> Edit profile
                  </button>
                </div>
              </div>
            </div>

            {/* KPIs */}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {kpis.map((kpi) => (
                <div
                  key={kpi.label}
                  className="rounded-xl border border-border bg-card px-4 py-3.5"
                >
                  <p className={oc("", "label")}>{kpi.label}</p>
                  <p className="mt-1.5 text-2xl font-bold">{kpi.value}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{kpi.hint}</p>
                </div>
              ))}
            </div>

            <ReadinessBreakdown performance={performance} />

            <div className="grid gap-4 lg:grid-cols-2">
              <Section icon={<User className="size-4" />} title="Personal details">
                <Row label="Name" value={payload.user.name} />
                <Row label="Email" value={payload.user.email} />
                <Row label="Phone" value={p?.phone || "—"} />
                <Row label="Date of birth" value={fmtDate(p?.date_of_birth)} />
                <Row label="Gender" value={p?.gender ? p.gender.replace(/_/g, " ") : "—"} />
                <Row label="Member since" value={fmtDate(payload.user.date_joined)} />
                <Row label="Last login" value={fmtDate(payload.user.last_login)} />
              </Section>

              <Section icon={<GraduationCap className="size-4" />} title="Education">
                <Row label="College / Institute" value={p?.college || "—"} />
                <Row label="Department" value={p?.department || "—"} />
                <Row label="Program" value={p?.program || "—"} />
                <Row label="Start year" value={p?.start_year ?? "—"} />
                <Row label="End year" value={p?.end_year ?? "—"} />
                <Row label="CGPA" value={p?.cgpa != null ? p?.cgpa : "—"} />
              </Section>

              <Section icon={<Link2 className="size-4" />} title="Resume & online presence">
                {presenceLinks.length === 0 && (
                  <p className="text-xs text-muted-foreground">No links added yet.</p>
                )}
                {presenceLinks.map((link) => (
                  <Row
                    key={link.label}
                    label={link.label}
                    value={
                      <a
                        href={link.value}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex max-w-full items-center gap-1 truncate text-emerald-600 hover:underline dark:text-emerald-400"
                      >
                        <span className="truncate">{link.value}</span>
                        <ExternalLink className="size-3 shrink-0" />
                      </a>
                    }
                  />
                ))}
              </Section>

              <Section icon={<Briefcase className="size-4" />} title="Job preferences">
                <div className="py-2">
                  <p className={oc("", "label")}>Preferred roles</p>
                  <div className="mt-2">
                    <Chips items={p?.preferred_roles ?? []} />
                  </div>
                </div>
                <div className="py-2">
                  <p className={oc("", "label")}>Preferred locations</p>
                  <div className="mt-2">
                    <Chips items={p?.preferred_locations ?? []} />
                  </div>
                </div>
                <div className="py-2">
                  <p className={oc("", "label")}>Expected CTC</p>
                  <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium">
                    <IndianRupee className="size-4 text-muted-foreground" />
                    {fmtCtc(p?.expected_ctc)}
                  </p>
                </div>
              </Section>
            </div>

            <Section icon={<Sparkles className="size-4" />} title="Skills">
              <Chips items={p?.skills ?? []} />
            </Section>

            <Section icon={<Award className="size-4" />} title="Certifications">
              <Chips items={p?.certifications ?? []} />
            </Section>

            <Section icon={<FolderGit2 className="size-4" />} title="Projects">
              <ItemCards items={p?.projects ?? []} type="project" />
            </Section>

            <Section icon={<Code2 className="size-4" />} title="Internships">
              <ItemCards items={p?.internships ?? []} type="intern" />
            </Section>

            <div className="flex items-center gap-2 pb-6 text-xs text-muted-foreground">
              <MessageSquare className="size-3.5" />
              Your profile powers your placement-prep coach. Keep it updated for personalized
              guidance.
            </div>

            <div className="mt-6 border-t border-border pt-6 pb-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">Update Password</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Keep your account secure by changing your password regularly.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPwdOpen(true);
                    setPwdError("");
                    setPwdSuccess("");
                  }}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3.5 py-2 text-xs font-medium transition-colors hover:bg-muted"
                >
                  <Lock className="size-3.5" /> Update password
                </button>
              </div>
            </div>

            <div className="mt-6 border-t border-border pt-6 pb-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-destructive">Danger zone</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Permanently delete your account and all your data (profile, chats & mock
                    interviews). This cannot be undone.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteOpen(true)}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3.5 py-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                >
                  <Trash2 className="size-3.5" /> Delete account
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) {
            setDelPassword("");
            setDelError("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your TalentBro account and everything associated with it
              — your placement profile, chat history, and mock interviews. This action cannot be
              undone. Please enter your password to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <label htmlFor="delete_password" className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Password</span>
            <input
              id="delete_password"
              type="password"
              value={delPassword}
              onChange={(e) => {
                setDelPassword(e.target.value);
                setDelError("");
              }}
              disabled={deleting}
              autoComplete="current-password"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleDeleteAccount();
                }
              }}
              placeholder="Enter your password"
              className="h-9 w-full rounded-md border border-input bg-card px-2.5 text-sm outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>

          {delError && (
            <p className="text-xs text-red-500" role="alert">
              {delError}
            </p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteAccount();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Yes, delete my account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pwdOpen}
        onOpenChange={(open) => {
          setPwdOpen(open);
          if (!open) {
            setPwdOld("");
            setPwdNew("");
            setPwdConfirm("");
            setPwdError("");
            setPwdSuccess("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update your password</AlertDialogTitle>
            <AlertDialogDescription>
              Enter your current password and choose a strong new password to keep your account
              secure.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3">
            <label htmlFor="current_password" className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Current password
              </span>
              <input
                id="current_password"
                type="password"
                value={pwdOld}
                onChange={(e) => {
                  setPwdOld(e.target.value);
                  setPwdError("");
                  setPwdSuccess("");
                }}
                disabled={pwdSaving}
                autoComplete="current-password"
                placeholder="Enter your current password"
                className="h-9 w-full rounded-md border border-input bg-card px-2.5 text-sm outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
            <label htmlFor="new_password" className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                New password
              </span>
              <input
                id="new_password"
                type="password"
                value={pwdNew}
                onChange={(e) => {
                  setPwdNew(e.target.value);
                  setPwdError("");
                  setPwdSuccess("");
                }}
                disabled={pwdSaving}
                autoComplete="new-password"
                placeholder="Enter your new password"
                className="h-9 w-full rounded-md border border-input bg-card px-2.5 text-sm outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
            <label htmlFor="confirm_new_password" className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Confirm new password
              </span>
              <input
                id="confirm_new_password"
                type="password"
                value={pwdConfirm}
                onChange={(e) => {
                  setPwdConfirm(e.target.value);
                  setPwdError("");
                  setPwdSuccess("");
                }}
                disabled={pwdSaving}
                autoComplete="new-password"
                placeholder="Re-enter your new password"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleChangePassword();
                  }
                }}
                className="h-9 w-full rounded-md border border-input bg-card px-2.5 text-sm outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
          </div>

          {pwdError && (
            <p className="text-xs text-red-500" role="alert">
              {pwdError}
            </p>
          )}
          {pwdSuccess && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400" role="status">
              {pwdSuccess}
            </p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={pwdSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleChangePassword();
              }}
              disabled={pwdSaving}
            >
              {pwdSaving ? "Updating…" : "Update password"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
