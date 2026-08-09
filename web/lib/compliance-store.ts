// Persistence for the proactive, auditable compliance log (F3).
//
// Every account keeps a timestamped, append-only record of the watering rules in
// force at each address and every change to them. For a Pro lawn-care business
// this is legal cover: a defensible trail that each client property was watered
// within the rules in effect on each date.
//
// Like every Verdyn store, this degrades to a no-op when DATABASE_URL is unset —
// callers get the freshly-computed change set but no persisted history.
import {
  diffRestrictions, complianceEntryFromChange,
  type RestrictionSnapshot, type ComplianceChange, type ComplianceLogEntry,
} from "@verdyn/core";
import { db } from "./db";

let _ensured = false;
async function ensureTable(sql: NonNullable<ReturnType<typeof db>>): Promise<void> {
  if (_ensured) return;
  await sql`
    CREATE TABLE IF NOT EXISTS compliance_log (
      id            TEXT PRIMARY KEY,
      account_id    TEXT NOT NULL,
      address_label TEXT NOT NULL,
      at            TIMESTAMPTZ NOT NULL DEFAULT now(),
      kind          TEXT NOT NULL,
      policy_id     TEXT,
      policy_label  TEXT,
      summary       TEXT,
      source        TEXT,
      snapshot      JSONB
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS compliance_log_acct_addr ON compliance_log (account_id, address_label, at DESC)`;
  _ensured = true;
}

type Row = {
  id: string; at: string; address_label: string; kind: string;
  policy_id: string | null; policy_label: string | null; summary: string | null;
  source: string | null; snapshot: RestrictionSnapshot | null;
};

const rowToEntry = (r: Row): ComplianceLogEntry => ({
  id: r.id, at: typeof r.at === "string" ? r.at : new Date(r.at).toISOString(),
  addressLabel: r.address_label, kind: r.kind as ComplianceLogEntry["kind"],
  policyId: r.policy_id ?? "none", policyLabel: r.policy_label ?? "",
  summary: r.summary ?? "", source: (r.source as ComplianceLogEntry["source"]) ?? undefined,
});

/** Most recent stored snapshot for an address (for change detection). */
async function lastSnapshot(
  sql: NonNullable<ReturnType<typeof db>>, accountId: string, addressLabel: string,
): Promise<RestrictionSnapshot | null> {
  const rows = (await sql`
    SELECT snapshot FROM compliance_log
    WHERE account_id = ${accountId} AND address_label = ${addressLabel} AND snapshot IS NOT NULL
    ORDER BY at DESC LIMIT 1
  `) as { snapshot: RestrictionSnapshot | null }[];
  return rows[0]?.snapshot ?? null;
}

export interface ComplianceSyncResult {
  changes: ComplianceChange[];
  log: ComplianceLogEntry[];
  persisted: boolean;
}

/**
 * Resolve today's restriction for an address against what we last saw, append
 * any change events to the audit log, and return the recent log + new changes.
 * Safe with no DB: returns the computed changes and an empty log.
 */
export async function syncCompliance(
  accountId: string, addressLabel: string,
  next: RestrictionSnapshot, parity: "odd" | "even", source?: ComplianceLogEntry["source"],
): Promise<ComplianceSyncResult> {
  const sql = db();
  if (!sql) {
    // No persistence — we can still tell the user the current rule, but there's
    // no prior snapshot to diff against, so treat it as the baseline (no alerts).
    return { changes: [], log: [], persisted: false };
  }
  try {
    await ensureTable(sql);
    const prev = await lastSnapshot(sql, accountId, addressLabel);
    const changes = diffRestrictions(prev, next, parity);

    // First time we see this address: store a quiet baseline snapshot.
    if (!prev) {
      await sql`
        INSERT INTO compliance_log (id, account_id, address_label, kind, policy_id, policy_label, summary, source, snapshot)
        VALUES (${"cl_" + Date.now().toString(36)}, ${accountId}, ${addressLabel}, ${"baseline"},
                ${next.policyId}, ${next.label}, ${`Baseline: ${next.label}.`}, ${source ?? null}, ${JSON.stringify(next)})
      `;
    }

    // Persist each detected change as an audit entry carrying the new snapshot.
    for (const c of changes) {
      const e = complianceEntryFromChange(addressLabel, next, c, source);
      await sql`
        INSERT INTO compliance_log (id, account_id, address_label, kind, policy_id, policy_label, summary, source, snapshot)
        VALUES (${e.id}, ${accountId}, ${addressLabel}, ${e.kind}, ${e.policyId}, ${e.policyLabel},
                ${e.summary}, ${source ?? null}, ${JSON.stringify(next)})
      `;
    }

    const rows = (await sql`
      SELECT id, at, address_label, kind, policy_id, policy_label, summary, source, snapshot
      FROM compliance_log
      WHERE account_id = ${accountId} AND address_label = ${addressLabel}
      ORDER BY at DESC LIMIT 50
    `) as Row[];

    return { changes, log: rows.map(rowToEntry), persisted: true };
  } catch (e) {
    console.warn("[verdyn] compliance sync failed:", (e as Error).message);
    return { changes: [], log: [], persisted: false };
  }
}

/** Read the audit log for an address (most recent first). */
export async function getComplianceLog(
  accountId: string, addressLabel: string, limit = 50,
): Promise<ComplianceLogEntry[]> {
  const sql = db();
  if (!sql) return [];
  try {
    await ensureTable(sql);
    const rows = (await sql`
      SELECT id, at, address_label, kind, policy_id, policy_label, summary, source, snapshot
      FROM compliance_log
      WHERE account_id = ${accountId} AND address_label = ${addressLabel}
      ORDER BY at DESC LIMIT ${limit}
    `) as Row[];
    return rows.map(rowToEntry);
  } catch (e) {
    console.warn("[verdyn] compliance log read failed:", (e as Error).message);
    return [];
  }
}

/** Wipe an account's entire compliance history (every address). Used by the
 *  onboarding reset. No-op without a DB. */
export async function deleteComplianceLog(accountId: string): Promise<void> {
  const sql = db();
  if (!sql) return;
  try {
    await ensureTable(sql);
    await sql`DELETE FROM compliance_log WHERE account_id = ${accountId}`;
  } catch (e) {
    console.warn("[verdyn] compliance log delete failed:", (e as Error).message);
  }
}
