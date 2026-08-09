// The controller brand catalog — the single source of truth for which WiFi
// sprinkler controllers and hose-bib timers Verdyn lists, and which actually
// work today.
//
// This is PURE DATA (no node deps, no crypto) so it imports cleanly into both
// the Next.js web app and the Expo mobile bundle (Metro). The marketing site,
// both onboarding flows, and the waitlist API all read from this one array, so
// flipping a brand from `coming_soon` to `live` is a one-line change here.
//
// Today only B-hyve is `live`. Rain Bird groundwork exists (the provider
// abstraction + AES-SIP layer) but stays `coming_soon` until its separate
// cloud-relay gate passes. Everything else is an honest "coming soon" listing
// that captures interest via the notify-me waitlist.

import type { ControllerBrand } from "./types";

export type ControllerStatus = "live" | "beta" | "coming_soon";
export type ControllerCategory = "controller" | "hose_timer";

export interface ControllerBrandInfo {
  /** Stable id used in URLs, the waitlist table, and as a React key. */
  slug: string;
  /** Display name. */
  name: string;
  /** Smart timer/controller vs. a faucet/hose-bib timer. */
  category: ControllerCategory;
  status: ControllerStatus;
  /** Set ONLY when `status === "live"` — links the listing to a real provider
   *  (see coreProviders). A coming-soon brand has no provider yet. */
  provider?: ControllerBrand;
  /** One-line blurb for cards. */
  note?: string;
}

export const CONTROLLER_CATALOG: ControllerBrandInfo[] = [
  // ── Smart sprinkler controllers ───────────────────────────────────────────
  {
    slug: "bhyve",
    name: "Orbit B-hyve",
    category: "controller",
    status: "live",
    provider: "bhyve",
    note: "Fully automated today — connect and Verdyn runs your schedule.",
  },
  {
    slug: "rainbird",
    name: "Rain Bird",
    category: "controller",
    status: "coming_soon",
    note: "ESP-TM2 / ESP-ME3 with the LNK WiFi module.",
  },
  {
    slug: "rachio",
    name: "Rachio",
    category: "controller",
    status: "coming_soon",
    note: "Rachio 3 and Rachio smart controllers.",
  },
  {
    slug: "hunter-hydrawise",
    name: "Hunter Hydrawise",
    category: "controller",
    status: "coming_soon",
    note: "HC / HPC / Pro-HC Hydrawise controllers.",
  },
  {
    slug: "rainmachine",
    name: "RainMachine",
    category: "controller",
    status: "coming_soon",
    note: "Touch HD and Mini-8 controllers.",
  },
  {
    slug: "netro",
    name: "Netro",
    category: "controller",
    status: "coming_soon",
    note: "Netro Sprite and Spark controllers.",
  },
  {
    slug: "gardena-smart",
    name: "Gardena smart",
    category: "controller",
    status: "coming_soon",
    note: "Gardena smart Irrigation Control.",
  },
  {
    slug: "wyze-sprinkler",
    name: "Wyze Sprinkler",
    category: "controller",
    status: "coming_soon",
    note: "Wyze Sprinkler Controller.",
  },
  {
    slug: "moen-smart-sprinkler",
    name: "Moen Smart Sprinkler",
    category: "controller",
    status: "coming_soon",
    // 16-zone WiFi controller driven by the Moen Smart Water App (cloud), so it's
    // cloud-reachable like B-hyve. No public API yet — would need the app's API.
    note: "Moen 16-zone WiFi smart sprinkler controller.",
  },

  // ── Hose-bib / faucet timers ──────────────────────────────────────────────
  {
    slug: "bhyve-hose",
    name: "Orbit B-hyve hose timer",
    category: "hose_timer",
    status: "live",
    provider: "bhyve",
    // Same Orbit account + API as the B-hyve controller, and proven in production
    // against a real hose timer — connect and Verdyn runs your schedule.
    note: "Faucet-mounted B-hyve timers — fully automated today.",
  },
  {
    slug: "rachio-hose",
    name: "Rachio Smart Hose Timer",
    category: "hose_timer",
    status: "coming_soon",
    note: "Rachio's faucet timer.",
  },
  {
    slug: "gardena-water-control",
    name: "Gardena Water Control",
    category: "hose_timer",
    status: "coming_soon",
    note: "Gardena smart faucet timer.",
  },
  {
    slug: "eve-aqua",
    name: "Eve Aqua",
    category: "hose_timer",
    status: "coming_soon",
    note: "HomeKit faucet timer.",
  },
  {
    slug: "melnor-raincloud",
    name: "Melnor RainCloud",
    category: "hose_timer",
    status: "coming_soon",
    note: "Melnor WiFi AquaTimer.",
  },
  {
    slug: "netro-pixie",
    name: "Netro Pixie",
    category: "hose_timer",
    status: "coming_soon",
    note: "Netro's battery faucet timer.",
  },
  {
    slug: "rainpoint",
    name: "RainPoint",
    category: "hose_timer",
    status: "coming_soon",
    note: "RainPoint WiFi water timers.",
  },
  {
    slug: "govee",
    name: "GoveeLife Smart Water Timer",
    category: "hose_timer",
    status: "coming_soon",
    // Gateway → Govee cloud (Platform API v2), so it's cloud-reachable like
    // B-hyve — a friendly architecture once the valve capability is confirmed.
    note: "WiFi hose-faucet timer via the Govee gateway.",
  },
  {
    slug: "husky-hubspace",
    name: "Husky Smart Watering Timer",
    category: "hose_timer",
    status: "coming_soon",
    // Home Depot's "Powered by Hubspace" (Afero) platform. Dual-spigot, with an
    // included WiFi gateway → Hubspace cloud, so it's cloud-reachable like B-hyve.
    // Only an unofficial/reverse-engineered API (account-credential auth), but the
    // community HA integration already exposes a Water Valve class — feasible.
    note: "Home Depot Hubspace dual-spigot faucet timer.",
  },
  {
    slug: "raindrip",
    name: "Raindrip Smart Water Timer",
    category: "hose_timer",
    status: "coming_soon",
    // Raindrip is an Orbit brand (same parent as B-hyve). Hose-end timer + WiFi
    // gateway, app-enabled (cloud) — promising, possibly B-hyve-adjacent infra.
    note: "Orbit-family hose-end timer with WiFi gateway.",
  },
];

/** Brands that work today (have a real provider). */
export const liveBrands = (): ControllerBrandInfo[] =>
  CONTROLLER_CATALOG.filter((b) => b.status === "live");

/** Look up a catalog entry by slug. */
export const brandBySlug = (slug: string): ControllerBrandInfo | undefined =>
  CONTROLLER_CATALOG.find((b) => b.slug === slug);
