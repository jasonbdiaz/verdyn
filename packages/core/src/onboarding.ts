// Declarative onboarding schema. Web and iOS both render from this so the
// flow stays identical. Steps gated by `expertOnly` appear only in expert mode.

import { GRASS_TYPES, SOIL_TYPES, HEAD_TYPES, PLANT_TYPES } from "./agronomy";
import type { LawnProfile, ZoneProfile } from "./types";

export type StepKind = "audience" | "intro" | "connect" | "zip" | "soil" | "address_parity"
  | "establishment" | "zone_plant_type" | "zones" | "expert_zone_detail" | "review";

export interface OnboardingStep {
  id: StepKind;
  title: string;
  subtitle: string;
  expertOnly?: boolean;
  /** For single-choice steps. */
  options?: { value: string; label: string; note?: string }[];
  help?: string;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "audience",
    title: "First — who's this for?",
    subtitle:
      "Verdyn works for a single home or for a lawn-care business managing many properties.",
    options: [
      { value: "homeowner", label: "My own lawn", note: "Smart watering for your home." },
      { value: "business", label: "I run a lawn-care business", note: "Manage every client address from one Pro dashboard." },
    ],
  },
  {
    id: "intro",
    title: "Let's make your B-hyve smarter",
    subtitle:
      "Answer a few questions about your lawn. Verdyn builds a pro-grade watering plan and runs it on your existing controller — automatically.",
  },
  {
    id: "connect",
    title: "Connect your B-hyve",
    subtitle:
      "Sign in with your Orbit B-hyve account so Verdyn can read your zones and run cycles. Your credentials are encrypted and never shared.",
    help: "We use the same account you use in the B-hyve app. You can disconnect anytime.",
  },
  {
    id: "zip",
    title: "Where's your lawn?",
    subtitle: "Your ZIP code sets the climate, seasonal water demand, and local watering rules.",
  },
  {
    id: "soil",
    title: "What's your soil like?",
    subtitle: "Soil controls how fast water soaks in. Not sure? Pick the closest — you can refine later.",
    options: SOIL_TYPES.map((s) => ({ value: s.id, label: s.name, note: s.note })),
    help: "Quick test: squeeze damp soil. Crumbles = sandy. Ribbons and holds shape = clay.",
  },
  {
    id: "address_parity",
    title: "Odd or even address?",
    subtitle: "Many cities assign watering days by address number. We'll match your allowed days automatically.",
    options: [
      { value: "odd", label: "Odd (1, 3, 5, 7, 9)" },
      { value: "even", label: "Even (0, 2, 4, 6, 8)" },
    ],
  },
  {
    id: "establishment",
    title: "New grass?",
    subtitle: "Newly seeded or sodded lawns need daily light watering — and usually get an exemption from restrictions.",
    options: [
      { value: "no", label: "Established lawn", note: "Deep, infrequent, conservation-smart watering." },
      { value: "yes", label: "New sod or seed", note: "We'll run the establishment protocol and taper to deep watering." },
    ],
  },
  {
    id: "zone_plant_type",
    title: "Your zones",
    subtitle: "Set how many zones you have, what grows in each, and which sprinkler head it uses — match the photo or scan it. Each zone gets its own water need, root depth, and cycle logic.",
    options: PLANT_TYPES.map((p) => ({ value: p.id, label: p.name, note: p.note })),
    help: "Mixing turf and beds on one controller is normal — Verdyn schedules each zone for what actually grows there.",
  },
  {
    id: "zones",
    title: "Which grass?",
    subtitle: "For your lawn zones, tell us the grass type. (Bed and garden zones skip this.)",
    options: GRASS_TYPES.map((g) => ({ value: g.id, label: g.name, note: g.note })),
  },
  {
    id: "expert_zone_detail",
    title: "Fine-tune each zone",
    subtitle: "Sprinkler type, sun, and slope let Verdyn nail the runtime math and cycle-and-soak.",
    expertOnly: true,
    options: HEAD_TYPES.map((h) => ({ value: h.id, label: h.name, note: h.note })),
    help: "Know your exact precipitation rate from a catch-cup test? Enter it to override our estimate.",
  },
  {
    id: "review",
    title: "Here's your plan",
    subtitle: "This is what Verdyn will run. You can tweak anything, anytime.",
  },
];

export const stepsFor = (expert: boolean) =>
  ONBOARDING_STEPS.filter((s) => !s.expertOnly || expert);

/** A blank profile to accumulate answers into during onboarding. */
export function emptyProfile(): LawnProfile {
  return {
    id: cryptoId(),
    createdAt: new Date().toISOString(),
    zip: "",
    climateZoneId: "",
    soilTextureId: "loam",
    addressParity: "odd",
    zones: [],
    establishmentStart: null,
    expertMode: false,
    tier: "weather",
    subscriptionStatus: "active",
    canceledAt: null,
    localRestriction: null,
  };
}

export function defaultZone(name: string, station: number, deviceId?: string): ZoneProfile {
  return {
    id: `zone_${station}`,
    name,
    bhyveDeviceId: deviceId,
    bhyveStation: station,
    plantTypeId: "lawn",
    grassTypeId: "bermuda",
    headTypeId: "mp_rotator",
    sun: "full_sun",
    slope: "flat",
  };
}

function cryptoId(): string {
  // Works in browser, RN, and node 19+.
  try {
    // @ts-ignore
    return (globalThis.crypto?.randomUUID?.() as string) ?? fallback();
  } catch { return fallback(); }
  function fallback() { return "p_" + Math.random().toString(36).slice(2, 11); }
}
