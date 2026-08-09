// Server-side weather fetch for a US ZIP via Open-Meteo (no API key required).
// Always returns a usable WeatherInput — falls back to calm conditions if the
// network call fails, so the engine never blocks on weather.

import { HEAT_BUMP_F, type WeatherInput } from "@verdyn/core";

const CALM: WeatherInput = {
  precipYesterdayIn: 0,
  precipTodayForecastIn: 0,
  forecastHighF: 82,
  precipChancePct: 10,
  windMph: 6,
};

const mm2in = (mm: number) => mm / 25.4;
const kmh2mph = (k: number) => k * 0.621371;

async function geocodeZip(zip: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const r = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(zip)}&count=1&country=US`,
      { next: { revalidate: 86400 } },
    );
    if (!r.ok) return null;
    const j = await r.json();
    const hit = j?.results?.[0];
    return hit ? { lat: hit.latitude, lon: hit.longitude } : null;
  } catch {
    return null;
  }
}

export async function weatherForZip(zip: string): Promise<WeatherInput> {
  const loc = await geocodeZip(zip);
  if (!loc) return CALM;
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}` +
      `&daily=temperature_2m_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,et0_fao_evapotranspiration` +
      `&past_days=7&forecast_days=1&temperature_unit=fahrenheit&wind_speed_unit=kmh&timezone=auto`;
    const r = await fetch(url, { next: { revalidate: 3600 } });
    if (!r.ok) return CALM;
    const j = await r.json();
    const d = j?.daily;
    if (!d?.time?.length) return CALM;
    // index 0 = yesterday (past_days=1), index 1 = today
    const today = d.time.length - 1;
    const yesterday = Math.max(0, today - 1);
    // Live FAO-56 reference ET (ETo) for the nearest grid cell / station — the
    // "weather-station" signal the engine waters to replace (WeatherSense-style).
    const etoMm = d.et0_fao_evapotranspiration?.[today];
    const etTodayIn = typeof etoMm === "number" && etoMm >= 0 ? mm2in(etoMm) : undefined;
    // Rolling 7-day rainfall (the 7 days ending yesterday) — drives the recovery
    // / dry-spell relaxation when the rainy season returns.
    const precipSeries: number[] = d.precipitation_sum ?? [];
    const rolling7DayRainIn = precipSeries
      .slice(Math.max(0, today - 7), today)
      .reduce((sum: number, mm: number) => sum + mm2in(mm ?? 0), 0);
    // Consecutive ≥95°F days ending today — escalates the heat bump to
    // wilt-watch after 3 straight days.
    const highs: number[] = d.temperature_2m_max ?? [];
    let consecutiveHotDays = 0;
    for (let i = today; i >= 0 && (highs[i] ?? 0) >= HEAT_BUMP_F; i--) consecutiveHotDays++;
    return {
      precipYesterdayIn: mm2in(d.precipitation_sum?.[yesterday] ?? 0),
      precipTodayForecastIn: mm2in(d.precipitation_sum?.[today] ?? 0),
      forecastHighF: d.temperature_2m_max?.[today] ?? CALM.forecastHighF,
      precipChancePct: d.precipitation_probability_max?.[today] ?? CALM.precipChancePct,
      windMph: kmh2mph(d.wind_speed_10m_max?.[today] ?? 0),
      etTodayIn,
      rolling7DayRainIn: Math.round(rolling7DayRainIn * 100) / 100,
      consecutiveHotDays,
    };
  } catch {
    return CALM;
  }
}
