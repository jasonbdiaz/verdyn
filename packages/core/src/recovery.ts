// Drought / heat-stress recovery + dry-spell intelligence.
//
// Generalizes the CXLINKS recovery campaign to any Verdyn zone. When a zone is
// stressed (heat + drought, or frequency pulled down too far for the season on
// fast-draining soil), snapping it straight back to the lean restriction
// baseline re-stresses it. Instead this runs a decaying recovery curve:
//
//   Phase A — Ramp   (days 0–3)   aggressive elevation, rehydrate the root zone
//   Phase B — Hold   (days 4–17)  maintain the elevated level while it recovers
//   Phase C — Taper  (days 18–27) wean back down gradually
//   Phase D — Floor  (day 28+)    settle to a NEW, higher floor than the
//                                 pre-stress lean level — not all the way back
//
// The elevation is a multiplier on the zone's ET-based weekly target and acts as
// a CEILING: weather (rain/cool) may reduce it, but heat can't push above it.
// Multi-day rainfall auto-relaxes the campaign (no manual edits when the rainy
// season returns), and hot days add a short afternoon cooling syringe.
//
// Pure module — no node deps — so it bundles in web and Expo alike.

import type { DecisionFactor, GroundTruth, WeatherInput, ZoneProfile, ZoneRecoveryConfig } from "./types";

// ── tunables (all overridable per-zone via ZoneRecoveryConfig) ────
export const RECOVERY_RAMP_DAY = 0;
export const RECOVERY_HOLD_DAY = 4;
export const RECOVERY_TAPER_DAY = 18;
export const RECOVERY_FLOOR_DAY = 28;

export const RECOVERY_RAMP_X = 1.30;
export const RECOVERY_HOLD_X = 1.20;
export const RECOVERY_TAPER_X = 1.10;
export const RECOVERY_FLOOR_X = 1.05; // the "new higher floor" vs 1.0 lean baseline

/** Rolling 7-day rainfall (in) at/above which recovery + dry-spell surcharge relax. */
export const ROLLING_RAIN_RELAX_IN = 1.5;

/** Forecast high (°F) at/above which a recovering zone gets a cooling syringe. */
export const HOT_DAY_F = 95;
/** Cooling-syringe length (min) and time — the first legal post-ban afternoon slot. */
export const SYRINGE_MIN = 8;
export const SYRINGE_TIME = "16:30";

/** Bounded ground-truth nudges. */
export const FEEDBACK_DRY_X = 1.15;
export const FEEDBACK_WET_X = 0.85;
export const FEEDBACK_URGENT_X = 1.10;
export const FEEDBACK_MIN = 0.8;
export const FEEDBACK_MAX = 1.3;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);

const rollingRain = (w: WeatherInput) => w.rolling7DayRainIn ?? 0;

/** True once enough multi-day rain has fallen to relax elevated watering. */
export function rainRelaxed(w: WeatherInput, threshold = ROLLING_RAIN_RELAX_IN): boolean {
  return rollingRain(w) >= threshold;
}

export type RecoveryPhase = "ramp" | "hold" | "taper" | "floor";

export interface RecoveryState {
  /** The recovery curve governs this zone today. */
  active: boolean;
  phase: RecoveryPhase | null;
  phaseLetter: "A" | "B" | "C" | "D" | "";
  phaseName: string;
  /** Target multiplier before relaxation (1.0 when inactive). */
  targetX: number;
  /** Rolling rain has relaxed the campaign back toward baseline. */
  relaxed: boolean;
  /** Multiplier the engine should apply today (1.0 when relaxed/inactive). */
  effectiveX: number;
  /** Explainable "why", or null when inactive. */
  factor: DecisionFactor | null;
}

const INACTIVE: RecoveryState = {
  active: false, phase: null, phaseLetter: "", phaseName: "",
  targetX: 1, relaxed: false, effectiveX: 1, factor: null,
};

/** Recovery state for a zone on a date, given today's rolling rainfall. */
export function recoveryStateFor(zone: ZoneProfile, dateISO: string, w: WeatherInput): RecoveryState {
  const cfg = zone.recovery;
  if (!cfg) return INACTIVE;
  const day = daysBetween(cfg.startISO, dateISO);
  if (day < 0) return INACTIVE;

  const rampDay = cfg.rampDay ?? RECOVERY_RAMP_DAY;
  const holdDay = cfg.holdDay ?? RECOVERY_HOLD_DAY;
  const taperDay = cfg.taperDay ?? RECOVERY_TAPER_DAY;
  const floorDay = cfg.floorDay ?? RECOVERY_FLOOR_DAY;

  let phase: RecoveryPhase, letter: RecoveryState["phaseLetter"], name: string, targetX: number;
  if (day >= floorDay) {
    phase = "floor"; letter = "D"; name = "Floor"; targetX = cfg.floorX ?? RECOVERY_FLOOR_X;
  } else if (day >= taperDay) {
    phase = "taper"; letter = "C"; name = "Taper"; targetX = cfg.taperX ?? RECOVERY_TAPER_X;
  } else if (day >= holdDay) {
    phase = "hold"; letter = "B"; name = "Hold"; targetX = cfg.holdX ?? RECOVERY_HOLD_X;
  } else if (day >= rampDay) {
    phase = "ramp"; letter = "A"; name = "Ramp"; targetX = cfg.rampX ?? RECOVERY_RAMP_X;
  } else {
    return INACTIVE;
  }

  const relaxed = rainRelaxed(w);
  const effectiveX = relaxed ? 1 : targetX;
  const factor: DecisionFactor = relaxed
    ? { factor: "recovery",
        text: `Recovery relaxed — ${rollingRain(w).toFixed(2)}" of rain in the last 7 days; easing back to the normal schedule.` }
    : { factor: "recovery",
        text: `Recovery Phase ${letter} (${name}) — watering at ${Math.round(targetX * 100)}% of target to ${
          phase === "ramp" ? "rebuild the stressed root zone"
          : phase === "hold" ? "hold the recovery while roots re-establish"
          : phase === "taper" ? "wean back down gradually"
          : "settle at a new, higher floor than the lean pre-stress level"}.` };

  return { active: true, phase, phaseLetter: letter, phaseName: name, targetX, relaxed, effectiveX, factor };
}

/** Lawn-wide dry-spell surcharge multiplier (auto-lifted by rolling rain). */
export function drySpellSurcharge(
  surchargeX: number | undefined | null, w: WeatherInput,
): { x: number; factor: DecisionFactor | null } {
  if (!surchargeX || surchargeX === 1) return { x: 1, factor: null };
  if (rainRelaxed(w)) {
    return { x: 1, factor: { factor: "rain",
      text: `Dry-spell surcharge lifted — ${rollingRain(w).toFixed(2)}" of rain in the last 7 days.` } };
  }
  return { x: surchargeX, factor: { factor: "season",
    text: `Dry-spell surcharge +${Math.round((surchargeX - 1) * 100)}% — extended heat with no meaningful rain.` } };
}

/** Bounded next-run nudge from ground-truth + health urgency. */
export function adaptiveFeedback(w: WeatherInput): { x: number; factor: DecisionFactor | null } {
  let x = 1;
  const bits: string[] = [];
  const obs: GroundTruth | undefined = w.observation;
  if (obs === "dry") { x *= FEEDBACK_DRY_X; bits.push("reported dry"); }
  else if (obs === "wet") { x *= FEEDBACK_WET_X; bits.push("reported wet"); }
  if (w.healthUrgent && obs !== "wet") { x *= FEEDBACK_URGENT_X; bits.push("health flagged urgent"); }
  if (!bits.length) return { x: 1, factor: null };
  x = clamp(Math.round(x * 100) / 100, FEEDBACK_MIN, FEEDBACK_MAX);
  return { x, factor: { factor: "feedback", text: `Ground-truth ×${x.toFixed(2)} (${bits.join(", ")}).` } };
}

/** Whether a recovering zone should get a hot-day cooling syringe today. */
export function wantsCoolingSyringe(state: RecoveryState, w: WeatherInput, hotDayF = HOT_DAY_F): boolean {
  return state.active && !state.relaxed &&
    (state.phase === "ramp" || state.phase === "hold") &&
    w.forecastHighF >= hotDayF;
}
