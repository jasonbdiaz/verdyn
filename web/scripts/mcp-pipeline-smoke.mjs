// End-to-end smoke of the agent connection pipeline against PRODUCTION:
// account → profile → agent key → full MCP handshake (the same call sequence
// Claude/ChatGPT connectors make) → mutation round-trip → revoke → cleanup.
// Uses an obviously-fake account and deletes everything it created.
import { neon } from "@neondatabase/serverless";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")]),
);
const sql = neon(env.DATABASE_URL);
const BASE = "https://verdyn.app";
const EMAIL = "mcp-pipeline-smoke@example.com";

// 1. Account + minimal valid lawn profile (mirrors onboarding output).
await sql`DELETE FROM accounts WHERE email = ${EMAIL}`;
const [acct] = await sql`INSERT INTO accounts (email) VALUES (${EMAIL}) RETURNING id::text AS id`;
const accountId = acct.id;
const profile = {
  zip: "33196",
  soilTextureId: "sand",
  addressParity: "odd",
  establishmentStart: null,
  zones: [{
    id: "z1", name: "Front lawn", grassTypeId: "bermuda", headTypeId: "rotor",
    plantTypeId: "lawn", sun: "full_sun", slope: "flat", areaSqft: 1200, establishmentStart: null,
  }],
};
await sql`INSERT INTO home_profiles (account_id, profile, timezone)
          VALUES (${accountId}, ${JSON.stringify(profile)}, ${"America/New_York"})
          ON CONFLICT (account_id) DO UPDATE SET profile = EXCLUDED.profile`;

// 2. Mint the agent key exactly as lib/agent-token-store does.
const token = "vdk_" + randomBytes(24).toString("hex");
const hash = createHash("sha256").update(token).digest("hex");
await sql`INSERT INTO agent_tokens (account_id, token_hash) VALUES (${accountId}, ${hash})
          ON CONFLICT (account_id) DO UPDATE SET token_hash = EXCLUDED.token_hash`;

// 3. Full MCP handshake against prod, like a real connector.
const url = `${BASE}/api/mcp/${token}`;
let rpcId = 0;
async function rpc(method, params, expectResult = true) {
  const res = await fetch(url, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
  });
  const body = res.status === 202 ? null : await res.json();
  if (expectResult && (!body || body.error)) {
    throw new Error(`${method} failed: HTTP ${res.status} ${JSON.stringify(body?.error ?? body)}`);
  }
  return body?.result;
}

const init = await rpc("initialize", {
  protocolVersion: "2025-03-26",
  capabilities: {}, clientInfo: { name: "pipeline-smoke", version: "1.0" },
});
console.log("initialize:", init.serverInfo?.name, init.protocolVersion);
await fetch(url, { method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) });

const tools = await rpc("tools/list", {});
console.log("tools:", tools.tools.length, "-", tools.tools.map((t) => t.name).join(","));

const status = JSON.parse((await rpc("tools/call", { name: "get_status", arguments: {} })).content[0].text);
console.log("get_status zones:", status.profile?.zones?.length, "tier:", status.entitlement?.tier);

const plan = JSON.parse((await rpc("tools/call", { name: "get_daily_plan", arguments: {} })).content[0].text);
console.log("get_daily_plan: status =", plan.plan?.status ?? "n/a", "| cycles =", plan.plan?.cycles?.length ?? 0);

// Mutation round-trip: agent updates a zone, server validates + persists.
const upd = JSON.parse((await rpc("tools/call", {
  name: "update_zone", arguments: { zoneId: "z1", sun: "partial" },
})).content[0].text);
console.log("update_zone persisted sun =", upd.zone?.sun);
const [row] = await sql`SELECT profile->'zones'->0->>'sun' AS sun FROM home_profiles WHERE account_id = ${accountId}`;
console.log("db confirms sun =", row.sun);

// 4. Revoke → endpoint must go 401 immediately.
await sql`DELETE FROM agent_tokens WHERE account_id = ${accountId}`;
const after = await fetch(url, { method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 99, method: "tools/list" }) });
console.log("after revoke: HTTP", after.status);

// 5. Verify the no-storage claim at the data layer: the only agent artifact is
// the (now-deleted) hashed key row — no prompt/transcript tables exist at all.
const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1`;
console.log("tables:", tables.map((t) => t.table_name).join(","));

// 6. Cleanup.
await sql`DELETE FROM home_profiles WHERE account_id = ${accountId}`;
await sql`DELETE FROM entitlements WHERE account_id IN (SELECT id::text FROM accounts WHERE email = ${EMAIL})`.catch(() => {});
await sql`DELETE FROM accounts WHERE email = ${EMAIL}`;
console.log("cleanup done");
