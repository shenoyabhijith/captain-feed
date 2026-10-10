// Finances / Metrics / Research desk were removed (Oct 9 2026). Guard against them coming back.
import { test, expect } from "@playwright/test";

test("dock is All / Unread / Saved only", async ({ page }) => {
  await page.goto("./");
  const dock = page.locator("nav.dock");
  await expect(dock).toBeVisible();
  await expect(dock.locator("button")).toHaveCount(3);
  await expect(dock.locator("button")).toHaveText(["All", "Unread", "Saved"]);
  await expect(page.getByRole("button", { name: /finances|metrics/i })).toHaveCount(0);
});

for (const hash of ["#/finances", "#/finances/research", "#/finances/research/mega", "#/finances/admin", "#/metrics"]) {
  test(`old ${hash} link lands on the feed`, async ({ page }) => {
    await page.goto(`./${hash}`);
    await expect.poll(() => page.evaluate(() => location.hash)).toMatch(/^#\/?$/);
    await expect(page.locator("nav.dock button")).toHaveCount(3);
    await expect(page.getByText(/paper|sleeve|research desk/i)).toHaveCount(0);
  });
}

test("trading data is not served", async ({ request }) => {
  for (const f of ["data/finances-ledger.json", "data/trading-index.json"]) {
    const r = await request.get(f);
    const body = r.ok() ? await r.text() : "";
    // vite preview / Pages may fall back to the SPA shell; it must never be JSON ledger data
    expect(body.trim().startsWith("{")).toBe(false);
  }
});
