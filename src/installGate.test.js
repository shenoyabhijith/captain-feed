import test from "node:test";
import assert from "node:assert/strict";
import {
  isStandaloneDisplayMode,
  shouldShowInstallButton,
  shouldShowInstallHint,
  readInstallDismissed,
  writeInstallDismissed,
  INSTALL_DISMISS_KEY,
} from "./installGate.js";

test("standalone display modes count as installed chrome", () => {
  const mm = (q) => ({ matches: q.includes("standalone") });
  assert.equal(isStandaloneDisplayMode(mm, {}), true);
  assert.equal(isStandaloneDisplayMode(() => ({ matches: false }), { standalone: true }), true);
  assert.equal(isStandaloneDisplayMode(() => ({ matches: false }), {}), false);
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

test("button and hint are mutually exclusive", () => {
  for (const bip of [true, false]) {
    for (const inst of [true, false]) {
      const b = shouldShowInstallButton({ bipAvailable: bip, isInstalled: inst });
      const h = shouldShowInstallHint({ bipAvailable: bip, isInstalled: inst });
      assert.equal(b && h, false);
    }
  }
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
