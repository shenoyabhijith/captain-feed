/** Daily EOD equity curve / sparklines — native SVG, coss chart tokens. */

function buildCoords(points, w, h, padX, padY) {
  const vals = points.map((p) => p.nav);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = Math.max(max - min, 1);
  return points.map((p, i) => {
    const x =
      points.length === 1
        ? w / 2
        : padX + (i / (points.length - 1)) * (w - padX * 2);
    const y = padY + (1 - (p.nav - min) / span) * (h - padY * 2);
    return [x, y];
  });
}

/**
 * Synthesize ~n EOD points from startNav → endNav (sample path for Admin).
 */
export function synthesizeEquitySeries(startNav, endNav, n = 21, seed = 1) {
  const count = Math.max(2, n);
  const pts = [];
  let s = seed % 97;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    // Ease toward end with light deterministic wobble
    s = (s * 17 + 23) % 97;
    const wobble = ((s / 97) - 0.5) * 0.04 * (1 - t);
    const nav =
      startNav + (endNav - startNav) * (t * t * (3 - 2 * t)) + (endNav - startNav) * wobble;
    pts.push({ date: `sample-${i}`, nav: Math.round(nav * 100) / 100 });
  }
  pts[pts.length - 1].nav = Math.round(endNav * 100) / 100;
  return pts;
}

export function Sparkline({
  points = [],
  stroke = "var(--chart-2)",
  className = "h-7 w-full",
  ariaHidden = true,
}) {
  if (!points.length) return null;
  const w = 120;
  const h = 28;
  const coords = buildCoords(points, w, h, 2, 3);
  const line = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      aria-hidden={ariaHidden ? "true" : undefined}
      role={ariaHidden ? undefined : "img"}
    >
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={line}
      />
    </svg>
  );
}

export default function EquityChart({
  points = [],
  label = "Equity · daily EOD (not tick)",
  stroke = "var(--chart-2)",
  heightClass = "h-16",
  showFill = true,
  gradientId = "fin-eq-fill",
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
  const w = 320;
  const h = 72;
  const coords = buildCoords(points, w, h, 4, 8);
  const line = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const fill =
    `M${coords[0][0].toFixed(1)},${coords[0][1].toFixed(1)} ` +
    coords
      .slice(1)
      .map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`)
      .join(" ") +
    ` V${h} H${coords[0][0].toFixed(1)} Z`;
  const last = coords[coords.length - 1];

  return (
    <div className="flex flex-col gap-1" aria-label="Equity curve">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className={`${heightClass} w-full`}
        role="img"
        aria-label={`Daily equity from ${min.toFixed(0)} to ${max.toFixed(0)}`}
      >
        {showFill ? (
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
        ) : null}
        {showFill ? <path fill={`url(#${gradientId})`} d={fill} /> : null}
        <polyline
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={line}
        />
        <circle cx={last[0]} cy={last[1]} r="2.5" fill="var(--success)" />
      </svg>
      {label ? (
        <p className="text-muted-foreground text-xs">{label}</p>
      ) : null}
    </div>
  );
}
