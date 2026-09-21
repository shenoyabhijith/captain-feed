/** localStorage key: user dismissed install chrome in a normal browser tab */
export const INSTALL_DISMISS_KEY = "cf-install-dismissed";

/**
 * True when the page is already running as an installed PWA chrome.
 * @param {(query: string) => { matches: boolean }} [matchMedia]
 * @param {{ standalone?: boolean }} [nav]
 */
export function isStandaloneDisplayMode(
  matchMedia = (...args) => window.matchMedia(...args),
  nav = typeof navigator !== "undefined" ? navigator : {},
) {
  try {
    if (matchMedia("(display-mode: standalone)").matches) return true;
    if (matchMedia("(display-mode: fullscreen)").matches) return true;
    if (matchMedia("(display-mode: minimal-ui)").matches) return true;
  } catch {
    /* ignore */
  }
  return Boolean(nav.standalone);
}

export function shouldShowInstallButton({ bipAvailable, isInstalled }) {
  return Boolean(bipAvailable) && !isInstalled;
}

export function shouldShowInstallHint({ bipAvailable, isInstalled }) {
  return !isInstalled && !bipAvailable;
}

export function readInstallDismissed(storage = typeof localStorage !== "undefined" ? localStorage : null) {
  try {
    return storage?.getItem(INSTALL_DISMISS_KEY) === "1";
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
