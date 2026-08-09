import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";
import { currentAccountId } from "@/lib/account";
import { deleteBhyveLink } from "@/lib/bhyve-link-store";

export const runtime = "nodejs";

// Clears the B-hyve session cookie. Honors the "disconnect anytime" promise made
// during onboarding. The Orbit token simply expires on their side; we drop our
// copy — both the cookie and the persisted link that powers automated watering,
// so the cron stops touching their controller immediately.
export async function POST() {
  try {
    const accountId = await currentAccountId();
    if (accountId) await deleteBhyveLink(accountId);
  } catch { /* non-fatal — still clear the cookie below */ }

  const res = NextResponse.json({ disconnected: true });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
