import { formatTemp, wmoCondition } from "../lib/dallasWeather";

export { wmoCondition };

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

/**
 * Quiet Dallas current + 7-day block for the feed home.
 * Forecast comes from useDallasWeather (shared with WelcomeHero).
 */
export default function DallasWeather({ forecast }) {
  if (!forecast) return null;

  return (
    <section className="dallas-weather" aria-label="Dallas weather">
      <div className="dallas-weather-now">
        <div className="dallas-weather-label">Dallas</div>
        <div className="dallas-weather-temp tabular-nums">
          {formatTemp(forecast.temp)}
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
              <strong>{formatTemp(d.high)}</strong>
              <span>{formatTemp(d.low)}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
