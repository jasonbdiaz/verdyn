// Verdyn core domain types — shared by the engine, web app, and iOS app.

export type GrassSeason = "warm" | "cool";

export interface GrassType {
  id: string;
  name: string;
  season: GrassSeason;
  /** Typical effective root depth (in) when mature — drives soak depth. */
  rootDepthIn: number;
  /** Relative drought tolerance, 1 (thirsty) – 5 (tough). */
  droughtTolerance: 1 | 2 | 3 | 4 | 5;
  /** Recommended mowing height range (in). */
  mowHeightIn: [number, number];
  /** Baseline peak-season water need (in/week) at full sun, moderate climate. */
  peakWeeklyWaterIn: number;
  /** Days from seed/sod until "established" (pro deficit schedule begins). */
  establishmentDays: number;
  /** Short agronomic note shown in onboarding. */
  note: string;
}

export type SoilTextureId =
  | "sand" | "loamy_sand" | "sandy_loam" | "loam" | "clay_loam" | "clay";

export interface SoilType {
  id: SoilTextureId;
  name: string;
  /** Max infiltration before runoff (in/hr) — caps a single cycle's length. */
  infiltrationInHr: number;
  /** Plant-available water held per inch of soil (in/in). */
  availableWaterInPerIn: number;
  note: string;
}

export type SunExposure = "full_sun" | "partial" | "shade";
export type SlopeLevel = "flat" | "moderate" | "steep";

/** Sprinkler head families with typical net precipitation rates (in/hr). */
export type HeadTypeId = "mp_rotator" | "rotor" | "spray" | "drip" | "impact";

export interface HeadType {
  id: HeadTypeId;
  name: string;
  precipInHr: number;
  note: string;
}

/** What grows in a zone. Drives water demand, root depth, and cycle-soak
 *  behavior independently of the lawn grass — so a property can mix turf, beds,
 *  drip-fed shrubs, and a veg garden and each gets the right schedule. */
export type ZonePlantTypeId =
  | "lawn" | "shrubs" | "flower_bed" | "veg_garden" | "trees" | "native" | "groundcover";

export interface PlantType {
  id: ZonePlantTypeId;
  name: string;
  /** True only for turf — these zones take their water need from the grass type. */
  usesGrass: boolean;
  /** Peak-season water need (in/week) at full sun. Ignored when usesGrass. */
  peakWeeklyWaterIn: number;
  /** Effective root/wetting depth (in) — drives how deep a soak should reach. */
  rootDepthIn: number;
  /** Whether deep, infrequent cycle-and-soak applies. Drip beds soak slowly and
   *  rarely run off, so they don't get pulse-split the way turf does. */
  cycleSoak: boolean;
  /** Days from planting until established (per-zone establishment protocol). */
  establishmentDays: number;
  /** Sensible default head family for this planting. */
  defaultHeadTypeId: HeadTypeId;
  note: string;
}

/** One irrigation zone (maps to a B-hyve station). */
export interface ZoneProfile {
  id: string;
  name: string;
  bhyveDeviceId?: string;
  bhyveStation?: number;
  /** What grows here. Defaults to "lawn" when absent (back-compat). */
  plantTypeId?: ZonePlantTypeId;
  /** Only meaningful for turf (plantType.usesGrass). */
  grassTypeId: string;
  // expert-mode fields (sensible defaults when basic mode)
  headTypeId: HeadTypeId;
  sun: SunExposure;
  slope: SlopeLevel;
  /** Optional measured/known precip rate override (in/hr). */
  measuredPrecipInHr?: number;
  /** Per-zone planting/sodding date — overrides the lawn-level establishment so
   *  one zone can be "new sod" while the rest are mature. Null/absent = mature. */
  establishmentStart?: string | null;
  /** Optional real irrigated area (sq ft) for accurate gallons/cost. */
  areaSqft?: number;
  /** How many sprinkler heads/emitters this zone drives. Informs flow/GPM
   *  expectations for anomaly detection and per-zone water estimates. */
  headCount?: number;
  /** Active drought/heat-stress recovery campaign for this zone. When set, the
   *  engine runs a phased recovery curve (ramp → hold → taper → a new higher
   *  floor) layered on top of ET — see recovery.ts. Absent/null = no recovery. */
  recovery?: ZoneRecoveryConfig | null;
}

/** A drought/heat-stress recovery campaign for one zone — generalizes the
 *  CXLINKS recovery curve. While active it elevates the zone's water target on
 *  a decaying schedule (aggressive ramp → maintenance hold → taper → a new,
 *  higher floor than the pre-stress lean baseline), adds a hot-day cooling
 *  syringe, and is auto-relaxed when multi-day rainfall returns. The elevation
 *  is a ceiling on top of ET: weather can only reduce it, never push above it. */
export interface ZoneRecoveryConfig {
  /** Date the zone went into stress / the campaign began ("YYYY-MM-DD"). */
  startISO: string;
  /** Optional overrides for the phase-boundary day-offsets (defaults 0/4/18/28). */
  rampDay?: number;
  holdDay?: number;
  taperDay?: number;
  floorDay?: number;
  /** Optional per-phase target multipliers (defaults 1.30/1.20/1.10/1.05). */
  rampX?: number;
  holdX?: number;
  taperX?: number;
  floorX?: number;
}

/** Full output of onboarding — everything the engine needs. */
export interface LawnProfile {
  id: string;
  createdAt: string;
  zip: string;
  climateZoneId: string; // derived from ZIP
  soilTextureId: SoilTextureId;
  addressParity: "odd" | "even"; // for restriction-day math
  zones: ZoneProfile[];
  /** Seed/sod date if establishing; null if mature lawn. */
  establishmentStart: string | null;
  expertMode: boolean;
  // expert overrides
  restrictionPolicyId?: string; // override auto-detected local rule
  allowedHours?: [number, number]; // e.g. [4, 10] — earliest..latest legal hour
  // subscription / access state
  tier?: PlanTier; // "weather", "expert", or "pro"; defaults to "weather"
  subscriptionStatus?: SubscriptionStatus; // defaults to "active"
  canceledAt?: string | null; // ISO timestamp when the user cancelled
  /** Resolved local restriction for this ZIP (Expert tier; cached on profile). */
  localRestriction?: LocalRestriction | null;
  /** Lawn-wide dry-spell surcharge — a temporary bump to every mature zone's
   *  runtime during a declared dry spell (generalizes the CXLINKS Bermuda +12%).
   *  Auto-lifted to 1.0 when rolling rainfall returns. Zones in their own
   *  recovery campaign use the recovery curve instead. */
  drySpell?: { surchargeX: number } | null;
}

export type SubscriptionStatus = "active" | "canceled";

/** Subscription tiers.
 *  `weather` = ET/weather-based watering only;
 *  `expert` unlocks AI local-restriction research, per-zone tuning, and overrides;
 *  `pro` (business) = all Expert capabilities across MANY properties/addresses,
 *    plus client-facing water-savings reporting — for lawn-care services. */
export type PlanTier = "weather" | "expert" | "pro";

/** Who the account belongs to. Chosen at the very first onboarding step;
 *  `business` is what unlocks the Pro multi-property module. */
export type AccountType = "homeowner" | "business";

/** One managed address under a Pro (business) account. Each property is a full
 *  lawn config the engine runs independently — its own ZIP, zones, restrictions,
 *  and establishment state. */
export interface Property {
  id: string;
  /** Display name — client name or street address. */
  label: string;
  /** Optional full street address (for the service provider's records). */
  address?: string;
  /** The per-property lawn configuration the engine plans against. */
  profile: LawnProfile;
  createdAt: string;
}

/** A resolved, plain-English local watering restriction for a ZIP/county.
 *  Produced either from the built-in policy table (free, deterministic) or via
 *  AI research (Expert tier), and cached per-county for RAG-style reuse. */
export interface LocalRestriction {
  /** Where this came from: AI research, the built-in table, or a DB cache hit. */
  source: "ai" | "builtin" | "cache";
  zip: string;
  city?: string;
  state?: string;
  county?: string;
  /** 5-digit county FIPS when known — the RAG/cache key. */
  fips?: string;
  /** Maps to RESTRICTION_POLICIES when source !== "ai". */
  policyId: string;
  label: string;
  allowedWeekdaysOdd: number[];
  allowedWeekdaysEven: number[];
  banWindow: [number, number] | null;
  establishmentExemptDays: number;
  /** Plain-English summary — the human- and AI-friendly RAG payload. */
  summary: string;
  confidence?: "high" | "medium" | "low";
  /** AI-sourced restrictions are advisory until verified against the utility. */
  needsVerification?: boolean;
}

/** User/sensor ground-truth on how the turf actually looks — feeds a bounded
 *  next-run nudge (generalizes the CXLINKS /observe loop). */
export type GroundTruth = "dry" | "ok" | "wet";

export interface WeatherInput {
  precipYesterdayIn: number;
  precipTodayForecastIn: number;
  forecastHighF: number;
  precipChancePct: number;
  windMph: number;
  /** Reference ET for today (in) — if absent, engine estimates from climate. */
  etTodayIn?: number;
  /** Rolling cumulative rainfall over the last 7 days (in) — drives recovery /
   *  dry-spell relaxation when the rainy season returns. Absent = treat as 0. */
  rolling7DayRainIn?: number;
  /** Latest ground-truth report (dry/ok/wet) — bounded next-run adjustment. */
  observation?: GroundTruth;
  /** Health signal flagged urgent/critically-low (e.g. anomaly or a vision
   *  health index) — biases a stressed zone toward more water. */
  healthUrgent?: boolean;
  /** Consecutive days (including today) with a forecast/observed high at or
   *  above the heat threshold. ≥3 escalates the heat bump to wilt-watch.
   *  Absent = treat a hot today as day 1. */
  consecutiveHotDays?: number;
}

export type Phase = "establishment" | "transition" | "established";

export type PlanStatus =
  | "scheduled" | "adjusted" | "skipped" | "rest";

export interface PlanCycle {
  zoneId: string;
  zoneName: string;
  cycleType: "standard" | "pulse" | "establishment" | "syringe";
  /** "HH:MM" local 24h. */
  time: string;
  minutes: number;
  inches: number;
}

/** One human-readable reason a decision was made, tagged by the factor that
 *  drove it. The UI renders these as the "why" behind every plan — the core of
 *  Verdyn's explainable, non-black-box positioning. */
export interface DecisionFactor {
  /** What kind of input drove this: weather, restriction, soil/slope, plant,
   *  season/ET, establishment, or efficiency. */
  factor:
    | "rain" | "wind" | "heat" | "forecast" | "restriction" | "soil"
    | "slope" | "plant" | "season" | "establishment" | "efficiency"
    | "recovery" | "feedback";
  /** Plain-English sentence, e.g. "Split into 3 cycles: clay soil + slope to prevent runoff." */
  text: string;
}

/** A named irrigation program — the watering "recipe" the engine runs for a zone,
 *  chosen from what grows there, the head delivering water, and the zone size.
 *  Surfacing these makes Verdyn's per-zone differentiation explicit: a drip bed,
 *  a big rotor lawn, an annual flower bed, and a tree line are NOT watered the
 *  same way. */
export type WaterProgramId =
  | "turf_cycle_soak"   // deep, infrequent cycle-and-soak turf
  | "turf_establish"    // light, frequent soaks for new sod/seed
  | "large_rotor"       // big zones on rotors/impacts — more, longer passes
  | "drip_soak"         // beds/shrubs on drip — one slow, deep soak
  | "bed_frequent"      // flower/veg/groundcover — shallow, steady moisture
  | "tree_deep_slow"    // trees — deep, slow dripline soak
  | "xeric_minimal";    // native/xeric — minimal supplemental water

export type WaterProgramStyle = "cycle_soak" | "single_soak" | "light_frequent";

export interface WaterProgramRef {
  id: WaterProgramId;
  name: string;
  style: WaterProgramStyle;
  /** One-line description for the app/plan "why". */
  blurb: string;
}

export interface ZoneOutcome {
  zoneId: string;
  zoneName: string;
  waters: boolean;
  reason?: string; // why skipped/rest (kept for back-compat)
  /** Structured, per-zone reasoning behind today's decision. */
  explanation?: DecisionFactor[];
  /** The named program this zone runs (drip soak, large-rotor, bed, etc.). */
  program?: WaterProgramRef;
}

export interface DailyPlan {
  date: string;
  phase: Phase;
  status: PlanStatus;
  cycles: PlanCycle[];
  zoneOutcomes: ZoneOutcome[];
  multiplier: number;
  notes: string[];
  /** Plan-level structured reasoning (weather + restriction + season factors)
   *  shared by all zones — drives the explainable "why" view. */
  rationale?: DecisionFactor[];
}

/** Water-restriction policy (city/utility level). */
export interface RestrictionPolicy {
  id: string;
  label: string;
  region: string;
  /** Allowed JS weekdays (0=Sun..6=Sat). Empty = any day. */
  allowedWeekdaysOdd: number[];
  allowedWeekdaysEven: number[];
  /** Daytime ban window [startHour, endHour) — no watering inside it. */
  banWindow: [number, number] | null;
  /** Establishing new sod/seed is usually exempt for N days. */
  establishmentExemptDays: number;
  note: string;
}
