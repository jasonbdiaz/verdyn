// Local evapotranspiration (ET) → irrigation demand: the "weather-station" brain.
//
// B-hyve's WeatherSense scales watering to the *local* atmospheric demand read
// from a nearby weather station, not a coarse climate average. Verdyn does the
// same: when a live FAO-56 reference ET (ETo) reading for the user's nearest
// station / grid cell is available, the engine waters to replace *today's* actual
// ET instead of a month-average table value. The static climate table remains the
// graceful fallback when no live reading is present (offline, geocode miss, etc.).
//
// Pure module — no node deps — so it bundles in web and Expo alike.

/** Clamp a single day's demand so an extreme reading can't run the schedule away
 *  from the agronomic envelope. Peak-month *averages* sit below hot-day spikes, so
 *  we allow up to +30% above peak and floor at 10% (deep winter dormancy). */
export const ET_FACTOR_MAX = 1.3;
export const ET_FACTOR_MIN = 0.1;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export type EtSource = "station" | "climate";

export interface EtDemand {
  /** Demand factor (ET_FACTOR_MIN..ET_FACTOR_MAX) vs the climate peak-month ETo. */
  factor: number;
  /** Whether the factor came from a live local reading or the static table. */
  source: EtSource;
  /** The reference ET (in/day) that drove the factor — for the explainable "why". */
  etTodayIn: number;
}

/**
 * Daily ET demand factor, station-first.
 *
 * factor = todayETo / peakMonthETo — i.e. "how thirsty is the atmosphere today
 * relative to the hottest part of the year here". A live local ETo is used when
 * present (and non-negative); otherwise the caller's static month-average ETo.
 *
 * @param liveEtTodayIn  live local reference ET (in/day) from the weather feed, if any
 * @param staticEtTodayIn month-average reference ET (in/day) from the climate table
 * @param peakDailyEtIn   the climate zone's peak-month reference ET (in/day)
 */
export function etDemandFactor(
  liveEtTodayIn: number | undefined,
  staticEtTodayIn: number,
  peakDailyEtIn: number,
): EtDemand {
  const hasLive = typeof liveEtTodayIn === "number" && isFinite(liveEtTodayIn) && liveEtTodayIn >= 0;
  const source: EtSource = hasLive ? "station" : "climate";
  const etTodayIn = hasLive ? (liveEtTodayIn as number) : staticEtTodayIn;
  if (peakDailyEtIn <= 0) return { factor: 1, source, etTodayIn };
  return { factor: clamp(etTodayIn / peakDailyEtIn, ET_FACTOR_MIN, ET_FACTOR_MAX), source, etTodayIn };
}
