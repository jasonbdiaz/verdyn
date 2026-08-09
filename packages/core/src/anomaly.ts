// Verdyn anomaly detection — infers irrigation faults from runtime data alone,
// with no new hardware. B-hyve already reports, per zone, what we asked it to
// run and what actually ran (including aborts). That runtime signal is enough to
// catch the failures that quietly waste the most water and kill plants:
//
//   • no_run         — scheduled but nothing ran (dead valve, wiring, controller)
//   • stuck_valve    — ran far longer than scheduled (valve stuck open)
//   • leak_high_flow — flow well above this zone's norm (mainline/lateral leak)
//   • broken_head    — flow modestly high, or soil not wetting (broken/missing head)
//   • clog_low_flow  — flow well below norm (clogged nozzle/filter, half-shut valve)
//   • sensor_no_response — a sensor that used to report has gone silent
//
// Flow and soil-moisture fields are OPTIONAL: when a B-hyve flow meter or soil
// sensor is present we use it for sharper detection; when it isn't, the
// runtime-vs-scheduled signal still catches dead and stuck valves.

import type { ZoneProfile } from "./types";

export interface ZoneRuntimeSample {
  zoneId: string;
  /** Run date, "YYYY-MM-DD". */
  dateISO: string;
  /** Minutes Verdyn asked the controller to run. */
  scheduledMin: number;
  /** Minutes the controller reported actually running. */
  actualMin: number;
  /** Controller flagged the run aborted/faulted. */
  aborted?: boolean;
  /** Average flow during the run (gal/min), if a flow meter exists. */
  flowGpm?: number | null;
  /** Soil moisture reading after the run (%), if a soil sensor exists. */
  soilMoisturePct?: number | null;
}

export interface RuntimeBaseline {
  zoneId: string;
  /** Median flow over the baseline window (gal/min), if flow was reported. */
  typicalFlowGpm?: number;
  /** Median actual runtime over the baseline window (min). */
  typicalMinutes?: number;
  /** How many historical samples informed this baseline. */
  samples: number;
}

export type AnomalyKind =
  | "no_run" | "leak_high_flow" | "broken_head" | "clog_low_flow"
  | "stuck_valve" | "sensor_no_response";

export type AnomalySeverity = "info" | "warning" | "critical";

export interface Anomaly {
  zoneId: string;
  zoneName: string;
  kind: AnomalyKind;
  severity: AnomalySeverity;
  /** What was observed. */
  detail: string;
  /** What the owner should do about it. */
  recommendation: string;
  /** Date of the run that triggered the alert. */
  observedAt: string;
  confidence: "high" | "medium" | "low";
}

// ── tunables ────────────────────────────────────────────────────
const MIN_BASELINE_SAMPLES = 3;
const LEAK_FLOW_X = 1.30;   // ≥130% of typical → likely leak
const HEAD_FLOW_X = 1.15;   // ≥115% (and <130%) → likely broken/missing head
const CLOG_FLOW_X = 0.65;   // ≤65% of typical → likely clog / half-shut valve
const OVERRUN_X = 1.5;      // ran ≥150% of scheduled → stuck valve
const OVERRUN_MIN = 5;      // …and at least 5 extra minutes (ignore rounding)
const DRY_AFTER_WATER_PCT = 18; // soil this low right after a real run → not reaching soil

const median = (xs: number[]): number => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Build a per-zone baseline from history (everything before the latest run). */
export function buildBaselines(samples: ZoneRuntimeSample[]): Record<string, RuntimeBaseline> {
  const byZone: Record<string, ZoneRuntimeSample[]> = {};
  for (const s of samples) (byZone[s.zoneId] ??= []).push(s);

  const out: Record<string, RuntimeBaseline> = {};
  for (const [zoneId, list] of Object.entries(byZone)) {
    const ran = list.filter((s) => s.actualMin > 0);
    const flows = ran.map((s) => s.flowGpm).filter((f): f is number => typeof f === "number" && f > 0);
    const mins = ran.map((s) => s.actualMin);
    out[zoneId] = {
      zoneId,
      typicalFlowGpm: flows.length >= MIN_BASELINE_SAMPLES ? median(flows) : undefined,
      typicalMinutes: mins.length ? median(mins) : undefined,
      samples: ran.length,
    };
  }
  return out;
}

const sortByDate = (a: ZoneRuntimeSample, b: ZoneRuntimeSample) => a.dateISO.localeCompare(b.dateISO);

/**
 * Detect faults from runtime history. Returns at most one anomaly per zone
 * (the most severe), based on each zone's most recent run versus a baseline
 * built from its prior runs.
 */
export function detectAnomalies(
  zones: ZoneProfile[], samples: ZoneRuntimeSample[],
): Anomaly[] {
  const nameOf = (id: string) => zones.find((z) => z.id === id)?.name ?? id;
  const byZone: Record<string, ZoneRuntimeSample[]> = {};
  for (const s of samples) (byZone[s.zoneId] ??= []).push(s);

  const anomalies: Anomaly[] = [];

  for (const [zoneId, listRaw] of Object.entries(byZone)) {
    const list = [...listRaw].sort(sortByDate);
    const latest = list[list.length - 1];
    if (!latest) continue;
    const history = list.slice(0, -1);
    const base = buildBaselines(history)[zoneId];
    const found: Anomaly[] = [];
    const zoneName = nameOf(zoneId);
    const mk = (
      kind: AnomalyKind, severity: AnomalySeverity, confidence: Anomaly["confidence"],
      detail: string, recommendation: string,
    ): Anomaly => ({ zoneId, zoneName, kind, severity, confidence, detail, recommendation, observedAt: latest.dateISO });

    // 1) No run — scheduled but nothing happened (no flow sensor needed).
    if (latest.scheduledMin > 0 && (latest.actualMin <= 0 || latest.aborted)) {
      found.push(mk("no_run", "critical", latest.aborted ? "high" : "medium",
        `Scheduled ${latest.scheduledMin} min but recorded ${latest.actualMin} min${latest.aborted ? " (controller reported an abort)" : ""}.`,
        "Check the valve solenoid, controller wiring, and water supply to this zone — plants here are getting nothing."));
    }

    // 2) Stuck valve — ran far past schedule (no flow sensor needed).
    if (latest.scheduledMin > 0 && latest.actualMin >= latest.scheduledMin * OVERRUN_X
        && latest.actualMin - latest.scheduledMin >= OVERRUN_MIN) {
      found.push(mk("stuck_valve", "critical", "high",
        `Ran ${latest.actualMin} min against a ${latest.scheduledMin} min schedule — the valve may be stuck open.`,
        "Shut this zone off at the controller and inspect the valve; a stuck-open valve can waste thousands of gallons."));
    }

    // 3–5) Flow-based detection (needs a flow meter + a baseline).
    if (typeof latest.flowGpm === "number" && latest.actualMin > 0 && base?.typicalFlowGpm) {
      const ratio = latest.flowGpm / base.typicalFlowGpm;
      if (ratio >= LEAK_FLOW_X) {
        found.push(mk("leak_high_flow", "critical", "high",
          `Flow ${latest.flowGpm.toFixed(1)} gpm is ${Math.round((ratio - 1) * 100)}% above this zone's norm (${base.typicalFlowGpm.toFixed(1)} gpm).`,
          "Likely a broken lateral or mainline leak. Inspect for pooling/wet spots and shut off if water is running freely."));
      } else if (ratio >= HEAD_FLOW_X) {
        found.push(mk("broken_head", "warning", "medium",
          `Flow ${latest.flowGpm.toFixed(1)} gpm is ${Math.round((ratio - 1) * 100)}% above normal — consistent with a broken or missing head.`,
          "Walk the zone while it runs; look for a geyser, a snapped riser, or a missing nozzle and cap/replace it."));
      } else if (ratio <= CLOG_FLOW_X) {
        found.push(mk("clog_low_flow", "warning", "medium",
          `Flow ${latest.flowGpm.toFixed(1)} gpm is ${Math.round((1 - ratio) * 100)}% below normal — consistent with a clog or partially closed valve.`,
          "Check the zone filter/nozzles for debris and confirm the isolation valve is fully open."));
      }
    }

    // 6) Soil sensor says water isn't reaching the ground despite a real run.
    if (typeof latest.soilMoisturePct === "number" && latest.actualMin > 0
        && latest.soilMoisturePct <= DRY_AFTER_WATER_PCT
        && !found.some((a) => a.kind === "broken_head")) {
      found.push(mk("broken_head", "warning", "low",
        `Soil read ${latest.soilMoisturePct}% right after a ${latest.actualMin} min run — water may not be reaching the root zone.`,
        "Check for blocked, misaimed, or broken heads in this zone; the controller ran but the soil stayed dry."));
    }

    // 7) A sensor that used to report has gone silent.
    const hadFlow = history.some((s) => typeof s.flowGpm === "number");
    const hadSoil = history.some((s) => typeof s.soilMoisturePct === "number");
    if ((hadFlow && latest.flowGpm == null) || (hadSoil && latest.soilMoisturePct == null)) {
      found.push(mk("sensor_no_response", "info", "low",
        "A sensor that previously reported on this zone returned no reading on the latest run.",
        "Check the sensor's battery and connectivity in the B-hyve app; detection falls back to runtime data until it's back."));
    }

    // Surface the single most severe finding per zone.
    const rank: Record<AnomalySeverity, number> = { critical: 3, warning: 2, info: 1 };
    found.sort((a, b) => rank[b.severity] - rank[a.severity]);
    if (found[0]) anomalies.push(found[0]);
  }

  // Most severe zones first.
  const rank: Record<AnomalySeverity, number> = { critical: 3, warning: 2, info: 1 };
  return anomalies.sort((a, b) => rank[b.severity] - rank[a.severity]);
}
