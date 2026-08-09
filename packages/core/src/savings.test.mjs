// Smoke tests for the dollarized, per-zone savings report.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  estimatePropertySavings, waterRateForState, dollarsForGallons,
  US_AVG_USD_PER_KGAL, buildDailyPlan, weeklyPreview, emptyProfile, defaultZone,
} from "./index.ts";

function miamiProfile() {
  const p = emptyProfile();
  p.zip = "33186";
  p.soilTextureId = "sand";
  p.addressParity = "odd";
  p.establishmentStart = null;
  p.zones = [
    { ...defaultZone("Front Lawn", 1), areaSqft: 2000 },
    { ...defaultZone("Back Beds", 2), id: "zone_2", plantTypeId: "shrubs", headTypeId: "drip", areaSqft: 500 },
  ];
  return p;
}

test("water rate: state lookup, override, and US fallback", () => {
  assert.equal(waterRateForState("FL"), 9.0);
  assert.equal(waterRateForState("fl"), 9.0);
  assert.equal(waterRateForState("ZZ"), US_AVG_USD_PER_KGAL);
  assert.equal(waterRateForState("FL", 20), 20); // override wins
  assert.equal(dollarsForGallons(1000, 11.5), 11.5);
});

test("property report: gallons + dollars + per-zone, saves vs baseline", () => {
  const p = miamiProfile();
  const week = weeklyPreview(p, "2026-06-15", 7);
  const r = estimatePropertySavings(week, p.zones, { state: "FL" });
  assert.equal(r.days, 7);
  assert.equal(r.perZone.length, 2);
  assert.ok(r.baselineGal > r.appliedGal, "Verdyn applies less than the dumb-timer baseline");
  assert.ok(r.savedGal > 0 && r.savedPct > 0);
  assert.ok(r.savedUsd > 0, "saved dollars are positive");
  assert.equal(r.ratePerKGalUsd, 9.0);
  assert.equal(r.rateIsEstimate, true);
  // dollars tie out to gallons at the chosen rate
  assert.ok(Math.abs(r.savedUsd - dollarsForGallons(r.savedGal, 9.0)) < 0.02);
});

test("override rate flags rateIsEstimate false", () => {
  const p = miamiProfile();
  const week = weeklyPreview(p, "2026-06-15", 7);
  const r = estimatePropertySavings(week, p.zones, { state: "FL", ratePerKGalUsd: 14 });
  assert.equal(r.ratePerKGalUsd, 14);
  assert.equal(r.rateIsEstimate, false);
});
