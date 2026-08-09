// Sprinkler-head reference "database" — the field guide that powers BOTH the
// visual picker tiles in onboarding AND the AI photo scanner's prompt. One
// source of truth so the pictures the user sees and the categories the model
// returns can never drift apart.
//
// The engine only consumes the head CATEGORY (which sets precipInHr); it does
// not need the exact brand/SKU. So every common head collapses into one of the
// five HEAD_TYPES buckets. The `colors`/`examples` strings exist because real
// heads are color-coded (Hunter MP Rotators by radius, spray nozzles by arc),
// and those are strong tells for both a human and the vision model.

import { HEAD_TYPES, type HeadTypeId } from "@verdyn/core";

export interface HeadVisual {
  id: HeadTypeId;
  /** Realistic reference photo (public/heads/<id>.jpg) shown on the picker tile. */
  img: string;
  /** Short label under the picture. */
  short: string;
  /** The single most reliable visual tell. */
  cue: string;
  /** Color-coding hints (real, exploitable signal). */
  colors: string;
  /** Common brands/models a user might read off the cap. */
  examples: string;
  /** Human-readable precip, derived from HEAD_TYPES. */
  precipLabel: string;
}

const precip = (id: HeadTypeId) =>
  `~${HEAD_TYPES.find((h) => h.id === id)?.precipInHr ?? "?"} in/hr`;

// Order: most common residential first.
export const HEAD_VISUAL: HeadVisual[] = [
  {
    id: "spray",
    img: "/heads/spray.jpg",
    short: "Fixed spray",
    cue: "Pops up and throws a steady FAN of water — nothing moves or rotates.",
    colors: "Nozzle is often color-coded by arc (e.g. red 90°, green 180°, blue 360°).",
    examples: "Rain Bird 1800, Hunter Pro-Spray, Toro 570",
    precipLabel: precip("spray"),
  },
  {
    id: "mp_rotator",
    img: "/heads/mp_rotator.jpg",
    short: "MP Rotator",
    cue: "Several thin streams that slowly rotate like a spinning spider/octopus.",
    colors: "Hunter MP Rotator bodies are color-coded by radius: brown MP1000, olive/green MP2000, blue MP3000, red/black corner & strip.",
    examples: "Hunter MP Rotator, Rain Bird R-VAN (rotary nozzle)",
    precipLabel: precip("mp_rotator"),
  },
  {
    id: "rotor",
    img: "/heads/rotor.jpg",
    short: "Gear rotor",
    cue: "One single stream that sweeps slowly back and forth across the lawn.",
    colors: "Usually a tall black or grey pop-up body; nozzle tree often visible on top.",
    examples: "Hunter PGP / PGJ, Rain Bird 5000, Toro Super 700",
    precipLabel: precip("rotor"),
  },
  {
    id: "impact",
    img: "/heads/impact.jpg",
    short: "Impact",
    cue: "Metal head with a swinging spring arm that goes tick-tick-tick.",
    colors: "Brass or grey metal, exposed arm/spring; often on a riser or tripod.",
    examples: "Rain Bird 25/30 brass impact, Orbit brass impact",
    precipLabel: precip("impact"),
  },
  {
    id: "drip",
    img: "/heads/drip.jpg",
    short: "Drip / micro",
    cue: "Black poly tubing with small emitters or micro-sprays in beds — no lawn pop-up.",
    colors: "Black/brown 1/4\" or 1/2\" tubing; emitters color-coded by GPH (e.g. red 2gph).",
    examples: "Rain Bird / Netafim drip line, Orbit micro-spray",
    precipLabel: precip("drip"),
  },
];

export const headVisualById = (id: HeadTypeId | string): HeadVisual =>
  HEAD_VISUAL.find((h) => h.id === id) ?? HEAD_VISUAL[0];

/** The reference block injected into the vision model's system prompt. */
export function headReferencePrompt(): string {
  const lines = HEAD_VISUAL.map(
    (h) =>
      `- "${h.id}" (${h.short}, ${h.precipLabel}): ${h.cue} ${h.colors} Examples: ${h.examples}`,
  );
  return lines.join("\n");
}

export const HEAD_ID_LIST = HEAD_VISUAL.map((h) => h.id);
