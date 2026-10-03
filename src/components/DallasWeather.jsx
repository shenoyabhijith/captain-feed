import { useEffect, useState } from "react";

const CACHE_KEY = "captain-feed-dallas-weather";
const CACHE_TTL_MS = 3 * 60 * 60 * 1000;
const FORECAST_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=32.7767&longitude=-96.797&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=America%2FChicago&forecast_days=7";

/** Map WMO weather codes to short ink/slate labels. */
export function wmoCondition(code) {
  const c = Number(code);
  if (!Number.isFinite(c)) return "Cloudy";
  if (c === 0 || c === 1) return "Clear";
  if (c === 2 || c === 3) return "Cloudy";
  if (c === 45 || c === 48) return "Fog";
  if (c >= 71 && c <= 77) return "Snow";
  if (c === 85 || c === 86) return "Snow";
  if (c >= 95 && c <= 99) return "Storms";
  if (
    (c >= 51 && c <= 67) ||
    (c >= 80 && c <= 82)
  ) {
    return "Rain";
  }
  return "Cloudy";
}

function weekdayLabel(isoDate, index) {
  if (index === 0) return "Today";
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "America/Chicago",
  });
}

function roundTemp(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return `${Math.round(v)}°`;
}

function ConditionIcon({ condition, className = "" }) {
  const stroke = "currentColor";
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    className,
    "aria-hidden": "true",
  };
  if (condition === "Clear") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" stroke={stroke} strokeWidth="1.5" />
        <path
          d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6"
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (condition === "Rain") {
    return (
      <svg {...common}>
        <path
          d="M7.5 10.5a4.5 4.5 0 0 1 8.7-1.5A3.5 3.5 0 0 1 17.5 16H8a3.5 3.5 0 0 1-.5-5.5z"
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M9 18.5v2M12 17.5v2M15 18.5v2"
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (condition === "Storms") {
    return (
      <svg {...common}>
        <path
          d="M7.5 10a4.5 4.5 0 0 1 8.7-1.5A3.5 3.5 0 0 1 17.5 15.5H8A3.5 3.5 0 0 1 7.5 10z"
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M12 14l-2 4h3l-1.5 3.5"
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (condition === "Snow") {
    return (
      <svg {...common}>
        <path
          d="M12 5v14M7 7.5l10 9M17 7.5l-10 9"
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (condition === "Fog") {
    return (
      <svg {...common}>
        <path
          d="M4 9h16M5 12.5h14M6 16h12"
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path
        d="M7.5 14a4.5 4.5 0 0 1 8.3-2.4A3.5 3.5 0 0 1 17.5 18H8a3.5 3.5 0 0 1-.5-4z"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M7 8.5a3 3 0 0 1 5.4-1.8"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.fetchedAt || !parsed?.data) return null;
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ fetchedAt: Date.now(), data })
    );
  } catch {
    /* ignore quota / private mode */
  }
}

function normalizeForecast(json) {
  const current = json?.current;
  const daily = json?.daily;
  if (
    current?.temperature_2m == null ||
    current?.weather_code == null ||
    !daily?.time?.length ||
    !daily?.weather_code?.length ||
    !daily?.temperature_2m_max?.length ||
    !daily?.temperature_2m_min?.length
  ) {
    return null;
  }
  const days = daily.time.slice(0, 7).map((date, i) => ({
    date,
    label: weekdayLabel(date, i),
    condition: wmoCondition(daily.weather_code[i]),
    high: daily.temperature_2m_max[i],
    low: daily.temperature_2m_min[i],
  }));
  if (days.length < 1) return null;
  return {
    temp: current.temperature_2m,
    condition: wmoCondition(current.weather_code),
    days,
  };
}

/**
 * Quiet Dallas current + 7-day block for the feed home.
 * Hides entirely when fetch/parse fails. Caches ~3h in sessionStorage.
 */
export default function DallasWeather() {
  const [forecast, setForecast] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const cached = readCache();
    if (cached) {
      setForecast(cached);
      return undefined;
    }

    (async () => {
      try {
        const res = await fetch(FORECAST_URL);
        if (!res.ok) return;
        const json = await res.json();
        const next = normalizeForecast(json);
        if (!next || cancelled) return;
        writeCache(next);
        setForecast(next);
      } catch {
        /* hide on failure */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!forecast) return null;

  return (
    <section className="dallas-weather" aria-label="Dallas weather">
      <div className="dallas-weather-now">
        <div className="dallas-weather-label">Dallas</div>
        <div className="dallas-weather-temp tabular-nums">
          {roundTemp(forecast.temp)}
        </div>
        <div className="dallas-weather-cond">{forecast.condition}</div>
      </div>
      <ul className="dallas-weather-week">
        {forecast.days.map((d) => (
          <li key={d.date} className="dallas-weather-day">
            <span className="dallas-weather-dow">{d.label}</span>
            <ConditionIcon
              condition={d.condition}
              className="dallas-weather-icon"
            />
            <span className="dallas-weather-day-cond sr-only">
              {d.condition}
            </span>
            <span className="dallas-weather-hi-lo tabular-nums">
              <strong>{roundTemp(d.high)}</strong>
              <span>{roundTemp(d.low)}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
