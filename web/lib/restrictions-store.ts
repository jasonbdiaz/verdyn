// Read/write the county-keyed restriction corpus in Neon. Every function is a
// no-op (returns null) when the DB is disabled, so callers never branch on it.
import type { LocalRestriction } from "@verdyn/core";
import { db } from "./db";
import type { ZipPlace } from "./geo";

type DocRow = {
  source: string;
  policy_id: string | null;
  label: string;
  allowed_weekdays_odd: number[];
  allowed_weekdays_even: number[];
  ban_start: number | null;
  ban_end: number | null;
  establishment_exempt_days: number;
  summary: string;
  confidence: string | null;
  needs_verification: boolean;
  name: string;
  state: string;
  fips: string | null;
  city: string | null;
};

function rowToRestriction(zip: string, r: DocRow): LocalRestriction {
  return {
    source: "cache",
    zip,
    city: r.city ?? undefined,
    state: r.state,
    county: r.name,
    fips: r.fips ?? undefined,
    policyId: r.policy_id ?? "none",
    label: r.label,
    allowedWeekdaysOdd: r.allowed_weekdays_odd ?? [],
    allowedWeekdaysEven: r.allowed_weekdays_even ?? [],
    banWindow: r.ban_start != null && r.ban_end != null ? [r.ban_start, r.ban_end] : null,
    establishmentExemptDays: r.establishment_exempt_days ?? 0,
    summary: r.summary,
    confidence: (r.confidence as LocalRestriction["confidence"]) ?? undefined,
    needsVerification: r.needs_verification,
  };
}

/** Cache hit for a ZIP → latest restriction doc for its county. null if absent. */
export async function getCachedRestrictionByZip(zip: string): Promise<LocalRestriction | null> {
  const sql = db();
  if (!sql) return null;
  try {
    const rows = (await sql`
      SELECT d.source, d.policy_id, d.label, d.allowed_weekdays_odd, d.allowed_weekdays_even,
             d.ban_start, d.ban_end, d.establishment_exempt_days, d.summary, d.confidence,
             d.needs_verification, c.name, c.state, c.fips, z.city
      FROM zip_county z
      JOIN counties c ON c.id = z.county_id
      JOIN restriction_docs d ON d.county_id = c.id
      WHERE z.zip = ${zip}
      ORDER BY d.created_at DESC
      LIMIT 1
    `) as DocRow[];
    return rows[0] ? rowToRestriction(zip, rows[0]) : null;
  } catch (e) {
    console.warn("[verdyn] restriction cache read failed:", (e as Error).message);
    return null;
  }
}

/** Tag a resolved restriction to its county and cache the ZIP. Best-effort. */
export async function persistRestriction(
  zip: string,
  place: ZipPlace | null,
  r: LocalRestriction,
  model: string,
): Promise<void> {
  const sql = db();
  if (!sql) return;
  const county = r.county || place?.city || "Unknown";
  const state = r.state || place?.state || "";
  try {
    // Upsert county (prefer FIPS as the stable key, else name+state).
    const countyRows = (await sql`
      INSERT INTO counties (fips, name, state)
      VALUES (${r.fips ?? null}, ${county}, ${state})
      ON CONFLICT (name, state) DO UPDATE SET fips = COALESCE(counties.fips, EXCLUDED.fips)
      RETURNING id
    `) as { id: number }[];
    const countyId = countyRows[0].id;

    await sql`
      INSERT INTO zip_county (zip, county_id, city, state, resolved_by)
      VALUES (${zip}, ${countyId}, ${place?.city ?? null}, ${state}, ${r.source})
      ON CONFLICT (zip) DO UPDATE SET county_id = EXCLUDED.county_id, city = EXCLUDED.city
    `;

    const docRows = (await sql`
      INSERT INTO restriction_docs
        (county_id, source, policy_id, label, allowed_weekdays_odd, allowed_weekdays_even,
         ban_start, ban_end, establishment_exempt_days, summary, confidence, needs_verification, model)
      VALUES
        (${countyId}, ${r.source}, ${r.policyId}, ${r.label}, ${r.allowedWeekdaysOdd},
         ${r.allowedWeekdaysEven}, ${r.banWindow?.[0] ?? null}, ${r.banWindow?.[1] ?? null},
         ${r.establishmentExemptDays}, ${r.summary}, ${r.confidence ?? null},
         ${r.needsVerification ?? false}, ${model})
      RETURNING id
    `) as { id: number }[];

    // Store the summary as the first RAG chunk (embedding added later).
    await sql`
      INSERT INTO restriction_chunks (county_id, doc_id, chunk)
      VALUES (${countyId}, ${docRows[0].id}, ${r.summary})
    `;
  } catch (e) {
    console.warn("[verdyn] restriction persist failed:", (e as Error).message);
  }
}
