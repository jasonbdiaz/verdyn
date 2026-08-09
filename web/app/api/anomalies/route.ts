import { NextResponse } from "next/server";
import { detectAnomalies, entitlementActive, type ZoneRuntimeSample, type ZoneProfile } from "@verdyn/core";
import { readJson, validateProfile } from "@/lib/validate";
import { currentAccountId, currentEntitlement } from "@/lib/account";

export const runtime = "nodejs";

// Runtime anomaly detection (F2). Infers broken heads, leaks, and stuck/dead
// valves from B-hyve runtime data — no new hardware. The controller's
// scheduled-vs-actual runtime (and optional flow/soil sensors) is posted here as
// samples; the engine flags faults per zone. Until a history-ingest pipeline
// feeds it live, the dashboard posts what it has and shows a monitoring state.
export async function POST(req: Request) {
  const accountId = await currentAccountId();
  if (!accountId) {
    return NextResponse.json({ error: "Sign in to view system health.", code: "auth" }, { status: 401 });
  }
  const ent = await currentEntitlement();
  if (!entitlementActive(ent)) {
    return NextResponse.json({ error: "Your free trial has ended.", code: "upgrade" }, { status: 402 });
  }

  const { data, error } = await readJson<{ profile?: unknown; samples?: ZoneRuntimeSample[] }>(req);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const v = validateProfile(data?.profile);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const zones: ZoneProfile[] = v.profile.zones;
  const samples = Array.isArray(data?.samples) ? data!.samples! : [];

  const anomalies = detectAnomalies(zones, samples);
  return NextResponse.json({
    anomalies,
    monitoredZones: zones.length,
    samplesSeen: samples.length,
    // No samples yet means we have nothing to analyze — distinct from "healthy".
    state: samples.length === 0 ? "monitoring" : anomalies.length === 0 ? "healthy" : "issues",
  });
}
