// On-device weather fetch via Open-Meteo (no key). Mirrors the web helper so the
// engine produces identical plans on iOS. Falls back to calm conditions.
import type { WeatherInput } from "@verdyn/core";

const CALM: WeatherInput = {
  precipYesterdayIn: 0,
  precipTodayForecastIn: 0,
  forecastHighF: 82,
  precipChancePct: 10,
  windMph: 6,
};

const mm2in = (mm: number) => mm / 25.4;
const kmh2mph = (k: number) => k * 0.621371;

async function geocodeZip(zip: string) {
  try {
    const r = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(zip)}&count=1&country=US`,
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
      `&daily=temperature_2m_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max` +
      `&past_days=1&forecast_days=1&temperature_unit=fahrenheit&wind_speed_unit=kmh&timezone=auto`;
    const r = await fetch(url);
    if (!r.ok) return CALM;
    const j = await r.json();
    const d = j?.daily;
    if (!d?.time?.length) return CALM;
    const today = d.time.length - 1;
    const yesterday = Math.max(0, today - 1);
    return {
      precipYesterdayIn: mm2in(d.precipitation_sum?.[yesterday] ?? 0),
      precipTodayForecastIn: mm2in(d.precipitation_sum?.[today] ?? 0),
      forecastHighF: d.temperature_2m_max?.[today] ?? CALM.forecastHighF,
      precipChancePct: d.precipitation_probability_max?.[today] ?? CALM.precipChancePct,
      windMph: kmh2mph(d.wind_speed_10m_max?.[today] ?? 0),
    };
  } catch {
    return CALM;
  }
}
