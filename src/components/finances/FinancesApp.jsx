import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadTheme } from "../../storage";
import { useFinances } from "../../finances/useFinances.js";
import FeedDock from "./FeedDock.jsx";
import EquityChart from "./EquityChart.jsx";
import SleeveCard from "./SleeveCard.jsx";
import DecisionList from "./DecisionList.jsx";

function formatAsOf(iso) {
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

export default function FinancesApp() {
  const fin = useFinances();
  const [theme] = useState(loadTheme);
  const [filterAgent, setFilterAgent] = useState(null);

  const decisions = useMemo(() => {
    const list = fin.ledger?.decisions || [];
    if (!filterAgent) return list.slice(0, 12);
    return list.filter((d) => d.agentId === filterAgent).slice(0, 20);
  }, [fin.ledger, filterAgent]);

  const markSrc = fin.ledger?.meta?.priceSource || "yahoo";
  const asOf = fin.ledger?.meta?.asOf;

  return (
    <>
      <header className="finances-header">
        <div className="finances-brand">
          <div className="brand-lockup">
            <img
              className="brand-mark"
              src={`${import.meta.env.BASE_URL}icons/${theme === "dark" ? "mark-28-dark.png" : "mark-28-light.png"}`}
              width={28}
              height={28}
              alt=""
            />
            <div className="brand-text">
              <h1>Captain Feed</h1>
              <p className="sub">Paper desk · EOD</p>
            </div>
          </div>
          <span className="finances-paper-badge" title="Simulated paper trading only">
            Paper only
          </span>
        </div>
      </header>

      {fin.isPreview ? (
        <div className="finances-preview-banner" role="status">
          PAPER preview — not committed ledger. Download JSON for Firstmate to commit, or reset overlay.
        </div>
      ) : null}

      {fin.status === "loading" ? (
        <div className="empty">Loading ledger…</div>
      ) : fin.status === "error" ? (
        <div className="empty" role="alert">
          Could not load finances-ledger.json.
        </div>
      ) : (
        <>
          <section className="finances-summary" aria-label="Portfolio summary">
            <p className="finances-summary__label">Total NAV</p>
            <p className="finances-summary__nav">${fin.stats.nav.toFixed(2)}</p>
            <div className="finances-summary__row">
              <div className="finances-stat">
                <span>P&amp;L</span>
                <strong className={fin.stats.pnl >= 0 ? "fin-up" : "fin-down"}>
                  {fin.stats.pnl >= 0 ? "+" : ""}
                  ${fin.stats.pnl.toFixed(2)} · {fin.stats.pnlPct >= 0 ? "+" : ""}
                  {fin.stats.pnlPct.toFixed(1)}%
                </strong>
              </div>
              <div className="finances-stat">
                <span>Cash</span>
                <strong>{fin.stats.cashPct.toFixed(1)}%</strong>
              </div>
              <div className="finances-stat">
                <span>Sleeves</span>
                <strong>
                  {fin.stats.enabledCount} / {fin.stats.total} on
                </strong>
              </div>
            </div>
          </section>

          <EquityChart points={fin.ledger?.equity || []} />

          <div className="finances-section-head">
            <h2 className="finances-section-h">Agents · $100 start</h2>
            <Link className="finances-admin-link" to="/finances/admin">
              Admin
            </Link>
          </div>

          <div className="finances-agents" aria-label="Five agent sleeves">
            {(fin.ledger?.sleeves || []).map((s) => (
              <SleeveCard
                key={s.id}
                sleeve={s}
                stats={fin.sleeveStats(s)}
                selected={filterAgent === s.id}
                onSelect={(id) =>
                  setFilterAgent((prev) => (prev === id ? null : id))
                }
              />
            ))}
          </div>

          <h2 className="finances-section-h">
            Recent decisions
            {filterAgent
              ? ` · ${fin.ledger.sleeves.find((s) => s.id === filterAgent)?.name || filterAgent}`
              : ""}
          </h2>
          {filterAgent ? (
            <button
              type="button"
              className="finances-clear-filter"
              onClick={() => setFilterAgent(null)}
            >
              Clear sleeve filter
            </button>
          ) : (
            <p className="finances-expand-hint">
              Tap a sleeve to filter · tap a row to expand signal chips
            </p>
          )}
          <DecisionList decisions={decisions} />

          <p className="finances-asof">
            asOf · {formatAsOf(asOf)} · {markSrc} · paper
          </p>
          <p className="finances-ledger-note">
            {fin.ledger?.meta?.note ||
              "Firstmate issued paper capital · real EOD marks."}
          </p>
        </>
      )}

      <FeedDock />
    </>
  );
}
