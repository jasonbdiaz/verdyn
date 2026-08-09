// Account + entitlement persistence (Neon). The open-source product has no
// payment rail: sign-in grants a permanent hosted entitlement, and any future
// billing integration would upsert through here. No-ops / returns
// NO_ENTITLEMENT when DATABASE_URL is unset so the app degrades to "no
// access" rather than crashing.
import {
  NO_ENTITLEMENT,
  normalizeTier,
  type Entitlement,
  type PlanTier,
  type SubStatus,
  type SubSource,
} from "@verdyn/core";
import { db } from "./db";

const iso = (v: unknown): string | null =>
  v instanceof Date ? v.toISOString() : typeof v === "string" ? v : null;

type EntRow = {
  tier: string;
  status: string;
  source: string;
  external_id: string | null;
  stripe_customer_id: string | null;
  property_limit: number | null;
  current_period_end: string | Date | null;
  trial_end: string | Date | null;
};

function rowToEntitlement(r: EntRow): Entitlement {
  return {
    tier: normalizeTier(r.tier),
    status: r.status as SubStatus,
    source: r.source as SubSource,
    externalId: r.external_id,
    propertyLimit: r.property_limit,
    currentPeriodEnd: iso(r.current_period_end),
    trialEnd: iso(r.trial_end),
  };
}

/** Create the account if needed, return its id. Email is lowercased. */
export async function getOrCreateAccount(email: string): Promise<string | null> {
  const sql = db();
  if (!sql) return null;
  const e = email.trim().toLowerCase();
  try {
    const rows = (await sql`
      INSERT INTO accounts (email) VALUES (${e})
      ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
      RETURNING id
    `) as { id: string }[];
    return rows[0]?.id ?? null;
  } catch (err) {
    console.warn("[verdyn] getOrCreateAccount failed:", (err as Error).message);
    return null;
  }
}

export async function getAccountType(accountId: string): Promise<"homeowner" | "business"> {
  const sql = db();
  if (!sql) return "homeowner";
  try {
    const rows = (await sql`SELECT account_type FROM accounts WHERE id = ${accountId}`) as {
      account_type: string;
    }[];
    return rows[0]?.account_type === "business" ? "business" : "homeowner";
  } catch {
    return "homeowner";
  }
}

export async function setAccountType(accountId: string, type: "homeowner" | "business"): Promise<void> {
  const sql = db();
  if (!sql) return;
  try {
    await sql`UPDATE accounts SET account_type = ${type} WHERE id = ${accountId}`;
  } catch (err) {
    console.warn("[verdyn] setAccountType failed:", (err as Error).message);
  }
}

export async function getEntitlement(accountId: string): Promise<Entitlement> {
  const sql = db();
  if (!sql) return NO_ENTITLEMENT;
  try {
    const rows = (await sql`
      SELECT tier, status, source, external_id, stripe_customer_id,
             property_limit, current_period_end, trial_end
      FROM entitlements WHERE account_id = ${accountId}
    `) as EntRow[];
    return rows[0] ? rowToEntitlement(rows[0]) : NO_ENTITLEMENT;
  } catch (err) {
    console.warn("[verdyn] getEntitlement failed:", (err as Error).message);
    return NO_ENTITLEMENT;
  }
}

export interface EntitlementUpsert {
  tier: PlanTier;
  status: SubStatus;
  source: SubSource;
  externalId?: string | null;
  stripeCustomerId?: string | null;
  /** Purchased Pro-band property cap; null → use the tier default. */
  propertyLimit?: number | null;
  currentPeriodEnd?: string | null;
  trialEnd?: string | null;
}

/** Upsert the entitlement for an account. Called by Stripe/Apple webhooks. */
export async function upsertEntitlement(accountId: string, e: EntitlementUpsert): Promise<void> {
  const sql = db();
  if (!sql) return;
  try {
    await sql`
      INSERT INTO entitlements (
        account_id, tier, status, source, external_id, stripe_customer_id,
        property_limit, current_period_end, trial_end, updated_at
      ) VALUES (
        ${accountId}, ${e.tier}, ${e.status}, ${e.source}, ${e.externalId ?? null},
        ${e.stripeCustomerId ?? null}, ${e.propertyLimit ?? null},
        ${e.currentPeriodEnd ?? null}, ${e.trialEnd ?? null}, now()
      )
      ON CONFLICT (account_id) DO UPDATE SET
        tier = EXCLUDED.tier,
        status = EXCLUDED.status,
        source = EXCLUDED.source,
        external_id = EXCLUDED.external_id,
        stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, entitlements.stripe_customer_id),
        property_limit = EXCLUDED.property_limit,
        current_period_end = EXCLUDED.current_period_end,
        trial_end = EXCLUDED.trial_end,
        updated_at = now()
    `;
  } catch (err) {
    console.warn("[verdyn] upsertEntitlement failed:", (err as Error).message);
  }
}

/**
 * Grant a 14-day free trial to an account on first sign-in. Homeowners trial
 * Expert; business accounts trial Pro. Idempotent and race-safe: a guarded
 * `INSERT … ON CONFLICT DO NOTHING` means it only ever creates the first
 * entitlement row — it never re-grants a trial or clobbers a real (paid,
 * canceled, expired) subscription. Returns true only when a trial was created.
 */
/**
 * Grant the default hosted entitlement on first sign-in: Expert (agentic) for
 * homeowners, Pro for business accounts — permanent, no card, no shutoff.
 * There is no payment rail in the open-source product; the hosted "we run it
 * for you" managed tier is arranged directly (see /pricing).
 */
export async function grantDefaultEntitlement(
  accountId: string,
  accountType: "homeowner" | "business",
): Promise<boolean> {
  const sql = db();
  if (!sql) return false;
  const tier: PlanTier = accountType === "business" ? "pro" : "expert";
  try {
    const rows = (await sql`
      INSERT INTO entitlements (
        account_id, tier, status, source, current_period_end, trial_end, updated_at
      ) VALUES (
        ${accountId}, ${tier}, 'active', 'promo', NULL, NULL, now()
      )
      ON CONFLICT (account_id) DO NOTHING
      RETURNING account_id
    `) as { account_id: string }[];
    return rows.length > 0;
  } catch (err) {
    console.warn("[verdyn] grantDefaultEntitlement failed:", (err as Error).message);
    return false;
  }
}

/**
 * Emails granted a permanent owner/comp entitlement instead of a 14-day trial.
 * Set VERDYN_COMP_EMAILS="you@example.com,other@x.com". This is how the product
 * owner runs their own account indefinitely — no card, no shutoff.
 */
export function isCompEmail(email: string): boolean {
  const list = (process.env.VERDYN_COMP_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}

/**
 * Grant a non-expiring comp entitlement (status active, source promo, NULL period
 * + trial end) so `entitlementActive` is always true and the cron never turns the
 * account off. Idempotent and safe: the guarded upsert refuses to clobber a real
 * paid subscription (Stripe/Apple). Homeowners get Expert, businesses get Pro.
 */
export async function compAccount(
  accountId: string,
  accountType: "homeowner" | "business",
): Promise<void> {
  const sql = db();
  if (!sql) return;
  const tier: PlanTier = accountType === "business" ? "pro" : "expert";
  try {
    await sql`
      INSERT INTO entitlements (
        account_id, tier, status, source, current_period_end, trial_end, updated_at
      ) VALUES (
        ${accountId}, ${tier}, 'active', 'promo', NULL, NULL, now()
      )
      ON CONFLICT (account_id) DO UPDATE SET
        tier = EXCLUDED.tier,
        status = 'active',
        source = 'promo',
        current_period_end = NULL,
        trial_end = NULL,
        updated_at = now()
      WHERE entitlements.source NOT IN ('stripe', 'apple')
    `;
  } catch (err) {
    console.warn("[verdyn] compAccount failed:", (err as Error).message);
  }
}

/**
 * Keep a still-running promo trial's tier aligned with the account's audience —
 * a business account should trial Pro, a homeowner Expert. The trial tier is
 * decided at sign-in before the audience is always known (a new business user
 * defaults to homeowner), so this re-aligns it when /pro marks the account
 * business. Scoped to a `trialing` + `promo` row, so it can never touch a paid,
 * canceled, or expired subscription.
 */
export async function realignAccountTier(
  accountId: string,
  accountType: "homeowner" | "business",
): Promise<void> {
  const sql = db();
  if (!sql) return;
  const tier: PlanTier = accountType === "business" ? "pro" : "expert";
  try {
    await sql`
      UPDATE entitlements SET tier = ${tier}, updated_at = now()
      WHERE account_id = ${accountId} AND source = 'promo'
    `;
  } catch (err) {
    console.warn("[verdyn] realignTrialTier failed:", (err as Error).message);
  }
}

/** Resolve the account behind a billing identifier (for webhook handlers). */
export async function accountIdByExternalId(externalId: string): Promise<string | null> {
  const sql = db();
  if (!sql) return null;
  try {
    const rows = (await sql`
      SELECT account_id FROM entitlements WHERE external_id = ${externalId} LIMIT 1
    `) as { account_id: string }[];
    return rows[0]?.account_id ?? null;
  } catch (err) {
    console.warn("[verdyn] accountIdByExternalId failed:", (err as Error).message);
    return null;
  }
}

export async function accountIdByStripeCustomer(customerId: string): Promise<string | null> {
  const sql = db();
  if (!sql) return null;
  try {
    const rows = (await sql`
      SELECT account_id FROM entitlements WHERE stripe_customer_id = ${customerId} LIMIT 1
    `) as { account_id: string }[];
    return rows[0]?.account_id ?? null;
  } catch (err) {
    console.warn("[verdyn] accountIdByStripeCustomer failed:", (err as Error).message);
    return null;
  }
}
