import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

export const THEME_STORAGE = "tb.theme";

export function getInitialTheme(): Theme {
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

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

export function persistTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE, theme);
  } catch {
    // ignore storage errors
  }
}

/**
 * The same theme decision, as a synchronous string for the document head.
 *
 * `useTheme` can only apply the class from an effect, which is after the first
 * paint, and it only runs on pages that mount a toggle. That left the marketing
 * home page and the downtime screen — neither of which has a toggle, because a
 * page a visitor may only see once is not a place to put a preference — with no
 * `.dark` class at all and a full light-theme paint on every load.
 *
 * Inlined in `<head>` this runs before the body exists, so the first paint is
 * already the right theme and there is no flash to correct. It deliberately
 * duplicates the logic above rather than importing anything: a module reference
 * would not survive serialisation into the markup. If one changes, change both.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE)},s=localStorage.getItem(k),t=s==="dark"||s==="light"?s:(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"),e=document.documentElement;e.classList.toggle("dark",t==="dark");e.style.colorScheme=t}catch(_){}})();`;

export function useTheme(): { theme: Theme; toggle: () => void; setTheme: (t: Theme) => void } {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
    persistTheme(theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  return { theme, toggle, setTheme };
}
