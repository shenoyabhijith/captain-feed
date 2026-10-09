#!/usr/bin/env node
// EOD mark-to-market (PAPER ONLY). Runs after the close (4:34 PM CT schedule).
// Stamps real Yahoo closes, appends equity + markHistory, and records daily P&L
// per trader. It makes NO trades: all trading now happens in research-driven
// market-watch checks via scripts/paper-order.mjs.
// Usage: node scripts/eod-mark.mjs [--date YYYY-MM-DD] [--dry]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ALLOWLIST, appendMarkHistory, sleeveNav, portfolioStats } from "../src/finances/simEngine.js";
import { dailyHistory } from "./lib/market.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LEDGERS = ["data/finances-ledger.json", "docs/data/finances-ledger.json"].map((p) => path.join(root, p)).filter((p) => fs.existsSync(p));
const args = process.argv.slice(2);
const dry = args.includes("--dry");
const di = args.indexOf("--date");
const wantDate = di >= 0 ? args[di + 1] : null;
const r2 = (n) => Math.round(n * 100) / 100;

const ledger = JSON.parse(fs.readFileSync(LEDGERS[0], "utf8"));
const held = new Set(ledger.sleeves.flatMap((s) => (s.positions || []).map((p) => p.symbol)));
const symbols = [...new Set([...ALLOWLIST, ...held])];
const series = {};
for (const s of symbols) series[s] = Object.fromEntries((await dailyHistory(s, "1mo")).rows.map((r) => [r.date, r.close]));

const etToday = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
const nowEt = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
const common = Object.keys(series.VOO).filter((d) => symbols.every((s) => series[s][d] != null)).sort();
const usable = common.filter((d) => d < etToday || nowEt.getHours() >= 16);
const date = wantDate || usable[usable.length - 1];
if (!date || !common.includes(date)) throw new Error(`No complete EOD closes for ${date}`);
const marks = Object.fromEntries(symbols.map((s) => [s, series[s][date]]));
const runId = `eod-${date.replaceAll("-", "")}`;
if (ledger.ops?.lastEodId === runId && !args.includes("--force")) { console.log(`Already marked ${runId}.`); process.exit(0); }

const prevMarks = ledger.marks || {};
const daily = [...(ledger.daily || [])].filter((d) => d.date !== date);
const prevDay = daily[daily.length - 1];
const perTrader = {};
for (const s of ledger.sleeves) {
  const nav = sleeveNav(s, marks);
  const prevNav = prevDay?.perTrader?.[s.id]?.nav ?? sleeveNav(s, prevMarks);
  const fills = (ledger.decisions || []).filter((d) => d.agentId === s.id && d.tradeDate === date && d.paper);
  perTrader[s.id] = {
    nav, pnl: r2(nav - prevNav), pnlPct: prevNav ? r2(((nav - prevNav) / prevNav) * 100) : 0,
    fills: fills.length, fees: r2(fills.reduce((t, d) => t + (d.fees?.total || 0), 0)),
  };
}
const totalNav = r2(Object.values(perTrader).reduce((t, x) => t + x.nav, 0));
daily.push({ date, nav: totalNav, pnl: r2(Object.values(perTrader).reduce((t, x) => t + x.pnl, 0)), perTrader, runId });

const equity = [...(ledger.equity || [])].filter((e) => e.date !== date);
equity.push({ date, nav: totalNav });
equity.sort((a, b) => a.date.localeCompare(b.date));

const asOf = `${date}T16:00:00-04:00`;
const next = {
  ...ledger,
  marks,
  markHistory: appendMarkHistory(ledger.markHistory, date, marks),
  equity,
  daily: daily.slice(-400),
  meta: { ...ledger.meta, asOf, marksAsOf: asOf, priceSource: "yahoo", paperOnly: true },
  ops: { ...ledger.ops, lastEodId: runId, lastRunId: runId, notes: "EOD mark-to-market only; trades happen in research-driven market-watch checks." },
};
console.log(`${runId}: total NAV $${totalNav}`);
for (const [id, x] of Object.entries(perTrader)) console.log(`  ${id.padEnd(8)} nav $${x.nav}  day ${x.pnl >= 0 ? "+" : ""}${x.pnl} (${x.pnlPct}%)  fills ${x.fills}  fees $${x.fees}`);
console.log("portfolio:", portfolioStats(next));
if (dry) { console.log("(dry run, ledger not written)"); process.exit(0); }
for (const p of LEDGERS) fs.writeFileSync(p, JSON.stringify(next, null, 2) + "\n");
console.log("wrote", LEDGERS.map((p) => path.relative(root, p)).join(", "));
