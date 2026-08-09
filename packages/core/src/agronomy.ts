// Verdyn agronomy database. Values are field-practical defaults drawn from
// university turf-extension guidance (e.g. UF/IFAS, Clemson, NCSU). They are
// starting points the engine refines with soil, climate, and weather — not
// lab-exact constants.

import type { GrassType, SoilType, HeadType, PlantType } from "./types";

export const GRASS_TYPES: GrassType[] = [
  {
    id: "bermuda", name: "Bermudagrass", season: "warm",
    rootDepthIn: 8, droughtTolerance: 5, mowHeightIn: [0.5, 1.5],
    peakWeeklyWaterIn: 1.25, establishmentDays: 90,
    note: "Loves heat and full sun. Deep roots make it the most drought-tough warm-season turf.",
  },
  {
    id: "zoysia", name: "Zoysiagrass", season: "warm",
    rootDepthIn: 6, droughtTolerance: 4, mowHeightIn: [0.75, 2],
    peakWeeklyWaterIn: 1.0, establishmentDays: 90,
    note: "Dense and slow-growing. Tolerates some shade; prefers infrequent, deep watering.",
  },
  {
    id: "st_augustine", name: "St. Augustinegrass", season: "warm",
    rootDepthIn: 6, droughtTolerance: 3, mowHeightIn: [2.5, 4],
    peakWeeklyWaterIn: 1.5, establishmentDays: 60,
    note: "Best shade tolerance of the warm-season grasses; thirstier and frost-sensitive.",
  },
  {
    id: "centipede", name: "Centipedegrass", season: "warm",
    rootDepthIn: 4, droughtTolerance: 3, mowHeightIn: [1, 2],
    peakWeeklyWaterIn: 1.0, establishmentDays: 90,
    note: "Low-maintenance 'lazy man's grass'. Acidic soils, low fertility, modest water.",
  },
  {
    id: "bahia", name: "Bahiagrass", season: "warm",
    rootDepthIn: 8, droughtTolerance: 5, mowHeightIn: [2.5, 4],
    peakWeeklyWaterIn: 1.0, establishmentDays: 90,
    note: "Extremely drought-tough and low-input; coarse texture, common in the Gulf South.",
  },
  {
    id: "paspalum", name: "Seashore Paspalum", season: "warm",
    rootDepthIn: 8, droughtTolerance: 4, mowHeightIn: [0.5, 2],
    peakWeeklyWaterIn: 1.25, establishmentDays: 90,
    note: "Salt-tolerant; popular for coastal lawns and greens that use reclaimed water.",
  },
  {
    id: "tall_fescue", name: "Tall Fescue", season: "cool",
    rootDepthIn: 10, droughtTolerance: 4, mowHeightIn: [2.5, 4],
    peakWeeklyWaterIn: 1.5, establishmentDays: 45,
    note: "Deep-rooted cool-season workhorse; best transition-zone drought tolerance.",
  },
  {
    id: "kentucky_bluegrass", name: "Kentucky Bluegrass", season: "cool",
    rootDepthIn: 6, droughtTolerance: 2, mowHeightIn: [2, 3.5],
    peakWeeklyWaterIn: 1.75, establishmentDays: 60,
    note: "Lush and self-repairing via rhizomes; needs the most water of common turf.",
  },
  {
    id: "perennial_rye", name: "Perennial Ryegrass", season: "cool",
    rootDepthIn: 6, droughtTolerance: 2, mowHeightIn: [1.5, 2.5],
    peakWeeklyWaterIn: 1.75, establishmentDays: 21,
    note: "Germinates fast; often overseeded for winter color. Shallow-rooted, thirsty.",
  },
  {
    id: "fine_fescue", name: "Fine Fescue", season: "cool",
    rootDepthIn: 8, droughtTolerance: 4, mowHeightIn: [2.5, 4],
    peakWeeklyWaterIn: 1.25, establishmentDays: 45,
    note: "Best shade and low-water cool-season option; fine-bladed, low-traffic.",
  },
];

export const SOIL_TYPES: SoilType[] = [
  { id: "sand", name: "Sandy", infiltrationInHr: 2.0, availableWaterInPerIn: 0.06,
    note: "Drains fast, holds little water — water more often, in shorter bursts." },
  { id: "loamy_sand", name: "Loamy sand", infiltrationInHr: 1.6, availableWaterInPerIn: 0.09,
    note: "Still fast-draining; light, frequent watering works best." },
  { id: "sandy_loam", name: "Sandy loam", infiltrationInHr: 1.0, availableWaterInPerIn: 0.12,
    note: "A forgiving middle ground — good infiltration with decent storage." },
  { id: "loam", name: "Loam", infiltrationInHr: 0.6, availableWaterInPerIn: 0.18,
    note: "Ideal turf soil — holds water well and resists runoff." },
  { id: "clay_loam", name: "Clay loam", infiltrationInHr: 0.3, availableWaterInPerIn: 0.20,
    note: "Holds lots of water but soaks slowly — cycle-and-soak prevents runoff." },
  { id: "clay", name: "Clay", infiltrationInHr: 0.15, availableWaterInPerIn: 0.22,
    note: "Highest storage, slowest intake — short pulses with long soak gaps are essential." },
];

export const HEAD_TYPES: HeadType[] = [
  { id: "mp_rotator", name: "MP Rotator", precipInHr: 0.4,
    note: "Multi-stream rotary nozzle. Low, even precip — efficient, slope-friendly." },
  { id: "rotor", name: "Gear-drive rotor", precipInHr: 0.5,
    note: "Rotating stream for large zones (e.g. Hunter PGP, RVAN)." },
  { id: "spray", name: "Fixed spray", precipInHr: 1.5,
    note: "Fan spray heads. High precip rate — short run times, watch for runoff." },
  { id: "impact", name: "Impact (impulse)", precipInHr: 0.6,
    note: "Classic ticking metal heads; coarse but tough." },
  { id: "drip", name: "Drip / micro", precipInHr: 0.4,
    note: "Beds and borders; very efficient, no overspray." },
];

// Plant/zone types. Turf ("lawn") defers to the grass database; every other
// planting carries its own peak water need (in/week at full sun) and root depth.
// Values are field-practical landscape-irrigation defaults (drip beds and
// established woody plants need far less than turf; veg gardens need steady
// moisture). The engine refines these with soil, climate, weather, and head.
export const PLANT_TYPES: PlantType[] = [
  { id: "lawn", name: "Lawn / turf", usesGrass: true, peakWeeklyWaterIn: 1.25, rootDepthIn: 6,
    cycleSoak: true, establishmentDays: 30, defaultHeadTypeId: "mp_rotator",
    note: "Grass turf. Water need comes from the grass type you choose for the zone." },
  { id: "shrubs", name: "Shrubs / foundation beds", usesGrass: false, peakWeeklyWaterIn: 0.75, rootDepthIn: 12,
    cycleSoak: false, establishmentDays: 60, defaultHeadTypeId: "drip",
    note: "Woody ornamentals. Deep, infrequent watering; far thriftier than turf once established." },
  { id: "flower_bed", name: "Flower / annual beds", usesGrass: false, peakWeeklyWaterIn: 1.0, rootDepthIn: 8,
    cycleSoak: false, establishmentDays: 21, defaultHeadTypeId: "drip",
    note: "Annual color beds. Shallow roots want steady moisture in the top few inches." },
  { id: "veg_garden", name: "Vegetable garden", usesGrass: false, peakWeeklyWaterIn: 1.5, rootDepthIn: 10,
    cycleSoak: false, establishmentDays: 14, defaultHeadTypeId: "drip",
    note: "Edibles need consistent moisture; drip keeps foliage dry and fruit even." },
  { id: "trees", name: "Trees", usesGrass: false, peakWeeklyWaterIn: 0.6, rootDepthIn: 24,
    cycleSoak: true, establishmentDays: 120, defaultHeadTypeId: "drip",
    note: "Deep, slow soaks at the dripline. Long establishment; very drought-tough after." },
  { id: "native", name: "Native / xeric", usesGrass: false, peakWeeklyWaterIn: 0.3, rootDepthIn: 18,
    cycleSoak: false, establishmentDays: 90, defaultHeadTypeId: "drip",
    note: "Drought-adapted plantings. Minimal supplemental water once established." },
  { id: "groundcover", name: "Groundcover", usesGrass: false, peakWeeklyWaterIn: 0.7, rootDepthIn: 6,
    cycleSoak: false, establishmentDays: 45, defaultHeadTypeId: "drip",
    note: "Low spreading cover. Moderate, even water; tolerates more neglect than turf." },
];

export const grassById = (id: string) =>
  GRASS_TYPES.find((g) => g.id === id) ?? GRASS_TYPES[0];
export const plantById = (id: string | undefined) =>
  PLANT_TYPES.find((p) => p.id === id) ?? PLANT_TYPES[0];
export const soilById = (id: string) =>
  SOIL_TYPES.find((s) => s.id === id) ?? SOIL_TYPES[3];
export const headById = (id: string) =>
  HEAD_TYPES.find((h) => h.id === id) ?? HEAD_TYPES[0];
