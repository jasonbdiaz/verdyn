import { test } from "node:test";
import assert from "node:assert/strict";
import { etDemandFactor, ET_FACTOR_MAX, ET_FACTOR_MIN } from "./index.ts";

test("prefers live station ET over the static climate value", () => {
  const r = etDemandFactor(0.22, 0.11, 0.22);
  assert.equal(r.source, "station");
  assert.equal(r.etTodayIn, 0.22);
  assert.equal(r.factor, 1); // 0.22 / 0.22
});

test("falls back to the static climate value when no live reading", () => {
  const r = etDemandFactor(undefined, 0.11, 0.22);
  assert.equal(r.source, "climate");
  assert.equal(r.etTodayIn, 0.11);
  assert.equal(r.factor, 0.5); // 0.11 / 0.22
});

test("treats a missing/NaN/negative live reading as absent", () => {
  for (const bad of [NaN, -1, Infinity]) {
    const r = etDemandFactor(bad, 0.11, 0.22);
    assert.equal(r.source, "climate", `value ${bad} should fall back`);
  }
});

test("a hot dry day above peak is capped, not unbounded", () => {
  const r = etDemandFactor(0.40, 0.11, 0.22); // ~1.8x peak
  assert.equal(r.source, "station");
  assert.equal(r.factor, ET_FACTOR_MAX);
});

test("deep-winter near-zero ET floors at the minimum, never zero", () => {
  const r = etDemandFactor(0.0, 0.11, 0.22);
  assert.equal(r.factor, ET_FACTOR_MIN);
});

test("guards a zero/garbage peak (no divide-by-zero)", () => {
  const r = etDemandFactor(0.2, 0.1, 0);
  assert.equal(r.factor, 1);
});
