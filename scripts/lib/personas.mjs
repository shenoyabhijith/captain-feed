// Persona guardrails enforced by scripts/paper-order.mjs (PAPER ONLY).
// Rules come from each trader agent's profile (/home/box/agent-data/agents/<id>/profile.json)
// plus the sleeve persona in data/finances-ledger.json. Strategy docs in
// data/trading/strategies/<id>.json may be stricter, never looser.
//
// 2026-10-09 (user granted timing freedom): no fixed sessions, no symbol allowlists,
// no hard order-count caps. Traders watch the market and pick their own timing during
// regular US hours. Any US-listed stock or ETF is allowed if it fits the persona's
// thesis; `watchlist` is only the default scan universe and style guidance.
// Hard guardrails that remain: no leverage/margin/shorting/options (long-only cash,
// no leveraged or inverse ETFs), cash never negative, per-position concentration caps,
// same-day research naming the symbol, and the fee-aware edge rule (FRUGALITY below).

/** Legacy fixed sessions (records before 2026-10-09 midday). Kept for old records. */
export const SESSIONS = Object.freeze(["premarket", "open", "midday", "preclose"]);
/** @deprecated kept for backward compatibility; trading is no longer session-gated. */
export const TRADING_SESSIONS = Object.freeze(["open", "midday", "preclose"]);
/** New research/order label: a free-form market-watch check, timestamped. */
export const CHECK = "check";
export const MIN_TICKET = 5;
/** Any single stock (not a broad fund) is capped at this weight in every sleeve. */
export const SINGLE_STOCK_CAP = 0.25;

/** Frugality / fee-aware edge rules (see docs-internal/trading-session.md). */
export const FRUGALITY = Object.freeze({
  edgeMultiple: 3, // expected edge must be ≥ 3× estimated round-trip cost
  softTradesPerDay: 3, // above this, a --frequency-reason is required (soft warning)
  softTradesPerWeek: 10,
});

export const PERSONAS = Object.freeze({
  mega: {
    agentId: "13448089-ec47-4cb6-a320-137295c59509",
    name: "Mega",
    style: "Mega-cap equal-weight; the largest US platforms with concentration caps; patient, rebalance temperament.",
    watchlist: ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA"],
    fit: "US mega-cap stocks (roughly the largest ~10 by market cap). Anything else needs --persona-fit.",
    prefers: { kinds: ["stock"] },
    maxNamePct: 0.25,
  },
  value: {
    agentId: "1aa5cd22-a8ad-487a-9a73-e159126ef93d",
    name: "Value",
    style: "Bogle / long-term DCA; broad, low-cost index ETFs; buys, rarely sells.",
    watchlist: ["VOO", "VTI", "VXUS"],
    fit: "Broad, low-cost index ETFs held for years. Single stocks or narrow funds need --persona-fit.",
    prefers: { kinds: ["etf"] },
    maxNamePct: 0.7, // broad index funds may be large; single stocks still capped at SINGLE_STOCK_CAP
    noSells: true, // Bogle: sells require --override-reason (e.g. rebalancing)
  },
  coresat: {
    agentId: "338c1b0c-651e-4410-85af-3de19edb43be",
    name: "CoreSat",
    style: "70–80% broad ETF core (VOO/VTI) + tech/semi satellite.",
    watchlist: ["VOO", "VTI", "QQQ", "SMH", "SOXX", "VGT", "XLK"],
    fit: "Core = VOO/VTI; satellite = tech/semi ETFs or leaders. Off-theme satellites need --persona-fit.",
    prefers: { kinds: ["etf", "stock"] },
    core: ["VOO", "VTI"],
    maxNamePct: 0.85, // core may exceed 25%; satellites still bounded by maxSatellitePct
    maxSatellitePct: 0.3,
  },
  riskoff: {
    agentId: "c5141b27-0d45-4443-8c0f-63005f605e84",
    name: "RiskOff",
    style: "Cash guardian. Bonds/T-bills (BND etc.) when SPY < 200-day; broad equity only while SPY > 200-day; high skip rate.",
    watchlist: ["BND", "VOO"],
    fit: "Defensive bond/T-bill ETFs, or broad equity ETFs while SPY > 200-day. Single stocks need --persona-fit.",
    prefers: { kinds: ["etf"] },
    maxNamePct: 1.0,
    equityNeedsSpyAbove200d: true, // any non-defensive buy needs SPY > 200-day
    maxEquityPct: 0.4, // total non-defensive weight
  },
  swing: {
    agentId: "dd396072-87cc-4f88-900a-de8d8eb81dc7",
    name: "Swing",
    style: "3–15 day swings in liquid tech/semis; rare, high-bar trades; own timing during regular hours (no after-hours).",
    watchlist: ["QQQ", "SMH", "SOXX", "XLK", "VGT", "AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "AVGO", "TSM"],
    fit: "Liquid US tech/semi stocks and ETFs for 3–15 day swings. Other sectors need --persona-fit.",
    prefers: { kinds: ["etf", "stock"] },
    maxNamePct: 0.25,
    minConfidence: 0.65,
  },
});

export const TRADER_IDS = Object.freeze(Object.keys(PERSONAS));

/** ET trading date and Mon-start week key for a Date. */
export function etDate(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(d);
}
export function weekStart(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = (dt.getUTCDay() + 6) % 7; // Mon=0
  dt.setUTCDate(dt.getUTCDate() - dow);
  return dt.toISOString().slice(0, 10);
}
/** "HHMM" in Central time, used in check ids (e.g. check-1115). */
export function ctHHMM(d = new Date()) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "America/Chicago", hour: "2-digit", minute: "2-digit", hour12: false }).format(d).replace(":", "");
}

/** Per-trader activity from ledger decisions (paper orders only). */
export function activity(decisions, trader, date, navNow) {
  const wk = weekStart(date);
  const mine = (decisions || []).filter((d) => d.paper && (d.trader || d.agentId) === trader && d.tradeDate);
  const day = mine.filter((d) => d.tradeDate === date);
  const week = mine.filter((d) => d.tradeDate >= wk && d.tradeDate <= date);
  const sum = (a) => Math.round(a.reduce((s, d) => s + (d.notional || 0), 0) * 100) / 100;
  const fees = (a) => Math.round(a.reduce((s, d) => s + (d.fees?.total || 0) + (d.slippage?.cost || 0), 0) * 100) / 100;
  const pct = (x) => (navNow ? Math.round((x / navNow) * 10000) / 100 : null);
  return {
    date, weekStart: wk,
    tradesToday: day.length, tradesWeek: week.length,
    turnoverToday: sum(day), turnoverWeek: sum(week),
    turnoverTodayPct: pct(sum(day)), turnoverWeekPct: pct(sum(week)),
    costsToday: fees(day), costsWeek: fees(week),
    soft: FRUGALITY,
  };
}
