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
import { runBatchFromCsv, runBatchFromBytes, SAMPLE_BATCH_CSV } from "../js/bincheck-batch.js";
import {
  normalizeProfileId,
  normalizeBasketId,
  compareProfiles,
  WORKBENCH_PRESETS
} from "../js/bincheck-municipal.js";
import { normalizeCascadeId, clampCascadeCount, runCascadeLab } from "../js/bincheck-cascade.js";
import {
  t,
  normalizeLang,
  SUPPORTED_LANGS,
  barcodeReasonEs,
  parseErrorMessageEs,
  tierLabelEs,
  confidenceLabelEs,
  localizeEvaluation,
  localizeComparison,
  localizeAssessment,
  localizeCartSummary,
  localizeDiff,
  localizeCascadeLab,
  PRESETS_ES
} from "../js/bincheck-i18n.js";

export const MAX_CART_ITEMS = 50;

export const SHORTCUTS = Object.freeze([
  Object.freeze({ key: "/", id: "focus-barcode", description: "Focus the barcode field" }),
  Object.freeze({ key: "s", id: "city-Riverside-tx", description: "Show Riverside rules" }),
  Object.freeze({ key: "h", id: "city-houston-tx", description: "Show Houston rules" }),
  Object.freeze({ key: "c", id: "city-compare", description: "Compare both cities side by side" }),
  Object.freeze({ key: "a", id: "add-to-cart", description: "Add the current item to the virtual cart" }),
  Object.freeze({ key: "b", id: "goto-batch", description: "Jump to batch CSV inspection" }),
  Object.freeze({ key: "r", id: "run-benchmark", description: "Run the calibration benchmark" }),
  Object.freeze({ key: "d", id: "download-report", description: "Download the inspection report as JSON" }),
  Object.freeze({ key: "p", id: "print-report", description: "Print the inspection report" }),
  Object.freeze({ key: "l", id: "language", description: "Switch between English and Spanish" }),
  Object.freeze({ key: "?", id: "open-help", description: "Show this shortcut list" }),
  Object.freeze({ key: "Escape", id: "close-help", description: "Close the shortcut list" })
]);

export function createInitialState(overrides = {}) {
  return {
    cityMode: "Riverside-tx",
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
    municipalProfileA: "Riverside-tx",
    municipalProfileB: "dual-stream-glass-out",
    municipalBasket: "tricky-household",
    cascadeCounts: {},
    workbenchPreset: null,
    selfTestResult: null,
    auditInput: "",
    auditResult: null,
    singleKeyShortcuts: true,
    language: "en",
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
  const lang = state.language === "es" ? "es" : "en";
  const reasonText = (validation) => (lang === "es" ? barcodeReasonEs(validation) : validation.reason);
  switch (action.type) {
    case "SET_LANGUAGE": {
      const language = normalizeLang(action.language);
      if (language === state.language) {
        return state;
      }
      return {
        ...state,
        language,
        notice: t(language, "notice.languageSet")
      };
    }
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
        next.notice = t(lang, "notice.matchedProduct", { name: lookup.product.productName });
      } else if (barcode === "") {
        next.notice = t(lang, "notice.barcodeCleared");
      } else if (!lookup.validation.valid) {
        next.notice = t(lang, "notice.barcodeRejected", { reason: reasonText(lookup.validation) });
      } else {
        next.notice = t(lang, "notice.barcodeNotInCatalog");
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
        notice: t(lang, "notice.resinSelected", { code })
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
        notice: t(lang, "notice.scenarioLoaded")
      };
    }
    case "ADD_TO_CART": {
      if (state.batchItems.length >= MAX_CART_ITEMS) {
        return { ...state, notice: t(lang, "notice.cartFull", { n: MAX_CART_ITEMS }) };
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
        notice: t(lang, "notice.itemAdded", { n: state.batchItems.length + 1 })
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
        notice: t(lang, "notice.itemRemoved")
      };
    }
    case "CLEAR_CART": {
      return { ...state, batchItems: [], notice: t(lang, "notice.cartEmptied") };
    }
    case "HYDRATE": {
      const patch = action.patch || {};
      const next = { ...state };
      const hasBarcode = typeof patch.barcode === "string";
      const hasMaterial = MATERIAL_IDS.includes(patch.materialId);
      if (SUPPORTED_LANGS.includes(patch.language)) next.language = normalizeLang(patch.language);
      if (CITY_MODES.includes(patch.cityMode)) next.cityMode = patch.cityMode;
      if (hasBarcode) next.barcode = patch.barcode;
      if (hasMaterial) {
        next.materialId = patch.materialId;
        next.resinCode = resinFromMaterial(patch.materialId);
        if (!hasBarcode) next.barcode = "";
      }
      if (VALID_CONDITIONS.includes(patch.condition)) next.condition = patch.condition;
      if (typeof patch.workbenchPreset === "string" && Object.hasOwn(WORKBENCH_PRESETS, patch.workbenchPreset)) {
        const presetPatch = WORKBENCH_PRESETS[patch.workbenchPreset].patch;
        next.workbenchPreset = patch.workbenchPreset;
        if (normalizeProfileId(presetPatch.profileA)) next.municipalProfileA = presetPatch.profileA;
        if (normalizeProfileId(presetPatch.profileB)) next.municipalProfileB = presetPatch.profileB;
        if (normalizeBasketId(presetPatch.basketId)) next.municipalBasket = presetPatch.basketId;
        if (presetPatch.cascadeCounts && typeof presetPatch.cascadeCounts === "object") {
          next.cascadeCounts = { ...presetPatch.cascadeCounts };
        }
      }
      if (normalizeProfileId(patch.municipalProfileA)) {
        next.municipalProfileA = patch.municipalProfileA;
        next.workbenchPreset = null;
      }
      if (normalizeProfileId(patch.municipalProfileB)) {
        next.municipalProfileB = patch.municipalProfileB;
        next.workbenchPreset = null;
      }
      if (normalizeBasketId(patch.municipalBasket)) {
        next.municipalBasket = patch.municipalBasket;
        next.workbenchPreset = null;
      }
      if (patch.cascadeCounts && typeof patch.cascadeCounts === "object") {
        const counts = {};
        for (const [id, value] of Object.entries(patch.cascadeCounts)) {
          if (normalizeCascadeId(id)) {
            counts[id] = clampCascadeCount(value);
          }
        }
        next.cascadeCounts = counts;
        next.workbenchPreset = null;
      }
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
      return { ...state, csvText: SAMPLE_BATCH_CSV, batchResult: null, notice: t(lang, "notice.sampleLoaded") };
    }
    case "RUN_BATCH": {
      const result = runBatchFromCsv(state.csvText);
      const blocking = result.rows.length === 0 && result.parse.errors.length > 0;
      return {
        ...state,
        batchResult: result,
        notice: blocking
          ? (lang === "es" ? parseErrorMessageEs(result.parse.errors[0]) : result.parse.errors[0].message)
          : t(lang, "notice.batchDone", { rows: result.totals.rows, evaluated: result.totals.evaluated, errors: result.totals.errors })
      };
    }
    case "RUN_BATCH_FILE": {
      const result = runBatchFromBytes(action.bytes);
      const blocking = result.rows.length === 0 && result.parse.errors.length > 0;
      const decodedNote =
        !blocking && result.parse.encoding && result.parse.encoding !== "utf-8"
          ? t(lang, "notice.decodedNote", { enc: result.parse.encoding.toUpperCase() })
          : "";
      return {
        ...state,
        csvText: typeof result.decodedText === "string" ? result.decodedText : state.csvText,
        batchResult: result,
        notice: blocking
          ? (lang === "es" ? parseErrorMessageEs(result.parse.errors[0]) : result.parse.errors[0].message)
          : t(lang, "notice.batchDone", { rows: result.totals.rows, evaluated: result.totals.evaluated, errors: result.totals.errors }) + decodedNote
      };
    }
    case "CLEAR_BATCH": {
      return { ...state, csvText: "", batchResult: null, notice: t(lang, "notice.batchCleared") };
    }
    case "SET_BENCHMARK": {
      if (!action.result || !action.result.cart) {
        return state;
      }
      return {
        ...state,
        benchmarkResult: action.result,
        notice: t(lang, "notice.benchmarkDone", { failures: action.result.failures.length, evaluations: action.result.meta.scoredEvaluations })
      };
    }
    case "SET_MUNICIPAL_PROFILE": {
      const id = normalizeProfileId(action.profileId);
      const slot = action.slot === "B" ? "municipalProfileB" : action.slot === "A" ? "municipalProfileA" : null;
      if (!id || !slot) {
        return state;
      }
      return { ...state, [slot]: id, workbenchPreset: null, notice: "" };
    }
    case "SET_MUNICIPAL_BASKET": {
      const id = normalizeBasketId(action.basketId);
      if (!id) {
        return state;
      }
      return { ...state, municipalBasket: id, workbenchPreset: null, notice: "" };
    }
    case "SET_CASCADE_COUNT": {
      const id = normalizeCascadeId(action.scenarioId);
      if (!id) {
        return state;
      }
      const count = clampCascadeCount(action.count);
      if (count === 0 && !(id in state.cascadeCounts)) {
        return state;
      }
      if (count === state.cascadeCounts[id]) {
        return state;
      }
      const nextCounts = { ...state.cascadeCounts };
      if (count > 0) {
        nextCounts[id] = count;
      } else {
        delete nextCounts[id];
      }
      return { ...state, cascadeCounts: nextCounts, workbenchPreset: null };
    }
    case "RESET_CASCADE": {
      if (Object.keys(state.cascadeCounts).length === 0 && !state.workbenchPreset) {
        return state;
      }
      return { ...state, cascadeCounts: {}, workbenchPreset: null, notice: t(lang, "notice.cascadeReset") };
    }
    case "APPLY_WORKBENCH_PRESET": {
      const preset = WORKBENCH_PRESETS[action.presetId];
      if (!preset) {
        return state;
      }
      const patch = preset.patch;
      return {
        ...state,
        workbenchPreset: preset.id,
        municipalProfileA: normalizeProfileId(patch.profileA) || state.municipalProfileA,
        municipalProfileB: normalizeProfileId(patch.profileB) || state.municipalProfileB,
        municipalBasket: normalizeBasketId(patch.basketId) || state.municipalBasket,
        cascadeCounts: patch.cascadeCounts ? { ...patch.cascadeCounts } : state.cascadeCounts,
        notice: t(lang, "notice.presetLoaded", { name: lang === "es" && PRESETS_ES[preset.id] ? PRESETS_ES[preset.id].name : preset.name })
      };
    }
    case "SET_SELFTEST_RESULT": {
      if (!action.result || !Array.isArray(action.result.results)) {
        return state;
      }
      return {
        ...state,
        selfTestResult: action.result,
        notice: action.result.allPass
          ? t(lang, "notice.selftestPass", { passed: action.result.passed, total: action.result.total })
          : t(lang, "notice.selftestFail", { failed: action.result.failed, total: action.result.total })
      };
    }
    case "SET_AUDIT_INPUT": {
      return { ...state, auditInput: String(action.text ?? "").slice(0, 262144) };
    }
    case "SET_AUDIT_RESULT": {
      if (!action.result || typeof action.result.ok !== "boolean") {
        return state;
      }
      return {
        ...state,
        auditResult: action.result,
        notice: action.result.ok ? t(lang, "notice.auditOk") : t(lang, "notice.auditFail")
      };
    }
    case "SET_SINGLE_KEY_SHORTCUTS": {
      const enabled = action.enabled !== false;
      if (enabled === state.singleKeyShortcuts) {
        return state;
      }
      return {
        ...state,
        singleKeyShortcuts: enabled,
        notice: enabled
          ? t(lang, "notice.singleKeyOn")
          : t(lang, "notice.singleKeyOff")
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

function buildBarcodeStatus(raw, lang = "en") {
  const text = String(raw ?? "");
  if (text.trim() === "") {
    return {
      tone: "idle",
      invalid: false,
      text: t(lang, "barcode.statusIdle")
    };
  }
  const lookup = lookupProductByBarcode(text);
  const reason = lang === "es" ? barcodeReasonEs(lookup.validation) : lookup.validation.reason;
  if (!lookup.validation.valid) {
    return { tone: "invalid", invalid: true, text: reason };
  }
  if (lookup.found) {
    return {
      tone: "valid",
      invalid: false,
      text: `${reason} ${t(lang, "barcode.statusMatched", { name: lookup.product.productName, pack: lookup.product.packagingSummary })}`
    };
  }
  return {
    tone: "valid",
    invalid: false,
    text: `${reason} ${t(lang, "barcode.statusUnmatched")}`
  };
}

/** Derives everything the renderers need from state. Pure. */
export function selectViewModel(state) {
  const lang = state.language === "es" ? "es" : "en";
  const query = {
    barcode: state.barcode,
    materialId: state.materialId,
    resinCode: state.resinCode,
    condition: state.condition
  };
  const activeCity = state.cityMode === "houston-tx" ? "houston-tx" : "Riverside-tx";
  const rawAssessment = assessEvidence(query);
  const rawComparison = compareJurisdictions(query);
  const rawEvaluation = state.cityMode === "compare" ? null : evaluateItemDisposal({ ...query, city: activeCity });
  const statusSource = state.draftBarcode !== null ? state.draftBarcode : state.barcode;
  const rawCart = scoreCartBatch(state.batchItems, activeCity);
  const rawDiff = compareProfiles(state.municipalProfileA, state.municipalProfileB, state.municipalBasket);
  const rawCascade = runCascadeLab(state.cascadeCounts, { city: activeCity });
  const es = lang === "es";
  const assessment = es ? localizeAssessment(rawAssessment, lang) : rawAssessment;
  const comparison = es ? localizeComparison(rawComparison, lang) : rawComparison;
  const evaluation = es ? localizeEvaluation(rawEvaluation, lang) : rawEvaluation;
  const cartSummary = es ? localizeCartSummary(rawCart, lang) : rawCart;
  const workbench = {
    diff: es ? localizeDiff(rawDiff, lang) : rawDiff,
    cascade: es ? localizeCascadeLab(rawCascade, lang) : rawCascade,
    preset: state.workbenchPreset
  };
  const shown = evaluation || comparison.Riverside;
  const liveSummary =
    state.cityMode === "compare"
      ? t(lang, "live.compare", {
          item: comparison.itemTitle,
          rel: t(lang, comparison.sameStream ? "live.compare.same" : "live.compare.diff"),
          sl: comparison.Riverside.badgeLabel,
          hou: comparison.houston.badgeLabel
        })
      : t(lang, "live.single", {
          item: shown.itemTitle,
          city: shown.shortCityName,
          badge: shown.badgeLabel,
          risk: shown.contaminationRiskScore,
          tier: es ? tierLabelEs(shown.contaminationTier) : shown.contaminationTier,
          confidence: es ? confidenceLabelEs(assessment.confidence).toLowerCase() : assessment.confidence.toLowerCase()
        });

  return {
    query,
    activeCity,
    language: lang,
    assessment,
    comparison,
    evaluation,
    barcodeStatus: buildBarcodeStatus(statusSource, lang),
    barcodeCheck: statusSource && String(statusSource).trim() !== "" ? validateBarcodeCheckDigit(statusSource) : null,
    cartSummary,
    workbench,
    liveSummary,
    shareHash: encodeShareHash(state)
  };
}

/**
 * Maps a keydown description to an action id from SHORTCUTS, or null.
 * `event` is { key, ctrlKey, metaKey, altKey, targetTag, isContentEditable }.
 * When `singleKeyShortcuts` is false every printable single-key shortcut is
 * suppressed (WCAG 2.1.4); Escape still resolves so the dialog can close.
 */
export function resolveShortcut(event, singleKeyShortcuts = true) {
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
  if (!singleKeyShortcuts || typing) {
    return null;
  }
  const entry = SHORTCUTS.find((candidate) => candidate.key === event.key || candidate.key === event.key.toLowerCase());
  if (!entry || entry.key === "Escape") {
    return null;
  }
  return entry.id;
}
