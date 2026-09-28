/**
 * Only the plan fields the progress maths reads. Spelled structurally so this
 * module stays free of imports — the stored target lives in `daily-target.ts`,
 * and depending on it just for a type would tie the measured time to the setter.
 */
type PlannableTarget = {
  modules: Record<string, number>;
  mock_count: number;
} | null;

/**
 * How long the candidate actually spent practising today, banked on the device.
 *
 * The backend records no elapsed time for a practice session — the training
 * tables carry only `solved_at`-style timestamps, and `MockInterview.duration`
 * is the preset bucket the candidate picked, not how long they took — so there
 * is nothing to read back. `CandidateProfile.time_spent` is a single cumulative
 * lifetime total with no day and no module on it. The one honest option is to
 * measure the time here and keep the day's tally in `localStorage`, which also
 * keeps the daily-target numbers a pure client concern.
 *
 * The cost of measuring on the device is that the tally is per-browser: a second
 * device starts the day at zero, and clearing site data erases it. That is
 * accepted rather than worked around, because the alternative is either a
 * backend migration across nine practice tables or idling on a page being
 * counted as practice.
 */

/** Elapsed milliseconds per practice surface, for one calendar day. */
export type PracticeDay = {
  /** Keyed by the same module keys a daily target uses. */
  modules: Record<string, number>;
  /** Elapsed time inside a mock interview. */
  mock: number;
  /** Elapsed time anywhere on the portal — the denominator for the whole day. */
  portal: number;
};

const STORAGE_PREFIX = "tb.practice.";

/** The surface key a mock interview banks under. */
export const MOCK_SURFACE = "mock";

/**
 * A surface has to be occupied this long before it counts towards the day. The
 * module targets are item counts, but what we can actually observe is time, so a
 * module with a target of five is satisfied by showing up and working on it —
 * asking the clock to prove five discrete finished items would mean inventing a
 * nominal duration per item that no data supports.
 */
export const PRACTICE_DONE_MS = 60_000;

/**
 * Which practice surface each route belongs to. Matched on a path boundary, not
 * a prefix, so `/mock-interview-history` is not counted as a mock interview.
 */
const ROUTE_SURFACES: ReadonlyArray<readonly [string, string]> = [
  ["/communication-training", "communication"],
  ["/gd-room", "group_discussion"],
  ["/aplr-training", "aplr"],
  ["/basic-math-training", "basic_math"],
  ["/english-training", "english"],
  ["/situational-training", "situational"],
  ["/technical-training", "technical"],
  ["/dsa-training", "dsa"],
  ["/mock-interview", MOCK_SURFACE],
];

/** The practice surface a path belongs to, or null if it is not one. */
export function surfaceForPath(pathname: string): string | null {
  for (const [route, key] of ROUTE_SURFACES) {
    if (pathname === route || pathname.startsWith(`${route}/`)) return key;
  }
  return null;
}

/** Local calendar day, so "today" matches the candidate's own midnight. */
export function practiceDayKey(date: Date = new Date()): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function positiveNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function emptyDay(): PracticeDay {
  return { modules: {}, mock: 0, portal: 0 };
}

/** Today's banked time. Unreadable storage reads as an empty day, never throws. */
export function readPracticeDay(key: string = practiceDayKey()): PracticeDay {
  if (typeof window === "undefined") return emptyDay();
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return emptyDay();
    const parsed = JSON.parse(raw) as Partial<PracticeDay> | null;
    if (!parsed || typeof parsed !== "object") return emptyDay();
    const modules: Record<string, number> = {};
    for (const [name, value] of Object.entries(parsed.modules ?? {})) {
      const ms = positiveNumber(value);
      if (ms > 0) modules[name] = ms;
    }
    return {
      modules,
      mock: positiveNumber(parsed.mock),
      portal: positiveNumber(parsed.portal),
    };
  } catch {
    return emptyDay();
  }
}

/**
 * Bank elapsed time against the surface it was spent on. `surface` is null for
 * ordinary browsing, which still counts towards portal time.
 */
export function addPracticeMs(
  surface: string | null,
  ms: number,
  key: string = practiceDayKey(),
): void {
  if (typeof window === "undefined" || !(ms > 0)) return;
  try {
    const day = readPracticeDay(key);
    day.portal += ms;
    if (surface === MOCK_SURFACE) day.mock += ms;
    else if (surface) day.modules[surface] = (day.modules[surface] ?? 0) + ms;
    window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(day));
  } catch {
    // Private mode or quota exceeded — the day reads as neutral rather than
    // throwing, since this is a motivational badge and not a source of truth.
  }
}

export function minutes(ms: number): number {
  return Math.floor(ms / PRACTICE_DONE_MS);
}

export type PracticeProgress = {
  /** null when nothing is planned for the day, so the chip stays neutral. */
  met: boolean | null;
  done_items: number;
  planned_items: number;
  /** Module keys, plus `"mock"`, still short of their target. */
  outstanding: string[];
  minutes: { portal: number; mock: number; modules: Record<string, number> };
};

/**
 * Judge the day's target against banked time. A planned module (or mock) counts
 * as done once it has been occupied for at least {@link PRACTICE_DONE_MS}.
 */
export function practiceProgress(target: PlannableTarget, day: PracticeDay): PracticeProgress {
  const totals = {
    portal: minutes(day.portal),
    mock: minutes(day.mock),
    modules: Object.fromEntries(Object.entries(day.modules).map(([key, ms]) => [key, minutes(ms)])),
  };

  const planned = Object.entries(target?.modules ?? {}).filter(
    ([, count]) => positiveNumber(count) > 0,
  );
  const plannedMock = positiveNumber(target?.mock_count);
  const plannedItems = planned.reduce((sum, [, count]) => sum + count, 0) + plannedMock;

  if (plannedItems === 0) {
    return { met: null, done_items: 0, planned_items: 0, outstanding: [], minutes: totals };
  }

  const outstanding: string[] = [];
  let done = 0;
  for (const [key, count] of planned) {
    if ((day.modules[key] ?? 0) >= PRACTICE_DONE_MS) done += count;
    else outstanding.push(key);
  }
  if (plannedMock > 0) {
    if (day.mock >= PRACTICE_DONE_MS) done += plannedMock;
    else outstanding.push(MOCK_SURFACE);
  }

  return {
    met: outstanding.length === 0,
    done_items: done,
    planned_items: plannedItems,
    outstanding,
    minutes: totals,
  };
}
