import { Sun, CloudRain, CloudLightning, Snowflake, CloudFog, CloudSun, MapPin } from "lucide-react";
import { formatTemp, wmoCondition } from "../lib/dallasWeather";

export { wmoCondition };

const CONDITION_ICONS = {
  Clear: Sun,
  Rain: CloudRain,
  Storms: CloudLightning,
  Snow: Snowflake,
  Fog: CloudFog,
};

/** Lucide weather glyph (same icon family as the rest of the app). */
function ConditionIcon({ condition, className = "", size = 18 }) {
  const Icon = CONDITION_ICONS[condition] || CloudSun;
  return <Icon className={className} size={size} strokeWidth={1.75} aria-hidden="true" />;
}

/** "Good morning" / "Good afternoon" / "Good evening" in Chicago time. */
function greeting(now = new Date()) {
  const h = Number(now.toLocaleString("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "America/Chicago" }));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/**
 * Home "Today" card: greeting + Dallas now + 7-day strip in one compact block
 * (replaces the separate welcome hero and weather card).
 * Forecast comes from useDallasWeather.
 */
export default function DallasWeather({ forecast, unreadCount = 0 }) {
  const sub = unreadCount > 0 ? `${unreadCount} new` : "All caught up";
  return (
    <section className="dallas-weather today-card" aria-label="Today in Dallas">
      <div className="today-card__head">
        <div className="today-card__hello">
          <div className="today-card__greet">{greeting()}</div>
          <div className="today-card__sub">
            <MapPin size={12} strokeWidth={2.2} aria-hidden="true" /> Dallas · {sub}
          </div>
        </div>
        {forecast ? (
          <div className="today-card__now">
            <ConditionIcon condition={forecast.condition} className="dallas-weather-now-icon" size={26} />
            <div>
              <div className="dallas-weather-temp tabular-nums">{formatTemp(forecast.temp)}</div>
              <div className="dallas-weather-cond">{forecast.condition}</div>
            </div>
          </div>
        ) : null}
      </div>
      {forecast ? <ul className="dallas-weather-week">
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
      </ul> : null}
    </section>
  );
}
