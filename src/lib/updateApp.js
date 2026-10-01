/**
 * FEED-PWA-UPDATE-1 — Update app sequence (Cloudflare Pages / static PWA):
 * 1. Caller shows status "Checking…"
 * 2. getRegistration() — none → muted "No updater available" / stop
 * 3. await reg.update()
 * 4. If reg.waiting OR installing (updatefound):
 *    - postMessage { type: 'SKIP_WAITING' } to waiting/installing (Workbox convention)
 *    - await controllerchange (or activated)
 *    - caches.keys() → delete all
 *    - status "Updating…" → location.reload()
 * 5. Else → "Up to date"
 * 6. Errors → "Couldn't check for updates"; leave app running
 * Do not unregister(). Coordinate with vite-plugin-pwa skipWaiting + clientsClaim.
 */

const SESSION_UPDATED_KEY = "captain-feed-pwa-updated";

let inFlight = null;

/**
 * @param {(msg: string) => void} [onStatus]
 * @returns {Promise<"updated" | "up-to-date" | "no-sw" | "error">}
 */
export function checkAndApplyAppUpdate(onStatus) {
  if (inFlight) return inFlight;
  inFlight = runUpdate(onStatus).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

export function isUpdateInFlight() {
  return Boolean(inFlight);
}

/** One-shot after reload: returns true once if we just applied an update. */
export function consumeUpdatedFlag() {
  try {
    if (sessionStorage.getItem(SESSION_UPDATED_KEY) === "1") {
      sessionStorage.removeItem(SESSION_UPDATED_KEY);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

function setUpdatedFlag() {
  try {
    sessionStorage.setItem(SESSION_UPDATED_KEY, "1");
  } catch {
    /* ignore */
  }
}

function postSkipWaiting(worker) {
  if (!worker) return;
  try {
    worker.postMessage({ type: "SKIP_WAITING" });
  } catch {
    /* ignore */
  }
}

function waitForControllerChange(timeoutMs = 8000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onChange);
      clearTimeout(timer);
      resolve();
    };
    const onChange = () => finish();
    const timer = setTimeout(finish, timeoutMs);
    navigator.serviceWorker.addEventListener("controllerchange", onChange);
  });
}

function waitForWorker(worker, timeoutMs = 8000) {
  if (!worker) return Promise.resolve();
  if (worker.state === "activated" || worker.state === "redundant") {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      worker.removeEventListener("statechange", onState);
      resolve();
    }, timeoutMs);
    const onState = () => {
      if (worker.state === "activated" || worker.state === "redundant") {
        clearTimeout(timer);
        worker.removeEventListener("statechange", onState);
        resolve();
      }
    };
    worker.addEventListener("statechange", onState);
  });
}

async function clearAllCaches() {
  if (!("caches" in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.map((k) => caches.delete(k)));
}

async function applyWaitingOrInstalling(reg, onStatus) {
  const worker = reg.waiting || reg.installing;
  if (!worker) return false;

  postSkipWaiting(worker);
  await Promise.race([
    waitForControllerChange(),
    waitForWorker(worker),
  ]);
  await clearAllCaches();
  setUpdatedFlag();
  onStatus?.("Updating…");
  location.reload();
  return true;
}

async function runUpdate(onStatus) {
  onStatus?.("Checking…");

  if (!("serviceWorker" in navigator)) {
    onStatus?.("No updater available");
    return "no-sw";
  }

  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      onStatus?.("No updater available");
      return "no-sw";
    }

    const controllerBefore = navigator.serviceWorker.controller;

    // Race updatefound during/after update() so a brand-new installing worker is caught
    let installingResolve;
    const installingPromise = new Promise((resolve) => {
      installingResolve = resolve;
    });
    const onUpdateFound = () => {
      if (reg.installing) installingResolve(reg.installing);
    };
    reg.addEventListener("updatefound", onUpdateFound);

    try {
      await reg.update();
    } finally {
      // Allow a brief tick for updatefound to fire after update() resolves
      await new Promise((r) => setTimeout(r, 50));
      reg.removeEventListener("updatefound", onUpdateFound);
    }

    if (reg.waiting || reg.installing) {
      const applied = await applyWaitingOrInstalling(reg, onStatus);
      if (applied) return "updated";
    }

    // If updatefound already delivered an installing worker concurrently
    const raced = await Promise.race([
      installingPromise,
      new Promise((r) => setTimeout(() => r(null), 100)),
    ]);
    if (raced || reg.waiting || reg.installing) {
      const applied = await applyWaitingOrInstalling(reg, onStatus);
      if (applied) return "updated";
    }

    if (navigator.serviceWorker.controller === controllerBefore) {
      onStatus?.("Up to date");
      return "up-to-date";
    }

    // Controller already swapped (skipWaiting:true path) — still clear + reload
    await clearAllCaches();
    setUpdatedFlag();
    onStatus?.("Updating…");
    location.reload();
    return "updated";
  } catch {
    onStatus?.("Couldn't check for updates");
    return "error";
  }
}

/** True when a service worker registration can drive updates. */
export async function hasServiceWorkerRegistration() {
  if (!("serviceWorker" in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    return Boolean(reg);
  } catch {
    return false;
  }
}
