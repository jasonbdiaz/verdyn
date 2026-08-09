// Magic-link auth. We issue a single-use, short-lived token, email a link, and
// on click mint an account session. Only a SHA-256 hash of the token is stored,
// so a leaked DB row can't be replayed into a login. No-ops gracefully when
// DATABASE_URL is unset (returns null → caller treats as "couldn't issue").
import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";
import { getOrCreateAccount } from "./entitlement-store";

const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

const hash = (token: string): string => createHash("sha256").update(token).digest("hex");

/**
 * Create a magic-link token for `email` and return the absolute verify URL.
 * Returns null if persistence is unavailable (no DB).
 */
export async function issueMagicLink(email: string, origin: string): Promise<string | null> {
  const sql = db();
  if (!sql) return null;
  const e = email.trim().toLowerCase();
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  try {
    await sql`
      INSERT INTO auth_tokens (token_hash, email, expires_at)
      VALUES (${hash(token)}, ${e}, ${expires})
    `;
  } catch (err) {
    console.warn("[verdyn] issueMagicLink failed:", (err as Error).message);
    return null;
  }
  return `${origin}/api/auth/verify?token=${token}`;
}

/**
 * Consume a magic-link token: validate it's unused + unexpired, mark it used,
 * and return the account id + verified email (creating the account on first
 * login). Returns null for any invalid/expired/used token. The email is returned
 * so callers can apply per-email policy (e.g. owner comp accounts).
 */
export async function verifyMagicLink(
  token: unknown,
): Promise<{ accountId: string; email: string } | null> {
  const sql = db();
  if (!sql || typeof token !== "string" || token.length < 16 || token.length > 200) return null;
  try {
    // Atomic single-use: only succeeds if the token is unused and unexpired.
    const rows = (await sql`
      UPDATE auth_tokens SET used_at = now()
      WHERE token_hash = ${hash(token)} AND used_at IS NULL AND expires_at > now()
      RETURNING email
    `) as { email: string }[];
    const email = rows[0]?.email;
    if (!email) return null;
    const accountId = await getOrCreateAccount(email);
    return accountId ? { accountId, email } : null;
  } catch (err) {
    console.warn("[verdyn] verifyMagicLink failed:", (err as Error).message);
    return null;
  }
}
