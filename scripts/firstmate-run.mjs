#!/usr/bin/env node
// Firstmate Run (PAPER ONLY): stamp real EOD marks from Yahoo's public chart
// endpoint, run the deterministic sim engine, and write the checked-in ledger.
// Usage: node scripts/firstmate-run.mjs [--date YYYY-MM-DD] [--dry]
// No brokerage, no orders: marks are only used to price paper fills/MTM.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ALLOWLIST, runToday, portfolioStats } from "../src/finances/simEngine.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LEDGERS = ["data/finances-ledger.json", "docs/data/finances-ledger.json"]
  .map((p) => path.join(root, p))
  .filter((p) => fs.existsSync(p));
const args = process.argv.slice(2);
const dry = args.includes("--dry");
const di = args.indexOf("--date");
const wantDate = di >= 0 ? args[di + 1] : null;

function chicagoDate(tsSec) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" })
    .format(new Date(tsSec * 1000));
}

async function closes(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1mo&interval=1d`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`${symbol}: HTTP ${res.status}`);
  const r = (await res.json())?.chart?.result?.[0];
  if (!r?.timestamp) throw new Error(`${symbol}: no chart data`);
  const q = r.indicators.quote[0].close;
  const out = {};
  r.timestamp.forEach((t, i) => { if (q[i] != null) out[chicagoDate(t)] = Math.round(q[i] * 100) / 100; });
  return out;
}

const series = {};
for (const sym of ALLOWLIST) series[sym] = await closes(sym);
// Session = requested date, else latest date every symbol has a close for.
const common = Object.keys(series.VOO).filter((d) => ALLOWLIST.every((s) => series[s][d] != null)).sort();
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
// Skip today's still-open session (no final close yet before ~16:00 ET).
const nowEt = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
const usable = common.filter((d) => d < today || nowEt.getHours() >= 17);
const date = wantDate || usable[usable.length - 1];
if (!date || !common.includes(date)) throw new Error(`No complete EOD marks for ${date}`);
const marks = Object.fromEntries(ALLOWLIST.map((s) => [s, series[s][date]]));

const ledger = JSON.parse(fs.readFileSync(LEDGERS[0], "utf8"));
const runId = `run-${date.replaceAll("-", "")}`;
if (ledger.ops?.lastRunId === runId) { console.log(`Already ran ${runId}; nothing to do.`); process.exit(0); }
const base = { ...ledger, marks, meta: { ...ledger.meta, priceSource: "yahoo", marksAsOf: `${date}T16:00:00-04:00` } };
const next = runToday(base, { authorizedBy: "firstmate", date, runId, asOf: `${date}T16:00:00-04:00` });
delete next._previewRunId;
const newOnes = next.decisions.filter((d) => d.runId === runId);
console.log(`${runId} marks:`, marks);
for (const d of newOnes) console.log(` ${d.agentId.padEnd(8)} ${d.side.padEnd(4)} ${d.symbol ?? ""} qty=${d.qty} $${d.notional} — ${d.reason}`);
console.log("portfolio:", portfolioStats(next));
if (dry) { console.log("(dry run, ledger not written)"); process.exit(0); }
for (const p of LEDGERS) fs.writeFileSync(p, JSON.stringify(next, null, 2) + "\n");
console.log("wrote", LEDGERS.map((p) => path.relative(root, p)).join(", "));
