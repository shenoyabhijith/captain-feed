/** Dismiss tip in a normal browser tab */
export const INSTALL_DISMISS_KEY = "cf-install-dismissed";
/** Sticky flag after appinstalled / confirmed standalone session */
export const PWA_INSTALLED_KEY = "cf-pwa-installed";

const DISPLAY_QUERIES = [
  "(display-mode: standalone)",
  "(display-mode: fullscreen)",
  "(display-mode: minimal-ui)",
  "(display-mode: window-controls-overlay)",
];

/**
 * True when running as installed PWA chrome (or sticky installed flag / iOS standalone).
 * @param {(query: string) => { matches: boolean }} [matchMedia]
 * @param {{ standalone?: boolean }} [nav]
 * @param {Storage | null} [storage]
 * @param {string} [referrer]
 */
export function isStandaloneDisplayMode(
  matchMedia = (...args) => window.matchMedia(...args),
  nav = typeof navigator !== "undefined" ? navigator : {},
  storage = typeof localStorage !== "undefined" ? localStorage : null,
  referrer = typeof document !== "undefined" ? document.referrer : "",
) {
  try {
    for (const q of DISPLAY_QUERIES) {
      if (matchMedia(q).matches) return true;
    }
  } catch {
    /* ignore */
  }
  if (nav.standalone === true) return true;
  try {
    if (referrer && referrer.startsWith("android-app://")) return true;
  } catch {
    /* ignore */
  }
  try {
    if (storage?.getItem(PWA_INSTALLED_KEY) === "1") return true;
  } catch {
    /* ignore */
  }
  return false;
}

/** Whether install chrome should stay hidden (standalone OR user dismiss). */
export function isInstallChromeSuppressed(
  matchMedia = (...args) => window.matchMedia(...args),
  nav = typeof navigator !== "undefined" ? navigator : {},
  storage = typeof localStorage !== "undefined" ? localStorage : null,
  referrer = typeof document !== "undefined" ? document.referrer : "",
) {
  return (
    isStandaloneDisplayMode(matchMedia, nav, storage, referrer) ||
    readInstallDismissed(storage)
  );
}

export function shouldShowInstallButton({ bipAvailable, isInstalled }) {
  return Boolean(bipAvailable) && !isInstalled;
}

export function shouldShowInstallHint({ bipAvailable, isInstalled }) {
  return !isInstalled && !bipAvailable;
}

export function readInstallDismissed(storage = typeof localStorage !== "undefined" ? localStorage : null) {
  try {
    const keys = [INSTALL_DISMISS_KEY, "cf-install-dismissed"];
    return keys.some((k) => storage?.getItem(k) === "1");
  } catch {
    return false;
  }
}

export function writeInstallDismissed(storage = typeof localStorage !== "undefined" ? localStorage : null) {
  try {
    storage?.setItem(INSTALL_DISMISS_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function markPwaInstalled(storage = typeof localStorage !== "undefined" ? localStorage : null) {
  try {
    storage?.setItem(PWA_INSTALLED_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** Sync html[data-standalone] for CSS belt-and-suspenders. */
export function syncStandaloneDomFlag(
  root = typeof document !== "undefined" ? document.documentElement : null,
  installed = false,
) {
  if (!root) return;
  if (installed) root.setAttribute("data-standalone", "1");
  else root.removeAttribute("data-standalone");
}

/** Subscribe to display-mode changes (modern + legacy Chrome). */
export function subscribeDisplayMode(onChange, matchMedia = (...args) => window.matchMedia(...args)) {
  const medias = DISPLAY_QUERIES.map((q) => {
    try {
      return matchMedia(q);
    } catch {
      return null;
    }
  }).filter(Boolean);

  const handler = () => onChange();
  for (const m of medias) {
    if (typeof m.addEventListener === "function") m.addEventListener("change", handler);
    else if (typeof m.addListener === "function") m.addListener(handler);
  }
  return () => {
    for (const m of medias) {
      if (typeof m.removeEventListener === "function") m.removeEventListener("change", handler);
      else if (typeof m.removeListener === "function") m.removeListener(handler);
    }
  };
}
