import { NextResponse } from "next/server";
import { hasExpert } from "@verdyn/core";
import { readJson, isZip } from "@/lib/validate";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { resolveLocalRestriction } from "@/lib/resolve-restriction";
import { currentEntitlement } from "@/lib/account";

export const runtime = "nodejs";

// Resolve the local watering restriction for a ZIP. The AI (Expert) path is
// gated SERVER-SIDE on the authenticated account's entitlement — the client's
// requested tier is never trusted, so AI research can't be unlocked for free.
export async function POST(req: Request) {
  // AI calls cost money and hit an upstream — limit harder than the plan route.
  const rl = rateLimit(`restrict:${clientIp(req)}`, 20, 10 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Slow down a moment." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const { data, error } = await readJson<{ zip?: unknown }>(req);
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (!isZip(data?.zip)) {
    return NextResponse.json({ error: "A valid 5-digit ZIP is required." }, { status: 400 });
  }

  // Entitlement decides the tier: active Expert → AI research; otherwise built-in.
  const tier = hasExpert(await currentEntitlement()) ? "expert" : "weather";
  const { restriction, aiAttempted } = await resolveLocalRestriction(data!.zip as string, tier);
  return NextResponse.json({ restriction, aiAttempted, tier });
}
