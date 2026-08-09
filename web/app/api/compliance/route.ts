import { NextResponse } from "next/server";
import { resolvePolicy, toSnapshot, entitlementActive } from "@verdyn/core";
import { readJson, validateProfile } from "@/lib/validate";
import { currentAccountId, currentEntitlement } from "@/lib/account";
import { syncCompliance } from "@/lib/compliance-store";

export const runtime = "nodejs";

// Proactive + auditable compliance (F3). Resolves the watering rule in force for
// a property, diffs it against the last rule we saw, appends any change events to
// the per-address audit log, and returns the recent log + fresh change alerts.
export async function POST(req: Request) {
  const accountId = await currentAccountId();
  if (!accountId) {
    return NextResponse.json({ error: "Sign in to view compliance.", code: "auth" }, { status: 401 });
  }
  const ent = await currentEntitlement();
  if (!entitlementActive(ent)) {
    return NextResponse.json({ error: "Your free trial has ended.", code: "upgrade" }, { status: 402 });
  }

  const { data, error } = await readJson<{ profile?: unknown; addressLabel?: string }>(req);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const v = validateProfile(data?.profile);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const profile = v.profile;
  const snapshot = toSnapshot(resolvePolicy(profile));
  const addressLabel = (data?.addressLabel || `${profile.zip} lawn`).slice(0, 120);
  const source = profile.localRestriction?.source ?? "builtin";

  const result = await syncCompliance(accountId, addressLabel, snapshot, profile.addressParity, source);

  return NextResponse.json({
    addressLabel,
    current: { policyId: snapshot.policyId, label: snapshot.label },
    changes: result.changes,
    log: result.log,
    persisted: result.persisted,
  });
}
