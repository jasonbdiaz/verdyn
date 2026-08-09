// Run-time execution policy for automated watering.
//
// The scheduling engine already bakes every restriction into the plan: a banned
// hour, an off day, a wind-out day, or a rain skip simply never produces a
// PlanCycle. So an executor that "runs exactly the cycles in today's plan" is
// already compliant. The helpers here are DEFENSE IN DEPTH — a second, dumb,
// hard gate the executor re-asserts at the moment it is about to energize a
// valve, so a bug upstream can never water at a forbidden time.
//
// Two hard invariants, straight from the operating rules:
//   • Never water 10:00–16:00 (Miami-Dade permanent daytime ban + evaporation).
//   • Never water in the evening or overnight (Pythium / fungal risk).
// Both are satisfied by only ever energizing a valve in the early-morning
// window below — with one narrow exception: a hot-day cooling syringe may run
// 16:00–18:30, after the ban lifts and well before the fungal-risk evening.
// That carve-out admits ONLY `cycleType === "syringe"` cycles; every other
// cycle scheduled outside the morning window is still refused at run time.

import type { DailyPlan, PlanCycle } from "./types";

/** Local-clock window, [startHour, endHour), in which a valve may be energized.
 *  Mornings only: after the overnight fungal-risk window, before the midday ban. */
export const RUN_WINDOW: readonly [number, number] = [4, 10];

/** Minute-of-day window in which ONLY a cooling syringe may run: post-ban
 *  afternoon, 16:00–18:30 inclusive. Short cycles here cool heat-stressed turf
 *  without the overnight-wetness fungal risk. */
export const SYRINGE_WINDOW_MIN: readonly [number, number] = [16 * 60, 18 * 60 + 30];

/** True when the given local hour (0–23) is inside the allowed irrigation window. */
export function withinIrrigationWindow(hour: number): boolean {
  return hour >= RUN_WINDOW[0] && hour < RUN_WINDOW[1];
}

/** Parse a "HH:MM" 24h local time to its hour, or NaN if malformed. */
export function cycleHour(time: string): number {
  const h = Number.parseInt(time.slice(0, 2), 10);
  return Number.isInteger(h) && h >= 0 && h <= 23 ? h : NaN;
}

/** Minute-of-day (0–1439) for a "HH:MM" local time, or NaN if malformed. */
export function cycleMinuteOfDay(time: string): number {
  const h = Number.parseInt(time.slice(0, 2), 10);
  const m = Number.parseInt(time.slice(3, 5), 10);
  if (!Number.isInteger(h) || h < 0 || h > 23 || !Number.isInteger(m) || m < 0 || m > 59) return NaN;
  return h * 60 + m;
}

/**
 * The cycles in today's plan that are DUE at the given local wall-clock time —
 * scheduled for now or already overdue, but still inside the morning window.
 *
 * The executor runs on a fine-grained cron (every RUN_SLOT_MINUTES), so each
 * cycle-and-soak pulse fires at its own scheduled time and the soak gaps between
 * pulses are preserved. "Due or overdue" (rather than "exactly this slot") makes
 * a delayed or missed cron firing self-heal: a pulse that wasn't run yet still
 * gets picked up on the next firing rather than being skipped for the day. The
 * caller's idempotent run-ledger guarantees each pulse runs at most once.
 *
 * Cutoff: nothing is returned once the local hour leaves the irrigation window,
 * so an overdue pulse is never run into the midday ban. The lone exception is
 * the afternoon syringe window, where only syringe cycles are eligible.
 */
export function cyclesDueAt(plan: DailyPlan, localHour: number, localMinute: number): PlanCycle[] {
  const nowMin = localHour * 60 + localMinute;
  if (withinIrrigationWindow(localHour)) {
    const windowStartMin = RUN_WINDOW[0] * 60;
    return plan.cycles.filter((c) => {
      const m = cycleMinuteOfDay(c.time);
      return Number.isFinite(m) && m >= windowStartMin && m <= nowMin;
    });
  }
  if (nowMin >= SYRINGE_WINDOW_MIN[0] && nowMin <= SYRINGE_WINDOW_MIN[1]) {
    return plan.cycles.filter((c) => {
      if (c.cycleType !== "syringe") return false;
      const m = cycleMinuteOfDay(c.time);
      return Number.isFinite(m) && m >= SYRINGE_WINDOW_MIN[0] && m <= nowMin;
    });
  }
  return [];
}

/** Cron cadence (minutes) the executor expects. Finer than the 45-min pulse
 *  spacing so each soak pulse lands on its own firing. */
export const RUN_SLOT_MINUTES = 15;
