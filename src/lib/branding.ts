const COLLEGE_STORAGE = "tb.college.name";

let cachedCollege: string | null | undefined;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function getCollegeName(): string | null {
  if (cachedCollege !== undefined) return cachedCollege;
  if (typeof window === "undefined") return null;
  try {
    cachedCollege = window.localStorage.getItem(COLLEGE_STORAGE);
  } catch {
    cachedCollege = null;
  }
  return cachedCollege;
}

export function setCollegeName(name: string | null | undefined): void {
  const normalized = name?.trim() || null;
  cachedCollege = normalized;
  if (typeof window !== "undefined") {
    try {
      if (normalized) {
        window.localStorage.setItem(COLLEGE_STORAGE, normalized);
      } else {
        window.localStorage.removeItem(COLLEGE_STORAGE);
      }
    } catch {
      // storage unavailable — branding falls back to the in-memory value
    }
  }
  refreshPageTitle();
}

function stripExistingSuffix(title: string, college: string): string {
  return title
    .replace(new RegExp(`\\s*\\|\\s*${escapeRegExp(college)}\\s*$`), "")
    .replace(/\s*\|\s*$/, "")
    .trim();
}

export function brandedTitle(base: string): string {
  const college = getCollegeName();
  if (!college) return base;
  const stripped = stripExistingSuffix(base, college);
  return stripped ? `${stripped} | ${college}` : base;
}

export function refreshPageTitle(): void {
  if (typeof document === "undefined") return;
  // Only write when the title actually changes. Assigning the same string still
  // mutates the <title> text node, which re-fires the root MutationObserver;
  // an unconditional write would loop forever and freeze the tab.
  const next = brandedTitle(document.title);
  if (next !== document.title) {
    document.title = next;
  }
}
