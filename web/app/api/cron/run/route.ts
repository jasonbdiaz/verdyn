import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runDueCycles } from "@/lib/execute";

export const runtime = "nodejs";
// Touching many accounts × controllers over the network — give it room.
export const maxDuration = 300;
// Never cache a side-effecting job.
export const dynamic = "force-dynamic";

// Automated-watering tick — fires every 15 min (see web/vercel.json `crons`) so
// each cycle-and-soak pulse lands on its own firing. For every opted-in, entitled
// account it builds today's plan and energizes the valves due now. Idempotent:
// the run_log dedupes, so a missed or retried firing is always safe.
//
// AUTH: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` automatically
// when CRON_SECRET is configured. We require it so the endpoint can't be poked
// by anyone. If CRON_SECRET is unset we refuse rather than run wide open.
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const hdr = req.headers.get("authorization");
  if (!hdr) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(hdr);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

async function handle(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const summary = await runDueCycles(new Date());
    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    // Never 500 the cron in a way that masks the cause; log and report.
    console.error("[verdyn] cron run failed:", (e as Error).message);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

// Vercel Cron issues GET; allow POST too for manual/secured triggering.
export const GET = handle;
export const POST = handle;
