import { NextResponse } from "next/server";
import { effectiveTier, entitlementActive, hasPro, hasAutopilot } from "@verdyn/core";
import { currentAccountId, currentEntitlement } from "@/lib/account";
import { getAccountType } from "@/lib/entitlement-store";

export const runtime = "nodejs";

// Lightweight account/entitlement status for the UI. Never exposes billing ids.
export async function GET() {
  const accountId = await currentAccountId();
  if (!accountId) {
    return NextResponse.json({ authenticated: false, tier: null, active: false, accountType: null, pro: false });
  }
  const ent = await currentEntitlement();
  // A comp/owner account is active with no expiry (current_period_end NULL via
  // compAccount) — the dashboard shows "unlimited" rather than a countdown.
  const comped =
    entitlementActive(ent) &&
    ent.source === "promo" &&
    !ent.currentPeriodEnd &&
    !ent.trialEnd;
  return NextResponse.json({
    authenticated: true,
    tier: effectiveTier(ent), // "weather" (Free) when no active paid/trial sub
    active: entitlementActive(ent), // has a paid/trialing subscription
    autopilot: hasAutopilot(ent), // paid hands-off automation unlocked
    status: ent.status,
    accountType: await getAccountType(accountId),
    pro: hasPro(ent),
    comped,
    // When trialing, the dashboard counts down to this and warns about shutoff.
    trialEnd: ent.status === "trialing" ? ent.trialEnd : null,
  });
}
