// Agent-key management for the Expert (agentic) tier. Cookie-authed:
//   GET    → { exists, createdAt, lastUsedAt, mcpUrlTemplate }
//   POST   → mint/replace the key; returns { key, mcpUrl } — plaintext shown ONCE
//   DELETE → revoke
import { NextRequest, NextResponse } from "next/server";
import { currentAccountId } from "@/lib/account";
import { hasAgentToken, mintAgentToken, revokeAgentToken } from "@/lib/agent-token-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const base = (req: NextRequest) =>
  process.env.NEXT_PUBLIC_BASE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;

export async function GET(req: NextRequest) {
  const accountId = await currentAccountId();
  if (!accountId) return NextResponse.json({ error: "auth" }, { status: 401 });
  const info = await hasAgentToken(accountId);
  return NextResponse.json({ ...info, mcpUrlTemplate: `${base(req)}/api/mcp/<your-key>` });
}

export async function POST(req: NextRequest) {
  const accountId = await currentAccountId();
  if (!accountId) return NextResponse.json({ error: "auth" }, { status: 401 });
  const key = await mintAgentToken(accountId);
  if (!key) return NextResponse.json({ error: "storage unavailable" }, { status: 503 });
  return NextResponse.json({ key, mcpUrl: `${base(req)}/api/mcp/${key}` });
}

export async function DELETE() {
  const accountId = await currentAccountId();
  if (!accountId) return NextResponse.json({ error: "auth" }, { status: 401 });
  await revokeAgentToken(accountId);
  return NextResponse.json({ ok: true });
}
