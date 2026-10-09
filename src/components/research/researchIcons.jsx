import {
  Crown, Scale, PieChart, ShieldCheck, Waves, Globe, FileText, ChartCandlestick,
  Landmark, Cpu, Activity, Percent, ArrowLeftRight, CalendarClock, Pause, Users,
} from "lucide-react";

/** X wordmark glyph (brand mark; Lucide ships no X logo). Sized like a Lucide icon. */
export function XMark({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

/** One identity glyph per trader persona. */
export const TRADER_ICON = { mega: Crown, value: Scale, coresat: PieChart, riskoff: ShieldCheck, swing: Waves, all: Users };
export const SOURCE_ICON = { x: XMark, web: Globe, sec: FileText, market: ChartCandlestick };
export const STAT_ICON = { SPY: Landmark, QQQ: Cpu, VIX: Activity, "10y": Percent };
export const ACTION_ICON = { trade: ArrowLeftRight, plan: CalendarClock, hold: Pause };

export function TraderAvatar({ id, name, size = 16, className = "rs-avatar" }) {
  const Icon = TRADER_ICON[id];
  return (
    <span className={className} aria-hidden="true">
      {Icon ? <Icon size={size} strokeWidth={2.2} /> : name?.[0]}
    </span>
  );
}

export function SourceIcon({ type, size = 13 }) {
  const Icon = SOURCE_ICON[type];
  return Icon ? <Icon size={size} strokeWidth={2.2} /> : null;
}
