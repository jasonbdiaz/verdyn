// Per-account B-hyve controller link, persisted so an unattended cron can
// authenticate to Orbit without a browser cookie.
//
// SECURITY: only the AES-256-GCM-sealed session token is stored — never the raw
// password (we cannot, and deliberately do not, re-login on our own). When Orbit
// rejects the token (401) the link flips to 'reauth_needed' and the user must
// reconnect. Sealing reuses lib/session.ts so the DB row is useless without
// VERDYN_SESSION_SECRET. Degrades to no-op without DATABASE_URL.
import type { BhyveSession } from "@verdyn/core";
import { db } from "./db";
import { sealObject, unsealObject } from "./session";

export interface BhyveLink {
  accountId: string;
  session: BhyveSession;
  status: "linked" | "reauth_needed";
  autoRun: boolean;
}

interface SealedToken {
  token: string;
  userId: string;
}

/** Persist (or refresh) the sealed token for an account. Status resets to
 *  'linked' because a fresh login means the controller is reachable again. */
export async function saveBhyveLink(accountId: string, session: BhyveSession): Promise<void> {
  const sql = db();
  if (!sql) return;
  const sealed = sealObject({ token: session.token, userId: session.userId } as SealedToken);
  try {
    await sql`
      INSERT INTO bhyve_links (account_id, sealed_token, status, last_ok_at, updated_at)
      VALUES (${accountId}, ${sealed}, 'linked', now(), now())
      ON CONFLICT (account_id) DO UPDATE SET
        sealed_token = EXCLUDED.sealed_token,
        status = 'linked',
        last_ok_at = now(),
        last_error = NULL,
        updated_at = now()
    `;
  } catch (err) {
    console.warn("[verdyn] saveBhyveLink failed:", (err as Error).message);
  }
}

function rowToLink(r: {
  account_id: string; sealed_token: string; status: string; auto_run: boolean;
}): BhyveLink | null {
  const s = unsealObject<Partial<SealedToken>>(r.sealed_token);
  if (!s || typeof s.token !== "string" || typeof s.userId !== "string") return null;
  return {
    accountId: r.account_id,
    session: { token: s.token, userId: s.userId },
    status: r.status === "reauth_needed" ? "reauth_needed" : "linked",
    autoRun: Boolean(r.auto_run),
  };
}

/** Read one account's link (token unsealed), or null if absent/unsealable. */
export async function getBhyveLink(accountId: string): Promise<BhyveLink | null> {
  const sql = db();
  if (!sql) return null;
  try {
    const rows = (await sql`
      SELECT account_id, sealed_token, status, auto_run
      FROM bhyve_links WHERE account_id = ${accountId}
    `) as Parameters<typeof rowToLink>[0][];
    return rows[0] ? rowToLink(rows[0]) : null;
  } catch (err) {
    console.warn("[verdyn] getBhyveLink failed:", (err as Error).message);
    return null;
  }
}

/** Lightweight status view for the dashboard (no token decryption). */
export async function getLinkStatus(
  accountId: string,
): Promise<{ linked: boolean; status: "linked" | "reauth_needed"; autoRun: boolean } | null> {
  const sql = db();
  if (!sql) return null;
  try {
    const rows = (await sql`
      SELECT status, auto_run FROM bhyve_links WHERE account_id = ${accountId}
    `) as { status: string; auto_run: boolean }[];
    if (!rows[0]) return { linked: false, status: "linked", autoRun: false };
    return {
      linked: true,
      status: rows[0].status === "reauth_needed" ? "reauth_needed" : "linked",
      autoRun: Boolean(rows[0].auto_run),
    };
  } catch (err) {
    console.warn("[verdyn] getLinkStatus failed:", (err as Error).message);
    return null;
  }
}

/** Every account opted into automated execution and still linked — the cron's
 *  work list. Returns account ids only; sessions are loaded per-account. */
export async function listAutoRunAccounts(): Promise<string[]> {
  const sql = db();
  if (!sql) return [];
  try {
    const rows = (await sql`
      SELECT account_id FROM bhyve_links WHERE auto_run = true AND status = 'linked'
    `) as { account_id: string }[];
    return rows.map((r) => r.account_id);
  } catch (err) {
    console.warn("[verdyn] listAutoRunAccounts failed:", (err as Error).message);
    return [];
  }
}

/** Flip the per-account opt-in to automated execution. */
export async function setAutoRun(accountId: string, on: boolean): Promise<void> {
  const sql = db();
  if (!sql) return;
  try {
    await sql`UPDATE bhyve_links SET auto_run = ${on}, updated_at = now() WHERE account_id = ${accountId}`;
  } catch (err) {
    console.warn("[verdyn] setAutoRun failed:", (err as Error).message);
  }
}

/** Mark the token dead after an Orbit 401 so the cron stops trying and the UI
 *  prompts a reconnect. */
export async function markReauthNeeded(accountId: string, error: string): Promise<void> {
  const sql = db();
  if (!sql) return;
  try {
    await sql`
      UPDATE bhyve_links
      SET status = 'reauth_needed', last_error = ${error.slice(0, 500)}, updated_at = now()
      WHERE account_id = ${accountId}
    `;
  } catch (err) {
    console.warn("[verdyn] markReauthNeeded failed:", (err as Error).message);
  }
}

/** Record that the cron touched this link. On success it also advances
 *  last_ok_at; on error it notes last_error but leaves last_ok_at untouched. */
export async function touchRun(accountId: string, error?: string): Promise<void> {
  const sql = db();
  if (!sql) return;
  try {
    if (error) {
      await sql`
        UPDATE bhyve_links
        SET last_run_at = now(), last_error = ${error.slice(0, 500)}, updated_at = now()
        WHERE account_id = ${accountId}
      `;
    } else {
      await sql`
        UPDATE bhyve_links
        SET last_run_at = now(), last_ok_at = now(), last_error = NULL, updated_at = now()
        WHERE account_id = ${accountId}
      `;
    }
  } catch (err) {
    console.warn("[verdyn] touchRun failed:", (err as Error).message);
  }
}

/** Remove the link entirely (called on explicit B-hyve disconnect). */
export async function deleteBhyveLink(accountId: string): Promise<void> {
  const sql = db();
  if (!sql) return;
  try {
    await sql`DELETE FROM bhyve_links WHERE account_id = ${accountId}`;
  } catch (err) {
    console.warn("[verdyn] deleteBhyveLink failed:", (err as Error).message);
  }
}
