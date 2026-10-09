import { useCallback, useEffect, useState } from "react";

/** Loads the research dashboard bundle built by scripts/research-kit.mjs index. */
export function useResearch() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}data/trading-index.json`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setStatus("ready");
    } catch (e) {
      console.error(e);
      setStatus("error");
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  return { data, status, reload: load };
}

export const TRADER_HUE = { mega: "violet", value: "emerald", coresat: "blue", riskoff: "cyan", swing: "pink" };
export const SOURCE_META = {
  x: { label: "X", hue: "slate", long: "Posts on X" },
  web: { label: "Web", hue: "blue", long: "News & web" },
  sec: { label: "SEC", hue: "emerald", long: "SEC filings" },
  market: { label: "Market", hue: "violet", long: "Market data" },
};
/** Legacy fixed-session labels (records before Oct 9 midday). New records are timestamped checks. */
export const SESSION_LABEL = { premarket: "Pre-market", open: "Open · 9:05 CT", midday: "Midday · 12:35 CT", preclose: "Pre-close · 2:35 CT", check: "Market check" };
/** "Check · 11:15 AM CT" for new records, legacy session label otherwise. */
export function whenLabel(rec) {
  if (rec?.session === "check" && rec.checkAt) return `Check · ${fmtTime(rec.checkAt)}`;
  return SESSION_LABEL[rec?.session] || rec?.session || "";
}
export const fmtX = (n) => (n == null ? "—" : `${Number(n) >= 100 ? Math.round(n) : Number(n).toFixed(1)}×`);
export const ACTION_LABEL = { plan: "Plan", trade: "Trade", hold: "Hold" };

export const fmtPct = (n) => (n == null ? "—" : `${n > 0 ? "+" : ""}${Number(n).toFixed(2)}%`);
export const fmtMoney = (n) => (n == null ? "—" : `${n < 0 ? "−" : ""}$${Math.abs(n).toFixed(2)}`);
export function fmtDate(d) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
export function fmtTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }) + " CT";
}
export function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}
/** P&L since fill, marked at the latest EOD mark. */
export function pnlSince(order, marks) {
  const m = marks?.[order.symbol];
  if (!m || !order.qty) return null;
  const sign = order.side === "sell" ? -1 : 1;
  return Math.round(sign * (m - order.price) * order.qty * 100) / 100 - (order.side === "buy" ? order.fees?.total || 0 : 0);
}
