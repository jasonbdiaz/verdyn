// Water-savings estimate: how much Verdyn's weather/ET-aware plan saves versus a
// naive "dumb timer" that waters every zone the same amount every day. This is
// the number a lawn-care business shows its clients, and it aggregates cleanly
// across a Pro account's whole book of properties.

import type { DailyPlan, ZoneProfile } from "./types";

/** Gallons to apply 1 inch of water over 1 sq ft. */
export const GAL_PER_INCH_SQFT = 0.6233;
/** Default modeled turf area per zone when the real area is unknown. */
export const DEFAULT_ZONE_SQFT = 1000;
/** The baseline we compare against: a fixed daily timer, per zone. */
export const BASELINE_DAILY_INCHES = 0.25;

// ── Water cost model ─────────────────────────────────────────────
// Combined water + wastewater volumetric rate ($/1,000 gallons), rough state
// averages from public residential-rate surveys. These are estimates — a Pro
// can override with the client's actual rate for a defensible dollar figure.
export const US_AVG_USD_PER_KGAL = 11.5;
export const WATER_RATE_USD_PER_KGAL: Record<string, number> = {
  AZ: 9.0, CA: 13.5, CO: 9.5, FL: 9.0, GA: 12.0, NV: 8.0, NC: 10.0, SC: 9.5,
  TX: 10.5, OR: 14.0, WA: 16.0, NY: 12.0, NJ: 13.0, MA: 14.5, IL: 12.5,
  PA: 12.0, OH: 11.0, MI: 13.0, VA: 10.5, MD: 11.5, UT: 7.5, NM: 9.0,
};

/** $/1,000 gal for a state code (override wins), falling back to the US average. */
export function waterRateForState(state?: string | null, overridePerKGal?: number): number {
  if (typeof overridePerKGal === "number" && overridePerKGal > 0) return overridePerKGal;
  if (state && WATER_RATE_USD_PER_KGAL[state.toUpperCase()]) return WATER_RATE_USD_PER_KGAL[state.toUpperCase()];
  return US_AVG_USD_PER_KGAL;
}

/** Dollars for a volume of water at a given $/1,000-gal rate. */
export function dollarsForGallons(gal: number, ratePerKGal: number): number {
  return (gal / 1000) * ratePerKGal;
}

export interface WaterSavings {
  /** Gallons Verdyn actually applied over the period. */
  appliedGal: number;
  /** Gallons a naive everyday timer would have applied. */
  baselineGal: number;
  /** Gallons saved (never negative). */
  savedGal: number;
  /** Percent saved vs. baseline (0–100). */
  savedPct: number;
  /** Days the estimate covers. */
  days: number;
}

export interface SavingsOptions {
  /** Modeled turf area per zone (sq ft). */
  zoneSqft?: number;
}

/**
 * Estimate savings for one property over a span of daily plans.
 * `zoneCount` is the number of irrigation zones (drives the baseline).
 */
export function estimateSavings(
  weekPlans: DailyPlan[],
  zoneCount: number,
  opts: SavingsOptions = {},
): WaterSavings {
  const sqft = opts.zoneSqft ?? DEFAULT_ZONE_SQFT;
  const days = weekPlans.length;

  let appliedIn = 0;
  for (const plan of weekPlans) {
    for (const c of plan.cycles) appliedIn += c.inches;
  }
  const appliedGal = appliedIn * sqft * GAL_PER_INCH_SQFT;

  const baselineIn = BASELINE_DAILY_INCHES * days * Math.max(1, zoneCount);
  const baselineGal = baselineIn * sqft * GAL_PER_INCH_SQFT;

  const savedGal = Math.max(0, baselineGal - appliedGal);
  const savedPct = baselineGal > 0 ? Math.round((savedGal / baselineGal) * 100) : 0;

  return {
    appliedGal: Math.round(appliedGal),
    baselineGal: Math.round(baselineGal),
    savedGal: Math.round(savedGal),
    savedPct,
    days,
  };
}

// ── Dollarized, per-zone property report (the shareable PDF payload) ─────────

export interface ZoneSavings {
  zoneId: string;
  zoneName: string;
  appliedGal: number;
  baselineGal: number;
  savedGal: number;
  savedPct: number;
}

export interface PropertySavingsReport extends WaterSavings {
  /** $/1,000 gal used for the dollar figures. */
  ratePerKGalUsd: number;
  appliedUsd: number;
  baselineUsd: number;
  savedUsd: number;
  /** Per-zone gallons + savings, in plan order. */
  perZone: ZoneSavings[];
  /** True when the dollar rate is a state/US estimate, not a client override. */
  rateIsEstimate: boolean;
}

export interface PropertySavingsOptions {
  /** Two-letter state for the default water rate. */
  state?: string | null;
  /** Client's actual $/1,000 gal — overrides the state estimate. */
  ratePerKGalUsd?: number;
}

const round = (n: number) => Math.round(n);
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Rigorous, shareable savings proof for ONE property: gallons + dollars vs. the
 * dumb-timer baseline, broken out per zone, tied to a real (or estimated) local
 * water rate. This is the data behind the Pro client-facing PDF report.
 *
 * Uses each zone's real `areaSqft` when set, so the gallons are property-specific
 * rather than a flat per-zone guess.
 */
export function estimatePropertySavings(
  weekPlans: DailyPlan[],
  zones: ZoneProfile[],
  opts: PropertySavingsOptions = {},
): PropertySavingsReport {
  const days = weekPlans.length;
  const rate = waterRateForState(opts.state, opts.ratePerKGalUsd);
  const rateIsEstimate = !(typeof opts.ratePerKGalUsd === "number" && opts.ratePerKGalUsd > 0);

  // Sum Verdyn's applied inches per zone across the period.
  const appliedInByZone: Record<string, number> = {};
  for (const plan of weekPlans) {
    for (const c of plan.cycles) appliedInByZone[c.zoneId] = (appliedInByZone[c.zoneId] ?? 0) + c.inches;
  }

  const perZone: ZoneSavings[] = zones.map((z) => {
    const sqft = z.areaSqft && z.areaSqft > 0 ? z.areaSqft : DEFAULT_ZONE_SQFT;
    const appliedGal = (appliedInByZone[z.id] ?? 0) * sqft * GAL_PER_INCH_SQFT;
    const baselineGal = BASELINE_DAILY_INCHES * days * sqft * GAL_PER_INCH_SQFT;
    const savedGal = Math.max(0, baselineGal - appliedGal);
    return {
      zoneId: z.id, zoneName: z.name,
      appliedGal: round(appliedGal), baselineGal: round(baselineGal),
      savedGal: round(savedGal),
      savedPct: baselineGal > 0 ? Math.round((savedGal / baselineGal) * 100) : 0,
    };
  });

  const appliedGal = perZone.reduce((s, z) => s + z.appliedGal, 0);
  const baselineGal = perZone.reduce((s, z) => s + z.baselineGal, 0);
  const savedGal = perZone.reduce((s, z) => s + z.savedGal, 0);
  const savedPct = baselineGal > 0 ? Math.round((savedGal / baselineGal) * 100) : 0;

  return {
    appliedGal, baselineGal, savedGal, savedPct, days,
    ratePerKGalUsd: rate,
    appliedUsd: round2(dollarsForGallons(appliedGal, rate)),
    baselineUsd: round2(dollarsForGallons(baselineGal, rate)),
    savedUsd: round2(dollarsForGallons(savedGal, rate)),
    perZone, rateIsEstimate,
  };
}

/** Sum several per-property savings into a portfolio total (for the Pro view). */
export function aggregateSavings(parts: WaterSavings[]): WaterSavings {
  const days = parts.reduce((m, p) => Math.max(m, p.days), 0);
  const appliedGal = parts.reduce((s, p) => s + p.appliedGal, 0);
  const baselineGal = parts.reduce((s, p) => s + p.baselineGal, 0);
  const savedGal = parts.reduce((s, p) => s + p.savedGal, 0);
  const savedPct = baselineGal > 0 ? Math.round((savedGal / baselineGal) * 100) : 0;
  return { appliedGal, baselineGal, savedGal, savedPct, days };
}
