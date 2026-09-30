import { useMemo } from "react";
import {
  Frame,
  FrameHeader,
  FrameTitle,
  FrameDescription,
  FramePanel,
} from "@/components/ui/frame";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import EquityChart, {
  Sparkline,
  synthesizeEquitySeries,
} from "./EquityChart.jsx";
import {
  formatAsOf,
  money,
  signedMoney,
  signedPct,
} from "./financesFormat.js";

const CHART = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const SIGNAL_ORDER = ["feed", "x", "reddit", "institute", "web"];

/** Sample personality trade stats (consistent with sleeve roles). Merged with live decisions. */
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

function buildTradeStats(sleeves, decisions) {
  const byBot = {};
  for (const s of sleeves) {
    const sample = SAMPLE_TRADE[s.id] || { wins: 5, losses: 3, skips: 8 };
    const mine = decisions.filter((d) => d.agentId === s.id);
    let skips = sample.skips;
    let wins = sample.wins;
    let losses = sample.losses;
    if (mine.length) {
      const liveSkip = mine.filter((d) =>
        ["skip", "hold"].includes(String(d.side || "").toLowerCase())
      ).length;
      const liveTrade = mine.length - liveSkip;
      // Prefer sample personality; bump skips when live data shows defensive bent
      if (liveSkip > skips) skips = liveSkip;
      if (liveTrade > wins + losses) {
        const extra = liveTrade - (wins + losses);
        wins += Math.ceil(extra * 0.6);
        losses += Math.floor(extra * 0.4);
      }
    }
    byBot[s.id] = {
      id: s.id,
      name: s.name,
      wins,
      losses,
      skips,
      hit: hitRate(wins, losses),
      decisions: mine.length,
    };
  }
  const rollup = Object.values(byBot).reduce(
    (acc, b) => {
      acc.wins += b.wins;
      acc.losses += b.losses;
      acc.skips += b.skips;
      acc.decisions += b.wins + b.losses + b.skips;
      return acc;
    },
    { wins: 0, losses: 0, skips: 0, decisions: 0 }
  );
  rollup.hit = hitRate(rollup.wins, rollup.losses);
  return { byBot, rollup };
}

function signalBreakdown(decisions) {
  const counts = Object.fromEntries(SIGNAL_ORDER.map((s) => [s, 0]));
  let total = 0;
  for (const d of decisions) {
    const sigs = d.signals || [];
    if (!sigs.length) {
      const src = d.signalSource;
      if (src && src in counts) {
        counts[src] += 1;
        total += 1;
      }
      continue;
    }
    for (const sig of sigs) {
      const src = String(sig.source || "").toLowerCase();
      if (src in counts) {
        counts[src] += 1;
        total += 1;
      }
    }
  }
  // If ledger is thin, seed sample distribution matching R4 mock personality
  if (total < 8) {
    const seed = { feed: 42, x: 28, institute: 18, reddit: 15, web: 12 };
    for (const k of SIGNAL_ORDER) counts[k] = seed[k] || 0;
    total = SIGNAL_ORDER.reduce((a, k) => a + counts[k], 0);
  }
  return SIGNAL_ORDER.map((source) => ({
    source,
    count: counts[source],
    share: total > 0 ? Math.round((counts[source] / total) * 1000) / 10 : 0,
  }));
}

function botDecisionVolume(sleeves, decisions) {
  const rows = sleeves.map((s) => {
    const count = decisions.filter((d) => d.agentId === s.id).length;
    return { id: s.id, name: s.name, count };
  });
  let total = rows.reduce((a, r) => a + r.count, 0);
  if (total < 8) {
    // Sample volume consistent with trade activity personality
    const seed = {
      swing: 31,
      mega: 24,
      value: 22,
      coresat: 18,
      riskoff: 12,
    };
    for (const r of rows) r.count = seed[r.id] ?? 10;
    total = rows.reduce((a, r) => a + r.count, 0);
  }
  return rows
    .map((r) => ({
      ...r,
      share: total > 0 ? Math.round((r.count / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

function topHoldings(sleeves, marks, totalNav) {
  const map = {};
  for (const s of sleeves) {
    for (const p of s.positions || []) {
      const px = marks[p.symbol] ?? p.avgPrice ?? 0;
      const mkt = Math.round(p.qty * px * 100) / 100;
      map[p.symbol] = (map[p.symbol] || 0) + mkt;
    }
  }
  const rows = Object.entries(map)
    .map(([symbol, mkt]) => ({
      symbol,
      mkt: Math.round(mkt * 100) / 100,
      pct: totalNav > 0 ? Math.round((mkt / totalNav) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.mkt - a.mkt)
    .slice(0, 5);
  const max = rows[0]?.mkt || 1;
  return rows.map((r, i) => ({
    ...r,
    bar: Math.round((r.mkt / max) * 100),
    color: CHART[i % CHART.length],
  }));
}

/**
 * Analytics pack — sticky title + equity / leaderboard / trades / allocation / decision dual breakdown.
 */
export default function AdminAnalytics({ fin }) {
  const sleeves = fin.ledger?.sleeves || [];
  const decisions = fin.ledger?.decisions || [];
  const marks = fin.marks || {};
  const asOf = fin.ledger?.meta?.asOf;
  const nav = fin.stats?.nav || 0;
  const pnl = fin.stats?.pnl || 0;
  const pnlPct = fin.stats?.pnlPct || 0;
  const startTotal = sleeves.reduce(
    (a, s) => a + (s.startingCash ?? 100),
    0
  );

  const portfolioSeries = useMemo(() => {
    const eq = fin.ledger?.equity || [];
    if (eq.length >= 8) return eq;
    return synthesizeEquitySeries(startTotal || 500, nav || startTotal || 500, 21, 7);
  }, [fin.ledger, nav, startTotal]);

  const sleeveSeries = useMemo(() => {
    return sleeves.map((s, i) => {
      const stats = fin.sleeveStats(s);
      const end = stats.nav || 100;
      const series = synthesizeEquitySeries(100, end, 18, 11 + i * 3);
      return {
        id: s.id,
        name: s.name,
        nav: end,
        pnl: stats.pnl,
        series,
        stroke:
          end >= 100
            ? CHART[i % CHART.length]
            : "var(--destructive)",
      };
    });
  }, [sleeves, fin]);

  const leaderboard = useMemo(() => {
    return sleeves
      .map((s) => {
        const stats = fin.sleeveStats(s);
        return {
          id: s.id,
          name: s.name,
          persona: s.persona,
          pnl: stats.pnl,
          pnlPct: stats.pnlPct,
          nav: stats.nav,
        };
      })
      .sort((a, b) => b.pnl - a.pnl)
      .map((row, i) => ({ ...row, rank: i + 1 }));
  }, [sleeves, fin]);

  const trades = useMemo(
    () => buildTradeStats(sleeves, decisions),
    [sleeves, decisions]
  );

  const mix = useMemo(() => {
    return sleeves.map((s, i) => {
      const stats = fin.sleeveStats(s);
      const pct = nav > 0 ? Math.round((stats.nav / nav) * 1000) / 10 : 0;
      return {
        id: s.id,
        name: s.name,
        nav: stats.nav,
        pct,
        color: CHART[i % CHART.length],
      };
    });
  }, [sleeves, fin, nav]);

  const holdings = useMemo(
    () => topHoldings(sleeves, marks, nav),
    [sleeves, marks, nav]
  );

  const bySource = useMemo(() => signalBreakdown(decisions), [decisions]);
  const byBot = useMemo(
    () => botDecisionVolume(sleeves, decisions),
    [sleeves, decisions]
  );

  const sampleNote = `${portfolioSeries.length} sessions · from $100/sleeve`;

  return (
    <div className="flex flex-col gap-4">
      <div
        className="admin-analytics-sticky"
        aria-label="Analytics section"
      >
        <p className="ax-kicker">Analytics</p>
        <h2 className="ax-title font-heading">Paper desk metrics</h2>
        <p className="ax-meta">
          asOf {formatAsOf(asOf) || "—"} · sample EOD · {sampleNote}
        </p>
      </div>

      <Frame aria-labelledby="ax-equity-title">
        <FrameHeader>
          <FrameTitle id="ax-equity-title">Equity curves</FrameTitle>
          <FrameDescription>
            Portfolio total + per-bot mini · native SVG · chart tokens
          </FrameDescription>
        </FrameHeader>
        <FramePanel className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">
              Portfolio · {money(startTotal)} → {money(nav)}
            </span>
            <span
              className={`font-semibold tabular-nums ${
                pnl >= 0
                  ? "text-success-foreground"
                  : "text-destructive-foreground"
              }`}
            >
              {signedMoney(pnl)} · {signedPct(pnlPct)}
            </span>
          </div>
          <EquityChart
            points={portfolioSeries}
            label="Sample EOD · portfolio"
            stroke="var(--chart-2)"
            gradientId="admin-eq-fill"
          />
          <div
            className="grid grid-cols-2 gap-2"
            aria-label="Per-bot mini equity curves"
          >
            {sleeveSeries.map((s) => (
              <div
                key={s.id}
                className={`rounded-lg border border-border bg-muted/30 px-2.5 py-2 ${
                  s.id === "riskoff" ? "col-span-2" : ""
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="m-0 text-xs font-medium">{s.name}</p>
                  <p
                    className={`m-0 text-xs font-semibold tabular-nums ${
                      s.pnl >= 0
                        ? "text-success-foreground"
                        : "text-destructive-foreground"
                    }`}
                  >
                    {money(s.nav)}
                  </p>
                </div>
                <Sparkline points={s.series} stroke={s.stroke} />
              </div>
            ))}
          </div>
          <p className="text-muted-foreground text-[0.6875rem]">
            Sample EOD series · {portfolioSeries.length} points · path to current
            sleeve NAVs.
          </p>
        </FramePanel>
      </Frame>

      <Frame aria-labelledby="ax-board-title">
        <FrameHeader>
          <FrameTitle id="ax-board-title">Bot leaderboard</FrameTitle>
          <FrameDescription>
            Ranked by P&amp;L $ · return % from $100 start
          </FrameDescription>
        </FrameHeader>
        <FramePanel className="p-2 sm:p-3">
          <div
            className="flex flex-col gap-0"
            role="list"
            aria-label="Bot leaderboard ranked 1 to 5"
          >
            {leaderboard.map((row) => (
              <div
                key={row.id}
                className="flex min-h-12 items-center gap-3 border-b border-border px-2 py-2 last:border-0"
                role="listitem"
                data-rank={row.rank}
              >
                <span
                  className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted font-bold text-xs tabular-nums"
                  aria-label={`Rank ${row.rank}`}
                >
                  {row.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-sm font-semibold">{row.name}</p>
                  <p className="m-0 truncate text-muted-foreground text-[0.65rem]">
                    {row.persona}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={`m-0 text-sm font-semibold tabular-nums ${
                      row.pnl >= 0
                        ? "text-success-foreground"
                        : "text-destructive-foreground"
                    }`}
                  >
                    {signedMoney(row.pnl)}
                  </p>
                  <p className="m-0 text-muted-foreground text-[0.65rem] tabular-nums">
                    {signedPct(row.pnlPct)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </FramePanel>
      </Frame>

      <Frame aria-labelledby="ax-trades-title">
        <FrameHeader>
          <FrameTitle id="ax-trades-title">Trade stats</FrameTitle>
          <FrameDescription>
            Wins · losses · skips · hit rate · per bot + rollup
          </FrameDescription>
        </FrameHeader>
        <FramePanel className="p-4">
          <div className="grid grid-cols-2 gap-2">
            {sleeves.map((s) => {
              const t = trades.byBot[s.id];
              if (!t) return null;
              return (
                <div
                  key={s.id}
                  className="rounded-lg border border-border bg-muted/30 px-3 py-2"
                >
                  <p className="m-0 text-xs font-semibold">{t.name}</p>
                  <p className="m-0 text-muted-foreground text-[0.7rem]">
                    W {t.wins} · L {t.losses} · Skip {t.skips}
                  </p>
                  <p className="m-0 text-xs font-medium tabular-nums">
                    Hit {t.hit}%
                  </p>
                </div>
              );
            })}
            <div className="col-span-2 rounded-lg border border-primary/40 bg-muted/40 px-3 py-2">
              <p className="m-0 text-xs font-semibold">Portfolio rollup</p>
              <p className="m-0 text-muted-foreground text-[0.7rem]">
                W {trades.rollup.wins} · L {trades.rollup.losses} · Skip{" "}
                {trades.rollup.skips} · {trades.rollup.decisions} decisions
              </p>
              <p className="m-0 text-xs font-medium tabular-nums">
                Hit {trades.rollup.hit}%
              </p>
            </div>
          </div>
          <p className="mt-2 text-muted-foreground text-[0.6875rem]">
            RiskOff fewer trades (high skip); Swing most active — sample
            consistent with sleeve personality.
          </p>
        </FramePanel>
      </Frame>

      <Frame aria-labelledby="ax-alloc-title">
        <FrameHeader>
          <FrameTitle id="ax-alloc-title">Allocation / exposure</FrameTitle>
          <FrameDescription>
            Sleeve NAV mix + top holdings · meters
          </FrameDescription>
        </FrameHeader>
        <FramePanel className="flex flex-col gap-4 p-4">
          <div>
            <div className="mb-2 flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">
                Across sleeves vs total {money(nav)}
              </span>
              <span className="text-muted-foreground">
                {sleeves.length} sleeves
              </span>
            </div>
            <div
              className="flex h-3 w-full overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label="Sleeve NAV stacked bar"
            >
              {mix.map((m) => (
                <i
                  key={m.id}
                  className="block h-full"
                  style={{ width: `${m.pct}%`, background: m.color }}
                  title={m.name}
                />
              ))}
            </div>
            <div className="mt-2 flex flex-col gap-1">
              {mix.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 text-[0.7rem]"
                >
                  <span
                    className="inline-block size-2.5 rounded-sm"
                    style={{ background: m.color }}
                  />
                  <span className="flex-1 font-medium">{m.name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {money(m.nav)} · {m.pct}%
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">
                Top holdings across portfolio
              </span>
              <span className="text-muted-foreground">by MV</span>
            </div>
            <div className="flex flex-col gap-2">
              {holdings.map((h) => (
                <div key={h.symbol}>
                  <div className="mb-0.5 flex justify-between text-[0.7rem]">
                    <span className="font-semibold tabular-nums">{h.symbol}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {money(h.mkt)} · {h.pct}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${h.bar}%`,
                        background: h.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </FramePanel>
      </Frame>

      <Frame aria-labelledby="ax-dec-title">
        <FrameHeader>
          <FrameTitle id="ax-dec-title">Decision log analytics</FrameTitle>
          <FrameDescription>
            Volume by signalSource · by bot
          </FrameDescription>
        </FrameHeader>
        <FramePanel className="flex flex-col gap-4 p-4">
          <div>
            <p className="mb-2 text-muted-foreground text-[0.6875rem]">
              By signal source{" "}
              {SIGNAL_ORDER.map((s) => (
                <code key={s} className="mx-0.5">
                  {s}
                </code>
              ))}
            </p>
            <Table variant="card" aria-label="Decisions by signal source">
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead className="text-right">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bySource.map((r) => (
                  <TableRow key={r.source}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[0.65rem]">
                        {r.source}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.count}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.share}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div>
            <p className="mb-2 text-muted-foreground text-[0.6875rem]">
              By bot (decision volume)
            </p>
            <Table variant="card" aria-label="Decisions by bot">
              <TableHeader>
                <TableRow>
                  <TableHead>Bot</TableHead>
                  <TableHead className="text-right">Decisions</TableHead>
                  <TableHead className="text-right">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byBot.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-semibold">{r.name}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.count}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.share}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </FramePanel>
      </Frame>
    </div>
  );
}
