import { NextResponse } from "next/server";
import { buildDailyPlan, weeklyPreview, hasAutopilot } from "@verdyn/core";
import { weatherForZip } from "@/lib/weather";
import { readJson, validateProfile } from "@/lib/validate";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { currentAccountId, currentEntitlement } from "@/lib/account";
import { getAccountType } from "@/lib/entitlement-store";
import { saveHomeProfile } from "@/lib/home-profile-store";

export const runtime = "nodejs";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  // Light rate limit — the weather upstream is shared and free; protect it.
  const rl = rateLimit(`plan:${clientIp(req)}`, 60, 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Slow down a moment." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  // Smart planning is FREE — the always-on "make any B-hyve smarter" engine that
  // builds our user base. We only require sign-in (to attach the profile); the
  // plan itself is returned for Free accounts too. Paid "Autopilot" (running the
  // schedule on the controller unattended) is gated separately in the executor.
  // The response carries `autopilot` so the client shows the right upgrade nudge.
  const accountId = await currentAccountId();
  if (!accountId) {
    return NextResponse.json(
      { error: "Sign in to see your smart plan — free.", code: "auth" },
      { status: 401 },
    );
  }
  const ent = await currentEntitlement();
  const autopilot = hasAutopilot(ent);

  const { data, error } = await readJson<{ profile?: unknown; week?: boolean; timezone?: string }>(req);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const v = validateProfile(data?.profile);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  // Persist a homeowner's profile (+ browser timezone) so the unattended cron
  // can plan and run their controller without the page open. Pro accounts keep
  // their config in `properties`, so skip them here. Best-effort, never blocks
  // the plan response.
  try {
    if ((await getAccountType(accountId)) !== "business") {
      await saveHomeProfile(accountId, v.profile, typeof data?.timezone === "string" ? data.timezone : null);
    }
  } catch { /* non-fatal */ }

  const date = todayISO();
  const weather = await weatherForZip(v.profile.zip);
  const today = buildDailyPlan(v.profile, weather, date);
  const week = data?.week ? weeklyPreview(v.profile, date, 7) : undefined;

  return NextResponse.json({ date, weather, today, week, autopilot });
}
