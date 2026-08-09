// Verdyn proactive compliance. Two jobs:
//
//  1) DIFF — when a ZIP/county's watering rule changes (a new policy resolves,
//     or AI research returns an updated LocalRestriction), compare it to what we
//     had and emit plain-English change events: "Your county shifted to 2-day/
//     week watering — your plan was updated." These drive push/in-app alerts.
//
//  2) AUDIT — every change (and every plan the engine runs against a restriction)
//     can be written to a timestamped compliance log per address. For a Pro
//     lawn-care business that's legal cover: a defensible record that each client
//     property was watered within the rules in force on each date.

import type { LocalRestriction, RestrictionPolicy } from "./types";

/** The restriction fields we track for change detection. Both RestrictionPolicy
 *  and LocalRestriction structurally satisfy this. */
export interface RestrictionSnapshot {
  policyId: string;
  label: string;
  allowedWeekdaysOdd: number[];
  allowedWeekdaysEven: number[];
  banWindow: [number, number] | null;
  establishmentExemptDays: number;
}

export type ComplianceChangeKind =
  | "new_restriction" | "restriction_lifted" | "days_changed"
  | "hours_changed" | "establishment_changed" | "policy_replaced";

export interface ComplianceChange {
  kind: ComplianceChangeKind;
  /** Headline suitable for a push notification. */
  title: string;
  /** One- to two-sentence plain-English explanation. */
  message: string;
  /** Field-level before/after for the audit log. */
  from?: string;
  to?: string;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const describeDays = (days: number[]): string =>
  days.length === 0 ? "any day" : days.map((d) => DAY_NAMES[d]).join(" & ");
const sameDays = (a: number[], b: number[]) =>
  a.length === b.length && [...a].sort().join(",") === [...b].sort().join(",");
const describeHours = (w: [number, number] | null) =>
  w ? `${w[0]}:00–${w[1]}:00` : "no daytime ban";
const isOpen = (s: RestrictionSnapshot) =>
  s.allowedWeekdaysOdd.length === 0 && s.allowedWeekdaysEven.length === 0;
const daysFor = (s: RestrictionSnapshot, parity: "odd" | "even") =>
  parity === "odd" ? s.allowedWeekdaysOdd : s.allowedWeekdaysEven;

/**
 * Diff two restriction snapshots from the perspective of one address. Returns
 * the change events to surface to the owner (empty when nothing material moved).
 */
export function diffRestrictions(
  prev: RestrictionSnapshot | null | undefined,
  next: RestrictionSnapshot,
  parity: "odd" | "even" = "odd",
): ComplianceChange[] {
  if (!prev) {
    if (isOpen(next) && !next.banWindow) return [];
    return [{
      kind: "new_restriction",
      title: "New watering rules for your area",
      message: `${next.label} now applies: water ${describeDays(daysFor(next, parity))}`
        + `${next.banWindow ? `, never ${describeHours(next.banWindow)}` : ""}. Verdyn already updated your plan.`,
      to: next.label,
    }];
  }

  const changes: ComplianceChange[] = [];

  // Restriction effectively lifted.
  if (!isOpen(prev) && isOpen(next) && !next.banWindow) {
    changes.push({
      kind: "restriction_lifted",
      title: "Watering restrictions lifted",
      message: `${prev.label} no longer applies to your address. Verdyn will keep watering efficiently (early morning, weather-aware) even without a mandate.`,
      from: prev.label, to: next.label,
    });
    return changes;
  }

  // Whole policy swapped out (e.g. moved utilities or AI re-resolved the county).
  if (prev.policyId !== next.policyId && prev.label !== next.label) {
    changes.push({
      kind: "policy_replaced",
      title: "Your local watering authority changed",
      message: `Your rules moved from "${prev.label}" to "${next.label}". Verdyn re-planned your zones against the new rule.`,
      from: prev.label, to: next.label,
    });
  }

  // Allowed days changed (the most common — utilities tighten in drought).
  const prevDays = daysFor(prev, parity);
  const nextDays = daysFor(next, parity);
  if (!sameDays(prevDays, nextDays)) {
    const tighter = nextDays.length > 0 && (prevDays.length === 0 || nextDays.length < prevDays.length);
    changes.push({
      kind: "days_changed",
      title: tighter ? "Fewer watering days allowed" : "Watering days updated",
      message: `Your area moved from watering ${describeDays(prevDays)} to ${describeDays(nextDays)}`
        + `${tighter ? " — a tighter restriction" : ""}. Verdyn redistributed your weekly water onto the allowed days.`,
      from: describeDays(prevDays), to: describeDays(nextDays),
    });
  }

  // Daytime ban window changed.
  if (describeHours(prev.banWindow) !== describeHours(next.banWindow)) {
    changes.push({
      kind: "hours_changed",
      title: "Watering hours updated",
      message: `The no-watering window changed from ${describeHours(prev.banWindow)} to ${describeHours(next.banWindow)}. Verdyn shifted your start times to stay legal.`,
      from: describeHours(prev.banWindow), to: describeHours(next.banWindow),
    });
  }

  // Establishment exemption length changed.
  if (prev.establishmentExemptDays !== next.establishmentExemptDays) {
    changes.push({
      kind: "establishment_changed",
      title: "New-landscaping exemption changed",
      message: `The new-sod/seed exemption changed from ${prev.establishmentExemptDays} to ${next.establishmentExemptDays} days. This affects how long new plantings may water daily.`,
      from: `${prev.establishmentExemptDays} days`, to: `${next.establishmentExemptDays} days`,
    });
  }

  return changes;
}

// ── Audit log ───────────────────────────────────────────────────

export type ComplianceLogKind = ComplianceChangeKind | "plan_run";

/** One timestamped, append-only compliance record for an address. */
export interface ComplianceLogEntry {
  id: string;
  /** ISO timestamp the entry was recorded. */
  at: string;
  /** Which property/address this concerns (Pro manages many). */
  addressLabel: string;
  kind: ComplianceLogKind;
  /** The active policy at the time. */
  policyId: string;
  policyLabel: string;
  /** Human-readable record of what happened. */
  summary: string;
  /** Where the rule came from, for evidentiary weight. */
  source?: "ai" | "builtin" | "cache" | "manual";
}

const entryId = () => "cl_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/** Build a log entry from a detected change. */
export function complianceEntryFromChange(
  addressLabel: string, next: RestrictionSnapshot, change: ComplianceChange,
  source?: ComplianceLogEntry["source"], at: string = new Date().toISOString(),
): ComplianceLogEntry {
  return {
    id: entryId(), at, addressLabel,
    kind: change.kind, policyId: next.policyId, policyLabel: next.label,
    summary: change.message, source,
  };
}

/** Build a "we watered within the rules on this date" record for the audit trail. */
export function complianceEntryForRun(
  addressLabel: string, snapshot: RestrictionSnapshot, dateISO: string,
  detail: string, source?: ComplianceLogEntry["source"],
): ComplianceLogEntry {
  return {
    id: entryId(), at: `${dateISO}T00:00:00.000Z`, addressLabel,
    kind: "plan_run", policyId: snapshot.policyId, policyLabel: snapshot.label,
    summary: detail, source,
  };
}

/** Convert a RestrictionPolicy or LocalRestriction to a comparable snapshot. */
export function toSnapshot(r: RestrictionPolicy | LocalRestriction): RestrictionSnapshot {
  return {
    policyId: "policyId" in r ? r.policyId : r.id,
    label: r.label,
    allowedWeekdaysOdd: r.allowedWeekdaysOdd,
    allowedWeekdaysEven: r.allowedWeekdaysEven,
    banWindow: r.banWindow,
    establishmentExemptDays: r.establishmentExemptDays,
  };
}
