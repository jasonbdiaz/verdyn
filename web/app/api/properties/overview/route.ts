import { NextResponse } from "next/server";
import {
  buildDailyPlan, weeklyPreview, estimateSavings, aggregateSavings,
  hasPro, propertyLimit, type WaterSavings,
} from "@verdyn/core";
import { weatherForZip } from "@/lib/weather";
import { currentAccountId, currentEntitlement } from "@/lib/account";
import { listProperties } from "@/lib/property-store";

export const runtime = "nodejs";

const todayISO = () => new Date().toISOString().slice(0, 10);

// Portfolio overview for the Pro dashboard: for every managed property, build
// the week's plan, estimate water savings, and surface today's status +
// restriction compliance — then aggregate. Pro-gated.
export async function GET() {
  const accountId = await currentAccountId();
  if (!accountId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const ent = await currentEntitlement();
  if (!hasPro(ent)) return NextResponse.json({ error: "Pro plan required." }, { status: 403 });

  const properties = await listProperties(accountId);
  const date = todayISO();

  const rows = await Promise.all(
    properties.map(async (p) => {
      try {
        const weather = await weatherForZip(p.profile.zip);
        const today = buildDailyPlan(p.profile, weather, date);
        const week = weeklyPreview(p.profile, date, 7);
        const savings = estimateSavings(week, p.profile.zones.length);
        const r = p.profile.localRestriction;
        return {
          id: p.id,
          label: p.label,
          address: p.address ?? null,
          zip: p.profile.zip,
          zones: p.profile.zones.length,
          todayStatus: today.status,
          todayMultiplier: today.multiplier,
          restriction: r
            ? { label: r.label, county: r.county ?? null, source: r.source, needsVerification: Boolean(r.needsVerification) }
            : null,
          savings,
          ok: true as const,
        };
      } catch {
        return { id: p.id, label: p.label, address: p.address ?? null, zip: p.profile.zip, ok: false as const };
      }
    }),
  );

  const savingsParts = rows.filter((r) => r.ok && r.savings).map((r) => r.savings as WaterSavings);
  const aggregate = aggregateSavings(savingsParts);

  return NextResponse.json({
    properties: rows,
    aggregate,
    count: properties.length,
    limit: propertyLimit(ent),
  });
}
