// Smoke tests for the Verdyn engine. Run: node --test (after tsc, or via tsx).
// These import the TS sources through node's stripping (node 22.6+ --experimental,
// node 23+ native). For CI use a bundler; this is a quick local check.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildDailyPlan, getPhase, getZonePhase, weeklyPreview, climateZoneForZip, policyForZip,
  emptyProfile, defaultZone, zoneWeeklyWaterTargetIn, transitionRamp,
} from "./index.ts";

function miamiBermudaProfile() {
  const p = emptyProfile();
  p.zip = "33186"; // Miami
  p.soilTextureId = "sand";
  p.addressParity = "odd";
  p.establishmentStart = null; // mature
  p.zones = [{ ...defaultZone("Front Green", 1), grassTypeId: "bermuda", headTypeId: "mp_rotator", sun: "full_sun", slope: "flat" }];
  return p;
}

const calm = { precipYesterdayIn: 0, precipTodayForecastIn: 0, forecastHighF: 88, precipChancePct: 10, windMph: 6 };

test("Miami ZIP maps to subtropical + SFWMD", () => {
  assert.equal(climateZoneForZip("33186").id, "humid_subtropical");
  assert.equal(policyForZip("33186").id, "sfwmd");
});

test("mature bermuda waters only on allowed days (Wed/Sat for odd)", () => {
  const p = miamiBermudaProfile();
  // 2026-06-17 is a Wednesday
  const wed = buildDailyPlan(p, calm, "2026-06-17");
  assert.ok(wed.cycles.length > 0, "should water Wednesday");
  // 2026-06-18 Thursday — rest day for odd address
  const thu = buildDailyPlan(p, calm, "2026-06-18");
  assert.equal(thu.cycles.length, 0, "should rest Thursday");
  assert.equal(thu.status, "rest");
});

test("rain yesterday skips", () => {
  const p = miamiBermudaProfile();
  const plan = buildDailyPlan(p, { ...calm, precipYesterdayIn: 0.4 }, "2026-06-17");
  assert.equal(plan.cycles.length, 0);
});

test("wind skips", () => {
  const p = miamiBermudaProfile();
  const plan = buildDailyPlan(p, { ...calm, windMph: 25 }, "2026-06-17");
  assert.equal(plan.cycles.length, 0);
});

test("clay soil triggers cycle-and-soak (multiple passes)", () => {
  const p = miamiBermudaProfile();
  p.zip = "75201"; // Dallas — texas policy, allows Wed/Sat odd
  p.soilTextureId = "clay";
  p.zones[0].headTypeId = "spray"; // high precip rate
  const plan = buildDailyPlan(p, calm, "2026-06-17");
  const pulses = plan.cycles.filter((c) => c.cycleType === "pulse");
  assert.ok(pulses.length >= 2, `expected cycle-and-soak, got ${plan.cycles.length} cycles`);
});

test("establishment: new sod waters daily, light", () => {
  const p = miamiBermudaProfile();
  p.establishmentStart = "2026-06-15";
  // day 2 of establishment — a Thursday that would normally be a rest day
  const plan = buildDailyPlan(p, calm, "2026-06-18");
  assert.equal(getPhase(p, "2026-06-18"), "establishment");
  assert.ok(plan.cycles.length > 0, "establishment waters daily despite restriction");
  assert.ok(plan.cycles.every((c) => c.cycleType === "establishment"));
});

test("weekly preview returns 7 days", () => {
  const p = miamiBermudaProfile();
  const week = weeklyPreview(p, "2026-06-15", 7);
  assert.equal(week.length, 7);
});

// ── F1: zone-level plant-type intelligence ──────────────────────
test("drip veg-garden zone uses plant water need, not grass", () => {
  const p = miamiBermudaProfile();
  const veg = { ...defaultZone("Veg Garden", 2), plantTypeId: "veg_garden", headTypeId: "drip", sun: "full_sun", slope: "flat" };
  // veg_garden (1.5"/wk) should out-water shrubs (0.75"/wk) at the same ZIP/date
  const shrub = { ...defaultZone("Shrubs", 3), plantTypeId: "shrubs", headTypeId: "drip", sun: "full_sun", slope: "flat" };
  const vegTarget = zoneWeeklyWaterTargetIn(p, veg, "2026-06-17");
  const shrubTarget = zoneWeeklyWaterTargetIn(p, shrub, "2026-06-17");
  assert.ok(vegTarget > shrubTarget, `veg ${vegTarget} should exceed shrubs ${shrubTarget}`);
});

test("drip beds do NOT get cycle-and-soak even on clay + slope", () => {
  const p = miamiBermudaProfile();
  p.zip = "75201"; // Dallas
  p.soilTextureId = "clay";
  p.zones = [{ ...defaultZone("Shrub Bed", 1), plantTypeId: "shrubs", headTypeId: "drip", sun: "full_sun", slope: "steep" }];
  const plan = buildDailyPlan(p, calm, "2026-06-17");
  // drip soaks slowly — single soak, never pulse-split
  assert.ok(!plan.cycles.some((c) => c.cycleType === "pulse"), "drip beds should not pulse-split");
});

test("per-zone establishment: one zone new sod, another mature", () => {
  const p = miamiBermudaProfile();
  p.establishmentStart = null;
  p.zones = [
    { ...defaultZone("Mature Lawn", 1), grassTypeId: "bermuda", headTypeId: "mp_rotator", sun: "full_sun", slope: "flat" },
    { ...defaultZone("New Sod", 2), grassTypeId: "bermuda", headTypeId: "mp_rotator", sun: "full_sun", slope: "flat", establishmentStart: "2026-06-15" },
  ];
  assert.equal(getZonePhase(p, p.zones[0], "2026-06-18"), "established");
  assert.equal(getZonePhase(p, p.zones[1], "2026-06-18"), "establishment");
});

// ── F5: explainability ──────────────────────────────────────────
test("every plan carries rationale and per-zone explanations", () => {
  const p = miamiBermudaProfile();
  const plan = buildDailyPlan(p, { ...calm, forecastHighF: 98 }, "2026-06-17");
  assert.ok(Array.isArray(plan.rationale) && plan.rationale.length > 0, "plan has rationale");
  // heat bump should be explained
  assert.ok(plan.rationale.some((f) => f.factor === "heat"), "heat factor present");
  // every zone outcome explains itself
  assert.ok(plan.zoneOutcomes.every((o) => Array.isArray(o.explanation) && o.explanation.length > 0),
    "each zone has an explanation");
  // a watering zone names its plant
  const watered = plan.zoneOutcomes.find((o) => o.waters);
  assert.ok(watered.explanation.some((f) => f.factor === "plant"), "explains the plant type");
});

test("cycle-and-soak explanation names soil/slope", () => {
  const p = miamiBermudaProfile();
  p.zip = "75201";
  p.soilTextureId = "clay";
  p.zones[0].headTypeId = "spray";
  p.zones[0].slope = "moderate";
  const plan = buildDailyPlan(p, calm, "2026-06-17");
  const watered = plan.zoneOutcomes.find((o) => o.waters);
  const splitWhy = watered.explanation.find((f) => f.text.includes("Split into"));
  assert.ok(splitWhy, "explains the cycle split");
  assert.ok(/clay/i.test(splitWhy.text) && /slope/i.test(splitWhy.text), "names clay soil + slope");
});

test("3-day heat streak escalates the +20% bump to +30% wilt watch", () => {
  const p = miamiBermudaProfile();
  const hot = { ...calm, forecastHighF: 96 };
  const single = buildDailyPlan(p, { ...hot, consecutiveHotDays: 1 }, "2026-06-17");
  const streak = buildDailyPlan(p, { ...hot, consecutiveHotDays: 3 }, "2026-06-17");
  const total = (plan) => plan.cycles.reduce((s, c) => s + c.minutes, 0);
  assert.ok(total(streak) > total(single), "streak day should water more than a single hot day");
  assert.ok(streak.notes.some((n) => n.includes("wilt watch")), "notes should name the wilt watch");
  assert.ok(single.notes.some((n) => n.includes("+20%")), "single hot day keeps the flat bump");
});

test("transition ramp rises linearly from 50% to 100% (not flat 0.8)", () => {
  const p = miamiBermudaProfile();
  const zone = p.zones[0];
  p.establishmentStart = "2026-01-01"; // bermuda: 90 est. days → transition [54, 90)
  assert.equal(getZonePhase(p, zone, "2026-02-24"), "transition"); // day 54
  assert.ok(Math.abs(transitionRamp(p, zone, "2026-02-24") - 0.5) < 0.02, "start of transition ≈ 50%");
  assert.ok(Math.abs(transitionRamp(p, zone, "2026-03-14") - 0.75) < 0.02, "midpoint (day 72) ≈ 75%");
  assert.ok(transitionRamp(p, zone, "2026-03-30") > 0.9, "near full establishment → ~100%");
  assert.equal(transitionRamp(p, zone, "2026-04-01"), 1, "established → no ramp");
});
