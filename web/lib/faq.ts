// FAQ content — single source for both the rendered page and the FAQPage
// JSON-LD structured data. Answers are written to be quotable verbatim by
// answer engines (Google AI Overviews, ChatGPT, Perplexity), so each one leads
// with the direct answer in the first sentence.
//
// Facts verified June 2026 against Orbit B-hyve product pages and support docs.

export interface FaqItem {
  q: string;
  a: string; // plain text (also used for JSON-LD) — keep self-contained
  category: FaqCategory;
}

export type FaqCategory =
  | "Compatibility"
  | "Getting started"
  | "How it works"
  | "Billing & cancellation"
  | "Privacy & security";

export const FAQ_CATEGORIES: FaqCategory[] = [
  "Compatibility",
  "Getting started",
  "How it works",
  "Billing & cancellation",
  "Privacy & security",
];

export const FAQS: FaqItem[] = [
  // ── Compatibility ──────────────────────────────────────────────
  {
    category: "Compatibility",
    q: "Which Orbit B-hyve devices does Verdyn work with?",
    a:
      "Verdyn works with any Wi-Fi–connected Orbit B-hyve controller that appears in the B-hyve app. That includes the B-hyve Smart Indoor/Outdoor sprinkler timers (4, 6, 8, 12, and 16-zone models), the B-hyve XR Smart Indoor/Outdoor timers (4, 8, and 16-zone), B-hyve Pro contractor controllers, and B-hyve XD hose/faucet timers when they are paired with a B-hyve Gen 2 Wi-Fi Hub. If you can see and control the device in the B-hyve app, Verdyn can run it.",
  },
  {
    category: "Compatibility",
    q: "What is the maximum number of sprinkler zones Verdyn can control?",
    a:
      "Verdyn can control up to 16 zones on a single B-hyve controller — the 16-zone B-hyve XR (model 57995) is the largest residential unit Orbit makes. There is no limit beyond the hardware: Orbit lets you add multiple controllers to one B-hyve account, and Verdyn reads and schedules every zone across all of them. So a property with two 16-zone controllers can run 32 zones through Verdyn, and so on.",
  },
  {
    category: "Compatibility",
    q: "Does Verdyn work with Rachio, Rain Bird, Hunter, or Hydrawise?",
    a:
      "No. Verdyn currently works only with Orbit B-hyve controllers. Rachio, Rain Bird, Hunter, and Hydrawise each use their own separate, incompatible cloud APIs, so they cannot be controlled through Verdyn today. Support for additional brands is on our roadmap but not available yet. If you own one of these systems, Verdyn is not the right fit right now.",
  },
  {
    category: "Compatibility",
    q: "Do I need a Wi-Fi connection or a hub?",
    a:
      "Yes — Verdyn controls your system through the Orbit B-hyve cloud, so your controller must be connected to Wi-Fi. The B-hyve XR and Smart Indoor/Outdoor timers have Wi-Fi built in. Bluetooth-only devices, such as a B-hyve XD hose timer without a hub, cannot be controlled remotely; pairing them with a B-hyve Gen 2 Wi-Fi Hub adds the cloud connection Verdyn needs.",
  },
  {
    category: "Compatibility",
    q: "Do I need to buy new hardware to use Verdyn?",
    a:
      "No. Verdyn is software that runs on the B-hyve controller you already own. There is no Verdyn hardware to buy or install. You connect your existing B-hyve account, and Verdyn writes a smarter schedule to your current controller.",
  },
  // ── Getting started ────────────────────────────────────────────
  {
    category: "Getting started",
    q: "How do I set up Verdyn?",
    a:
      "Setup takes about two minutes. You connect your Orbit B-hyve account so Verdyn can read your zones, then answer a short onboarding flow: your ZIP code, soil type, grass type per zone, and whether the lawn is newly sodded. Verdyn immediately builds a daily watering plan and can run it on your controller automatically.",
  },
  {
    category: "Getting started",
    q: "What is Expert mode?",
    a:
      "Expert mode adds per-zone tuning for sprinkler head type, sun exposure, and slope, plus an optional measured precipitation rate from a catch-cup test. This lets Verdyn calculate exact runtimes and cycle-and-soak passes. Basic mode uses smart agronomic defaults and is enough for most lawns; you can switch to Expert anytime.",
  },
  // ── How it works ───────────────────────────────────────────────
  {
    category: "How it works",
    q: "How does Verdyn decide how much to water?",
    a:
      "Verdyn calculates a weekly water target from your grass type and your local seasonal evapotranspiration (ET), then splits it across your allowed watering days. Each day it adjusts for live weather — skipping after rain or in high wind, trimming after light rain, and adding time in extreme heat. On slow-draining soils it splits runs into cycle-and-soak passes so water reaches the roots instead of running off.",
  },
  {
    category: "How it works",
    q: "What is cycle-and-soak and why does it matter?",
    a:
      "Cycle-and-soak splits a single watering into multiple shorter passes with soak time between them. It matters because soils like clay can only absorb water so fast; watering past that rate causes runoff and waste. Verdyn automatically splits a run into up to four passes, sized to your soil's infiltration rate and slope, so every drop soaks in.",
  },
  {
    category: "How it works",
    q: "Does Verdyn follow local watering restrictions?",
    a:
      "Yes. Verdyn detects your area's watering rules from your ZIP code — allowed watering days by address (odd/even) and any daytime watering ban — and schedules around them. It also applies the new-landscaping establishment exemption: newly sodded or seeded lawns that need daily light watering are watered daily during the exemption window your jurisdiction allows.",
  },
  {
    category: "How it works",
    q: "Will Verdyn override my own B-hyve schedules?",
    a:
      "Verdyn manages the watering for the zones you set up with it, writing its smart schedule to your controller. Your manual runs and rain-delay controls in the B-hyve app still work. If you cancel Verdyn, it stops any running cycle and hands full control back to your B-hyve app.",
  },
  // ── Billing & cancellation ─────────────────────────────────────
  {
    category: "Billing & cancellation",
    q: "What happens when I cancel Verdyn?",
    a:
      "When you cancel, Verdyn immediately stops all automated watering it controls, stops any cycle currently running, and revokes its own access to your B-hyve account so it can no longer send commands to your controller. Your controller and your B-hyve app are unaffected and remain fully yours — you simply return to running it manually. You can reconnect and resume Verdyn anytime.",
  },
  {
    category: "Billing & cancellation",
    q: "Will my sprinklers keep running on Verdyn's schedule after I cancel?",
    a:
      "No. Cancelling severs Verdyn's connection to your controller, so it cannot push any further schedules or runs. Verdyn also turns off any cycle that is active at the moment you cancel. After that, only your own B-hyve programming applies.",
  },
  // ── Privacy & security ─────────────────────────────────────────
  {
    category: "Privacy & security",
    q: "Is my B-hyve password safe with Verdyn?",
    a:
      "Yes. Verdyn uses your B-hyve email and password only once, to obtain a secure session token from Orbit, and then discards the password — it is never logged, stored, or shared. The session token is encrypted at rest. You can disconnect Verdyn at any time, which deletes the stored token.",
  },
  {
    category: "Privacy & security",
    q: "What personal data does Verdyn store?",
    a:
      "Verdyn stores only what it needs to water your lawn: your ZIP code, soil type, grass types, and zone settings. It does not store your street address or your B-hyve password. Your lawn profile contains no payment details or precise location.",
  },
  {
    category: "Privacy & security",
    q: "Is Verdyn affiliated with Orbit or B-hyve?",
    a:
      "No. Verdyn is an independent product and is not affiliated with, endorsed by, or sponsored by Orbit Irrigation Products, LLC. B-hyve is a registered trademark of Orbit. Verdyn simply connects to your existing B-hyve account on your behalf.",
  },
];

/** schema.org FAQPage JSON-LD for answer engines and rich results. */
export function faqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}
