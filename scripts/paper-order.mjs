#!/usr/bin/env node
// Paper order executor (PAPER ONLY — never connects to a brokerage).
// Fills a market order at the latest Yahoo quote (+slippage, Schwab-style fees),
// enforces persona guardrails and the fee-aware edge rule, and appends an
// attributed fill to the ledger.
//
// Traders choose their own timing: any moment during regular US market hours.
// No fixed sessions, no symbol allowlist, no hard order-count cap (soft frugality
// warning instead). See docs-internal/trading-session.md.
//
// node scripts/paper-order.mjs --trader mega --side sell --symbol AAPL \
//   --notional 12 | --qty 0.02 | --frac 0.5 (sells: fraction of position) \
//   --research 2026-10-09-mega-check-1115 --rationale "why" --confidence 0.7 \
//   --target 352 | --expected-move-pct 3.5      (expected favorable move)
//   --stop 318 and/or --invalidation "what proves this wrong" \
//   --horizon "5-10 trading days" \
//   [--check <ISO, default now>] [--frequency-reason "..."] [--persona-fit "..."] \
//   [--override-reason "..."] [--slippage-bps 5] [--dry] [--allow-closed]
//
// --session is accepted for old scripts but only recorded; it no longer gates anything.
// --allow-closed only works with --dry (lets you test outside market hours).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { latestQuote, dailyHistory, indicators, classifyInstrument, isDefensive } from "./lib/market.mjs";
import { simulateFill, estimateRoundTrip, BROKER } from "./lib/broker.mjs";
import { PERSONAS, MIN_TICKET, SINGLE_STOCK_CAP, FRUGALITY, CHECK, activity, etDate, ctHHMM } from "./lib/personas.mjs";
import { sleeveNav } from "../src/finances/simEngine.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LEDGERS = ["data/finances-ledger.json", "docs/data/finances-ledger.json"].map((p) => path.join(root, p)).filter((p) => fs.existsSync(p));
const argv = process.argv.slice(2);
const opt = (k, d = null) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const flag = (k) => argv.includes(`--${k}`);
const r2 = (n) => Math.round(n * 100) / 100;
const r4 = (n) => Math.round(n * 10000) / 10000;
const fail = (msg) => { console.error(`REJECTED: ${msg}`); process.exit(1); };
const longText = (k, min = 20) => { const v = opt(k); return v && v.trim().length >= min ? v.trim() : null; };

const trader = opt("trader");
const side = opt("side");
const symbol = (opt("symbol") || "").toUpperCase();
const researchId = opt("research");
const rationale = opt("rationale");
const confidence = Number(opt("confidence"));
const dry = flag("dry");
const slippageBps = Number(opt("slippage-bps", BROKER.defaultSlippageBps));
const legacySession = opt("session"); // recorded only
const checkAt = opt("check") && opt("check") !== "now" ? new Date(opt("check")) : new Date();
if (Number.isNaN(checkAt.getTime())) fail("--check must be an ISO timestamp or 'now'");
const checkLabel = `check-${ctHHMM(checkAt)}`;

const p = PERSONAS[trader];
if (!p) fail(`unknown trader ${trader}`);
if (!["buy", "sell"].includes(side)) fail("side must be buy|sell");
if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(symbol)) fail("--symbol required (US ticker)");
if (!rationale || rationale.length < 20) fail("--rationale required (≥20 chars): say why, citing the research");
if (!(confidence >= 0 && confidence <= 1)) fail("--confidence must be 0..1");
if (p.minConfidence && confidence < p.minConfidence) fail(`${p.name} needs confidence ≥ ${p.minConfidence} (high-bar persona)`);
if (side === "sell" && p.noSells && !opt("override-reason")) fail(`${p.name} does not sell without --override-reason (e.g. rebalance)`);
for (const banned of ["margin", "short", "options", "leverage"]) if (flag(banned)) fail(`--${banned} is not allowed: long-only, cash-only paper sleeves`);

// Edge inputs (validated after the quote is known).
const target = opt("target") != null ? Number(opt("target")) : null;
const movePctArg = opt("expected-move-pct") != null ? Number(opt("expected-move-pct")) : null;
const stop = opt("stop") != null ? Number(opt("stop")) : null;
const invalidation = opt("invalidation");
const horizon = opt("horizon");
if (!horizon) fail('--horizon required (e.g. "3-10 trading days", "12+ months")');
if (stop == null && !(invalidation && invalidation.length >= 10)) fail("--stop <price> or --invalidation \"…\" (≥10 chars) required: say what proves the trade wrong");

// Research record: must exist, be today's, belong to this trader, and name the symbol.
const etToday = etDate();
if (!researchId) fail("--research <id> required: no trade without a research record");
const m = researchId.match(/^(\d{4}-\d{2}-\d{2})-([a-z]+)-(.+)$/);
if (!m || m[2] !== trader) fail(`research id must look like <date>-${trader}-<check-HHMM|open|midday|preclose|premarket>`);
const [, rDate, , suffix] = m;
const researchPath = path.join(root, "data/trading/research", rDate, `${trader}-${suffix}.json`);
if (!fs.existsSync(researchPath)) fail(`research record not found: ${path.relative(root, researchPath)}`);
const research = JSON.parse(fs.readFileSync(researchPath, "utf8"));
if (research.id !== researchId) fail(`research id mismatch (${research.id})`);
if (research.trader !== trader) fail(`research ${researchId} belongs to ${research.trader}`);
if (!dry && rDate !== etToday) fail(`research ${researchId} is not from today (${etToday})`);
const types = new Set((research.sources || []).map((s) => s.type));
for (const t of ["market", "x", "web"]) if (!types.has(t)) fail(`research lacks a ${t} source`);
const idea = (research.ideas || []).find((i) => i.symbol === symbol && i.status === "selected" && (i.side || "buy") === side);
if (!idea) fail(`research has no selected ${side} idea for ${symbol}`);
if (!idea.thesis || idea.thesis.length < 20) fail(`research idea for ${symbol} needs a thesis (≥20 chars)`);

const stratPath = path.join(root, "data/trading/strategies", `${trader}.json`);
const strat = fs.existsSync(stratPath) ? JSON.parse(fs.readFileSync(stratPath, "utf8")) : null;
if (!strat) fail(`no strategy doc at ${path.relative(root, stratPath)}`);

const ledger = JSON.parse(fs.readFileSync(LEDGERS[0], "utf8"));
const sleeveIdx = ledger.sleeves.findIndex((s) => s.id === trader);
if (sleeveIdx < 0) fail(`no sleeve ${trader} in ledger`);
const sleeve = structuredClone(ledger.sleeves[sleeveIdx]);

const quote = await latestQuote(symbol);
const inst = classifyInstrument(quote);
if (!inst.ok) fail(inst.reason);
if (!quote.marketOpenNow) {
  if (!(dry && flag("allow-closed"))) fail(`market is closed for ${symbol} (regular session ${quote.session?.start} → ${quote.session?.end}); paper orders fill only during regular hours`);
}
const warnings = [];
if (quote.quoteAgeSec > 20 * 60 && quote.marketOpenNow) warnings.push(`quote is ${Math.round(quote.quoteAgeSec / 60)} min old`);

// Persona fit is style guidance: off-watchlist or off-style symbols need a written reason.
const offWatch = !p.watchlist.includes(symbol);
const offKind = !p.prefers.kinds.includes(inst.kind);
const personaFit = opt("persona-fit");
if (side === "buy" && (offWatch || offKind) && !(personaFit && personaFit.length >= 15)) {
  fail(`${symbol} (${inst.kind}) is outside ${p.name}'s usual universe. Persona: ${p.fit} Add --persona-fit "how this fits the thesis" (≥15 chars).`);
}

// Current marks with the live quote for this symbol, for cap math.
const marks = { ...(ledger.marks || {}), [symbol]: quote.price };
const navBefore = sleeveNav(sleeve, marks);
const pos = sleeve.positions.find((x) => x.symbol === symbol);
const weightBefore = pos ? (pos.qty * quote.price) / navBefore : 0;

let qty;
if (side === "buy") {
  const notional = Number(opt("notional")) || (Number(opt("qty")) * quote.price);
  if (!(notional >= MIN_TICKET)) fail(`ticket must be ≥ $${MIN_TICKET}`);
  qty = r4(notional / (quote.price * (1 + slippageBps / 1e4)));
} else {
  if (!pos || !(pos.qty > 0)) fail(`no ${symbol} position to sell (no shorting)`);
  qty = opt("frac") ? r4(pos.qty * Number(opt("frac"))) : r4(Number(opt("qty")) || ((Number(opt("notional")) || 0) / quote.price));
  if (!(qty > 0)) fail("sell size required (--frac, --qty or --notional)");
  if (qty > pos.qty) qty = pos.qty;
}

const fill = simulateFill({ side, qty, quote: quote.price, date: etToday, slippageBps });
if (side === "sell" && fill.notional < MIN_TICKET && qty < (pos?.qty ?? 0)) fail(`sell ticket below $${MIN_TICKET}`);
if (side === "buy" && -fill.cashDelta > sleeve.cash + 1e-9) fail(`insufficient cash: need $${-fill.cashDelta}, have $${sleeve.cash} (no margin)`);

// Applicable concentration cap: persona cap, and single stocks never above SINGLE_STOCK_CAP.
const capFor = (kind) => (kind === "stock" ? Math.min(p.maxNamePct, SINGLE_STOCK_CAP) : p.maxNamePct);
const cap = capFor(inst.kind);

// ---- Frugality / edge rule ------------------------------------------------
// Expected favorable move: buys expect a rise to target, sells expect a decline
// (or underperformance) to target. Round trip = slippage both ways + fees both legs.
let movePct = movePctArg;
if (target != null) {
  if (!(target > 0)) fail("--target must be a price");
  movePct = side === "buy" ? ((target - quote.price) / quote.price) * 100 : ((quote.price - target) / quote.price) * 100;
}
if (stop != null) {
  if (side === "buy" && !(stop < quote.price)) fail(`buy stop ${stop} must be below the quote ${quote.price}`);
  if (side === "sell" && !(stop > quote.price)) fail(`sell invalidation price ${stop} must be above the quote ${quote.price} (level that proves the sell wrong)`);
}
const roundTrip = estimateRoundTrip({ notional: fill.notional, price: quote.price, date: etToday, slippageBps });
const expectedEdge = movePct != null ? r4((fill.notional * movePct) / 100) : null;
const ratio = expectedEdge != null && roundTrip.total > 0 ? r2(expectedEdge / roundTrip.total) : expectedEdge > 0 ? Infinity : null;
// Exemption: a sell that only brings an over-cap position back toward its cap (risk control).
const capTrimMax = side === "sell" && weightBefore > cap + 1e-6 ? (weightBefore - cap + 0.03) * navBefore : 0;
const capRebalance = side === "sell" && capTrimMax > 0 && fill.notional <= capTrimMax + 0.01;
const edge = {
  rule: `expected edge ≥ ${FRUGALITY.edgeMultiple}× round-trip cost`,
  target, expectedMovePct: movePct != null ? r2(movePct) : null, stop, invalidation: invalidation || null, horizon,
  expectedEdge, roundTrip, ratio: Number.isFinite(ratio) ? ratio : null,
  passed: ratio != null && ratio >= FRUGALITY.edgeMultiple,
  exempt: null,
};
if (!edge.passed) {
  if (capRebalance) {
    edge.exempt = `cap-rebalance: ${symbol} is ${(weightBefore * 100).toFixed(1)}% vs ${(cap * 100).toFixed(0)}% cap`;
    warnings.push(`edge check waived for cap rebalance (${edge.exempt})`);
  } else if (movePct == null) {
    fail("--target <price> or --expected-move-pct <n> required (fee-aware edge rule)");
  } else {
    fail(`edge too thin: expected ${movePct.toFixed(2)}% on $${fill.notional} = $${expectedEdge?.toFixed(4)} vs round-trip cost $${roundTrip.total.toFixed(4)} (${roundTrip.pctOfNotional}% of notional); need ≥ ${FRUGALITY.edgeMultiple}× (ratio ${edge.ratio}). Hold, or size up within caps.`);
  }
}

// ---- Frequency (soft) -----------------------------------------------------
const act = activity(ledger.decisions, trader, etToday, navBefore);
const after = { day: act.tradesToday + 1, week: act.tradesWeek + 1 };
const overDay = after.day > FRUGALITY.softTradesPerDay;
const overWeek = after.week > FRUGALITY.softTradesPerWeek;
const frequencyReason = opt("frequency-reason");
if (overDay || overWeek) {
  const msg = `${p.name} would make trade #${after.day} today / #${after.week} this week (soft limits ${FRUGALITY.softTradesPerDay}/day, ${FRUGALITY.softTradesPerWeek}/week)`;
  if (!(frequencyReason && frequencyReason.length >= 20)) fail(`${msg}. Add --frequency-reason "why this extra trade is worth its cost" (≥20 chars), or hold.`);
  warnings.push(`frequency: ${msg}`);
}

// Apply to a copy, then check caps post-trade.
if (side === "buy") {
  if (pos) { const nq = pos.qty + qty; pos.avgPrice = r2((pos.avgPrice * pos.qty + fill.price * qty) / nq); pos.qty = r4(nq); }
  else sleeve.positions.push({ symbol, qty, avgPrice: fill.price });
} else {
  pos.qty = r4(pos.qty - qty);
  if (pos.qty < 0.0001) sleeve.positions = sleeve.positions.filter((x) => x.symbol !== symbol);
}
sleeve.cash = r2(sleeve.cash + fill.cashDelta);
if (sleeve.cash < -1e-9) fail(`cash would go negative ($${sleeve.cash}); no margin`);
const navAfter = sleeveNav(sleeve, marks);
const weight = (s) => { const x = sleeve.positions.find((y) => y.symbol === s); return x ? (x.qty * (marks[s] ?? x.avgPrice)) / navAfter : 0; };

if (side === "buy") {
  if (weight(symbol) > cap + 1e-6) fail(`${symbol} would be ${(weight(symbol) * 100).toFixed(1)}% of NAV (cap ${(cap * 100).toFixed(0)}%${inst.kind === "stock" && cap === SINGLE_STOCK_CAP ? ", single-stock cap" : ""})`);
  if (p.maxSatellitePct) {
    const sat = sleeve.positions.filter((x) => !p.core.includes(x.symbol)).reduce((s, x) => s + weight(x.symbol), 0);
    if (sat > p.maxSatellitePct + 1e-6) fail(`satellite would be ${(sat * 100).toFixed(1)}% (cap ${p.maxSatellitePct * 100}%)`);
  }
  if (p.equityNeedsSpyAbove200d && !isDefensive(quote)) {
    const spy = indicators(await dailyHistory("SPY", "2y"));
    if (!(spy.vsSma200Pct > 0)) fail(`SPY is ${spy.vsSma200Pct}% vs 200-day; ${p.name} may not add equity below the 200-day`);
    let eq = 0;
    for (const x of sleeve.positions) {
      const q = x.symbol === symbol ? quote : await latestQuote(x.symbol).catch(() => null);
      if (!q || !isDefensive(q)) eq += weight(x.symbol);
    }
    if (eq > p.maxEquityPct + 1e-6) fail(`equity would be ${(eq * 100).toFixed(1)}% of NAV (cap ${p.maxEquityPct * 100}%)`);
  }
}

const now = new Date().toISOString();
const n = (ledger.decisions || []).filter((d) => d.tradeDate === etToday && d.agentId === trader).length + 1;
const id = `o-${etToday.replaceAll("-", "")}-${trader}-${ctHHMM(checkAt)}-${side}-${symbol}-${n}`;
const signals = [...types].map((t) => ({ source: t, org: `research ${researchId}` }));
const actAfter = {
  ...act,
  tradesToday: after.day, tradesWeek: after.week,
  turnoverToday: r2(act.turnoverToday + fill.notional), turnoverWeek: r2(act.turnoverWeek + fill.notional),
  turnoverTodayPct: r2(((act.turnoverToday + fill.notional) / navBefore) * 100),
  turnoverWeekPct: r2(((act.turnoverWeek + fill.notional) / navBefore) * 100),
  softWarning: overDay || overWeek, frequencyReason: frequencyReason || undefined,
};
const order = {
  // legacy fields (Finances/Metrics UI)
  id, ts: now, agentId: trader, strategy: sleeve.name, side, symbol, qty, price: fill.price,
  notional: fill.notional, cashAfter: sleeve.cash, reason: rationale, signals,
  runId: `${CHECK}-${etToday}-${ctHHMM(checkAt)}`, authorizedBy: "firstmate",
  // research-driven fields
  paper: true, trader, tradeDate: etToday,
  session: CHECK, check: { at: checkAt.toISOString(), label: checkLabel }, legacySession: legacySession || undefined,
  strategyId: strat.strategyId, strategyVersion: strat.version,
  researchId, rationale, confidence,
  instrument: { kind: inst.kind, name: quote.name, exchange: quote.exchangeName },
  personaFit: personaFit || undefined,
  quote: { price: quote.price, time: quote.quoteTime, ageSec: quote.quoteAgeSec, source: quote.source, note: quote.delayNote },
  slippage: { bps: slippageBps, cost: fill.slippageCost },
  fees: { commission: fill.fees.commission, secFee: fill.fees.secFee, finraTaf: fill.fees.finraTaf, total: fill.fees.total, rates: fill.fees.rates },
  edge,
  activity: actAfter,
  weightAfter: r4(weight(symbol)),
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
