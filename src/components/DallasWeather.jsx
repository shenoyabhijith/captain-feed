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

/**
 * Quiet Dallas current + 7-day block for the feed home.
 * Forecast comes from useDallasWeather (shared with WelcomeHero).
 */
export default function DallasWeather({ forecast }) {
  if (!forecast) return null;

  return (
    <section className="dallas-weather" aria-label="Dallas weather">
      <div className="dallas-weather-now">
        <div className="dallas-weather-label">
          <MapPin size={12} strokeWidth={2.2} aria-hidden="true" /> Dallas
        </div>
        <div className="dallas-weather-temp tabular-nums">
          {formatTemp(forecast.temp)}
        </div>
        <div className="dallas-weather-cond">
          <ConditionIcon condition={forecast.condition} className="dallas-weather-now-icon" size={16} />
          {forecast.condition}
        </div>
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
