/**
 * BinCheck municipal ruleset diff and contamination-cost comparator.
 *
 * Scores one basket of household items under two or more MRF program profiles:
 * the two snapshot-backed city rulesets (Riverside and Houston, evaluated by
 * the same rules engine as the rest of the page) plus four clearly labeled
 * illustrative planning archetypes. Surfaces rule-conflict alerts, diversion
 * rates, contamination penalty risk, and a lifecycle CO2e delta computed with
 * disclosed EPA WARM-style planning factors. No facility sensor claims; every
 * factor is labeled with its basis.
 *
 * Pure and deterministic: no DOM, no clock, no network.
 */

import {
  MATERIAL_CATEGORIES,
  SUPPORTED_CITIES,
  evaluateItemDisposal,
  resolveMaterialProfile
} from "./bincheck-engine.js";
import { MUNICIPAL_RULES_SNAPSHOT } from "../data/municipal-rules-2026.js";

const RULES_SNAPSHOT_META = Object.freeze({
  schemaVersion: MUNICIPAL_RULES_SNAPSHOT.schemaVersion,
  lastVerifiedDate: MUNICIPAL_RULES_SNAPSHOT.lastVerifiedDate
});

/** Extra workbench stream for profiles that collect food and fiber organics at the curb. */
export const ORGANICS_STREAM = "ORGANICS_CART";

export const WORKBENCH_STREAM_LABELS = Object.freeze({
  RECYCLE_CART: "Recycling cart",
  ORGANICS_CART: "Organics cart",
  GREEN_WASTE: "Green waste collection",
  SPECIAL_DROPOFF: "Drop-off depot",
  SPLIT_DISPOSAL: "Split disposal",
  TRASH_CART: "Trash cart"
});

/** Streams that count as diverted from landfill, and the diverted fraction of each. */
const DIVERT_FRACTION = Object.freeze({
  RECYCLE_CART: 1,
  ORGANICS_CART: 1,
  GREEN_WASTE: 1,
  SPECIAL_DROPOFF: 1,
  SPLIT_DISPOSAL: 0.5,
  TRASH_CART: 0
});

/** Streams hauled away at the curb (drop-off depots require a separate trip). */
const CURBSIDE_STREAMS = new Set(["RECYCLE_CART", "ORGANICS_CART", "GREEN_WASTE", "SPLIT_DISPOSAL"]);

/**
 * Lifecycle CO2e planning factors: avoided emissions in MTCO2e per short ton
 * of material diverted instead of landfilled. "warm" rows follow the order of
 * magnitude of the EPA WARM v16 material factors; "estimate" rows are BinCheck
 * planning estimates where WARM has no matching material row. Every factor is
 * disclosed in the UI with its basis. These are planning factors, not
 * measurements from any facility.
 */
export const WARM_FACTORS = Object.freeze({
  "resin-1-pet": Object.freeze({ factor: 1.5, basis: "EPA WARM v16, PET bottles" }),
  "resin-2-hdpe": Object.freeze({ factor: 1.4, basis: "EPA WARM v16, HDPE" }),
  "resin-3-pvc": Object.freeze({ factor: 1.0, basis: "BinCheck estimate, no WARM row for PVC" }),
  "resin-4-ldpe-film": Object.freeze({ factor: 1.4, basis: "EPA WARM v16, LDPE film" }),
  "resin-5-pp": Object.freeze({ factor: 1.2, basis: "BinCheck estimate near WARM mixed plastics" }),
  "resin-6-ps-foam": Object.freeze({ factor: 0.9, basis: "BinCheck estimate near WARM polystyrene" }),
  "resin-7-other": Object.freeze({ factor: 0.2, basis: "BinCheck estimate, low-yield multi-layer" }),
  "glass-jar-bottle": Object.freeze({ factor: 0.3, basis: "EPA WARM v16, glass containers" }),
  "broken-glass-ceramic": Object.freeze({ factor: 0, basis: "Not recoverable cullet; landfill" }),
  "aluminum-steel-can": Object.freeze({ factor: 4.7, basis: "EPA WARM v16, 40 percent aluminum cans and 60 percent steel cans blend" }),
  "soiled-foil-tray": Object.freeze({ factor: 4.0, basis: "BinCheck estimate, aluminum foil yield-discounted from WARM" }),
  "clean-cardboard-paper": Object.freeze({ factor: 3.1, basis: "EPA WARM v16, corrugated containers" }),
  "greasy-pizza-box": Object.freeze({ factor: 1.6, basis: "BinCheck estimate, half of the corrugated factor for the clean share" }),
  "soiled-cardboard-paper": Object.freeze({ factor: 1.6, basis: "BinCheck estimate, half of the corrugated factor for the clean share" }),
  "lithium-household-battery": Object.freeze({ factor: 1.5, basis: "BinCheck estimate, battery metals recovery" }),
  "electronics-ewaste": Object.freeze({ factor: 1.6, basis: "BinCheck estimate, e-waste metals recovery" }),
  "yard-trimmings-brush": Object.freeze({ factor: 0.4, basis: "EPA WARM v16, yard trimmings composted versus landfilled" }),
  "liquid-full-bottle": Object.freeze({ factor: 1.5, basis: "EPA WARM v16, PET bottles (after draining)" })
});

/**
 * The six MRF program profiles. The two "snapshot" profiles are evaluated by
 * the real rules engine against data/municipal-rules-2026.json. The four
 * "archetype" profiles are illustrative planning models of common program
 * designs, not claims about any named city.
 */
export const MRF_PROFILES = Object.freeze({
  "Riverside-tx": Object.freeze({
    id: "Riverside-tx",
    name: "Riverside, TX",
    shortName: "Riverside",
    kind: "snapshot",
    summary: "Republic Services single-stream cart plus county County drop-off (real snapshot rules).",
    sourceUrl: SUPPORTED_CITIES["Riverside-tx"].sourceUrl
  }),
  "houston-tx": Object.freeze({
    id: "houston-tx",
    name: "Houston, TX",
    shortName: "Houston",
    kind: "snapshot",
    summary: "SWMD green cart plus Westpark and Neighborhood Depositories (real snapshot rules).",
    sourceUrl: SUPPORTED_CITIES["houston-tx"].sourceUrl
  }),
  "strict-single-stream": Object.freeze({
    id: "strict-single-stream",
    name: "Strict Single-Stream",
    shortName: "Strict Single-Stream",
    kind: "archetype",
    summary: "Illustrative conservative single-stream district: #1 #2 #5 bottles, glass, metals and clean fiber in one cart.",
    sourceUrl: null
  }),
  "dual-stream-glass-out": Object.freeze({
    id: "dual-stream-glass-out",
    name: "Dual-Stream, Glass-Out",
    shortName: "Dual-Stream Glass-Out",
    kind: "archetype",
    summary: "Illustrative dual-stream district: paper and containers in separate carts, glass only at drop-off igloos.",
    sourceUrl: null
  }),
  "organics-mandatory": Object.freeze({
    id: "organics-mandatory",
    name: "Organics-Mandatory Curbside",
    shortName: "Organics-Mandatory",
    kind: "archetype",
    summary: "Illustrative district with a mandatory curbside organics cart for food-soiled fiber and yard waste.",
    sourceUrl: null
  }),
  "rural-transfer-station": Object.freeze({
    id: "rural-transfer-station",
    name: "Rural Drop-Off / Transfer Station",
    shortName: "Rural Transfer Station",
    kind: "archetype",
    summary: "Illustrative rural district with no curbside recycling; everything sorted at a transfer station bay.",
    sourceUrl: null,
    hasCurbsideCarts: false
  })
});

export const MRF_PROFILE_IDS = Object.freeze(Object.keys(MRF_PROFILES));
export const ARCHETYPE_PROFILE_IDS = Object.freeze(MRF_PROFILE_IDS.filter((id) => MRF_PROFILES[id].kind === "archetype"));

/**
 * Archetype rule tables. One entry per material category per archetype, so the
 * mapping is plain data that tests can diff against the snapshot cities.
 * Stream values reuse the engine streams plus ORGANICS_CART.
 */
const ARCHETYPE_RULES = Object.freeze({
  "strict-single-stream": Object.freeze({
    "resin-1-pet": Object.freeze({ stream: "RECYCLE_CART", note: "Bottles #1 #2 #5 loose in the single cart." }),
    "resin-2-hdpe": Object.freeze({ stream: "RECYCLE_CART", note: "Bottles #1 #2 #5 loose in the single cart." }),
    "resin-3-pvc": Object.freeze({ stream: "TRASH_CART", note: "PVC stays out; chlorine ruins PET regrind." }),
    "resin-4-ldpe-film": Object.freeze({ stream: "SPECIAL_DROPOFF", note: "Retail film return only; film wraps star-screen shafts." }),
    "resin-5-pp": Object.freeze({ stream: "RECYCLE_CART", note: "Rigid #5 tubs accepted when clean." }),
    "resin-6-ps-foam": Object.freeze({ stream: "TRASH_CART", note: "No foam program in the district; trash cart." }),
    "resin-7-other": Object.freeze({ stream: "TRASH_CART", note: "Multi-layer pouches are not sortable." }),
    "glass-jar-bottle": Object.freeze({ stream: "RECYCLE_CART", note: "Glass accepted in the single-stream cart." }),
    "broken-glass-ceramic": Object.freeze({ stream: "TRASH_CART", note: "Wrapped shards in trash; never loose in the cart." }),
    "aluminum-steel-can": Object.freeze({ stream: "RECYCLE_CART", note: "Highest-value cart material." }),
    "soiled-foil-tray": Object.freeze({ stream: "SPLIT_DISPOSAL", note: "Clean balled foil recycles; greasy foil trashes." }),
    "clean-cardboard-paper": Object.freeze({ stream: "RECYCLE_CART", note: "Flattened, dry fiber in the cart." }),
    "greasy-pizza-box": Object.freeze({ stream: "SPLIT_DISPOSAL", note: "Clean lid recycles; greasy base trashes." }),
    "soiled-cardboard-paper": Object.freeze({ stream: "SPLIT_DISPOSAL", note: "Clean share recycles; soiled share trashes." }),
    "lithium-household-battery": Object.freeze({ stream: "SPECIAL_DROPOFF", note: "Household hazardous depot only; never in any cart." }),
    "electronics-ewaste": Object.freeze({ stream: "SPECIAL_DROPOFF", note: "E-waste depot or retailer take-back." }),
    "yard-trimmings-brush": Object.freeze({ stream: "GREEN_WASTE", note: "Bundled or bagged for the green waste collection." }),
    "liquid-full-bottle": Object.freeze({ stream: "SPLIT_DISPOSAL", note: "Empty the liquid, then the bottle recycles." })
  }),
  "dual-stream-glass-out": Object.freeze({
    "resin-1-pet": Object.freeze({ stream: "RECYCLE_CART", note: "Containers cart only; keep out of the paper cart." }),
    "resin-2-hdpe": Object.freeze({ stream: "RECYCLE_CART", note: "Containers cart only; keep out of the paper cart." }),
    "resin-3-pvc": Object.freeze({ stream: "TRASH_CART", note: "PVC stays out of both carts." }),
    "resin-4-ldpe-film": Object.freeze({ stream: "SPECIAL_DROPOFF", note: "Retail film return only." }),
    "resin-5-pp": Object.freeze({ stream: "RECYCLE_CART", note: "Rigid #5 in the containers cart when clean." }),
    "resin-6-ps-foam": Object.freeze({ stream: "TRASH_CART", note: "No foam program in the district; trash cart." }),
    "resin-7-other": Object.freeze({ stream: "TRASH_CART", note: "Multi-layer pouches are not sortable." }),
    "glass-jar-bottle": Object.freeze({ stream: "SPECIAL_DROPOFF", note: "Glass is out of both carts; color-sorted drop-off igloos only. Glass in a cart contaminates the container stream." }),
    "broken-glass-ceramic": Object.freeze({ stream: "TRASH_CART", note: "Wrapped shards in trash; never loose in any cart." }),
    "aluminum-steel-can": Object.freeze({ stream: "RECYCLE_CART", note: "Metals in the containers cart." }),
    "soiled-foil-tray": Object.freeze({ stream: "SPLIT_DISPOSAL", note: "Clean balled foil to the containers cart; greasy foil trashes." }),
    "clean-cardboard-paper": Object.freeze({ stream: "RECYCLE_CART", note: "Paper cart; keep containers out of this stream." }),
    "greasy-pizza-box": Object.freeze({ stream: "SPLIT_DISPOSAL", note: "Clean lid to the paper cart; greasy base trashes." }),
    "soiled-cardboard-paper": Object.freeze({ stream: "SPLIT_DISPOSAL", note: "Clean share to the paper cart; soiled share trashes." }),
    "lithium-household-battery": Object.freeze({ stream: "SPECIAL_DROPOFF", note: "Household hazardous depot only; never in any cart." }),
    "electronics-ewaste": Object.freeze({ stream: "SPECIAL_DROPOFF", note: "E-waste depot or retailer take-back." }),
    "yard-trimmings-brush": Object.freeze({ stream: "GREEN_WASTE", note: "Bundled or bagged for the green waste collection." }),
    "liquid-full-bottle": Object.freeze({ stream: "SPLIT_DISPOSAL", note: "Empty the liquid, then the bottle joins the containers cart." })
  }),
  "organics-mandatory": Object.freeze({
    "resin-1-pet": Object.freeze({ stream: "RECYCLE_CART", note: "Bottles #1 #2 #5 loose in the recycling cart." }),
    "resin-2-hdpe": Object.freeze({ stream: "RECYCLE_CART", note: "Bottles #1 #2 #5 loose in the recycling cart." }),
    "resin-3-pvc": Object.freeze({ stream: "TRASH_CART", note: "PVC stays out." }),
    "resin-4-ldpe-film": Object.freeze({ stream: "SPECIAL_DROPOFF", note: "Retail film return only." }),
    "resin-5-pp": Object.freeze({ stream: "RECYCLE_CART", note: "Rigid #5 tubs accepted when clean." }),
    "resin-6-ps-foam": Object.freeze({ stream: "TRASH_CART", note: "Foam is not compostable and not recyclable; trash." }),
    "resin-7-other": Object.freeze({ stream: "TRASH_CART", note: "Multi-layer pouches are not compostable either; trash." }),
    "glass-jar-bottle": Object.freeze({ stream: "RECYCLE_CART", note: "Glass accepted in the recycling cart." }),
    "broken-glass-ceramic": Object.freeze({ stream: "TRASH_CART", note: "Wrapped shards in trash." }),
    "aluminum-steel-can": Object.freeze({ stream: "RECYCLE_CART", note: "Metals in the recycling cart." }),
    "soiled-foil-tray": Object.freeze({ stream: "SPLIT_DISPOSAL", note: "Clean balled foil recycles; greasy foil trashes (not composted)." }),
    "clean-cardboard-paper": Object.freeze({ stream: "RECYCLE_CART", note: "Flattened, dry fiber in the recycling cart." }),
    "greasy-pizza-box": Object.freeze({ stream: "ORGANICS_CART", note: "Whole box to the organics cart; the clean lid can also be torn out for recycling." }),
    "soiled-cardboard-paper": Object.freeze({ stream: "ORGANICS_CART", note: "Food-soiled paper composts in the mandatory organics cart." }),
    "lithium-household-battery": Object.freeze({ stream: "SPECIAL_DROPOFF", note: "Household hazardous depot only; never in any cart." }),
    "electronics-ewaste": Object.freeze({ stream: "SPECIAL_DROPOFF", note: "E-waste depot or retailer take-back." }),
    "yard-trimmings-brush": Object.freeze({ stream: "ORGANICS_CART", note: "All yard waste rides the weekly organics cart, no special bags." }),
    "liquid-full-bottle": Object.freeze({ stream: "SPLIT_DISPOSAL", note: "Empty the liquid, then the bottle recycles." })
  }),
  "rural-transfer-station": Object.freeze({
    "resin-1-pet": Object.freeze({ stream: "SPECIAL_DROPOFF", note: "No curbside recycling; commingled bay at the transfer station." }),
    "resin-2-hdpe": Object.freeze({ stream: "SPECIAL_DROPOFF", note: "No curbside recycling; commingled bay at the transfer station." }),
    "resin-3-pvc": Object.freeze({ stream: "SPECIAL_DROPOFF", note: "Transfer station sorts rigid #3 at the depot bay." }),
    "resin-4-ldpe-film": Object.freeze({ stream: "TRASH_CART", note: "No film market in the district; trash, or a retail film return in town." }),
    "resin-5-pp": Object.freeze({ stream: "SPECIAL_DROPOFF", note: "Commingled bay at the transfer station." }),
    "resin-6-ps-foam": Object.freeze({ stream: "SPECIAL_DROPOFF", note: "Clean bagged foam accepted at the transfer station bay." }),
    "resin-7-other": Object.freeze({ stream: "TRASH_CART", note: "Even the transfer station cannot sort multi-layer pouches." }),
    "glass-jar-bottle": Object.freeze({ stream: "SPECIAL_DROPOFF", note: "Color-sorted glass bunker at the transfer station." }),
    "broken-glass-ceramic": Object.freeze({ stream: "TRASH_CART", note: "Wrapped shards in trash." }),
    "aluminum-steel-can": Object.freeze({ stream: "SPECIAL_DROPOFF", note: "Scrap metal bay at the transfer station." }),
    "soiled-foil-tray": Object.freeze({ stream: "SPLIT_DISPOSAL", note: "Clean foil to the scrap bay; greasy foil trashes." }),
    "clean-cardboard-paper": Object.freeze({ stream: "SPECIAL_DROPOFF", note: "Fiber bunker at the transfer station." }),
    "greasy-pizza-box": Object.freeze({ stream: "TRASH_CART", note: "No organics program; the whole box trashes." }),
    "soiled-cardboard-paper": Object.freeze({ stream: "TRASH_CART", note: "No organics program; soiled fiber trashes." }),
    "lithium-household-battery": Object.freeze({ stream: "SPECIAL_DROPOFF", note: "HHW events or the hazmat bay; never in trash either." }),
    "electronics-ewaste": Object.freeze({ stream: "SPECIAL_DROPOFF", note: "E-waste container at the transfer station." }),
    "yard-trimmings-brush": Object.freeze({ stream: "SPECIAL_DROPOFF", note: "Brush and compost pad at the transfer station." }),
    "liquid-full-bottle": Object.freeze({ stream: "SPLIT_DISPOSAL", note: "Empty the liquid, then the bottle rides to the commingled bay." })
  })
});

/** Exported for tests and self-tests that verify full material coverage. */
export const ARCHETYPE_RULE_TABLE = ARCHETYPE_RULES;

const DEFAULT_PROFILE_ID = "strict-single-stream";
const DEFAULT_BASKET_ID = "tricky-household";

/**
 * Shared tricky-item baskets. Weights are illustrative per-item household
 * masses in pounds used only for the planning metrics; they are disclosed as
 * estimates wherever the metrics appear.
 */
export const MUNICIPAL_BASKETS = Object.freeze({
  "tricky-household": Object.freeze({
    id: "tricky-household",
    name: "Tricky household basket (14 items)",
    items: Object.freeze([
      Object.freeze({ materialId: "resin-1-pet", condition: "clean", label: "#1 PET water bottle", weightLbs: 0.05 }),
      Object.freeze({ materialId: "resin-2-hdpe", condition: "clean", label: "#2 HDPE milk jug", weightLbs: 0.13 }),
      Object.freeze({ materialId: "resin-4-ldpe-film", condition: "clean", label: "Plastic grocery bag and film wrap", weightLbs: 0.02 }),
      Object.freeze({ materialId: "resin-5-pp", condition: "clean", label: "#5 PP yogurt tub", weightLbs: 0.04 }),
      Object.freeze({ materialId: "resin-6-ps-foam", condition: "clean", label: "#6 foam takeout cup", weightLbs: 0.01 }),
      Object.freeze({ materialId: "resin-7-other", condition: "clean", label: "Metallized chip bag (#7)", weightLbs: 0.02 }),
      Object.freeze({ materialId: "glass-jar-bottle", condition: "clean", label: "Glass salsa jar", weightLbs: 0.6 }),
      Object.freeze({ materialId: "aluminum-steel-can", condition: "clean", label: "Soda can and soup can", weightLbs: 0.08 }),
      Object.freeze({ materialId: "soiled-foil-tray", condition: "greasy", label: "Greasy foil baking tray", weightLbs: 0.03 }),
      Object.freeze({ materialId: "clean-cardboard-paper", condition: "clean", label: "Flattened shipping box", weightLbs: 1.0 }),
      Object.freeze({ materialId: "greasy-pizza-box", condition: "greasy", label: "Pizza delivery box", weightLbs: 0.5 }),
      Object.freeze({ materialId: "lithium-household-battery", condition: "clean", label: "Lithium-ion battery", weightLbs: 0.05 }),
      Object.freeze({ materialId: "yard-trimmings-brush", condition: "clean", label: "Bag of lawn clippings", weightLbs: 8.0 }),
      Object.freeze({ materialId: "liquid-full-bottle", condition: "clean", label: "Half-full juice bottle", weightLbs: 0.5 })
    ])
  }),
  "flexible-and-foam": Object.freeze({
    id: "flexible-and-foam",
    name: "Film, foam and flexibles basket (6 items)",
    items: Object.freeze([
      Object.freeze({ materialId: "resin-4-ldpe-film", condition: "clean", label: "Grocery film bundle", weightLbs: 0.06 }),
      Object.freeze({ materialId: "resin-4-ldpe-film", condition: "greasy", label: "Food-soiled film", weightLbs: 0.02 }),
      Object.freeze({ materialId: "resin-6-ps-foam", condition: "clean", label: "Foam shipping blocks", weightLbs: 0.4 }),
      Object.freeze({ materialId: "resin-6-ps-foam", condition: "greasy", label: "Food-stained foam clamshell", weightLbs: 0.03 }),
      Object.freeze({ materialId: "resin-7-other", condition: "clean", label: "Snack pouch multipack", weightLbs: 0.08 }),
      Object.freeze({ materialId: "resin-7-other", condition: "clean", label: "Coated ice cream carton", weightLbs: 0.2 })
    ])
  }),
  "kitchen-week": Object.freeze({
    id: "kitchen-week",
    name: "One week of kitchen packaging (9 items)",
    items: Object.freeze([
      Object.freeze({ materialId: "resin-1-pet", condition: "clean", label: "Beverage bottles (4)", weightLbs: 0.2 }),
      Object.freeze({ materialId: "resin-2-hdpe", condition: "clean", label: "Milk and detergent jugs (2)", weightLbs: 0.3 }),
      Object.freeze({ materialId: "glass-jar-bottle", condition: "clean", label: "Sauce jars (3)", weightLbs: 1.8 }),
      Object.freeze({ materialId: "aluminum-steel-can", condition: "clean", label: "Cans (8)", weightLbs: 0.6 }),
      Object.freeze({ materialId: "clean-cardboard-paper", condition: "clean", label: "Cereal boxes and mail", weightLbs: 1.5 }),
      Object.freeze({ materialId: "clean-cardboard-paper", condition: "greasy", label: "Grease-soaked napkins and paper plates", weightLbs: 0.05 }),
      Object.freeze({ materialId: "greasy-pizza-box", condition: "greasy", label: "Friday pizza box", weightLbs: 0.5 }),
      Object.freeze({ materialId: "soiled-foil-tray", condition: "greasy", label: "Takeout foil pan", weightLbs: 0.05 }),
      Object.freeze({ materialId: "liquid-full-bottle", condition: "clean", label: "Half-full dressing bottle", weightLbs: 0.4 })
    ])
  }),
  "everything": Object.freeze({
    id: "everything",
    name: "Every material category (17 items)",
    items: Object.freeze(
      Object.keys(MATERIAL_CATEGORIES).map((materialId) =>
        Object.freeze({ materialId, condition: "clean", label: MATERIAL_CATEGORIES[materialId].title, weightLbs: 0.25 })
      )
    )
  })
});

export const MUNICIPAL_BASKET_IDS = Object.freeze(Object.keys(MUNICIPAL_BASKETS));

/**
 * Workbench presets addressable as #bin=<id> in the share hash. Each preset is
 * a named, bookmarkable configuration of the diff and cascade panels.
 */
export const WORKBENCH_PRESETS = Object.freeze({
  "diff-glass-out": Object.freeze({
    id: "diff-glass-out",
    name: "Glass in vs. glass out",
    patch: Object.freeze({ profileA: "Riverside-tx", profileB: "dual-stream-glass-out", basketId: "tricky-household" })
  }),
  "diff-organics": Object.freeze({
    id: "diff-organics",
    name: "Compulsory organics district",
    patch: Object.freeze({ profileA: "strict-single-stream", profileB: "organics-mandatory", basketId: "tricky-household" })
  }),
  "diff-rural": Object.freeze({
    id: "diff-rural",
    name: "City cart vs. rural transfer station",
    patch: Object.freeze({ profileA: "houston-tx", profileB: "rural-transfer-station", basketId: "tricky-household" })
  }),
  "cascade-battery": Object.freeze({
    id: "cascade-battery",
    name: "One battery in the cart",
    patch: Object.freeze({ cascadeCounts: Object.freeze({ "lithium-ignition": 1 }) })
  }),
  "cascade-tangler": Object.freeze({
    id: "cascade-tangler",
    name: "Film wraps the star-screens",
    patch: Object.freeze({ cascadeCounts: Object.freeze({ "film-tangler": 2 }) })
  })
});

export const WORKBENCH_PRESET_IDS = Object.freeze(Object.keys(WORKBENCH_PRESETS));

export function normalizeProfileId(value) {
  const id = String(value ?? "").trim();
  return Object.hasOwn(MRF_PROFILES, id) ? id : null;
}

export function normalizeBasketId(value) {
  const id = String(value ?? "").trim();
  return Object.hasOwn(MUNICIPAL_BASKETS, id) ? id : null;
}

/**
 * Evaluates one item under one MRF profile. Snapshot profiles defer to the
 * rules engine so the comparator can never drift from the city snapshot.
 * Returns { stream, badgeLabel, note, risk, tier, itemTitle, curbside, divertFraction }.
 */
export function evaluateProfileItem(profileId, query = {}) {
  const id = normalizeProfileId(profileId) || DEFAULT_PROFILE_ID;
  // The engine derives grease-soaked fiber from clean cardboard plus a greasy
  // condition, so a direct "soiled-cardboard-paper" id is normalized to the
  // query form the resolver understands instead of falling back to PET.
  const normalizedQuery =
    query.materialId === "soiled-cardboard-paper"
      ? { ...query, materialId: "clean-cardboard-paper", condition: "greasy" }
      : query;
  const { category } = resolveMaterialProfile(normalizedQuery);
  const materialId = category.id;
  const baseRisk = Number.isFinite(category.baseRiskScore) ? category.baseRiskScore : 0;

  let stream;
  let badgeLabel;
  let note;
  let risk = baseRisk;
  let itemTitle;
  if (MRF_PROFILES[id].kind === "snapshot") {
    const ev = evaluateItemDisposal({ ...normalizedQuery, city: id });
    stream = ev.stream;
    badgeLabel = ev.badgeLabel;
    note = ev.dropOffNote;
    risk = ev.contaminationRiskScore;
    itemTitle = ev.itemTitle;
  } else {
    const rule = ARCHETYPE_RULES[id][materialId];
    stream = rule.stream;
    note = rule.note;
    badgeLabel = `${WORKBENCH_STREAM_LABELS[stream]} (${MRF_PROFILES[id].shortName})`;
    itemTitle = category.title;
  }

  const tier = risk >= 85 ? "CRITICAL" : risk >= 55 ? "HIGH" : risk >= 25 ? "MODERATE" : "LOW";
  return {
    profileId: id,
    materialId,
    itemTitle,
    stream,
    badgeLabel,
    note,
    risk,
    baseRisk,
    tier,
    curbside: CURBSIDE_STREAMS.has(stream) && MRF_PROFILES[id].hasCurbsideCarts !== false,
    divertFraction: DIVERT_FRACTION[stream] ?? 0
  };
}

// "-0" must never reach a delta field: Math.round(-0.04 * 10) is -0.
function round2(value) {
  return Math.round(value * 100) / 100 || 0;
}

function round1(value) {
  return Math.round(value * 10) / 10 || 0;
}

function co2eKg(materialId, weightLbs, divertFraction) {
  const entry = WARM_FACTORS[materialId];
  if (!entry || divertFraction <= 0) return 0;
  // factor is MTCO2e avoided per short ton; tons = lbs / 2000, kg = MTCO2e * 1000.
  return (weightLbs / 2000) * entry.factor * 1000 * divertFraction;
}

/**
 * Scores a whole basket under one profile and returns disclosed metrics:
 * diversion rate, curbside-only diversion, drop-off mass, the contamination
 * penalty a naive "bin it all" resident would create, and lifecycle CO2e.
 */
export function evaluateBasket(basketId, profileId) {
  const basket = MUNICIPAL_BASKETS[normalizeBasketId(basketId) || DEFAULT_BASKET_ID];
  const profile = MRF_PROFILES[normalizeProfileId(profileId) || DEFAULT_PROFILE_ID];

  const rows = basket.items.map((item) => {
    const verdict = evaluateProfileItem(profile.id, { materialId: item.materialId, condition: item.condition });
    return {
      materialId: item.materialId,
      condition: item.condition,
      label: item.label,
      weightLbs: item.weightLbs,
      ...verdict,
      divertedLbs: item.weightLbs * verdict.divertFraction,
      curbsideLbs: item.weightLbs * (verdict.curbside ? verdict.divertFraction : 0),
      co2eKg: co2eKg(item.materialId, item.weightLbs, verdict.divertFraction)
    };
  });

  const totalLbs = rows.reduce((acc, row) => acc + row.weightLbs, 0);
  const divertedLbs = rows.reduce((acc, row) => acc + row.divertedLbs, 0);
  const curbsideLbs = rows.reduce((acc, row) => acc + row.curbsideLbs, 0);
  const dropOffLbs = rows
    .filter((row) => row.stream === "SPECIAL_DROPOFF")
    .reduce((acc, row) => acc + row.divertedLbs, 0);
  const trashLbs = totalLbs - divertedLbs;

  const notCurbside = rows.filter((row) => !row.curbside);
  const notCurbsideLbs = notCurbside.reduce((acc, row) => acc + row.weightLbs, 0);
  const riskMass = notCurbside.reduce((acc, row) => acc + row.weightLbs * row.risk, 0);

  const streamCounts = {};
  for (const row of rows) {
    streamCounts[row.stream] = round2((streamCounts[row.stream] || 0) + row.weightLbs);
  }

  return {
    profileId: profile.id,
    profileName: profile.name,
    shortName: profile.shortName,
    profileKind: profile.kind,
    basketId: basket.id,
    basketName: basket.name,
    itemCount: rows.length,
    totalLbs: round2(totalLbs),
    divertedLbs: round2(divertedLbs),
    diversionRatePct: totalLbs > 0 ? round1((divertedLbs / totalLbs) * 100) : 0,
    curbsideLbs: round2(curbsideLbs),
    curbsideRatePct: totalLbs > 0 ? round1((curbsideLbs / totalLbs) * 100) : 0,
    dropOffLbs: round2(dropOffLbs),
    trashLbs: round2(trashLbs),
    naiveCartContaminationPct: totalLbs > 0 ? round1((notCurbsideLbs / totalLbs) * 100) : 0,
    contaminationRiskIndex: notCurbsideLbs > 0 ? Math.round(riskMass / notCurbsideLbs) : 0,
    co2eAvoidedKg: round2(rows.reduce((acc, row) => acc + row.co2eKg, 0)),
    streamCounts,
    rows
  };
}

const CONFLICT_KIND_LABELS = Object.freeze({
  ACCEPTED_TO_CONTAMINANT: "Rule conflict",
  CURBSIDE_TO_DROPOFF: "Cart to drop-off",
  DIVERSION_LOST: "Diversion lost",
  DIVERSION_GAINED: "Diversion gained",
  STREAM_CHANGE: "Stream change"
});

/**
 * Classifies how one item's routing changes between an ordered pair of
 * profiles. The alert severity comes from the engine's own base risk score, so
 * a hazardous battery outranks a foam cup.
 */
function classifyConflict(verdictFrom, verdictTo, label, materialId) {
  const from = verdictFrom;
  const to = verdictTo;
  if (from.stream === to.stream) {
    return null;
  }
  const baseRisk = Math.max(from.baseRisk ?? 0, to.baseRisk ?? 0);
  const severity = baseRisk >= 85 ? "critical" : baseRisk >= 55 ? "warning" : "info";
  const fromDiverts = from.divertFraction > 0;
  const toDiverts = to.divertFraction > 0;
  const fromCurbside = from.curbside;
  const toCurbside = to.curbside;

  let kind = "STREAM_CHANGE";
  let message;
  if (fromCurbside && !toDiverts) {
    kind = "ACCEPTED_TO_CONTAMINANT";
    message = `${label}: accepted at the curb under ${from.profileId} but landfilled under ${to.profileId}. Wish-cycled into the ${to.profileId} cart it becomes a contaminant (risk ${to.risk}/100).`;
  } else if (fromCurbside && toDiverts && !toCurbside) {
    kind = "CURBSIDE_TO_DROPOFF";
    message = `${label}: cart-accepted under ${from.profileId} but needs a drop-off trip under ${to.profileId}. Binned anyway, it contaminates the cart (risk ${to.risk}/100).`;
  } else if (fromDiverts && !toDiverts) {
    kind = "DIVERSION_LOST";
    message = `${label}: diverted under ${from.profileId} (${WORKBENCH_STREAM_LABELS[from.stream]}) but landfilled under ${to.profileId}.`;
  } else if (!fromDiverts && toDiverts) {
    kind = "DIVERSION_GAINED";
    message = `${label}: landfilled under ${from.profileId} but diverted under ${to.profileId} (${WORKBENCH_STREAM_LABELS[to.stream]}).`;
    return { kind, severity: "info", message, materialId, itemLabel: label, fromProfile: from.profileId, toProfile: to.profileId, fromStream: from.stream, toStream: to.stream };
  } else {
    kind = "STREAM_CHANGE";
    message = `${label}: ${WORKBENCH_STREAM_LABELS[from.stream]} under ${from.profileId}, ${WORKBENCH_STREAM_LABELS[to.stream]} under ${to.profileId}.`;
  }
  return { kind, severity, message, materialId, itemLabel: label, fromProfile: from.profileId, toProfile: to.profileId, fromStream: from.stream, toStream: to.stream };
}

export const CONFLICT_KIND_LABELS_EXPORTED = CONFLICT_KIND_LABELS;

/**
 * The core comparator: one basket sorted under two profiles, per-item routing
 * rows, every rule-conflict alert in both directions, and the headline deltas
 * (diversion, curbside-only diversion, naive-cart contamination, CO2e).
 */
export function compareProfiles(profileA, profileB, basketId = DEFAULT_BASKET_ID) {
  const a = evaluateBasket(basketId, profileA);
  const b = evaluateBasket(basketId, profileB);

  const rows = a.rows.map((rowA, index) => {
    const rowB = b.rows[index];
    return {
      materialId: rowA.materialId,
      label: rowA.label,
      weightLbs: rowA.weightLbs,
      a: { stream: rowA.stream, badgeLabel: rowA.badgeLabel, note: rowA.note, curbside: rowA.curbside },
      b: { stream: rowB.stream, badgeLabel: rowB.badgeLabel, note: rowB.note, curbside: rowB.curbside },
      changed: rowA.stream !== rowB.stream
    };
  });

  const conflicts = [];
  for (let i = 0; i < a.rows.length; i += 1) {
    const forward = classifyConflict(a.rows[i], b.rows[i], a.rows[i].label, a.rows[i].materialId);
    if (forward) conflicts.push(forward);
    const backward = classifyConflict(b.rows[i], a.rows[i], a.rows[i].label, a.rows[i].materialId);
    if (backward) conflicts.push(backward);
  }
  const severityRank = { critical: 0, warning: 1, info: 2 };
  conflicts.sort(
    (x, y) =>
      severityRank[x.severity] - severityRank[y.severity] ||
      x.materialId.localeCompare(y.materialId) ||
      x.kind.localeCompare(y.kind)
  );

  return {
    basketId: a.basketId,
    basketName: a.basketName,
    a,
    b,
    rows,
    conflicts,
    diversionDeltaPts: round1(a.diversionRatePct - b.diversionRatePct),
    curbsideDeltaPts: round1(a.curbsideRatePct - b.curbsideRatePct),
    co2eDeltaKg: round2(a.co2eAvoidedKg - b.co2eAvoidedKg),
    trashDeltaLbs: round2(a.trashLbs - b.trashLbs),
    rulesSnapshot: { ...RULES_SNAPSHOT_META }
  };
}

export function defaultWorkbenchConfig() {
  return {
    profileA: "Riverside-tx",
    profileB: "dual-stream-glass-out",
    basketId: DEFAULT_BASKET_ID
  };
}
