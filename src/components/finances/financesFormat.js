/** Shared formatters + sleeve holdings helpers for Finances coss UI. */

export function formatAsOf(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en-US", {
      timeZone: "America/Chicago",
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZoneName: "short",
    });
  } catch {
    return iso;
  }
}

export function formatTs(ts) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleString("en-US", {
      timeZone: "America/Chicago",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZoneName: "short",
    });
  } catch {
    return ts;
  }
}

export function money(n, digits = 2) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  const abs = Math.abs(v).toFixed(digits);
  if (v < 0) return `-$${abs}`;
  return `$${abs}`;
}

export function signedMoney(n, digits = 2) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  const abs = Math.abs(v).toFixed(digits);
  if (v > 0) return `+$${abs}`;
  if (v < 0) return `-$${abs}`;
  return `$${abs}`;
}

export function signedPct(n, digits = 2) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  const abs = Math.abs(v).toFixed(digits);
  if (v > 0) return `+${abs}%`;
  if (v < 0) return `-${abs}%`;
  return `${abs}%`;
}

/** Day P&L from last two equity points vs current NAV. */
export function dayPnlFromEquity(equity = [], currentNav) {
  if (!equity.length || currentNav == null) {
    return { dayPnl: 0, dayPnlPct: 0 };
  }
  const prev =
    equity.length >= 2 ? equity[equity.length - 2].nav : equity[0].nav;
  const dayPnl = Math.round((currentNav - prev) * 100) / 100;
  const dayPnlPct =
    prev > 0 ? Math.round((dayPnl / prev) * 10000) / 100 : 0;
  return { dayPnl, dayPnlPct };
}

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

/**
 * Holdings rows + allocation segments for a sleeve.
 * Includes a trailing Cash row for allocation completeness.
 */
export function sleeveHoldings(sleeve, marks = {}, stats) {
  const nav = stats?.nav || 0;
  const positions = sleeve?.positions || [];
  const rows = positions.map((p, i) => {
    const px = marks[p.symbol] ?? p.avgPrice ?? 0;
    const mkt = Math.round(p.qty * px * 100) / 100;
    const cost = Math.round(p.qty * (p.avgPrice ?? 0) * 100) / 100;
    const uPnl = Math.round((mkt - cost) * 100) / 100;
    const pct = nav > 0 ? Math.round((mkt / nav) * 1000) / 10 : 0;
    return {
      key: p.symbol,
      symbol: p.symbol,
      qty: p.qty,
      mkt,
      pct,
      uPnl,
      color: CHART_COLORS[i % CHART_COLORS.length],
      isCash: false,
    };
  });
  const cash = sleeve?.cash ?? 0;
  const cashPct = nav > 0 ? Math.round((cash / nav) * 1000) / 10 : 0;
  rows.push({
    key: "cash",
    symbol: "Cash",
    qty: null,
    mkt: cash,
    pct: cashPct,
    uPnl: null,
    color: "var(--muted-foreground)",
    isCash: true,
  });
  return rows;
}

export function investedPct(stats) {
  if (!stats) return 0;
  return Math.max(0, Math.min(100, Math.round((100 - (stats.cashPct || 0)) * 10) / 10));
}
