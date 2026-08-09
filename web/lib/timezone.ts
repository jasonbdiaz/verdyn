// Wall-clock helpers for the executor. Cycle times are "HH:MM" in the property's
// LOCAL time, but the cron fires in UTC — so we need the current local hour and
// local calendar date for a given IANA zone to decide what's due and to key the
// idempotency ledger by the right day.

/** Current local hour (0–23), minute (0–59), and ISO date (YYYY-MM-DD) for an
 *  IANA zone. Falls back to UTC if the zone is missing or invalid. */
export function localParts(
  now: Date,
  timeZone: string | null,
): { hour: number; minute: number; dateISO: string } {
  const tz = timeZone || "UTC";
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const hour = Number.parseInt(get("hour"), 10);
    const minute = Number.parseInt(get("minute"), 10);
    const dateISO = `${get("year")}-${get("month")}-${get("day")}`;
    if (!Number.isInteger(hour) || !Number.isInteger(minute) || dateISO.length !== 10)
      throw new Error("bad parts");
    // h23 renders midnight as "24" in some engines — normalize.
    return { hour: hour === 24 ? 0 : hour, minute, dateISO };
  } catch {
    return { hour: now.getUTCHours(), minute: now.getUTCMinutes(), dateISO: now.toISOString().slice(0, 10) };
  }
}

// Coarse state → IANA fallback, used only when the client never captured a zone.
// Most multi-zone states are assigned their majority zone; this is a backstop,
// not a precision instrument — the captured browser zone is always preferred.
const STATE_TZ: Record<string, string> = {
  HI: "Pacific/Honolulu", AK: "America/Anchorage",
  WA: "America/Los_Angeles", OR: "America/Los_Angeles", CA: "America/Los_Angeles", NV: "America/Los_Angeles",
  AZ: "America/Phoenix", UT: "America/Denver", CO: "America/Denver", NM: "America/Denver",
  MT: "America/Denver", WY: "America/Denver", ID: "America/Denver",
  TX: "America/Chicago", OK: "America/Chicago", KS: "America/Chicago", NE: "America/Chicago",
  SD: "America/Chicago", ND: "America/Chicago", MN: "America/Chicago", IA: "America/Chicago",
  MO: "America/Chicago", AR: "America/Chicago", LA: "America/Chicago", MS: "America/Chicago",
  AL: "America/Chicago", WI: "America/Chicago", IL: "America/Chicago", TN: "America/Chicago",
  // Everything else → Eastern.
};

/** Best-effort IANA zone from a US state abbreviation; defaults to Eastern. */
export function tzForState(state: string | null | undefined): string {
  if (!state) return "America/New_York";
  return STATE_TZ[state.toUpperCase()] ?? "America/New_York";
}
