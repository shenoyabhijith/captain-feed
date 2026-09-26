export default function SleeveCard({ sleeve, stats, selected, onSelect }) {
  const la = sleeve.lastAction || {};
  const side = (la.side || "").toLowerCase();
  const pnlClass = stats.pnlPct >= 0 ? "fin-up" : "fin-down";

  return (
    <article
      className={`finances-sleeve${selected ? " is-selected" : ""}`}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={() => onSelect?.(sleeve.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.(sleeve.id);
        }
      }}
    >
      <div className="finances-sleeve__top">
        <div>
          <h3 className="finances-sleeve__name">{sleeve.name}</h3>
          <p className="finances-sleeve__persona">{sleeve.persona}</p>
        </div>
        {sleeve.intelAsymmetric ? (
          <span className="finances-intel" title="Intel-asymmetric sleeve (Align Q2B)">
            Intel-asym
          </span>
        ) : null}
      </div>
      <div className="finances-sleeve__metrics">
        <div>
          <span>NAV</span>
          <strong>${stats.nav.toFixed(2)}</strong>
        </div>
        <div>
          <span>P&amp;L</span>
          <strong className={pnlClass}>
            {stats.pnlPct >= 0 ? "+" : ""}
            {stats.pnlPct.toFixed(1)}%
          </strong>
        </div>
        <div>
          <span>Cash</span>
          <strong>{stats.cashPct.toFixed(0)}%</strong>
        </div>
      </div>
      <p className="finances-sleeve__action">
        <span className={`fin-side fin-side--${side}`}>{String(side || "—").toUpperCase()}</span>
        {la.symbol ? ` ${la.symbol}` : ""}
        {la.reason ? ` · “${la.reason}”` : ""}
      </p>
      <p className="finances-sleeve__start type-caption">Start ${stats.starting}</p>
    </article>
  );
}
