import { useState } from "react";

function formatTs(ts) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    return d.toLocaleString("en-US", {
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

export default function DecisionList({
  decisions = [],
  dense = false,
  emptyLabel = "No decisions yet.",
}) {
  const [openId, setOpenId] = useState(null);

  if (!decisions.length) {
    return <p className="type-caption">{emptyLabel}</p>;
  }

  return (
    <div
      className={`finances-decisions${dense ? " is-dense" : ""}`}
      role="list"
      aria-label="Decisions"
    >
      {decisions.map((d) => {
        const expanded = openId === d.id;
        const side = (d.side || "").toLowerCase();
        return (
          <div
            key={d.id}
            className="finances-dec"
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
            <div>
              <div className="finances-dec__main">
                {d.strategy || d.agentId}
                {d.symbol ? ` · ${d.symbol}` : ""}
              </div>
              <div className="finances-dec__meta">
                {d.notional != null && d.notional > 0
                  ? `$${Number(d.notional).toFixed(2)} · `
                  : ""}
                {formatTs(d.ts)}
              </div>
            </div>
            <div className={`finances-dec__side fin-side--${side}`}>
              {String(side || "—").toUpperCase()}
            </div>
            {expanded && Array.isArray(d.signals) && d.signals.length ? (
              <div className="finances-signals" aria-label="Signal sources">
                {d.signals.map((sig, i) => (
                  <span key={`${d.id}-sig-${i}`} className="finances-sig">
                    {sig.source}
                    {sig.org ? ` · ${sig.org}` : ""}
                    {sig.url ? (
                      <>
                        {" "}
                        <a
                          href={sig.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          link
                        </a>
                      </>
                    ) : null}
                  </span>
                ))}
                {d.reason ? (
                  <span className="finances-sig finances-sig--reason">{d.reason}</span>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
