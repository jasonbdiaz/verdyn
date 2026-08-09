// Named irrigation programs — the watering "recipe" each zone runs.
//
// The engine already tailors water volume, cadence, and cycle-and-soak to what
// grows in a zone; this module names that behavior so the app and marketing can
// show it. A drip bed, a half-acre rotor lawn, an annual flower bed, and a tree
// line are deliberately watered differently. Pure module — no node deps.

import type { LawnProfile, Phase, WaterProgramId, WaterProgramRef, ZoneProfile } from "./types";
import { plantById, headById } from "./agronomy";

/** Zones at/above this area, or driven by long-throw heads, run the large-zone
 *  program (more, longer cycle passes so a big deep soak fully lands). */
export const LARGE_ZONE_SQFT = 5000;
const LARGE_HEADS = new Set(["rotor", "impact"]);

export const WATER_PROGRAMS: Record<WaterProgramId, WaterProgramRef> = {
  turf_cycle_soak: {
    id: "turf_cycle_soak", name: "Deep cycle-and-soak", style: "cycle_soak",
    blurb: "Deep, infrequent soaks split into runoff-proof passes — trains turf roots to grow down.",
  },
  turf_establish: {
    id: "turf_establish", name: "New-lawn establishment", style: "light_frequent",
    blurb: "Light, frequent soaks that keep new sod or seed moist while roots take hold.",
  },
  large_rotor: {
    id: "large_rotor", name: "Large-zone rotor program", style: "cycle_soak",
    blurb: "Big zones on rotors/impacts — extra cycle passes so a deep soak fully lands without runoff.",
  },
  drip_soak: {
    id: "drip_soak", name: "Drip deep-soak", style: "single_soak",
    blurb: "One slow, deep soak through drip — wets the root ball with near-zero evaporation or overspray.",
  },
  bed_frequent: {
    id: "bed_frequent", name: "Bed micro-watering", style: "light_frequent",
    blurb: "Shallow, steady moisture for annual color, veg, and groundcover that root in the top few inches.",
  },
  tree_deep_slow: {
    id: "tree_deep_slow", name: "Tree dripline soak", style: "single_soak",
    blurb: "Long, slow soaks at the dripline that reach deep tree roots, then back off as they establish.",
  },
  xeric_minimal: {
    id: "xeric_minimal", name: "Xeric minimal", style: "single_soak",
    blurb: "Minimal supplemental water for drought-adapted natives — only what the weather can't supply.",
  },
};

/** Is this a large / long-throw zone that should run the large-rotor program? */
export function isLargeZone(zone: ZoneProfile): boolean {
  if (typeof zone.areaSqft === "number" && zone.areaSqft >= LARGE_ZONE_SQFT) return true;
  return LARGE_HEADS.has(zone.headTypeId);
}

/** Choose the named program for a zone, given its current establishment phase. */
export function waterProgramFor(
  _profile: LawnProfile, zone: ZoneProfile, phase: Phase,
): WaterProgramRef {
  const plant = plantById(zone.plantTypeId);

  if (plant.usesGrass) {
    if (phase === "establishment") return WATER_PROGRAMS.turf_establish;
    if (isLargeZone(zone)) return WATER_PROGRAMS.large_rotor;
    return WATER_PROGRAMS.turf_cycle_soak;
  }

  switch (plant.id) {
    case "trees": return WATER_PROGRAMS.tree_deep_slow;
    case "native": return WATER_PROGRAMS.xeric_minimal;
    case "shrubs": return WATER_PROGRAMS.drip_soak;
    default: return WATER_PROGRAMS.bed_frequent; // flower_bed, veg_garden, groundcover
  }
}
