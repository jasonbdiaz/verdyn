// Idempotent ledger for automated watering. The hourly cron records every cycle
// it runs (or deliberately skips) so a retry or an overlapping firing can never
// energize the same valve twice. Also the source of the dashboard run history.
import { db } from "./db";

export type RunStatus = "ran" | "skipped_window" | "wind_skip" | "reauth_needed" | "error";

export interface RunRecord {
  accountId: string;
  propertyId?: string; // '' for a homeowner's single lawn
  zoneId: string;
  runDate: string; // 'YYYY-MM-DD'
  cycleTime: string; // 'HH:MM' local
  minutes?: number;
  status: RunStatus;
  detail?: string;
}

/**
 * Record a cycle attempt. Returns true when THIS call inserted the row, false
 * when a row for that (account, property, zone, date, time) already existed —
 * which is exactly the "already handled, don't run it again" signal the cron
 * relies on. The INSERT … ON CONFLICT DO NOTHING makes the check-and-claim
 * atomic, so two concurrent firings can't both run the same cycle.
 */
export async function claimRun(rec: RunRecord): Promise<boolean> {
  const sql = db();
  if (!sql) return false; // no DB → can't guarantee idempotency → don't run
  try {
    const rows = (await sql`
      INSERT INTO run_log (
        account_id, property_id, zone_id, run_date, cycle_time, minutes, status, detail
      ) VALUES (
        ${rec.accountId}, ${rec.propertyId ?? ""}, ${rec.zoneId}, ${rec.runDate},
        ${rec.cycleTime}, ${rec.minutes ?? null}, ${rec.status}, ${rec.detail ?? null}
      )
      ON CONFLICT (account_id, property_id, zone_id, run_date, cycle_time) DO NOTHING
      RETURNING id
    `) as { id: string }[];
    return rows.length > 0;
  } catch (err) {
    console.warn("[verdyn] claimRun failed:", (err as Error).message);
    return false;
  }
}

/** Update a previously-claimed row's outcome (e.g. claimed as 'ran', then the
 *  Orbit call threw → mark 'error'). Keyed by the same natural key. */
export async function updateRunStatus(
  rec: Pick<RunRecord, "accountId" | "propertyId" | "zoneId" | "runDate" | "cycleTime">,
  status: RunStatus,
  detail?: string,
): Promise<void> {
  const sql = db();
  if (!sql) return;
  try {
    await sql`
      UPDATE run_log SET status = ${status}, detail = ${detail ?? null}
      WHERE account_id = ${rec.accountId} AND property_id = ${rec.propertyId ?? ""}
        AND zone_id = ${rec.zoneId} AND run_date = ${rec.runDate} AND cycle_time = ${rec.cycleTime}
    `;
  } catch (err) {
    console.warn("[verdyn] updateRunStatus failed:", (err as Error).message);
  }
}

export interface RunHistoryRow {
  zoneId: string;
  runDate: string;
  cycleTime: string;
  minutes: number | null;
  status: string;
  detail: string | null;
  createdAt: string;
}

/** Recent run history for an account, newest first (dashboard). */
export async function recentRuns(accountId: string, limit = 50): Promise<RunHistoryRow[]> {
  const sql = db();
  if (!sql) return [];
  const n = Math.min(Math.max(1, limit), 200);
  try {
    const rows = (await sql`
      SELECT zone_id, run_date, cycle_time, minutes, status, detail, created_at
      FROM run_log WHERE account_id = ${accountId}
      ORDER BY created_at DESC LIMIT ${n}
    `) as {
      zone_id: string; run_date: string | Date; cycle_time: string;
      minutes: number | null; status: string; detail: string | null; created_at: string | Date;
    }[];
    return rows.map((r) => ({
      zoneId: r.zone_id,
      runDate: r.run_date instanceof Date ? r.run_date.toISOString().slice(0, 10) : String(r.run_date),
      cycleTime: r.cycle_time,
      minutes: r.minutes,
      status: r.status,
      detail: r.detail,
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    }));
  } catch (err) {
    console.warn("[verdyn] recentRuns failed:", (err as Error).message);
    return [];
  }
}

/** Clear an account's run ledger (every property). Used by the onboarding reset
 *  so the dashboard history starts empty. No-op without a DB. */
export async function deleteRunLog(accountId: string): Promise<void> {
  const sql = db();
  if (!sql) return;
  try {
    await sql`DELETE FROM run_log WHERE account_id = ${accountId}`;
  } catch (err) {
    console.warn("[verdyn] deleteRunLog failed:", (err as Error).message);
  }
}
