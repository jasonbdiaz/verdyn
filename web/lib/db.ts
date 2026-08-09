// Neon Postgres access for Verdyn.
//
// The whole app is designed to run WITHOUT a database — every caller treats a
// null `sql` as "no cache, no persistence" and falls back to the deterministic
// engine. Set DATABASE_URL (a Neon pooled connection string) to enable the
// local-restriction cache + RAG corpus.
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let _sql: NeonQueryFunction<false, false> | null | undefined;

export function db(): NeonQueryFunction<false, false> | null {
  if (_sql !== undefined) return _sql;
  const url = process.env.DATABASE_URL;
  _sql = url ? neon(url) : null;
  if (!url) {
    // Surfaced once at cold start; not an error — the app degrades gracefully.
    console.warn("[verdyn] DATABASE_URL not set — local-restriction cache disabled.");
  }
  return _sql;
}

export const dbEnabled = (): boolean => Boolean(process.env.DATABASE_URL);
