import { practiceDayKey } from "@/lib/practice-time";

/**
 * The daily practice target, kept on the device alongside the day's measured
 * time in `practice-time.ts`.
 *
 * This used to be a `DailyTarget` row behind `/api/daily-target/`, but nothing
 * the server stored was needed to judge the day: no practice table records how
 * long a session ran, and `time_spent` is a lifetime total with no day or module
 * on it. So the plan sits with the measurement, and the day rolls over when the
 * measured time does.
 *
 * The cost is the one the timers already accepted — a target set on a phone is
 * not visible on a laptop, and clearing site data erases it. What is gained is
 * that "today" actually means today: the old row was a single rolling plan with
 * no date on it, so a target set on Monday silently became Tuesday's.
 */

const STORAGE_PREFIX = "tb.daily-target.";

/** Caps enforced on a target, so a stray value cannot store an impossible day. */
export const DAILY_TARGET_MAX_ITEMS = 20;
export const DAILY_TARGET_MAX_MINUTES = 600;

/** Minutes a blank day is budgeted for before the candidate picks a number. */
const DEFAULT_MINUTES = 30;

/** One self-training module a daily target can set a count against. */
export type DailyTargetModule = {
  key: string;
  label: string;
  /** Condensed name for surfaces too tight for `label`, e.g. the chat navbar. */
  short_label: string;
};

/**
 * The self-training modules a target can be built from, in catalogue order.
 * `short_label` exists so tight surfaces (the chat navbar's editor) can name
 * every module without truncating it.
 */
export const DAILY_TARGET_MODULES: DailyTargetModule[] = [
  { key: "communication", label: "Communication Skills", short_label: "Communication" },
  { key: "group_discussion", label: "Group Discussion", short_label: "Group Discussion" },
  { key: "aplr", label: "Aptitude & Logical Reasoning", short_label: "APLR" },
  { key: "basic_math", label: "Mathematics", short_label: "Mathematics" },
  { key: "english", label: "English Trainer", short_label: "English" },
  {
    key: "situational",
    label: "Situational Problem Solving Skills (Management)",
    short_label: "Situational",
  },
  {
    key: "technical",
    label: "Problem Solving Skills (Technical)",
    short_label: "Technical",
  },
  { key: "dsa", label: "DSA (Data Structures & Algorithms)", short_label: "DSA" },
];

export const DAILY_TARGET_MODULE_KEYS = DAILY_TARGET_MODULES.map((m) => m.key);

/**
 * What the candidate has committed to practise today. A day with no target yet
 * reads as all-zero with a default minute budget rather than failing, so the
 * number inputs always have a value to render and the chip can stay neutral.
 * `modules` is keyed like `DailyTargetModule.key` and always carries every key.
 *
 * This is the plan only. How much of it is met is worked out from time spent on
 * the practice surfaces — see `practiceProgress` in `practice-time.ts`.
 */
export type DailyTarget = {
  id: string | null;
  /** How many items of each self-training module are targeted for the day. */
  modules: Record<string, number>;
  /** How many mock interviews are targeted for the day. */
  mock_count: number;
  /** Minutes the candidate committed to spend today. */
  time_target: number;
  created_at: string | null;
  updated_at: string | null;
};

export type DailyTargetResponse = {
  target: DailyTarget;
  options: DailyTargetModule[];
};

function zeroModules(): Record<string, number> {
  return Object.fromEntries(DAILY_TARGET_MODULE_KEYS.map((key) => [key, 0]));
}

function blankTarget(): DailyTarget {
  return {
    id: null,
    modules: zeroModules(),
    mock_count: 0,
    time_target: DEFAULT_MINUTES,
    created_at: null,
    updated_at: null,
  };
}

function clamp(value: number, max: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(Math.floor(value), max);
}

function normaliseModules(modules: Record<string, number> | undefined): Record<string, number> {
  const counts = zeroModules();
  for (const key of DAILY_TARGET_MODULE_KEYS) {
    counts[key] = clamp(Number(modules?.[key] ?? 0), DAILY_TARGET_MAX_ITEMS);
  }
  return counts;
}

function storageKey(dayKey: string): string {
  return STORAGE_PREFIX + dayKey;
}

/**
 * Today's target, or a blank one. Unreadable storage reads as blank rather than
 * throwing, since a missing target should never take the navbar down.
 */
export function readDailyTarget(dayKey: string = practiceDayKey()): DailyTarget {
  if (typeof window === "undefined") return blankTarget();
  try {
    const raw = window.localStorage.getItem(storageKey(dayKey));
    if (!raw) return blankTarget();
    const parsed = JSON.parse(raw) as Partial<DailyTarget> | null;
    if (!parsed || typeof parsed !== "object") return blankTarget();
    return {
      id: null,
      modules: normaliseModules(parsed.modules),
      mock_count: clamp(Number(parsed.mock_count ?? 0), DAILY_TARGET_MAX_ITEMS),
      time_target: clamp(Number(parsed.time_target ?? DEFAULT_MINUTES), DAILY_TARGET_MAX_MINUTES),
      created_at: typeof parsed.created_at === "string" ? parsed.created_at : null,
      updated_at: typeof parsed.updated_at === "string" ? parsed.updated_at : null,
    };
  } catch {
    return blankTarget();
  }
}

/**
 * Write today's target and hand back what was stored, so a form can adopt the
 * clamped values rather than keep showing a number that was never saved.
 */
export function writeDailyTarget(
  input: Pick<DailyTarget, "modules" | "mock_count" | "time_target">,
  dayKey: string = practiceDayKey(),
): DailyTarget {
  const existing = readDailyTarget(dayKey);
  const stored: DailyTarget = {
    id: null,
    modules: normaliseModules(input.modules),
    mock_count: clamp(Number(input.mock_count ?? 0), DAILY_TARGET_MAX_ITEMS),
    time_target: clamp(Number(input.time_target ?? DEFAULT_MINUTES), DAILY_TARGET_MAX_MINUTES),
    created_at: existing.created_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(storageKey(dayKey), JSON.stringify(stored));
  } catch {
    // Private mode or quota exceeded — the editor keeps the values it holds and
    // the day simply reads as blank again next load.
  }
  return stored;
}

export async function getDailyTarget(): Promise<DailyTargetResponse> {
  return { target: readDailyTarget(), options: DAILY_TARGET_MODULES };
}

export async function saveDailyTarget(input: {
  modules: Record<string, number>;
  mock_count: number;
  time_target: number;
}): Promise<DailyTargetResponse> {
  return { target: writeDailyTarget(input), options: DAILY_TARGET_MODULES };
}
