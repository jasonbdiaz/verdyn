"use client";

// The few choices we collect BEFORE the account exists (who it's for, which
// system, expert mode). Persisted to localStorage so they survive the magic-link
// round-trip — the heavy setup (connect + zones + property) happens afterward on
// the authenticated /setup continuation.
export interface SetupIntent {
  audience: "homeowner" | "business";
  system: "bhyve" | "others";
  expert: boolean;
}

const KEY = "verdyn.setup_intent";

export function saveIntent(i: SetupIntent) {
  try {
    localStorage.setItem(KEY, JSON.stringify(i));
  } catch {
    /* private mode — non-fatal */
  }
}

export function loadIntent(): SetupIntent {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as SetupIntent;
  } catch {
    /* ignore */
  }
  // Sensible defaults if someone lands on /setup directly.
  return { audience: "homeowner", system: "bhyve", expert: false };
}

export function clearIntent() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
