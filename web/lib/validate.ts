// Server-side input validation. Never trust the client — every API route runs
// untrusted JSON through these guards before touching the engine or Orbit.

import {
  SOIL_TYPES, HEAD_TYPES, GRASS_TYPES, PLANT_TYPES, type LawnProfile,
} from "@verdyn/core";

// Reject oversized bodies before parsing (cheap DoS guard).
export const MAX_BODY_BYTES = 64 * 1024;

export async function readJson<T>(req: Request): Promise<{ data?: T; error?: string }> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BODY_BYTES) return { error: "Request body too large." };
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return { error: "Request body too large." };
  try {
    return { data: JSON.parse(text) as T };
  } catch {
    return { error: "Invalid JSON body." };
  }
}

const ZIP_RE = /^\d{5}$/;
// Pragmatic email shape check — real validation is Orbit accepting the login.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isZip = (s: unknown): s is string => typeof s === "string" && ZIP_RE.test(s);
export const isEmail = (s: unknown): s is string =>
  typeof s === "string" && s.length <= 254 && EMAIL_RE.test(s);

const SOIL_IDS = new Set(SOIL_TYPES.map((s) => s.id));
const HEAD_IDS = new Set(HEAD_TYPES.map((h) => h.id));
const GRASS_IDS = new Set(GRASS_TYPES.map((g) => g.id));
const PLANT_IDS = new Set(PLANT_TYPES.map((p) => p.id));

/** Validate an onboarding-produced profile before running the engine. */
export function validateProfile(p: unknown): { ok: true; profile: LawnProfile } | { ok: false; error: string } {
  if (!p || typeof p !== "object") return { ok: false, error: "Missing profile." };
  const o = p as Record<string, unknown>;

  if (!isZip(o.zip)) return { ok: false, error: "A valid 5-digit ZIP is required." };
  if (o.soilTextureId !== undefined && !SOIL_IDS.has(o.soilTextureId as never))
    return { ok: false, error: "Unknown soil type." };
  if (o.addressParity !== "odd" && o.addressParity !== "even")
    return { ok: false, error: "Invalid address parity." };
  if (o.establishmentStart !== null && typeof o.establishmentStart !== "string")
    return { ok: false, error: "Invalid establishment date." };

  if (!Array.isArray(o.zones) || o.zones.length === 0)
    return { ok: false, error: "At least one zone is required." };
  if (o.zones.length > 64) return { ok: false, error: "Too many zones." };

  for (const z of o.zones as Record<string, unknown>[]) {
    if (!z || typeof z !== "object") return { ok: false, error: "Malformed zone." };
    if (!GRASS_IDS.has(z.grassTypeId as never)) return { ok: false, error: "Unknown grass type." };
    if (!HEAD_IDS.has(z.headTypeId as never)) return { ok: false, error: "Unknown sprinkler type." };
    if (z.plantTypeId !== undefined && !PLANT_IDS.has(z.plantTypeId as never))
      return { ok: false, error: "Unknown plant type." };
    if (z.establishmentStart !== undefined && z.establishmentStart !== null && typeof z.establishmentStart !== "string")
      return { ok: false, error: "Invalid zone establishment date." };
    if (z.areaSqft !== undefined) {
      const v = z.areaSqft;
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1_000_000)
        return { ok: false, error: "Invalid zone area." };
    }
    if (z.headCount !== undefined) {
      const v = z.headCount;
      if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 200)
        return { ok: false, error: "Invalid head count." };
    }
    if (z.measuredPrecipInHr !== undefined) {
      const v = z.measuredPrecipInHr;
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 10)
        return { ok: false, error: "Invalid precipitation rate." };
    }
  }
  return { ok: true, profile: p as LawnProfile };
}
