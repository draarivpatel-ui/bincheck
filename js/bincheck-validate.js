/**
 * BinCheck input validation, evidence assessment, and share-link codec.
 *
 * Every function here is pure and deterministic (no DOM, no clock, no network).
 *
 * "Confidence" in BinCheck is NOT a statistical probability. It describes HOW an
 * item was identified (demo catalog barcode, a category you picked, a resin
 * stamp only, or a default rule when nothing was identified) and whether the
 * inputs contradict each other. The rules are listed in EVIDENCE_BASES below.
 */

import {
  SUPPORTED_CITIES,
  RESIN_CODE_METADATA,
  MATERIAL_CATEGORIES,
  validateBarcodeCheckDigit,
  lookupProductByBarcode,
  resolveMaterialProfile
} from "./bincheck-engine.js";

export const RULES_SNAPSHOT_META = Object.freeze({
  schemaVersion: "2026.10",
  lastVerifiedDate: "2026-10-20"
});

export const VALID_CONDITIONS = Object.freeze(["clean", "greasy", "liquid-full", "broken"]);
export const CITY_IDS = Object.freeze(Object.keys(SUPPORTED_CITIES));
export const MATERIAL_IDS = Object.freeze(Object.keys(MATERIAL_CATEGORIES));
export const CITY_MODES = Object.freeze([...CITY_IDS, "compare"]);

export const EVIDENCE_BASES = Object.freeze([
  Object.freeze({
    id: "CATALOG_MATCH",
    rank: 1,
    label: "Demo catalog barcode match",
    confidence: "HIGH",
    detail: "The barcode passed the GS1 check digit and matched one of the demo catalog products."
  }),
  Object.freeze({
    id: "USER_CATEGORY",
    rank: 2,
    label: "Category chosen by you",
    confidence: "MEDIUM",
    detail: "The rule comes from the material category you picked. BinCheck cannot confirm the physical item."
  }),
  Object.freeze({
    id: "RESIN_CODE",
    rank: 3,
    label: "SPI resin code only",
    confidence: "MEDIUM",
    detail: "Only a resin stamp was given, so the default item for that polymer was used."
  }),
  Object.freeze({
    id: "FALLBACK_DEFAULT",
    rank: 4,
    label: "Default rule, no item identified",
    confidence: "LOW",
    detail: "Nothing usable was supplied, so the engine default (#1 PET bottle) was used. Do not rely on this result."
  })
]);

const LIQUID_CAPABLE = new Set(["resin-1-pet", "resin-2-hdpe", "liquid-full-bottle"]);
const GLASS_MATERIALS = new Set(["glass-jar-bottle", "broken-glass-ceramic"]);

function issue(code, severity, field, message) {
  return { code, severity, field, message };
}

export function normalizeMaterialToken(token) {
  const cleaned = String(token ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
  return Object.hasOwn(MATERIAL_CATEGORIES, cleaned) ? cleaned : null;
}

/**
 * Parses a resin code from a number or text such as "3", "#3", or " 3 ".
 * Returns { empty, valid, code }.
 */
export function parseResinCode(value) {
  if (value === undefined || value === null) {
    return { empty: true, valid: false, code: null };
  }
  const text = String(value).trim().replace(/^#/, "");
  if (text === "") {
    return { empty: true, valid: false, code: null };
  }
  if (!/^\d+$/.test(text)) {
    return { empty: false, valid: false, code: null };
  }
  const code = Number(text);
  if (!Object.hasOwn(RESIN_CODE_METADATA, code)) {
    return { empty: false, valid: false, code: null };
  }
  return { empty: false, valid: true, code };
}

/**
 * Validates and normalizes a raw item query. Never throws. Unknown or malformed
 * fields are dropped from the returned query and reported in `issues`.
 */
export function normalizeQuery(raw = {}) {
  const input = raw && typeof raw === "object" ? raw : {};
  const issues = [];
  const query = {};

  if (input.city !== undefined && input.city !== null && input.city !== "") {
    if (CITY_IDS.includes(input.city)) {
      query.city = input.city;
    } else {
      issues.push(issue("INVALID_CITY", "error", "city", `Unknown jurisdiction "${String(input.city).slice(0, 40)}". Use Riverside-tx or houston-tx.`));
    }
  }

  const barcode = String(input.barcode ?? "").trim();
  if (barcode !== "") {
    query.barcode = barcode;
  }

  const materialRaw = String(input.materialId ?? input.material ?? "").trim();
  if (materialRaw !== "") {
    const materialId = normalizeMaterialToken(materialRaw);
    if (materialId) {
      query.materialId = materialId;
    } else {
      issues.push(issue("UNKNOWN_MATERIAL", "error", "materialId", `Unknown material "${materialRaw.slice(0, 40)}". Choose one of the ${MATERIAL_IDS.length} material categories.`));
    }
  }

  const resinParsed = parseResinCode(input.resinCode ?? input.resin);
  if (resinParsed.valid) {
    query.resinCode = resinParsed.code;
  } else if (!resinParsed.empty) {
    issues.push(issue("INVALID_RESIN", "error", "resinCode", "Resin code must be a whole number from 1 to 7."));
  }

  const conditionRaw = String(input.condition ?? "").trim().toLowerCase();
  if (conditionRaw === "") {
    query.condition = "clean";
  } else if (VALID_CONDITIONS.includes(conditionRaw)) {
    query.condition = conditionRaw;
  } else {
    query.condition = "clean";
    issues.push(issue("UNKNOWN_CONDITION", "warning", "condition", `Unknown condition "${conditionRaw.slice(0, 40)}". Treated as clean.`));
  }

  return { query, issues };
}

/**
 * Explains how an item was identified and how far to trust the result.
 * Returns { basis, basisLabel, basisDetail, confidence, confidenceReason, issues,
 *           query, resolvedMaterialId, catalogProduct }.
 */
export function assessEvidence(raw = {}) {
  const { query, issues: normalizeIssues } = normalizeQuery(raw);
  const issues = [...normalizeIssues];

  let barcodeCheck = null;
  let catalogProduct = null;
  if (query.barcode) {
    barcodeCheck = validateBarcodeCheckDigit(query.barcode);
    if (!barcodeCheck.valid) {
      issues.push(issue("BARCODE_INVALID", "warning", "barcode", barcodeCheck.reason));
    } else {
      const lookup = lookupProductByBarcode(query.barcode);
      catalogProduct = lookup.product;
      if (!catalogProduct) {
        issues.push(issue("BARCODE_NOT_IN_CATALOG", "info", "barcode", "Valid barcode, but it is not in the demo catalog. The rule uses your selected category."));
      }
    }
  }

  const hasMaterial = Boolean(query.materialId);
  const hasResin = query.resinCode !== undefined;
  let basis;
  let conflict = false;

  if (catalogProduct && (!hasMaterial || query.materialId === catalogProduct.materialId)) {
    basis = "CATALOG_MATCH";
  } else if (catalogProduct && hasMaterial) {
    conflict = true;
    basis = "USER_CATEGORY";
    issues.push(issue("BARCODE_MATERIAL_CONFLICT", "warning", "materialId", `The catalog lists this barcode as ${catalogProduct.materialId}, but ${query.materialId} was selected. The selected category is used.`));
  } else if (hasMaterial) {
    basis = "USER_CATEGORY";
  } else if (hasResin) {
    basis = "RESIN_CODE";
  } else {
    basis = "FALLBACK_DEFAULT";
    issues.push(issue("NO_ITEM_IDENTIFIED", "warning", "item", "No barcode match, category, or resin code was supplied."));
  }

  const profile = resolveMaterialProfile(query);
  const resolvedMaterialId = profile.category.id;
  const rawMaterialId = query.materialId || (catalogProduct ? catalogProduct.materialId : null);

  if (hasResin && rawMaterialId && Object.hasOwn(MATERIAL_CATEGORIES, rawMaterialId)) {
    const identifiedResin = MATERIAL_CATEGORIES[rawMaterialId].resinCode;
    if (query.resinCode !== identifiedResin) {
      conflict = true;
      const resinDescription = identifiedResin === null ? "no plastic resin code" : `resin code ${identifiedResin}`;
      issues.push(issue("RESIN_MATERIAL_CONFLICT", "warning", "resinCode", `Resin code ${query.resinCode} contradicts ${rawMaterialId}, which has ${resinDescription}. The identified material is used.`));
    }
  }

  if (query.condition === "liquid-full" && rawMaterialId && !LIQUID_CAPABLE.has(rawMaterialId)) {
    issues.push(issue("CONDITION_NOT_APPLICABLE", "warning", "condition", "The liquid condition only changes the rule for #1 PET and #2 HDPE bottles. It was ignored for this material."));
  }
  if (query.condition === "broken" && rawMaterialId && !GLASS_MATERIALS.has(rawMaterialId)) {
    issues.push(issue("CONDITION_NOT_APPLICABLE", "warning", "condition", "The broken condition only changes the rule for glass. It was ignored for this material."));
  }
  if (query.condition === "greasy" && resolvedMaterialId === "soiled-cardboard-paper") {
    issues.push(issue("GREASY_PAPER_ADVISORY", "warning", "condition", "Grease-soaked paper cannot be repulped, so the city pizza box rule is applied: recycle only the clean part and trash the soiled part. Applying that rule beyond pizza boxes is an inference."));
  }

  const baseEntry = EVIDENCE_BASES.find((entry) => entry.id === basis);
  let confidence = baseEntry.confidence;
  const reasons = [baseEntry.detail];
  const barcodeInvalid = barcodeCheck !== null && !barcodeCheck.valid;
  if (conflict) {
    confidence = "LOW";
    reasons.push("Inputs contradict each other.");
  } else if (barcodeInvalid && confidence !== "LOW") {
    confidence = "LOW";
    reasons.push("The barcode failed its check digit, so it cannot support the result.");
  }

  return {
    basis,
    basisLabel: baseEntry.label,
    basisDetail: baseEntry.detail,
    confidence,
    confidenceReason: reasons.join(" "),
    issues,
    query,
    resolvedMaterialId,
    catalogProduct
  };
}

/**
 * Encodes shareable state as a URL hash. Deterministic key order.
 * Accepts { cityMode, barcode, materialId, resinCode, condition }.
 */
export function encodeShareHash(state = {}) {
  const parts = [];
  const add = (key, value) => {
    if (value !== undefined && value !== null && String(value) !== "") {
      parts.push(`${key}=${encodeURIComponent(String(value))}`);
    }
  };
  if (CITY_MODES.includes(state.cityMode)) {
    add("c", state.cityMode);
  }
  const barcodeDigits = String(state.barcode ?? "").replace(/[\s-]/g, "");
  // Decoder accepts only digit barcodes up to 14 chars; never emit one it would reject.
  if (/^\d{1,14}$/.test(barcodeDigits)) {
    add("b", barcodeDigits);
  }
  if (normalizeMaterialToken(state.materialId)) {
    add("m", state.materialId);
  }
  const resin = parseResinCode(state.resinCode);
  if (resin.valid) {
    add("r", resin.code);
  }
  if (VALID_CONDITIONS.includes(state.condition)) {
    add("k", state.condition);
  }
  return parts.length ? `#${parts.join("&")}` : "";
}

/**
 * Decodes a share hash into a validated state patch. Unknown keys and invalid
 * values are dropped and reported in `issues`. Never throws.
 */
export function decodeShareHash(hash) {
  const patch = {};
  const issues = [];
  const text = String(hash ?? "").replace(/^#/, "");
  if (text === "" || text.length > 400) {
    if (text.length > 400) {
      issues.push(issue("HASH_TOO_LONG", "warning", "hash", "Share link is longer than expected and was ignored."));
    }
    return { patch, issues };
  }
  const seen = new Set();
  for (const pair of text.split("&")) {
    const eq = pair.indexOf("=");
    if (eq < 1) {
      continue;
    }
    const key = pair.slice(0, eq);
    let value;
    try {
      value = decodeURIComponent(pair.slice(eq + 1));
    } catch {
      issues.push(issue("HASH_BAD_ENCODING", "warning", key, "A share link value could not be decoded."));
      continue;
    }
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    if (key === "c") {
      if (CITY_MODES.includes(value)) {
        patch.cityMode = value;
      } else {
        issues.push(issue("INVALID_CITY", "warning", "c", "Share link jurisdiction was not recognized."));
      }
    } else if (key === "b") {
      if (/^\d{0,14}$/.test(value)) {
        patch.barcode = value;
      } else {
        issues.push(issue("BARCODE_INVALID", "warning", "b", "Share link barcode must contain digits only."));
      }
    } else if (key === "m") {
      const id = normalizeMaterialToken(value);
      if (id) {
        patch.materialId = id;
      } else {
        issues.push(issue("UNKNOWN_MATERIAL", "warning", "m", "Share link material was not recognized."));
      }
    } else if (key === "r") {
      const resin = parseResinCode(value);
      if (resin.valid) {
        patch.resinCode = resin.code;
      } else {
        issues.push(issue("INVALID_RESIN", "warning", "r", "Share link resin code must be 1 to 7."));
      }
    } else if (key === "k") {
      if (VALID_CONDITIONS.includes(value)) {
        patch.condition = value;
      } else {
        issues.push(issue("UNKNOWN_CONDITION", "warning", "k", "Share link condition was not recognized."));
      }
    }
  }
  return { patch, issues };
}
