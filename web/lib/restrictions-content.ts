// Editorial content for the /restrictions directory: one entry per water
// authority, summarized from the authority's official published schedule.
// Keep `asOf` honest — bump it only when the entry is actually re-verified.
// This is marketing/documentation content; the scheduling engine's enforced
// rules live in the core engine and are resolved per-account from the ZIP.

export interface MetroRestriction {
  slug: string;
  city: string;
  state: string;
  authority: string;
  scheduleType: "assigned-days" | "odd-even" | "seasonal" | "stage-based" | "voluntary";
  /** 2-4 plain-English sentences: the actual current rules. */
  currentRules: string;
  /** Allowed/prohibited hours, e.g. "No watering 10 a.m.–4 p.m." */
  timeWindows: string;
  /** Short summary, e.g. "2 days/week by last digit of address". */
  days: string;
  /** New sod/seed establishment exemption, or a "no exemption" statement. */
  newLawnException: string;
  enforcement?: string;
  seasonal?: string;
  sourceUrl: string;
  /** Review stamp, e.g. "2026-08". */
  asOf: string;
}

// Populated from official-source research (reviewed 2026-08). Ordered by city.
export const METROS: MetroRestriction[] = [
  {
    slug: "atlanta-ga",
    city: "Atlanta",
    state: "GA",
    authority: "Georgia EPD (Water Stewardship Act) / City of Atlanta Watershed Management",
    scheduleType: "assigned-days",
    currentRules:
      "Georgia's Water Stewardship Act permanently limits landscape watering to the hours of 4 p.m.–10 a.m., every day — there is no day-of-week restriction on watering lawns and plants themselves. An odd/even address schedule applies only to non-landscape outdoor water use (washing cars at home, pressure washing, topping off pools): odd addresses Mon/Wed/Fri, even addresses Tue/Thu/Sat. Georgia declared Drought Response Level 1 in April 2026, which adds no extra outdoor watering restrictions.",
    timeWindows: "Watering allowed 4 p.m.–10 a.m.; prohibited 10 a.m.–4 p.m., every day",
    days: "Landscape: any day (within hours). Non-landscape use: odd = Mon/Wed/Fri, even = Tue/Thu/Sat",
    newLawnException:
      "New landscape installations get a 30-day establishment period with an expanded watering allowance. Landscape watering is already allowed any day of the week — only the 4 p.m.–10 a.m. window applies.",
    seasonal:
      "The 4 p.m.–10 a.m. rule applies year-round; rules would tighten only if the state moves beyond Drought Response Level 1.",
    sourceUrl:
      "https://epd.georgia.gov/rules-laws-enforcement/existing-rules-and-corresponding-laws/non-drought-outdoor-water-use-schedule",
    asOf: "2026-08",
  },
  {
    slug: "austin-tx",
    city: "Austin",
    state: "TX",
    authority: "Austin Water",
    scheduleType: "stage-based",
    currentRules:
      "Austin has been under Conservation Stage restrictions since September 2025. Automatic and in-ground irrigation systems may run only one designated day per week by address parity: even addresses Thursday, odd addresses Wednesday. Hose-end sprinklers and drip irrigation get two days per week (even = Thu/Sun, odd = Wed/Sat); hand-held hose watering and tree bubblers are allowed any day.",
    timeWindows: "Allowed only midnight–10 a.m. and 7 p.m.–midnight on assigned days; prohibited 10 a.m.–7 p.m.",
    days: "In-ground systems: 1 day/week by parity (even = Thu, odd = Wed); hose-end/drip: 2 days/week",
    newLawnException:
      "New sod or seed requires an Austin Water variance permit (applied for via the Customer Portal); once approved, daily watering is allowed for the first 30 days.",
    enforcement: "Penalties up to $1,000 per violation, with tiered fines; violations are reportable via 311.",
    seasonal:
      "The stage is set by Austin's Drought Contingency Plan (Highland Lakes levels) and can escalate; there is no separate winter schedule.",
    sourceUrl: "https://www.austintexas.gov/water/find-your-watering-day",
    asOf: "2026-08",
  },
  {
    slug: "cape-coral-fl",
    city: "Cape Coral",
    state: "FL",
    authority: "City of Cape Coral Utilities (SFWMD base rule)",
    scheduleType: "assigned-days",
    currentRules:
      "Cape Coral is back on its standard year-round two-day-per-week schedule (the regional shortage order was rescinded in June 2026). Both your two watering days and your specific overnight time window are assigned by the last digit of your address — the city pairs address endings into day groups (e.g. Mon/Thu, Tue/Fri, Wed/Sat) and splits each group across three overnight windows. Look up your exact digit assignment on the city's water conservation page.",
    timeWindows: "An assigned overnight window: 8 p.m.–midnight, midnight–4 a.m., or 4 a.m.–8 a.m., by address digit",
    days: "2 days/week by last digit of address (paired days plus an assigned overnight window)",
    newLawnException:
      "Newly planted vegetation gets a 30-day establishment period (daily watering, 2–8 a.m.), then a reduced schedule (Mon/Wed/Thu/Sat, 2–8 a.m.) for days 31–90.",
    seasonal:
      "A separate, tighter order applies only to private-well users in northeastern Cape Coral drawing from the Mid-Hawthorn Aquifer — check which system serves your address.",
    sourceUrl: "https://www.capecoral.gov/departments/utilities/water_conservation.php",
    asOf: "2026-08",
  },
  {
    slug: "dallas-tx",
    city: "Dallas",
    state: "TX",
    authority: "Dallas Water Utilities",
    scheduleType: "assigned-days",
    currentRules:
      "Dallas's permanent Water Conservation Ordinance limits landscape irrigation to at most twice per week on days assigned by address: even addresses Sunday and Thursday, odd addresses Saturday and Wednesday. Hand watering, soaker hoses, and drip irrigation are allowed any day. Automatic sprinkler systems are required to have working rain/freeze sensors.",
    timeWindows: "April 1–October 31: sprinklers prohibited 10 a.m.–6 p.m.; allowed outside those hours on assigned days",
    days: "2 days/week by address (even = Sun & Thu, odd = Sat & Wed), year-round",
    newLawnException:
      "A Newly-Installed Landscape variance can be applied for online — roughly up to 5 weeks of additional watering for new sod or landscaping; allow about 10 business days for processing.",
    enforcement:
      "First offense is a written warning; subsequent citations run $250–$2,000, and persistent violators can face flow restrictors or service termination.",
    seasonal: "The assigned-day schedule is year-round; the daytime ban applies April through October.",
    sourceUrl: "https://savedallaswater.com/",
    asOf: "2026-08",
  },
  {
    slug: "denver-co",
    city: "Denver",
    state: "CO",
    authority: "Denver Water",
    scheduleType: "seasonal",
    currentRules:
      "Denver Water declared a Stage 1 drought in March 2026 and made its Summer Watering Rules (May 1–October 1) mandatory at two assigned days per week: even single-family addresses Sunday and Thursday, odd addresses Wednesday and Saturday, and multifamily/commercial/HOA properties Tuesday and Friday. No irrigating during rain or high wind, and leaks must be repaired within 10 days.",
    timeWindows: "Watering prohibited 10 a.m.–6 p.m.; water before 10 a.m. or after 6 p.m.",
    days: "2 days/week (even = Sun & Thu, odd = Wed & Sat, multifamily/commercial = Tue & Fri)",
    newLawnException:
      "New native grass seed may be watered more frequently for up to 8 weeks; new sod, trees, or shrubs for up to 3 weeks — normal (including drought) rates still apply.",
    enforcement: "Progressive fines: warning, then $250, $500, and $1,000, with a formal appeals process.",
    seasonal:
      "Mandatory rules run May 1–October 1 each year; drought pricing is in effect through at least April 2027 under the current Stage 1 declaration.",
    sourceUrl: "https://www.denverwater.org/residential/rebates-and-conservation-tips/summer-watering-rules",
    asOf: "2026-08",
  },
  {
    slug: "las-vegas-nv",
    city: "Las Vegas",
    state: "NV",
    authority: "Southern Nevada Water Authority (SNWA) / Las Vegas Valley Water District",
    scheduleType: "seasonal",
    currentRules:
      "Every Southern Nevada address is assigned a mandatory watering group (A–F) that sets its allowed sprinkler days — look yours up with SNWA's address tool. The summer schedule (May 1–Aug 31) allows up to six days per week; spring and fall drop to about three; winter (Nov 1–Feb 28) allows just one assigned day per week. Sunday watering is banned valley-wide, year-round.",
    timeWindows: "Summer: sprinklers prohibited 11 a.m.–7 p.m.; winter: mid-morning watering recommended to avoid freezing",
    days: "Assigned group A–F: up to 6 days/week in summer, ~3 in spring/fall, 1 in winter; never Sunday",
    newLawnException:
      "A temporary establishment exception for new sod or seed allows more frequent watering after notifying your water provider before planting — confirm the exact duration with your member utility (LVVWD, Henderson, North Las Vegas, or Boulder City).",
    enforcement:
      "Watering outside assigned days/times is water waste and can draw fees or citations; exact amounts are set by each member utility.",
    seasonal: "The whole schedule is seasonal — frequency steps down from summer to spring/fall to winter.",
    sourceUrl: "https://www.snwa.com/",
    asOf: "2026-08",
  },
  {
    slug: "los-angeles-ca",
    city: "Los Angeles",
    state: "CA",
    authority: "Los Angeles Department of Water and Power (LADWP)",
    scheduleType: "assigned-days",
    currentRules:
      "LADWP is in Phase 2 of its Emergency Water Conservation Plan. Under the three-days-a-week ordinance, odd addresses may run sprinklers Monday, Wednesday, and Friday; even addresses Sunday, Tuesday, and Thursday. Hand watering with a self-closing nozzle is allowed any day before 9 a.m. or after 4 p.m.",
    timeWindows:
      "Sprinklers prohibited 9 a.m.–4 p.m.; limited to one 8-minute cycle per station (or two 15-minute cycles with water-conserving nozzles) per watering day",
    days: "3 days/week by parity (odd = Mon/Wed/Fri, even = Sun/Tue/Thu)",
    newLawnException:
      "No standard new-sod grace period is published; a variance/hardship application process exists for special circumstances, and large landscapes can apply for alternative compliance.",
    enforcement:
      "First violation is a written warning; Phase 2 fines then run $100–$600 for residential meters (higher for large meters), with flow restriction after a fifth violation.",
    sourceUrl: "https://www.ladwp.com/who-we-are/water-system/water-conservation/water-conservation-ordinance",
    asOf: "2026-08",
  },
  {
    slug: "miami-dade-fl",
    city: "Miami-Dade County",
    state: "FL",
    authority: "Miami-Dade County / South Florida Water Management District",
    scheduleType: "assigned-days",
    currentRules:
      "Miami-Dade follows the SFWMD permanent year-round rule (no active emergency shortage order since March 2026). Landscape irrigation is allowed two days per week by address parity: odd addresses Wednesday and Saturday, even addresses Thursday and Sunday, during the allowed morning or evening hours.",
    timeWindows: "No irrigation 10 a.m.–4 p.m., any day, year-round",
    days: "2 days/week by parity (odd = Wed & Sat, even = Thu & Sun)",
    newLawnException:
      "New landscaping may be watered every day except Friday (within allowed hours) for the first 90 days after installation — keep your proof-of-purchase receipt.",
    seasonal: "None — the schedule is fixed year-round, with no daylight-saving variation.",
    sourceUrl: "https://www.miamidade.gov/global/water/conservation/outdoor-water-restrictions.page",
    asOf: "2026-08",
  },
  {
    slug: "orlando-fl",
    city: "Orlando",
    state: "FL",
    authority: "Orlando Utilities Commission (OUC) / St. Johns River Water Management District",
    scheduleType: "seasonal",
    currentRules:
      "Orlando follows SJRWMD's standard year-round rule (Orange County is not part of the district's 2026 northeast-Florida emergency order). During daylight saving time, watering is allowed two days per week by parity — odd addresses Wednesday and Saturday, even addresses Thursday and Sunday. During standard time it drops to one day per week: odd addresses Saturday only, even addresses Sunday only.",
    timeWindows: "No watering 10 a.m.–4 p.m.; max one hour per zone per session, and no more than ¾ inch per zone per day",
    days: "DST: 2 days/week (odd = Wed & Sat, even = Thu & Sun). Standard time: 1 day/week (odd = Sat, even = Sun)",
    newLawnException:
      "New landscaping may be watered any day for the first 30 days, then every other day for days 31–60, using the minimum amount necessary.",
    seasonal: "Yes — the schedule halves when clocks fall back: two days per week in DST, one in standard time.",
    sourceUrl: "https://www.sjrwmd.com/wateringrestrictions/faqs/",
    asOf: "2026-08",
  },
  {
    slug: "phoenix-az",
    city: "Phoenix",
    state: "AZ",
    authority: "City of Phoenix Water Services",
    scheduleType: "voluntary",
    currentRules:
      "Phoenix is at Stage 1 of its Drought Management Plan — an alert stage with public-education measures, not mandatory assigned watering days. There is currently no odd/even or address-based schedule in force; the city publishes voluntary guidelines recommending no more than about twice-weekly watering in peak summer and less in cooler months. (Some third-party sites claim mandatory stages and fines — the official drought dashboard does not support that.)",
    timeWindows: "No mandatory hours; the city recommends watering between sundown and sunrise",
    days: "No mandatory days at Stage 1 — voluntary guidance of ≤2 days/week in summer",
    newLawnException: "Not applicable — there is currently no mandatory schedule to be exempt from.",
    enforcement:
      "No day-based citations at Stage 1; general water-waste provisions of the city code remain enforceable.",
    seasonal: "Voluntary guidance varies by season — more frequent in summer, much less in winter.",
    sourceUrl: "https://www.phoenix.gov/administration/departments/waterservices/supply-conservation/drought.html",
    asOf: "2026-08",
  },
  {
    slug: "salt-lake-city-ut",
    city: "Salt Lake City",
    state: "UT",
    authority: "Salt Lake City Department of Public Utilities",
    scheduleType: "voluntary",
    currentRules:
      "Salt Lake City issued a Stage 2 (mild) drought advisory in 2026 — its first since 2022 — but residential restrictions remain voluntary: residents are asked to water no more than twice a week and trim outdoor use by roughly 30 gallons a day. Only institutional customers (parks, schools, churches, government) face mandatory irrigation budgets or a two-day-per-week cap.",
    timeWindows: "No mandated hours for residents; early-morning or evening watering is recommended",
    days: "No mandatory days for residents; voluntary target of ≤2 days/week",
    newLawnException: "No published exemption — residential restrictions are advisory, so none is needed.",
    seasonal: "The advisory recommends holding off on starting lawn irrigation until at least mid-May.",
    sourceUrl: "https://www.slc.gov/utilities/conservation/drought-information/",
    asOf: "2026-08",
  },
  {
    slug: "san-antonio-tx",
    city: "San Antonio",
    state: "TX",
    authority: "San Antonio Water System (SAWS)",
    scheduleType: "stage-based",
    currentRules:
      "SAWS is in Stage 2 drought restrictions (stepped down from Stage 3 in August 2026), driven by Edwards Aquifer levels. Sprinkler or irrigation-system watering is allowed once a week on a day set by the last digit of your street address: 0/1 Monday, 2/3 Tuesday, 4/5 Wednesday, 6/7 Thursday, 8/9 Friday. Drip irrigation may run twice weekly (Mon and Fri); hand-held hose watering is allowed any day.",
    timeWindows: "Allowed 5–10 a.m. and 9 p.m.–midnight on your assigned day",
    days: "1 day/week by last digit of address (0/1 = Mon … 8/9 = Fri)",
    newLawnException:
      "No blanket new-sod exemption is published; SAWS runs a variance-request process that can cover new landscape establishment — apply before installing.",
    enforcement:
      "No court citations — a water-waste charge (about $137 first offense, waivable via a one-hour online course) is added to the bill; violations must be documented in person by SAWS staff and can be appealed.",
    seasonal: "Stages track the Edwards Aquifer level, not the calendar; Stage 4 would cut watering to once every other week.",
    sourceUrl: "https://www.saws.org/conservation/drought-restrictions/",
    asOf: "2026-08",
  },
  {
    slug: "tampa-fl",
    city: "Tampa",
    state: "FL",
    authority: "City of Tampa Water Department / Southwest Florida Water Management District",
    scheduleType: "stage-based",
    currentRules:
      "Tampa is under SWFWMD's Modified Phase III 'Extreme' water shortage order (in effect through October 1, 2026): lawn irrigation is limited to ONE day per week, assigned by the last digit of your address — 0/1 Monday, 2/3 Tuesday, 4/5 Wednesday, 6/7 Thursday, 8/9 Friday. Hand watering and micro-irrigation of non-turf plants is allowed any day, once per day, in the early-morning or evening window.",
    timeWindows:
      "Turf irrigation prohibited 4 a.m.–8 p.m. on your day (properties of an acre or more may use both overnight windows); hand watering prohibited 8 a.m.–6 p.m.",
    days: "1 day/week by last digit of address (0/1 = Mon … 8/9 = Fri) under the current Phase III order",
    newLawnException:
      "New sod follows a 30-day establishment watering schedule that temporarily bypasses the one-day limit — revert to the normal schedule afterward or risk citation.",
    enforcement:
      "Fines up to $500 plus a mandatory court appearance; since April 2026 the district has eliminated first-offense warnings, so a first violation can be cited.",
    seasonal:
      "This is a temporary drought-emergency order scheduled through October 1, 2026 — the normal schedule should resume after, so re-check this page in the fall.",
    sourceUrl: "https://www.tampa.gov/water/conservation/watering-days-and-hours",
    asOf: "2026-08",
  },
];
