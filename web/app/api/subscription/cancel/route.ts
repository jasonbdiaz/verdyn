import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { bhyve } from "@verdyn/core";
import { unseal, SESSION_COOKIE } from "@/lib/session";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { currentAccountId } from "@/lib/account";
import { deleteBhyveLink } from "@/lib/bhyve-link-store";

export const runtime = "nodejs";

// Cancel a Verdyn subscription. This is the teardown the product promises:
//   1. Stop any cycle Verdyn has running on every controller (best-effort).
//   2. Delete the persisted B-hyve link — the sealed token + auto_run flag the
//      15-min cron reads. This is the real kill switch: without it the cron keeps
//      watering even after the browser cookie is cleared (entitlements never
//      lapse on their own). Mirrors /api/bhyve/disconnect and /api/account/reset.
//   3. Clear our session cookie so this browser can no longer send commands.
// The user's controller and B-hyve app are untouched and remain theirs.
export async function POST(req: Request) {
  const rl = rateLimit(`cancel:${clientIp(req)}`, 10, 10 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const jar = await cookies();
  const session = unseal(jar.get(SESSION_COOKIE)?.value);

  let stopped: string[] = [];
  let teardownError: string | null = null;

  if (session) {
    try {
      const result = await bhyve.stopAllZones(session);
      stopped = result.stopped;
      // A partial failure (one controller unreachable) still proceeds with
      // revocation — losing our token is the hard guarantee that we stop.
      if (result.failed.length) {
        teardownError = `Could not confirm stop on: ${result.failed.map((f) => f.name).join(", ")}.`;
      }
    } catch (e) {
      teardownError = (e as Error).message;
    }
  }

  // Sever the persisted link so the cron stops programming this account. Best-
  // effort and non-fatal — we still revoke the cookie below no matter what.
  try {
    const accountId = await currentAccountId();
    if (accountId) await deleteBhyveLink(accountId);
  } catch { /* non-fatal — cookie revocation below still cuts this browser */ }

  // Revoke access regardless of teardown outcome.
  const res = NextResponse.json({
    canceled: true,
    canceledAt: new Date().toISOString(),
    stopped,
    accessRevoked: true,
    // Surfaced so the UI can tell the user if a controller was offline and they
    // should verify it manually — we never silently swallow a B-hyve failure.
    warning: teardownError,
  });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
