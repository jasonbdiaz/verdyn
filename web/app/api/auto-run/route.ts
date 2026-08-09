import { NextResponse } from "next/server";
import { currentAccountId, currentEntitlement } from "@/lib/account";
import { entitlementActive } from "@verdyn/core";
import { getLinkStatus, setAutoRun } from "@/lib/bhyve-link-store";
import { recentRuns } from "@/lib/run-log-store";
import { readJson } from "@/lib/validate";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

// Status + control for automated watering.
//   GET  → { linked, status, autoRun, entitled, runs[] } for the current account.
//   POST → { autoRun: boolean } to pause/resume execution without disconnecting.
//
// Read/written only for the signed-in account — the cron's opt-in flag and run
// history are per-account and never trust a client-supplied id.

export async function GET() {
  const accountId = await currentAccountId();
  if (!accountId) return NextResponse.json({ error: "auth" }, { status: 401 });

  const [link, ent, runs] = await Promise.all([
    getLinkStatus(accountId),
    currentEntitlement(),
    recentRuns(accountId, 30),
  ]);

  return NextResponse.json({
    linked: link?.linked ?? false,
    status: link?.status ?? "linked",
    autoRun: link?.autoRun ?? false,
    entitled: entitlementActive(ent),
    runs,
  });
}

export async function POST(req: Request) {
  const rl = rateLimit(`autorun:${clientIp(req)}`, 30, 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Slow down a moment." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const accountId = await currentAccountId();
  if (!accountId) return NextResponse.json({ error: "auth" }, { status: 401 });

  const { data, error } = await readJson<{ autoRun?: unknown }>(req);
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (typeof data?.autoRun !== "boolean")
    return NextResponse.json({ error: "autoRun must be a boolean." }, { status: 400 });

  await setAutoRun(accountId, data.autoRun);
  return NextResponse.json({ ok: true, autoRun: data.autoRun });
}
