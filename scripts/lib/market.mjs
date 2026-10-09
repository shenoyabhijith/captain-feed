// Market data helpers: Yahoo Finance public chart endpoint (unofficial, ~15 min
// delayed intraday for most US listings; real close after 4 PM ET). PAPER ONLY.
const UA = { "User-Agent": "Mozilla/5.0 (CaptainFeed paper research)" };

export async function yahooChart(symbol, { range = "1y", interval = "1d" } = {}) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
  let lastErr;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { headers: UA });
      if (!res.ok) throw new Error(`${symbol}: HTTP ${res.status}`);
      const r = (await res.json())?.chart?.result?.[0];
      if (!r?.meta) throw new Error(`${symbol}: no chart data`);
      return { url, ...r };
    } catch (e) {
      lastErr = e;
      await new Promise((ok) => setTimeout(ok, 600 * (i + 1)));
    }
  }
  throw lastErr;
}

const etDate = (sec) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(sec * 1000));

/** Latest quote (regular-session price) with its exchange timestamp. */
export async function latestQuote(symbol) {
  const r = await yahooChart(symbol, { range: "1d", interval: "1m" });
  const m = r.meta;
  const reg = m.currentTradingPeriod?.regular;
  const nowSec = Math.floor(Date.now() / 1000);
  return {
    symbol,
    price: m.regularMarketPrice,
    quoteTime: new Date(m.regularMarketTime * 1000).toISOString(),
    quoteAgeSec: nowSec - m.regularMarketTime,
    previousClose: m.chartPreviousClose ?? m.previousClose ?? null,
    marketOpenNow: reg ? nowSec >= reg.start && nowSec < reg.end : false,
    session: reg ? { start: new Date(reg.start * 1000).toISOString(), end: new Date(reg.end * 1000).toISOString() } : null,
    instrumentType: m.instrumentType || null,
    exchange: m.exchangeName || null,
    exchangeName: m.fullExchangeName || null,
    name: m.longName || m.shortName || null,
    currency: m.currency || null,
    dayHigh: m.regularMarketDayHigh ?? null,
    dayLow: m.regularMarketDayLow ?? null,
    source: "yahoo-chart",
    delayNote: "Yahoo public chart feed; intraday quotes can lag up to ~15 min.",
    url: r.url,
  };
}

/** Daily closes as [{date, close}] (ET session dates). */
export async function dailyHistory(symbol, range = "1y") {
  const r = await yahooChart(symbol, { range, interval: "1d" });
  const q = r.indicators?.quote?.[0]?.close || [];
  const out = [];
  (r.timestamp || []).forEach((t, i) => { if (q[i] != null) out.push({ date: etDate(t), close: Math.round(q[i] * 100) / 100 }); });
  return { symbol, url: r.url, meta: r.meta, rows: out };
}

const sma = (a, n) => (a.length >= n ? a.slice(-n).reduce((s, x) => s + x, 0) / n : null);
const pct = (a, b) => (a != null && b ? Math.round(((a - b) / b) * 10000) / 100 : null);
const r2 = (n) => (n == null ? null : Math.round(n * 100) / 100);

function rsi(closes, n = 14) {
  if (closes.length <= n) return null;
  let g = 0, l = 0;
  for (let i = closes.length - n; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) g += d; else l -= d;
  }
  if (l === 0) return 100;
  return r2(100 - 100 / (1 + g / l));
}

/** Indicators from a daily history. asOf = last row date. */
export function indicators(hist) {
  const c = hist.rows.map((r) => r.close);
  const last = c[c.length - 1];
  const s50 = sma(c, 50), s200 = sma(c, 200);
  const hi52 = Math.max(...c.slice(-252));
  return {
    symbol: hist.symbol,
    asOf: hist.rows[hist.rows.length - 1]?.date,
    last,
    chg1dPct: pct(last, c[c.length - 2]),
    chg5dPct: pct(last, c[c.length - 6]),
    chg20dPct: pct(last, c[c.length - 21]),
    sma50: r2(s50),
    sma200: r2(s200),
    vsSma50Pct: pct(last, s50),
    vsSma200Pct: pct(last, s200),
    rsi14: rsi(c),
    offHigh52wPct: pct(last, hi52),
  };
}

export const SECTOR_ETFS = Object.freeze({
  XLK: "Technology", XLF: "Financials", XLE: "Energy", XLV: "Health Care",
  XLY: "Cons. Discretionary", XLP: "Cons. Staples", XLI: "Industrials",
  XLU: "Utilities", XLB: "Materials", XLRE: "Real Estate", XLC: "Communication",
});

// US listing check for the paper executor. Yahoo exchange codes for US national
// exchanges (Nasdaq GS/GM/CM, NYSE, NYSE American, NYSE Arca, Cboe BZX). OTC/pink
// sheets and foreign listings are not "US-listed" for our purposes.
export const US_EXCHANGES = Object.freeze(["NMS", "NGM", "NCM", "NYQ", "ASE", "PCX", "BTS", "NAS", "NYS", "CXI"]);
const LEVERAGED_RE = /\b(ultra|ultrapro|2x|3x|-1x|-2x|-3x|leveraged|inverse|short|bear|daily .*(bull|bear))\b/i;
// Duration/maturity phrases are not shorting ("Ultra-Short Income", "Short-Term Bond").
const BENIGN_SHORT_RE = /\b(ultra[- ]short|short[- ](term|duration|maturity))\b/gi;

/** Classifies a quote for guardrails: {ok, kind: "stock"|"etf", reason?}. */
export function classifyInstrument(q) {
  const t = (q.instrumentType || "").toUpperCase();
  if (q.currency && q.currency !== "USD") return { ok: false, reason: `${q.symbol} trades in ${q.currency}, not USD` };
  if (!US_EXCHANGES.includes(q.exchange)) return { ok: false, reason: `${q.symbol} is listed on ${q.exchangeName || q.exchange || "an unknown venue"}, not a US national exchange` };
  if (t === "EQUITY") return { ok: true, kind: "stock" };
  if (t === "ETF") {
    if (LEVERAGED_RE.test((q.name || "").replace(BENIGN_SHORT_RE, ""))) return { ok: false, reason: `${q.symbol} (${q.name}) looks like a leveraged or inverse ETF; no leverage or shorting` };
    return { ok: true, kind: "etf" };
  }
  return { ok: false, reason: `${q.symbol} is a ${t || "unknown"} instrument; only US-listed stocks and ETFs are allowed` };
}

const BOND_RE = /\b(bond|treasury|treasuries|t-bill|aggregate|fixed income|municipal|tips|money market)\b/i;
/** True for bond / T-bill style ETFs (RiskOff's defensive bucket). */
export function isDefensive(q) {
  const n = q.name || "";
  if ((q.instrumentType || "").toUpperCase() !== "ETF") return false;
  return BOND_RE.test(n) || (/\bincome\b/i.test(n) && !/\b(equity|dividend|stock|covered call|premium)\b/i.test(n));
}
