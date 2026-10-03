import { roundTemp } from "../lib/dallasWeather";

/** Classic sun + boat fallback when weather has not loaded. */
function FallbackArt() {
  return (
    <svg viewBox="0 0 88 88" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="welcome-sky" x1="44" y1="8" x2="44" y2="70" gradientUnits="userSpaceOnUse">
          <stop stopColor="#c5d4e8" />
          <stop offset="1" stopColor="#e8eef6" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="welcome-sun" x1="44" y1="22" x2="44" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f1f5f9" />
          <stop offset="1" stopColor="#94a3b8" />
        </linearGradient>
      </defs>
      <circle cx="44" cy="44" r="40" fill="url(#welcome-sky)" opacity="0.9" />
      <circle cx="44" cy="36" r="14" fill="url(#welcome-sun)" opacity="0.95" />
      <circle cx="44" cy="36" r="14" stroke="#64748b" strokeWidth="1.2" opacity="0.35" />
      <g stroke="#94a3b8" strokeWidth="1.4" strokeLinecap="round" opacity="0.45">
        <path d="M44 14v6M44 52v5M26 36h-5M67 36h5M30.5 22.5l-3.5-3.5M61 53l3.5 3.5M61 22.5l3.5-3.5M30.5 53l-3.5 3.5" />
      </g>
      <path d="M12 58c8-4 16-4 24 0s16 4 24 0 12-4 16-2v18H12V58z" fill="#cbd5e1" opacity="0.55" />
      <path d="M14 64c7-3 14-3 21 0s14 3 21 0 10-3 14-1" stroke="#64748b" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
      <path d="M34 58l4-10h8l4 10" stroke="#0f172a" strokeWidth="1.6" strokeLinejoin="round" fill="#1e293b" />
      <path d="M32 58h20l-2 4H34l-2-4z" fill="#0f172a" />
      <path d="M42 48V40" stroke="#0f172a" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M42 40l7 5H42V40z" fill="#475569" />
    </svg>
  );
}

/** Geometric Dallas skyline — Reunion-tower ball on a stick + quiet blocks. */
function Skyline() {
  return (
    <g className="welcome-skyline" fill="#0f172a" opacity="0.72">
      <rect x="8" y="58" width="6" height="18" rx="0.5" />
      <rect x="15" y="52" width="7" height="24" rx="0.5" />
      <rect x="23" y="56" width="5" height="20" rx="0.5" />
      {/* Reunion-like tower */}
      <rect x="41.5" y="42" width="3" height="34" rx="0.5" />
      <circle cx="43" cy="40" r="5.2" />
      <circle cx="43" cy="40" r="3.2" fill="#1e293b" opacity="0.9" />
      <rect x="48" y="50" width="8" height="26" rx="0.5" />
      <rect x="57" y="55" width="6" height="21" rx="0.5" />
      <rect x="64" y="48" width="7" height="28" rx="0.5" />
      <rect x="72" y="58" width="5" height="18" rx="0.5" />
      <rect x="78" y="54" width="4" height="22" rx="0.5" />
      {/* Ground line */}
      <rect x="6" y="75" width="76" height="2" rx="1" opacity="0.35" />
    </g>
  );
}

function SmallBoat() {
  return (
    <g className="welcome-boat" transform="translate(12 68) scale(0.72)">
      <path d="M2 8l3-7h6l3 7" stroke="#0f172a" strokeWidth="1.2" strokeLinejoin="round" fill="#1e293b" />
      <path d="M0 8h16l-1.5 3H1.5L0 8z" fill="#0f172a" />
      <path d="M8 1V8" stroke="#0f172a" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M8 1l5 4H8V1z" fill="#475569" />
    </g>
  );
}

function ClearSky() {
  return (
    <g className="welcome-wx welcome-wx--clear">
      <circle className="welcome-sun" cx="44" cy="28" r="11" fill="url(#scene-sun)" opacity="0.95" />
      <circle cx="44" cy="28" r="11" stroke="#64748b" strokeWidth="1" opacity="0.3" />
      <g stroke="#94a3b8" strokeWidth="1.2" strokeLinecap="round" opacity="0.4">
        <path d="M44 10v4M44 42v4M26 28h-4M66 28h4M31 15l-2.5-2.5M59.5 43.5l2.5 2.5M59.5 15l2.5-2.5M31 43.5l-2.5 2.5" />
      </g>
    </g>
  );
}

function CloudySky() {
  return (
    <g className="welcome-wx welcome-wx--cloudy">
      <g className="welcome-cloud welcome-cloud--a" fill="#94a3b8" opacity="0.55">
        <ellipse cx="32" cy="26" rx="14" ry="8" />
        <ellipse cx="42" cy="24" rx="10" ry="7" />
        <ellipse cx="24" cy="28" rx="8" ry="5" />
      </g>
      <g className="welcome-cloud welcome-cloud--b" fill="#64748b" opacity="0.35">
        <ellipse cx="58" cy="32" rx="16" ry="7" />
        <ellipse cx="68" cy="30" rx="9" ry="6" />
      </g>
    </g>
  );
}

function RainSky() {
  return (
    <g className="welcome-wx welcome-wx--rain">
      <g fill="#64748b" opacity="0.5">
        <ellipse cx="36" cy="20" rx="15" ry="7" />
        <ellipse cx="50" cy="18" rx="11" ry="6" />
        <ellipse cx="28" cy="22" rx="8" ry="4.5" />
      </g>
      <g className="welcome-rain" stroke="#64748b" strokeWidth="1.1" strokeLinecap="round" opacity="0.5">
        <path className="welcome-streak" d="M24 30l-1.5 8" />
        <path className="welcome-streak" d="M32 32l-1.5 9" />
        <path className="welcome-streak" d="M40 29l-1.5 10" />
        <path className="welcome-streak" d="M48 31l-1.5 8" />
        <path className="welcome-streak" d="M56 30l-1.5 9" />
        <path className="welcome-streak" d="M64 32l-1.5 8" />
      </g>
    </g>
  );
}

function StormSky() {
  return (
    <g className="welcome-wx welcome-wx--storms">
      <rect className="welcome-flash" x="14" y="10" width="60" height="36" rx="16" fill="#e2e8f0" opacity="0" />
      <g fill="#475569" opacity="0.7">
        <ellipse cx="34" cy="20" rx="15" ry="7.5" />
        <ellipse cx="50" cy="17" rx="12" ry="7" />
        <ellipse cx="60" cy="22" rx="9" ry="5" />
      </g>
      <path
        className="welcome-bolt"
        d="M46 26l-3.5 7h3.5l-2.5 6"
        stroke="#94a3b8"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.3"
      />
    </g>
  );
}

function FogSky() {
  return (
    <g className="welcome-wx welcome-wx--fog" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round">
      <path className="welcome-mist welcome-mist--a" d="M16 26h52" opacity="0.32" />
      <path className="welcome-mist welcome-mist--b" d="M20 33h48" opacity="0.4" />
      <path className="welcome-mist welcome-mist--c" d="M18 40h50" opacity="0.28" />
      <path className="welcome-mist welcome-mist--d" d="M24 47h40" opacity="0.36" />
    </g>
  );
}

function SnowSky() {
  return (
    <g className="welcome-wx welcome-wx--snow">
      <g fill="#64748b" opacity="0.4">
        <ellipse cx="40" cy="20" rx="14" ry="7" />
        <ellipse cx="54" cy="18" rx="10" ry="6" />
      </g>
      <g className="welcome-flakes" fill="#94a3b8">
        <circle className="welcome-flake" cx="24" cy="32" r="1.4" opacity="0.7" />
        <circle className="welcome-flake" cx="36" cy="38" r="1.1" opacity="0.55" />
        <circle className="welcome-flake" cx="48" cy="30" r="1.3" opacity="0.65" />
        <circle className="welcome-flake" cx="58" cy="40" r="1" opacity="0.5" />
        <circle className="welcome-flake" cx="68" cy="34" r="1.2" opacity="0.6" />
      </g>
    </g>
  );
}

function WeatherLayers({ condition }) {
  switch (condition) {
    case "Clear":
      return <ClearSky />;
    case "Rain":
      return <RainSky />;
    case "Storms":
      return <StormSky />;
    case "Fog":
      return <FogSky />;
    case "Snow":
      return <SnowSky />;
    case "Cloudy":
    default:
      return <CloudySky />;
  }
}

function DallasScene({ condition }) {
  const darkSky = condition === "Storms" || condition === "Rain";
  return (
    <svg
      className={`welcome-scene welcome-scene--${condition.toLowerCase()}`}
      viewBox="0 0 88 88"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="scene-sky" x1="44" y1="6" x2="44" y2="78" gradientUnits="userSpaceOnUse">
          <stop stopColor={darkSky ? "#94a3b8" : "#c5d4e8"} />
          <stop offset="1" stopColor="#e8eef6" stopOpacity="0.15" />
        </linearGradient>
        <linearGradient id="scene-sun" x1="44" y1="16" x2="44" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f8fafc" />
          <stop offset="1" stopColor="#94a3b8" />
        </linearGradient>
        <clipPath id="scene-clip">
          <circle cx="44" cy="44" r="40" />
        </clipPath>
      </defs>
      <circle cx="44" cy="44" r="40" fill="url(#scene-sky)" opacity={darkSky ? 0.85 : 0.92} />
      <g clipPath="url(#scene-clip)">
        <WeatherLayers condition={condition} />
        <Skyline />
        <SmallBoat />
      </g>
      <circle cx="44" cy="44" r="40" stroke="#64748b" strokeWidth="1" opacity="0.12" />
    </svg>
  );
}

function spokenLine(weather) {
  const deg = roundTemp(weather?.temp);
  const condition = weather?.condition;
  if (deg == null || !condition) return null;
  return `${deg}° and ${condition.toLowerCase()} in Dallas.`;
}

/**
 * Morning invitation hero — weather-reactive Dallas scene when forecast is ready.
 * Entrance + drift gated by prefers-reduced-motion via --motion.
 */
export default function WelcomeHero({ unreadCount = 0, weather = null }) {
  const caughtUp = unreadCount <= 0;
  const line = spokenLine(weather);
  const hasScene = Boolean(line && weather?.condition);

  return (
    <section
      className={`welcome${hasScene ? ` welcome--${weather.condition.toLowerCase()}` : ""}`}
      aria-label="Morning invitation"
    >
      <div className="welcome-art" aria-hidden="true">
        {hasScene ? <DallasScene condition={weather.condition} /> : <FallbackArt />}
      </div>
      <div className="welcome-copy">
        <div className="welcome-kicker">Today</div>
        <div className="welcome-title">
          {line ?? (caughtUp ? "You're caught up" : "Clear horizon")}
        </div>
        <div className="welcome-sub">
          {caughtUp
            ? "Quiet seas. Check Finances or Metrics when you're ready."
            : `${unreadCount} brief${unreadCount === 1 ? "" : "s"} waiting. Start with For you — or open Topics when you want a tighter lane.`}
        </div>
      </div>
    </section>
  );
}
