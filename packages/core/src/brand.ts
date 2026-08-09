// Verdyn design tokens — single source of truth for web + mobile.
// See BRAND.md for usage rules.

export const colors = {
  green: "#0E7C5A", // primary
  sprout: "#8BE04A", // accent
  pine: "#08231B", // ink
  tide: "#16B6C4", // water / info
  mist: "#F4FAF6", // surface
  cloud: "#FFFFFF", // card
  clay: "#E8A13A", // warn / adjusted
  ember: "#E5544B", // alert / skip
  // dark mode
  darkInk: "#E8F3ED",
  darkSurface: "#08231B",
  darkCard: "#0F3329",
} as const;

export const gradient = {
  brand: ["#0E7C5A", "#8BE04A"] as const, // 135deg
  brandCss: "linear-gradient(135deg, #0E7C5A 0%, #8BE04A 100%)",
};

export const font = {
  display: "'Space Grotesk', 'Segoe UI', system-ui, sans-serif",
  body: "'Inter', system-ui, -apple-system, sans-serif",
};

export const brand = {
  name: "Verdyn",
  tagline: "Water like a pro.",
  oneLiner: "Pro-grade irrigation intelligence for any B-hyve.",
  domain: "verdyn.com",
  legal:
    "Verdyn is an independent product and is not affiliated with, endorsed by, " +
    "or sponsored by Orbit Irrigation Products, LLC. B-hyve® is a registered " +
    "trademark of Orbit.",
} as const;

// status → color, shared semantics across surfaces
export const statusColor = {
  scheduled: colors.green,
  adjusted: colors.clay,
  skipped: colors.ember,
  mow_day: colors.tide,
  rest: "#9CB4A8",
} as const;
