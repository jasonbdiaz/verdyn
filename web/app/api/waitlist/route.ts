import { NextResponse } from "next/server";
import { brandBySlug } from "@verdyn/core";
import { readJson, isEmail } from "@/lib/validate";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { addWaitlist } from "@/lib/waitlist-store";

export const runtime = "nodejs";

// Capture a "notify me when {brand} is live" signup for a controller Verdyn
// doesn't support yet. Anonymous (no auth) — the brand must be a real
// coming-soon entry in the core catalog, never a live brand (those just connect).
//
// SECURITY: rate-limited per IP; only an email + a known brand slug are stored;
// the response is uniform so it never reveals whether the signup already existed.
export async function POST(req: Request) {
  const rl = rateLimit(`waitlist:${clientIp(req)}`, 8, 10 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a bit and try again." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const { data, error } = await readJson<{
    email?: string; brandSlug?: string; source?: string;
  }>(req);
  if (error) return NextResponse.json({ error }, { status: 400 });

  if (!isEmail(data?.email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  const brand = typeof data?.brandSlug === "string" ? brandBySlug(data.brandSlug) : undefined;
  if (!brand || brand.status === "live") {
    return NextResponse.json({ error: "That controller isn't on the waitlist." }, { status: 400 });
  }
  const source = data?.source === "mobile" ? "mobile" : "web";

  await addWaitlist(data.email, brand.slug, source);
  // Uniform success whether or not the row was new (or the DB was reachable).
  return NextResponse.json({ ok: true });
}
