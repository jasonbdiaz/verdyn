import { NextResponse } from "next/server";
import { currentAccountId } from "@/lib/account";
import { readJson } from "@/lib/validate";
import { setAccountType, realignAccountTier } from "@/lib/entitlement-store";

export const runtime = "nodejs";

// Set the account's audience (homeowner | business). Drives routing/UX; the
// hard Pro gate is the entitlement, not this flag.
export async function POST(req: Request) {
  const accountId = await currentAccountId();
  if (!accountId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { data, error } = await readJson<{ type?: unknown }>(req);
  if (error) return NextResponse.json({ error }, { status: 400 });
  const type = data?.type === "business" ? "business" : "homeowner";
  await setAccountType(accountId, type);
  // Bump a running free trial to the tier that matches the audience (business →
  // Pro) so a brand-new business account trials the right product.
  await realignAccountTier(accountId, type);
  return NextResponse.json({ ok: true, accountType: type });
}
