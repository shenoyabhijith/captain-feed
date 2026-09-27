import { Badge } from "@/components/ui/badge";
import {
  Meter,
  MeterLabel,
  MeterTrack,
  MeterIndicator,
  MeterValue,
} from "@/components/ui/meter";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import DecisionList from "./DecisionList.jsx";
import {
  investedPct,
  money,
  signedMoney,
  signedPct,
  sleeveHoldings,
} from "./financesFormat.js";

/** Shared outline treatment so PAPER ONLY / Intel-asym read as badges, not plain text. */
export const outlineBadgeClass =
  "border border-primary text-primary uppercase tracking-wide text-[0.625rem] font-bold px-2 py-1 h-auto min-w-0 sm:h-auto sm:min-w-0 sm:text-[0.625rem]";

/**
 * Always-visible dense sleeve panel: summary + Meter + holdings Table +
 * last action + optional filtered decisions (no accordion).
 */
export default function SleevePanel({
  sleeve,
  stats,
  marks = {},
  dayPnl = 0,
  dayPnlPct = 0,
  decisions = [],
}) {
  const la = sleeve.lastAction || {};
  const side = (la.side || "").toLowerCase();
  const up = (stats?.pnl || 0) >= 0;
  const dayUp = dayPnl >= 0;
  const invested = investedPct(stats);
  const holdings = sleeveHoldings(sleeve, marks, stats);
  const alloc = holdings.filter((h) => h.pct > 0);

  return (
    <div className="flex flex-col gap-3 text-foreground">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="font-semibold text-base leading-tight">{sleeve.name}</h4>
          <p className="text-muted-foreground text-xs font-normal">
            {sleeve.persona}
          </p>
        </div>
        {sleeve.intelAsymmetric ? (
          <Badge
            variant="outline"
            className={outlineBadgeClass}
            title="Align Q2B — intel-asymmetric"
          >
            Intel-asym
          </Badge>
        ) : null}
      </div>

      <div className="flex items-end justify-between gap-3">
        <p className="font-semibold text-2xl tabular-nums tracking-tight">
          {money(stats.nav)}
        </p>
        <div
          className={`text-right text-sm tabular-nums font-medium ${
            dayUp ? "text-success-foreground" : "text-destructive-foreground"
          }`}
        >
          {signedMoney(dayPnl)}{" "}
          <span className="text-xs font-medium opacity-80">
            {signedPct(dayPnlPct)} day
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground text-xs font-normal">
        <span>
          Cash <strong className="text-foreground">{money(sleeve.cash)}</strong>
        </span>
        <span>
          Start <strong className="text-foreground">{money(stats.starting)}</strong>
        </span>
        <span>
          Total{" "}
          <strong
            className={up ? "text-success-foreground" : "text-destructive-foreground"}
          >
            {signedMoney(stats.pnl)}
          </strong>
        </span>
      </div>

      <Meter value={invested} max={100} className="gap-1">
        <div className="flex items-center justify-between gap-2">
          <MeterLabel className="text-muted-foreground text-xs font-normal">
            Invested
          </MeterLabel>
          <MeterValue className="text-xs" />
        </div>
        <MeterTrack className="h-2 rounded-full bg-muted">
          <MeterIndicator className="rounded-full bg-[var(--chart-2)]" />
        </MeterTrack>
      </Meter>

      <div
        className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
        aria-hidden="true"
      >
        {alloc.map((h) => (
          <i
            key={h.key}
            className="block h-full"
            style={{
              width: `${h.pct}%`,
              background: h.color,
              opacity: h.isCash ? 0.35 : 1,
            }}
          />
        ))}
      </div>
      <div
        className="flex flex-wrap gap-x-3 gap-y-1 text-[0.65rem] text-muted-foreground font-normal"
        aria-hidden="true"
      >
        {alloc.map((h) => (
          <span key={`leg-${h.key}`} className="inline-flex items-center gap-1">
            <b
              className="inline-block size-2 rounded-sm"
              style={{ background: h.color, opacity: h.isCash ? 0.35 : 1 }}
            />
            {h.symbol} {h.pct}%
          </span>
        ))}
      </div>

      <Table variant="card" aria-label={`${sleeve.name} holdings`}>
        <TableHeader>
          <TableRow>
            <TableHead>Ticker</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Mkt</TableHead>
            <TableHead className="text-right">%</TableHead>
            <TableHead className="text-right">uP&amp;L</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {holdings.map((h) => (
            <TableRow key={h.key}>
              <TableCell>
                <span className="font-semibold tabular-nums">{h.symbol}</span>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {h.qty == null ? "—" : Number(h.qty).toFixed(3)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {money(h.mkt)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {h.pct.toFixed(1)}
              </TableCell>
              <TableCell
                className={`text-right tabular-nums ${
                  h.uPnl == null
                    ? ""
                    : h.uPnl >= 0
                      ? "text-success-foreground"
                      : "text-destructive-foreground"
                }`}
              >
                {h.uPnl == null ? "—" : signedMoney(h.uPnl)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`font-semibold uppercase ${
              side === "buy"
                ? "text-success-foreground"
                : side === "sell"
                  ? "text-destructive-foreground"
                  : "text-muted-foreground"
            }`}
          >
            {String(side || "—")}
          </span>
          {la.symbol ? <span>{la.symbol}</span> : null}
          {la.reason ? (
            <span className="text-muted-foreground">· {la.reason}</span>
          ) : null}
        </div>
      </div>

      {decisions.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="font-medium text-foreground text-xs">
            Recent decisions · {sleeve.name}
          </p>
          <DecisionList
            decisions={decisions}
            dense
            emptyLabel="No decisions for this sleeve."
          />
        </div>
      ) : null}
    </div>
  );
}

/** @deprecated Prefer default SleevePanel */
export function SleeveSummary(props) {
  return <SleevePanel {...props} />;
}

/** @deprecated Prefer default SleevePanel */
export function SleeveDetail(props) {
  return <SleevePanel {...props} />;
}
