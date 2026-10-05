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
  Linkedin,
  Lock,
  Mail,
  MapPin,
  MessageSquare,
  Pencil,
  Phone,
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
  type AuthUser,
  type CandidateProfilePayload,
  type PerformanceComponents,
  type PillarRanks,
} from "@/lib/api";
import { PERF_PILLARS, pillarStanding } from "@/lib/perf";
import { cn } from "@/lib/utils";
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

export const Route = createFileRoute("/candidate/profile")({
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

function ReadinessBreakdown({
  performance,
  pillars,
}: {
  performance: PerformanceComponents | null;
  pillars: PillarRanks | null;
}) {
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
            pillars?.mock_interview?.rank != null
              ? `Rank #${pillars.mock_interview.rank} of ${pillars.mock_interview.total} mock-scored students · ${performance.mock_interviews} analysed`
              : performance.mock_interviews
                ? `${performance.mock_interviews} analysed`
                : "No mock interviews analysed yet"
          }
        />
        <PillarBar
          label="Self-Training"
          score={performance.self_training}
          detail={
            pillars?.self_training?.rank != null
              ? `Rank #${pillars.self_training.rank} of ${pillars.self_training.total} trained students`
              : performance.modules.length
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
        Mock interviews and self-training are scored and ranked on their own — neither moves the
        other&apos;s rank. The readiness score above is the weighted blend of the pillars you have
        started.
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

type ItemCardKind = "project" | "intern" | "work" | "activity";

// Which keys of a stored item are worth showing, in order, per kind. Activities
// arrive as plain tag strings, but an object still renders its useful parts.
const ITEM_KEYS: Record<ItemCardKind, [string[], string[], string[]]> = {
  project: [
    ["title", "name", "project"],
    ["tech", "stack", "description"],
    ["description", "link", "url"],
  ],
  intern: [
    ["company", "role", "org", "title"],
    ["role", "position", "duration"],
    ["period", "duration", "description", "summary"],
  ],
  work: [
    ["company", "role", "org", "title"],
    ["role", "position", "duration"],
    ["period", "duration", "description", "summary"],
  ],
  activity: [
    ["title", "name", "activity", "organisation"],
    ["role", "org", "category", "type"],
    ["description", "summary", "duration", "link"],
  ],
};

function ItemCards({ items, type }: { items: unknown[]; type: ItemCardKind }) {
  if (!items.length) return <p className="text-xs text-muted-foreground">Nothing added yet.</p>;
  const [firstKeys, secondKeys, thirdKeys] = ITEM_KEYS[type];
  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const first = itemLabel(item, firstKeys);
        const second = itemLabel(item, secondKeys);
        const third = itemLabel(item, thirdKeys);
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

function CandidateProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [payload, setPayload] = useState<CandidateProfilePayload | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [avatarHintOpen, setAvatarHintOpen] = useState(false);
  const [delPassword, setDelPassword] = useState("");
  const [delError, setDelError] = useState("");
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdOld, setPwdOld] = useState("");
  const [pwdNew, setPwdNew] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdError, setPwdError] = useState("");
  const [pwdSuccess, setPwdSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const current = await me();
        if (cancelled) return;
        if (!current) {
          void navigate({ to: "/candidate/auth", search: { mode: "login" }, replace: true });
          return;
        }
        if (current.role !== "student") {
          void navigate({
            to: "/client/institution-auth",
            search: { mode: "login" },
            replace: true,
          });
          return;
        }
        if (current.profile_complete === false) {
          void navigate({ to: "/candidate/onboarding", replace: true });
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
    // The headline is pulled from LinkedIn on save, so it is shown alongside the
    // rest of the identity rather than buried with the links.
    { icon: Sparkles, label: "Headline", value: p?.bio || "—" },
  ];
  const presenceLinks = [
    { label: "LinkedIn", value: p?.linkedin_url },
    { label: "GitHub", value: p?.github_url },
    { label: "Portfolio", value: p?.portfolio_url },
  ].filter((link) => link.value);

  const ranks = payload.ranks;
  const performance = payload.performance;

  // Mock-interview and self-training are ranked independently, so each gets its
  // own tile with its own cohort — the composite readiness score never stands in
  // for either of them.
  const pillarKpis = PERF_PILLARS.map((pillar) => {
    const standing = pillarStanding(ranks.pillars, pillar.key);
    return {
      label: `${pillar.label} Rank`,
      value: standing?.rank != null ? `#${standing.rank}` : "—",
      hint:
        standing?.rank != null
          ? `of ${standing.total} ${pillar.key === "mock_interview" ? "mock-scored" : "trained"} students`
          : `no ${pillar.label.toLowerCase()} score yet`,
    };
  });

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
    ...pillarKpis,
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
              onClick={() => void navigate({ to: "/candidate/chat", replace: true })}
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
        <div className="space-y-4">
          {/* Hero */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => setAvatarHintOpen(true)}
                title="Profile photo"
                className="group relative cursor-pointer rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <Avatar className="size-16 rounded-2xl">
                  {payload.user.avatar ? (
                    <AvatarImage src={payload.user.avatar} alt={payload.user.name || "Profile"} />
                  ) : null}
                  <AvatarFallback className="rounded-2xl bg-primary font-display text-xl font-bold text-primary-foreground">
                    {initialsOf(payload.user.name, payload.user.email)}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute inset-0 grid place-items-center rounded-2xl bg-foreground/50 text-background opacity-0 transition-opacity group-hover:opacity-100">
                  <Pencil className="size-5" />
                </span>
              </button>
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
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="rounded-xl border border-border bg-card px-4 py-3.5">
                <p className={oc("", "label")}>{kpi.label}</p>
                <p className="mt-1.5 text-2xl font-bold">{kpi.value}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{kpi.hint}</p>
              </div>
            ))}
          </div>

          <ReadinessBreakdown performance={performance} pillars={ranks.pillars} />

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

          <Section icon={<Sparkles className="size-4" />} title="Extracurricular activities">
            <ItemCards items={p?.extracurricular_activities ?? []} type="activity" />
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
      </main>

      <AlertDialog
        open={avatarHintOpen}
        onOpenChange={(open) => {
          setAvatarHintOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Linkedin className="size-4 text-[#0A66C2]" /> Keep your profile photo consistent
            </AlertDialogTitle>
            <AlertDialogDescription>
              Add your LinkedIn profile with a profile picture and headline over there. We use the
              same photo and headline to maintain consistency for students building their LinkedIn
              profiles. You can edit the headline here afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction className="bg-primary text-primary-foreground hover:bg-primary/90">
              Got it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
