/** Daily EOD equity curve — SVG, no tick flicker. */
export default function EquityChart({ points = [], label = "Equity · daily (not tick)" }) {
  if (!points.length) {
    return (
      <section className="finances-chart" aria-label="Equity curve">
        <p className="finances-chart__label">{label}</p>
        <p className="type-caption">No equity points yet.</p>
      </section>
    );
  }

  const vals = points.map((p) => p.nav);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = Math.max(max - min, 1);
  const w = 300;
  const h = 72;
  const padX = 4;
  const padY = 8;
  const coords = points.map((p, i) => {
    const x =
      points.length === 1
        ? w / 2
        : padX + (i / (points.length - 1)) * (w - padX * 2);
    const y = padY + (1 - (p.nav - min) / span) * (h - padY * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const last = coords[coords.length - 1].split(",");
  const up = vals[vals.length - 1] >= vals[0];

  return (
    <section className="finances-chart" aria-label="Equity curve">
      <p className="finances-chart__label">{label}</p>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Daily equity from ${min.toFixed(0)} to ${max.toFixed(0)}`}>
        <polyline
          fill="none"
          stroke={up ? "var(--fin-up)" : "var(--fin-down)"}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={coords.join(" ")}
        />
        <circle cx={last[0]} cy={last[1]} r="3.5" fill={up ? "var(--fin-up)" : "var(--fin-down)"} />
      </svg>
    </section>
  );
}
