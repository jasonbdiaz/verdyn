// Tests for the run-time execution policy (defense-in-depth gate). Run via tsx:
//   npx tsx --test packages/core/src/*.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RUN_WINDOW, SYRINGE_WINDOW_MIN, withinIrrigationWindow, cycleHour, cycleMinuteOfDay, cyclesDueAt,
} from "./index.ts";

const plan = (times) => ({
  date: "2026-06-17",
  phase: "established",
  status: "scheduled",
  multiplier: 1,
  notes: [],
  zoneOutcomes: [],
  cycles: times.map(([zoneId, time], i) => ({
    zoneId, zoneName: `Zone ${i + 1}`, cycleType: "standard", time, minutes: 12, inches: 0.2,
  })),
});

test("window is mornings only, [4,10)", () => {
  assert.deepEqual([...RUN_WINDOW], [4, 10]);
  assert.equal(withinIrrigationWindow(3), false); // overnight
  assert.equal(withinIrrigationWindow(4), true);
  assert.equal(withinIrrigationWindow(9), true);
  assert.equal(withinIrrigationWindow(10), false); // start of midday ban
  assert.equal(withinIrrigationWindow(14), false); // Miami-Dade ban
  assert.equal(withinIrrigationWindow(20), false); // evening / Pythium
});

test("cycleHour / cycleMinuteOfDay parse HH:MM and reject junk", () => {
  assert.equal(cycleHour("05:30"), 5);
  assert.equal(cycleHour("23:59"), 23);
  assert.ok(Number.isNaN(cycleHour("--:--")));
  assert.equal(cycleMinuteOfDay("04:00"), 240);
  assert.equal(cycleMinuteOfDay("05:30"), 330);
  assert.ok(Number.isNaN(cycleMinuteOfDay("zz:00")));
  assert.ok(Number.isNaN(cycleMinuteOfDay("04:zz")));
});

test("cycle-and-soak pulses come due one at a time as the clock advances", () => {
  const p = plan([["z1", "04:00"], ["z1b", "04:45"], ["z1c", "05:30"]]);
  // 04:00 firing — only the first pulse is due; the soak gap holds the rest back.
  assert.deepEqual(cyclesDueAt(p, 4, 0).map((c) => c.zoneId), ["z1"]);
  // 04:45 firing — second pulse now due (first already ran, dedup is the caller's job).
  assert.deepEqual(cyclesDueAt(p, 4, 45).map((c) => c.zoneId), ["z1", "z1b"]);
  // 05:30 firing — all three due.
  assert.deepEqual(cyclesDueAt(p, 5, 30).map((c) => c.zoneId), ["z1", "z1b", "z1c"]);
});

test("a delayed firing self-heals: an overdue pulse is still picked up", () => {
  const p = plan([["z1", "04:00"]]);
  // Cron didn't fire at 04:00; at 04:15 the overdue pulse is still due.
  assert.deepEqual(cyclesDueAt(p, 4, 15).map((c) => c.zoneId), ["z1"]);
});

test("nothing is due once the window closes — overdue pulses never run into the ban", () => {
  const p = plan([["z1", "04:00"], ["z2", "09:45"]]);
  assert.deepEqual(cyclesDueAt(p, 10, 0), []); // 10:00 — Miami-Dade ban starts
  assert.deepEqual(cyclesDueAt(p, 14, 0), []); // afternoon
});

test("a cycle outside the window is NEVER due, even if the plan contains it", () => {
  // Bug simulation: a cycle wrongly scheduled at 14:00. The hard gate refuses it.
  const p = plan([["z1", "14:00"]]);
  assert.deepEqual(cyclesDueAt(p, 14, 0), []);
});

test("afternoon carve-out admits ONLY syringe cycles, only 16:00–18:30", () => {
  const p = plan([["z1", "05:00"], ["z1", "16:30"]]);
  p.cycles[1].cycleType = "syringe";
  assert.deepEqual(cyclesDueAt(p, 12, 0), [], "midday ban holds");
  assert.deepEqual(cyclesDueAt(p, 16, 15), [], "16:30 syringe not yet due at 16:15");
  const due = cyclesDueAt(p, 16, 45);
  assert.equal(due.length, 1, "syringe due at 16:45");
  assert.equal(due[0].cycleType, "syringe");
  assert.ok(!due.some((c) => c.time === "05:00"), "overdue morning cycle must NOT leak into the afternoon");
  assert.deepEqual(cyclesDueAt(p, 19, 0), [], "window closed by 19:00");
});

test("a non-syringe cycle scheduled in the afternoon is still refused", () => {
  const p = plan([["z1", "16:30"]]); // cycleType "standard"
  assert.deepEqual(cyclesDueAt(p, 16, 45), []);
});

test("SYRINGE_WINDOW_MIN matches the proven 16:00–18:30 legal slot", () => {
  assert.deepEqual([...SYRINGE_WINDOW_MIN], [960, 1110]);
});
