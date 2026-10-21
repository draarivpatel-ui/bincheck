import {
  VERIFIED_BARCODE_CATALOG,
  RESIN_CODE_METADATA,
  validateBarcodeCheckDigit,
  lookupProductByBarcode,
  evaluateItemDisposal,
  compareJurisdictions,
  scoreCartBatch
} from "./bincheck-engine.js";

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

const state = {
  cityMode: "sugar-land-tx",
  barcode: "041220576463",
  materialId: "resin-1-pet",
  resinCode: 1,
  condition: "clean",
  batchItems: [
    { barcode: "041220576463", materialId: "resin-1-pet", condition: "clean" },
    { barcode: "049000006346", materialId: "aluminum-steel-can", condition: "clean" },
    { barcode: "041220794386", materialId: "glass-jar-bottle", condition: "clean" }
  ],
  cameraStream: null
};

function getRiskColor(score) {
  if (score >= 85) return "#b91c1c";
  if (score >= 55) return "#b45309";
  if (score >= 25) return "#0b5ed7";
  return "#146c43";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderSingleEvaluation(ev) {
  const riskColor = getRiskColor(ev.contaminationRiskScore);
  const stepsHtml = ev.prepSteps
    .map((s) => `<li>${escapeHtml(s)}</li>`)
    .join("");

  const resinBadge = ev.resinInfo
    ? `<p class="eval-jurisdiction"><strong>Polymer Code:</strong> ${escapeHtml(ev.resinInfo.symbol)} (${escapeHtml(ev.resinInfo.polymer)})</p>`
    : "";

  return `
    <div class="eval-header">
      <div>
        <h3 class="eval-title">${escapeHtml(ev.itemTitle)}</h3>
        <p class="eval-jurisdiction">${escapeHtml(ev.cityName)} | ${escapeHtml(ev.operator)}</p>
        ${resinBadge}
      </div>
      <span class="stream-badge stream-${escapeHtml(ev.stream)}">${escapeHtml(ev.badgeLabel)}</span>
    </div>

    <div class="risk-meter-box">
      <div class="risk-meter-top">
        <span>MRF Contamination Risk Score</span>
        <span>${ev.contaminationRiskScore}/100 (${escapeHtml(ev.contaminationTier)})</span>
      </div>
      <div class="risk-bar-track">
        <div class="risk-bar-fill" style="width: ${ev.contaminationRiskScore}%; background: ${riskColor};"></div>
      </div>
      <p class="mrf-note"><strong>Sorting Facility Physics:</strong> ${escapeHtml(ev.mrfFailureMode)}</p>
    </div>

    <div class="eval-section">
      <h4>Required Household Preparation Steps</h4>
      <ul class="prep-list">${stepsHtml}</ul>
    </div>

    <div class="dropoff-card">
      <div><strong>Local Drop-Off &amp; Ordinance Guidance:</strong> ${escapeHtml(ev.dropOffNote)}</div>
      <div style="margin-top: 0.35rem;"><strong>Primary Facility:</strong> ${escapeHtml(ev.dropOffFacility.name)} (${escapeHtml(ev.dropOffFacility.address)})</div>
      <div><strong>Plastic Film Return:</strong> ${escapeHtml(ev.dropOffFacility.retailBagDropOff)}</div>
      <div style="margin-top: 0.35rem;"><strong>Sugar Land vs. Houston Rule Comparison:</strong> ${escapeHtml(ev.cityDivergenceNote)}</div>
    </div>
  `;
}

function renderComparisonView(comp) {
  const sl = comp.sugarLand;
  const ho = comp.houston;
  return `
    <div class="eval-header">
      <div>
        <h3 class="eval-title">${escapeHtml(comp.itemTitle)}</h3>
        <p class="eval-jurisdiction">Side-by-Side Municipal Ordinance Comparison (Sugar Land vs. Houston)</p>
      </div>
      <span class="stream-badge stream-${comp.sameStream ? escapeHtml(sl.stream) : "SPLIT_DISPOSAL"}">
        ${comp.sameStream ? "Aligned Stream Rules" : "Jurisdiction Rule Divergence"}
      </span>
    </div>

    <div class="risk-meter-box">
      <p class="mrf-note" style="margin:0;"><strong>Key Ordinance Comparison:</strong> ${escapeHtml(comp.divergenceSummary)}</p>
      <p class="mrf-note"><strong>MRF Physics:</strong> ${escapeHtml(sl.mrfFailureMode)}</p>
    </div>

    <div class="compare-columns">
      <div class="compare-col">
        <h4>City of Sugar Land, TX</h4>
        <span class="stream-badge stream-${escapeHtml(sl.stream)}">${escapeHtml(sl.badgeLabel)}</span>
        <p style="font-size:0.84rem; margin:0.5rem 0;"><strong>Contamination Risk:</strong> ${sl.contaminationRiskScore}/100 (${escapeHtml(sl.contaminationTier)})</p>
        <ul class="prep-list">
          ${sl.prepSteps.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}
        </ul>
        <p style="font-size:0.82rem; margin-top:0.5rem; color:#496153;"><strong>Facility:</strong> ${escapeHtml(sl.dropOffFacility.name)}, ${escapeHtml(sl.dropOffFacility.address)}</p>
      </div>

      <div class="compare-col">
        <h4>City of Houston, TX</h4>
        <span class="stream-badge stream-${escapeHtml(ho.stream)}">${escapeHtml(ho.badgeLabel)}</span>
        <p style="font-size:0.84rem; margin:0.5rem 0;"><strong>Contamination Risk:</strong> ${ho.contaminationRiskScore}/100 (${escapeHtml(ho.contaminationTier)})</p>
        <ul class="prep-list">
          ${ho.prepSteps.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}
        </ul>
        <p style="font-size:0.82rem; margin-top:0.5rem; color:#496153;"><strong>Facility:</strong> ${escapeHtml(ho.dropOffFacility.name)}, ${escapeHtml(ho.dropOffFacility.address)}</p>
      </div>
    </div>
  `;
}

function renderBatchSimulator() {
  const activeCity = state.cityMode === "houston-tx" ? "houston-tx" : "sugar-land-tx";
  const summary = scoreCartBatch(state.batchItems, activeCity);
  const badgeEl = document.getElementById("batch-summary-badge");
  const containerEl = document.getElementById("batch-items-container");

  if (summary.itemCount === 0) {
    badgeEl.className = "stream-badge stream-SPLIT_DISPOSAL";
    badgeEl.textContent = "Cart Empty (0 Items)";
    containerEl.innerHTML = `<p style="font-size:0.88rem; color:#496153;">Use "+ Add Current Item to Virtual Cart Load" to test how a single tangler or battery affects an otherwise clean recycling bin.</p>`;
    return;
  }

  if (summary.loadStatus === "CLEAN_CURBSIDE_LOAD") {
    badgeEl.className = "stream-badge stream-RECYCLE_CART";
    badgeEl.textContent = `Clean Curbside Load (Avg Risk ${summary.averageRiskScore}/100)`;
  } else if (summary.loadStatus === "NEEDS_SORTING_FIXES") {
    badgeEl.className = "stream-badge stream-SPLIT_DISPOSAL";
    badgeEl.textContent = `Preparation Needed (Max Risk ${summary.maxRiskScore}/100)`;
  } else {
    badgeEl.className = "stream-badge stream-SPECIAL_DROPOFF";
    badgeEl.textContent = `Contaminated Load Alert (${summary.criticalHazards.length} Hazard/Tangler Item${summary.criticalHazards.length === 1 ? "" : "s"})`;
  }

  containerEl.innerHTML = summary.evaluations
    .map(
      (ev, idx) => `
      <div class="batch-chip">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:0.4rem;">
          <strong>${escapeHtml(ev.itemTitle)}</strong>
          <button type="button" class="text-btn" data-remove-batch="${idx}">Remove</button>
        </div>
        <span>Stream: <strong>${escapeHtml(ev.badgeLabel)}</strong></span>
        <span>Contamination Score: ${ev.contaminationRiskScore}/100 (${escapeHtml(ev.contaminationTier)})</span>
      </div>
    `
    )
    .join("");

  containerEl.querySelectorAll("[data-remove-batch]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-remove-batch"));
      state.batchItems.splice(idx, 1);
      renderBatchSimulator();
    });
  });
}

function updateUI() {
  const barcodeInput = document.getElementById("barcode-input");
  const barcodeStatus = document.getElementById("barcode-status");
  const materialSelect = document.getElementById("material-select");
  const conditionSelect = document.getElementById("condition-select");
  const outputEl = document.getElementById("evaluation-output");

  barcodeInput.value = state.barcode || "";
  materialSelect.value = state.materialId;
  conditionSelect.value = state.condition;

  document.querySelectorAll(".city-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-city-mode") === state.cityMode);
  });

  document.querySelectorAll(".resin-btn").forEach((btn) => {
    const r = Number(btn.getAttribute("data-resin"));
    btn.classList.toggle("active", r === Number(state.resinCode));
  });

  if (state.barcode) {
    const lookup = lookupProductByBarcode(state.barcode);
    if (!lookup.validation.valid) {
      barcodeStatus.className = "barcode-status invalid";
      barcodeStatus.textContent = lookup.validation.reason;
    } else if (lookup.found) {
      barcodeStatus.className = "barcode-status valid";
      barcodeStatus.textContent = `${lookup.validation.reason} Matched: ${lookup.product.productName} (${lookup.product.packagingSummary}).`;
    } else {
      barcodeStatus.className = "barcode-status valid";
      barcodeStatus.textContent = `${lookup.validation.reason} Custom product UPC; evaluating using selected material/resin rule.`;
    }
  } else {
    barcodeStatus.className = "barcode-status";
    barcodeStatus.textContent = "Enter any 12-digit UPC-A or 13-digit EAN-13 barcode, or choose a material category below.";
  }

  const query = {
    barcode: state.barcode,
    materialId: state.materialId,
    resinCode: state.resinCode,
    condition: state.condition
  };

  if (state.cityMode === "compare") {
    const comp = compareJurisdictions(query);
    outputEl.innerHTML = renderComparisonView(comp);
  } else {
    const ev = evaluateItemDisposal({ ...query, city: state.cityMode });
    outputEl.innerHTML = renderSingleEvaluation(ev);
  }

  renderBatchSimulator();
}

function initCatalogDropdown() {
  const select = document.getElementById("catalog-select");
  for (const item of VERIFIED_BARCODE_CATALOG) {
    const opt = document.createElement("option");
    opt.value = item.upc;
    opt.textContent = `${item.upc} - ${item.productName}`;
    select.appendChild(opt);
  }
  select.value = state.barcode;
}

function applyBarcodeSelection(rawUpc) {
  state.barcode = rawUpc.trim();
  const lookup = lookupProductByBarcode(state.barcode);
  if (lookup.found && lookup.product) {
    state.materialId = lookup.product.materialId;
    state.resinCode = lookup.product.resinCode;
  }
  updateUI();
}

async function startCameraBarcodeScan() {
  const wrap = document.getElementById("camera-preview-wrap");
  const video = document.getElementById("camera-video");
  const statusEl = document.getElementById("barcode-status");

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    statusEl.className = "barcode-status invalid";
    statusEl.textContent = "Camera API unavailable in this browser context; use keyboard UPC entry or the verified Texas catalog dropdown.";
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" }
    });
    state.cameraStream = stream;
    video.srcObject = stream;
    await video.play();
    wrap.classList.remove("hidden");

    if ("BarcodeDetector" in window) {
      const detector = new window.BarcodeDetector({
        formats: ["upc_a", "upc_e", "ean_13", "ean_8"]
      });
      const timer = setInterval(async () => {
        if (!state.cameraStream) {
          clearInterval(timer);
          return;
        }
        try {
          const codes = await detector.detect(video);
          if (codes.length > 0 && codes[0].rawValue) {
            stopCameraScan();
            clearInterval(timer);
            applyBarcodeSelection(codes[0].rawValue);
          }
        } catch {
          // continue scanning frames
        }
      }, 450);
    } else {
      statusEl.className = "barcode-status valid";
      statusEl.textContent = "Camera preview active. Enter the printed 12-digit UPC code in the field above.";
    }
  } catch {
    statusEl.className = "barcode-status invalid";
    statusEl.textContent = "Camera permission declined or unavailable; use direct UPC input or select from the 28 verified barcodes.";
  }
}

function stopCameraScan() {
  const wrap = document.getElementById("camera-preview-wrap");
  if (state.cameraStream) {
    state.cameraStream.getTracks().forEach((t) => t.stop());
    state.cameraStream = null;
  }
  wrap.classList.add("hidden");
}

function bindEvents() {
  document.querySelectorAll(".city-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.cityMode = btn.getAttribute("data-city-mode");
      updateUI();
    });
  });

  document.querySelectorAll(".demo-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-demo");
      const scenario = DEMO_SCENARIOS[key];
      if (!scenario) return;
      state.barcode = scenario.barcode;
      state.materialId = scenario.materialId;
      state.resinCode = scenario.resinCode;
      state.condition = scenario.condition;
      if (scenario.forceMode) {
        state.cityMode = scenario.forceMode;
      }
      document.getElementById("catalog-select").value = scenario.barcode || "";
      updateUI();
    });
  });

  document.getElementById("barcode-scan-btn").addEventListener("click", () => {
    const val = document.getElementById("barcode-input").value;
    applyBarcodeSelection(val);
  });

  document.getElementById("barcode-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      applyBarcodeSelection(e.target.value);
    }
  });

  document.getElementById("catalog-select").addEventListener("change", (e) => {
    if (e.target.value) {
      applyBarcodeSelection(e.target.value);
    }
  });

  document.querySelectorAll(".resin-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const rCode = Number(btn.getAttribute("data-resin"));
      const meta = RESIN_CODE_METADATA[rCode];
      if (!meta) return;
      state.barcode = "";
      state.resinCode = rCode;
      state.materialId = meta.defaultMaterialId;
      document.getElementById("catalog-select").value = "";
      updateUI();
    });
  });

  document.getElementById("material-select").addEventListener("change", (e) => {
    state.barcode = "";
    state.materialId = e.target.value;
    const matchResin = e.target.value.match(/^resin-(\d)/);
    state.resinCode = matchResin ? Number(matchResin[1]) : null;
    document.getElementById("catalog-select").value = "";
    updateUI();
  });

  document.getElementById("condition-select").addEventListener("change", (e) => {
    state.condition = e.target.value;
    updateUI();
  });

  document.getElementById("add-to-batch-btn").addEventListener("click", () => {
    state.batchItems.push({
      barcode: state.barcode,
      materialId: state.materialId,
      resinCode: state.resinCode,
      condition: state.condition
    });
    renderBatchSimulator();
  });

  document.getElementById("clear-batch-btn").addEventListener("click", () => {
    state.batchItems = [];
    renderBatchSimulator();
  });

  document.getElementById("print-cheatsheet-btn").addEventListener("click", () => {
    window.print();
  });

  document.getElementById("camera-scan-btn").addEventListener("click", () => {
    startCameraBarcodeScan();
  });

  document.getElementById("camera-close-btn").addEventListener("click", () => {
    stopCameraScan();
  });
}

if (typeof document !== "undefined") {
  initCatalogDropdown();
  bindEvents();
  updateUI();
}
