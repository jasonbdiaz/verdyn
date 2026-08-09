// Per-account agent keys for the MCP (agentic) tier. The key appears in the
// MCP URL a user pastes into Claude / ChatGPT as a custom connector, so it is
// treated like a password: only the SHA-256 hash is stored, the plaintext is
// shown once at mint time, and re-minting revokes the old key.
//
// Key format: "vdk_" + 48 hex chars (24 random bytes).

import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";

async function ensureTable() {
  const sql = db();
  if (!sql) return null;
  await sql`
    CREATE TABLE IF NOT EXISTS agent_tokens (
      account_id TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_used_at TIMESTAMPTZ
    )`;
  return sql;
}

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** Mint (or replace) the account's agent key. Returns the plaintext ONCE. */
export async function mintAgentToken(accountId: string): Promise<string | null> {
  const sql = await ensureTable();
  if (!sql) return null;
  const token = "vdk_" + randomBytes(24).toString("hex");
  await sql`
    INSERT INTO agent_tokens (account_id, token_hash) VALUES (${accountId}, ${hash(token)})
    ON CONFLICT (account_id) DO UPDATE SET token_hash = EXCLUDED.token_hash,
      created_at = now(), last_used_at = NULL`;
  return token;
}

/** Resolve a presented key to its account id (and touch last_used_at). */
export async function accountForAgentToken(token: string): Promise<string | null> {
  if (!/^vdk_[0-9a-f]{48}$/.test(token)) return null;
  const sql = await ensureTable();
  if (!sql) return null;
  const rows = await sql`
    UPDATE agent_tokens SET last_used_at = now()
    WHERE token_hash = ${hash(token)} RETURNING account_id`;
  return rows.length ? String(rows[0].account_id) : null;
}

export async function hasAgentToken(accountId: string): Promise<{ exists: boolean; createdAt?: string; lastUsedAt?: string | null }> {
  const sql = await ensureTable();
  if (!sql) return { exists: false };
  const rows = await sql`
    SELECT created_at, last_used_at FROM agent_tokens WHERE account_id = ${accountId}`;
  if (!rows.length) return { exists: false };
  return {
    exists: true,
    createdAt: String(rows[0].created_at),
    lastUsedAt: rows[0].last_used_at ? String(rows[0].last_used_at) : null,
  };
}

export async function revokeAgentToken(accountId: string): Promise<void> {
  const sql = await ensureTable();
  if (!sql) return;
  await sql`DELETE FROM agent_tokens WHERE account_id = ${accountId}`;
}
