#!/usr/bin/env node
// Capture a clean above-the-fold screenshot of a non-X source (article, blog, repo,
// SEC filing, chart) for a post section's `screenshots[]`.
// Uses capture-website (maintained, Puppeteer-based) for the browser work: ad/cookie
// blocking, element hiding, WebP output. We only add a selector list and the feed wiring.
//
//   node scripts/capture-source.mjs <url> [<url> ...]
//       -> prints [{ url, image, title, capturedAt }] (image is relative to the app base)
//   node scripts/capture-source.mjs <url> --card <card-id> --section <index|heading>
//       -> also appends to that section's `screenshots` in data/feed.json (dedupes by url)
//
// Files: public/media/sources/<sha1(url) first 16>.webp, 1200x800 viewport at 1x, WebP q72
// (re-encoded lower if > 150 KB). Never use this for x.com / twitter.com: X posts are tweet cards.
// Env: CHROME_PATH (default /usr/bin/google-chrome), PUPPETEER_SKIP_DOWNLOAD=1 when installing.
import captureWebsite from "capture-website";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "public/media/sources");
const FEED = join(ROOT, "data/feed.json");
const MAX_BYTES = 150 * 1024;

// Common consent / newsletter / chat overlays. capture-website hides these before the shot.
const HIDE = [
  "#onetrust-consent-sdk", "#onetrust-banner-sdk", "#CybotCookiebotDialog", ".cc-window", ".cookie-banner",
  "#cookie-banner", ".cookie-consent", "#cookie-consent", "[id*='cookie-notice']", "[class*='cookie-notice']",
  "[id^='sp_message_container']", ".fc-consent-root", "#didomi-host", ".qc-cmp2-container", "#usercentrics-root",
  "[aria-label*='cookie' i][role='dialog']", "[class*='newsletter-popup']", "#intercom-container", ".intercom-lightweight-app",
  ".substack-modal", "[data-testid='modal']",
];

function parseArgs(argv) {
  const urls = []; const opt = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--card") opt.card = argv[++i];
    else if (a === "--section") opt.section = argv[++i];
    else if (a === "--help" || a === "-h") opt.help = true;
    else urls.push(a);
  }
  return { urls, opt };
}

export async function captureSource(url) {
  const host = new URL(url).hostname.replace(/^www\./, "");
  if (/(^|\.)(x|twitter)\.com$/.test(host)) throw new Error(`${url}: X posts use tweet cards, not screenshots`);
  const hash = createHash("sha1").update(url).digest("hex").slice(0, 16);
  const rel = `media/sources/${hash}.webp`;
  let title = "";
  const base = {
    width: 1200, height: 800, scaleFactor: 1, type: "webp",
    blockAds: true, hideElements: HIDE, disableAnimations: true, delay: 1, timeout: 45,
    launchOptions: { executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome", args: ["--no-sandbox"] },
    beforeScreenshot: async (page) => { title = (await page.title().catch(() => "")) || ""; },
  };
  let buf;
  for (const quality of [0.72, 0.55, 0.4]) {
    buf = await captureWebsite.buffer(url, { ...base, quality });
    if (buf.length <= MAX_BYTES) break;
  }
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(ROOT, "public", rel), buf);
  title = title.replace(/^GitHub - /, "").replace(/ · GitHub$/, "");
  return { url, image: rel, title: title.trim().replace(/\s+/g, " ").slice(0, 140) || host, capturedAt: new Date().toISOString(), bytes: buf.length };
}

function attach(cardId, sectionKey, shots) {
  const feed = JSON.parse(readFileSync(FEED, "utf8"));
  const card = feed.cards.find((c) => c.id === cardId);
  if (!card) throw new Error(`card not found: ${cardId}`);
  const secs = card.detail?.sections || [];
  const sec = /^\d+$/.test(String(sectionKey)) ? secs[Number(sectionKey)] : secs.find((s) => s.heading === sectionKey);
  if (!sec) throw new Error(`section not found: ${sectionKey}`);
  const list = (sec.screenshots ||= []);
  for (const { bytes, ...s } of shots) {
    const i = list.findIndex((x) => x.url === s.url);
    if (i >= 0) list[i] = s; else list.push(s);
  }
  writeFileSync(FEED, JSON.stringify(feed, null, 2) + "\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { urls, opt } = parseArgs(process.argv.slice(2));
  if (opt.help || !urls.length) {
    console.log("usage: node scripts/capture-source.mjs <url> [...] [--card <id> --section <index|heading>]");
    process.exit(urls.length ? 0 : 1);
  }
  const shots = [];
  for (const u of urls) {
    try { const s = await captureSource(u); shots.push(s); console.error(`ok ${u} -> ${s.image} (${Math.round(s.bytes / 1024)} KB)`); }
    catch (e) { console.error(`fail ${u}: ${e.message}`); process.exitCode = 1; }
  }
  if (opt.card && shots.length) { attach(opt.card, opt.section ?? 0, shots); console.error(`attached ${shots.length} to ${opt.card} section ${opt.section}`); }
  console.log(JSON.stringify(shots.map(({ bytes, ...s }) => s), null, 2));
}
