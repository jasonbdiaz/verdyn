// Authenticated encryption for the B-hyve session cookie.
//
// The cookie holds an Orbit `orbit_api_key` — a bearer credential to the user's
// irrigation controller. httpOnly+secure keeps it out of JS, but we also seal it
// at rest with AES-256-GCM so a leaked cookie store / log line / backup never
// yields a usable token without the server secret.
//
// Set VERDYN_SESSION_SECRET (>= 32 random chars) in production. If absent, we
// fall back to an ephemeral per-process key and warn — tokens then don't survive
// a restart, which is safe-by-default rather than silently insecure.

import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

const ALG = "aes-256-gcm";

let warned = false;
function key(): Buffer {
  const secret = process.env.VERDYN_SESSION_SECRET;
  if (secret && secret.length >= 32) {
    // Normalize any-length secret to a 32-byte key.
    return createHash("sha256").update(secret).digest();
  }
  if (!warned) {
    warned = true;
    console.warn(
      "[verdyn] VERDYN_SESSION_SECRET is unset or too short — using an ephemeral " +
        "key. Sessions will not survive a restart. Set a 32+ char secret in production.",
    );
  }
  return EPHEMERAL;
}
const EPHEMERAL = randomBytes(32);

/** Encrypt + authenticate an arbitrary JSON-serializable value (AES-256-GCM). */
export function sealObject(data: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALG, key(), iv);
  const pt = Buffer.from(JSON.stringify(data), "utf8");
  const ct = Buffer.concat([cipher.update(pt), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64url");
}

/** Decrypt + verify. Returns null on any tampering, truncation, or wrong key. */
export function unsealObject<T = unknown>(blob: string | undefined): T | null {
  if (!blob) return null;
  try {
    const raw = Buffer.from(blob, "base64url");
    if (raw.length < 28) return null; // 12 iv + 16 tag minimum
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ct = raw.subarray(28);
    const decipher = createDecipheriv(ALG, key(), iv);
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return JSON.parse(pt.toString("utf8")) as T;
  } catch {
    return null; // auth tag mismatch / malformed — treat as no session
  }
}

export interface BhyveSessionData {
  token: string;
  userId: string;
}

/** Encrypt + authenticate a B-hyve session into a compact base64url string. */
export function seal(data: BhyveSessionData): string {
  return sealObject(data);
}

/** Decrypt + verify a B-hyve session. Returns null on tampering or wrong shape. */
export function unseal(blob: string | undefined): BhyveSessionData | null {
  const obj = unsealObject<Partial<BhyveSessionData>>(blob);
  if (obj && typeof obj.token === "string" && typeof obj.userId === "string") {
    return { token: obj.token, userId: obj.userId };
  }
  return null;
}

export const SESSION_COOKIE = "verdyn_bhyve";
export const ACCOUNT_COOKIE = "verdyn_acct";
