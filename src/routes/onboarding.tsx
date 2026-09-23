import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import type * as Tesseract from "tesseract.js";
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  Check,
  ChevronLeft,
  GraduationCap,
  ImagePlus,
  Link2,
  Loader2,
  LogOut,
  Phone,
  ShieldCheck,
  Sparkles,
  Target,
  User,
  X,
} from "lucide-react";
import {
  completeOnboarding,
  getProfile,
  me,
  searchInstitutions,
  verifyIdCard,
  type AuthUser,
  type CandidateProfile,
  type IdVerificationResult,
} from "@/lib/api";
import { COURSES_OFFERED, GENDERS } from "@/lib/data";
import { cn } from "@/lib/utils";
import { GateError, GateLoading } from "@/components/load-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LogoutConfirmDialog } from "@/components/logout-confirm";

const title = "Onboarding | TalentBro";
const description =
  "Set up your placement profile to unlock AI-powered placement prep with TalentBro.";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
    ],
  }),
  component: OnboardingPage,
});

type Theme = "light" | "dark";
const THEME_STORAGE = "tb.theme";

// The name and registration number the student typed during onboarding (plus a
// college when one is on file) are cached here so the ID-card verification step
// can match them (via Gemini) against what the OCR text on the uploaded card
// shows — even after a refresh.
const ID_VERIFICATION_STORAGE = "tb.id.verification";

type IdVerificationCache = {
  name: string;
  registration_number: string;
  college: string;
};

function saveIdVerificationCache(entry: IdVerificationCache): void {
  try {
    localStorage.setItem(ID_VERIFICATION_STORAGE, JSON.stringify(entry));
  } catch {
    // storage unavailable — verification falls back to the live draft values
  }
}

function loadIdVerificationCache(): IdVerificationCache | null {
  try {
    const raw = localStorage.getItem(ID_VERIFICATION_STORAGE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<IdVerificationCache>;
    if (typeof parsed !== "object" || parsed === null) return null;
    return {
      name: typeof parsed.name === "string" ? parsed.name : "",
      registration_number:
        typeof parsed.registration_number === "string" ? parsed.registration_number : "",
      college: typeof parsed.college === "string" ? parsed.college : "",
    };
  } catch {
    return null;
  }
}

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE);
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

type Draft = {
  first_name: string;
  middle_name: string;
  last_name: string;
  college: string;
  registration_number: string;
  department: string;
  program: string;
  start_year: string;
  end_year: string;
  cgpa: string;
  country_code: string;
  phone: string;
  date_of_birth: string;
  gender: string;
  linkedin_url: string;
  github_url: string;
  portfolio_url: string;
  skills: string[];
  certifications: string[];
  projects: string[];
  internships: string[];
  preferred_roles: string[];
  preferred_locations: string[];
  expected_ctc: string;
};

const EMPTY_DRAFT: Draft = {
  first_name: "",
  middle_name: "",
  last_name: "",
  college: "",
  registration_number: "",
  department: "",
  program: "",
  start_year: "",
  end_year: "",
  cgpa: "",
  country_code: "+91",
  phone: "",
  date_of_birth: "",
  gender: "",
  linkedin_url: "",
  github_url: "",
  portfolio_url: "",
  skills: [],
  certifications: [],
  projects: [],
  internships: [],
  preferred_roles: [],
  preferred_locations: [],
  expected_ctc: "",
};

const PHONE_COUNTRIES = [
  { code: "+91", digits: "91", short: "IN", name: "India" },
  { code: "+1", digits: "1", short: "US", name: "United States" },
  { code: "+44", digits: "44", short: "GB", name: "United Kingdom" },
  { code: "+49", digits: "49", short: "DE", name: "Germany" },
  { code: "+61", digits: "61", short: "AU", name: "Australia" },
] as const;

const DEFAULT_COUNTRY_CODE = "+91";

function splitPhone(value: string, fallbackCode: string): { code: string; number: string } {
  const compact = value.replace(/\s+/g, "");
  for (const c of PHONE_COUNTRIES) {
    if (compact.startsWith("+" + c.digits)) {
      return { code: c.code, number: compact.slice(c.digits.length + 1).replace(/\D/g, "") };
    }
  }
  return { code: fallbackCode, number: compact.replace(/\D/g, "") };
}

const toStrList = (items: unknown[] | undefined): string[] =>
  (items ?? []).map((i) => String(i)).filter(Boolean);

const joinName = (first: string, middle: string, last: string): string =>
  [first, middle, last]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");

function draftFromProfile(p: CandidateProfile | null, accountName?: string): Draft {
  const fallback = EMPTY_DRAFT;
  if (!p) return fallback;
  let first = (p.first_name || "").trim();
  let middle = (p.middle_name || "").trim();
  let last = (p.last_name || "").trim();
  if (!first && !middle && !last) {
    const nameParts = (p.full_name || accountName || "").trim().split(/\s+/);
    first = nameParts[0] ?? "";
    middle = nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : "";
    last = nameParts.length > 1 ? (nameParts[nameParts.length - 1] ?? "") : "";
  }
  return {
    ...fallback,
    first_name: first,
    middle_name: middle,
    last_name: last,
    college: p.college || "",
    registration_number: "",
    department: p.department || "",
    program: p.program || "",
    start_year: p.start_year != null ? String(p.start_year) : "",
    end_year: p.end_year != null ? String(p.end_year) : "",
    cgpa: p.cgpa != null ? String(p.cgpa) : "",
    ...splitPhone(p.phone || "", DEFAULT_COUNTRY_CODE),
    date_of_birth: p.date_of_birth ?? "",
    gender: p.gender || "",
    linkedin_url: p.linkedin_url || "",
    github_url: p.github_url || "",
    portfolio_url: p.portfolio_url || "",
    skills: toStrList(p.skills),
    certifications: toStrList(p.certifications),
    projects: toStrList(p.projects),
    internships: toStrList(p.internships),
    preferred_roles: toStrList(p.preferred_roles),
    preferred_locations: toStrList(p.preferred_locations),
    expected_ctc: p.expected_ctc != null ? String(p.expected_ctc) : "",
  };
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

const STEPS = [
  {
    id: "name",
    title: "First things first — what should we call you?",
    subtitle: (
      <>
        Your name helps recruiters and the placement cell recognise you instantly. It must match the
        name on your ID card. <strong>Name cannot be changed afterwards.</strong>
      </>
    ),
    icon: User,
  },
  {
    id: "education",
    title: "What are you studying?",
    subtitle: "Your department and program determine which drives you're eligible for.",
    icon: GraduationCap,
  },
  {
    id: "academics",
    title: "A bit about your academics",
    subtitle:
      "Your batch years and CGPA open the door to the best companies on campus. CGPA must be the average up to the results of your last semester.",
    icon: BookOpen,
  },
  {
    id: "personal",
    title: "How can we reach you?",
    subtitle: "Your phone and birth date are used for drive registrations and eligibility checks.",
    icon: Phone,
  },
  {
    id: "presence",
    title: "Show off your online presence",
    subtitle: "LinkedIn is required — GitHub and a portfolio make your profile shine.",
    icon: Link2,
  },
  {
    id: "skills",
    title: "What are you great at?",
    subtitle: "Add skills and certifications as tags — press Enter or comma to add each one.",
    icon: Sparkles,
  },
  {
    id: "experience",
    title: "Projects & internships",
    subtitle: "The work you've done catches every recruiter's eye. Add quick one-liners for now.",
    icon: Briefcase,
  },
  {
    id: "preferences",
    title: "Your dream job",
    subtitle: "Tell us the roles and cities you're targeting. You're almost there!",
    icon: Target,
  },
] as const;

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

const inputClass =
  "h-12 w-full rounded-xl border border-input bg-card px-4 text-sm outline-none transition-shadow placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-ring/25";

const labelClass =
  "mb-1.5 block font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase";

function Field({
  id,
  label,
  required,
  children,
  hint,
}: {
  id: string;
  label: string;
  required?: boolean;
  children: ReactNode;
  hint?: ReactNode;
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

function TagInput({
  id,
  label,
  placeholder,
  hint,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  placeholder?: string;
  hint?: string;
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function commit() {
    const parts = text
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length) {
      onChange([
        ...value,
        ...parts.filter((p) => !value.some((v) => v.toLowerCase() === p.toLowerCase())),
      ]);
    }
    setText("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && !text && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  function removeAt(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="rounded-xl border border-input bg-card px-3 py-2.5 focus-within:ring-2 focus-within:ring-ring/25">
        <div className="flex flex-wrap items-center gap-1.5">
          {value.map((item, idx) => (
            <span
              key={`${item}-${idx}`}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 pl-2.5 pr-1 py-1 text-[11px] font-medium"
            >
              {item}
              <button
                type="button"
                aria-label={`Remove ${item}`}
                onClick={() => removeAt(idx)}
                disabled={disabled}
                className="grid size-4 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground disabled:cursor-not-allowed"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            id={id}
            value={text}
            disabled={disabled}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => commit()}
            placeholder={value.length === 0 ? placeholder : "Add another…"}
            className="min-w-32 flex-1 border-0 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-muted-foreground/50 disabled:cursor-not-allowed"
          />
        </div>
      </div>
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function GenderSelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled ?? false}>
      <SelectTrigger className="h-12 w-full rounded-xl bg-card px-4">
        <SelectValue placeholder="Select your gender" />
      </SelectTrigger>
      <SelectContent>
        {GENDERS.map((g) => (
          <SelectItem key={g.value} value={g.value}>
            {g.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ---------------------------------------------------------------------------
// ID card verification (OCR in the browser via Tesseract.js, then name and
// registration number are extracted+matched server-side with the Gemini 2.5
// Flash Lite model against the values cached from the earlier steps)
// ---------------------------------------------------------------------------

type IdOcrSide = {
  preview: string;
  status: "idle" | "reading" | "done" | "error";
  progress: number;
  text: string;
};

const IDLE_OCR_SIDE: IdOcrSide = { preview: "", status: "idle", progress: 0, text: "" };

type IdCheck = {
  label: string;
  passed: boolean;
  detail: string;
};

type IdCheckState = {
  ready: boolean;
  allPass: boolean;
  checks: IdCheck[];
};

const EMPTY_ID_CHECKS: IdCheckState = { ready: false, allPass: false, checks: [] };

function mapIdVerificationResult(result: IdVerificationResult): IdCheckState {
  const checks: IdCheck[] = [
    {
      label: "Name",
      passed: result.checks.name.matched,
      detail: result.checks.name.detail || "We couldn't match your name on the ID card.",
    },
    {
      label: "Registration Number",
      passed: result.checks.registration_number.matched,
      detail:
        result.checks.registration_number.detail ||
        "We couldn't match your registration number on the ID card.",
    },
  ];
  // The college is only checked when one is on file; without it we verify the
  // name and registration number alone.
  if (result.checks.college) {
    checks.push({
      label: "College",
      passed: result.checks.college.matched,
      detail: result.checks.college.detail || "We couldn't match your college on the ID card.",
    });
  }
  return {
    ready: true,
    allPass: result.all_matched === true && checks.every((c) => c.passed),
    checks,
  };
}

function IdUploadCard({
  title,
  hint,
  state,
  disabled,
  onFile,
}: {
  title: string;
  hint: string;
  state: IdOcrSide;
  disabled?: boolean;
  onFile: (file: File) => void;
}) {
  const inputId = `id-${title.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-sm font-medium">{title}</p>
      <p className="mb-3 text-xs text-muted-foreground">{hint}</p>
      <label
        htmlFor={inputId}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-8 text-center text-xs transition-colors hover:bg-muted/60",
          state.status === "error" && "border-red-500/50 bg-red-500/5",
        )}
      >
        {state.preview ? (
          <img src={state.preview} alt={title} className="max-h-44 rounded-lg object-contain" />
        ) : (
          <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
            <ImagePlus className="size-4" />
          </span>
        )}
        <input
          id={inputId}
          type="file"
          accept="image/*"
          disabled={(disabled ?? false) || state.status === "reading"}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = "";
          }}
          className="sr-only"
        />
        <span className="font-medium text-foreground">
          {state.status === "reading"
            ? "Reading card…"
            : state.preview
              ? "Tap to replace image"
              : "Choose an image"}
        </span>
        {state.status === "reading" && (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            {state.progress > 0
              ? `Reading… ${Math.round(state.progress * 100)}%`
              : "First read downloads the OCR engine…"}
          </span>
        )}
        {state.status === "error" && (
          <span className="text-red-500">
            Couldn't read this image. Try a clearer, well-lit photo.
          </span>
        )}
      </label>
    </div>
  );
}

function IdVerificationStep({
  data,
  checks,
  disabled,
  onChecks,
}: {
  data: Draft;
  checks: IdCheckState;
  disabled?: boolean;
  onChecks: (next: IdCheckState) => void;
}) {
  const [front, setFront] = useState<IdOcrSide>(IDLE_OCR_SIDE);
  const [back, setBack] = useState<IdOcrSide>(IDLE_OCR_SIDE);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const workerRef = useRef<Promise<Tesseract.Worker> | null>(null);
  const readingSideRef = useRef<"front" | "back" | null>(null);

  useEffect(() => {
    return () => {
      void workerRef.current?.then((w) => w.terminate()).catch(() => {});
    };
  }, []);

  async function getWorker(): Promise<Tesseract.Worker> {
    if (!workerRef.current) {
      const mod = await import("tesseract.js");
      workerRef.current = mod
        .createWorker("eng", mod.OEM.LSTM_ONLY, {
          logger: (m: Tesseract.LoggerMessage) => {
            const side = readingSideRef.current;
            const progress = m.progress;
            if (m.status === "recognizing text" && progress >= 0 && progress <= 1) {
              if (side === "front") setFront((s) => ({ ...s, progress }));
              else if (side === "back") setBack((s) => ({ ...s, progress }));
            }
          },
        })
        .then((worker) => {
          void worker.setParameters({ tessedit_pageseg_mode: mod.PSM.SPARSE_TEXT }).catch(() => {});
          return worker;
        });
    }
    return workerRef.current;
  }

  async function runOcr(side: "front" | "back", file: File) {
    if (disabled) return;
    readingSideRef.current = side;
    const setter = side === "front" ? setFront : setBack;
    const preview = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.readAsDataURL(file);
    });
    setter((s) => ({ ...s, preview, status: "reading", progress: 0, text: "" }));
    try {
      const worker = await getWorker();
      const result = await worker.recognize(preview, { rotateAuto: true }, { text: true });
      const text = (result.data?.text ?? "").trim();
      setter((s) => ({ ...s, status: "done", progress: 1, text }));
    } catch {
      setter((s) => ({ ...s, status: "error", progress: 0, text: "" }));
    } finally {
      readingSideRef.current = null;
    }
  }

  useEffect(() => {
    const combined = `${front.text}\n${back.text}`.trim();
    if (!(front.status === "done" && back.status === "done" && combined.length > 0)) {
      setVerifyError("");
      onChecks(EMPTY_ID_CHECKS);
      return;
    }
    // Prefer the values cached from the earlier steps; fall back to the live
    // draft so verification keeps working if storage is unavailable.
    const cached = loadIdVerificationCache();
    const entered = {
      name:
        (cached?.name || "").trim() || joinName(data.first_name, data.middle_name, data.last_name),
      registration_number:
        (cached?.registration_number || "").trim() || data.registration_number.trim(),
      college: (cached?.college || "").trim() || data.college.trim(),
    };
    if (!entered.name || !entered.registration_number) {
      onChecks({ ready: true, allPass: false, checks: [] });
      return;
    }
    let active = true;
    setVerifying(true);
    setVerifyError("");
    verifyIdCard({
      ocr_text: combined,
      name: entered.name,
      registration_number: entered.registration_number,
      college: entered.college,
    })
      .then((result) => {
        if (!active) return;
        onChecks(mapIdVerificationResult(result));
      })
      .catch((err: unknown) => {
        if (!active) return;
        setVerifyError(
          err instanceof Error ? err.message : "Verification failed. Please try again.",
        );
        onChecks({ ready: true, allPass: false, checks: [] });
      })
      .finally(() => {
        if (active) setVerifying(false);
      });
    return () => {
      active = false;
    };
  }, [
    front.status,
    front.text,
    back.status,
    back.text,
    data.first_name,
    data.middle_name,
    data.last_name,
    data.registration_number,
    data.college,
    onChecks,
  ]);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <IdUploadCard
          title="Front of ID"
          hint="The side with your photo, name and registration number."
          state={front}
          disabled={disabled ?? false}
          onFile={(f) => void runOcr("front", f)}
        />
        <IdUploadCard
          title="Back of ID"
          hint="Usually holds additional details — both sides help the check."
          state={back}
          disabled={disabled ?? false}
          onFile={(f) => void runOcr("back", f)}
        />
      </div>

      {verifying ? (
        <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-3.5 text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Verifying your name and registration number with AI…
        </div>
      ) : verifyError ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-red-500/40 bg-red-500/5 px-4 py-3 text-xs leading-relaxed text-red-600 dark:text-red-400"
        >
          <X className="mt-0.5 size-4 shrink-0" />
          <span>{verifyError}</span>
        </div>
      ) : checks.ready ? (
        <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
          <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            Verification
          </p>
          {checks.checks.map((c) => (
            <div
              key={c.label}
              className={cn(
                "flex items-start gap-2.5 rounded-xl border px-3 py-2.5",
                c.passed
                  ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
                  : "border-red-500/40 bg-red-500/5 text-red-600 dark:text-red-400",
              )}
            >
              <span className="mt-0.5 shrink-0">
                {c.passed ? <Check className="size-4" /> : <X className="size-4" />}
              </span>
              <div>
                <p className="text-sm font-medium">{c.label}</p>
                <p className="mt-0.5 text-xs opacity-90">{c.detail}</p>
              </div>
            </div>
          ))}
          {checks.allPass ? (
            <p className="pt-1 text-sm font-medium text-emerald-700 dark:text-emerald-400">
              All details match your ID card. You're all set!
            </p>
          ) : (
            <p className="pt-1 text-xs font-medium text-red-600 dark:text-red-400">
              User verification failed. Fix the highlighted fields above or re-upload a clearer
              photo of your ID card.
            </p>
          )}
        </div>
      ) : (
        <p className="rounded-xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
          Upload both the front and back of your college ID card. We read it on this device, then
          Gemini extracts your name and registration number from the OCR text and matches them
          against what you entered.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function OnboardingPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [theme] = useState<Theme>(getInitialTheme);
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Draft>(EMPTY_DRAFT);
  const [stepError, setStepError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [idChecks, setIdChecks] = useState<IdCheckState>(EMPTY_ID_CHECKS);
  const [collegeDepartments, setCollegeDepartments] = useState<string[]>([]);
  const handleIdChecks = useCallback((next: IdCheckState) => setIdChecks(next), []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
    try {
      localStorage.setItem(THEME_STORAGE, theme);
    } catch {
      // storage unavailable
    }
  }, [theme]);

  // Keep the entered name and registration number (and any college on file)
  // cached in the browser so the ID-card verification step can match them
  // against the Gemini-extracted OCR data.
  useEffect(() => {
    const name = joinName(data.first_name, data.middle_name, data.last_name);
    if (name || data.registration_number.trim() || data.college.trim()) {
      saveIdVerificationCache({
        name,
        registration_number: data.registration_number.trim(),
        college: data.college.trim(),
      });
    }
  }, [data.first_name, data.middle_name, data.last_name, data.registration_number, data.college]);

  // The candidate's college is set on their profile (usually by the institution
  // that enrolled them). Load that institution's departments so the Department
  // field can be a dropdown of the courses the college actually offers.
  useEffect(() => {
    const college = data.college.trim();
    if (!college) {
      setCollegeDepartments([]);
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      searchInstitutions(college)
        .then((res) => {
          if (!active) return;
          const match = res.find((i) => i.name === college) ?? res[0];
          setCollegeDepartments(match?.departments ?? []);
        })
        .catch(() => {
          if (active) setCollegeDepartments([]);
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [data.college]);

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
        if (current.profile_complete !== false) {
          void navigate({ to: "/chat", replace: true });
          return;
        }
        setUser(current);
        let prefilled = EMPTY_DRAFT;
        try {
          const payload = await getProfile();
          if (cancelled) return;
          prefilled = draftFromProfile(payload.profile, current.name);
        } catch {
          // keep the empty draft when the profile fetch fails
        }
        // Restore the cached name / registration number (and college, if any),
        // so a refresh keeps them available for ID-card verification.
        const cached = loadIdVerificationCache();
        if (cached) {
          const nameParts = cached.name.trim().split(/\s+/);
          prefilled = {
            ...prefilled,
            first_name: prefilled.first_name || nameParts[0] || "",
            middle_name:
              prefilled.middle_name ||
              (nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : ""),
            last_name:
              prefilled.last_name ||
              (nameParts.length > 1 ? (nameParts[nameParts.length - 1] ?? "") : ""),
            registration_number: prefilled.registration_number || cached.registration_number,
            college: prefilled.college || cached.college,
          };
        }
        setData(prefilled);
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
        if (!data.first_name.trim() || !data.last_name.trim()) {
          return "Please enter both your first and last name.";
        }
        return "";
      case 1:
        if (!data.registration_number.trim()) {
          return "Please enter your registration number (as printed on your ID card).";
        }
        if (!data.department.trim()) return "Please enter your department.";
        if (!data.program) return "Please select your program.";
        return "";
      case 2:
        if (!data.start_year.trim() || !data.end_year.trim() || !data.cgpa.trim()) {
          return "Please fill in your start year, end year and CGPA.";
        }
        if (Number(data.start_year) < 2000 || Number(data.start_year) > 2036) {
          return "Start year should be between 2000 and 2036.";
        }
        if (Number(data.end_year) < Number(data.start_year) || Number(data.end_year) > 2038) {
          return "End year should be after your start year.";
        }
        if (Number(data.cgpa) < 0 || Number(data.cgpa) > 10) {
          return "CGPA should be between 0 and 10.";
        }
        return "";
      case 3: {
        if (!data.phone.trim()) return "Please enter your mobile number.";
        const digits = `${data.country_code}${data.phone.replace(/\D/g, "")}`.replace(/\D/g, "");
        if (digits.length < 10 || digits.length > 15) {
          return "Mobile number should be 10–15 digits including the country code (e.g. 9876543210).";
        }
        if (!data.date_of_birth) return "Please enter your date of birth.";
        if (!data.gender) return "Please select your gender.";
        return "";
      }
      case 4:
        if (!data.linkedin_url.trim()) return "LinkedIn is required — recruiters check it first.";
        if (!/^https:\/\/.+/i.test(data.linkedin_url.trim())) {
          return "LinkedIn URL should start with https://";
        }
        if (data.github_url && !/^https:\/\/.+/i.test(data.github_url.trim())) {
          return "GitHub URL should start with https://";
        }
        if (data.portfolio_url && !/^https:\/\/.+/i.test(data.portfolio_url.trim())) {
          return "Portfolio URL should start with https://";
        }
        return "";
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
      name: joinName(data.first_name, data.middle_name, data.last_name),
      first_name: data.first_name.trim(),
      middle_name: data.middle_name.trim(),
      last_name: data.last_name.trim(),
      department: data.department,
      program: data.program,
      start_year: Number(data.start_year),
      end_year: Number(data.end_year),
      cgpa: Number(data.cgpa),
      phone: `${data.country_code} ${data.phone.replace(/\D/g, "")}`.trim(),
      date_of_birth: data.date_of_birth,
      gender: data.gender,
      linkedin_url: data.linkedin_url.trim(),
      github_url: data.github_url.trim(),
      portfolio_url: data.portfolio_url.trim(),
      skills: data.skills,
      certifications: data.certifications,
      projects: data.projects,
      internships: data.internships,
      preferred_roles: data.preferred_roles,
      preferred_locations: data.preferred_locations,
      expected_ctc: data.expected_ctc.trim() ? Number(data.expected_ctc) : null,
    };
    // Only send the college when one is known (e.g. pre-filled from the
    // candidate's existing profile) so we never wipe an existing link.
    if (data.college.trim()) {
      payload["college"] = data.college.trim();
    }
    try {
      await completeOnboarding(payload);
      setSaved(true);
      try {
        localStorage.removeItem("tb.chat.sessions");
      } catch {
        // ignore
      }
      setTimeout(() => {
        void navigate({ to: "/chat", replace: true });
      }, 700);
    } catch (err) {
      setSaving(false);
      setStepError(
        err instanceof Error ? err.message : "Failed to save your profile. Please try again.",
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const githubPlaceholder = "https://github.com/yourhandle";
  const portfolioPlaceholder = "https://yourportfolio.com";

  const stepContent = useMemo(() => {
    switch (step) {
      case 0:
        return (
          <>
            <Field id="first_name" label="First name" required>
              <input
                id="first_name"
                className={inputClass}
                placeholder="e.g. Ananya"
                value={data.first_name}
                onChange={(e) => set("first_name", e.target.value)}
                autoFocus
              />
            </Field>
            <Field id="middle_name" label="Middle name">
              <input
                id="middle_name"
                className={inputClass}
                placeholder="e.g. Rao"
                value={data.middle_name}
                onChange={(e) => set("middle_name", e.target.value)}
              />
            </Field>
            <Field id="last_name" label="Last name" required>
              <input
                id="last_name"
                className={inputClass}
                placeholder="e.g. Sharma"
                value={data.last_name}
                onChange={(e) => set("last_name", e.target.value)}
              />
            </Field>
          </>
        );
      case 1:
        return (
          <>
            <Field
              id="registration_number"
              label="Registration number"
              required
              hint={
                <>
                  Your roll / registration number as printed on your college ID card.{" "}
                  <strong>Cannot be changed.</strong>
                </>
              }
            >
              <input
                id="registration_number"
                className={inputClass}
                placeholder="e.g. 21B81A05C7"
                value={data.registration_number}
                onChange={(e) => set("registration_number", e.target.value)}
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                id="department"
                label="Department"
                required
                {...(collegeDepartments.length > 0
                  ? { hint: `Departments offered at ${data.college}.` }
                  : {})}
              >
                {collegeDepartments.length > 0 ? (
                  <Select value={data.department} onValueChange={(next) => set("department", next)}>
                    <SelectTrigger className="h-12 w-full rounded-xl bg-card px-4">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {collegeDepartments.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                      {data.department && !collegeDepartments.includes(data.department) && (
                        <SelectItem value={data.department}>{data.department}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                ) : (
                  <input
                    id="department"
                    className={inputClass}
                    placeholder="e.g. Computer Science"
                    value={data.department}
                    onChange={(e) => set("department", e.target.value)}
                  />
                )}
              </Field>
              <Field id="program" label="Program" required>
                <Select value={data.program} onValueChange={(next) => set("program", next)}>
                  <SelectTrigger className="h-12 w-full rounded-xl bg-card px-4">
                    <SelectValue placeholder="Select program" />
                  </SelectTrigger>
                  <SelectContent>
                    {COURSES_OFFERED.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </>
        );
      case 2:
        return (
          <div className="grid gap-5 sm:grid-cols-3">
            <Field id="start_year" label="Start year" required>
              <input
                id="start_year"
                type="number"
                inputMode="numeric"
                min={2000}
                max={2036}
                className={inputClass}
                placeholder="2022"
                value={data.start_year}
                onChange={(e) => set("start_year", e.target.value)}
              />
            </Field>
            <Field id="end_year" label="End year" required>
              <input
                id="end_year"
                type="number"
                inputMode="numeric"
                min={2000}
                max={2038}
                className={inputClass}
                placeholder="2026"
                value={data.end_year}
                onChange={(e) => set("end_year", e.target.value)}
              />
            </Field>
            <Field id="cgpa" label="CGPA" required>
              <input
                id="cgpa"
                type="number"
                inputMode="decimal"
                min={0}
                max={10}
                step="0.01"
                className={inputClass}
                placeholder="8.5"
                value={data.cgpa}
                onChange={(e) => set("cgpa", e.target.value)}
              />
            </Field>
          </div>
        );
      case 3:
        return (
          <>
            <Field id="phone" label="Mobile number" required>
              <div className="flex gap-2">
                <Select
                  value={data.country_code}
                  onValueChange={(code) => set("country_code", code)}
                >
                  <SelectTrigger className="h-12 w-24 shrink-0 rounded-xl bg-card px-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PHONE_COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.short} {c.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  className={cn(inputClass, "flex-1")}
                  placeholder="9876543210"
                  value={data.phone}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw.startsWith("+")) {
                      const compact = raw.replace(/\s+/g, "");
                      for (const c of PHONE_COUNTRIES) {
                        if (compact.startsWith("+" + c.digits)) {
                          set("country_code", c.code);
                          set("phone", compact.slice(c.digits.length + 1).replace(/\D/g, ""));
                          return;
                        }
                      }
                    }
                    set("phone", raw.replace(/\D/g, ""));
                  }}
                />
              </div>
            </Field>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Field id="date_of_birth" label="Date of birth" required>
                <input
                  id="date_of_birth"
                  type="date"
                  className={inputClass}
                  value={data.date_of_birth}
                  onChange={(e) => set("date_of_birth", e.target.value)}
                />
              </Field>
              <Field id="gender" label="Gender" required>
                <GenderSelect value={data.gender} onChange={(next) => set("gender", next)} />
              </Field>
            </div>
          </>
        );
      case 4:
        return (
          <div className="space-y-5">
            <Field id="linkedin_url" label="LinkedIn URL" required>
              <input
                id="linkedin_url"
                type="url"
                className={inputClass}
                placeholder="https://linkedin.com/in/yourhandle"
                value={data.linkedin_url}
                onChange={(e) => set("linkedin_url", e.target.value)}
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="github_url" label="GitHub URL">
                <input
                  id="github_url"
                  type="url"
                  className={inputClass}
                  placeholder={githubPlaceholder}
                  value={data.github_url}
                  onChange={(e) => set("github_url", e.target.value)}
                />
              </Field>
              <Field id="portfolio_url" label="Portfolio URL">
                <input
                  id="portfolio_url"
                  type="url"
                  className={inputClass}
                  placeholder={portfolioPlaceholder}
                  value={data.portfolio_url}
                  onChange={(e) => set("portfolio_url", e.target.value)}
                />
              </Field>
            </div>
          </div>
        );
      case 5:
        return (
          <div className="space-y-5">
            <TagInput
              id="skills"
              label="Skills"
              placeholder="e.g. Python, DSA, Communication"
              hint="Press Enter to add each skill."
              value={data.skills}
              onChange={(next) => set("skills", next)}
            />
            <TagInput
              id="certifications"
              label="Certifications"
              placeholder="e.g. AWS Certified, NPTEL Cloud Computing"
              hint="Press Enter to add each certification."
              value={data.certifications}
              onChange={(next) => set("certifications", next)}
            />
          </div>
        );
      case 6:
        return (
          <div className="space-y-5">
            <TagInput
              id="projects"
              label="Projects"
              placeholder="e.g. Placement Portal (React, Django)"
              hint="Press Enter to add each project."
              value={data.projects}
              onChange={(next) => set("projects", next)}
            />
            <TagInput
              id="internships"
              label="Internships"
              placeholder="e.g. SDE Intern @ TCS (Summer 2025)"
              hint="Press Enter to add each internship."
              value={data.internships}
              onChange={(next) => set("internships", next)}
            />
          </div>
        );
      case 7:
        return (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              <TagInput
                id="preferred_roles"
                label="Preferred roles"
                placeholder="e.g. SDE, Data Analyst"
                hint="Roles you're targeting."
                value={data.preferred_roles}
                onChange={(next) => set("preferred_roles", next)}
              />
              <TagInput
                id="preferred_locations"
                label="Preferred locations"
                placeholder="e.g. Pune, Bengaluru"
                hint="Cities you're open to working in."
                value={data.preferred_locations}
                onChange={(next) => set("preferred_locations", next)}
              />
            </div>
            <Field id="expected_ctc" label="Expected CTC (LPA)" hint="Optional — in lakhs (LPA).">
              <input
                id="expected_ctc"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.1"
                className={inputClass}
                placeholder="e.g. 7.5"
                value={data.expected_ctc}
                onChange={(e) => set("expected_ctc", e.target.value)}
              />
            </Field>
          </>
        );
      default:
        return null;
    }
  }, [step, data, collegeDepartments]);

  if (status === "loading") {
    return <GateLoading />;
  }

  if (status === "error" || !user) {
    return <GateError message={errorMessage} />;
  }

  return (
    <div className="tg-grain relative min-h-svh bg-background text-foreground">
      {/* Progress */}
      <div className="mx-auto w-full max-w-xl px-4 pt-8 sm:px-6">
        <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
          <span>Profile setup</span>
          <div className="flex items-center gap-3">
            <span>
              Step {step + 1} of {STEPS.length}
            </span>
            <LogoutConfirmDialog>
              <button
                type="button"
                aria-label="Logout"
                disabled={saving}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-[10px] font-medium tracking-[0.2em] text-muted-foreground uppercase transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
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
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-foreground/5 text-foreground">
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
                  <p className="font-display text-2xl tracking-tight">Profile complete!</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Taking you to your AI career coach…
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
                      className={cn(
                        "inline-flex h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-foreground px-7 text-[11px] font-medium tracking-[0.2em] text-background uppercase transition-transform duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50",
                        step === 0 && "flex-1",
                      )}
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
