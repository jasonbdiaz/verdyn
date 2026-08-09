import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { bhyve } from "@verdyn/core";
import { unseal, SESSION_COOKIE } from "@/lib/session";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { currentAccountId } from "@/lib/account";
import { deleteBhyveLink } from "@/lib/bhyve-link-store";
import { deleteHomeProfile } from "@/lib/home-profile-store";
import { deleteRunLog } from "@/lib/run-log-store";
import { deleteComplianceLog } from "@/lib/compliance-store";

export const runtime = "nodejs";

// Restart onboarding for the signed-in account. Clears the saved setup so the
// user can re-run the flow and re-detect their B-hyve devices from scratch:
//   1. Stop anything Verdyn is running on the controller (best-effort).
//   2. Drop the controller link + B-hyve session cookie — so reconnecting does a
//      fresh device discovery, not a reuse of the old token.
//   3. Delete the saved lawn profile, run history, and compliance log.
// The account and its entitlement (e.g. a comp/owner plan) are KEPT — this is a
// config reset, not an account deletion. Multi-property (Pro) addresses are left
// untouched; they're managed in the Pro dashboard, not onboarding.
export async function POST(req: Request) {
  const rl = rateLimit(`reset:${clientIp(req)}`, 6, 10 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const accountId = await currentAccountId();
  if (!accountId) {
    return NextResponse.json({ error: "Sign in first.", code: "auth" }, { status: 401 });
  }

  const jar = await cookies();
  const session = unseal(jar.get(SESSION_COOKIE)?.value);

  // Best-effort: stop any live cycle before we throw away the ability to command.
  let stopped: string[] = [];
  let warning: string | null = null;
  if (session) {
    try {
      const result = await bhyve.stopAllZones(session);
      stopped = result.stopped;
      if (result.failed.length) {
        warning = `Could not confirm stop on: ${result.failed.map((f) => f.name).join(", ")}.`;
      }
    } catch (e) {
      warning = (e as Error).message;
    }
  }

  // Tear down the saved setup. Each store no-ops without a DB and swallows its
  // own errors, so a partial-failure never blocks the reset.
  await Promise.all([
    deleteBhyveLink(accountId),
    deleteHomeProfile(accountId),
    deleteRunLog(accountId),
    deleteComplianceLog(accountId),
  ]);

  const res = NextResponse.json({ reset: true, stopped, warning });
  // Drop the B-hyve session so the next connect re-authenticates and re-detects
  // devices. We keep the account cookie — the user stays signed in for onboarding.
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
