/**
 * Where a notification tap actually lands.
 *
 * `Notification.redirect_path` is a stored string, not a route reference, so it
 * outlives the route tree. Rows written before the candidate screens moved under
 * `/candidate/` still carry the old bare paths (`/tutorials`, `/chat`, …), and
 * those rows are already sitting in people's inboxes — rewriting the backend
 * only fixes notifications created from now on. So every tap goes through here
 * first: an old row and a new row both resolve to the page that exists today.
 *
 * The backend now writes `/candidate/…` directly; this map is the safety net for
 * everything already stored, and it is deliberately one-directional — a path
 * that is already current is left alone rather than being rebuilt.
 */

/** Bare legacy paths that moved under `/candidate/`. */
const LEGACY_CANDIDATE_PATHS: Record<string, string> = {
  "/tutorials": "/candidate/tutorials",
  "/mock-interview": "/candidate/mock-interview",
  "/english-training": "/candidate/english-training",
  "/english-training-history": "/candidate/english-training-history",
  "/self-training": "/candidate/self-training",
  "/daily-targets": "/candidate/daily-targets",
  "/gd-training": "/candidate/gd-training",
  "/technical-training": "/candidate/technical-training",
  "/dsa-training": "/candidate/dsa-training",
  "/communication-training": "/candidate/communication-training",
  "/aplr-training": "/candidate/aplr-training",
  "/basic-math-training": "/candidate/basic-math-training",
  "/situational-training": "/candidate/situational-training",
  "/chat": "/candidate/chat",
  "/client-chat": "/candidate/chat",
  "/leaderboard": "/candidate/leaderboard",
  "/profile": "/candidate/profile",
  "/notifications": "/candidate/notifications",
  "/student-message": "/candidate/student-message",
  "/resume-builder": "/candidate/resume-builder",
  "/learning": "/candidate/learning",
  // The staff overview was retired: the chat screen is the staff landing page now,
  // and notices written before the cutover still carry the old path.
  "/client/dashboard": "/client/chat",
};

/**
 * Resolve a stored `redirect_path` to a path the router can actually match.
 *
 * The path may carry a query string (`/student-message?peer=<id>`), so the query
 * is split off first, mapped, and re-attached — otherwise `?peer=` would end up
 * part of the dictionary key and never match.
 *
 * Returns null when there is nothing to navigate to, so callers can fall back to
 * simply marking the notice read rather than pushing a dead URL into history.
 */
export function resolveNotificationRedirect(
  redirectPath: string | null | undefined,
): string | null {
  const raw = (redirectPath || "").trim();
  if (!raw) return null;

  const queryAt = raw.indexOf("?");
  const pathname = queryAt === -1 ? raw : raw.slice(0, queryAt);
  const search = queryAt === -1 ? "" : raw.slice(queryAt);

  const mapped = LEGACY_CANDIDATE_PATHS[pathname];
  return mapped ? `${mapped}${search}` : raw;
}
