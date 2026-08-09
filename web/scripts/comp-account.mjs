// Grant a permanent, never-expiring "owner/comp" entitlement to an account by
// email — so it's never turned off (no card, no 14-day trial countdown). Use for
// the product owner's own account, or any account you want to run indefinitely.
//
//   DATABASE_URL=... node web/scripts/comp-account.mjs you@example.com
//   DATABASE_URL=... node web/scripts/comp-account.mjs you@example.com business
//
// The account is created if it doesn't exist yet (so you can comp ahead of the
// first sign-in). Idempotent and safe: it refuses to clobber a real paid
// subscription (source stripe/apple). Homeowner → Expert, business → Pro.
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const email = (process.argv[2] || "").trim().toLowerCase();
const accountType = (process.argv[3] || "homeowner").trim().toLowerCase();
if (!email || !email.includes("@")) {
  console.error("Usage: node web/scripts/comp-account.mjs <email> [homeowner|business]");
  process.exit(1);
}
if (accountType !== "homeowner" && accountType !== "business") {
  console.error("account type must be 'homeowner' or 'business'");
  process.exit(1);
}
const tier = accountType === "business" ? "pro" : "expert";

const sql = neon(url);

const accRows = await sql`
  INSERT INTO accounts (email, account_type) VALUES (${email}, ${accountType})
  ON CONFLICT (email) DO UPDATE SET account_type = EXCLUDED.account_type
  RETURNING id
`;
const accountId = accRows[0]?.id;
if (!accountId) {
  console.error("Could not create/find account.");
  process.exit(1);
}

const entRows = await sql`
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
  RETURNING tier, status
`;

if (entRows.length === 0) {
  console.log(`⚠ ${email} has a paid (stripe/apple) entitlement — left untouched.`);
} else {
  console.log(`✓ Comped ${email} (${accountType}) → ${entRows[0].tier} · active · never expires.`);
}
