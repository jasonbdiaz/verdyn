// Server-persisted lawn profile for a homeowner (single-lawn) account, so the
// unattended cron can build today's plan without the browser. Pro accounts use
// `properties` instead. Degrades to no-op / null without DATABASE_URL.
import type { LawnProfile } from "@verdyn/core";
import { db } from "./db";

export interface HomeProfile {
  profile: LawnProfile;
  timezone: string | null;
}

/** Upsert the account's profile (and IANA timezone, when the client sends one).
 *  Timezone is preserved if a later save omits it. */
export async function saveHomeProfile(
  accountId: string,
  profile: LawnProfile,
  timezone?: string | null,
): Promise<void> {
  const sql = db();
  if (!sql) return;
  const tz = typeof timezone === "string" && timezone.length > 0 && timezone.length < 64 ? timezone : null;
  try {
    await sql`
      INSERT INTO home_profiles (account_id, profile, timezone, updated_at)
      VALUES (${accountId}, ${JSON.stringify(profile)}, ${tz}, now())
      ON CONFLICT (account_id) DO UPDATE SET
        profile = EXCLUDED.profile,
        timezone = COALESCE(EXCLUDED.timezone, home_profiles.timezone),
        updated_at = now()
    `;
  } catch (err) {
    console.warn("[verdyn] saveHomeProfile failed:", (err as Error).message);
  }
}

export async function getHomeProfile(accountId: string): Promise<HomeProfile | null> {
  const sql = db();
  if (!sql) return null;
  try {
    const rows = (await sql`
      SELECT profile, timezone FROM home_profiles WHERE account_id = ${accountId}
    `) as { profile: LawnProfile; timezone: string | null }[];
    if (!rows[0]) return null;
    return { profile: rows[0].profile, timezone: rows[0].timezone ?? null };
  } catch (err) {
    console.warn("[verdyn] getHomeProfile failed:", (err as Error).message);
    return null;
  }
}

/** Remove the account's saved lawn profile so onboarding starts clean. No-op
 *  without a DB; safe to call even when no profile exists. */
export async function deleteHomeProfile(accountId: string): Promise<void> {
  const sql = db();
  if (!sql) return;
  try {
    await sql`DELETE FROM home_profiles WHERE account_id = ${accountId}`;
  } catch (err) {
    console.warn("[verdyn] deleteHomeProfile failed:", (err as Error).message);
  }
}
