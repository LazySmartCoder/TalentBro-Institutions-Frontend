import { useLocation, useNavigate } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useState } from "react";

import { PROFILE_SAVED_EVENT, SESSION_CHANGED_EVENT, me, type AuthUser } from "@/lib/api";

export type CandidateDestination =
  { to: "/candidate/auth" } | { to: "/candidate/onboarding" } | { to: "/client/chat" };

/**
 * Where this user belongs, or `null` when they are allowed to stay put.
 *
 * Returns a destination rather than navigating itself so the answer can be
 * computed during render: the gate stays a pure function of (user, path), which
 * is what makes it impossible to redirect in a loop.
 *
 * `path` is the route the user is currently on, and it is load-bearing rather
 * than informational. `/candidate/auth` and `/candidate/onboarding` are children
 * of this gate, so a logged-out visitor sitting on the login page is told to go
 * to the login page. Without comparing against where they already are, the gate
 * hides its own `<Outlet />` behind a spinner and replaces the URL with an
 * identical one, and the page never renders at all.
 */
export function resolveCandidateRoute(
  user: AuthUser | null,
  path: string,
): CandidateDestination | null {
  const destination = destinationFor(user);
  // Already where they were sent. Anything else is a redirect loop wearing a
  // spinner, and the gate would never let its own child render.
  if (destination !== null && destination.to === path) return null;
  return destination;
}

function destinationFor(user: AuthUser | null): CandidateDestination | null {
  // No session at all: send them to sign in rather than showing an empty shell.
  if (!user) return { to: "/candidate/auth" };
  // Institution staff never meet the candidate gate; they have their own area.
  if (user.role !== "student") return { to: "/client/chat" };
  // An incomplete profile is the one thing a candidate cannot be moved past
  // without becoming someone else: onboarding writes the skills and roles.
  if (user.profile_complete === false) return { to: "/candidate/onboarding" };
  return null;
}

export type CandidateGate = {
  status: "loading" | "error" | "ready";
  message: string | null;
  user: AuthUser | null;
  /** A redirect is in flight, so the gated content must stay unmounted. */
  redirecting: boolean;
};

/**
 * The one place the "is this candidate allowed into the candidate area?" check
 * lives, used by the candidate layout.
 */
export function useCandidateGate(): CandidateGate {
  const navigate = useNavigate();
  const path = useLocation({ select: (location) => location.pathname });
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [message, setMessage] = useState<string | null>(null);

  // Fetched on mount, then re-read whenever something server-side could have
  // moved the answer. The user object does change while the app is open: the
  // profile screen writes skills and preferred roles and the end-of-chat AI
  // summary can add a skill. A user object cached for the life of the layout
  // would keep reporting the old status, so the redirect would never fire.
  useEffect(() => {
    let cancelled = false;

    // `strict` is only for the first load: with nothing to fall back on, a
    // failure has to surface. A later refresh keeps the last known user, so a
    // dropped connection while tabbing away cannot blank a working app.
    const load = (strict: boolean) => {
      me()
        .then((current) => {
          if (cancelled) return;
          setUser(current);
          setStatus("ready");
        })
        .catch((err: unknown) => {
          if (cancelled || !strict) return;
          setMessage(err instanceof Error ? err.message : null);
          setStatus("error");
        });
    };

    const refresh = () => load(false);

    // Signing in, signing up or signing out replaces the answer outright, and
    // the event carries the account it replaced it with. That account is adopted
    // straight away rather than after the `me()` below: waiting one request
    // would leave the gate still reporting "signed out" while the login page
    // reports the opposite, and the two would trade the URL back and forth
    // behind the spinner for as long as it took. The request still runs, so the
    // gate ends up agreeing with the server rather than with the login response.
    const adoptSession = (event: Event) => {
      const next = (event as CustomEvent<AuthUser | null>).detail;
      // An event with no payload is not one of ours; treating it as a sign-out
      // would eject a candidate who is in fact signed in.
      if (next === undefined) return;
      setUser(next);
      setStatus("ready");
      load(false);
    };

    load(true);
    window.addEventListener(PROFILE_SAVED_EVENT, refresh);
    window.addEventListener(SESSION_CHANGED_EVENT, adoptSession);
    // Catches the AI's post-chat profile writes, which land with no client event.
    window.addEventListener("focus", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(PROFILE_SAVED_EVENT, refresh);
      window.removeEventListener(SESSION_CHANGED_EVENT, adoptSession);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const destination = status === "ready" ? resolveCandidateRoute(user, path) : null;
  // Keyed on the path rather than the object: `resolveCandidateRoute` returns a
  // fresh literal each render, so depending on it would re-navigate on every
  // refetch even when the answer has not changed.
  const target = destination?.to ?? null;

  useEffect(() => {
    if (target === null) return;
    if (target === "/candidate/auth") {
      void navigate({ to: "/candidate/auth", search: { mode: "login" }, replace: true });
      return;
    }
    void navigate({ to: target, replace: true });
  }, [target, navigate]);

  return { status, message, user, redirecting: target !== null };
}

/**
 * Carries the layout's answer down to the pages inside the gate.
 *
 * The login page used to ask the server who is signed in a second time behind a
 * spinner of its own, on top of the one the layout was already showing. One
 * request and one loader are enough for both, and this is how the page reads
 * that single answer rather than repeating the question.
 */
export const CandidateGateContext = createContext<CandidateGate | null>(null);

/** The gate this page sits inside, or `null` when it is rendered outside one. */
export function useCandidateGateResult(): CandidateGate | null {
  return useContext(CandidateGateContext);
}
