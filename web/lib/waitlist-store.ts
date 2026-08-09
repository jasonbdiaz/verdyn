// Controller waitlist persistence — captures interest in a not-yet-supported
// brand (Rain Bird, Rachio, a hose-bib timer, …). No account required; these
// are anonymous prospects keyed by (email, brand). Degrades to a no-op without
// DATABASE_URL, like every other Verdyn store.
//
// No PII beyond an email is stored, and nothing is sent — this is a demand
// signal we'll act on when an integration ships.
import { db } from "./db";

/** Record a notify-me signup. Idempotent: a repeat (email, brand) is ignored.
 *  Returns false only when the DB is unreachable, so the UI can still ack. */
export async function addWaitlist(
  email: string,
  brandSlug: string,
  source: string,
): Promise<boolean> {
  const sql = db();
  if (!sql) return false;
  try {
    await sql`
      INSERT INTO controller_waitlist (email, brand_slug, source)
      VALUES (${email.toLowerCase()}, ${brandSlug}, ${source})
      ON CONFLICT (email, brand_slug) DO NOTHING
    `;
    return true;
  } catch (err) {
    console.warn("[verdyn] addWaitlist failed:", (err as Error).message);
    return false;
  }
}
