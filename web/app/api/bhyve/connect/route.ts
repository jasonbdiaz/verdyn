import { NextResponse } from "next/server";
import { bhyve, BhyveError } from "@verdyn/core";
import { seal, SESSION_COOKIE } from "@/lib/session";
import { readJson, isEmail } from "@/lib/validate";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { currentAccountId } from "@/lib/account";
import { saveBhyveLink } from "@/lib/bhyve-link-store";

export const runtime = "nodejs";

// Exchange B-hyve credentials for a session, return the user's zones, and stash
// the session token — sealed with AES-256-GCM — in an httpOnly cookie.
//
// SECURITY:
//  - The raw password is used only to mint the token. It is never logged,
//    returned, or persisted.
//  - The token is sealed at rest (see lib/session.ts), so a leaked cookie is
//    useless without the server secret.
//  - Login is rate-limited per IP to blunt credential stuffing against Orbit.
//  - Error responses are uniform so they don't reveal whether an email exists.
export async function POST(req: Request) {
  // 1. Rate limit: 8 attempts / 10 min / IP.
  const rl = rateLimit(`bhyve-connect:${clientIp(req)}`, 8, 10 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a bit and try again." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  // 2. Parse + validate (bounded body).
  const { data, error } = await readJson<{ email?: string; password?: string }>(req);
  if (error) return NextResponse.json({ error }, { status: 400 });
  const email = data?.email;
  const password = data?.password;
  if (!isEmail(email) || typeof password !== "string" || password.length < 1 || password.length > 256) {
    return NextResponse.json({ error: "A valid email and password are required." }, { status: 400 });
  }

  // 3. Authenticate against Orbit and read zones.
  try {
    const session = await bhyve.login(email, password);
    const devices = await bhyve.listDevices(session);

    // If the visitor is already signed in, persist the sealed token so the
    // unattended cron can run their controller. Anonymous onboarding (no account
    // yet) just gets the cookie; the link is saved on a later authenticated
    // reconnect. Best-effort — a DB hiccup must not fail the connect.
    try {
      const accountId = await currentAccountId();
      if (accountId) await saveBhyveLink(accountId, session);
    } catch { /* non-fatal: cookie session still works for interactive use */ }

    const res = NextResponse.json({
      connected: true,
      devices: devices.map((d) => ({ id: d.id, name: d.name, zones: d.zones })),
    });
    res.cookies.set(SESSION_COOKIE, seal(session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days — re-auth weekly rather than monthly
    });
    return res;
  } catch (e) {
    // Uniform messaging — never disclose which part failed.
    const status = e instanceof BhyveError && e.status === 401 ? 401 : 502;
    const message =
      status === 401
        ? "Those B-hyve credentials didn't work. Double-check and try again."
        : "Couldn't reach B-hyve right now. Please try again in a moment.";
    return NextResponse.json({ error: message }, { status });
  }
}
