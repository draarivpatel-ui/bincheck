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
  if (score >= 85) return "#DC2626";
  if (score >= 55) return "#D97706";
  if (score >= 25) return "#B45309";
  return "#047857";
}

function getStreamSvgIcon(stream) {
  if (stream === "RECYCLE_CART" || stream === "GREEN_WASTE") {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;
  }
  if (stream === "SPLIT_DISPOSAL") {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3"/><path d="m15 9 6-6"/></svg>`;
  }
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function triggerLaserSweep() {
  const deck = document.getElementById("scanner-deck");
  const resultCard = document.getElementById("result-panel-card");
  if (deck) {
    deck.classList.remove("scanning");
    void deck.offsetWidth;
    deck.classList.add("scanning");
  }
  if (resultCard) {
    resultCard.classList.remove("gate-snap");
    void resultCard.offsetWidth;
    resultCard.classList.add("gate-snap");
  }
}

function renderBarcodeMathStrip(rawBarcode) {
  const stripEl = document.getElementById("barcode-math-strip");
  if (!stripEl) return;

  if (!rawBarcode || !rawBarcode.trim()) {
    stripEl.innerHTML = `<span class="math-chip">GS1 ENGINE IDLE // SELECT RESIN OR ENTER 12-DIGIT UPC</span>`;
    return;
  }

  const check = validateBarcodeCheckDigit(rawBarcode);
  if (!check.valid) {
    stripEl.innerHTML = `
      <span class="math-chip math-chip-err">FORMAT: ${escapeHtml(check.format)}</span>
      <span class="math-chip math-chip-err">EXPECTED CHECK: ${check.expectedCheckDigit ?? "N/A"}</span>
      <span class="math-chip math-chip-err">ACTUAL: ${check.actualCheckDigit ?? "N/A"}</span>
    `;
    return;
  }

  const payload = check.normalized.slice(0, -1);
  stripEl.innerHTML = `
    <span class="math-chip">FORMAT: <strong>${escapeHtml(check.format)}</strong></span>
    <span class="math-chip">PAYLOAD: <strong>${escapeHtml(payload)}</strong></span>
    <span class="math-chip">MOD-10 CHECK: <strong>${check.actualCheckDigit}</strong></span>
    ${check.ean13 ? `<span class="math-chip">EAN-13: <strong>${escapeHtml(check.ean13)}</strong></span>` : ""}
  `;
}

function renderContaminationGauge(score, tier, mrfFailureMode) {
  const riskColor = getRiskColor(score);
  return `
    <div class="risk-meter-box">
      <div class="risk-meter-top">
        <span>MRF Contamination Risk Gauge</span>
        <span class="tabular risk-score-readout" style="color: ${riskColor};">${score}/100 // ${escapeHtml(tier)}</span>
      </div>
      <div class="risk-bar-track" role="meter" aria-valuenow="${score}" aria-valuemin="0" aria-valuemax="100" aria-label="MRF Contamination Risk Score">
        <div class="risk-bar-fill" style="width: ${score}%; background: ${riskColor};"></div>
        <span class="gauge-tick" style="left: 25%;" title="Moderate Threshold (25)"></span>
        <span class="gauge-tick" style="left: 55%;" title="High Threshold (55)"></span>
        <span class="gauge-tick" style="left: 85%;" title="Critical Rejection Threshold (85)"></span>
      </div>
      <div class="gauge-scale-labels tabular">
        <span>0 LOW</span>
        <span>25 MOD</span>
        <span>55 HIGH</span>
        <span>85+ REJECT</span>
      </div>
      <p class="mrf-note"><strong>Sorting Facility Physics:</strong> ${escapeHtml(mrfFailureMode)}</p>
    </div>
  `;
}

function renderSingleEvaluation(ev) {
  const stepsHtml = ev.prepSteps
    .map((s) => `<li>${escapeHtml(s)}</li>`)
    .join("");

  const resinBadge = ev.resinInfo
    ? `<p class="eval-jurisdiction tabular"><strong>Polymer Stamp:</strong> ${escapeHtml(ev.resinInfo.symbol)} (${escapeHtml(ev.resinInfo.polymer)})</p>`
    : "";

  return `
    <div class="eval-header">
      <div>
        <h3 class="eval-title">${escapeHtml(ev.itemTitle)}</h3>
        <p class="eval-jurisdiction">${escapeHtml(ev.cityName)} // ${escapeHtml(ev.operator)}</p>
        ${resinBadge}
      </div>
      <span class="stream-badge stream-${escapeHtml(ev.stream)}">
        ${getStreamSvgIcon(ev.stream)}
        <span>${escapeHtml(ev.badgeLabel)}</span>
      </span>
    </div>

    ${renderContaminationGauge(ev.contaminationRiskScore, ev.contaminationTier, ev.mrfFailureMode)}

    <div class="eval-section">
      <h4>Required Household Preparation Steps</h4>
      <ul class="prep-list">${stepsHtml}</ul>
    </div>

    <div class="dropoff-card">
      <div class="dropoff-row"><strong>Local Drop-Off &amp; Ordinance Guidance:</strong> ${escapeHtml(ev.dropOffNote)}</div>
      <div class="dropoff-row tabular"><strong>Primary Facility:</strong> ${escapeHtml(ev.dropOffFacility.name)} (${escapeHtml(ev.dropOffFacility.address)})</div>
      <div class="dropoff-row"><strong>Plastic Film Return:</strong> ${escapeHtml(ev.dropOffFacility.retailBagDropOff)}</div>
      <div class="dropoff-row divergence-callout"><strong>Sugar Land vs. Houston Rule Comparison:</strong> ${escapeHtml(ev.cityDivergenceNote)}</div>
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
        ${getStreamSvgIcon(comp.sameStream ? sl.stream : "SPLIT_DISPOSAL")}
        <span>${comp.sameStream ? "Aligned Stream Rules" : `Rule Divergence (Delta ${comp.riskDelta} pts)`}</span>
      </span>
    </div>

    <div class="risk-meter-box">
      <p class="mrf-note" style="margin:0;"><strong>Key Ordinance Comparison:</strong> ${escapeHtml(comp.divergenceSummary)}</p>
      <p class="mrf-note"><strong>MRF Physics:</strong> ${escapeHtml(sl.mrfFailureMode)}</p>
    </div>

    <div class="compare-columns">
      <div class="compare-col">
        <div class="compare-col-head">
          <h4>City of Sugar Land, TX</h4>
          <span class="mono-tag tabular">FORT BEND</span>
        </div>
        <span class="stream-badge stream-${escapeHtml(sl.stream)}">
          ${getStreamSvgIcon(sl.stream)}
          <span>${escapeHtml(sl.badgeLabel)}</span>
        </span>
        <p class="compare-risk-line tabular"><strong>Contamination Risk:</strong> ${sl.contaminationRiskScore}/100 (${escapeHtml(sl.contaminationTier)})</p>
        <ul class="prep-list">
          ${sl.prepSteps.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}
        </ul>
        <p class="compare-facility-line tabular"><strong>Facility:</strong> ${escapeHtml(sl.dropOffFacility.name)}, ${escapeHtml(sl.dropOffFacility.address)}</p>
      </div>

      <div class="compare-col">
        <div class="compare-col-head">
          <h4>City of Houston, TX</h4>
          <span class="mono-tag tabular">SWMD / FCC</span>
        </div>
        <span class="stream-badge stream-${escapeHtml(ho.stream)}">
          ${getStreamSvgIcon(ho.stream)}
          <span>${escapeHtml(ho.badgeLabel)}</span>
        </span>
        <p class="compare-risk-line tabular"><strong>Contamination Risk:</strong> ${ho.contaminationRiskScore}/100 (${escapeHtml(ho.contaminationTier)})</p>
        <ul class="prep-list">
          ${ho.prepSteps.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}
        </ul>
        <p class="compare-facility-line tabular"><strong>Facility:</strong> ${escapeHtml(ho.dropOffFacility.name)}, ${escapeHtml(ho.dropOffFacility.address)}</p>
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
    badgeEl.className = "stream-badge stream-SPLIT_DISPOSAL tabular";
    badgeEl.textContent = "Cart Empty (0 Items)";
    containerEl.innerHTML = `<p class="empty-batch-msg">Use "Add Current Item to Virtual Cart Load" to test how a single tangler or battery affects an otherwise clean recycling bin.</p>`;
    return;
  }

  if (summary.loadStatus === "CLEAN_CURBSIDE_LOAD") {
    badgeEl.className = "stream-badge stream-RECYCLE_CART tabular";
    badgeEl.textContent = `Clean Curbside Load (Avg Risk ${summary.averageRiskScore}/100)`;
  } else if (summary.loadStatus === "NEEDS_SORTING_FIXES") {
    badgeEl.className = "stream-badge stream-SPLIT_DISPOSAL tabular";
    badgeEl.textContent = `Preparation Needed (Max Risk ${summary.maxRiskScore}/100)`;
  } else {
    badgeEl.className = "stream-badge stream-SPECIAL_DROPOFF tabular";
    badgeEl.textContent = `Contaminated Load Alert (${summary.criticalHazards.length} Hazard/Tangler Item${summary.criticalHazards.length === 1 ? "" : "s"})`;
  }

  containerEl.innerHTML = summary.evaluations
    .map(
      (ev, idx) => `
      <div class="batch-chip">
        <div class="batch-chip-top">
          <strong>${escapeHtml(ev.itemTitle)}</strong>
          <button type="button" class="text-btn" data-remove-batch="${idx}">Remove</button>
        </div>
        <span class="batch-chip-meta">Stream: <strong>${escapeHtml(ev.badgeLabel)}</strong></span>
        <span class="batch-chip-meta tabular">Contamination Score: <strong>${ev.contaminationRiskScore}/100</strong> (${escapeHtml(ev.contaminationTier)})</span>
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
      barcodeStatus.className = "barcode-status invalid tabular";
      barcodeStatus.textContent = lookup.validation.reason;
    } else if (lookup.found) {
      barcodeStatus.className = "barcode-status valid tabular";
      barcodeStatus.textContent = `${lookup.validation.reason} Matched: ${lookup.product.productName} (${lookup.product.packagingSummary}).`;
    } else {
      barcodeStatus.className = "barcode-status valid tabular";
      barcodeStatus.textContent = `${lookup.validation.reason} Custom product UPC; evaluating using selected material/resin rule.`;
    }
  } else {
    barcodeStatus.className = "barcode-status tabular";
    barcodeStatus.textContent = "Enter any 12-digit UPC-A or 13-digit EAN-13 barcode, or choose a material category below.";
  }

  renderBarcodeMathStrip(state.barcode);

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
  triggerLaserSweep();
  updateUI();
}

async function startCameraBarcodeScan() {
  const wrap = document.getElementById("camera-preview-wrap");
  const video = document.getElementById("camera-video");
  const statusEl = document.getElementById("barcode-status");

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    statusEl.className = "barcode-status invalid tabular";
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
      statusEl.className = "barcode-status valid tabular";
      statusEl.textContent = "Camera preview active. Enter the printed 12-digit UPC code in the field above.";
    }
  } catch {
    statusEl.className = "barcode-status invalid tabular";
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
      triggerLaserSweep();
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
      triggerLaserSweep();
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
      triggerLaserSweep();
      updateUI();
    });
  });

  document.getElementById("material-select").addEventListener("change", (e) => {
    state.barcode = "";
    state.materialId = e.target.value;
    const matchResin = e.target.value.match(/^resin-(\d)/);
    state.resinCode = matchResin ? Number(matchResin[1]) : null;
    document.getElementById("catalog-select").value = "";
    triggerLaserSweep();
    updateUI();
  });

  document.getElementById("condition-select").addEventListener("change", (e) => {
    state.condition = e.target.value;
    triggerLaserSweep();
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
