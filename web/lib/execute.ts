// The automated watering executor — the core promise of Verdyn: it runs the
// plan on the user's controller with nobody present.
//
// Invoked every 15 min by the cron (web/app/api/cron/run/route.ts). For each
// account that opted into automation and is still entitled, it builds today's
// plan, finds the cycles due now, and energizes those valves via Orbit — with
// three layers of safety:
//
//   1. The plan itself already excludes banned hours/days/wind/rain (the engine
//      never emits a forbidden cycle).
//   2. A hard run-time gate (core `cyclesDueAt`) refuses anything outside the
//      morning irrigation window [4,10) — belt-and-suspenders against a bug.
//   3. A live wind re-check at the moment of execution; a gust above the skip
//      threshold cancels the cycle even if the morning forecast was calm.
//
// Every B-hyve call is wrapped defensively (the Orbit API is unofficial). A 401
// flips the link to reauth_needed and stops trying; the user reconnects. Every
// decision is written to the idempotent run_log so a retry never double-waters.

import {
  bhyve, BhyveError, buildDailyPlan, cyclesDueAt, entitlementActive,
  WIND_SKIP_MPH, type BhyveSession, type LawnProfile, type ZoneProfile,
} from "@verdyn/core";
import { getEntitlement, getAccountType } from "./entitlement-store";
import {
  listAutoRunAccounts, getBhyveLink, markReauthNeeded, touchRun,
} from "./bhyve-link-store";
import { getHomeProfile } from "./home-profile-store";
import { listProperties } from "./property-store";
import { claimRun, updateRunStatus } from "./run-log-store";
import { weatherForZip } from "./weather";
import { localParts, tzForState } from "./timezone";
import { placeForZip } from "./geo";

export interface ExecSummary {
  accounts: number;
  cyclesRun: number;
  cyclesSkipped: number;
  errors: number;
  details: string[];
}

interface PlanTarget {
  propertyId: string; // '' for a homeowner's single lawn
  profile: LawnProfile;
  timezone: string | null;
}

const zoneById = (profile: LawnProfile, id: string): ZoneProfile | undefined =>
  profile.zones.find((z) => z.id === id);

/** Resolve the IANA zone for a target: prefer the client-captured zone, else
 *  derive a coarse one from the property's ZIP/state. */
async function resolveTimeZone(t: PlanTarget): Promise<string> {
  if (t.timezone) return t.timezone;
  try {
    const place = await placeForZip(t.profile.zip);
    return tzForState(place?.state);
  } catch {
    return "America/New_York";
  }
}

/** Run one account's due cycles. Mutates the summary in place. */
async function runAccount(accountId: string, now: Date, sum: ExecSummary): Promise<void> {
  // 1. Entitlement gate — never energize valves for a lapsed subscription.
  const ent = await getEntitlement(accountId);
  if (!entitlementActive(ent)) return;

  // 2. Load the sealed token. A reauth_needed link is filtered out upstream, but
  //    re-check defensively.
  const link = await getBhyveLink(accountId);
  if (!link || link.status !== "linked" || !link.autoRun) return;
  const session: BhyveSession = link.session;

  // 3. Gather plan targets: a homeowner has one persisted profile; a business
  //    account has many properties.
  const type = await getAccountType(accountId);
  const targets: PlanTarget[] = [];
  if (type === "business") {
    const props = await listProperties(accountId);
    for (const p of props) targets.push({ propertyId: p.id, profile: p.profile, timezone: null });
  } else {
    const hp = await getHomeProfile(accountId);
    if (hp) targets.push({ propertyId: "", profile: hp.profile, timezone: hp.timezone });
  }
  if (targets.length === 0) return;

  let touchedError: string | undefined;

  for (const t of targets) {
    const tz = await resolveTimeZone(t);
    const { hour, minute, dateISO } = localParts(now, tz);

    // The engine plans against the property's local calendar day.
    const weather = await weatherForZip(t.profile.zip);
    const plan = buildDailyPlan(t.profile, weather, dateISO);
    const due = cyclesDueAt(plan, hour, minute); // window-gated; due-or-overdue
    if (due.length === 0) continue;

    for (const cycle of due) {
      const key = {
        accountId, propertyId: t.propertyId, zoneId: cycle.zoneId,
        runDate: dateISO, cycleTime: cycle.time,
      };

      // Atomically claim this cycle. If another firing already has it, skip.
      const claimed = await claimRun({
        ...key, minutes: cycle.minutes, status: "ran",
        detail: `${cycle.zoneName} · ${cycle.minutes}min`,
      });
      if (!claimed) continue;

      // Live wind re-check — a gust now overrides a calm morning forecast.
      if (weather.windMph > WIND_SKIP_MPH) {
        await updateRunStatus(key, "wind_skip", `${Math.round(weather.windMph)}mph wind at run time`);
        sum.cyclesSkipped++;
        continue;
      }

      // Map the cycle's zone to a real controller + station.
      const zone = zoneById(t.profile, cycle.zoneId);
      if (!zone?.bhyveDeviceId || typeof zone.bhyveStation !== "number") {
        await updateRunStatus(key, "error", "zone not mapped to a controller station");
        sum.errors++;
        continue;
      }

      // 4. Energize the valve. Defensive: unofficial Orbit API.
      try {
        await bhyve.runZone(session, zone.bhyveDeviceId, zone.bhyveStation, cycle.minutes);
        sum.cyclesRun++;
        sum.details.push(`${accountId.slice(0, 8)} ${cycle.zoneName} ${cycle.minutes}min @ ${cycle.time}`);
      } catch (e) {
        const err = e as BhyveError;
        const msg = err?.message ?? "unknown error";
        if (err instanceof BhyveError && err.status === 401) {
          // Token died — stop trying this account until they reconnect.
          await markReauthNeeded(accountId, msg);
          await updateRunStatus(key, "reauth_needed", "Orbit rejected the saved session — reconnect required");
          touchedError = "reauth_needed";
          sum.errors++;
          return; // abandon the rest of this account's cycles
        }
        await updateRunStatus(key, "error", msg.slice(0, 300));
        touchedError = msg;
        sum.errors++;
      }
    }
  }

  await touchRun(accountId, touchedError);
}

/**
 * Run all due cycles across every opted-in account for the given instant.
 * Per-account failures are isolated — one bad account never aborts the rest.
 */
export async function runDueCycles(now: Date = new Date()): Promise<ExecSummary> {
  const sum: ExecSummary = { accounts: 0, cyclesRun: 0, cyclesSkipped: 0, errors: 0, details: [] };
  const accountIds = await listAutoRunAccounts();
  for (const accountId of accountIds) {
    sum.accounts++;
    try {
      await runAccount(accountId, now, sum);
    } catch (e) {
      sum.errors++;
      sum.details.push(`account ${accountId.slice(0, 8)} failed: ${(e as Error).message}`);
    }
  }
  return sum;
}
