import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

function sideBadgeVariant(side) {
  if (side === "buy") return "success";
  if (side === "sell") return "error";
  return "secondary";
}

function SleeveHead({ sleeve, stats, dayPnl = 0, dayPnlPct = 0 }) {
  const up = (stats?.pnl || 0) >= 0;
  const dayUp = dayPnl >= 0;
  return (
    <div className="fin-bot-card-head">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="m-0 font-semibold text-[0.9375rem] leading-tight">
            {sleeve.name}
          </h3>
          <p className="m-0 text-muted-foreground text-xs font-normal">
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
      <div className="flex items-baseline justify-between gap-3">
        <p className="m-0 font-semibold text-[1.35rem] tabular-nums tracking-tight">
          {money(stats.nav)}
        </p>
        <div
          className={`text-right text-[0.8125rem] tabular-nums font-semibold ${
            dayUp ? "text-success-foreground" : "text-destructive-foreground"
          }`}
        >
          {signedMoney(dayPnl)}{" "}
          <span className="text-[0.7rem] font-medium opacity-85">
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
    </div>
  );
}

function LastDecisionBlock({ lastAction }) {
  const la = lastAction || {};
  const side = (la.side || "").toLowerCase();
  return (
    <div
      className="fin-last-dec rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs"
      aria-label="Last decision"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={sideBadgeVariant(side)}
          size="sm"
          className="uppercase tracking-wide font-bold"
        >
          {String(side || "—").toUpperCase()}
        </Badge>
        {la.symbol ? (
          <span className="font-medium tabular-nums">{la.symbol}</span>
        ) : null}
      </div>
      {la.reason ? (
        <p className="mt-1 text-muted-foreground text-[0.6875rem] leading-snug">
          {la.reason}
        </p>
      ) : null}
    </div>
  );
}

function HoldingsTable({ sleeve, holdings }) {
  return (
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
  );
}

function SleeveBody({
  sleeve,
  stats,
  marks = {},
  showDecisions = false,
  decisions = [],
  onViewSleeve,
}) {
  const invested = investedPct(stats);
  const holdings = sleeveHoldings(sleeve, marks, stats);
  const alloc = holdings.filter((h) => h.pct > 0);

  return (
    <div className="fin-bot-card-body">
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

      <HoldingsTable sleeve={sleeve} holdings={holdings} />

      {/* Document flow BELOW holdings — never absolute/sticky overlay */}
      <LastDecisionBlock lastAction={sleeve.lastAction} />

      {onViewSleeve ? (
        <Button
          type="button"
          variant="outline"
          className="fin-view-sleeve min-h-12 w-full shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onViewSleeve();
          }}
        >
          View sleeve
        </Button>
      ) : null}

      {showDecisions && decisions.length > 0 ? (
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

/**
 * Dense sleeve panel. layout="carousel" → head + scrollable body for R4 cards.
 * Default = stacked panel (legacy R3 density / sheet detail body).
 */
export default function SleevePanel({
  sleeve,
  stats,
  marks = {},
  dayPnl = 0,
  dayPnlPct = 0,
  decisions = [],
  layout = "stack",
  onViewSleeve,
}) {
  if (layout === "carousel") {
    return (
      <>
        <SleeveHead
          sleeve={sleeve}
          stats={stats}
          dayPnl={dayPnl}
          dayPnlPct={dayPnlPct}
        />
        <SleeveBody
          sleeve={sleeve}
          stats={stats}
          marks={marks}
          showDecisions={false}
          onViewSleeve={onViewSleeve}
        />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-3 text-foreground">
      <SleeveHead
        sleeve={sleeve}
        stats={stats}
        dayPnl={dayPnl}
        dayPnlPct={dayPnlPct}
      />
      <SleeveBody
        sleeve={sleeve}
        stats={stats}
        marks={marks}
        showDecisions
        decisions={decisions}
      />
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
