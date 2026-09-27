/** Daily EOD equity curve — SVG, no tick flicker. Uses coss chart tokens. */

export default function EquityChart({
  points = [],
  label = "Equity · daily EOD (not tick)",
}) {
  if (!points.length) {
    return (
      <div className="flex flex-col gap-1" aria-label="Equity curve">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="text-muted-foreground text-xs">No equity points yet.</p>
      </div>
    );
  }

  const vals = points.map((p) => p.nav);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = Math.max(max - min, 1);
  const w = 300;
  const h = 64;
  const padX = 4;
  const padY = 8;
  const coords = points.map((p, i) => {
    const x =
      points.length === 1
        ? w / 2
        : padX + (i / (points.length - 1)) * (w - padX * 2);
    const y = padY + (1 - (p.nav - min) / span) * (h - padY * 2);
    return [x, y];
  });
  const line = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const fill =
    `M${coords[0][0].toFixed(1)},${coords[0][1].toFixed(1)} ` +
    coords
      .slice(1)
      .map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`)
      .join(" ") +
    ` V${h} H${coords[0][0].toFixed(1)} Z`;
  const last = coords[coords.length - 1];
  const stroke = "var(--chart-2)";

  return (
    <div className="flex flex-col gap-1" aria-label="Equity curve">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-16 w-full"
        role="img"
        aria-label={`Daily equity from ${min.toFixed(0)} to ${max.toFixed(0)}`}
      >
        <defs>
          <linearGradient id="fin-eq-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path fill="url(#fin-eq-fill)" d={fill} />
        <polyline
          fill="none"
          stroke={stroke}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={line}
        />
        <circle cx={last[0]} cy={last[1]} r="3.5" fill={stroke} />
      </svg>
      <p className="text-muted-foreground text-xs">{label} · chart-2</p>
    </div>
  );
}
