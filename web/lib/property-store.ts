// Property persistence for Pro (business) accounts. Each property is one managed
// address with a full LawnProfile in JSONB. Degrades to empty/no-op without a DB.
import type { Property, LawnProfile } from "@verdyn/core";
import { db } from "./db";

type PropRow = {
  id: string;
  label: string;
  address: string | null;
  zip: string | null;
  profile: LawnProfile;
  created_at: string | Date;
};

function rowToProperty(r: PropRow): Property {
  return {
    id: r.id,
    label: r.label,
    address: r.address ?? undefined,
    profile: r.profile,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  };
}

export async function listProperties(accountId: string): Promise<Property[]> {
  const sql = db();
  if (!sql) return [];
  try {
    const rows = (await sql`
      SELECT id, label, address, zip, profile, created_at
      FROM properties WHERE account_id = ${accountId}
      ORDER BY created_at ASC
    `) as PropRow[];
    return rows.map(rowToProperty);
  } catch (err) {
    console.warn("[verdyn] listProperties failed:", (err as Error).message);
    return [];
  }
}

export async function countProperties(accountId: string): Promise<number> {
  const sql = db();
  if (!sql) return 0;
  try {
    const rows = (await sql`SELECT count(*)::int AS n FROM properties WHERE account_id = ${accountId}`) as {
      n: number;
    }[];
    return rows[0]?.n ?? 0;
  } catch {
    return 0;
  }
}

export interface NewProperty {
  label: string;
  address?: string;
  zip: string;
  profile: LawnProfile;
}

/** Distinguishes a hard DB/no-op failure (null) from a cap rejection. */
export type CreateResult =
  | { ok: true; property: Property }
  | { ok: false; reason: "limit" | "error" };

/**
 * Insert a property, enforcing `limit` ATOMICALLY in the same statement so two
 * concurrent requests can't both slip past a count-then-insert check (TOCTOU).
 * The INSERT…SELECT only materializes a row while the account is under cap.
 */
export async function createProperty(
  accountId: string,
  p: NewProperty,
  limit: number,
): Promise<CreateResult> {
  const sql = db();
  if (!sql) return { ok: false, reason: "error" };
  try {
    const rows = (await sql`
      INSERT INTO properties (account_id, label, address, zip, profile)
      SELECT ${accountId}, ${p.label}, ${p.address ?? null}, ${p.zip},
             ${JSON.stringify(p.profile)}::jsonb
      WHERE (SELECT count(*) FROM properties WHERE account_id = ${accountId}) < ${limit}
      RETURNING id, label, address, zip, profile, created_at
    `) as PropRow[];
    if (!rows[0]) return { ok: false, reason: "limit" };
    return { ok: true, property: rowToProperty(rows[0]) };
  } catch (err) {
    console.warn("[verdyn] createProperty failed:", (err as Error).message);
    return { ok: false, reason: "error" };
  }
}

/** Delete a property — scoped to the owning account so one account can't delete another's. */
export async function deleteProperty(accountId: string, propertyId: string): Promise<boolean> {
  const sql = db();
  if (!sql) return false;
  try {
    const rows = (await sql`
      DELETE FROM properties WHERE id = ${propertyId} AND account_id = ${accountId} RETURNING id
    `) as { id: string }[];
    return rows.length > 0;
  } catch (err) {
    console.warn("[verdyn] deleteProperty failed:", (err as Error).message);
    return false;
  }
}
