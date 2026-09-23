import { me, updateProfile } from "@/lib/api";

// Tracks how long a logged-in student stays on the app across sessions and
// reports it in whole minutes to the candidate profile's `time_spent` field.
// Time is counted from the moment any page is opened until the tab closes.
// The backend PATCH for `time_spent` is additive, so every flush *adds* its
// minutes to the stored total. A 60s heartbeat keeps minutes persisted even if
// the tab is killed before `pagehide` fires.
const FLUSH_INTERVAL_MS = 60_000;
const MINUTE_MS = 60_000;

let started = false;
let sessionStart = 0;
let pendingMs = 0;
let lastFlushMs = 0;

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

      const flushNow = () => {
        void flush(Date.now());
      };
      window.addEventListener("pagehide", flushNow);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") flushNow();
      });
      window.setInterval(flushNow, FLUSH_INTERVAL_MS);
    })
    .catch(() => {
      /* not signed in — nothing to track */
    });
}
