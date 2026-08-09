import { test } from "node:test";
import assert from "node:assert/strict";
import { waterProgramFor, isLargeZone, buildDailyPlan } from "./index.ts";

const baseZone = (over = {}) => ({
  id: "z1", name: "Zone 1", grassTypeId: "bermuda",
  headTypeId: "mp_rotator", sun: "full_sun", slope: "flat", ...over,
});

const profile = (zones) => ({
  id: "p1", createdAt: "2026-06-01", zip: "33133", climateZoneId: "humid_subtropical",
  soilTextureId: "clay", addressParity: "odd", zones, establishmentStart: null, expertMode: false,
});

test("mature turf on small spray zone → deep cycle-and-soak", () => {
  const p = waterProgramFor(profile([]), baseZone({ plantTypeId: "lawn", headTypeId: "spray" }), "established");
  assert.equal(p.id, "turf_cycle_soak");
});

test("turf on a rotor → large-zone rotor program", () => {
  const p = waterProgramFor(profile([]), baseZone({ plantTypeId: "lawn", headTypeId: "rotor" }), "established");
  assert.equal(p.id, "large_rotor");
});

test("a big lawn by area → large-zone program even on small heads", () => {
  assert.equal(isLargeZone(baseZone({ headTypeId: "spray", areaSqft: 8000 })), true);
  const p = waterProgramFor(profile([]), baseZone({ plantTypeId: "lawn", headTypeId: "spray", areaSqft: 8000 }), "established");
  assert.equal(p.id, "large_rotor");
});

test("new sod → establishment program regardless of size", () => {
  const p = waterProgramFor(profile([]), baseZone({ plantTypeId: "lawn", headTypeId: "rotor" }), "establishment");
  assert.equal(p.id, "turf_establish");
});

test("each non-turf planting maps to its own program", () => {
  const cases = [
    ["shrubs", "drip_soak"],
    ["flower_bed", "bed_frequent"],
    ["veg_garden", "bed_frequent"],
    ["groundcover", "bed_frequent"],
    ["trees", "tree_deep_slow"],
    ["native", "xeric_minimal"],
  ];
  for (const [plant, id] of cases) {
    const p = waterProgramFor(profile([]), baseZone({ plantTypeId: plant, headTypeId: "drip" }), "established");
    assert.equal(p.id, id, `${plant} → ${id}`);
  }
});

test("the daily plan attaches a program to every zone outcome", () => {
  const zones = [
    baseZone({ id: "lawn", plantTypeId: "lawn", headTypeId: "rotor" }),
    baseZone({ id: "beds", plantTypeId: "flower_bed", headTypeId: "drip" }),
  ];
  const plan = buildDailyPlan(profile(zones), {
    precipYesterdayIn: 0, precipTodayForecastIn: 0, forecastHighF: 88, precipChancePct: 0, windMph: 5,
  }, "2026-06-20");
  for (const o of plan.zoneOutcomes) assert.ok(o.program?.id, `${o.zoneName} has a program`);
});
