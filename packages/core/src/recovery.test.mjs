// Tests for the drought/heat-stress recovery + dry-spell intelligence,
// and its integration into buildDailyPlan. Run: node --test (via tsx/strip-types).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  recoveryStateFor, drySpellSurcharge, adaptiveFeedback, wantsCoolingSyringe, rainRelaxed,
  buildDailyPlan, emptyProfile, defaultZone,
} from "./index.ts";

const calm = { precipYesterdayIn: 0, precipTodayForecastIn: 0, forecastHighF: 88, precipChancePct: 10, windMph: 6 };
const zoneWith = (recovery) => ({ ...defaultZone("Stressed Tee", 1), grassTypeId: "zoysia", recovery });

// ── recovery curve phases ────────────────────────────────────────
test("recovery phases ramp → hold → taper → floor by day offset", () => {
  const z = zoneWith({ startISO: "2026-06-20" });
  assert.equal(recoveryStateFor(z, "2026-06-20", calm).phaseLetter, "A"); // day 0
  assert.equal(recoveryStateFor(z, "2026-06-24", calm).phaseLetter, "B"); // day 4
  assert.equal(recoveryStateFor(z, "2026-07-08", calm).phaseLetter, "C"); // day 18
  assert.equal(recoveryStateFor(z, "2026-07-18", calm).phaseLetter, "D"); // day 28
});

test("recovery elevates the target and decays toward the floor", () => {
  const z = zoneWith({ startISO: "2026-06-20" });
  const ramp = recoveryStateFor(z, "2026-06-20", calm).effectiveX;
  const floor = recoveryStateFor(z, "2026-07-18", calm).effectiveX;
  assert.ok(ramp > floor && floor > 1, "ramp elevates most, floor settles above 1.0");
});

test("recovery is inactive before its start date and with no config", () => {
  assert.equal(recoveryStateFor(zoneWith({ startISO: "2026-06-20" }), "2026-06-19", calm).active, false);
  assert.equal(recoveryStateFor(zoneWith(null), "2026-06-20", calm).active, false);
});

// ── rolling-rain relaxation ──────────────────────────────────────
test("rolling 7-day rain ≥ threshold relaxes recovery to 1.0", () => {
  const z = zoneWith({ startISO: "2026-06-20" });
  const wet = { ...calm, rolling7DayRainIn: 1.8 };
  const s = recoveryStateFor(z, "2026-06-20", wet);
  assert.equal(s.relaxed, true);
  assert.equal(s.effectiveX, 1);
  assert.ok(rainRelaxed(wet));
});

// ── dry-spell surcharge ──────────────────────────────────────────
test("dry-spell surcharge applies, then lifts on rolling rain", () => {
  assert.equal(drySpellSurcharge(1.12, calm).x, 1.12);
  assert.equal(drySpellSurcharge(1.12, { ...calm, rolling7DayRainIn: 2 }).x, 1);
  assert.equal(drySpellSurcharge(undefined, calm).x, 1);
});

// ── ground-truth feedback ────────────────────────────────────────
test("ground-truth nudges are bounded", () => {
  assert.ok(adaptiveFeedback({ ...calm, observation: "dry" }).x > 1);
  assert.ok(adaptiveFeedback({ ...calm, observation: "wet" }).x < 1);
  assert.equal(adaptiveFeedback(calm).x, 1);
  // dry + urgent stacks but stays clamped ≤ 1.3
  assert.ok(adaptiveFeedback({ ...calm, observation: "dry", healthUrgent: true }).x <= 1.3);
});

// ── cooling syringe gating ───────────────────────────────────────
test("cooling syringe only on hot days, in ramp/hold, not when relaxed", () => {
  const z = zoneWith({ startISO: "2026-06-20" });
  const hot = { ...calm, forecastHighF: 96 };
  assert.equal(wantsCoolingSyringe(recoveryStateFor(z, "2026-06-20", hot), hot), true);  // ramp, hot
  assert.equal(wantsCoolingSyringe(recoveryStateFor(z, "2026-06-20", calm), calm), false); // not hot
  assert.equal(wantsCoolingSyringe(recoveryStateFor(z, "2026-07-18", hot), hot), false);   // floor phase
  const wetHot = { ...hot, rolling7DayRainIn: 2 };
  assert.equal(wantsCoolingSyringe(recoveryStateFor(z, "2026-06-20", wetHot), wetHot), false); // relaxed
});

// ── integration with buildDailyPlan ──────────────────────────────
function miamiProfile(recovery) {
  const p = emptyProfile();
  p.zip = "33186"; p.soilTextureId = "sand"; p.addressParity = "odd"; p.establishmentStart = null;
  p.zones = [{ ...defaultZone("Tee", 1), grassTypeId: "bermuda", headTypeId: "mp_rotator",
    sun: "full_sun", slope: "flat", recovery }];
  return p;
}
const totalInches = (plan) => plan.cycles.reduce((s, c) => s + c.inches, 0);

test("a recovering zone waters more than the same zone without recovery", () => {
  const wed = "2026-06-17"; // Wednesday — allowed for odd in SFWMD
  const base = buildDailyPlan(miamiProfile(null), calm, wed);
  const rec = buildDailyPlan(miamiProfile({ startISO: wed }), calm, wed); // day 0 ramp
  assert.ok(base.cycles.length > 0 && rec.cycles.length > 0, "both water on Wed");
  assert.ok(totalInches(rec) > totalInches(base), "recovery elevates applied inches");
  assert.ok(rec.zoneOutcomes[0].explanation.some((f) => f.factor === "recovery"), "explains recovery");
});

test("hot day adds an afternoon cooling syringe cycle for a recovering zone", () => {
  const hot = { ...calm, forecastHighF: 97 };
  const plan = buildDailyPlan(miamiProfile({ startISO: "2026-06-17" }), hot, "2026-06-17");
  assert.ok(plan.cycles.some((c) => c.cycleType === "syringe"), "syringe cycle present");
});

test("rolling rain relaxes a recovering zone back to baseline (no syringe)", () => {
  const wed = "2026-06-17";
  const hotWet = { ...calm, forecastHighF: 97, rolling7DayRainIn: 1.8 };
  const base = buildDailyPlan(miamiProfile(null), calm, wed);
  const relaxed = buildDailyPlan(miamiProfile({ startISO: wed }), hotWet, wed);
  assert.ok(!relaxed.cycles.some((c) => c.cycleType === "syringe"), "no syringe when relaxed");
  assert.ok(Math.abs(totalInches(relaxed) - totalInches(base)) < 0.05, "back near baseline volume");
});
