/**
 * BinCheck UI state: pure reducer, view-model selector, and keyboard shortcut map.
 * No DOM access. Every transition is unit tested.
 */

import {
  RESIN_CODE_METADATA,
  lookupProductByBarcode,
  validateBarcodeCheckDigit,
  evaluateItemDisposal,
  compareJurisdictions,
  scoreCartBatch
} from "../js/bincheck-engine.js";
import {
  CITY_MODES,
  VALID_CONDITIONS,
  MATERIAL_IDS,
  assessEvidence,
  encodeShareHash
} from "../js/bincheck-validate.js";
import { runBatchFromCsv, SAMPLE_BATCH_CSV } from "../js/bincheck-batch.js";

export const MAX_CART_ITEMS = 50;

export const SHORTCUTS = Object.freeze([
  Object.freeze({ key: "/", id: "focus-barcode", description: "Focus the barcode field" }),
  Object.freeze({ key: "s", id: "city-sugar-land-tx", description: "Show Sugar Land rules" }),
  Object.freeze({ key: "h", id: "city-houston-tx", description: "Show Houston rules" }),
  Object.freeze({ key: "c", id: "city-compare", description: "Compare both cities side by side" }),
  Object.freeze({ key: "a", id: "add-to-cart", description: "Add the current item to the virtual cart" }),
  Object.freeze({ key: "b", id: "goto-batch", description: "Jump to batch CSV inspection" }),
  Object.freeze({ key: "r", id: "run-benchmark", description: "Run the calibration benchmark" }),
  Object.freeze({ key: "p", id: "print-report", description: "Print the inspection report" }),
  Object.freeze({ key: "?", id: "open-help", description: "Show this shortcut list" }),
  Object.freeze({ key: "Escape", id: "close-help", description: "Close the shortcut list" })
]);

export function createInitialState(overrides = {}) {
  return {
    cityMode: "sugar-land-tx",
    barcode: "041220576463",
    draftBarcode: null,
    materialId: "resin-1-pet",
    resinCode: 1,
    condition: "clean",
    batchItems: [
      { barcode: "041220576463", materialId: "resin-1-pet", condition: "clean" },
      { barcode: "049000006346", materialId: "aluminum-steel-can", condition: "clean" },
      { barcode: "041220794386", materialId: "glass-jar-bottle", condition: "clean" }
    ],
    csvText: "",
    batchResult: null,
    benchmarkResult: null,
    notice: "",
    ...overrides
  };
}

function resinFromMaterial(materialId) {
  const match = String(materialId).match(/^resin-(\d)/);
  return match ? Number(match[1]) : null;
}

/** Pure reducer. Unknown or invalid actions return the same state object. */
export function reduce(state, action) {
  if (!action || typeof action.type !== "string") {
    return state;
  }
  switch (action.type) {
    case "SET_CITY_MODE": {
      if (!CITY_MODES.includes(action.mode)) {
        return state;
      }
      return { ...state, cityMode: action.mode, notice: "" };
    }
    case "TYPE_BARCODE": {
      return { ...state, draftBarcode: String(action.raw ?? "").slice(0, 40) };
    }
    case "COMMIT_BARCODE": {
      const barcode = String(action.raw ?? "").trim().slice(0, 40);
      const next = { ...state, barcode, draftBarcode: null, notice: "" };
      const lookup = lookupProductByBarcode(barcode);
      if (lookup.found && lookup.product) {
        next.materialId = lookup.product.materialId;
        next.resinCode = lookup.product.resinCode;
        next.notice = `Matched ${lookup.product.productName}.`;
      } else if (barcode === "") {
        next.notice = "Barcode cleared.";
      } else if (!lookup.validation.valid) {
        next.notice = `Barcode rejected: ${lookup.validation.reason}`;
      } else {
        next.notice = "Valid barcode, not in the demo catalog. Using the selected category.";
      }
      return next;
    }
    case "SELECT_RESIN": {
      const code = Number(action.code);
      if (!Object.hasOwn(RESIN_CODE_METADATA, code)) {
        return state;
      }
      const meta = RESIN_CODE_METADATA[code];
      return {
        ...state,
        barcode: "",
        draftBarcode: null,
        resinCode: code,
        materialId: meta.defaultMaterialId,
        notice: `Resin code ${code} selected.`
      };
    }
    case "SELECT_MATERIAL": {
      if (!MATERIAL_IDS.includes(action.materialId)) {
        return state;
      }
      return {
        ...state,
        barcode: "",
        draftBarcode: null,
        materialId: action.materialId,
        resinCode: resinFromMaterial(action.materialId),
        notice: ""
      };
    }
    case "SET_CONDITION": {
      if (!VALID_CONDITIONS.includes(action.condition)) {
        return state;
      }
      return { ...state, condition: action.condition, notice: "" };
    }
    case "APPLY_DEMO": {
      const scenario = action.scenario;
      if (!scenario || !MATERIAL_IDS.includes(scenario.materialId)) {
        return state;
      }
      return {
        ...state,
        barcode: scenario.barcode || "",
        draftBarcode: null,
        materialId: scenario.materialId,
        resinCode: scenario.resinCode ?? null,
        condition: VALID_CONDITIONS.includes(scenario.condition) ? scenario.condition : "clean",
        cityMode: scenario.forceMode && CITY_MODES.includes(scenario.forceMode) ? scenario.forceMode : state.cityMode,
        notice: "Scenario loaded."
      };
    }
    case "ADD_TO_CART": {
      if (state.batchItems.length >= MAX_CART_ITEMS) {
        return { ...state, notice: `Cart is full (${MAX_CART_ITEMS} items). Remove an item first.` };
      }
      return {
        ...state,
        batchItems: [
          ...state.batchItems,
          {
            barcode: state.barcode,
            materialId: state.materialId,
            resinCode: state.resinCode,
            condition: state.condition
          }
        ],
        notice: `Item added. Cart now holds ${state.batchItems.length + 1}.`
      };
    }
    case "REMOVE_FROM_CART": {
      const index = Number(action.index);
      if (!Number.isInteger(index) || index < 0 || index >= state.batchItems.length) {
        return state;
      }
      return {
        ...state,
        batchItems: state.batchItems.filter((_, position) => position !== index),
        notice: "Item removed from the cart."
      };
    }
    case "CLEAR_CART": {
      return { ...state, batchItems: [], notice: "Cart emptied." };
    }
    case "HYDRATE": {
      const patch = action.patch || {};
      const next = { ...state };
      const hasBarcode = typeof patch.barcode === "string";
      const hasMaterial = MATERIAL_IDS.includes(patch.materialId);
      if (CITY_MODES.includes(patch.cityMode)) next.cityMode = patch.cityMode;
      if (hasBarcode) next.barcode = patch.barcode;
      if (hasMaterial) {
        next.materialId = patch.materialId;
        next.resinCode = resinFromMaterial(patch.materialId);
        if (!hasBarcode) next.barcode = "";
      }
      if (VALID_CONDITIONS.includes(patch.condition)) next.condition = patch.condition;
      if (hasBarcode && patch.barcode !== "" && !hasMaterial) {
        const lookup = lookupProductByBarcode(patch.barcode);
        if (lookup.found && lookup.product) {
          next.materialId = lookup.product.materialId;
          next.resinCode = lookup.product.resinCode;
        }
      }
      if (Number.isInteger(patch.resinCode) && Object.hasOwn(RESIN_CODE_METADATA, patch.resinCode)) {
        next.resinCode = patch.resinCode;
        if (!hasMaterial && (!hasBarcode || patch.barcode === "")) {
          next.barcode = "";
          next.materialId = RESIN_CODE_METADATA[patch.resinCode].defaultMaterialId;
        }
      }
      next.draftBarcode = null;
      return next;
    }
    case "SET_CSV_TEXT": {
      return { ...state, csvText: String(action.text ?? "") };
    }
    case "LOAD_SAMPLE_CSV": {
      return { ...state, csvText: SAMPLE_BATCH_CSV, batchResult: null, notice: "Synthetic sample CSV loaded. Choose Run inspection." };
    }
    case "RUN_BATCH": {
      const result = runBatchFromCsv(state.csvText);
      const blocking = result.rows.length === 0 && result.parse.errors.length > 0;
      return {
        ...state,
        batchResult: result,
        notice: blocking
          ? result.parse.errors[0].message
          : `Inspected ${result.totals.rows} rows: ${result.totals.evaluated} evaluated, ${result.totals.errors} could not be identified.`
      };
    }
    case "CLEAR_BATCH": {
      return { ...state, csvText: "", batchResult: null, notice: "Batch cleared." };
    }
    case "SET_BENCHMARK": {
      if (!action.result || !action.result.cart) {
        return state;
      }
      return {
        ...state,
        benchmarkResult: action.result,
        notice: `Benchmark finished: ${action.result.failures.length} failures across ${action.result.meta.scoredEvaluations} evaluations.`
      };
    }
    case "SET_NOTICE": {
      return { ...state, notice: String(action.text ?? "").slice(0, 400) };
    }
    case "CLEAR_NOTICE": {
      return state.notice === "" ? state : { ...state, notice: "" };
    }
    default:
      return state;
  }
}

function buildBarcodeStatus(raw) {
  const text = String(raw ?? "");
  if (text.trim() === "") {
    return {
      tone: "idle",
      invalid: false,
      text: "Enter any 12-digit UPC-A or 13-digit EAN-13 barcode, or choose a material category below."
    };
  }
  const lookup = lookupProductByBarcode(text);
  if (!lookup.validation.valid) {
    return { tone: "invalid", invalid: true, text: lookup.validation.reason };
  }
  if (lookup.found) {
    return {
      tone: "valid",
      invalid: false,
      text: `${lookup.validation.reason} Matched: ${lookup.product.productName} (${lookup.product.packagingSummary}).`
    };
  }
  return {
    tone: "valid",
    invalid: false,
    text: `${lookup.validation.reason} Not in the demo catalog; evaluating using the selected material or resin rule.`
  };
}

/** Derives everything the renderers need from state. Pure. */
export function selectViewModel(state) {
  const query = {
    barcode: state.barcode,
    materialId: state.materialId,
    resinCode: state.resinCode,
    condition: state.condition
  };
  const activeCity = state.cityMode === "houston-tx" ? "houston-tx" : "sugar-land-tx";
  const assessment = assessEvidence(query);
  const comparison = compareJurisdictions(query);
  const evaluation = state.cityMode === "compare" ? null : evaluateItemDisposal({ ...query, city: activeCity });
  const statusSource = state.draftBarcode !== null ? state.draftBarcode : state.barcode;
  const cartSummary = scoreCartBatch(state.batchItems, activeCity);
  const shown = evaluation || comparison.sugarLand;
  const liveSummary =
    state.cityMode === "compare"
      ? `${comparison.itemTitle}: ${comparison.sameStream ? "both cities use the same stream" : "the two cities differ"}. Sugar Land: ${comparison.sugarLand.badgeLabel}. Houston: ${comparison.houston.badgeLabel}.`
      : `${shown.itemTitle} in ${shown.shortCityName}: ${shown.badgeLabel}. Risk ${shown.contaminationRiskScore} of 100, ${shown.contaminationTier}. Confidence ${assessment.confidence.toLowerCase()}.`;

  return {
    query,
    activeCity,
    assessment,
    comparison,
    evaluation,
    barcodeStatus: buildBarcodeStatus(statusSource),
    barcodeCheck: statusSource && String(statusSource).trim() !== "" ? validateBarcodeCheckDigit(statusSource) : null,
    cartSummary,
    liveSummary,
    shareHash: encodeShareHash(state)
  };
}

/**
 * Maps a keydown description to an action id from SHORTCUTS, or null.
 * `event` is { key, ctrlKey, metaKey, altKey, targetTag, isContentEditable }.
 */
export function resolveShortcut(event) {
  if (!event || typeof event.key !== "string") {
    return null;
  }
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return null;
  }
  const tag = String(event.targetTag || "").toUpperCase();
  const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || event.isContentEditable === true;
  if (event.key === "Escape") {
    return "close-help";
  }
  if (typing) {
    return null;
  }
  const entry = SHORTCUTS.find((candidate) => candidate.key === event.key || candidate.key === event.key.toLowerCase());
  if (!entry || entry.key === "Escape") {
    return null;
  }
  return entry.id;
}
