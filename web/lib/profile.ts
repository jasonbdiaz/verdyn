"use client";

import type { LawnProfile } from "@verdyn/core";

const KEY = "verdyn.profile";

export function saveProfile(p: LawnProfile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage may be unavailable (private mode) — non-fatal */
  }
}

export function loadProfile(): LawnProfile | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LawnProfile) : null;
  } catch {
    return null;
  }
}

export function clearProfile() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
