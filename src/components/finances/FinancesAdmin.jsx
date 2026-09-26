import { useState } from "react";
import { Link } from "react-router-dom";
import { loadTheme } from "../../storage";
import { useFinances } from "../../finances/useFinances.js";
import FeedDock from "./FeedDock.jsx";
import DecisionList from "./DecisionList.jsx";

export default function FinancesAdmin() {
  const fin = useFinances();
  const [theme] = useState(loadTheme);
  const [resetText, setResetText] = useState("");
  const [runMsg, setRunMsg] = useState("");

  function handleRun() {
    const next = fin.run("admin");
    if (next) {
      setRunMsg(`Run ${next.ops?.lastRunId || "ok"} — paper preview (not committed).`);
    }
  }

  function handleReset() {
    if (resetText !== "RESET") return;
    fin.resetOverlay();
    setResetText("");
    setRunMsg("Overlay cleared · displaying checked-in ledger.");
  }

  const ops = fin.ledger?.ops || {};
  const sleeves = fin.ledger?.sleeves || [];
  const promoteAny = sleeves.some((s) => s.promoteReady);

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
              <p className="sub">Ops · Firstmate</p>
            </div>
          </div>
          <span className="finances-paper-badge">Paper only</span>
        </div>
      </header>

      {fin.isPreview ? (
        <div className="finances-preview-banner" role="status">
          PAPER preview — not committed ledger. Use Download for Firstmate commit.
        </div>
      ) : null}

      <div className="finances-ops-bar">
        <button type="button" className="btn primary" onClick={handleRun} disabled={fin.status !== "ready"}>
          Run today
        </button>
        <button type="button" className="btn" onClick={fin.downloadLedger} disabled={!fin.ledger}>
          Download ledger
        </button>
        <Link className="btn" to="/finances">
          Glance
        </Link>
      </div>
      <p className="type-caption finances-ops-hint">EOD · manual first · sim through engine only</p>
      {runMsg ? <p className="finances-run-msg" role="status">{runMsg}</p> : null}

      <p className="finances-ledger-note">
        Ledger: <code>docs/data/finances-ledger.json</code> on Pages (file-backed). Traders cannot edit balances in UI.
      </p>
      <p className="finances-ledger-note">
        Firstmate issued paper capital · real EOD marks.
      </p>

      {fin.status === "loading" ? (
        <div className="empty">Loading…</div>
      ) : fin.status === "error" ? (
        <div className="empty" role="alert">
          Could not load finances-ledger.json.
        </div>
      ) : (
        <>
          <h2 className="finances-section-h">Sleeves</h2>
          <div className="finances-sleeve-toggles" role="group" aria-label="Sleeve toggles">
            {sleeves.map((s) => {
              const on = s.enabled !== false;
              return (
                <div key={s.id} className="finances-sleeve-row">
                  <span>
                    {s.name}
                    {s.intelAsymmetric ? (
                      <span className="finances-intel finances-intel--inline">intel</span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    className={`finances-toggle${on ? " is-on" : ""}`}
                    aria-pressed={on}
                    aria-label={`${s.name} sleeve ${on ? "on" : "off"}`}
                    onClick={() => fin.setSleeveEnabled(s.id, !on)}
                  >
                    <i aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>

          <h2 className="finances-section-h">Firstmate · ops (not a P&amp;L sleeve)</h2>
          <div className="finances-firstmate">
            <h3 className="type-headline-s">Ops row</h3>
            <div className="finances-fm-flags" aria-label="Firstmate flags">
              <span className="finances-flag is-ready">
                run {ops.lastRunId ? "✓" : "—"}
              </span>
              <span className="finances-flag is-ready">
                rank {(ops.rankOrder || []).length ? "✓" : "—"}
              </span>
              <span className={`finances-flag${promoteAny ? " is-warn" : ""}`}>
                promote-ready{promoteAny ? "" : " off"}
              </span>
            </div>
            {ops.lastRunId ? (
              <p className="type-caption">lastRunId · {ops.lastRunId}</p>
            ) : null}
            {ops.notes ? <p className="type-caption">{ops.notes}</p> : null}
          </div>

          <h2 className="finances-section-h">Positions</h2>
          <div className="finances-pos-wrap">
            <table className="finances-pos-table" aria-label="Open positions">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Qty</th>
                  <th>Sleeve</th>
                  <th>MTM</th>
                </tr>
              </thead>
              <tbody>
                {fin.allPositions.length === 0 ? (
                  <tr>
                    <td colSpan={4}>No open positions</td>
                  </tr>
                ) : (
                  fin.allPositions.map((r) => (
                    <tr key={`${r.sleeveId}-${r.symbol}`}>
                      <td>{r.symbol}</td>
                      <td>{Number(r.qty).toFixed(4)}</td>
                      <td>{r.sleeveName}</td>
                      <td>${r.mtm.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <h2 className="finances-section-h">Decision log</h2>
          <DecisionList
            decisions={(fin.ledger?.decisions || []).slice(0, 24)}
            dense
          />

          <div className="finances-reset" aria-label="Reset all with typed confirm">
            <p>
              <strong>Reset all</strong> — ops only. Clears session preview overlay and reloads the
              checked-in ledger. Type <code>RESET</code> to enable.
            </p>
            <label className="visually-hidden" htmlFor="finances-reset-input">
              Type RESET to confirm
            </label>
            <input
              id="finances-reset-input"
              type="text"
              placeholder="Type RESET"
              autoComplete="off"
              spellCheck={false}
              value={resetText}
              onChange={(e) => setResetText(e.target.value)}
            />
            <button
              type="button"
              className="btn finances-btn-danger"
              disabled={resetText !== "RESET"}
              aria-disabled={resetText !== "RESET"}
              onClick={handleReset}
            >
              Reset all sleeves
            </button>
          </div>
        </>
      )}

      <FeedDock />
    </>
  );
}
