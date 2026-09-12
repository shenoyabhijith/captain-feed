const KEY = "captain-feed-v2";
const THEME_KEY = "captain-feed-theme";

export function loadPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    return {
      seen: raw.seen && typeof raw.seen === "object" ? raw.seen : {},
      saved: raw.saved && typeof raw.saved === "object" ? raw.saved : {},
      read: raw.read && typeof raw.read === "object" ? raw.read : {},
    };
  } catch {
    return { seen: {}, saved: {}, read: {} };
  }
}

export function savePrefs(prefs) {
  localStorage.setItem(KEY, JSON.stringify(prefs));
}

export function loadTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function saveTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
}
