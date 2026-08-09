import { NextResponse } from "next/server";
import { readJson, isEmail } from "@/lib/validate";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { issueMagicLink } from "@/lib/auth";
import { sendMagicLink, emailConfigured } from "@/lib/email";

export const runtime = "nodejs";

// Request a magic-link sign-in email. Always responds 200 with the same body
// regardless of whether the email exists — never reveal which addresses have
// accounts. Rate-limited per IP and per email to blunt enumeration/spam.
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`auth-req-ip:${ip}`, 10, 10 * 60 * 1000).ok) {
    return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
  }

  const { data, error } = await readJson<{ email?: unknown }>(req);
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (!isEmail(data?.email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const email = (data!.email as string).trim().toLowerCase();
  if (!rateLimit(`auth-req-email:${email}`, 5, 10 * 60 * 1000).ok) {
    return NextResponse.json({ ok: true }); // silently absorb — looks identical to success
  }

  const origin = new URL(req.url).origin;
  const url = await issueMagicLink(email, origin);
  const ok = { ok: true } as { ok: true; devLink?: string };
  if (url) {
    const { devFallback } = await sendMagicLink(email, url);
    // Pre-launch affordance: until an email provider (RESEND_API_KEY) is wired,
    // return the link so sign-in is testable. Disappears automatically once
    // email is configured. Gated to non-production so a forgotten email key in a
    // prod/self-host deploy can never turn this into an account-takeover primitive
    // (any email would otherwise get a working sign-in link straight in the body).
    if (devFallback && !emailConfigured() && process.env.NODE_ENV !== "production") {
      ok.devLink = url;
    }
  }
  return NextResponse.json(ok);
}
