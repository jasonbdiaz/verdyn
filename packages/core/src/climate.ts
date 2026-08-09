// Climate zones + monthly reference ET (ETo, inches/day). Used to estimate
// water demand when no live ET feed is available. Mapping ZIP → zone is a
// coarse first-digit heuristic for v1; a production build would use a ZIP
// centroid + gridded ETo dataset. Values are representative regional ETo peaks.

export interface ClimateZone {
  id: string;
  label: string;
  /** Reference ET in inches/day for months Jan(0)..Dec(11). */
  etByMonth: number[];
  /** Whether warm-season turf is the regional default. */
  warmSeasonDefault: boolean;
}

export const CLIMATE_ZONES: Record<string, ClimateZone> = {
  humid_subtropical: {
    id: "humid_subtropical", label: "Humid subtropical (Gulf / FL)",
    etByMonth: [0.09, 0.11, 0.15, 0.18, 0.21, 0.22, 0.22, 0.21, 0.18, 0.15, 0.11, 0.09],
    warmSeasonDefault: true,
  },
  humid_temperate: {
    id: "humid_temperate", label: "Humid temperate (Southeast / Mid-Atlantic)",
    etByMonth: [0.05, 0.07, 0.11, 0.15, 0.19, 0.21, 0.22, 0.20, 0.16, 0.11, 0.07, 0.05],
    warmSeasonDefault: true,
  },
  continental: {
    id: "continental", label: "Continental (Midwest / Northeast)",
    etByMonth: [0.03, 0.04, 0.08, 0.13, 0.18, 0.21, 0.22, 0.19, 0.14, 0.09, 0.05, 0.03],
    warmSeasonDefault: false,
  },
  semiarid: {
    id: "semiarid", label: "Semi-arid (Plains / Mountain West)",
    etByMonth: [0.05, 0.07, 0.12, 0.17, 0.23, 0.28, 0.30, 0.27, 0.20, 0.13, 0.07, 0.05],
    warmSeasonDefault: false,
  },
  arid_hot: {
    id: "arid_hot", label: "Arid hot (Desert Southwest)",
    etByMonth: [0.10, 0.14, 0.20, 0.27, 0.33, 0.36, 0.34, 0.31, 0.27, 0.20, 0.13, 0.09],
    warmSeasonDefault: true,
  },
  mediterranean: {
    id: "mediterranean", label: "Mediterranean (Coastal California)",
    etByMonth: [0.06, 0.08, 0.12, 0.16, 0.20, 0.23, 0.25, 0.23, 0.19, 0.14, 0.08, 0.06],
    warmSeasonDefault: true,
  },
  marine: {
    id: "marine", label: "Marine west coast (Pacific NW)",
    etByMonth: [0.03, 0.04, 0.07, 0.11, 0.14, 0.16, 0.18, 0.16, 0.12, 0.07, 0.04, 0.03],
    warmSeasonDefault: false,
  },
};

// ZIP first-digit → climate zone (coarse). Coastal CA vs desert is refined by
// the 90–96 (CA) vs 85/89 (AZ/NV) second digit below.
const FIRST_DIGIT_ZONE: Record<string, string> = {
  "0": "continental", "1": "continental", "2": "humid_temperate",
  "3": "humid_subtropical", "4": "continental", "5": "continental",
  "6": "semiarid", "7": "humid_subtropical", "8": "arid_hot", "9": "mediterranean",
};

export function climateZoneForZip(zip: string): ClimateZone {
  const z = (zip || "").trim();
  const d0 = z[0] ?? "3";
  let id = FIRST_DIGIT_ZONE[d0] ?? "humid_temperate";

  // Refinements where the first digit is ambiguous.
  const p2 = z.slice(0, 2);
  if (["85", "86", "89"].includes(p2)) id = "arid_hot";        // AZ / NV
  else if (["80", "81", "82", "83", "84", "87", "88"].includes(p2)) id = "semiarid"; // CO/WY/ID/UT/NM
  else if (["98", "99", "97"].includes(p2)) id = "marine";     // WA / OR / AK
  else if (["77", "78", "79", "75", "76"].includes(p2)) id = "humid_subtropical"; // TX
  else if (["73", "74"].includes(p2)) id = "semiarid";          // OK
  else if (z[0] === "9" && ["90","91","92","93","94","95","96"].includes(p2)) id = "mediterranean";

  return CLIMATE_ZONES[id];
}

/** Reference ET (in/day) for a ZIP in a given month (0-indexed). */
export function etForZipMonth(zip: string, month: number): number {
  const zone = climateZoneForZip(zip);
  return zone.etByMonth[Math.max(0, Math.min(11, month))];
}
