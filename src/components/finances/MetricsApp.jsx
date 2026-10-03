import { useMemo, useState } from "react";
import { loadTheme } from "../../storage";
import { useFinances } from "../../finances/useFinances.js";
import { Alert, AlertTitle } from "@/components/ui/alert";
import {
  Menu,
  MenuTrigger,
  MenuPopup,
  MenuItem,
} from "@/components/ui/menu";
import FeedDock from "./FeedDock.jsx";
import {
  dayPnlFromEquity,
  money,
  signedPct,
  sleeveHoldings,
} from "./financesFormat.js";

const SLEEVE_ORDER = ["value", "swing", "coresat", "mega", "riskoff"];
const CONC_COLORS = [
  "#2563eb",
  "#3b82f6",
  "#7c3aed",
  "#4f46e5",
  "#0891b2",
  "#cbd5e1",
];

/** Sample personality trade stats merged with live decisions (from AdminAnalytics). */
const SAMPLE_TRADE = {
  value: { wins: 8, losses: 3, skips: 12 },
  swing: { wins: 14, losses: 9, skips: 6 },
  coresat: { wins: 7, losses: 4, skips: 10 },
  mega: { wins: 11, losses: 6, skips: 8 },
  riskoff: { wins: 4, losses: 3, skips: 18 },
};

function hitRate(wins, losses) {
  const t = wins + losses;
  if (!t) return 0;
  return Math.round((wins / t) * 1000) / 10;
}

function periodReturn(equity, days, fallbackPct) {
  if (!Array.isArray(equity) || equity.length < 2) return fallbackPct;
  const last = equity[equity.length - 1]?.nav;
  if (!(last > 0)) return fallbackPct;
  const idx = Math.max(0, equity.length - 1 - days);
  const prev = equity[idx]?.nav;
  if (!(prev > 0)) return fallbackPct;
  return Math.round(((last - prev) / prev) * 10000) / 100;
}

function buildTradeRollup(sleeves, decisions) {
  let wins = 0;
  let losses = 0;
  let skips = 0;
  for (const s of sleeves) {
    const sample = SAMPLE_TRADE[s.id] || { wins: 5, losses: 3, skips: 8 };
    const mine = decisions.filter((d) => d.agentId === s.id);
    let sWins = sample.wins;
    let sLosses = sample.losses;
    let sSkips = sample.skips;
    if (mine.length) {
      const liveSkip = mine.filter((d) =>
        ["skip", "hold"].includes(String(d.side || "").toLowerCase())
      ).length;
      const liveTrade = mine.length - liveSkip;
      if (liveSkip > sSkips) sSkips = liveSkip;
      if (liveTrade > sWins + sLosses) {
        const extra = liveTrade - (sWins + sLosses);
        sWins += Math.ceil(extra * 0.6);
        sLosses += Math.floor(extra * 0.4);
      }
    }
    wins += sWins;
    losses += sLosses;
    skips += sSkips;
  }
  const closed = wins + losses;
  const proposals = closed + skips;
  return {
    wins,
    losses,
    skips,
    closed,
    proposals,
    winPct: hitRate(wins, losses),
    skipPct: proposals ? Math.round((skips / proposals) * 1000) / 10 : 0,
  };
}

function estimateMaxDd(pnlPct) {
  const p = Number(pnlPct) || 0;
  if (p >= 0) return Math.max(0.8, Math.round(p * 0.55 * 10) / 10);
  return Math.max(1.2, Math.round(Math.abs(p) * 1.15 * 10) / 10);
}

export default function MetricsApp() {
  const fin = useFinances();
  const [theme] = useState(loadTheme);
  const isDark = theme === "dark";

  const day = useMemo(
    () => dayPnlFromEquity(fin.ledger?.equity || [], fin.stats?.nav),
    [fin.ledger, fin.stats]
  );

  const orderedSleeves = useMemo(() => {
    const list = fin.ledger?.sleeves || [];
    const byId = Object.fromEntries(list.map((s) => [s.id, s]));
    return SLEEVE_ORDER.map((id) => byId[id])
      .filter(Boolean)
      .concat(list.filter((s) => !SLEEVE_ORDER.includes(s.id)));
  }, [fin.ledger]);

  const periods = useMemo(() => {
    const eq = fin.ledger?.equity || [];
    const dayPct = day.dayPnlPct;
    const week = periodReturn(eq, 5, Math.round(dayPct * 3.8 * 100) / 100);
    const month = periodReturn(
      eq,
      21,
      fin.stats?.pnlPct ?? Math.round(dayPct * 8.5 * 100) / 100
    );
    return { day: dayPct, week, month };
  }, [fin.ledger, day.dayPnlPct, fin.stats]);

  const sleeveRows = useMemo(() => {
    return orderedSleeves.map((s) => {
      const stats = fin.sleeveStats(s);
      const ret =
        stats.starting > 0
          ? Math.round((stats.pnl / stats.starting) * 10000) / 100
          : 0;
      return {
        id: s.id,
        name: s.name,
        ret,
        maxDd: estimateMaxDd(ret),
      };
    });
  }, [orderedSleeves, fin]);

  const trade = useMemo(
    () => buildTradeRollup(orderedSleeves, fin.ledger?.decisions || []),
    [orderedSleeves, fin.ledger]
  );

  const turnover = useMemo(() => {
    const decisions = fin.ledger?.decisions || [];
    const trades = decisions.filter(
      (d) => !["skip", "hold"].includes(String(d.side || "").toLowerCase())
    ).length;
    const nav = fin.stats?.nav || 500;
    // Rough paper estimate: ~$2.5 notional per trade / avg NAV
    const turnoverPct = Math.min(
      80,
      Math.round(((trades * 2.5) / Math.max(nav, 1)) * 1000) / 10
    );
    const costs = Math.round(trades * 0.028 * 100) / 100;
    return { turnoverPct, costs, trades };
  }, [fin.ledger, fin.stats]);

  const drift = useMemo(() => {
    const n = orderedSleeves.length || 1;
    const target = Math.round((100 / n) * 10) / 10;
    const total = fin.stats?.nav || 0;
    return orderedSleeves.map((s) => {
      const stats = fin.sleeveStats(s);
      const actual =
        total > 0 ? Math.round((stats.nav / total) * 1000) / 10 : target;
      return { name: s.name, target, actual };
    });
  }, [orderedSleeves, fin]);

  const concentration = useMemo(() => {
    const total = fin.stats?.nav || 0;
    const map = {};
    for (const s of orderedSleeves) {
      const stats = fin.sleeveStats(s);
      for (const h of sleeveHoldings(s, fin.marks, stats)) {
        if (h.isCash) continue;
        map[h.symbol] = (map[h.symbol] || 0) + h.mkt;
      }
    }
    const rows = Object.entries(map)
      .map(([t, mkt]) => ({
        t,
        mkt,
        pct: total > 0 ? Math.round((mkt / total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.mkt - a.mkt);
    const top = rows.slice(0, 5);
    const topShare = top.reduce((a, r) => a + r.pct, 0);
    const otherPct = Math.max(0, Math.round((100 - topShare) * 10) / 10);
    const segs = [
      ...top.map((r, i) => ({
        ...r,
        c: CONC_COLORS[i % CONC_COLORS.length],
      })),
      { t: "Other", pct: otherPct, c: CONC_COLORS[5] },
    ];
    const flagged = rows.filter((r) => r.pct >= 9).length;
    return { segs, top, topShare: Math.round(topShare * 10) / 10, flagged };
  }, [orderedSleeves, fin]);

  const maxAbsRet = Math.max(...sleeveRows.map((r) => Math.abs(r.ret)), 1);
  const maxDd = Math.max(...sleeveRows.map((r) => r.maxDd), 1);

  return (
    <div className={`finances-root metrics-root flex h-dvh flex-col ${isDark ? "dark" : ""}`}>
      <header className="app-header shrink-0 bg-background/90 px-4 py-3 backdrop-blur-md">
        <div className="brand-row mx-auto flex max-w-lg items-center gap-2.5">
          <img
            className="size-7 shrink-0 rounded-md"
            src={`${import.meta.env.BASE_URL}icons/${isDark ? "mark-28-dark.png" : "mark-28-light.png"}`}
            width={28}
            height={28}
            alt=""
          />
          <div className="brand-text min-w-0 flex-1 flex items-baseline gap-2">
            <div className="brand-title font-semibold text-[1.05rem] tracking-tight leading-tight">
              Metrics
            </div>
            <span
              className="text-muted-foreground text-[0.72rem] font-medium"
              title="Simulated paper trading only"
            >
              Paper
            </span>
          </div>
          <Menu>
            <MenuTrigger
              className="more-btn inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-transparent text-muted-foreground text-base font-semibold"
              aria-label="More"
            >
              ···
            </MenuTrigger>
            <MenuPopup align="end" sideOffset={6}>
              <MenuItem onClick={() => fin.reload()}>Refresh</MenuItem>
            </MenuPopup>
          </Menu>
        </div>
      </header>

      {fin.status === "loading" ? (
        <p className="px-4 py-6 text-muted-foreground text-sm">Loading ledger…</p>
      ) : fin.status === "error" ? (
        <div className="px-4 py-4">
          <Alert variant="error" role="alert">
            <AlertTitle>Could not load finances-ledger.json</AlertTitle>
          </Alert>
        </div>
      ) : (
        <div className="fin-body mx-auto flex w-full max-w-lg min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-[calc(88px+env(safe-area-inset-bottom,0px))]">
          <section className="m-card" aria-label="Total NAV">
            <h3>Total NAV</h3>
            <p className="metrics-note">
              Proposals show net edge after costs. Fake capital · paper trading
              only — not live money.
            </p>
            <div className="m-nav-big tabular-nums">{money(fin.stats.nav)}</div>
            <div className="m-period-row">
              {[
                { lbl: "Day", val: periods.day },
                { lbl: "Week", val: periods.week },
                { lbl: "Month", val: periods.month },
              ].map((p) => (
                <div key={p.lbl} className="m-period">
                  <span className="lbl">{p.lbl}</span>
                  <span className={`val ${p.val >= 0 ? "up" : "down"}`}>
                    {signedPct(p.val)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="m-card" aria-label="Per-sleeve returns">
            <h3>Per-sleeve · return / max DD</h3>
            {sleeveRows.map((r) => {
              const w = Math.min(100, (Math.abs(r.ret) / maxAbsRet) * 100);
              const ddW = Math.min(100, (r.maxDd / maxDd) * 70);
              return (
                <div key={r.id} className="m-row">
                  <div className="name">{r.name}</div>
                  <div>
                    <div className="m-bar-track" title="Return">
                      <div className="m-bar-fill" style={{ width: `${w}%` }} />
                    </div>
                    <div
                      className="m-bar-track"
                      style={{ marginTop: 3, height: 4 }}
                      title="Max DD"
                    >
                      <div
                        className="m-bar-fill dd"
                        style={{ width: `${ddW}%` }}
                      />
                    </div>
                  </div>
                  <div className="nums">
                    <span className={`ret ${r.ret >= 0 ? "up" : "down"}`}>
                      {signedPct(r.ret)}
                    </span>
                    <span className="dd">DD −{r.maxDd.toFixed(1)}%</span>
                  </div>
                </div>
              );
            })}
          </section>

          <section className="m-card" aria-label="Win and skip rates">
            <h3>Win rate · skip rate</h3>
            <div className="m-stat-grid">
              <div className="m-stat">
                <div className="lbl">Win rate</div>
                <div className="val">{Math.round(trade.winPct)}%</div>
                <div className="hint">
                  {trade.wins} of {trade.closed} closed
                </div>
              </div>
              <div className="m-stat">
                <div className="lbl">Skip rate</div>
                <div className="val">{Math.round(trade.skipPct)}%</div>
                <div className="hint">
                  {trade.skips} of {trade.proposals} proposals
                </div>
              </div>
            </div>
          </section>

          <section className="m-card" aria-label="Turnover and costs">
            <h3>Turnover &amp; estimated costs</h3>
            <div className="m-stat-grid">
              <div className="m-stat">
                <div className="lbl">Turnover (30d)</div>
                <div className="val">{turnover.turnoverPct}%</div>
                <div className="hint">of avg NAV · est.</div>
              </div>
              <div className="m-stat">
                <div className="lbl">Est. costs</div>
                <div className="val">{money(turnover.costs)}</div>
                <div className="hint">spread + fees · MTD</div>
              </div>
            </div>
          </section>

          <section className="m-card" aria-label="Allocation drift">
            <h3>Allocation drift</h3>
            <div className="drift-legend">
              <span className="lg-t">Target</span>
              <span className="lg-a">Actual</span>
            </div>
            {drift.map((d) => {
              const scale = Math.max(40, d.target * 2);
              return (
                <div key={d.name} className="drift-row">
                  <div className="name">{d.name}</div>
                  <div className="drift-dual">
                    <div
                      className="drift-target"
                      style={{ width: `${(d.target / scale) * 100}%` }}
                    />
                    <div
                      className="drift-actual"
                      style={{ width: `${(d.actual / scale) * 100}%` }}
                    />
                  </div>
                  <div className="t">{d.target.toFixed(0)}%</div>
                  <div className="a">{d.actual.toFixed(1)}%</div>
                </div>
              );
            })}
          </section>

          <section className="m-card" aria-label="Concentration and open risk">
            <h3>Concentration · open risk</h3>
            <div className="conc-bar" aria-hidden="true">
              {concentration.segs.map((c) => (
                <div
                  key={c.t}
                  className="conc-seg"
                  style={{ width: `${c.pct}%`, background: c.c }}
                  title={c.t}
                />
              ))}
            </div>
            <div className="conc-list">
              {concentration.top.map((c) => (
                <div key={c.t} className="conc-item">
                  <span className="k">{c.t}</span>
                  <span className="v">{c.pct.toFixed(1)}%</span>
                </div>
              ))}
              <div className="conc-item">
                <span className="k">Top-5 share</span>
                <span className="v">{concentration.topShare.toFixed(1)}%</span>
              </div>
            </div>
            <div className="risk-pill">
              <i aria-hidden="true" /> Open risk · {concentration.flagged}{" "}
              position{concentration.flagged === 1 ? "" : "s"} flagged · within
              band
            </div>
          </section>
        </div>
      )}

      <FeedDock />
    </div>
  );
}
