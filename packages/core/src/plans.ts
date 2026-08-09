// Verdyn subscription tiers — single source of truth for web + iOS.
//
// Pricing is annual-first (annual is the promoted price; monthly exists but
// churns harder). Capability gating keys off `caps`, never the price.
//
// New accounts get a permanent Expert (or Pro, for business) entitlement on first
// sign-in — there is no permanent free tier; an account with no active or
// sign-in. There is no payment rail — Verdyn is open source; the hosted
// managed tier is arranged directly, not via checkout.
//
// Residential:
//   weather: full ET/weather scheduling + built-in coarse
//            local-restriction table (deterministic safety baseline).
//   expert (default hosted tier): everything in weather, plus AI-researched,
//            county-specific restrictions (RAG-stored), per-zone tuning,
//            manual overrides, and water-savings reporting.
// Business:
//   pro: banded base-fee + property-block model (see PRO_BANDS). The `pro`
//        capability tier is shared by every band; the band only sets the
//        property limit (carried per-entitlement so a Stripe/Apple webhook can
//        set the purchased limit).

import type { PlanTier } from "./types";

export interface Plan {
  id: PlanTier;
  name: string;
  /** Promoted monthly price (USD). */
  priceMonthly: number;
  /** Annual total (USD) — the promoted price; ~2 months free vs monthly. */
  priceAnnual: number;
  priceLabel: string;
  tagline: string;
  features: string[];
  /** Capabilities this tier unlocks — gate features off these, not the price. */
  caps: {
    /** Smart ET/weather + plant-and-grass-type programs + the cycle suite.
     *  FREE — this is the always-on "make any B-hyve smarter" engine. */
    weatherScheduling: boolean;
    builtinRestrictions: boolean;
    aiLocalRestrictions: boolean;
    perZoneTuning: boolean;
    manualOverrides: boolean;
    /** Hands-off automation: Verdyn writes & runs the schedule on the controller
     *  for you (the paid "Autopilot"). Free shows the smart plan; paid runs it. */
    aiAutopilot: boolean;
    /** Mow-day check-ins via in-app push (skip/syringe around mowing). */
    mowCheckIns: boolean;
    /** Submit a lawn photo for AI diagnosis & watering/care recommendations. */
    photoRecommendations: boolean;
    /** Manage more than one address (the Pro/business multi-property module). */
    multiProperty: boolean;
    /** Client-facing water-savings & compliance reporting. */
    savingsReporting: boolean;
    /** Default max properties for the tier; a Pro band overrides this per-account. */
    propertyLimit: number;
  };
}

export const PLANS: Record<PlanTier, Plan> = {
  weather: {
    id: "weather",
    name: "Free",
    priceMonthly: 0,
    priceAnnual: 0,
    priceLabel: "Free",
    tagline: "Make any B-hyve smarter — free, forever.",
    features: [
      "AI watering tuned to your grass & plant type",
      "Full watering-cycle suite (soak, pulse, establishment)",
      "Seasonal ET from your local weather station",
      "Rain, wind & forecast skips",
      "Cycle-and-soak matched to your soil",
      "Built-in regional watering-day safety rules",
    ],
    caps: {
      weatherScheduling: true,
      builtinRestrictions: true,
      aiLocalRestrictions: false,
      perZoneTuning: false,
      manualOverrides: false,
      aiAutopilot: false,
      mowCheckIns: false,
      photoRecommendations: false,
      multiProperty: false,
      savingsReporting: false,
      propertyLimit: 1,
    },
  },
  expert: {
    id: "expert",
    name: "Autopilot",
    priceMonthly: 0,
    priceAnnual: 0,
    priceLabel: "free (hosted)",
    tagline: "Truly hands-off. AI runs your yard — and makes it look better.",
    features: [
      "Everything in Free",
      "Full Autopilot — Verdyn writes & runs the schedule for you",
      "AI local water-restriction compliance for your exact county",
      "Maximum water savings — fine-tuned by your real head types",
      "Mow-day check-ins via push notifications",
      "Photo submission for AI lawn diagnosis & care tips",
      "Per-zone head, sun & slope tuning + manual overrides",
    ],
    caps: {
      weatherScheduling: true,
      builtinRestrictions: true,
      aiLocalRestrictions: true,
      perZoneTuning: true,
      manualOverrides: true,
      aiAutopilot: true,
      mowCheckIns: true,
      photoRecommendations: true,
      multiProperty: false,
      savingsReporting: true,
      propertyLimit: 1,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    // Entry band (Starter). Higher bands override propertyLimit per-entitlement;
    // see PRO_BANDS for the full base-fee + property-block ladder.
    priceMonthly: 0,
    priceAnnual: 0,
    priceLabel: "managed — contact us",
    tagline: "Sell smarter service. AI-tuned watering that takes the guesswork out — for you and your clients.",
    features: [
      "Everything in Autopilot, on every property",
      "AI-tuned watering programs you can sell as your own service",
      "Multi-property dashboard with per-address compliance",
      "Automatic per-city / per-county restriction compliance",
      "Client-facing water-savings reports that win & keep accounts",
      "AI watering adjustments across your whole book of business",
    ],
    caps: {
      weatherScheduling: true,
      builtinRestrictions: true,
      aiLocalRestrictions: true,
      perZoneTuning: true,
      manualOverrides: true,
      aiAutopilot: true,
      mowCheckIns: true,
      photoRecommendations: true,
      multiProperty: true,
      savingsReporting: true,
      propertyLimit: 10,
    },
  },
};


/**
 * Pro pricing ladder: a base platform fee that includes a block of properties.
 * Every band is the `pro` capability tier; only `propertyLimit` differs, and it
 * is stored on the entitlement so billing webhooks set the purchased limit.
 * Property limits describe scale bands for multi-property operators — easy to pass
 * through to clients, structured so ARPU scales with book size.
 */
export interface ProBand {
  id: "pro_starter" | "pro_growth" | "pro_scale" | "pro_enterprise";
  name: string;
  /** null = "Custom" (Enterprise / contact sales). */
  priceMonthly: number | null;
  priceAnnual: number | null;
  propertyLimit: number;
  featured?: boolean;
}

export const PRO_BANDS: ProBand[] = [
  { id: "pro_starter", name: "Starter", priceMonthly: 0, priceAnnual: 0, propertyLimit: 10 },
  { id: "pro_growth", name: "Growth", priceMonthly: 0, priceAnnual: 0, propertyLimit: 50, featured: true },
  { id: "pro_scale", name: "Scale", priceMonthly: 0, priceAnnual: 0, propertyLimit: 200 },
  { id: "pro_enterprise", name: "Enterprise", priceMonthly: null, priceAnnual: null, propertyLimit: 100000 },
];

/** The Pro band that grants at least `count` properties (for upgrade prompts). */
export function proBandForCount(count: number): ProBand {
  return PRO_BANDS.find((b) => count <= b.propertyLimit) ?? PRO_BANDS[PRO_BANDS.length - 1];
}

/** Monthly-equivalent of an annual price, and the % saved vs paying monthly. */
export function annualSavingsPct(plan: Pick<Plan, "priceMonthly" | "priceAnnual">): number {
  if (!plan.priceMonthly || !plan.priceAnnual) return 0;
  return Math.round((1 - plan.priceAnnual / (plan.priceMonthly * 12)) * 100);
}

export const DEFAULT_TIER: PlanTier = "weather";

/** Normalize an unknown/legacy tier value to a valid tier. */
export function normalizeTier(t: unknown): PlanTier {
  return t === "pro" ? "pro" : t === "expert" ? "expert" : "weather";
}

export function planFor(tier: PlanTier | undefined): Plan {
  return PLANS[normalizeTier(tier)];
}

/** True when the tier unlocks Expert-grade capabilities (AI restrictions, etc.).
 *  Pro is a superset of Expert, so it qualifies too. */
export function isExpertTier(tier: PlanTier | undefined): boolean {
  const t = normalizeTier(tier);
  return t === "expert" || t === "pro";
}

/** True for the Pro (business / multi-property) tier specifically. */
export function isProTier(tier: PlanTier | undefined): boolean {
  return normalizeTier(tier) === "pro";
}
