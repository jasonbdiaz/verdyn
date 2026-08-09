import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyMagicLink } from "@/lib/auth";
import { sealAccount } from "@/lib/account";
import { compAccount, getAccountType, isCompEmail, grantDefaultEntitlement } from "@/lib/entitlement-store";
import { ACCOUNT_COOKIE, SESSION_COOKIE, unseal } from "@/lib/session";
import { saveBhyveLink } from "@/lib/bhyve-link-store";

export const runtime = "nodejs";

// Consume the magic-link token, mint an account session cookie, and redirect.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  const verified = await verifyMagicLink(token);

  if (!verified) {
    return NextResponse.redirect(new URL("/login?error=expired", req.url));
  }
  const { accountId, email } = verified;

  // Owner/comp emails (VERDYN_COMP_EMAILS) get a permanent, never-expiring
  // entitlement so their account is never turned off; everyone else gets the
  // standard 14-day trial of the paid tier (Autopilot for homeowners, Pro for
  // business). When that trial lapses the account drops to the permanent Free
  // tier (smart planning stays on) rather than being turned off. Both writes are
  // idempotent — a returning subscriber's entitlement is left untouched (comp
  // won't clobber a real paid sub). Business accounts land on /pro.
  const accountType = await getAccountType(accountId);
  if (isCompEmail(email)) {
    await compAccount(accountId, accountType);
  } else {
    await grantDefaultEntitlement(accountId, accountType);
  }

  // Many homeowners connect their B-hyve during onboarding BEFORE they sign in,
  // so the connect route had no account to attach the token to. Now that the
  // pairing is complete, mirror the sealed cookie token into the persisted link
  // so automated watering works without making them reconnect. Best-effort.
  try {
    const session = unseal((await cookies()).get(SESSION_COOKIE)?.value);
    if (session) await saveBhyveLink(accountId, session);
  } catch { /* non-fatal */ }

  const dest = accountType === "business" ? "/pro" : "/dashboard";
  const res = NextResponse.redirect(new URL(dest, req.url));
  res.cookies.set(ACCOUNT_COOKIE, sealAccount(accountId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
