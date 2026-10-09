// Regression: a card swiped away (read / saved) or opened from the deck must never
// come back into the swipe deck, on any tab, after reload, refresh, or app update.
import { test, expect } from "@playwright/test";

const TOP = ".deck-slot.is-top .deck-card";

async function freshStart(page) {
  await page.goto("./");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("captain-feed-theme", "light");
  });
  await page.reload();
  await page.waitForSelector(TOP);
  await page.waitForTimeout(400);
}
/** Let exit animations finish so only live deck cards are in the DOM. */
async function settle(page) {
  await expect.poll(() => page.locator(TOP).count(), { timeout: 5000 }).toBeLessThan(2);
}
const topId = async (page) => {
  await settle(page);
  return page.locator(TOP).getAttribute("data-card-id", { timeout: 2000 });
};
const deckIds = async (page) => {
  await settle(page);
  await page.waitForTimeout(450);
  return page.$$eval(".deck-card[data-card-id]", (els) => els.map((e) => e.dataset.cardId));
};
const left = async (page) => Number(await page.locator(".deck-left").textContent());

async function swipe(page, dx, dy) {
  const before = await topId(page);
  const b = await page.locator(TOP).boundingBox();
  const x = b.x + b.width / 2;
  const y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 8 });
  await page.mouse.move(x + dx, y + dy, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => topId(page).catch(() => null)).not.toBe(before);
  return before;
}

/** Real touch swipe via CDP (what the phone PWA sends). */
async function touchSwipe(page, dx, dy) {
  const before = await topId(page);
  const b = await page.locator(TOP).boundingBox();
  const x = b.x + b.width / 2;
  const y = b.y + b.height / 2;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let i = 1; i <= 12; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + (dx * i) / 12, y: y + (dy * i) / 12 }],
    });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => topId(page).catch(() => null)).not.toBe(before);
  return before;
}

async function expectNoneInDeck(page, ids, label) {
  await page.waitForTimeout(300);
  const now = await deckIds(page);
  expect(now.filter((id) => ids.includes(id)), label).toEqual([]);
}

async function dock(page, name) {
  await page.getByRole("button", { name: new RegExp(`^${name}$`, "i") }).first().click();
  await page.waitForTimeout(400);
}

test("swiped cards (left, right, up, touch) never return: reload, reopen, tabs, refresh, SW", async ({ page, context }) => {
  await freshStart(page);
  const total = await left(page);
  const gone = [];
  gone.push(await swipe(page, 260, 8));
  gone.push(await swipe(page, -260, 8));
  gone.push(await swipe(page, 0, -320));
  gone.push(await touchSwipe(page, 250, 5));
  gone.push(await touchSwipe(page, -250, 5));
  expect(await left(page)).toBe(total - gone.length);
  await expectNoneInDeck(page, gone, "after swipes");

  await page.reload();
  await page.waitForSelector(TOP);
  await expectNoneInDeck(page, gone, "after reload");

  // Reopen the app: new page in the same profile (same localStorage + SW).
  const again = await context.newPage();
  await page.close();
  await again.goto("./");
  await again.waitForSelector(TOP);
  await expectNoneInDeck(again, gone, "after reopen");

  for (const tab of ["All", "Saved", "Unread", "All"]) {
    await dock(again, tab);
    await expectNoneInDeck(again, gone, `tab ${tab}`);
  }

  // Background feed refresh (menu → Refresh feed) re-fetches feed.json.
  await again.getByRole("button", { name: /more actions/i }).first().click();
  await again.getByText(/Refresh feed/i).first().click();
  await again.waitForTimeout(800);
  await expectNoneInDeck(again, gone, "after feed refresh");

  // Service worker takes control → reload under SW.
  await again.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 15_000 }).catch(() => {});
  await again.reload();
  await again.waitForSelector(TOP);
  await expectNoneInDeck(again, gone, "after SW-controlled reload");
  expect(await left(again)).toBe(total - gone.length);
});

test("a card opened from the deck is dismissed when you come back", async ({ page }) => {
  await freshStart(page);
  const total = await left(page);
  const opened = await topId(page);
  await page.locator(TOP).click();
  await expect(page).toHaveURL(/#\/card\//);
  await page.getByRole("link", { name: /back/i }).first().click();
  await page.waitForSelector(TOP);
  await expectNoneInDeck(page, [opened], "after open + back");
  expect(await left(page)).toBe(total - 1);

  await page.reload();
  await page.waitForSelector(TOP);
  await expectNoneInDeck(page, [opened], "after open + reload");
});

test("Up next never points at a read card and never loops", async ({ page }) => {
  await freshStart(page);
  // Everything read except the first card (seeded through the same prefs the app persists).
  const ids = await page.evaluate(async () => {
    const r = await fetch("data/feed.json", { cache: "no-store" });
    return (await r.json()).cards.map((c) => c.id);
  });
  await page.evaluate((ids) => {
    const read = Object.fromEntries(ids.slice(1).map((id) => [id, 1]));
    localStorage.setItem("captain-feed-v2", JSON.stringify({ seen: {}, saved: {}, read }));
  }, ids);
  await page.reload();
  await page.waitForSelector(TOP);
  expect(await deckIds(page)).toEqual([ids[0]]);
  await page.locator(TOP).click();
  await expect(page).toHaveURL(/#\/card\//);
  await page.waitForTimeout(500);
  const hrefs = await page.$$eval("a.up-next", (as) => as.map((a) => a.getAttribute("href")));
  expect(hrefs, "no Up next once everything else is read").toEqual([]);
});

test("deck never loops: caught-up when empty, survives reload; Saved lists saved", async ({ page }) => {
  await freshStart(page);
  const total = await left(page);
  const saved = await swipe(page, 0, -320);
  for (let i = 0; i < total - 1; i++) {
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(40);
  }
  await expect(page.getByText(/caught up/i).first()).toBeVisible();
  expect(await deckIds(page)).toEqual([]);
  await page.reload();
  await expect(page.getByText(/caught up/i).first()).toBeVisible();
  expect(await deckIds(page)).toEqual([]);
  await dock(page, "All");
  expect(await deckIds(page)).toEqual([]);
  await dock(page, "Saved");
  await expect(page.locator(`[href$="/card/${encodeURIComponent(saved)}"]`).first()).toBeVisible();
});

test("undo restores only the last swipe, only within the session", async ({ page }) => {
  await freshStart(page);
  const a = await swipe(page, 260, 8);
  const b = await swipe(page, -260, 8);
  await page.getByRole("button", { name: /undo last swipe/i }).click();
  await expect.poll(() => topId(page)).toBe(b);
  // Only one level of undo.
  await expect(page.getByRole("button", { name: /undo last swipe/i })).toBeDisabled();
  await expectNoneInDeck(page, [a], "a stays dismissed");
  await page.waitForTimeout(1200); // let the undone card spring back in
  expect(await swipe(page, 260, 8)).toBe(b);
  await page.reload();
  await page.waitForSelector(TOP);
  await expect(page.getByRole("button", { name: /undo last swipe/i })).toBeDisabled();
  await expectNoneInDeck(page, [a, b], "after reload");
});

test("a stale second window can't resurrect cards dismissed in another", async ({ page, context }) => {
  await freshStart(page);
  const other = await context.newPage();
  await other.goto("./");
  await other.waitForSelector(TOP);
  await other.waitForTimeout(400);
  const a1 = await swipe(page, 260, 8); // dismissed in window 1
  const a2 = await swipe(page, 260, 8);
  await other.waitForTimeout(300);
  const b = await swipe(other, -260, 8); // window 2 swipes after (would overwrite with stale prefs)
  await page.reload();
  await page.waitForSelector(TOP);
  await expectNoneInDeck(page, [a1, a2, b], "all dismissals survive");
});
