// Calls to the Verdyn web API for the few things mobile can't do on-device.
// The app is mostly self-contained (the B-hyve client runs locally, the engine
// is in @verdyn/core), so this is only for shared server state like the
// controller waitlist. Override the base with EXPO_PUBLIC_API_BASE in dev.
export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE?.replace(/\/$/, "") || "https://verdyn-web.vercel.app";

/** Record a "notify me when {brand} is live" signup. Fails soft (returns false)
 *  so the UI can still acknowledge if the network is unavailable. */
export async function postWaitlist(email: string, brandSlug: string): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/api/waitlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, brandSlug, source: "mobile" }),
    });
    return r.ok;
  } catch {
    return false;
  }
}
