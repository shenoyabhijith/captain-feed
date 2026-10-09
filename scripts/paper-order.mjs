#!/usr/bin/env node
// Paper order executor (PAPER ONLY — never connects to a brokerage).
// Fills a market order at the latest Yahoo quote (+slippage, Schwab-style fees),
// enforces persona guardrails, and appends an attributed fill to the ledger.
//
// node scripts/paper-order.mjs --trader mega --session open --side buy --symbol MSFT \
//   --notional 12 | --qty 0.02 | --frac 0.5 (sells: fraction of position) \
//   --research 2026-10-09-mega-open --rationale "why" --confidence 0.7 \
//   [--slippage-bps 5] [--override-reason "..."] [--dry] [--allow-closed]
//
// --allow-closed only works with --dry (lets you test outside market hours).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { latestQuote, dailyHistory, indicators } from "./lib/market.mjs";
import { simulateFill, BROKER } from "./lib/broker.mjs";
import { PERSONAS, TRADING_SESSIONS, MIN_TICKET } from "./lib/personas.mjs";
import { sleeveNav } from "../src/finances/simEngine.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LEDGERS = ["data/finances-ledger.json", "docs/data/finances-ledger.json"].map((p) => path.join(root, p)).filter((p) => fs.existsSync(p));
const argv = process.argv.slice(2);
const opt = (k, d = null) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const flag = (k) => argv.includes(`--${k}`);
const r2 = (n) => Math.round(n * 100) / 100;
const r4 = (n) => Math.round(n * 10000) / 10000;
const fail = (msg) => { console.error(`REJECTED: ${msg}`); process.exit(1); };

const trader = opt("trader");
const session = opt("session");
const side = opt("side");
const symbol = (opt("symbol") || "").toUpperCase();
const researchId = opt("research");
const rationale = opt("rationale");
const confidence = Number(opt("confidence"));
const dry = flag("dry");
const slippageBps = Number(opt("slippage-bps", BROKER.defaultSlippageBps));

const p = PERSONAS[trader];
if (!p) fail(`unknown trader ${trader}`);
if (!TRADING_SESSIONS.includes(session)) fail(`session must be ${TRADING_SESSIONS.join("|")}`);
if (!p.sessions.includes(session)) fail(`${p.name} does not trade in the ${session} session (allowed: ${p.sessions.join(", ")})`);
if (!["buy", "sell"].includes(side)) fail("side must be buy|sell");
if (!p.allowlist.includes(symbol)) fail(`${symbol} not on ${p.name} allowlist (${p.allowlist.join(", ")})`);
if (!rationale || rationale.length < 20) fail("--rationale required (≥20 chars): say why, citing the research");
if (!(confidence >= 0 && confidence <= 1)) fail("--confidence must be 0..1");
if (p.minConfidence && confidence < p.minConfidence) fail(`${p.name} needs confidence ≥ ${p.minConfidence} (high-bar persona)`);
if (side === "sell" && p.noSells && !opt("override-reason")) fail(`${p.name} does not sell without --override-reason (e.g. rebalance)`);

// Research record must exist, belong to this trader/session, and be complete.
const etToday = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
if (!researchId) fail("--research <id> required: no trade without a research record");
const [rDate] = researchId.match(/^\d{4}-\d{2}-\d{2}/) || [];
const researchPath = path.join(root, "data/trading/research", rDate || "x", `${trader}-${session}.json`);
if (!fs.existsSync(researchPath)) fail(`research record not found: ${path.relative(root, researchPath)}`);
const research = JSON.parse(fs.readFileSync(researchPath, "utf8"));
if (research.id !== researchId) fail(`research id mismatch (${research.id})`);
if (!dry && rDate !== etToday) fail(`research ${researchId} is not from today's session (${etToday})`);
const types = new Set((research.sources || []).map((s) => s.type));
for (const t of ["market", "x", "web"]) if (!types.has(t)) fail(`research lacks a ${t} source`);
if (!(research.ideas || []).some((i) => i.symbol === symbol && i.status === "selected")) fail(`research has no selected idea for ${symbol}`);

const stratPath = path.join(root, "data/trading/strategies", `${trader}.json`);
const strat = fs.existsSync(stratPath) ? JSON.parse(fs.readFileSync(stratPath, "utf8")) : null;
if (!strat) fail(`no strategy doc at ${path.relative(root, stratPath)}`);

const ledger = JSON.parse(fs.readFileSync(LEDGERS[0], "utf8"));
const sleeveIdx = ledger.sleeves.findIndex((s) => s.id === trader);
if (sleeveIdx < 0) fail(`no sleeve ${trader} in ledger`);
const sleeve = structuredClone(ledger.sleeves[sleeveIdx]);
const todays = (ledger.decisions || []).filter((d) => d.agentId === trader && d.paper && d.tradeDate === etToday);
if (todays.length >= p.maxOrdersPerDay) fail(`${p.name} already has ${todays.length} order(s) today (max ${p.maxOrdersPerDay})`);

const quote = await latestQuote(symbol);
if (!quote.marketOpenNow) {
  if (!(dry && flag("allow-closed"))) fail(`market is closed for ${symbol} (regular session ${quote.session?.start} → ${quote.session?.end}); paper orders fill only during regular hours`);
}
const warnings = [];
if (quote.quoteAgeSec > 20 * 60 && quote.marketOpenNow) warnings.push(`quote is ${Math.round(quote.quoteAgeSec / 60)} min old`);

// Current marks with the live quote for this symbol, for cap math.
const marks = { ...(ledger.marks || {}), [symbol]: quote.price };
const nav = sleeveNav(sleeve, marks);
const pos = sleeve.positions.find((x) => x.symbol === symbol);

let qty;
if (side === "buy") {
  const notional = Number(opt("notional")) || (Number(opt("qty")) * quote.price);
  if (!(notional >= MIN_TICKET)) fail(`ticket must be ≥ $${MIN_TICKET}`);
  qty = r4(notional / (quote.price * (1 + slippageBps / 1e4)));
} else {
  if (!pos || !(pos.qty > 0)) fail(`no ${symbol} position to sell`);
  qty = opt("frac") ? r4(pos.qty * Number(opt("frac"))) : r4(Number(opt("qty")) || ((Number(opt("notional")) || 0) / quote.price));
  if (!(qty > 0)) fail("sell size required (--frac, --qty or --notional)");
  if (qty > pos.qty) qty = pos.qty;
}

const fill = simulateFill({ side, qty, quote: quote.price, date: etToday, slippageBps });
if (side === "sell" && fill.notional < MIN_TICKET && qty < (pos?.qty ?? 0)) fail(`sell ticket below $${MIN_TICKET}`);
if (side === "buy" && -fill.cashDelta > sleeve.cash + 1e-9) fail(`insufficient cash: need $${-fill.cashDelta}, have $${sleeve.cash}`);

// Apply to a copy, then check caps post-trade.
if (side === "buy") {
  if (pos) { const nq = pos.qty + qty; pos.avgPrice = r2((pos.avgPrice * pos.qty + fill.price * qty) / nq); pos.qty = r4(nq); }
  else sleeve.positions.push({ symbol, qty, avgPrice: fill.price });
} else {
  pos.qty = r4(pos.qty - qty);
  if (pos.qty < 0.0001) sleeve.positions = sleeve.positions.filter((x) => x.symbol !== symbol);
}
sleeve.cash = r2(sleeve.cash + fill.cashDelta);
const navAfter = sleeveNav(sleeve, marks);
const weight = (s) => { const x = sleeve.positions.find((y) => y.symbol === s); return x ? (x.qty * (marks[s] ?? x.avgPrice)) / navAfter : 0; };

if (side === "buy") {
  if (weight(symbol) > p.maxNamePct + 1e-6) fail(`${symbol} would be ${(weight(symbol) * 100).toFixed(1)}% of NAV (cap ${(p.maxNamePct * 100).toFixed(0)}%)`);
  if (p.maxSatellitePct) {
    const sat = sleeve.positions.filter((x) => !p.core.includes(x.symbol)).reduce((s, x) => s + weight(x.symbol), 0);
    if (sat > p.maxSatellitePct + 1e-6) fail(`satellite would be ${(sat * 100).toFixed(1)}% (cap ${p.maxSatellitePct * 100}%)`);
  }
  if (p.equityNeedsSpyAbove200d?.includes(symbol)) {
    const spy = indicators(await dailyHistory("SPY", "2y"));
    if (!(spy.vsSma200Pct > 0)) fail(`SPY is ${spy.vsSma200Pct}% vs 200-day; ${p.name} may not add equity below the 200-day`);
    if (weight(symbol) > p.maxEquityPct + 1e-6) fail(`${symbol} would be ${(weight(symbol) * 100).toFixed(1)}% (equity cap ${p.maxEquityPct * 100}%)`);
  }
}

const now = new Date().toISOString();
const n = (ledger.decisions || []).filter((d) => d.tradeDate === etToday && d.agentId === trader).length + 1;
const id = `o-${etToday.replaceAll("-", "")}-${trader}-${session}-${side}-${symbol}-${n}`;
const signals = [...types].map((t) => ({ source: t, org: `research ${researchId}` }));
const order = {
  // legacy fields (Finances/Metrics UI)
  id, ts: now, agentId: trader, strategy: sleeve.name, side, symbol, qty, price: fill.price,
  notional: fill.notional, cashAfter: sleeve.cash, reason: rationale, signals,
  runId: `session-${etToday}-${session}`, authorizedBy: "firstmate",
  // research-driven fields
  paper: true, trader, tradeDate: etToday, session,
  strategyId: strat.strategyId, strategyVersion: strat.version,
  researchId, rationale, confidence,
  quote: { price: quote.price, time: quote.quoteTime, ageSec: quote.quoteAgeSec, source: quote.source, note: quote.delayNote },
  slippage: { bps: slippageBps, cost: fill.slippageCost },
  fees: { commission: fill.fees.commission, secFee: fill.fees.secFee, finraTaf: fill.fees.finraTaf, total: fill.fees.total, rates: fill.fees.rates },
  broker: BROKER.id,
  overrideReason: opt("override-reason") || undefined,
  warnings: warnings.length ? warnings : undefined,
};

console.log(JSON.stringify(order, null, 2));
if (dry) { console.log("(dry run — ledger and research not written)"); process.exit(0); }

sleeve.lastAction = { side, symbol, reason: rationale, ts: now };
ledger.sleeves[sleeveIdx] = sleeve;
ledger.decisions = [order, ...(ledger.decisions || [])];
ledger.meta = { ...ledger.meta, asOf: now, paperOnly: true };
for (const f of LEDGERS) fs.writeFileSync(f, JSON.stringify(ledger, null, 2) + "\n");
research.orders = [...new Set([...(research.orders || []), id])];
research.updatedAt = now;
fs.writeFileSync(researchPath, JSON.stringify(research, null, 2) + "\n");
console.log(`filled ${id}; ledger + ${path.relative(root, researchPath)} updated`);
