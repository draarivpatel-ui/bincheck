import { VERIFIED_BARCODE_CATALOG, MATERIAL_CATEGORIES, SUPPORTED_CITIES } from "./bincheck-engine.js";
import { decodeShareHash } from "../js/bincheck-validate.js";
import { BATCH_LIMITS, batchResultToCsv, batchResultToJson } from "../js/bincheck-batch.js";
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
  renderImpact
} from "./render.js";
import { searchItems, computeContaminationImpact } from "./insights.js";

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

const NOTICE_MS = 6000;

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
    impactClean: doc.getElementById("impact-clean"),
    impactCount: doc.getElementById("impact-count"),
    impactCleanValue: doc.getElementById("impact-clean-value"),
    impactCountValue: doc.getElementById("impact-count-value"),
    impactOutput: doc.getElementById("impact-output"),
    impactItemLabel: doc.getElementById("impact-item-label")
  };

  const download = deps.download || ((filename, mime, text) => defaultDownload(doc, win, filename, mime, text));
  const now = deps.now || (() => (win.performance && win.performance.now ? win.performance.now() : Date.now()));
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
  let searchQuery = "";
  let impactClean = 20;
  let impactCount = 1;
  const SEARCHABLE_COUNT = VERIFIED_BARCODE_CATALOG.length + Object.keys(MATERIAL_CATEGORIES).length;

  function renderSearch() {
    const result = searchItems(searchQuery);
    els.searchResults.innerHTML = renderSearchResults(result);
    els.searchCount.textContent = result.query
      ? `${result.total} match${result.total === 1 ? "" : "es"}`
      : `${SEARCHABLE_COUNT} items`;
  }

  function renderImpactPanel(vm) {
    const impact = computeContaminationImpact({
      query: vm.query,
      city: vm.activeCity,
      cleanCount: impactClean,
      itemCount: impactCount
    });
    els.impactCleanValue.textContent = String(impact.cleanCount);
    els.impactCountValue.textContent = String(impact.itemCount);
    els.impactItemLabel.textContent = `${impact.itemTitle}, ${impact.city === "houston-tx" ? "Houston" : "Sugar Land"}`;
    els.impactOutput.innerHTML = renderImpact(impact);
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

    els.barcodeStatus.className = `barcode-status tabular ${vm.barcodeStatus.tone === "idle" ? "" : vm.barcodeStatus.tone}`.trim();
    els.barcodeStatus.textContent = vm.barcodeStatus.text;
    els.barcodeInput.setAttribute("aria-invalid", vm.barcodeStatus.invalid ? "true" : "false");
    els.barcodeMathStrip.innerHTML = renderBarcodeMathStrip(vm.barcodeCheck);

    els.evaluationOutput.innerHTML =
      state.cityMode === "compare"
        ? renderComparisonView(vm.comparison, vm.assessment)
        : renderSingleEvaluation(vm.evaluation, vm.assessment);
    if (lastLive !== vm.liveSummary) {
      lastLive = vm.liveSummary;
      els.resultLive.textContent = vm.liveSummary;
    }

    renderImpactPanel(vm);

    const cart = renderCart(vm.cartSummary);
    els.batchBadge.className = cart.badgeClass;
    els.batchBadge.textContent = cart.badgeText;
    els.batchContainer.innerHTML = cart.html;

    if (els.csvInput.value !== state.csvText) {
      els.csvInput.value = state.csvText;
    }
    if (state.batchResult) {
      els.csvResults.innerHTML = renderBatchReport(state.batchResult);
    } else {
      els.csvResults.innerHTML = `<p class="empty-batch-msg">No batch yet. Load the sample or paste your own rows, then choose Run inspection.</p>`;
    }
    const hasRows = Boolean(state.batchResult && state.batchResult.rows.length > 0);
    els.exportCsvBtn.disabled = !hasRows;
    els.exportJsonBtn.disabled = !hasRows;

    if (state.benchmarkResult) {
      els.benchmarkOutput.innerHTML = renderBenchmark(state.benchmarkResult);
    }
    els.benchmarkExportBtn.disabled = !state.benchmarkResult;

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
      els.barcodeStatus.textContent = "Camera API unavailable in this browser context; use keyboard UPC entry or the demo catalog.";
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
      if ("BarcodeDetector" in win) {
        const detector = new win.BarcodeDetector({ formats: ["upc_a", "ean_13", "ean_8"] });
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
        els.barcodeStatus.textContent = "Camera preview active. This browser cannot read barcodes automatically; type the printed 12-digit code in the field above.";
      }
    } catch {
      if (request.cancelled || destroyed) return;
      stopCamera();
      els.barcodeStatus.className = "barcode-status invalid tabular";
      els.barcodeStatus.textContent = "Camera permission declined or unavailable; use direct UPC input or pick from the demo catalog.";
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
      dispatch({ type: "SET_NOTICE", text: "Share link copied to the clipboard." });
    } catch {
      dispatch({ type: "SET_NOTICE", text: `Copy this link: ${url}` });
    }
  }

  function printWithMode(mode) {
    const body = doc.body;
    if (mode === "report") {
      const vm = selectViewModel(state);
      els.printReport.innerHTML = renderPrintReport(vm, state.batchResult);
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

  function exportBatch(kind) {
    if (!state.batchResult || state.batchResult.rows.length === 0) return;
    if (kind === "csv") {
      download("bincheck-batch-results.csv", "text/csv", batchResultToCsv(state.batchResult));
    } else {
      download("bincheck-batch-results.json", "application/json", batchResultToJson(state.batchResult));
    }
  }

  function perform(actionId) {
    switch (actionId) {
      case "focus-barcode":
        els.barcodeInput.focus();
        break;
      case "city-sugar-land-tx":
        dispatch({ type: "SET_CITY_MODE", mode: "sugar-land-tx" });
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
          heading.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
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
      case "open-help":
        openHelp();
        break;
      case "close-help":
        closeHelp();
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
      case "run-benchmark":
        runBenchmarkNow();
        break;
      case "export-benchmark":
        if (state.benchmarkResult) {
          download("bincheck-benchmark-report.json", "application/json", benchmarkToJson(state.benchmarkResult));
        }
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
          heading.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
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
    } else if (target.id === "csv-file-input") {
      const file = target.files && target.files[0];
      if (!file) return;
      if (file.size > BATCH_LIMITS.maxBytes) {
        dispatch({ type: "SET_NOTICE", text: `File is ${file.size} bytes. The limit is ${BATCH_LIMITS.maxBytes} bytes.` });
      } else {
        try {
          const text = await file.text();
          dispatch({ type: "SET_CSV_TEXT", text });
          dispatch({ type: "RUN_BATCH" });
        } catch {
          dispatch({ type: "SET_NOTICE", text: "That file could not be read." });
        }
      }
      target.value = "";
    }
  }

  function handleKeydown(event) {
    const target = event.target || {};
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
    });
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
    option.textContent = `${item.upc} - ${item.productName}`;
    els.catalogSelect.appendChild(option);
  }
  els.shortcutList.innerHTML = renderShortcutList();
  els.statBarcodes.textContent = `${VERIFIED_BARCODE_CATALOG.length} GS1 codes`;
  els.statMaterials.textContent = `${Object.keys(MATERIAL_CATEGORIES).length} Streams`;
  els.statCities.textContent = `${Object.keys(SUPPORTED_CITIES).length} Cities`;

  const hydrated = decodeShareHash(win.location && win.location.hash);
  if (Object.keys(hydrated.patch).length > 0) {
    state = reduce(state, { type: "HYDRATE", patch: hydrated.patch });
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
