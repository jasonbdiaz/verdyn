// Smoke tests for proactive compliance diffing + audit log.
import { test } from "node:test";
import assert from "node:assert/strict";
import { diffRestrictions, toSnapshot, complianceEntryFromChange, RESTRICTION_POLICIES } from "./index.ts";

const sfwmd = toSnapshot(RESTRICTION_POLICIES.sfwmd);   // 2 days, ban 10–16
const none = toSnapshot(RESTRICTION_POLICIES.none);     // open, no ban
const tx = toSnapshot(RESTRICTION_POLICIES.texas_2day); // ban 10–18

test("no change → no events", () => {
  assert.deepEqual(diffRestrictions(sfwmd, sfwmd, "odd"), []);
});

test("new restriction where there was none", () => {
  const out = diffRestrictions(null, sfwmd, "odd");
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, "new_restriction");
  assert.match(out[0].message, /Wed & Sat/);
});

test("restriction lifted", () => {
  const out = diffRestrictions(sfwmd, none, "odd");
  assert.equal(out[0].kind, "restriction_lifted");
});

test("tighter days are flagged as tighter", () => {
  const oneDay = { ...sfwmd, allowedWeekdaysOdd: [6], allowedWeekdaysEven: [0] };
  const out = diffRestrictions(sfwmd, oneDay, "odd");
  const dc = out.find((c) => c.kind === "days_changed");
  assert.ok(dc);
  assert.match(dc.title, /Fewer watering days/);
});

test("ban-window change is detected", () => {
  // same days, different ban window (sfwmd 10–16 vs texas 10–18) but also days differ;
  // craft a snapshot that only changes hours
  const sfwmdLaterBan = { ...sfwmd, banWindow: [10, 18] };
  const out = diffRestrictions(sfwmd, sfwmdLaterBan, "odd");
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, "hours_changed");
});

test("audit entry is built from a change", () => {
  const out = diffRestrictions(null, sfwmd, "odd");
  const entry = complianceEntryFromChange("123 Main St", sfwmd, out[0], "builtin", "2026-06-16T12:00:00.000Z");
  assert.equal(entry.addressLabel, "123 Main St");
  assert.equal(entry.kind, "new_restriction");
  assert.equal(entry.policyLabel, sfwmd.label);
  assert.equal(entry.at, "2026-06-16T12:00:00.000Z");
  assert.ok(entry.id.startsWith("cl_"));
});
