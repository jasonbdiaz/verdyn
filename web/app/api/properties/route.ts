import { NextResponse } from "next/server";
import {
  emptyProfile, climateZoneForZip, hasPro, propertyLimit,
  type LawnProfile, type ZoneProfile, type SoilTextureId,
} from "@verdyn/core";
import { readJson, isZip } from "@/lib/validate";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { currentAccountId, currentEntitlement } from "@/lib/account";
import { listProperties, createProperty, deleteProperty } from "@/lib/property-store";
import { resolveLocalRestriction } from "@/lib/resolve-restriction";
import type { Entitlement } from "@verdyn/core";

export const runtime = "nodejs";

// All methods require an authenticated account with an active Pro entitlement —
// the multi-property module is the business tier. Gated server-side off the
// entitlement, never a client flag.
async function requirePro(): Promise<{ accountId: string; ent: Entitlement } | NextResponse> {
  const accountId = await currentAccountId();
  if (!accountId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const ent = await currentEntitlement();
  if (!hasPro(ent)) {
    return NextResponse.json({ error: "Pro plan required for multiple properties." }, { status: 403 });
  }
  return { accountId, ent };
}

export async function GET() {
  const gate = await requirePro();
  if (gate instanceof NextResponse) return gate;
  const properties = await listProperties(gate.accountId);
  return NextResponse.json({ properties });
}

export async function POST(req: Request) {
  if (!rateLimit(`prop:${clientIp(req)}`, 30, 10 * 60 * 1000).ok) {
    return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });
  }
  const gate = await requirePro();
  if (gate instanceof NextResponse) return gate;

  const { data, error } = await readJson<{
    label?: unknown; address?: unknown; zip?: unknown;
    soil?: unknown; parity?: unknown;
  }>(req);
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (typeof data?.label !== "string" || !data.label.trim()) {
    return NextResponse.json({ error: "A property label is required." }, { status: 400 });
  }
  if (!isZip(data?.zip)) {
    return NextResponse.json({ error: "A valid 5-digit ZIP is required." }, { status: 400 });
  }

  // The plan's property cap. Enforced atomically at insert time (below) so a
  // count-then-insert race can't exceed it.
  const limit = propertyLimit(gate.ent);

  const zip = data.zip as string;
  const parity = data.parity === "even" ? "even" : "odd";
  const soil = (data.soil as SoilTextureId) || "loam";

  // Pro is Expert-grade, so resolve the AI county restriction for this address.
  const { restriction } = await resolveLocalRestriction(zip, "expert");

  const zones: ZoneProfile[] = [
    { id: "zone_1", name: "Front", bhyveStation: 1, grassTypeId: "bermuda", headTypeId: "mp_rotator", sun: "full_sun", slope: "flat" },
    { id: "zone_2", name: "Back", bhyveStation: 2, grassTypeId: "bermuda", headTypeId: "mp_rotator", sun: "full_sun", slope: "flat" },
  ];

  const profile: LawnProfile = {
    ...emptyProfile(),
    zip,
    climateZoneId: climateZoneForZip(zip).id,
    soilTextureId: soil,
    addressParity: parity,
    expertMode: true,
    tier: "pro",
    localRestriction: restriction,
    zones,
  };

  const result = await createProperty(
    gate.accountId,
    {
      label: data.label.trim().slice(0, 120),
      address: typeof data.address === "string" ? data.address.trim().slice(0, 200) : undefined,
      zip,
      profile,
    },
    limit,
  );
  if (!result.ok) {
    return result.reason === "limit"
      ? NextResponse.json({ error: `Your plan covers up to ${limit} properties.` }, { status: 409 })
      : NextResponse.json({ error: "Could not save property." }, { status: 500 });
  }
  return NextResponse.json({ property: result.property });
}

export async function DELETE(req: Request) {
  const gate = await requirePro();
  if (gate instanceof NextResponse) return gate;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Property id required." }, { status: 400 });
  const ok = await deleteProperty(gate.accountId, id);
  return NextResponse.json({ ok });
}
