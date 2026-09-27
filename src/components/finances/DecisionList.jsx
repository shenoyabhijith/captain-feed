import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { formatTs, money } from "./financesFormat.js";

export default function DecisionList({
  decisions = [],
  dense = false,
  emptyLabel = "No decisions yet.",
}) {
  const [openId, setOpenId] = useState(null);

  if (!decisions.length) {
    return <p className="text-muted-foreground text-xs">{emptyLabel}</p>;
  }

  return (
    <div
      className={`flex flex-col ${dense ? "gap-1.5" : "gap-2"}`}
      role="list"
      aria-label="Decisions"
    >
      {decisions.map((d) => {
        const expanded = openId === d.id;
        const side = (d.side || "").toLowerCase();
        const sideClass =
          side === "buy"
            ? "text-success-foreground"
            : side === "sell"
              ? "text-destructive-foreground"
              : "text-muted-foreground";
        return (
          <div
            key={d.id}
            className={`grid cursor-pointer grid-cols-[1fr_auto] gap-x-3 gap-y-1 rounded-lg border border-border bg-card px-3 py-2.5 ${
              dense ? "text-xs" : "text-sm"
            }`}
            role="listitem"
            tabIndex={0}
            aria-expanded={expanded}
            onClick={() => setOpenId(expanded ? null : d.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setOpenId(expanded ? null : d.id);
              }
            }}
          >
            <div className="min-w-0">
              <div className="font-medium text-foreground">
                {d.strategy || d.agentId}
                {d.symbol ? ` · ${d.symbol}` : ""}
              </div>
              <div className="text-muted-foreground text-xs">
                {d.notional != null && d.notional > 0
                  ? `${money(d.notional)} · `
                  : ""}
                {formatTs(d.ts)}
              </div>
            </div>
            <div
              className={`self-center font-semibold tabular-nums ${sideClass}`}
            >
              {String(side || "—").toUpperCase()}
            </div>
            {expanded ? (
              <div
                className="col-span-2 flex flex-col gap-2 border-t border-border pt-2"
                aria-label="Signal sources"
              >
                {d.reason ? (
                  <p className="text-muted-foreground text-xs">{d.reason}</p>
                ) : null}
                <div className="flex flex-wrap gap-1.5">
                  {(d.signals || []).map((sig, i) => (
                    <Badge
                      key={`${d.id}-sig-${i}`}
                      variant="outline"
                      className="gap-1"
                    >
                      {sig.source}
                      {sig.org ? (
                        <span className="text-muted-foreground">· {sig.org}</span>
                      ) : null}
                      {sig.url ? (
                        <a
                          href={sig.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline underline-offset-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          link
                        </a>
                      ) : null}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
