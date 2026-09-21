import test from "node:test";
import assert from "node:assert/strict";
import {
  isStandaloneDisplayMode,
  isInstallChromeSuppressed,
  shouldShowInstallButton,
  shouldShowInstallHint,
  readInstallDismissed,
  writeInstallDismissed,
  markPwaInstalled,
  syncStandaloneDomFlag,
  INSTALL_DISMISS_KEY,
  PWA_INSTALLED_KEY,
} from "./installGate.js";

test("standalone display modes count as installed chrome", () => {
  const mm = (q) => ({ matches: q.includes("standalone") });
  assert.equal(isStandaloneDisplayMode(mm, {}, null, ""), true);
  assert.equal(isStandaloneDisplayMode(() => ({ matches: false }), { standalone: true }, null, ""), true);
  assert.equal(isStandaloneDisplayMode(() => ({ matches: false }), {}, null, ""), false);
});

test("window-controls-overlay counts as installed", () => {
  const mm = (q) => ({ matches: q.includes("window-controls-overlay") });
  assert.equal(isStandaloneDisplayMode(mm, {}, null, ""), true);
});

test("sticky pwa-installed flag counts as installed", () => {
  const store = new Map();
  const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
  };
  assert.equal(isStandaloneDisplayMode(() => ({ matches: false }), {}, storage, ""), false);
  markPwaInstalled(storage);
  assert.equal(storage.getItem(PWA_INSTALLED_KEY), "1");
  assert.equal(isStandaloneDisplayMode(() => ({ matches: false }), {}, storage, ""), true);
});

test("android-app referrer counts as installed", () => {
  assert.equal(
    isStandaloneDisplayMode(() => ({ matches: false }), {}, null, "android-app://com.android.chrome"),
    true,
  );
});

test("suppress when standalone or dismissed", () => {
  const store = new Map();
  const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
  };
  assert.equal(isInstallChromeSuppressed(() => ({ matches: false }), {}, storage, ""), false);
  writeInstallDismissed(storage);
  assert.equal(isInstallChromeSuppressed(() => ({ matches: false }), {}, storage, ""), true);
});

test("button only when BIP and not installed", () => {
  assert.equal(shouldShowInstallButton({ bipAvailable: true, isInstalled: false }), true);
  assert.equal(shouldShowInstallButton({ bipAvailable: true, isInstalled: true }), false);
  assert.equal(shouldShowInstallButton({ bipAvailable: false, isInstalled: false }), false);
});

test("hint only when not installed and no BIP", () => {
  assert.equal(shouldShowInstallHint({ bipAvailable: false, isInstalled: false }), true);
  assert.equal(shouldShowInstallHint({ bipAvailable: true, isInstalled: false }), false);
  assert.equal(shouldShowInstallHint({ bipAvailable: false, isInstalled: true }), false);
});

test("syncStandaloneDomFlag toggles data-standalone", () => {
  const attrs = new Map();
  const root = {
    setAttribute: (k, v) => attrs.set(k, v),
    removeAttribute: (k) => attrs.delete(k),
  };
  syncStandaloneDomFlag(root, true);
  assert.equal(attrs.get("data-standalone"), "1");
  syncStandaloneDomFlag(root, false);
  assert.equal(attrs.has("data-standalone"), false);
});

test("dismiss key round-trip", () => {
  const store = new Map();
  const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
  };
  assert.equal(readInstallDismissed(storage), false);
  writeInstallDismissed(storage);
  assert.equal(storage.getItem(INSTALL_DISMISS_KEY), "1");
  assert.equal(readInstallDismissed(storage), true);
});

test("isInstallChromeSuppressed() with no args still detects standalone", () => {
  // Simulate browser globals for node test
  globalThis.window = globalThis.window || {};
  globalThis.window.matchMedia = (q) => ({ matches: String(q).includes("standalone") });
  globalThis.navigator = { standalone: false };
  globalThis.document = { referrer: "" };
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
  };
  assert.equal(isInstallChromeSuppressed(), true);
});
