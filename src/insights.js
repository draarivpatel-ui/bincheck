/**
 * BinCheck insights: plain-language verdicts, instant item search and the
 * contamination calculator. Pure functions over the rules engine, so every
 * number they produce is an engine score or threshold, never a typed-in figure.
 */

import {
  MATERIAL_CATEGORIES,
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

let searchIndex = null;

function buildSearchIndex() {
  const entries = [];
  for (const item of VERIFIED_BARCODE_CATALOG) {
    const material = MATERIAL_CATEGORIES[item.materialId];
    entries.push({
      kind: "barcode",
      value: item.upc,
      title: item.productName,
      sub: `${item.brand}, UPC ${item.upc}, demo data`,
      query: { barcode: item.upc, materialId: item.materialId, resinCode: item.resinCode, condition: "clean" },
      haystack: [item.productName, item.brand, item.packagingSummary, material ? material.title : "", item.upc].join(" ").toLowerCase()
    });
  }
  for (const [id, material] of Object.entries(MATERIAL_CATEGORIES)) {
    entries.push({
      kind: "material",
      value: id,
      title: material.title,
      sub: "Material category",
      query: { materialId: id, condition: "clean" },
      haystack: [material.title, id.replace(/-/g, " ")].join(" ").toLowerCase()
    });
  }
  return entries;
}

/**
 * Instant search over the 28 demo catalog products and 17 material categories.
 * Every whitespace-separated term must appear. Results carry the verdict for
 * both cities so a divergence is visible before anything is opened.
 */
export function searchItems(rawQuery, { limit = 8 } = {}) {
  const q = String(rawQuery ?? "").toLowerCase().trim();
  if (!q) return { query: "", total: 0, results: [] };
  if (!searchIndex) searchIndex = buildSearchIndex();
  const terms = q.split(/\s+/).filter(Boolean).slice(0, 8);
  const matches = [];
  for (const entry of searchIndex) {
    if (!terms.every((t) => entry.haystack.includes(t))) continue;
    const title = entry.title.toLowerCase();
    const rank = title.startsWith(terms[0]) ? 0 : title.includes(terms[0]) ? 1 : 2;
    matches.push({ entry, rank });
  }
  matches.sort((a, b) => a.rank - b.rank || (a.entry.kind === b.entry.kind ? 0 : a.entry.kind === "material" ? -1 : 1) || a.entry.title.localeCompare(b.entry.title));
  const results = matches.slice(0, limit).map(({ entry }) => {
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
  return { query: q, total: matches.length, results };
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
