// Verdyn scheduling engine — the brain. Given a LawnProfile + today's weather,
// it produces a DailyPlan: which zones water, when, and for how long, honoring
// soil infiltration (cycle-and-soak), seasonal ET, local restrictions, and the
// new-landscaping establishment exemption.
//
// This generalizes the single-lawn logic proven in the CXLINKS system to any
// B-hyve owner's setup.

import { grassById, soilById, headById, plantById } from "./agronomy";
import { etForZipMonth, climateZoneForZip } from "./climate";
import { etDemandFactor, type EtDemand } from "./et";
import { waterProgramFor } from "./programs";
import {
  adaptiveFeedback, drySpellSurcharge, rainRelaxed, recoveryStateFor, wantsCoolingSyringe,
  SYRINGE_MIN, SYRINGE_TIME,
} from "./recovery";
import {
  RESTRICTION_POLICIES, policyForZip, isEstablishmentExempt, localRestrictionToPolicy,
} from "./restrictions";
import type {
  DailyPlan, DecisionFactor, LawnProfile, Phase, PlanCycle, PlanStatus,
  RestrictionPolicy, WeatherInput, ZoneOutcome, ZoneProfile,
} from "./types";

// ── tunables ────────────────────────────────────────────────────
const RAIN_SKIP_IN = 0.25;
const RAIN_REDUCE_IN = 0.10;
export const WIND_SKIP_MPH = 20;
export const HEAT_BUMP_F = 95;
const HEAT_BUMP_X = 1.2;
// Sustained heat compounds turf stress: after 3 straight ≥95°F days the bump
// escalates to a wilt-watch +30% (proven CXLINKS behavior).
const HEAT_STREAK_DAYS = 3;
const HEAT_STREAK_X = 1.3;
const HIGH_RAIN_CHANCE = 70; // % — forecast soak likely, skip
const MAX_PASSES = 4;
// Large rotor/impact zones can absorb more passes — a big deep soak needs them
// to land the full depth without runoff.
const LARGE_ZONE_MAX_PASSES = 6;

// hours-equivalent of infiltration before runoff, by slope
const SLOPE_PASS_HOURS = { flat: 0.6, moderate: 0.4, steep: 0.25 } as const;
// sun exposure water multipliers
const SUN_X = { full_sun: 1.0, partial: 0.85, shade: 0.7 } as const;

const dayOfWeek = (iso: string) => new Date(iso + "T00:00:00Z").getUTCDay();
const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
const monthOf = (iso: string) => new Date(iso + "T00:00:00Z").getUTCMonth();
const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (h: number, m: number) => `${pad(h)}:${pad(m)}`;

export function resolvePolicy(profile: LawnProfile): RestrictionPolicy {
  // Manual override (Expert) wins; then a resolved local restriction
  // (AI-researched or built-in, cached on the profile); then the ZIP default.
  if (profile.restrictionPolicyId && RESTRICTION_POLICIES[profile.restrictionPolicyId]) {
    return RESTRICTION_POLICIES[profile.restrictionPolicyId];
  }
  if (profile.localRestriction) {
    return localRestrictionToPolicy(profile.localRestriction);
  }
  return policyForZip(profile.zip);
}

/** Establishment-protocol days for a zone, from its plant type (turf zones
 *  defer to the grass database, everything else uses the plant's own value). */
function zoneEstablishmentDays(zone: ZoneProfile): number {
  const plant = plantById(zone.plantTypeId);
  return plant.usesGrass ? grassById(zone.grassTypeId).establishmentDays : plant.establishmentDays;
}

/** A zone's establishment date — its own planting date if set, else the
 *  lawn-level one. Lets one zone be "new sod" while the rest are mature. */
function zoneEstablishmentStart(profile: LawnProfile, zone: ZoneProfile): string | null {
  return zone.establishmentStart ?? profile.establishmentStart;
}

/** Establishment / transition / established for one zone. */
export function getZonePhase(profile: LawnProfile, zone: ZoneProfile, dateISO: string): Phase {
  const start = zoneEstablishmentStart(profile, zone);
  if (!start) return "established";
  const age = daysBetween(start, dateISO);
  if (age < 0) return "established";
  const estDays = zoneEstablishmentDays(zone);
  if (age >= estDays) return "established";
  if (age >= Math.round(estDays * 0.6)) return "transition";
  return "establishment";
}

/** Whole-lawn phase = the least-established phase across zones (so the badge
 *  reflects any zone still establishing). */
export function getPhase(profile: LawnProfile, dateISO: string): Phase {
  const phases = profile.zones.map((z) => getZonePhase(profile, z, dateISO));
  if (phases.includes("establishment")) return "establishment";
  if (phases.includes("transition")) return "transition";
  return "established";
}

/** Linear ramp off the establishment schedule: 50% of the mature per-event
 *  target at the start of transition, rising to 100% at full establishment.
 *  Ports CXLINKS's proven 15-day 0.15"→0.30" linear ramp, generalized to any
 *  zone's transition window. */
export function transitionRamp(profile: LawnProfile, zone: ZoneProfile, dateISO: string): number {
  const start = zoneEstablishmentStart(profile, zone);
  if (!start) return 1;
  const estDays = zoneEstablishmentDays(zone);
  const transStart = Math.round(estDays * 0.6);
  if (estDays <= transStart) return 1;
  const age = daysBetween(start, dateISO);
  if (age >= estDays) return 1;
  const progress = (age - transStart) / (estDays - transStart);
  return Math.min(1, Math.max(0.5, 0.5 + 0.5 * progress));
}

/** Net precipitation rate (in/hr) for a zone. */
export function zonePrecipInHr(zone: ZoneProfile): number {
  return zone.measuredPrecipInHr ?? headById(zone.headTypeId).precipInHr;
}

/** Station-first ET demand for this ZIP/date. Prefers a live local reference ET
 *  (weather-station / grid cell, passed through {@link WeatherInput.etTodayIn})
 *  and falls back to the static climate month-average table. The returned factor
 *  scales watering to today's atmospheric demand vs the peak-month average. */
export function etDemand(profile: LawnProfile, dateISO: string, liveEtTodayIn?: number): EtDemand {
  const zone = climateZoneForZip(profile.zip);
  const peakEt = Math.max(...zone.etByMonth);
  const staticEt = etForZipMonth(profile.zip, monthOf(dateISO));
  return etDemandFactor(liveEtTodayIn, staticEt, peakEt);
}

/** Seasonal scaling factor — today's ET vs peak-month ET at this ZIP. Uses the
 *  live local reading when supplied, else the static climate table. */
function seasonalFactor(profile: LawnProfile, dateISO: string, liveEtTodayIn?: number): number {
  return etDemand(profile, dateISO, liveEtTodayIn).factor;
}

/** Seasonally-scaled weekly water need (in) for a grass at this ZIP/date.
 *  Kept for back-compat; per-zone callers use {@link zoneWeeklyWaterTargetIn}. */
export function weeklyWaterTargetIn(
  profile: LawnProfile, grassId: string, dateISO: string, liveEtTodayIn?: number,
): number {
  return grassById(grassId).peakWeeklyWaterIn * seasonalFactor(profile, dateISO, liveEtTodayIn);
}

/** Seasonally-scaled weekly water need (in) for a zone — turf zones take their
 *  peak from the grass type, every other planting from the plant type. */
export function zoneWeeklyWaterTargetIn(
  profile: LawnProfile, zone: ZoneProfile, dateISO: string, liveEtTodayIn?: number,
): number {
  const plant = plantById(zone.plantTypeId);
  const peak = plant.usesGrass ? grassById(zone.grassTypeId).peakWeeklyWaterIn : plant.peakWeeklyWaterIn;
  return peak * seasonalFactor(profile, dateISO, liveEtTodayIn);
}

/** Which weekdays this lawn may water, given policy + parity + establishment. */
export function allowedWeekdays(
  profile: LawnProfile, policy: RestrictionPolicy, dateISO: string,
): number[] | "any" {
  if (isEstablishmentExempt(policy, profile.establishmentStart, dateISO)) return "any";
  const days = profile.addressParity === "odd"
    ? policy.allowedWeekdaysOdd : policy.allowedWeekdaysEven;
  return days.length ? days : "any";
}

/** Split an event's inches into cycle-and-soak passes for a zone. Large-zone
 *  programs allow a higher pass cap so a deep soak fully lands. */
export function splitIntoPasses(
  eventInches: number, zone: ZoneProfile, profile: LawnProfile, maxPasses = MAX_PASSES,
): number {
  const soil = soilById(profile.soilTextureId);
  const maxPass = soil.infiltrationInHr * SLOPE_PASS_HOURS[zone.slope];
  if (maxPass <= 0) return 1;
  return Math.min(maxPasses, Math.max(1, Math.ceil(eventInches / maxPass)));
}

export interface WeatherAdjustment {
  multiplier: number;
  skip: boolean;
  notes: string[];
  /** Structured weather reasoning — one factor per rule that fired. */
  factors: DecisionFactor[];
}

export function weatherAdjustment(w: WeatherInput): WeatherAdjustment {
  if (w.precipYesterdayIn >= RAIN_SKIP_IN) {
    const text = `Skipping — ${w.precipYesterdayIn.toFixed(2)}" of rain yesterday.`;
    return { multiplier: 0, skip: true, notes: [text], factors: [{ factor: "rain", text }] };
  }
  if (w.windMph > WIND_SKIP_MPH) {
    const text = `Skipping — ${Math.round(w.windMph)} mph wind would blow water off target.`;
    return { multiplier: 0, skip: true, notes: [text], factors: [{ factor: "wind", text }] };
  }
  if (w.precipChancePct >= HIGH_RAIN_CHANCE && w.precipTodayForecastIn >= RAIN_REDUCE_IN) {
    const text = `Skipping — ${w.precipChancePct}% chance of ${w.precipTodayForecastIn.toFixed(2)}" today.`;
    return { multiplier: 0, skip: true, notes: [text], factors: [{ factor: "forecast", text }] };
  }
  let m = 1;
  const notes: string[] = [];
  const factors: DecisionFactor[] = [];
  if (w.precipYesterdayIn >= RAIN_REDUCE_IN) {
    m *= 0.5;
    const text = `Halved runtime — ${w.precipYesterdayIn.toFixed(2)}" of rain yesterday.`;
    notes.push(text); factors.push({ factor: "rain", text });
  }
  if (w.forecastHighF >= HEAT_BUMP_F) {
    const streak = w.consecutiveHotDays ?? 1;
    if (streak >= HEAT_STREAK_DAYS) {
      m *= HEAT_STREAK_X;
      const text = `+30% — day ${streak} of a ≥${HEAT_BUMP_F}°F heat streak (wilt watch).`;
      notes.push(text); factors.push({ factor: "heat", text });
    } else {
      m *= HEAT_BUMP_X;
      const text = `+20% — ${Math.round(w.forecastHighF)}°F heat today.`;
      notes.push(text); factors.push({ factor: "heat", text });
    }
  }
  return { multiplier: m, skip: false, notes, factors };
}

/**
 * Build today's plan for the whole lawn.
 * @param startHour first legal/desired watering hour (default from policy/profile)
 */
export function buildDailyPlan(
  profile: LawnProfile, w: WeatherInput, dateISO: string,
): DailyPlan {
  const policy = resolvePolicy(profile);
  const phase = getPhase(profile, dateISO);
  const adj = weatherAdjustment(w);
  const soil = soilById(profile.soilTextureId);
  const notes: string[] = [...adj.notes];
  const cycles: PlanCycle[] = [];
  const zoneOutcomes: ZoneOutcome[] = [];

  // ── plan-level reasoning (shared by all zones) ──────────────────
  const rationale: DecisionFactor[] = [...adj.factors];
  if (rainRelaxed(w)) {
    rationale.push({ factor: "rain",
      text: `${(w.rolling7DayRainIn ?? 0).toFixed(2)}" of rain over the last 7 days — recovery campaigns and dry-spell surcharge are relaxed back toward the normal schedule.` });
  }
  const demand = etDemand(profile, dateISO, w.etTodayIn);
  const seasonal = demand.factor;
  if (demand.source === "station") {
    rationale.push({
      factor: "season",
      text: `Local weather-station ET: ${demand.etTodayIn.toFixed(2)}" lost today → replacing ${Math.round(seasonal * 100)}% of peak demand.`,
    });
  } else {
    rationale.push({
      factor: "season",
      text: seasonal >= 0.95
        ? "Peak-season demand — full ET-based watering."
        : `Seasonal dial-down to ${Math.round(seasonal * 100)}% of peak — cooler/shorter days mean less evaporation.`,
    });
  }

  const startHour = profile.allowedHours?.[0]
    ?? (policy.banWindow ? Math.max(4, policy.banWindow[0] - 6) : 5);

  const wd = dayOfWeek(dateISO);
  const parityDays = profile.addressParity === "odd"
    ? policy.allowedWeekdaysOdd : policy.allowedWeekdaysEven;
  const restricted = parityDays.length > 0;
  if (restricted) {
    rationale.push({
      factor: "restriction",
      text: `${policy.label}: ${profile.addressParity}-numbered addresses may water ${describeDays(parityDays)}.`,
    });
  }
  if (policy.banWindow) {
    rationale.push({
      factor: "restriction",
      text: `No watering ${policy.banWindow[0]}:00–${policy.banWindow[1]}:00 (${policy.label}) — midday loss to evaporation.`,
    });
  }

  let pulseSlot = 0;

  for (const zone of profile.zones) {
    const plant = plantById(zone.plantTypeId);
    const grass = grassById(zone.grassTypeId);
    const plantLabel = plant.usesGrass ? grass.name : plant.name;
    const zonePhase = getZonePhase(profile, zone, dateISO);
    const zoneStart = zoneEstablishmentStart(profile, zone);
    const exempt = isEstablishmentExempt(policy, zoneStart, dateISO);
    const dayAllowed = !restricted || parityDays.includes(wd) || exempt;
    const program = waterProgramFor(profile, zone, zonePhase);

    const outcome: ZoneOutcome = { zoneId: zone.id, zoneName: zone.name, waters: false, program };
    const why: DecisionFactor[] = [
      { factor: "plant", text: `${plantLabel}.` },
      { factor: "efficiency", text: `${program.name}: ${program.blurb}` },
    ];

    if (exempt) {
      why.push({ factor: "establishment",
        text: "New-planting exemption active — daily watering permitted while roots establish." });
    }

    if (!dayAllowed) {
      outcome.reason = `Rest day (${policy.label} — waters ${describeDays(parityDays)})`;
      why.push({ factor: "restriction",
        text: `Rest day — ${policy.label} allows ${profile.addressParity} addresses to water ${describeDays(parityDays)}.` });
      outcome.explanation = why;
      zoneOutcomes.push(outcome);
      continue;
    }
    if (adj.skip) {
      outcome.reason = adj.notes[0];
      why.push(adj.factors[0]);
      outcome.explanation = why;
      zoneOutcomes.push(outcome);
      continue;
    }

    // Per-zone watering days this week (drives per-event inches).
    const wateringDaysCount = (exempt || !restricted)
      ? (zonePhase === "establishment" ? 7 : zonePhase === "transition" ? 4 : 3)
      : parityDays.length || 3;

    // Target inches for this single event.
    let eventInches: number;
    if (zonePhase === "establishment") {
      eventInches = plant.usesGrass ? 0.12 : 0.10; // light, frequent — keep the root zone moist
      why.push({ factor: "establishment",
        text: `Establishing — light ${eventInches}" soaks ${wateringDaysCount}×/week to grow roots, not run off.` });
    } else {
      const weekly = zoneWeeklyWaterTargetIn(profile, zone, dateISO, w.etTodayIn) * SUN_X[zone.sun];
      const ramp = zonePhase === "transition" ? transitionRamp(profile, zone, dateISO) : 1.0;
      eventInches = (weekly / wateringDaysCount) * ramp;
      why.push({ factor: "season",
        text: `~${weekly.toFixed(2)}"/week target → ${(weekly / wateringDaysCount).toFixed(2)}" per watering day.` });
      if (zone.sun !== "full_sun") {
        why.push({ factor: "plant",
          text: `${zone.sun === "shade" ? "Shaded" : "Part-shade"} zone — ${Math.round((1 - SUN_X[zone.sun]) * 100)}% less than full sun.` });
      }
      if (zonePhase === "transition") {
        why.push({ factor: "establishment",
          text: "Transitioning off the establishment schedule — easing toward the mature deficit plan." });
      }
    }
    // ── Recovery / dry-spell / ground-truth intelligence ──────────
    // A zone in a recovery campaign waters to an elevated CEILING: weather may
    // only reduce it (heat can't push above the recovery target). Otherwise the
    // normal weather multiplier applies, plus any lawn-wide dry-spell surcharge.
    // A bounded ground-truth nudge layers on either path.
    const recovery = recoveryStateFor(zone, dateISO, w);
    const surcharge = drySpellSurcharge(profile.drySpell?.surchargeX, w);
    const feedback = adaptiveFeedback(w);
    let intelMult: number;
    if (recovery.active) {
      intelMult = recovery.effectiveX * Math.min(adj.multiplier, 1) * feedback.x;
      if (recovery.factor) why.push(recovery.factor);
    } else {
      intelMult = surcharge.x * adj.multiplier * feedback.x;
      if (surcharge.factor) why.push(surcharge.factor);
    }
    if (feedback.factor) why.push(feedback.factor);
    eventInches *= intelMult;
    if (eventInches <= 0.01) {
      outcome.reason = "Skipped after weather adjustment.";
      why.push({ factor: "rain", text: "Skipped after rain/weather adjustment zeroed today's need." });
      outcome.explanation = why;
      zoneOutcomes.push(outcome);
      continue;
    }

    const precip = zonePrecipInHr(zone);
    // Cycle-and-soak only where the planting can run off — drip beds soak slowly.
    const passCap = program.id === "large_rotor" ? LARGE_ZONE_MAX_PASSES : MAX_PASSES;
    const passes = (zonePhase === "establishment" || !plant.cycleSoak)
      ? 1 : splitIntoPasses(eventInches, zone, profile, passCap);
    const perPassInches = eventInches / passes;
    const perPassMin = Math.max(1, Math.round((perPassInches / precip) * 60));

    for (let p = 0; p < passes; p++) {
      const slot = startHour * 60 + pulseSlot * 45 + p * 45;
      cycles.push({
        zoneId: zone.id,
        zoneName: zone.name,
        cycleType: zonePhase === "establishment" ? "establishment" : passes > 1 ? "pulse" : "standard",
        time: hhmm(Math.floor(slot / 60), slot % 60),
        minutes: perPassMin,
        inches: Math.round(perPassInches * 1000) / 1000,
      });
    }
    pulseSlot += 1;
    outcome.waters = true;

    // Hot-day cooling syringe — a short afternoon (post-ban) cycle that cools a
    // recovering zone on extreme days. Additive; never replaces the morning soak.
    if (wantsCoolingSyringe(recovery, w)) {
      cycles.push({
        zoneId: zone.id,
        zoneName: zone.name,
        cycleType: "syringe",
        time: SYRINGE_TIME,
        minutes: SYRINGE_MIN,
        inches: Math.round((SYRINGE_MIN / 60) * precip * 1000) / 1000,
      });
      why.push({ factor: "recovery",
        text: `Hot day ${Math.round(w.forecastHighF)}°F — ${SYRINGE_MIN}-min afternoon cooling syringe @ ${SYRINGE_TIME}.` });
    }

    if (passes > 1) {
      const slopeBit = zone.slope !== "flat" ? ` + ${zone.slope} slope` : "";
      const text = `Split into ${passes} cycles: ${soil.name.toLowerCase()} soil${slopeBit} would run off in one pass.`;
      why.push({ factor: zone.slope !== "flat" ? "slope" : "soil", text });
      notes.push(`${zone.name}: ${text}`);
    } else if (!plant.cycleSoak && plant.id !== "lawn") {
      why.push({ factor: "efficiency",
        text: "Single slow soak — drip applies water gently enough to skip cycle-and-soak." });
    }

    outcome.explanation = why;
    zoneOutcomes.push(outcome);
  }

  const anyRest = profile.zones.length > 0 && zoneOutcomes.every((o) => !o.waters)
    && !adj.skip && restricted && !parityDays.includes(wd);
  const status: PlanStatus = cycles.length === 0
    ? (anyRest ? "rest" : "skipped")
    : adj.multiplier !== 1 || adj.skip ? "adjusted" : "scheduled";

  return {
    date: dateISO,
    phase,
    status,
    cycles,
    zoneOutcomes,
    multiplier: adj.multiplier,
    notes,
    rationale,
  };
}

function describeDays(allowed: number[] | "any"): string {
  if (allowed === "any") return "any day";
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return allowed.map((d) => names[d]).join(" & ");
}

/** 7-day preview (base schedule, no weather adjustment). */
export function weeklyPreview(profile: LawnProfile, fromISO: string, days = 7) {
  const calm: WeatherInput = {
    precipYesterdayIn: 0, precipTodayForecastIn: 0,
    forecastHighF: 80, precipChancePct: 0, windMph: 5,
  };
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(Date.parse(fromISO + "T00:00:00Z") + i * 86400000)
      .toISOString().slice(0, 10);
    return buildDailyPlan(profile, calm, date);
  });
}
