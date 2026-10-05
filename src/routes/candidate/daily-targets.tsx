import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, BriefcaseBusiness, Check, Loader2, Target } from "lucide-react";
import { toast } from "sonner";

import { AppNavHeader } from "@/components/tb/app-nav";
import { GateError, GateLoading } from "@/components/load-state";
import { Panel } from "@/components/dash/bits";
import { me, type AuthUser } from "@/lib/api";
import {
  getDailyTarget,
  saveDailyTarget,
  DAILY_TARGET_MAX_ITEMS,
  DAILY_TARGET_MAX_MINUTES,
  type DailyTargetModule,
} from "@/lib/daily-target";
import { cn } from "@/lib/utils";

const title = "TalentBro | Daily Target";
const description =
  "Set what you are committing to practise today: how many items of each self-training module, how many mock interviews, and how many minutes you will spend.";

export const Route = createFileRoute("/candidate/daily-targets")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: DailyTargetsPage,
});

/** Quick picks above the free-entry minutes field. */
const MINUTE_PRESETS = [15, 30, 60, 90, 120];
const MAX_MINUTES = DAILY_TARGET_MAX_MINUTES;

/** Cap on the items of one module (or mock interviews) a single day can hold. */
const MAX_ITEMS = DAILY_TARGET_MAX_ITEMS;
const ITEM_PRESETS = [1, 2, 3, 5];

function formatSavedAt(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function ModuleRow({
  module: trainingModule,
  value,
  onChange,
}: {
  module: DailyTargetModule;
  value: number;
  onChange: (next: number) => void;
}) {
  const invalid = value < 0 || value > MAX_ITEMS;
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors",
        invalid
          ? "border-destructive bg-card"
          : value > 0
            ? "border-foreground bg-foreground text-background"
            : "border-border bg-card text-foreground hover:bg-muted",
      )}
    >
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{trainingModule.label}</span>
      <input
        type="number"
        min={0}
        max={MAX_ITEMS}
        step={1}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(event.target.valueAsNumber)}
        aria-label={`${trainingModule.label} items`}
        className={cn(
          "h-9 w-20 shrink-0 rounded-md border bg-background px-2 text-right text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/25",
          invalid ? "border-destructive" : "border-input",
        )}
      />
    </div>
  );
}

function DailyTargetsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [options, setOptions] = useState<DailyTargetModule[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [mockCount, setMockCount] = useState(0);
  const [minutes, setMinutes] = useState(30);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Candidates only. Institution staff are redirected to their own dashboard.
  useEffect(() => {
    let cancelled = false;
    me()
      .then(async (current) => {
        if (cancelled) return;
        if (!current) {
          void navigate({ to: "/candidate/auth", search: { mode: "login" }, replace: true });
          return;
        }
        if (current.role !== "student") {
          void navigate({ to: "/client/dashboard", replace: true });
          return;
        }
        if (current.profile_complete === false) {
          void navigate({ to: "/candidate/onboarding", replace: true });
          return;
        }
        setUser(current);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setErrorMessage(err instanceof Error ? err.message : null);
          setStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  // The backend answers with a blank target when none is stored yet, so this
  // only ever needs to seed the form.
  useEffect(() => {
    if (status !== "ready") return;
    let cancelled = false;
    getDailyTarget()
      .then((data) => {
        if (cancelled) return;
        setOptions(data.options ?? []);
        setCounts(data.target.modules ?? {});
        setMockCount(data.target.mock_count);
        setMinutes(data.target.time_target);
        setSavedAt(data.target.updated_at);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setErrorMessage(err instanceof Error ? err.message : null);
          setStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

  if (status === "loading") return <GateLoading />;

  if (status === "error" || !user) return <GateError message={errorMessage} />;

  const minutesValue = Number.isFinite(minutes) ? minutes : 0;
  const minutesInvalid = minutesValue < 0 || minutesValue > MAX_MINUTES;
  const mockValue = Number.isFinite(mockCount) ? mockCount : 0;
  const mockInvalid = mockValue < 0 || mockValue > MAX_ITEMS;
  const totalItems = options.reduce((sum, option) => {
    const value = counts[option.key];
    return sum + (value !== undefined && Number.isFinite(value) ? value : 0);
  }, 0);
  const countsInvalid = Object.values(counts).some(
    (value) => !Number.isFinite(value) || value < 0 || value > MAX_ITEMS,
  );
  const nothingPlanned = totalItems === 0 && mockValue === 0;
  const savedLabel = formatSavedAt(savedAt);

  function setCount(key: string, next: number) {
    setCounts((prev) => ({ ...prev, [key]: next }));
  }

  async function submit() {
    if (minutesInvalid) {
      toast.error(`Time to spend must be between 0 and ${MAX_MINUTES} minutes.`);
      return;
    }
    if (mockInvalid) {
      toast.error(`Mock interviews must be between 0 and ${MAX_ITEMS}.`);
      return;
    }
    if (countsInvalid) {
      toast.error(`Each module must be between 0 and ${MAX_ITEMS} items.`);
      return;
    }
    setSaving(true);
    try {
      const data = await saveDailyTarget({
        modules: counts,
        mock_count: Math.round(mockValue),
        time_target: Math.round(minutesValue),
      });
      // Adopt whatever the server stored, so a rejected count never lingers in
      // the form after a save.
      setCounts(data.target.modules);
      setMockCount(data.target.mock_count);
      setMinutes(data.target.time_target);
      setSavedAt(data.target.updated_at);
      toast.success("Daily target saved");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't save your daily target.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-svh bg-background text-foreground">
      <AppNavHeader
        current="daily-targets"
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
              <Target className="size-4" />
            </span>
            <span>
              <p className="text-sm font-semibold leading-tight">Daily Target</p>
            </span>
          </div>
        }
      />

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-8 max-w-2xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Today&rsquo;s plan
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            What you&rsquo;re doing today.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Say how many items of each self-training module you plan to work through, how many mock
            interviews are on the menu, and the time you are giving yourself. Save it and come back
            to it every morning.
          </p>
        </div>

        <Panel
          title="Self-training modules"
          description="Every module on the platform. Enter how many items of each you are taking on."
          className="mb-6"
          action={
            <span className="shrink-0 font-mono text-xs text-muted-foreground">
              {totalItems} item{totalItems === 1 ? "" : "s"}
            </span>
          }
        >
          <div className="grid gap-2.5 sm:grid-cols-2">
            {options.map((option) => (
              <ModuleRow
                key={option.key}
                module={option}
                value={counts[option.key] ?? 0}
                onChange={(next) => setCount(option.key, next)}
              />
            ))}
          </div>
        </Panel>

        <Panel
          title="Mock interview"
          description="How many mock interviews are part of today."
          className="mb-6"
        >
          <div className="flex flex-wrap items-center gap-3">
            <BriefcaseBusiness className="size-4 shrink-0 text-muted-foreground" />
            <input
              type="number"
              min={0}
              max={MAX_ITEMS}
              step={1}
              value={mockValue}
              onChange={(event) => setMockCount(event.target.valueAsNumber)}
              aria-label="Mock interviews"
              className={cn(
                "h-10 w-24 rounded-md border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring/25",
                mockInvalid ? "border-destructive" : "border-input",
              )}
            />
            <span className="text-sm text-muted-foreground">mock interviews</span>
            <div className="flex flex-wrap gap-2">
              {ITEM_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setMockCount(preset)}
                  className={cn(
                    "cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    mockValue === preset
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-foreground hover:bg-muted",
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
          {mockInvalid && (
            <p className="mt-3 text-sm text-destructive">
              Enter a number of mock interviews between 0 and {MAX_ITEMS}.
            </p>
          )}
        </Panel>

        <Panel
          title="Time to spend"
          description="How many minutes you are committing to today."
          className="mb-6"
        >
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="number"
              min={0}
              max={MAX_MINUTES}
              step={5}
              value={minutesValue}
              onChange={(event) => setMinutes(event.target.valueAsNumber)}
              aria-label="Minutes to spend"
              className="h-10 w-32 rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring/25"
            />
            <span className="text-sm text-muted-foreground">minutes</span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {MINUTE_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setMinutes(preset)}
                className={cn(
                  "cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  minutesValue === preset
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-foreground hover:bg-muted",
                )}
              >
                {preset} min
              </button>
            ))}
          </div>

          {minutesInvalid && (
            <p className="mt-3 text-sm text-destructive">
              Enter a number of minutes between 0 and {MAX_MINUTES}.
            </p>
          )}
        </Panel>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving || minutesInvalid || mockInvalid || countsInvalid}
            className="inline-flex cursor-pointer items-center gap-2 bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {saving ? "Saving…" : "Save target"}
          </button>
          {nothingPlanned && <p className="text-xs text-muted-foreground">Nothing planned yet.</p>}
          {savedLabel && <p className="text-xs text-muted-foreground">Last saved {savedLabel}</p>}
        </div>
      </main>
    </div>
  );
}
