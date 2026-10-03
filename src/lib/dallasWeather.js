const CACHE_KEY = "captain-feed-dallas-weather";
const CACHE_TTL_MS = 3 * 60 * 60 * 1000;

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
  if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) {
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

export function roundTemp(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return Math.round(v);
}

export function formatTemp(n) {
  const v = roundTemp(n);
  if (v == null) return "—";
  return `${v}°`;
}

export function readWeatherCache() {
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

export function writeWeatherCache(data) {
  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ fetchedAt: Date.now(), data })
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export function normalizeForecast(json) {
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
