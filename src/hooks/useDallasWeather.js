import { useEffect, useState } from "react";
import { normalizeForecast, readWeatherCache, writeWeatherCache } from "../lib/dallasWeather";

const FORECAST_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=32.7767&longitude=-96.797&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=America%2FChicago&forecast_days=7";

/**
 * Shared Dallas forecast fetch + ~3h session cache.
 * One call site feeds WelcomeHero + DallasWeather (no double fetch).
 */
export function useDallasWeather() {
  const [forecast, setForecast] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const cached = readWeatherCache();
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
        writeWeatherCache(next);
        setForecast(next);
      } catch {
        /* hide / fall back on failure */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return forecast;
}
