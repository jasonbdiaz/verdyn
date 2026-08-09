// Verdyn entitlements — the single source of truth for "what can this account do."
//
// Billing is multi-source: a subscription can come from Stripe (web) or Apple
// IAP (iOS, via RevenueCat). Both write the SAME entitlement record; the apps
// only ever ask "what's my effective tier/caps." This keeps the billing vendor
// swappable and the gating logic in one place. Mirrors the graceful-degradation
// pattern used elsewhere: no/unknown entitlement degrades to NO access, never a
// crash.

import type { PlanTier } from "./types";
import { PLANS, normalizeTier, type Plan } from "./plans";

/** Lifecycle of a subscription. `none` = never subscribed / no record. */
export type SubStatus = "active" | "trialing" | "past_due" | "canceled" | "expired" | "none";

/** Where the subscription is billed. */
export type SubSource = "stripe" | "apple" | "promo" | "none";

export interface Entitlement {
  /** Which plan the account is on (only meaningful while active). */
  tier: PlanTier;
  status: SubStatus;
  source: SubSource;
  /** ISO timestamp the current paid period ends / renews. */
  currentPeriodEnd?: string | null;
  /** ISO timestamp a free trial ends, if trialing. */
  trialEnd?: string | null;
  /** Billing-vendor id (Stripe subscription id / Apple original_transaction_id). */
  externalId?: string | null;
  /**
   * Property cap purchased for this account (Pro bands). When set, it overrides
   * the tier's default `caps.propertyLimit` — a Stripe/Apple webhook writes the
   * limit for the band the customer bought. Null/undefined → use the tier default.
   */
  propertyLimit?: number | null;
}

/** The default for an account with no subscription on record — no access. */
export const NO_ENTITLEMENT: Entitlement = { tier: "weather", status: "none", source: "none" };

/** All capabilities off. Retained for callers that need a hard "nothing" set;
 *  the post-trial floor is {@link FREE_CAPS}, not this. */
export const NO_CAPS: Plan["caps"] = {
  weatherScheduling: false,
  builtinRestrictions: false,
  aiLocalRestrictions: false,
  perZoneTuning: false,
  manualOverrides: false,
  aiAutopilot: false,
  mowCheckIns: false,
  photoRecommendations: false,
  multiProperty: false,
  savingsReporting: false,
  propertyLimit: 0,
};

/** The permanent Free tier's capabilities — the floor every account lands on
 *  when it has no active paid/trial entitlement. Smart planning stays ON; only
 *  the paid Autopilot/Pro capabilities are off. */
export const FREE_CAPS: Plan["caps"] = PLANS.weather.caps;

const notExpired = (iso: string | null | undefined): boolean =>
  !iso || new Date(iso).getTime() > Date.now();

/** True when the service should actively run for this account. */
export function entitlementActive(e: Entitlement | null | undefined): boolean {
  if (!e) return false;
  switch (e.status) {
    case "active":
    case "trialing":
      return notExpired(e.currentPeriodEnd);
    // Dunning grace: keep serving a past-due account until its period actually ends.
    case "past_due":
      return Boolean(e.currentPeriodEnd) && notExpired(e.currentPeriodEnd);
    default:
      return false;
  }
}

/** The tier whose caps apply right now. Falls back to the permanent Free tier
 *  ("weather") when there's no active paid/trial entitlement — every account has
 *  at least Free access, never "no access". */
export function effectiveTier(e: Entitlement | null | undefined): PlanTier {
  return entitlementActive(e) ? normalizeTier(e!.tier) : "weather";
}

/** The capability set to gate features on. No paid entitlement → Free caps
 *  (smart planning on; paid Autopilot/Pro features off). */
export function effectiveCaps(e: Entitlement | null | undefined): Plan["caps"] {
  return PLANS[effectiveTier(e)].caps;
}

/** Active access to hands-off Autopilot (the paid automation). Cap-based, so
 *  Pro qualifies too; Free does not. */
export function hasAutopilot(e: Entitlement | null | undefined): boolean {
  return effectiveCaps(e).aiAutopilot;
}

/** Active access to Expert-grade AI features. Cap-based, so Pro qualifies too. */
export function hasExpert(e: Entitlement | null | undefined): boolean {
  return effectiveCaps(e).aiLocalRestrictions;
}

/** Active Pro (business / multi-property) access. */
export function hasPro(e: Entitlement | null | undefined): boolean {
  return effectiveCaps(e).multiProperty;
}

/** How many properties this account may currently manage. A per-account
 *  override (the purchased Pro band) wins over the tier default; an inactive
 *  account gets 0. */
export function propertyLimit(e: Entitlement | null | undefined): number {
  if (!entitlementActive(e)) return 0;
  const override = e!.propertyLimit;
  return typeof override === "number" && override > 0 ? override : effectiveCaps(e).propertyLimit;
}
