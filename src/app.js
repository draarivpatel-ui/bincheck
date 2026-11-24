import { VERIFIED_BARCODE_CATALOG, MATERIAL_CATEGORIES, SUPPORTED_CITIES } from "./bincheck-engine.js";
import { decodeShareHash } from "../js/bincheck-validate.js";
import { BATCH_LIMITS, batchResultToCsv, batchResultToJson } from "../js/bincheck-batch.js";
import { buildInspectionReport, inspectionReportToCsv, inspectionReportToJson } from "../js/bincheck-report.js";
import { runBenchmark, benchmarkToJson } from "../js/bincheck-benchmark.js";
import { createInitialState, reduce, selectViewModel, resolveShortcut } from "./state.js";
import {
  renderSingleEvaluation,
  renderComparisonView,
  renderBarcodeMathStrip,
  renderCart,
  renderBatchReport,
  renderBenchmark,
  renderPrintReport,
  renderShortcutList,
  renderSearchResults,
  renderImpact,
  escapeHtml
} from "./render.js";
import { searchItems, computeContaminationImpact } from "./insights.js";
import {
  t,
  normalizeLang,
  LANGUAGE_STORAGE_KEY,
  materialTitleEs,
  conditionLabelEs,
  profileNameEs,
  CATALOG_ES,
  BASKETS_ES
} from "../js/bincheck-i18n.js";
import { buildSignedAudit, signedAuditToJson, signedAuditToCsv, signedAuditToMarkdown, verifySignedAudit } from "../js/bincheck-audit.js";
import { runSelfTests } from "../js/bincheck-selftest.js";
import { WORKBENCH_PRESETS } from "../js/bincheck-municipal.js";
import { normalizeCascadeId } from "../js/bincheck-cascade.js";
import { renderMunicipalDiff, renderCascadeLab, renderAuditPanel, renderAuditVerify, renderSelfTests } from "./workbench-render.js";

const DEMO_SCENARIOS = {
  "pet-bottle": {
    barcode: "041220576463",
    materialId: "resin-1-pet",
    resinCode: 1,
    condition: "clean"
  },
  "pizza-box": {
    barcode: "072140001056",
    materialId: "greasy-pizza-box",
    resinCode: null,
    condition: "greasy"
  },
  "glass-jar": {
    barcode: "041220794386",
    materialId: "glass-jar-bottle",
    resinCode: null,
    condition: "clean",
    forceMode: "compare"
  },
  "plastic-bag": {
    barcode: "041220400126",
    materialId: "resin-4-ldpe-film",
    resinCode: 4,
    condition: "clean"
  },
  "lithium-battery": {
    barcode: "039800084118",
    materialId: "lithium-household-battery",
    resinCode: null,
    condition: "clean"
  },
  "styrofoam": {
    barcode: "073287001060",
    materialId: "resin-6-ps-foam",
    resinCode: 6,
    condition: "clean",
    forceMode: "compare"
  },
  "yard-waste": {
    barcode: "041220311088",
    materialId: "yard-trimmings-brush",
    resinCode: null,
    condition: "clean",
    forceMode: "compare"
  }
};

export { DEMO_SCENARIOS };

function registerOfflineCache(win) {
  try {
    if (!win || !win.location || !/^https?:$/.test(win.location.protocol)) return false;
    const nav = win.navigator;
    if (!nav || !nav.serviceWorker) return false;
    nav.serviceWorker.register("./sw.js").catch(() => {
      // Offline caching is an enhancement. A denied or unsupported registration
      // never blocks the fully local rules engine already running in the page.
    });
    return true;
  } catch {
    return false;
  }
}


/** One-click guided demos wired to the three walkthrough cards in index.html. */
export const GUIDED_DEMOS = {
  "city-flip": { scenario: "styrofoam", scrollTarget: "result-panel-card" },
  "contamination-trap": { scenario: "lithium-battery", impactClean: 30, impactCount: 1, scrollTarget: "impact-heading" },
  "csv-audit": { runCsv: true, scrollTarget: "csv-results" }
};

const NOTICE_MS = 6000;
const SHORTCUTS_STORAGE_KEY = "bincheck:single-key-shortcuts";

/**
 * One captured original (from the authored English markup) per translatable
 * node or attribute. English always restores the capture, so en output stays
 * byte-identical to the checked-in HTML; Spanish swaps in dictionary text.
 */
function captureI18nNodes(doc) {
  const textNodes = [];
  const attrNodes = [];
  const htmlNodes = [];
  doc.querySelectorAll("[data-i18n]").forEach((el) => {
    textNodes.push({ el, key: el.getAttribute("data-i18n"), orig: el.textContent });
  });
  doc.querySelectorAll("[data-i18n-html]").forEach((el) => {
    htmlNodes.push({ el, key: el.getAttribute("data-i18n-html"), orig: el.innerHTML });
  });
  for (const [attrName, domAttr] of [["data-i18n-aria", "aria-label"], ["data-i18n-ph", "placeholder"], ["data-i18n-title", "title"], ["data-i18n-alt", "alt"], ["data-i18n-dl", "data-label"], ["data-i18n-content", "content"]]) {
    doc.querySelectorAll(`[${attrName}]`).forEach((el) => {
      attrNodes.push({ el, key: el.getAttribute(attrName), attr: domAttr, orig: el.getAttribute(domAttr) });
    });
  }
  return { textNodes, htmlNodes, attrNodes };
}

function applyI18nNodes(captured, lang) {
  const es = normalizeLang(lang) === "es";
  for (const node of captured.textNodes) {
    node.el.textContent = es ? t("es", node.key) : node.orig;
  }
  for (const node of captured.htmlNodes) {
    node.el.innerHTML = es ? t("es", node.key) : node.orig;
  }
  for (const node of captured.attrNodes) {
    node.el.setAttribute(node.attr, es ? t("es", node.key) : node.orig);
  }
}

function defaultDownload(doc, win, filename, mime, text) {
  const blob = new win.Blob([text], { type: `${mime};charset=utf-8` });
  const url = win.URL.createObjectURL(blob);
  const anchor = doc.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  doc.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  win.setTimeout(() => win.URL.revokeObjectURL(url), 1000);
}

/**
 * Wires the BinCheck UI to a document. All DOM access goes through the injected
 * `doc` and `win`, so the controller can run against a stand-in in tests.
 */
export function createApp({ document: doc, window: win, deps = {} }) {
  const els = {
    barcodeInput: doc.getElementById("barcode-input"),
    barcodeStatus: doc.getElementById("barcode-status"),
    barcodeMathStrip: doc.getElementById("barcode-math-strip"),
    materialSelect: doc.getElementById("material-select"),
    conditionSelect: doc.getElementById("condition-select"),
    catalogSelect: doc.getElementById("catalog-select"),
    evaluationOutput: doc.getElementById("evaluation-output"),
    resultLive: doc.getElementById("result-live"),
    resultCard: doc.getElementById("result-panel-card"),
    scannerDeck: doc.getElementById("scanner-deck"),
    batchBadge: doc.getElementById("batch-summary-badge"),
    batchContainer: doc.getElementById("batch-items-container"),
    csvInput: doc.getElementById("csv-input"),
    csvResults: doc.getElementById("csv-results"),
    csvFileInput: doc.getElementById("csv-file-input"),
    exportCsvBtn: doc.getElementById("export-csv-btn"),
    exportJsonBtn: doc.getElementById("export-json-btn"),
    benchmarkOutput: doc.getElementById("benchmark-output"),
    benchmarkExportBtn: doc.getElementById("benchmark-export-btn"),
    shortcutDialog: doc.getElementById("shortcut-dialog"),
    shortcutList: doc.getElementById("shortcut-list"),
    statusLive: doc.getElementById("status-live"),
    printReport: doc.getElementById("print-report"),
    cameraWrap: doc.getElementById("camera-preview-wrap"),
    cameraVideo: doc.getElementById("camera-video"),
    statBarcodes: doc.getElementById("stat-barcodes"),
    statMaterials: doc.getElementById("stat-materials"),
    statCities: doc.getElementById("stat-cities"),
    itemSearch: doc.getElementById("item-search"),
    searchResults: doc.getElementById("search-results"),
    searchCount: doc.getElementById("search-count"),
    shortcutsToggle: doc.getElementById("shortcuts-toggle"),
    shortcutsDialogToggle: doc.getElementById("shortcuts-dialog-toggle"),
    impactClean: doc.getElementById("impact-clean"),
    impactCount: doc.getElementById("impact-count"),
    impactCleanValue: doc.getElementById("impact-clean-value"),
    impactCountValue: doc.getElementById("impact-count-value"),
    impactOutput: doc.getElementById("impact-output"),
    impactItemLabel: doc.getElementById("impact-item-label"),
    municipalProfileA: doc.getElementById("municipal-profile-a"),
    municipalProfileB: doc.getElementById("municipal-profile-b"),
    municipalBasket: doc.getElementById("municipal-basket"),
    municipalDiffOutput: doc.getElementById("municipal-diff-output"),
    cascadeOutput: doc.getElementById("cascade-output"),
    auditPanelOutput: doc.getElementById("audit-panel-output"),
    auditVerifyInput: doc.getElementById("audit-verify-input"),
    auditVerifyOutput: doc.getElementById("audit-verify-output"),
    selftestOutput: doc.getElementById("selftest-output")
  };
  const cascadeSliders = [...doc.querySelectorAll("[data-cascade]")];
  const cascadeValueEls = new Map(
    cascadeSliders.map((slider) => {
      const id = slider.getAttribute("data-cascade");
      return [id, doc.getElementById(`casv-${id}`)];
    })
  );

  const download = deps.download || ((filename, mime, text) => defaultDownload(doc, win, filename, mime, text));
  const now = deps.now || (() => (win.performance && win.performance.now ? win.performance.now() : Date.now()));
  const storage = deps.storage || (() => {
    try {
      return win.localStorage || null;
    } catch {
      return null;
    }
  })();
  const prefersReducedMotion = () =>
    typeof win.matchMedia === "function" && win.matchMedia("(prefers-reduced-motion: reduce)").matches === true;

  let state = createInitialState();
  let noticeTimer = null;
  let cameraStream = null;
  let cameraTimer = null;
  let cameraRequest = null;
  let cameraRestartRequested = false;
  let destroyed = false;
  let lastHash = null;
  let lastLive = "";
  let renderedSingleKey = null;
  let renderedLang = null;
  let searchQuery = "";
  const i18nNodes = captureI18nNodes(doc);
  const metaDescription = doc.querySelector ? doc.querySelector('meta[name="description"]') : null;
  const metaDescriptionEn = metaDescription ? metaDescription.getAttribute("content") : null;
  let impactClean = 20;
  let impactCount = 1;
  const SEARCHABLE_COUNT = VERIFIED_BARCODE_CATALOG.length + Object.keys(MATERIAL_CATEGORIES).length;

  // Remember each declared shortcut so aria-keyshortcuts can be restored after
  // a visit with single-key shortcuts switched off.
  const shortcutAttrs = new Map();
  doc.querySelectorAll("[aria-keyshortcuts]").forEach((el) => {
    shortcutAttrs.set(el, el.getAttribute("aria-keyshortcuts"));
  });

  function readShortcutPref() {
    try {
      return storage && typeof storage.getItem === "function" ? storage.getItem(SHORTCUTS_STORAGE_KEY) : null;
    } catch {
      return null;
    }
  }

  function writeShortcutPref(enabled) {
    try {
      if (storage && typeof storage.setItem === "function") {
        storage.setItem(SHORTCUTS_STORAGE_KEY, enabled ? "on" : "off");
      }
    } catch {
      // Storage can be unavailable or full; the toggle still works for the session.
    }
  }

  function readLanguagePref() {
    try {
      return storage && typeof storage.getItem === "function" ? storage.getItem(LANGUAGE_STORAGE_KEY) : null;
    } catch {
      return null;
    }
  }

  function writeLanguagePref(lang) {
    try {
      if (storage && typeof storage.setItem === "function") {
        storage.setItem(LANGUAGE_STORAGE_KEY, normalizeLang(lang));
      }
    } catch {
      // Storage can be unavailable or full; the toggle still works for the session.
    }
  }

  function catalogOptionText(item, lang) {
    const name = normalizeLang(lang) === "es" ? CATALOG_ES[item.upc] || item.productName : item.productName;
    return `${item.upc} - ${name}`;
  }

  function localizeSelectOptions(lang) {
    const es = normalizeLang(lang) === "es";
    if (els.materialSelect) {
      for (const option of els.materialSelect.options || []) {
        if (!option.value) continue;
        if (!option.i18nOrig) option.i18nOrig = option.textContent;
        option.textContent = es ? materialTitleEs(option.value) : option.i18nOrig;
      }
    }
    if (els.conditionSelect) {
      for (const option of els.conditionSelect.options || []) {
        if (!option.value) continue;
        if (!option.i18nOrig) option.i18nOrig = option.textContent;
        option.textContent = es ? conditionLabelEs(option.value) : option.i18nOrig;
      }
    }
    if (els.catalogSelect) {
      for (const option of els.catalogSelect.options || []) {
        if (!option.i18nOrig) option.i18nOrig = option.textContent;
        if (!option.value) {
          option.textContent = es ? t("es", "catalog.choose") : option.i18nOrig;
          continue;
        }
        const item = VERIFIED_BARCODE_CATALOG.find((entry) => entry.upc === option.value);
        option.textContent = item ? catalogOptionText(item, lang) : option.i18nOrig;
      }
    }
    for (const selectEl of [els.municipalProfileA, els.municipalProfileB]) {
      if (!selectEl) continue;
      for (const option of selectEl.options || []) {
        if (!option.i18nOrig) option.i18nOrig = option.textContent;
        option.textContent = es ? profileNameEs(option.value, "name") : option.i18nOrig;
      }
    }
    if (els.municipalBasket) {
      for (const option of els.municipalBasket.options || []) {
        if (!option.i18nOrig) option.i18nOrig = option.textContent;
        const basket = BASKETS_ES[option.value];
        option.textContent = es && basket ? basket.name : option.i18nOrig;
      }
    }
    if (els.statBarcodes) {
      els.statBarcodes.textContent = t(lang, "stats.gs1Codes", { n: VERIFIED_BARCODE_CATALOG.length });
    }
    if (els.statMaterials) {
      els.statMaterials.textContent = t(lang, "stats.materialsCount", { n: Object.keys(MATERIAL_CATEGORIES).length });
    }
    if (els.statCities) {
      els.statCities.textContent = t(lang, "stats.citiesCount", { n: Object.keys(SUPPORTED_CITIES).length });
    }
  }

  /**
   * Re-stamps every static string in the document chrome for `lang`: captured
   * data-i18n nodes, select options, document title, meta description and the
   * html lang attribute. Rendering output is localized separately via `lang`
   * arguments to the render functions.
   */
  function applyLanguage(lang) {
    const normalized = normalizeLang(lang);
    applyI18nNodes(i18nNodes, normalized);
    localizeSelectOptions(normalized);
    if (doc.documentElement) {
      doc.documentElement.setAttribute("lang", normalized);
    }
    if (typeof doc.title === "string" || doc.title === "") {
      doc.title = t(normalized, "title.page");
    }
    if (metaDescription) {
      metaDescription.setAttribute("content", normalized === "es" ? t("es", "meta.description") : metaDescriptionEn);
    }
    doc.querySelectorAll("[data-lang]").forEach((btn) => {
      const active = btn.getAttribute("data-lang") === normalized;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function renderSearch() {
    const lang = state.language;
    const result = searchItems(searchQuery, { lang });
    els.searchResults.innerHTML = renderSearchResults(result, lang);
    els.searchCount.textContent = result.query
      ? t(lang, result.partial ? "search.closeMatches" : "search.matches", { n: result.total })
      : t(lang, "search.itemsCount", { n: SEARCHABLE_COUNT });
  }

  function renderImpactPanel(vm) {
    const lang = state.language;
    const impact = computeContaminationImpact({
      query: vm.query,
      city: vm.activeCity,
      cleanCount: impactClean,
      itemCount: impactCount,
      lang
    });
    els.impactCleanValue.textContent = String(impact.cleanCount);
    els.impactCountValue.textContent = String(impact.itemCount);
    els.impactItemLabel.textContent = `${impact.itemTitle}, ${impact.city === "houston-tx" ? "Houston" : "Riverside"}`;
    els.impactOutput.innerHTML = renderImpact(impact, lang);
  }

  function setIfDifferent(element, prop, value) {
    if (element && element[prop] !== value) {
      element[prop] = value;
    }
  }

  function sweep() {
    if (prefersReducedMotion()) {
      return;
    }
    for (const [element, className] of [[els.scannerDeck, "scanning"], [els.resultCard, "gate-snap"]]) {
      element.classList.remove(className);
      void element.offsetWidth;
      element.classList.add(className);
    }
  }

  function syncHash(shareHash) {
    const target = shareHash || "";
    if (target === lastHash) return;
    lastHash = target;
    try {
      const base = `${win.location.pathname}${win.location.search || ""}`;
      win.history.replaceState(null, "", `${base}${target}`);
    } catch {
      // Some embedded contexts forbid history updates; sharing still works via the copy button.
    }
  }

  function render() {
    const vm = selectViewModel(state);
    const lang = state.language;

    if (lang !== renderedLang) {
      renderedLang = lang;
      applyLanguage(lang);
      renderSearch();
    }

    setIfDifferent(els.barcodeInput, "value", state.draftBarcode !== null ? state.draftBarcode : state.barcode || "");
    setIfDifferent(els.materialSelect, "value", state.materialId);
    setIfDifferent(els.conditionSelect, "value", state.condition);
    const catalogMatch = VERIFIED_BARCODE_CATALOG.find((item) => item.upc === state.barcode);
    setIfDifferent(els.catalogSelect, "value", catalogMatch ? catalogMatch.upc : "");

    doc.querySelectorAll("[data-city-mode]").forEach((btn) => {
      const active = btn.getAttribute("data-city-mode") === state.cityMode;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
    doc.querySelectorAll("[data-resin]").forEach((btn) => {
      const active = Number(btn.getAttribute("data-resin")) === Number(state.resinCode);
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });

    const singleKeyOn = state.singleKeyShortcuts !== false;
    for (const toggle of [els.shortcutsToggle, els.shortcutsDialogToggle]) {
      if (toggle) setIfDifferent(toggle, "checked", singleKeyOn);
    }
    for (const [el, keys] of shortcutAttrs) {
      const isSingleKey = keys.length === 1;
      if (!singleKeyOn && isSingleKey) {
        el.removeAttribute("aria-keyshortcuts");
      } else if (el.getAttribute("aria-keyshortcuts") !== keys) {
        el.setAttribute("aria-keyshortcuts", keys);
      }
    }
    const helpKey = `${singleKeyOn ? "on" : "off"}|${lang}`;
    if (helpKey !== renderedSingleKey) {
      renderedSingleKey = helpKey;
      els.shortcutList.innerHTML = renderShortcutList(singleKeyOn, lang);
    }

    els.barcodeStatus.className = `barcode-status tabular ${vm.barcodeStatus.tone === "idle" ? "" : vm.barcodeStatus.tone}`.trim();
    els.barcodeStatus.textContent = vm.barcodeStatus.text;
    els.barcodeInput.setAttribute("aria-invalid", vm.barcodeStatus.invalid ? "true" : "false");
    els.barcodeMathStrip.innerHTML = renderBarcodeMathStrip(vm.barcodeCheck, lang);

    els.evaluationOutput.innerHTML =
      state.cityMode === "compare"
        ? renderComparisonView(vm.comparison, vm.assessment, lang)
        : renderSingleEvaluation(vm.evaluation, vm.assessment, lang);
    if (lastLive !== vm.liveSummary) {
      lastLive = vm.liveSummary;
      els.resultLive.textContent = vm.liveSummary;
    }

    renderImpactPanel(vm);

    const cart = renderCart(vm.cartSummary, lang);
    els.batchBadge.className = cart.badgeClass;
    els.batchBadge.textContent = cart.badgeText;
    els.batchContainer.innerHTML = cart.html;

    if (els.csvInput.value !== state.csvText) {
      els.csvInput.value = state.csvText;
    }
    if (state.batchResult) {
      els.csvResults.innerHTML = renderBatchReport(state.batchResult, lang);
    } else {
      els.csvResults.innerHTML = `<p class="empty-batch-msg">${escapeHtml(t(lang, "csv.empty"))}</p>`;
    }
    const hasRows = Boolean(state.batchResult && state.batchResult.rows.length > 0);
    els.exportCsvBtn.disabled = !hasRows;
    els.exportJsonBtn.disabled = !hasRows;

    if (state.benchmarkResult) {
      els.benchmarkOutput.innerHTML = renderBenchmark(state.benchmarkResult, lang);
    }
    els.benchmarkExportBtn.disabled = !state.benchmarkResult;

    setIfDifferent(els.municipalProfileA, "value", state.municipalProfileA);
    setIfDifferent(els.municipalProfileB, "value", state.municipalProfileB);
    setIfDifferent(els.municipalBasket, "value", state.municipalBasket);
    els.municipalDiffOutput.innerHTML = renderMunicipalDiff(vm.workbench.diff, lang);

    for (const slider of cascadeSliders) {
      const id = slider.getAttribute("data-cascade");
      const count = state.cascadeCounts[id] || 0;
      setIfDifferent(slider, "value", String(count));
      const valueEl = cascadeValueEls.get(id);
      if (valueEl) {
        setIfDifferent(valueEl, "textContent", String(count));
      }
    }
    els.cascadeOutput.innerHTML = renderCascadeLab(vm.workbench.cascade, lang);

    els.auditPanelOutput.innerHTML = renderAuditPanel({ signed: currentSignedAudit() }, lang);
    els.auditVerifyOutput.innerHTML = renderAuditVerify(state.auditResult, lang);
    els.selftestOutput.innerHTML = renderSelfTests(state.selfTestResult, lang);

    els.statusLive.textContent = state.notice;
    if (noticeTimer) {
      win.clearTimeout(noticeTimer);
      noticeTimer = null;
    }
    if (state.notice) {
      noticeTimer = win.setTimeout(() => dispatch({ type: "CLEAR_NOTICE" }), NOTICE_MS);
    }

    syncHash(vm.shareHash);
  }

  function dispatch(action) {
    const next = reduce(state, action);
    if (next !== state) {
      if (action.type === "SET_SINGLE_KEY_SHORTCUTS" && next.singleKeyShortcuts !== state.singleKeyShortcuts) {
        writeShortcutPref(next.singleKeyShortcuts !== false);
      }
      if (action.type === "SET_LANGUAGE" && next.language !== state.language) {
        writeLanguagePref(next.language);
      }
      state = next;
      render();
    }
  }

  function stopCamera() {
    cameraRestartRequested = false;
    if (cameraRequest) cameraRequest.cancelled = true;
    if (cameraTimer !== null) {
      win.clearInterval(cameraTimer);
      cameraTimer = null;
    }
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      cameraStream = null;
    }
    els.cameraVideo.srcObject = null;
    if (typeof els.cameraVideo.pause === "function") els.cameraVideo.pause();
    els.cameraWrap.classList.add("hidden");
  }

  async function startCamera() {
    if (destroyed) return;
    if (cameraRequest) {
      // A cancelled acquisition must settle before another request can start.
      if (cameraRequest.cancelled) cameraRestartRequested = true;
      return;
    }
    if (cameraStream) return;
    const nav = win.navigator;
    if (!nav || !nav.mediaDevices || !nav.mediaDevices.getUserMedia) {
      els.barcodeStatus.className = "barcode-status invalid tabular";
      els.barcodeStatus.textContent = t(state.language, "status.cameraUnavailable");
      return;
    }
    const request = { cancelled: false };
    cameraRequest = request;
    try {
      const stream = await nav.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (request.cancelled || destroyed) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      cameraStream = stream;
      els.cameraVideo.srcObject = stream;
      await els.cameraVideo.play();
      if (request.cancelled || destroyed || cameraStream !== stream) return;
      els.cameraWrap.classList.remove("hidden");
      let detector = null;
      if ("BarcodeDetector" in win) {
        try {
          detector = new win.BarcodeDetector({ formats: ["upc_a", "ean_13", "ean_8"] });
        } catch {
          detector = null;
        }
      }
      if (detector) {
        let detecting = false;
        cameraTimer = win.setInterval(async () => {
          if (destroyed || cameraStream !== stream || detecting) return;
          detecting = true;
          try {
            const codes = await detector.detect(els.cameraVideo);
            if (destroyed || cameraStream !== stream) return;
            if (codes.length > 0 && codes[0].rawValue) {
              stopCamera();
              dispatch({ type: "COMMIT_BARCODE", raw: codes[0].rawValue });
              sweep();
            }
          } catch {
            // keep scanning frames
          } finally {
            detecting = false;
          }
        }, 450);
      } else {
        els.barcodeStatus.className = "barcode-status valid tabular";
        els.barcodeStatus.textContent = t(state.language, "status.cameraManual");
      }
    } catch {
      if (request.cancelled || destroyed) return;
      stopCamera();
      els.barcodeStatus.className = "barcode-status invalid tabular";
      els.barcodeStatus.textContent = t(state.language, "status.cameraDenied");
    } finally {
      if (cameraRequest === request) {
        cameraRequest = null;
        if (cameraRestartRequested && !destroyed) {
          cameraRestartRequested = false;
          startCamera();
        }
      }
    }
  }

  function currentShareUrl() {
    const vm = selectViewModel(state);
    const base = String(win.location.href || "").split("#")[0];
    return `${base}${vm.shareHash}`;
  }

  async function copyShareLink() {
    const url = currentShareUrl();
    try {
      await win.navigator.clipboard.writeText(url);
      dispatch({ type: "SET_NOTICE", text: t(state.language, "notice.shareCopied") });
    } catch {
      dispatch({ type: "SET_NOTICE", text: t(state.language, "notice.shareFallback", { url }) });
    }
  }

  function printWithMode(mode) {
    const body = doc.body;
    if (mode === "report") {
      const vm = selectViewModel(state);
      els.printReport.innerHTML = renderPrintReport(vm, state.batchResult, state.language);
    }
    body.setAttribute("data-print-mode", mode);
    const cleanup = () => {
      body.removeAttribute("data-print-mode");
      els.printReport.innerHTML = "";
      win.removeEventListener("afterprint", cleanup);
    };
    win.addEventListener("afterprint", cleanup);
    win.print();
  }

  function openHelp() {
    const dialog = els.shortcutDialog;
    if (dialog.open) return;
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  function closeHelp() {
    const dialog = els.shortcutDialog;
    if (!dialog.open) return;
    if (typeof dialog.close === "function") {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
    }
  }

  function runBenchmarkNow() {
    dispatch({ type: "SET_BENCHMARK", result: runBenchmark({ now }) });
  }

  function currentSignedAudit() {
    return buildSignedAudit({
      basketId: state.municipalBasket,
      profileIds: [state.municipalProfileA, state.municipalProfileB]
    });
  }

  function exportAudit(kind) {
    const signed = currentSignedAudit();
    if (kind === "csv") {
      download("bincheck-diversion-audit.csv", "text/csv", signedAuditToCsv(signed));
    } else if (kind === "md") {
      download("bincheck-diversion-audit.md", "text/markdown", signedAuditToMarkdown(signed));
    } else {
      download("bincheck-diversion-audit.signed.json", "application/json", signedAuditToJson(signed));
    }
  }

  function runSelfTestsNow() {
    dispatch({ type: "SET_SELFTEST_RESULT", result: runSelfTests({ now }) });
  }

  function verifyAuditInput() {
    dispatch({ type: "SET_AUDIT_INPUT", text: els.auditVerifyInput.value });
    dispatch({ type: "SET_AUDIT_RESULT", result: verifySignedAudit(els.auditVerifyInput.value) });
  }

  function exportBatch(kind) {
    if (!state.batchResult || state.batchResult.rows.length === 0) return;
    if (kind === "csv") {
      download("bincheck-batch-results.csv", "text/csv", batchResultToCsv(state.batchResult));
    } else {
      download("bincheck-batch-results.json", "application/json", batchResultToJson(state.batchResult));
    }
  }

  function exportItemReport(kind) {
    const report = buildInspectionReport(selectViewModel(state).query);
    if (kind === "csv") {
      download("bincheck-inspection-report.csv", "text/csv", inspectionReportToCsv(report));
    } else {
      download("bincheck-inspection-report.json", "application/json", inspectionReportToJson(report));
    }
  }

  function perform(actionId) {
    switch (actionId) {
      case "focus-barcode":
        els.barcodeInput.focus();
        break;
      case "city-Riverside-tx":
        dispatch({ type: "SET_CITY_MODE", mode: "Riverside-tx" });
        sweep();
        break;
      case "city-houston-tx":
        dispatch({ type: "SET_CITY_MODE", mode: "houston-tx" });
        sweep();
        break;
      case "city-compare":
        dispatch({ type: "SET_CITY_MODE", mode: "compare" });
        sweep();
        break;
      case "add-to-cart":
        dispatch({ type: "ADD_TO_CART" });
        break;
      case "goto-batch": {
        const heading = doc.getElementById("batch-csv-heading");
        if (heading && typeof heading.scrollIntoView === "function") {
          heading.scrollIntoView({ behavior: "auto", block: "start" });
        }
        els.csvInput.focus();
        break;
      }
      case "run-benchmark":
        runBenchmarkNow();
        break;
      case "print-report":
        printWithMode("report");
        break;
      case "download-report":
        exportItemReport("json");
        break;
      case "open-help":
        openHelp();
        break;
      case "close-help":
        closeHelp();
        break;
      case "language":
        dispatch({ type: "SET_LANGUAGE", language: state.language === "es" ? "en" : "es" });
        break;
      default:
        break;
    }
  }

  function handleClick(event) {
    const target = event.target;
    if (target === els.shortcutDialog) {
      closeHelp();
      return;
    }
    const actionEl = target && typeof target.closest === "function" ? target.closest("[data-action]") : null;
    if (!actionEl) return;
    const action = actionEl.getAttribute("data-action");
    switch (action) {
      case "set-language":
        dispatch({ type: "SET_LANGUAGE", language: actionEl.getAttribute("data-lang") });
        break;
      case "set-city":
        dispatch({ type: "SET_CITY_MODE", mode: actionEl.getAttribute("data-city-mode") });
        sweep();
        break;
      case "demo": {
        const scenario = DEMO_SCENARIOS[actionEl.getAttribute("data-demo")];
        if (scenario) {
          dispatch({ type: "APPLY_DEMO", scenario });
          sweep();
        }
        break;
      }
      case "guided-demo": {
        const guided = GUIDED_DEMOS[actionEl.getAttribute("data-guided")];
        if (!guided) break;
        if (Number.isInteger(guided.impactClean)) {
          impactClean = guided.impactClean;
          els.impactClean.value = String(impactClean);
        }
        if (Number.isInteger(guided.impactCount)) {
          impactCount = guided.impactCount;
          els.impactCount.value = String(impactCount);
        }
        if (guided.scenario && DEMO_SCENARIOS[guided.scenario]) {
          dispatch({ type: "APPLY_DEMO", scenario: DEMO_SCENARIOS[guided.scenario] });
          sweep();
        }
        if (guided.runCsv) {
          dispatch({ type: "LOAD_SAMPLE_CSV" });
          dispatch({ type: "RUN_BATCH" });
        }
        const target = guided.scrollTarget ? doc.getElementById(guided.scrollTarget) : null;
        if (target && typeof target.scrollIntoView === "function") {
          target.scrollIntoView({ behavior: "auto", block: "start" });
        }
        break;
      }
      case "commit-barcode":
        dispatch({ type: "COMMIT_BARCODE", raw: els.barcodeInput.value });
        sweep();
        break;
      case "select-resin":
        dispatch({ type: "SELECT_RESIN", code: Number(actionEl.getAttribute("data-resin")) });
        sweep();
        break;
      case "add-cart":
        dispatch({ type: "ADD_TO_CART" });
        break;
      case "clear-cart":
        dispatch({ type: "CLEAR_CART" });
        break;
      case "remove-cart":
        dispatch({ type: "REMOVE_FROM_CART", index: Number(actionEl.getAttribute("data-index")) });
        break;
      case "run-batch":
        dispatch({ type: "SET_CSV_TEXT", text: els.csvInput.value });
        dispatch({ type: "RUN_BATCH" });
        break;
      case "load-sample":
        dispatch({ type: "LOAD_SAMPLE_CSV" });
        break;
      case "clear-batch":
        dispatch({ type: "CLEAR_BATCH" });
        break;
      case "export-csv":
        exportBatch("csv");
        break;
      case "export-json":
        exportBatch("json");
        break;
      case "export-report-csv":
        exportItemReport("csv");
        break;
      case "export-report-json":
        exportItemReport("json");
        break;
      case "run-benchmark":
        runBenchmarkNow();
        break;
      case "export-benchmark":
        if (state.benchmarkResult) {
          download("bincheck-benchmark-report.json", "application/json", benchmarkToJson(state.benchmarkResult));
        }
        break;
      case "apply-preset": {
        const presetId = actionEl.getAttribute("data-preset");
        if (WORKBENCH_PRESETS[presetId]) {
          dispatch({ type: "APPLY_WORKBENCH_PRESET", presetId });
          const heading = WORKBENCH_PRESETS[presetId].patch.cascadeCounts
            ? doc.getElementById("cascade-heading")
            : doc.getElementById("municipal-diff-heading");
          if (heading && typeof heading.scrollIntoView === "function") {
            heading.scrollIntoView({ behavior: "auto", block: "start" });
          }
        }
        break;
      }
      case "cascade-reset":
        dispatch({ type: "RESET_CASCADE" });
        break;
      case "export-audit-json":
        exportAudit("json");
        break;
      case "export-audit-csv":
        exportAudit("csv");
        break;
      case "export-audit-md":
        exportAudit("md");
        break;
      case "copy-audit": {
        const text = signedAuditToJson(currentSignedAudit());
        try {
          win.navigator.clipboard.writeText(text).then(
            () => dispatch({ type: "SET_NOTICE", text: t(state.language, "notice.auditCopied") }),
            () => dispatch({ type: "SET_NOTICE", text: t(state.language, "notice.clipboardUnavailable") })
          );
        } catch {
          dispatch({ type: "SET_NOTICE", text: t(state.language, "notice.clipboardUnavailable") });
        }
        break;
      }
      case "load-audit-demo": {
        els.auditVerifyInput.value = signedAuditToJson(currentSignedAudit());
        dispatch({ type: "SET_NOTICE", text: t(state.language, "notice.auditDemoLoaded") });
        break;
      }
      case "verify-audit":
        verifyAuditInput();
        break;
      case "run-selftests":
        runSelfTestsNow();
        break;
      case "copy-link":
        copyShareLink();
        break;
      case "print-report":
        printWithMode("report");
        break;
      case "print-guide":
        printWithMode("guide");
        break;
      case "open-help":
        openHelp();
        break;
      case "close-help":
        closeHelp();
        break;
      case "camera-start":
        startCamera();
        break;
      case "camera-stop":
        stopCamera();
        break;
      case "search-pick": {
        const kind = actionEl.getAttribute("data-kind");
        const value = actionEl.getAttribute("data-value");
        if (kind === "barcode") {
          dispatch({ type: "COMMIT_BARCODE", raw: value });
        } else if (kind === "material") {
          dispatch({ type: "SELECT_MATERIAL", materialId: value });
          dispatch({ type: "SET_CONDITION", condition: "clean" });
        }
        sweep();
        const heading = doc.getElementById("result-panel-card");
        if (heading && typeof heading.scrollIntoView === "function") {
          heading.scrollIntoView({ behavior: "auto", block: "start" });
        }
        break;
      }
      default:
        break;
    }
  }

  function handleInput(event) {
    const target = event.target;
    if (!target) return;
    if (target.id === "barcode-input") {
      dispatch({ type: "TYPE_BARCODE", raw: target.value });
    } else if (target.id === "csv-input") {
      dispatch({ type: "SET_CSV_TEXT", text: target.value });
    } else if (target.id === "item-search") {
      searchQuery = String(target.value || "").slice(0, 80);
      renderSearch();
    } else if (target.id === "impact-clean" || target.id === "impact-count") {
      if (target.id === "impact-clean") impactClean = Number(target.value);
      else impactCount = Number(target.value);
      renderImpactPanel(selectViewModel(state));
    } else if (target.id === "audit-verify-input") {
      dispatch({ type: "SET_AUDIT_INPUT", text: target.value });
    } else if (target.getAttribute && normalizeCascadeId(target.getAttribute("data-cascade"))) {
      dispatch({ type: "SET_CASCADE_COUNT", scenarioId: target.getAttribute("data-cascade"), count: Number(target.value) });
    }
  }

  async function handleChange(event) {
    const target = event.target;
    if (!target) return;
    if (target.id === "material-select") {
      dispatch({ type: "SELECT_MATERIAL", materialId: target.value });
      sweep();
    } else if (target.id === "condition-select") {
      dispatch({ type: "SET_CONDITION", condition: target.value });
      sweep();
    } else if (target.id === "catalog-select") {
      if (target.value) {
        dispatch({ type: "COMMIT_BARCODE", raw: target.value });
        sweep();
      }
    } else if (target.id === "shortcuts-toggle" || target.id === "shortcuts-dialog-toggle") {
      dispatch({ type: "SET_SINGLE_KEY_SHORTCUTS", enabled: target.checked === true });
    } else if (target.id === "municipal-profile-a") {
      dispatch({ type: "SET_MUNICIPAL_PROFILE", slot: "A", profileId: target.value });
    } else if (target.id === "municipal-profile-b") {
      dispatch({ type: "SET_MUNICIPAL_PROFILE", slot: "B", profileId: target.value });
    } else if (target.id === "municipal-basket") {
      dispatch({ type: "SET_MUNICIPAL_BASKET", basketId: target.value });
    } else if (target.id === "csv-file-input") {
      const file = target.files && target.files[0];
      if (!file) return;
      if (file.size > BATCH_LIMITS.maxBytes) {
        dispatch({ type: "SET_NOTICE", text: t(state.language, "notice.fileTooLarge", { size: file.size, max: BATCH_LIMITS.maxBytes }) });
      } else {
        try {
          if (typeof file.arrayBuffer === "function") {
            const buffer = await file.arrayBuffer();
            dispatch({ type: "RUN_BATCH_FILE", bytes: new Uint8Array(buffer) });
          } else {
            const text = await file.text();
            dispatch({ type: "SET_CSV_TEXT", text });
            dispatch({ type: "RUN_BATCH" });
          }
        } catch {
          dispatch({ type: "SET_NOTICE", text: t(state.language, "notice.fileUnreadable") });
        }
      }
      target.value = "";
    }
  }

  function handleKeydown(event) {
    const target = event.target || {};
    if (target.id === "csv-input" && event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      dispatch({ type: "SET_CSV_TEXT", text: target.value });
      dispatch({ type: "RUN_BATCH" });
      return;
    }
    if (target.id === "item-search" && (event.key === "ArrowDown" || event.key === "Enter")) {
      const first = els.searchResults.querySelector ? els.searchResults.querySelector("[data-search-index]") : null;
      if (first) {
        event.preventDefault();
        if (event.key === "Enter") first.click();
        else first.focus();
      }
      return;
    }
    if (target.getAttribute && target.getAttribute("data-search-index") !== null && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      const hits = els.searchResults.querySelectorAll ? [...els.searchResults.querySelectorAll("[data-search-index]")] : [];
      const i = hits.indexOf(target);
      const next = event.key === "ArrowDown" ? hits[i + 1] : i <= 0 ? els.itemSearch : hits[i - 1];
      if (next) {
        event.preventDefault();
        next.focus();
      }
      return;
    }
    if (event.key === "Escape" && target.id === "item-search" && searchQuery) {
      event.preventDefault();
      target.value = "";
      searchQuery = "";
      renderSearch();
      return;
    }
    if (event.key === "Enter" && target.id === "barcode-input") {
      event.preventDefault();
      dispatch({ type: "COMMIT_BARCODE", raw: target.value });
      sweep();
      return;
    }
    const id = resolveShortcut({
      key: event.key,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      altKey: event.altKey,
      targetTag: target.tagName,
      isContentEditable: target.isContentEditable
    }, state.singleKeyShortcuts !== false);
    if (!id) return;
    const dialogOpen = els.shortcutDialog.open === true;
    if (id === "close-help") {
      if (dialogOpen) {
        event.preventDefault();
        perform(id);
      }
      return;
    }
    if (dialogOpen) return;
    event.preventDefault();
    perform(id);
  }

  // Initial static fills that must track engine data.
  for (const item of VERIFIED_BARCODE_CATALOG) {
    const option = doc.createElement("option");
    option.value = item.upc;
    option.textContent = catalogOptionText(item, "en");
    els.catalogSelect.appendChild(option);
  }
  els.statBarcodes.textContent = t("en", "stats.gs1Codes", { n: VERIFIED_BARCODE_CATALOG.length });
  els.statMaterials.textContent = t("en", "stats.materialsCount", { n: Object.keys(MATERIAL_CATEGORIES).length });
  els.statCities.textContent = t("en", "stats.citiesCount", { n: Object.keys(SUPPORTED_CITIES).length });

  // The stored language wins over the default but loses to a share-hash l=.
  const storedLang = normalizeLang(readLanguagePref());
  if (storedLang !== state.language) {
    state = { ...state, language: storedLang };
  }
  const hydrated = decodeShareHash(win.location && win.location.hash);
  if (Object.keys(hydrated.patch).length > 0) {
    state = reduce(state, { type: "HYDRATE", patch: hydrated.patch });
  }
  if (hydrated.issues.length > 0) {
    state = reduce(state, {
      type: "SET_NOTICE",
      text: t(state.language, "notice.hashIgnored", { n: hydrated.issues.length })
    });
  }
  if (readShortcutPref() === "off") {
    state = reduce(state, { type: "SET_SINGLE_KEY_SHORTCUTS", enabled: false });
  }

  doc.addEventListener("click", handleClick);
  doc.addEventListener("input", handleInput);
  doc.addEventListener("change", handleChange);
  doc.addEventListener("keydown", handleKeydown);
  win.addEventListener("pagehide", stopCamera);

  // Hero image fallback, wired here because the CSP allows no inline handlers.
  const heroFrame = doc.getElementById("hero-media-frame");
  const heroImg = heroFrame && typeof heroFrame.querySelector === "function" ? heroFrame.querySelector("img") : null;
  if (heroImg) {
    heroImg.addEventListener("load", () => heroFrame.classList.remove("img-fallback-active"));
    heroImg.addEventListener("error", () => heroFrame.classList.add("img-fallback-active"));
    if (heroImg.complete) heroFrame.classList.toggle("img-fallback-active", heroImg.naturalWidth === 0);
  }

  renderSearch();
  render();
  registerOfflineCache(win);

  return {
    getState: () => state,
    dispatch,
    render,
    destroy() {
      destroyed = true;
      stopCamera();
      doc.removeEventListener("click", handleClick);
      doc.removeEventListener("input", handleInput);
      doc.removeEventListener("change", handleChange);
      doc.removeEventListener("keydown", handleKeydown);
      win.removeEventListener("pagehide", stopCamera);
      if (noticeTimer !== null) win.clearTimeout(noticeTimer);
      noticeTimer = null;
    }
  };
}

if (typeof document !== "undefined" && typeof window !== "undefined") {
  createApp({ document, window });
}
