/**
 * BinCheck insights: plain-language verdicts, instant item search and the
 * contamination calculator. Pure functions over the rules engine, so every
 * number they produce is an engine score or threshold, never a typed-in figure.
 */

import {
  MATERIAL_CATEGORIES,
  RESIN_CODE_METADATA,
  VERIFIED_BARCODE_CATALOG,
  evaluateItemDisposal,
  scoreCartBatch
} from "../js/bincheck-engine.js";

/** The five engine streams as one-word verdicts. GREEN_WASTE is the city yard waste program. */
export const VERDICTS = Object.freeze({
  RECYCLE_CART: Object.freeze({ key: "recycle", word: "Recycle", where: "Curbside recycling cart" }),
  TRASH_CART: Object.freeze({ key: "trash", word: "Trash", where: "Garbage cart" }),
  SPECIAL_DROPOFF: Object.freeze({ key: "dropoff", word: "Drop-off", where: "Take it to a drop-off site" }),
  GREEN_WASTE: Object.freeze({ key: "yard", word: "Yard waste", where: "City yard waste collection" }),
  SPLIT_DISPOSAL: Object.freeze({ key: "split", word: "Split it", where: "Part recycles, part goes in the trash" })
});

export function verdictFor(stream) {
  return VERDICTS[stream] || { key: "unknown", word: String(stream), where: "" };
}

/** A clean #1 PET bottle: the baseline "good" item for the calculator. */
export const CLEAN_BASELINE_ITEM = Object.freeze({ materialId: "resin-1-pet", condition: "clean" });

export const LOAD_THRESHOLDS = Object.freeze({ moderate: 25, high: 55, reject: 85 });

/**
 * Household words that mean a thing in this domain but never appear in the
 * product names or material titles. Keyed by material id / UPC so the index
 * stays data, not code. Kept short and concrete: aliases a resident would
 * actually type.
 */
const MATERIAL_SEARCH_ALIASES = {
  "resin-1-pet": "water bottle soda bottle clear plastic pet pete drink beverage gatorade sparkling",
  "resin-2-hdpe": "plastic milk jug detergent shampoo bleach laundry cleaner opaque gallon",
  "resin-3-pvc": "plastic pvc vinyl pipe plumbing blister pack shower curtain tubing",
  "resin-4-ldpe-film": "plastic bag grocery bag film wrap shrink bubble bread dry cleaning ziplock sandwich baggie saran cling bagged",
  "resin-5-pp": "plastic yogurt tub takeout container black tray deli butter margarine tupperware food medicine caps lids lid foil peel",
  "resin-6-ps-foam": "plastic styrofoam foam cup clamshell takeout egg carton packing peanuts solo disposable party to-go",
  "resin-7-other": "plastic chip bag juice pouch multi layer compostable pla bioplastic ice cream carton coated paperboard tetra pak coffee cup paper hot",
  "glass-jar-bottle": "glass jar bottle wine beer drinking intact unbroken",
  "broken-glass-ceramic": "broken glass drinking shattered mirror pyrex ceramic mug plate dish glassware cracked cup",
  "aluminum-steel-can": "aluminum can steel tin soda crushed soup bean food aerosol spray",
  "soiled-foil-tray": "aluminum foil tray pan baking tin reynolds greasy",
  "clean-cardboard-paper": "cardboard box paper newspaper magazine office shredded cereal mailer amazon shipping moving corrugated mail junk",
  "greasy-pizza-box": "pizza box greasy cardboard oily stained delivery",
  "lithium-household-battery": "battery batteries lithium ion aa aaa rechargeable button cell alkaline duracell energizer batery battary",
  "electronics-ewaste": "electronics ewaste cords cables chargers tv television computer monitor toaster appliance christmas lights string phone laptop",
  "yard-trimmings-brush": "yard leaves grass clippings branches brush tree trimmings lawn garden",
  "liquid-full-bottle": "half full liquid juice soda water leftover"
};

const CATALOG_SEARCH_ALIASES = {
  "049000028904": "coke cola soda cans",
  "049000006346": "coke cola soda can",
  "078000082166": "dr pepper soda bottle",
  "072554000027": "water gallon jug",
  "041220948321": "milk gallon jug",
  "037000973072": "tide detergent laundry",
  "044600015996": "bleach clorox",
  "021131500269": "topo chico sparkling water glass",
  "041220794386": "salsa jar glass",
  "051000012517": "soup can campbells tomato",
  "041220192847": "beans can",
  "818290012630": "chobani yogurt greek cup foil lid",
  "041220831043": "sour cream tub dairy",
  "071892102059": "ketchup whataburger squeeze",
  "071892300110": "blue bell ice cream carton coated",
  "073287001060": "dart foam cups styrofoam coffee",
  "041220400126": "grocery bags plastic heb",
  "013700021107": "hefty trash bags garbage drawstring",
  "010900001120": "reynolds foil aluminum wrap",
  "041333415017": "duracell batteries aa",
  "039800084118": "energizer batteries lithium aa",
  "072140001056": "pizza box digiorno delivery",
  "041220660018": "shipping box amazon cardboard",
  "028400589864": "doritos lays chips snack crisps",
  "075925301129": "capri sun juice pouch",
  "041220311088": "lawn leaf yard bags kraft"
};

/**
 * Filler words that carry no item signal. Condition words (rinsed, greasy,
 * empty) are dropped too: condition is a separate control, not search text.
 * Kept "can", "box", "broken" and "bag" out on purpose: they pick materials.
 */
const SEARCH_STOPWORDS = new Set([
  "a", "an", "the", "in", "on", "of", "with", "and", "or", "to", "for", "from",
  "my", "is", "it", "its", "that", "this", "these", "those", "vs", "do", "does",
  "be", "are", "was", "at", "by", "out", "up", "still", "i", "me", "we", "you",
  "your", "some", "any", "all", "how", "what", "which", "where", "number", "code",
  "symbol", "type", "kind", "sort", "item", "thing", "stuff",
  "rinsed", "rinse", "washed", "clean", "dirty", "greasy", "oily", "empty",
  "half", "full", "filled", "leftover", "used", "new", "old", "unused", "open",
  "opened", "unopened", "wet", "dry"
]);

let searchIndex = null;

function foldText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase();
}


/** Singular-form guesses for one already-folded term. Substring matching does the rest. */
function termForms(term) {
  const forms = [term];
  if (term.length > 3 && term.endsWith("ies")) {
    forms.push(`${term.slice(0, -3)}y`);
  }
  if (term.length > 3 && /(s|ch|sh|x|z)es$/.test(term)) {
    forms.push(term.slice(0, -2));
  }
  if (term.length > 2 && term.endsWith("s") && !term.endsWith("ss")) {
    forms.push(term.slice(0, -1));
  }
  return forms;
}

/** One query term matched against one entry. Returns a hit weight, 0 for no match. */
function matchTerm(term, entry) {
  const resin = term.match(/^#?(\d+)$/);
  if (resin && term.length <= 3) {
    const code = Number(resin[1]);
    return entry.resinCode === code ? 2 : 0;
  }
  if (/^\d{8,14}$/.test(term)) {
    return entry.kind === "barcode" && entry.value === term ? 3 : 0;
  }
  for (const form of termForms(term)) {
    if (entry.haystack.includes(form)) {
      return 1;
    }
  }
  return 0;
}

function buildSearchIndex() {
  const entries = [];
  for (const item of VERIFIED_BARCODE_CATALOG) {
    const material = MATERIAL_CATEGORIES[item.materialId];
    const resinMeta = item.resinCode ? RESIN_CODE_METADATA[item.resinCode] : null;
    entries.push({
      kind: "barcode",
      value: item.upc,
      title: item.productName,
      sub: `${item.brand}, UPC ${item.upc}, demo data`,
      query: { barcode: item.upc, materialId: item.materialId, resinCode: item.resinCode, condition: "clean" },
      resinCode: item.resinCode ?? material?.resinCode ?? null,
      haystack: foldText([
        item.productName,
        item.brand,
        item.packagingSummary,
        material ? material.title : "",
        material && MATERIAL_SEARCH_ALIASES[material.id] ? MATERIAL_SEARCH_ALIASES[material.id] : "",
        resinMeta ? resinMeta.commonItems : "",
        CATALOG_SEARCH_ALIASES[item.upc] || "",
        item.upc
      ].join(" "))
    });
  }
  for (const [id, material] of Object.entries(MATERIAL_CATEGORIES)) {
    const resinMeta = material.resinCode ? RESIN_CODE_METADATA[material.resinCode] : null;
    entries.push({
      kind: "material",
      value: id,
      title: material.title,
      sub: "Material category",
      query: { materialId: id, condition: "clean" },
      resinCode: material.resinCode,
      haystack: foldText([
        material.title,
        id.replace(/-/g, " "),
        MATERIAL_SEARCH_ALIASES[id] || "",
        resinMeta ? resinMeta.commonItems : ""
      ].join(" "))
    });
  }
  return entries;
}

/**
 * Instant search over the 28 demo catalog products and 17 material categories.
 * Every whitespace-separated term must appear, matching on singular forms,
 * aliases and resin stamps after diacritic folding. When no entry matches
 * every term, the strongest partial matches are returned flagged `partial`
 * instead of a dead end. Results carry the verdict for both cities so a
 * divergence is visible before anything is opened.
 */
export function searchItems(rawQuery, { limit = 8 } = {}) {
  const q = foldText(rawQuery).trim();
  if (!q) return { query: "", total: 0, results: [], partial: false };
  if (!searchIndex) searchIndex = buildSearchIndex();
  const terms = q
    .split(/\s+/)
    .filter((t) => t && !SEARCH_STOPWORDS.has(t))
    .slice(0, 8);
  if (terms.length === 0) return { query: q, total: 0, results: [], partial: false };

  const scored = [];
  for (const entry of searchIndex) {
    let matched = 0;
    let weight = 0;
    for (const term of terms) {
      const w = matchTerm(term, entry);
      if (w > 0) {
        matched += 1;
        weight += w;
      }
    }
    if (matched === 0) continue;
    const title = foldText(entry.title);
    const titleRank = title.startsWith(terms[0]) ? 0 : title.includes(terms[0]) ? 1 : 2;
    scored.push({ entry, matched, weight, titleRank });
  }

  const full = scored.filter((s) => s.matched === terms.length);
  const usePartial = full.length === 0;
  const pool = usePartial
    ? scored.filter((s) => s.matched >= Math.max(1, Math.ceil(terms.length / 2)) || s.weight >= 2)
    : full;
  pool.sort(
    (a, b) =>
      b.matched - a.matched ||
      b.weight - a.weight ||
      a.titleRank - b.titleRank ||
      (a.entry.kind === b.entry.kind ? 0 : a.entry.kind === "material" ? -1 : 1) ||
      a.entry.title.localeCompare(b.entry.title)
  );
  const results = pool.slice(0, limit).map(({ entry }) => {
    const sl = evaluateItemDisposal({ ...entry.query, city: "sugar-land-tx" });
    const ho = evaluateItemDisposal({ ...entry.query, city: "houston-tx" });
    return {
      kind: entry.kind,
      value: entry.value,
      title: entry.title,
      sub: entry.sub,
      sugarLand: { stream: sl.stream, verdict: verdictFor(sl.stream), risk: sl.contaminationRiskScore },
      houston: { stream: ho.stream, verdict: verdictFor(ho.stream), risk: ho.contaminationRiskScore },
      citiesDiffer: sl.stream !== ho.stream
    };
  });
  return { query: q, total: pool.length, results, partial: usePartial && results.length > 0 };
}

function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/**
 * What happens to a curbside load when `itemCount` copies of the current item
 * join `cleanCount` clean #1 PET bottles. Runs the engine's own scoreCartBatch,
 * so the status follows the same max-risk rule and 25 / 55 / 85 thresholds.
 */
export function computeContaminationImpact({ query = {}, city = "sugar-land-tx", cleanCount = 20, itemCount = 1 } = {}) {
  const clean = clampInt(cleanCount, 0, 40, 20);
  const count = clampInt(itemCount, 0, 5, 1);
  const safeCity = city === "houston-tx" ? "houston-tx" : "sugar-land-tx";
  const items = [
    ...Array.from({ length: clean }, () => ({ ...CLEAN_BASELINE_ITEM })),
    ...Array.from({ length: count }, () => ({ ...query }))
  ];
  const summary = scoreCartBatch(items, safeCity);
  const itemEval = evaluateItemDisposal({ ...query, city: safeCity });
  const cleanEval = evaluateItemDisposal({ ...CLEAN_BASELINE_ITEM, city: safeCity });
  const cleanOnly = scoreCartBatch(Array.from({ length: Math.max(1, clean) }, () => ({ ...CLEAN_BASELINE_ITEM })), safeCity);
  const itemBelongsCurbside = itemEval.stream === "RECYCLE_CART";
  const wrongItems = itemBelongsCurbside ? 0 : count;
  const total = clean + count;
  return {
    city: safeCity,
    cleanCount: clean,
    itemCount: count,
    total,
    itemTitle: itemEval.itemTitle,
    itemStream: itemEval.stream,
    itemVerdict: verdictFor(itemEval.stream),
    itemRisk: itemEval.contaminationRiskScore,
    itemTier: itemEval.contaminationTier,
    cleanRisk: cleanEval.contaminationRiskScore,
    averageRiskScore: summary.averageRiskScore,
    maxRiskScore: summary.maxRiskScore,
    loadStatus: summary.loadStatus,
    cleanOnlyStatus: cleanOnly.loadStatus,
    wrongItems,
    wrongShare: total > 0 ? wrongItems / total : 0,
    averageHidesProblem:
      count > 0 && summary.averageRiskScore < LOAD_THRESHOLDS.moderate && summary.loadStatus !== "CLEAN_CURBSIDE_LOAD"
  };
}
