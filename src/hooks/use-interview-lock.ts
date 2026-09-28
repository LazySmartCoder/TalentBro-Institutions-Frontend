import { useCallback, useEffect, useRef, useState } from "react";

// How the candidate left the locked interview surface.
export type InterviewLockBreak = "tab" | "window" | "fullscreen";

// A browser cannot actually stop someone from alt-tabbing — nothing on the web
// platform allows that. What it can do is own the whole viewport, refuse every
// navigation, and notice the moment the surface is left. So the lock is built
// from those three pieces and reports the break to the caller, which is the only
// place that can decide what a break costs the candidate.
async function enterFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    }
  } catch {
    // Denied. Either the platform has no element fullscreen (iPhone Safari) or
    // the browser wants a fresh gesture, which `restore` supplies from a click.
  }
}

export function useInterviewLock(onBreak?: (reason: InterviewLockBreak) => void) {
  const [locked, setLocked] = useState(false);
  const [breakReason, setBreakReason] = useState<InterviewLockBreak | null>(null);
  // iPhone Safari has no element fullscreen at all. The lock has to tell that
  // apart from "the candidate pressed Esc", otherwise the overlay's only button
  // can never succeed and the interview is a dead end.
  const [fullscreenSupported, setFullscreenSupported] = useState(true);

  const lockedRef = useRef(false);
  const breakRef = useRef<InterviewLockBreak | null>(null);
  const awayRef = useRef(false);
  const onBreakRef = useRef(onBreak);

  useEffect(() => {
    onBreakRef.current = onBreak;
  }, [onBreak]);

  useEffect(() => {
    setFullscreenSupported(document.fullscreenEnabled !== false);
  }, []);

  // The first break wins, so a tab switch that also blurs the window is only
  // ever reported — and only ever charged — once.
  const report = useCallback((reason: InterviewLockBreak) => {
    if (!lockedRef.current || breakRef.current) return;
    breakRef.current = reason;
    setBreakReason(reason);
    onBreakRef.current?.(reason);
  }, []);

  const clearBreak = useCallback(() => {
    if (!breakRef.current) return;
    breakRef.current = null;
    setBreakReason(null);
  }, []);

  const enter = useCallback(() => {
    lockedRef.current = true;
    setLocked(true);
    void enterFullscreen();
  }, []);

  // Bound to the overlay's button, so the re-request happens inside a real click.
  // The overlay deliberately stays up until `fullscreenchange` confirms the
  // re-entry, rather than being dismissed on the click that only asked for it.
  const restore = useCallback(() => {
    if (document.fullscreenEnabled === false) {
      clearBreak();
      return;
    }
    void enterFullscreen();
  }, [clearBreak]);

  const release = useCallback(() => {
    lockedRef.current = false;
    breakRef.current = null;
    setLocked(false);
    setBreakReason(null);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }, []);

  useEffect(() => {
    if (!locked) return;

    const onFullscreenChange = () => {
      if (document.fullscreenElement) {
        clearBreak();
        return;
      }
      // Esc, F11 or a browser chrome button dropped out of fullscreen. Nothing
      // tries to undo it: a deliberate exit is not a glitch to recover from, so
      // the caller ends the interview rather than yanking the candidate back.
      report("fullscreen");
    };

    // Hidden is where the candidate actually goes, so the break is raised on the
    // way back in — there is no way to draw an overlay on a tab nobody can see.
    const onVisibilityChange = () => {
      if (!document.hidden) report("tab");
    };

    const onBlur = () => {
      awayRef.current = true;
    };

    // Focus returning after a blur means another window, app or the browser's own
    // chrome took over — a screen change rather than a tab change.
    const onFocus = () => {
      if (!awayRef.current) return;
      awayRef.current = false;
      report("window");
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);

    if (document.hidden) report("tab");

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, [locked, report, clearBreak]);

  // Fullscreen is taken on `documentElement`, which React never unmounts, so
  // without this a route change would strand the candidate in a fullscreen page
  // with the app behind it.
  useEffect(() => {
    return () => {
      if (lockedRef.current && document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  return { locked, breakReason, fullscreenSupported, enter, restore, release };
}
