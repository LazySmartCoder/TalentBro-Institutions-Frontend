import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowRight,
  Briefcase,
  Building2,
  Check,
  ChevronLeft,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LogoutConfirmDialog } from "@/components/logout-confirm";
import { clientOnboarding, me, type AuthUser, type ClientProfile } from "@/lib/api";
import { cn } from "@/lib/utils";
import { GateLoading } from "@/components/load-state";

const title = "Complete your profile | TalentBro Institutions";
const description =
  "Tell us about your institution and role to activate your TalentBro Institutions dashboard.";

export const Route = createFileRoute("/client-onboarding")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ClientOnboardingPage,
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

type IconId = typeof Building2 | typeof Users | typeof Mail | typeof MapPin | typeof Briefcase;

const STEPS = [
  {
    id: "institution",
    title: "Tell us about your institution",
    subtitle:
      "Your institution's name, type and size help students recognise it during their own onboarding.",
    icon: Building2 as IconId,
  },
  {
    id: "reach",
    title: "How can students & recruiters reach you?",
    subtitle:
      "Your official domain and placement cell's email are used for verifications and drive coordination.",
    icon: Mail as IconId,
  },
  {
    id: "address",
    title: "Where is your institution located?",
    subtitle: "So students can verify their campus and placement offices can find you easily.",
    icon: MapPin as IconId,
  },
  {
    id: "role",
    title: "Tell us about your role",
    subtitle: "Placement cells appreciate knowing who's driving placements at your institution.",
    icon: Briefcase as IconId,
  },
  {
    id: "review",
    title: "Everything look right?",
    subtitle:
      "Only the logo is optional — every other detail is required. You'll get Master access by default.",
    icon: ShieldCheck as IconId,
  },
] as const;

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

const EMPTY_DRAFT: Draft = {
  institution_name: "",
  institution_type: "",
  website: "",
  email_domain: "",
  address: "",
  city: "",
  state: "",
  pin_code: "",
  logo: "",
  placement_department_name: "",
  placement_office_email: "",
  approximate_student_strength: "",
  mobile_number: "",
  designation: "",
  employee_staff_id: "",
};

function draftFromProfile(p: ClientProfile | null | undefined): Draft {
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
  "h-12 w-full rounded-xl border border-input bg-card px-4 text-sm outline-none transition-shadow placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-ring/25";

const labelClass =
  "mb-1.5 block font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase";

function Field({
  id,
  label,
  required,
  hint,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ClientOnboardingPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Draft>(EMPTY_DRAFT);
  const [stepError, setStepError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const current = await me();
        if (cancelled) return;
        if (!current) {
          void navigate({ to: "/institution-auth", replace: true });
          return;
        }
        if (current.role !== "institution_staff") {
          void navigate({ to: "/dashboard", replace: true });
          return;
        }
        if (current.profile_complete === true) {
          void navigate({ to: "/dashboard", replace: true });
          return;
        }
        setUser(current);
        setData(draftFromProfile(current.profile as ClientProfile | undefined));
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

  const isLast = step === STEPS.length - 1;
  const progress = Math.round((step / (STEPS.length - 1)) * 100);
  const currentStep = STEPS[step] ?? STEPS[0];
  const CurrentIcon = currentStep.icon;

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setData((d) => ({ ...d, [key]: value }));
    setStepError("");
  }

  function validateCurrent(): string {
    switch (step) {
      case 0:
        if (!data.institution_name.trim()) {
          return "Please enter your institution name.";
        }
        if (!data.institution_type) {
          return "Please select your institution type.";
        }
        if (!data.website.trim()) {
          return "Please enter your institution website.";
        }
        if (
          !data.approximate_student_strength.trim() ||
          Number(data.approximate_student_strength) < 1
        ) {
          return "Please enter the approximate student strength.";
        }
        return "";
      case 1:
        if (!data.email_domain.trim()) {
          return "Please enter your official email domain (e.g. institution.edu.in).";
        }
        if (!data.placement_office_email.trim()) {
          return "Please enter the placement office email.";
        }
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.placement_office_email.trim())) {
          return "Placement office email doesn't look valid.";
        }
        if (!data.placement_department_name.trim()) {
          return "Please enter the placement department name.";
        }
        return "";
      case 2:
        if (!data.address.trim()) return "Please enter your institution's address.";
        if (!data.city.trim()) return "Please enter your city.";
        if (!data.state.trim()) return "Please enter your state.";
        if (!/^[1-9][0-9]{5}$/.test(data.pin_code)) {
          return "PIN code should be 6 digits and can't start with 0 (e.g. 411001).";
        }
        return "";
      case 3: {
        if (!data.designation.trim()) return "Please enter your designation.";
        if (!data.employee_staff_id.trim()) return "Please enter your employee / staff ID.";
        if (!data.mobile_number.trim()) return "Please enter your mobile number.";
        const digits = data.mobile_number.replace(/\D/g, "");
        if (digits.length < 10 || digits.length > 15) {
          return "Mobile number should be 10–15 digits including the country code (e.g. +91 9876543210).";
        }
        return "";
      }
      default:
        return "";
    }
  }

  function handleNext() {
    if (saving || saved) return;
    const problem = validateCurrent();
    if (problem) {
      setStepError(problem);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setStepError("");
    if (isLast) {
      void submit();
    } else {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handleBack() {
    if (saving) return;
    setStepError("");
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    setSaving(true);
    setStepError("");
    const payload: Record<string, unknown> = {
      ...data,
      approximate_student_strength: data.approximate_student_strength.trim()
        ? Number(data.approximate_student_strength)
        : null,
    };
    try {
      await clientOnboarding(payload);
      setSaved(true);
      setTimeout(() => {
        void navigate({ to: "/dashboard", replace: true });
      }, 700);
    } catch (err) {
      setSaving(false);
      setStepError(
        err instanceof Error ? err.message : "Failed to save your profile. Please try again.",
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const summary: Array<[string, string]> = [
    ["Institution", data.institution_name.trim()],
    ["Type", data.institution_type],
    ["Website", data.website.trim()],
    ["Student strength", data.approximate_student_strength.trim() || "—"],
    ["Email domain", data.email_domain.trim()],
    ["Placement office email", data.placement_office_email.trim()],
    ["Placement department", data.placement_department_name.trim()],
    ["Logo", data.logo.trim() || "—"],
    [
      "Address",
      [data.address.trim(), data.city.trim(), data.state.trim(), data.pin_code.trim()]
        .filter(Boolean)
        .join(", "),
    ],
    ["Designation", data.designation.trim()],
    ["Employee / staff ID", data.employee_staff_id.trim()],
    ["Mobile", data.mobile_number.trim()],
  ];

  const stepContent = (() => {
    switch (step) {
      case 0:
        return (
          <>
            <Field id="institution_name" label="Institution name" required>
              <input
                id="institution_name"
                className={inputClass}
                placeholder="e.g. Sardar Vallabhbhai Institute of Technology"
                value={data.institution_name}
                onChange={(e) => set("institution_name", e.target.value)}
                autoFocus
              />
            </Field>
            <Field id="institution_type" label="Institution type" required>
              <Select
                value={data.institution_type}
                onValueChange={(next) => set("institution_type", next)}
              >
                <SelectTrigger className="h-12 w-full rounded-xl bg-card px-4">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {INSTITUTION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id="website" label="Website" required>
              <input
                id="website"
                type="url"
                className={inputClass}
                placeholder="https://www.institution.edu.in"
                value={data.website}
                onChange={(e) => set("website", e.target.value)}
              />
            </Field>
            <Field id="approximate_student_strength" label="Approximate student strength" required>
              <input
                id="approximate_student_strength"
                type="number"
                inputMode="numeric"
                min={1}
                className={inputClass}
                placeholder="e.g. 5000"
                value={data.approximate_student_strength}
                onChange={(e) => set("approximate_student_strength", e.target.value)}
              />
            </Field>
          </>
        );
      case 1:
        return (
          <>
            <Field
              id="email_domain"
              label="Official email domain"
              required
              hint="The part after @ in student emails, e.g. institution.edu.in"
            >
              <input
                id="email_domain"
                className={inputClass}
                placeholder="institution.edu.in"
                value={data.email_domain}
                onChange={(e) => set("email_domain", e.target.value)}
                autoFocus
              />
            </Field>
            <Field id="placement_office_email" label="Placement office email" required>
              <input
                id="placement_office_email"
                type="email"
                className={inputClass}
                placeholder="placement@institution.edu.in"
                value={data.placement_office_email}
                onChange={(e) => set("placement_office_email", e.target.value)}
              />
            </Field>
            <Field id="placement_department_name" label="Placement department name" required>
              <input
                id="placement_department_name"
                className={inputClass}
                placeholder="e.g. Career Development & Placement Cell"
                value={data.placement_department_name}
                onChange={(e) => set("placement_department_name", e.target.value)}
              />
            </Field>
            <Field
              id="logo"
              label="Logo URL"
              hint="The only optional field — everything else is required."
            >
              <input
                id="logo"
                type="url"
                className={inputClass}
                placeholder="https://www.institution.edu.in/logo.png"
                value={data.logo}
                onChange={(e) => set("logo", e.target.value)}
              />
            </Field>
          </>
        );
      case 2:
        return (
          <>
            <Field id="address" label="Address" required>
              <textarea
                id="address"
                rows={2}
                className={cn(inputClass, "h-auto resize-none py-3")}
                placeholder="Street, area, landmark…"
                value={data.address}
                onChange={(e) => set("address", e.target.value)}
                autoFocus
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field id="city" label="City" required>
                <input
                  id="city"
                  className={inputClass}
                  placeholder="e.g. Pune"
                  value={data.city}
                  onChange={(e) => set("city", e.target.value)}
                />
              </Field>
              <Field id="state" label="State" required>
                <input
                  id="state"
                  className={inputClass}
                  placeholder="e.g. Maharashtra"
                  value={data.state}
                  onChange={(e) => set("state", e.target.value)}
                />
              </Field>
            </div>
            <Field id="pin_code" label="PIN code" required>
              <input
                id="pin_code"
                inputMode="numeric"
                maxLength={6}
                className={inputClass}
                placeholder="e.g. 411001"
                value={data.pin_code}
                onChange={(e) => set("pin_code", e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </Field>
          </>
        );
      case 3:
        return (
          <>
            <Field id="designation" label="Designation" required>
              <input
                id="designation"
                className={inputClass}
                placeholder="e.g. Training & Placement Officer"
                value={data.designation}
                onChange={(e) => set("designation", e.target.value)}
                autoFocus
              />
            </Field>
            <Field id="employee_staff_id" label="Employee / staff ID" required>
              <input
                id="employee_staff_id"
                className={inputClass}
                placeholder="e.g. EMP-2024-018"
                value={data.employee_staff_id}
                onChange={(e) => set("employee_staff_id", e.target.value)}
              />
            </Field>
            <Field
              id="mobile_number"
              label="Mobile number"
              required
              hint="Used for placement-cell coordination and verification."
            >
              <input
                id="mobile_number"
                type="tel"
                inputMode="tel"
                className={inputClass}
                placeholder="+91 9876543210"
                value={data.mobile_number}
                onChange={(e) => set("mobile_number", e.target.value)}
              />
            </Field>
          </>
        );
      default:
        return (
          <dl className="space-y-0 overflow-hidden rounded-xl border border-border bg-background/50">
            {summary.map(([label, value]) => (
              <div
                key={label}
                className="grid grid-cols-[minmax(0,140px)_1fr] gap-4 border-b border-border px-4 py-3 last:border-b-0"
              >
                <dt className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                  {label}
                </dt>
                <dd className="text-sm text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
        );
    }
  })();

  if (status === "loading") {
    return <GateLoading />;
  }

  if (status === "error" || !user) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background px-4 text-foreground">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {errorMessage ?? "We couldn't load your account. Refresh to try again."}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 inline-flex h-11 cursor-pointer items-center justify-center rounded-xl bg-foreground px-6 text-[11px] font-medium tracking-[0.2em] text-background uppercase transition-opacity hover:opacity-85"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="tg-grain relative min-h-svh bg-background text-foreground">
      {/* Progress */}
      <div className="mx-auto w-full max-w-xl px-4 pt-8 sm:px-6">
        <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
          <span>Institution setup</span>
          <div className="flex items-center gap-3">
            <span>
              Step {step + 1} of {STEPS.length}
            </span>
            <ThemeToggle className="size-9 px-2.5" />
            <LogoutConfirmDialog>
              <button
                type="button"
                aria-label="Logout"
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-[10px] font-medium tracking-[0.2em] text-muted-foreground uppercase transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                <LogOut className="size-3.5" />
                Logout
              </button>
            </LogoutConfirmDialog>
          </div>
        </div>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-foreground transition-all duration-500 ease-out"
            style={{ width: `${saved ? 100 : progress}%` }}
          />
        </div>
      </div>

      {/* Step dots */}
      <div className="mx-auto flex w-full max-w-xl items-center justify-center gap-2 px-4 pt-6 sm:px-6">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            aria-label={`Step ${i + 1}: ${s.id}`}
            onClick={() => {
              if (i < step && !saving) {
                setStep(i);
                setStepError("");
                window.scrollTo({ top: 0 });
              }
            }}
            className={cn(
              "h-1.5 rounded-full transition-all duration-400",
              i < step || saved
                ? "w-6 bg-foreground"
                : i === step
                  ? "w-8 bg-foreground"
                  : "w-1.5 bg-muted-foreground/30",
              i < step ? "cursor-pointer" : "cursor-default",
            )}
          />
        ))}
      </div>

      {/* Card */}
      <main className="mx-auto w-full max-w-xl px-4 py-10 pb-16 sm:px-6">
        <div key={step} className="onboarding-step">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-lift sm:p-10">
            <span className="grid size-12 place-items-center rounded-2xl bg-foreground/5 text-foreground">
              <CurrentIcon className="size-5" />
            </span>

            <h1 className="mt-6 font-[family-name:var(--font-display)] text-3xl leading-tight tracking-tight sm:text-4xl">
              {currentStep.title}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {currentStep.subtitle}
            </p>

            {saved ? (
              <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-6 py-10 text-center">
                <span className="grid size-14 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <Check className="size-7" />
                </span>
                <div>
                  <p className="font-[family-name:var(--font-display)] text-2xl tracking-tight">
                    Institution profile complete!
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Taking you to your placement dashboard…
                  </p>
                </div>
              </div>
            ) : (
              <>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleNext();
                  }}
                  className="mt-8 space-y-5"
                >
                  {stepContent}

                  {stepError && (
                    <div
                      role="alert"
                      className="rounded-md border border-red-500/40 bg-red-500/5 px-4 py-3 text-xs leading-relaxed text-red-500"
                    >
                      {stepError}
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-2">
                    {step > 0 && (
                      <button
                        type="button"
                        onClick={handleBack}
                        disabled={saving}
                        className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 text-[11px] font-medium tracking-[0.2em] text-muted-foreground uppercase transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <ChevronLeft className="size-4" /> Back
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-foreground px-7 text-[11px] font-medium tracking-[0.2em] text-background uppercase transition-transform duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="size-4 animate-spin" /> Saving…
                        </>
                      ) : isLast ? (
                        <>
                          <Check className="size-4" /> Complete profile
                        </>
                      ) : (
                        <>
                          Continue <ArrowRight className="size-4" />
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Your access level will be set to <span className="font-semibold">Master</span>{" "}
                      by default, so you can create drives and manage your institution's data from
                      day one.
                    </p>
                  </div>
                </form>
                <p className="mt-6 text-center font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                  Required fields are marked with *
                </p>
              </>
            )}
          </div>
        </div>
      </main>

      <style>{`
        .onboarding-step {
          animation: ob-right 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes ob-right {
          from {
            opacity: 0;
            transform: translateX(28px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .onboarding-step {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
