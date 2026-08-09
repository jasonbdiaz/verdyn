// Smoke tests for runtime anomaly detection. Run via tsx: npx tsx --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { detectAnomalies, buildBaselines, defaultZone } from "./index.ts";

const zones = [
  { ...defaultZone("Front Lawn", 1) },
  { ...defaultZone("Back Beds", 2), id: "zone_2" },
];

// helper: a steady history of normal runs for one zone
function steady(zoneId, { min = 10, flow = 8, soil = 35, days = 5 } = {}) {
  return Array.from({ length: days }, (_, i) => ({
    zoneId, dateISO: `2026-06-${String(10 + i).padStart(2, "0")}`,
    scheduledMin: min, actualMin: min, flowGpm: flow, soilMoisturePct: soil,
  }));
}

test("no anomalies on steady, healthy runtime", () => {
  const out = detectAnomalies(zones, steady("zone_1"));
  assert.equal(out.length, 0);
});

test("no_run: scheduled but nothing ran", () => {
  const samples = [
    ...steady("zone_1"),
    { zoneId: "zone_1", dateISO: "2026-06-16", scheduledMin: 10, actualMin: 0, flowGpm: 0 },
  ];
  const out = detectAnomalies(zones, samples);
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, "no_run");
  assert.equal(out[0].severity, "critical");
});

test("stuck_valve: ran far past schedule", () => {
  const samples = [
    ...steady("zone_1"),
    { zoneId: "zone_1", dateISO: "2026-06-16", scheduledMin: 10, actualMin: 40, flowGpm: 8 },
  ];
  const out = detectAnomalies(zones, samples);
  assert.equal(out[0].kind, "stuck_valve");
  assert.equal(out[0].severity, "critical");
});

test("leak_high_flow: flow well above this zone's norm", () => {
  const samples = [
    ...steady("zone_1", { flow: 8 }),
    { zoneId: "zone_1", dateISO: "2026-06-16", scheduledMin: 10, actualMin: 10, flowGpm: 12 },
  ];
  const out = detectAnomalies(zones, samples);
  assert.equal(out[0].kind, "leak_high_flow");
});

test("broken_head: modestly high flow", () => {
  const samples = [
    ...steady("zone_1", { flow: 8 }),
    { zoneId: "zone_1", dateISO: "2026-06-16", scheduledMin: 10, actualMin: 10, flowGpm: 9.6 },
  ];
  const out = detectAnomalies(zones, samples);
  assert.equal(out[0].kind, "broken_head");
  assert.equal(out[0].severity, "warning");
});

test("clog_low_flow: flow well below norm", () => {
  const samples = [
    ...steady("zone_1", { flow: 8 }),
    { zoneId: "zone_1", dateISO: "2026-06-16", scheduledMin: 10, actualMin: 10, flowGpm: 4 },
  ];
  const out = detectAnomalies(zones, samples);
  assert.equal(out[0].kind, "clog_low_flow");
});

test("soil stays dry after a real run → broken_head (no flow meter)", () => {
  const samples = [
    // history without flow, with healthy soil
    ...Array.from({ length: 4 }, (_, i) => ({
      zoneId: "zone_1", dateISO: `2026-06-1${i}`, scheduledMin: 10, actualMin: 10, soilMoisturePct: 32,
    })),
    { zoneId: "zone_1", dateISO: "2026-06-16", scheduledMin: 10, actualMin: 10, soilMoisturePct: 12 },
  ];
  const out = detectAnomalies(zones, samples);
  assert.equal(out[0].kind, "broken_head");
});

test("sensor_no_response: flow sensor goes silent", () => {
  const samples = [
    ...steady("zone_1", { flow: 8 }),
    { zoneId: "zone_1", dateISO: "2026-06-16", scheduledMin: 10, actualMin: 10, flowGpm: null },
  ];
  const out = detectAnomalies(zones, samples);
  assert.equal(out[0].kind, "sensor_no_response");
  assert.equal(out[0].severity, "info");
});

test("buildBaselines computes per-zone medians", () => {
  const b = buildBaselines(steady("zone_1", { flow: 8, min: 10 }));
  assert.equal(b.zone_1.typicalFlowGpm, 8);
  assert.equal(b.zone_1.typicalMinutes, 10);
  assert.equal(b.zone_1.samples, 5);
});
