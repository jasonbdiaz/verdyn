// Regional watering-restriction policies. These encode the day-of-week and
// time-of-day rules many U.S. utilities enforce, plus the new-landscaping
// (establishment) exemption that almost universally lets new sod/seed water
// daily for a fixed window regardless of the standing restriction.
//
// Weekdays: JS convention 0=Sun .. 6=Sat.

import type { RestrictionPolicy, LocalRestriction } from "./types";

export const RESTRICTION_POLICIES: Record<string, RestrictionPolicy> = {
  // No municipal restriction — engine still avoids midday for efficiency.
  none: {
    id: "none", label: "No local restriction", region: "Default",
    allowedWeekdaysOdd: [], allowedWeekdaysEven: [], banWindow: null,
    establishmentExemptDays: 0,
    note: "No mandated days. Verdyn still waters early morning to limit evaporation and disease.",
  },

  // South Florida (SFWMD / Miami-Dade) — odd/even address, 2 days/week,
  // no watering 10am–4pm year-round. New landscaping exempt for 90 days.
  sfwmd: {
    id: "sfwmd", label: "South Florida (SFWMD)", region: "FL",
    allowedWeekdaysOdd: [3, 6],  // Wed & Sat for odd addresses
    allowedWeekdaysEven: [4, 0], // Thu & Sun for even addresses
    banWindow: [10, 16],
    establishmentExemptDays: 90,
    note: "2 days/week by address parity; no watering 10am–4pm. New sod/seed exempt 90 days.",
  },

  // Generic Southwest / drought-state style: 2 assigned days, no daytime.
  southwest_2day: {
    id: "southwest_2day", label: "Southwest 2-day", region: "AZ/NV/CA",
    allowedWeekdaysOdd: [2, 6],  // Tue & Sat
    allowedWeekdaysEven: [1, 5], // Mon & Fri
    banWindow: [10, 18],
    establishmentExemptDays: 30,
    note: "2 assigned days; no watering 10am–6pm. Establishment exempt 30 days.",
  },

  // Texas / many municipalities: once or twice weekly, no 10–6.
  texas_2day: {
    id: "texas_2day", label: "Texas 2-day", region: "TX",
    allowedWeekdaysOdd: [3, 6],
    allowedWeekdaysEven: [4, 0],
    banWindow: [10, 18],
    establishmentExemptDays: 30,
    note: "Twice weekly by parity; no watering 10am–6pm.",
  },

  // Efficiency-only: any day, but never midday (used when local rule unknown).
  efficiency: {
    id: "efficiency", label: "Efficiency (no mandate)", region: "Default",
    allowedWeekdaysOdd: [], allowedWeekdaysEven: [], banWindow: [10, 18],
    establishmentExemptDays: 0,
    note: "Water any day, but avoid 10am–6pm to cut evaporation losses.",
  },
};

// Coarse ZIP → default policy. Production would key off a city/utility lookup.
export function policyForZip(zip: string): RestrictionPolicy {
  const z = (zip || "").trim();
  const p3 = z.slice(0, 3);
  // South Florida ZIP prefixes 330–334, 339, 341 (Miami-Dade/Broward/SWFL).
  if (["330","331","332","333","334","339","341"].includes(p3)) return RESTRICTION_POLICIES.sfwmd;
  const d0 = z[0] ?? "";
  if (d0 === "8") return RESTRICTION_POLICIES.southwest_2day; // desert SW
  if (["75","76","77","78","79"].includes(z.slice(0,2))) return RESTRICTION_POLICIES.texas_2day;
  return RESTRICTION_POLICIES.efficiency;
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayList = (d: number[]) => (d.length ? d.map((n) => DOW[n]).join(" & ") : "any day");

/** Turn a built-in policy into the shared LocalRestriction shape — the free,
 *  deterministic baseline used for the Weather tier and as the fallback whenever
 *  AI research is unavailable. */
export function builtinRestrictionForZip(zip: string): LocalRestriction {
  const p = policyForZip(zip);
  const ban = p.banWindow
    ? `No watering ${p.banWindow[0]}:00–${p.banWindow[1]}:00.`
    : "No daytime ban.";
  const days =
    p.allowedWeekdaysOdd.length || p.allowedWeekdaysEven.length
      ? `Odd addresses: ${dayList(p.allowedWeekdaysOdd)}. Even addresses: ${dayList(p.allowedWeekdaysEven)}.`
      : "No assigned watering days.";
  return {
    source: "builtin",
    zip,
    policyId: p.id,
    label: p.label,
    allowedWeekdaysOdd: p.allowedWeekdaysOdd,
    allowedWeekdaysEven: p.allowedWeekdaysEven,
    banWindow: p.banWindow,
    establishmentExemptDays: p.establishmentExemptDays,
    summary: `${p.label} (${p.region}). ${days} ${ban} New sod/seed exempt ${p.establishmentExemptDays} days.`,
    confidence: "medium",
    needsVerification: false,
  };
}

/** Adapt a resolved LocalRestriction (built-in OR AI-researched) into the
 *  RestrictionPolicy shape the scheduling engine consumes — so AI-discovered
 *  county rules drive watering days/hours just like the built-in table. */
export function localRestrictionToPolicy(lr: LocalRestriction): RestrictionPolicy {
  return {
    id: lr.policyId || "local",
    label: lr.label,
    region: lr.state || "Local",
    allowedWeekdaysOdd: lr.allowedWeekdaysOdd ?? [],
    allowedWeekdaysEven: lr.allowedWeekdaysEven ?? [],
    banWindow: lr.banWindow ?? null,
    establishmentExemptDays: lr.establishmentExemptDays ?? 0,
    note: lr.summary,
  };
}

/** Is this date within the establishment-exempt window for the policy? */
export function isEstablishmentExempt(
  policy: RestrictionPolicy,
  establishmentStart: string | null,
  dateISO: string,
): boolean {
  if (!establishmentStart || policy.establishmentExemptDays <= 0) return false;
  const days = Math.round(
    (Date.parse(dateISO + "T00:00:00Z") - Date.parse(establishmentStart + "T00:00:00Z")) / 86400000,
  );
  return days >= 0 && days < policy.establishmentExemptDays;
}
