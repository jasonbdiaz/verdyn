// Resolve the local watering restriction for a ZIP.
//
//   Weather tier            → built-in deterministic policy (free, instant).
//   Expert tier             → county cache → AI research → persist → fallback.
//
// AI research is Expert-only and ALWAYS degrades to the built-in policy on any
// failure (no key, bad JSON, timeout), so onboarding never blocks or errors.
import { builtinRestrictionForZip, isExpertTier, type LocalRestriction, type PlanTier } from "@verdyn/core";
import { placeForZip, type ZipPlace } from "./geo";
import { minimaxComplete, extractJson, minimaxConfigured, MINIMAX_MODEL } from "./minimax";
import { getCachedRestrictionByZip, persistRestriction } from "./restrictions-store";

const SYSTEM =
  "You are a U.S. landscape-irrigation compliance assistant. Given a ZIP code and " +
  "its city/state, identify the county and the OUTDOOR LAWN watering restrictions " +
  "that typically apply (assigned days by address parity, daytime watering bans, and " +
  "the new-sod/seed establishment exemption). Reply with ONLY a single JSON object, " +
  "no prose, no markdown. Weekdays use JS convention 0=Sunday..6=Saturday. " +
  "If a rule is unknown, use conservative efficiency defaults and set confidence to \"low\". " +
  'Schema: {"county":string,"fips":string|null,"label":string,' +
  '"allowedWeekdaysOdd":number[],"allowedWeekdaysEven":number[],' +
  '"banWindow":[number,number]|null,"establishmentExemptDays":number,' +
  '"summary":string,"confidence":"high"|"medium"|"low"}. ' +
  "summary is 1-3 plain-English sentences a homeowner can act on.";

type AiShape = {
  county?: unknown;
  fips?: unknown;
  label?: unknown;
  allowedWeekdaysOdd?: unknown;
  allowedWeekdaysEven?: unknown;
  banWindow?: unknown;
  establishmentExemptDays?: unknown;
  summary?: unknown;
  confidence?: unknown;
};

const cleanDays = (v: unknown): number[] =>
  Array.isArray(v)
    ? [...new Set(v.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))]
    : [];

function cleanBan(v: unknown): [number, number] | null {
  if (!Array.isArray(v) || v.length !== 2) return null;
  const a = Number(v[0]);
  const b = Number(v[1]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const s = Math.min(23, Math.max(0, Math.round(a)));
  const e = Math.min(24, Math.max(0, Math.round(b)));
  return e > s ? [s, e] : null;
}

function sanitizeAi(zip: string, place: ZipPlace | null, j: AiShape): LocalRestriction | null {
  const summary = typeof j.summary === "string" ? j.summary.trim().slice(0, 800) : "";
  if (!summary) return null; // a restriction with no human-readable summary is useless
  const confidence =
    j.confidence === "high" || j.confidence === "medium" || j.confidence === "low"
      ? j.confidence
      : "low";
  const exempt = Number(j.establishmentExemptDays);
  return {
    source: "ai",
    zip,
    city: place?.city,
    state: place?.state,
    county: typeof j.county === "string" ? j.county.trim().slice(0, 80) : undefined,
    fips: typeof j.fips === "string" && /^\d{4,5}$/.test(j.fips) ? j.fips : undefined,
    policyId: "ai",
    label: typeof j.label === "string" && j.label.trim() ? j.label.trim().slice(0, 80) : "Local rules",
    allowedWeekdaysOdd: cleanDays(j.allowedWeekdaysOdd),
    allowedWeekdaysEven: cleanDays(j.allowedWeekdaysEven),
    banWindow: cleanBan(j.banWindow),
    establishmentExemptDays: Number.isFinite(exempt) ? Math.min(365, Math.max(0, Math.round(exempt))) : 0,
    summary,
    confidence,
    needsVerification: true, // AI output is advisory until verified against the utility
  };
}

export interface ResolveResult {
  restriction: LocalRestriction;
  aiAttempted: boolean;
}

export async function resolveLocalRestriction(zip: string, tier: PlanTier): Promise<ResolveResult> {
  // Weather tier (or any non-expert) → deterministic baseline only.
  if (!isExpertTier(tier)) {
    return { restriction: builtinRestrictionForZip(zip), aiAttempted: false };
  }

  // 1. County cache — a prior Expert user in this county already paid for the AI call.
  const cached = await getCachedRestrictionByZip(zip);
  if (cached) return { restriction: cached, aiAttempted: false };

  // 2. AI research, anchored on a deterministic ZIP→city/state lookup.
  if (minimaxConfigured()) {
    const place = await placeForZip(zip);
    const anchor = place ? `${place.city}, ${place.state}` : "unknown city";
    const raw = await minimaxComplete(
      SYSTEM,
      `ZIP ${zip} (${anchor}). Return the JSON object for this location's lawn watering restrictions.`,
      // M3 is a reasoning model: its <think> block alone can run >1000 tokens.
      // Budget must cover reasoning + the JSON answer, or the response truncates
      // mid-thought (finish_reason "length") and never emits parseable JSON.
      { maxTokens: 3500 },
    );
    const parsed = raw ? extractJson<AiShape>(raw) : null;
    const ai = parsed ? sanitizeAi(zip, place, parsed) : null;
    if (ai) {
      await persistRestriction(zip, place, ai, MINIMAX_MODEL); // tag to county for RAG reuse
      return { restriction: ai, aiAttempted: true };
    }
    // AI failed → fall through to built-in.
    return { restriction: builtinRestrictionForZip(zip), aiAttempted: true };
  }

  // 3. No AI configured → built-in.
  return { restriction: builtinRestrictionForZip(zip), aiAttempted: false };
}
