import { me, updateProfile } from "@/lib/api";
import { addPracticeMs, surfaceForPath } from "@/lib/practice-time";

// Tracks how long a logged-in student stays on the app across sessions and
// reports it in whole minutes to the candidate profile's `time_spent` field.
// Time is counted from the moment any page is opened until the tab closes.
// The backend PATCH for `time_spent` is additive, so every flush *adds* its
// minutes to the stored total. A 60s heartbeat keeps minutes persisted even if
// the tab is killed before `pagehide` fires.
//
// Alongside the lifetime total, the same elapsed time is banked against the
// practice surface it was spent on, keyed by calendar day, so the daily target
// can be judged from today's self-training, mock and portal time. That tally
// lives on the device — see `practice-time.ts` for why it is not server-side.
const FLUSH_INTERVAL_MS = 60_000;
const MINUTE_MS = 60_000;

// Client-side navigation never fires `pagehide`, so the active surface is
// sampled on a short poll. The poll only banks time when the surface actually
// changes, so writes stay at one a minute rather than one a poll.
const SURFACE_POLL_MS = 5_000;

let started = false;
let sessionStart = 0;
let pendingMs = 0;
let lastFlushMs = 0;
let bankedSurface: string | null = null;
let surfaceStart = 0;

/** Bank the current surface's slice up to `now` and restart its clock. */
function bankSurface(now: number): void {
  addPracticeMs(bankedSurface, now - surfaceStart);
  surfaceStart = now;
}

/** Bank the outgoing surface if the route moved to a different one. */
function syncSurface(now: number): void {
  const next = surfaceForPath(window.location.pathname);
  if (next === bankedSurface) return;
  bankSurface(now);
  bankedSurface = next;
}

async function flush(now: number): Promise<void> {
  // Debounce duplicate fire events (pagehide + visibilitychange) in one exit.
  if (now - lastFlushMs < 1000) return;
  lastFlushMs = now;

  pendingMs += now - sessionStart;
  sessionStart = now;

  const minutes = Math.floor(pendingMs / MINUTE_MS);
  if (minutes < 1) return;
  pendingMs -= minutes * MINUTE_MS;

  try {
    await updateProfile({ time_spent: minutes });
  } catch {
    // Roll back so the lost minutes are retried on the next heartbeat.
    pendingMs += minutes * MINUTE_MS;
  }
}

export function initTimeTracker(): void {
  if (typeof window === "undefined" || started) return;
  started = true;

  // Only track student (candidate) accounts — staff accounts have no
  // candidate profile, so reporting time there would do nothing useful.
  void me()
    .then((user) => {
      if (!user || user.role !== "student") return;
      sessionStart = Date.now();
      surfaceStart = sessionStart;
      bankedSurface = surfaceForPath(window.location.pathname);

      const flushNow = () => {
        const now = Date.now();
        syncSurface(now);
        bankSurface(now);
        void flush(now);
      };
      window.addEventListener("pagehide", flushNow);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") flushNow();
      });
      window.setInterval(flushNow, FLUSH_INTERVAL_MS);
      window.setInterval(() => syncSurface(Date.now()), SURFACE_POLL_MS);
    })
    .catch(() => {
      /* not signed in — nothing to track */
    });
}
