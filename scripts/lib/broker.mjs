// Paper broker model (PAPER ONLY — no brokerage connection, no real orders).
// Models Charles Schwab retail online pricing for US-listed stocks and ETFs.
//
// Sources (read 2026-10-09):
// - Schwab: "$0 online commission" on listed stocks and ETFs; an "Industry Fee"
//   passes through the SEC Section 31 fee and the FINRA Trading Activity Fee on sells.
//   https://www.schwab.com/pricing
// - SEC Section 31: $20.60 per $1,000,000 of covered sales, effective 2026-04-04
//   (was $0.00/million through 2026-04-03). Stays in effect until 60 days after the
//   FY2027 appropriation is enacted (no FY2027 Section 31 advisory as of 2026-10-09).
//   https://www.sec.gov/rules-regulations/fee-rate-advisories/2026-2
//   https://www.sec.gov/files/rules/other/2026/34-104909.pdf (Release 34-104909)
// - FINRA TAF (covered equity sells): $0.000195/share, max $9.79/trade for 2026,
//   PAUSED to $0.00 for trades 2026-10-01 .. 2026-12-31 (SR-FINRA-2026-021, filed
//   for immediate effectiveness), then 2027 schedule $0.000232/share, max $11.61.
//   https://www.finra.org/rules-guidance/rule-filings/sr-finra-2026-021
//   https://www.finra.org/rules-guidance/rule-filings/sr-finra-2024-019/fee-adjustment-schedule
//   No TAF is assessed when the execution price is below the per-share rate.
//
// Rounding: brokers round each regulatory fee UP to the next cent per trade when
// non-zero (Schwab confirms show a $0.01 minimum Industry Fee). Configurable.

export const BROKER = Object.freeze({
  id: "schwab",
  name: "Charles Schwab (modeled)",
  commission: { stockEtfOnline: 0 },
  defaultSlippageBps: 5,
});

/** SEC Section 31 schedule: rate in $ per $1 of covered sale value. */
export const SEC_SECTION31_SCHEDULE = Object.freeze([
  { from: "2025-05-14", ratePerMillion: 0.0, source: "https://www.sec.gov/rules-regulations/fee-rate-advisories" },
  { from: "2026-04-04", ratePerMillion: 20.6, source: "https://www.sec.gov/rules-regulations/fee-rate-advisories/2026-2" },
]);

/** FINRA TAF schedule for covered equity securities (sells only). */
export const FINRA_TAF_SCHEDULE = Object.freeze([
  { from: "2026-01-01", perShare: 0.000195, maxPerTrade: 9.79, source: "https://www.finra.org/rules-guidance/rule-filings/sr-finra-2024-019/fee-adjustment-schedule" },
  { from: "2026-10-01", perShare: 0.0, maxPerTrade: 0.0, source: "https://www.finra.org/rules-guidance/rule-filings/sr-finra-2026-021" },
  { from: "2027-01-01", perShare: 0.000232, maxPerTrade: 11.61, source: "https://www.finra.org/rules-guidance/rule-filings/sr-finra-2024-019/fee-adjustment-schedule" },
]);

function pick(schedule, date) {
  let row = schedule[0];
  for (const r of schedule) if (r.from <= date) row = r;
  return row;
}

const ceilCent = (n) => (n > 0 ? Math.ceil(n * 100 - 1e-9) / 100 : 0);
const r2 = (n) => Math.round(n * 100) / 100;
const r4 = (n) => Math.round(n * 10000) / 10000;

export function feeRatesOn(date) {
  const sec = pick(SEC_SECTION31_SCHEDULE, date);
  const taf = pick(FINRA_TAF_SCHEDULE, date);
  return { date, sec, taf };
}

/**
 * Slipped fill price. Buys pay up, sells receive less.
 * @param {"buy"|"sell"} side
 */
export function slippedPrice(side, quote, bps = BROKER.defaultSlippageBps) {
  const f = bps / 10000;
  return r4(side === "buy" ? quote * (1 + f) : quote * (1 - f));
}

/**
 * Fees for one fill. Commission $0; SEC + TAF on sells only.
 * @returns {{commission:number, secFee:number, finraTaf:number, total:number, rates:object}}
 */
export function computeFees({ side, qty, price, date, roundUpToCent = true }) {
  const { sec, taf } = feeRatesOn(date);
  const notional = qty * price;
  let secFee = 0;
  let finraTaf = 0;
  if (side === "sell") {
    secFee = notional * (sec.ratePerMillion / 1e6);
    if (taf.perShare > 0 && price >= taf.perShare) {
      finraTaf = Math.min(qty * taf.perShare, taf.maxPerTrade);
    }
  }
  if (roundUpToCent) {
    secFee = ceilCent(secFee);
    finraTaf = ceilCent(finraTaf);
  } else {
    secFee = r4(secFee);
    finraTaf = r4(finraTaf);
  }
  const commission = BROKER.commission.stockEtfOnline;
  return {
    commission,
    secFee,
    finraTaf,
    total: r2(commission + secFee + finraTaf),
    rates: {
      secPerMillion: sec.ratePerMillion,
      secSource: sec.source,
      tafPerShare: taf.perShare,
      tafMaxPerTrade: taf.maxPerTrade,
      tafSource: taf.source,
    },
  };
}

/**
 * Full fill: slippage applied to the quote, then fees on the slipped notional.
 */
export function simulateFill({ side, qty, quote, date, slippageBps = BROKER.defaultSlippageBps }) {
  const price = slippedPrice(side, quote, slippageBps);
  const notional = r2(qty * price);
  const slippageCost = r4(Math.abs(price - quote) * qty);
  const fees = computeFees({ side, qty, price, date });
  // Cash impact: buys pay notional + fees; sells receive notional − fees.
  const cashDelta = side === "buy" ? -r2(notional + fees.total) : r2(notional - fees.total);
  return { side, qty, quote, price, notional, slippageBps, slippageCost, fees, cashDelta, broker: BROKER.id };
}

/**
 * Estimated round-trip cost for a position of `notional` at `price`: slippage on
 * entry and exit, plus fees on both legs (buy leg $0; sell leg SEC + TAF, rounded
 * up to the cent). Used by the frugality / edge rule in paper-order.mjs.
 * For a sell, the round trip is "sell now, buy back later" — same cost shape.
 */
export function estimateRoundTrip({ notional, price, date, slippageBps = BROKER.defaultSlippageBps }) {
  const qty = price > 0 ? notional / price : 0;
  const slip = 2 * notional * (slippageBps / 1e4);
  const buyFees = computeFees({ side: "buy", qty, price, date }).total;
  const sellFees = computeFees({ side: "sell", qty, price, date }).total;
  const total = r4(slip + buyFees + sellFees);
  return { slippage: r4(slip), buyFees, sellFees, total, pctOfNotional: notional > 0 ? r4((total / notional) * 100) : null };
}
