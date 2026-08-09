// Deterministic ZIP -> {city, state} lookup via Zippopotam (free, no key).
// Server-side only. Used to anchor the AI county/restriction research so the
// model isn't guessing the location from the ZIP alone.

export interface ZipPlace {
  city: string;
  state: string; // 2-letter
}

export async function placeForZip(zip: string): Promise<ZipPlace | null> {
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${encodeURIComponent(zip)}`, {
      // Cache aggressively — ZIP→place is effectively static.
      next: { revalidate: 60 * 60 * 24 * 30 },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      places?: { "place name"?: string; "state abbreviation"?: string }[];
    };
    const p = j.places?.[0];
    if (!p) return null;
    return {
      city: p["place name"] ?? "",
      state: p["state abbreviation"] ?? "",
    };
  } catch {
    return null; // any failure → caller proceeds without the anchor
  }
}
