/**
 * BinCheck pure HTML renderers. Every function takes data and returns a string.
 * All dynamic text passes through escapeHtml. No DOM access, so every output is
 * unit testable in plain Node.
 */

import { EVIDENCE_BASES, RULES_SNAPSHOT_META } from "../js/bincheck-validate.js";
import { SHORTCUTS } from "./state.js";
import { verdictFor, LOAD_THRESHOLDS } from "./insights.js";

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const TIER_LABELS = { LOW: "Low", MODERATE: "Moderate", HIGH: "High", CRITICAL: "Critical" };
const CONFIDENCE_LABELS = { HIGH: "High confidence", MEDIUM: "Medium confidence", LOW: "Low confidence" };
const LOAD_STATUS_LABELS = {
  EMPTY_BATCH: "No items",
  CLEAN_CURBSIDE_LOAD: "Clean curbside load",
  NEEDS_SORTING_FIXES: "Preparation needed",
  REJECTED_CONTAMINATED_LOAD: "Contaminated load alert"
};
const STREAM_LABELS = {
  RECYCLE_CART: "Recycling cart",
  SPLIT_DISPOSAL: "Split disposal",
  SPECIAL_DROPOFF: "Special drop-off",
  TRASH_CART: "Trash cart",
  GREEN_WASTE: "Green waste"
};

export function streamLabel(stream) {
  return STREAM_LABELS[stream] || String(stream);
}

export function formatPercent(value) {
  return value === null || value === undefined ? "n/a" : `${(value * 100).toFixed(1)}%`;
}

/**
 * Browsers round performance.now() (about 0.1 ms without cross-origin
 * isolation), so a reading below that is reported as such instead of as a
 * misleading 0.000 ms.
 */
export const BROWSER_TIMER_FLOOR_MS = 0.1;

export function formatMs(value, floor = 0) {
  if (value === null || value === undefined) return "n/a";
  if (floor > 0 && value < floor) return `under ${floor} ms`;
  return `${value.toFixed(3)} ms`;
}

const ICON_OPEN = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">`;

const VERDICT_ICON_PATHS = {
  recycle:
    '<path d="M7 19H4.8a1.8 1.8 0 0 1-1.6-2.7L5.4 12.5"/><path d="M11 19h8.2a1.8 1.8 0 0 0 1.6-2.7l-1.2-2.1"/><path d="m14 16-3 3 3 3"/><path d="M8.3 13.4 5.4 12.5l-1 3.1"/><path d="m9.3 5.6 1.2-2.1a1.8 1.8 0 0 1 3.1 0l3.4 5.9"/><path d="m13.6 9.4 3.4-.4.4 3.2"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  dropoff: '<path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.6"/>',
  yard: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10Z"/><path d="M2 21c0-3 1.9-5.4 5.2-6"/>',
  split: '<path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M12 22v-8.3a4 4 0 0 0-1.17-2.83L3 3"/><path d="m15 9 6-6"/>',
  unknown: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16.5v.01"/>'
};

/** Crisp 24px-grid stroke icon for a verdict key (recycle, trash, dropoff, yard, split). */
export function renderVerdictIcon(key, size = 15) {
  const paths = VERDICT_ICON_PATHS[key] || VERDICT_ICON_PATHS.unknown;
  return `<svg class="verdict-icon" width="${Number(size)}" height="${Number(size)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

export function getStreamSvgIcon(stream) {
  return renderVerdictIcon(verdictFor(stream).key);
}

/** Large color-coded verdict for one city: icon, one-word verdict, and the city's own label. */
export function renderVerdictBanner(ev) {
  const v = verdictFor(ev.stream);
  return `
    <div class="verdict-banner verdict-${escapeHtml(v.key)}" data-verdict="${escapeHtml(v.key)}" data-stream="${escapeHtml(ev.stream)}">
      <span class="verdict-banner-icon">${renderVerdictIcon(v.key, 30)}</span>
      <span class="verdict-banner-copy">
        <strong class="verdict-banner-word">${escapeHtml(v.word)}</strong>
        <span class="verdict-banner-where">${escapeHtml(ev.badgeLabel)}</span>
      </span>
      <span class="verdict-banner-city">${escapeHtml(ev.shortCityName || ev.cityName)}</span>
    </div>`;
}

/** Small verdict chip used in search results and the comparison columns. */
export function renderVerdictChip(stream, prefix = "") {
  const v = verdictFor(stream);
  return `<span class="verdict-chip verdict-${escapeHtml(v.key)}">${renderVerdictIcon(v.key, 13)}<span>${prefix ? `<span class="verdict-chip-city">${escapeHtml(prefix)}</span> ` : ""}${escapeHtml(v.word)}</span></span>`;
}

/** Instant search results: one button per match, with both cities' verdicts. */
export function renderSearchResults(result) {
  if (!result.query) return "";
  if (result.results.length === 0) {
    return `<p class="search-empty">No catalog item or material matches "${escapeHtml(result.query)}". Pick the closest material category below, or try words like glass, pizza, battery or foam.</p>`;
  }
  const partialNote = result.partial
    ? `<p class="search-more tabular">No item matches every word. Closest matches:</p>`
    : "";
  const more = result.total > result.results.length ? `<p class="search-more tabular">Showing ${result.results.length} of ${result.total} matches.</p>` : "";
  return `${partialNote}<ul class="search-list" role="list">${result.results
    .map(
      (r, i) => `
      <li>
        <button type="button" class="search-hit${r.citiesDiffer ? " cities-differ" : ""}" data-action="search-pick" data-kind="${escapeHtml(r.kind)}" data-value="${escapeHtml(r.value)}" data-search-index="${i}">
          <span class="search-hit-text">
            <span class="search-hit-title">${escapeHtml(r.title)}</span>
            <span class="search-hit-sub tabular">${escapeHtml(r.sub)}${r.citiesDiffer ? ", cities differ" : ""}</span>
          </span>
          <span class="search-hit-verdicts">${renderVerdictChip(r.Riverside.stream, "SL")}${renderVerdictChip(r.houston.stream, "HOU")}</span>
        </button>
      </li>`
    )
    .join("")}</ul>${more}`;
}

const LOAD_STATUS_TONE = {
  CLEAN_CURBSIDE_LOAD: "recycle",
  NEEDS_SORTING_FIXES: "split",
  REJECTED_CONTAMINATED_LOAD: "dropoff",
  EMPTY_BATCH: "unknown"
};

/** Contamination calculator output: cart grid, average versus worst-item bars, and the finding. */
export function renderImpact(impact) {
  if (impact.total === 0) {
    return `<p class="empty-batch-msg">Add at least one item to see a load status.</p>`;
  }
  const v = impact.itemVerdict;
  const cells =
    Array.from({ length: impact.cleanCount }, () => `<span class="impact-cell verdict-recycle" title="Clean #1 PET bottle"></span>`).join("") +
    Array.from({ length: impact.itemCount }, () => `<span class="impact-cell verdict-${escapeHtml(v.key)} is-test" title="${escapeHtml(impact.itemTitle)}"></span>`).join("");
  const bar = (label, value, tone) => `
    <div class="impact-bar-row">
      <span class="impact-bar-label">${escapeHtml(label)}</span>
      <span class="impact-bar-track">
        <span class="impact-bar-fill verdict-${escapeHtml(tone)}" style="width: ${Math.max(1, Math.min(100, value))}%"></span>
        <span class="impact-tick" style="left: ${LOAD_THRESHOLDS.moderate}%"></span>
        <span class="impact-tick" style="left: ${LOAD_THRESHOLDS.high}%"></span>
        <span class="impact-tick is-reject" style="left: ${LOAD_THRESHOLDS.reject}%"></span>
      </span>
      <strong class="impact-bar-value tabular">${value}/100</strong>
    </div>`;
  const statusTone = LOAD_STATUS_TONE[impact.loadStatus] || "unknown";
  const statusText = LOAD_STATUS_LABELS[impact.loadStatus] || impact.loadStatus;
  let finding;
  if (impact.itemCount === 0) {
    finding = `With only clean bottles the load is clean, average risk ${impact.averageRiskScore}/100.`;
  } else if (impact.averageHidesProblem) {
    finding = `The average risk is only ${impact.averageRiskScore}/100, but load status follows the worst item. ${impact.itemCount === 1 ? "One" : impact.itemCount} ${escapeHtml(impact.itemTitle)} at ${impact.itemRisk}/100 makes this a "${escapeHtml(statusText)}" load, and adding more clean bottles cannot dilute it. ${escapeHtml(v.word)} is the right place for it.`;
  } else if (impact.itemStream === "RECYCLE_CART") {
    finding = `${escapeHtml(impact.itemTitle)} belongs in the cart (risk ${impact.itemRisk}/100), so the load stays "${escapeHtml(statusText)}".`;
  } else {
    finding = `Average risk ${impact.averageRiskScore}/100, worst item ${impact.maxRiskScore}/100: "${escapeHtml(statusText)}". ${escapeHtml(v.word)} is the right place for this item.`;
  }
  return `
    <div class="impact-result">
      <div class="impact-status verdict-${escapeHtml(statusTone)}">
        ${renderVerdictIcon(statusTone, 20)}
        <strong>${escapeHtml(statusText)}</strong>
        <span class="tabular">${impact.total} items, ${impact.wrongItems} in the wrong bin (${formatPercent(impact.wrongShare)})</span>
      </div>
      <div class="impact-grid" role="img" aria-label="${impact.cleanCount} clean bottles and ${impact.itemCount} of the current item">${cells}</div>
      <div class="impact-bars">
        ${bar("Average risk", impact.averageRiskScore, impact.averageRiskScore >= LOAD_THRESHOLDS.reject ? "dropoff" : impact.averageRiskScore >= LOAD_THRESHOLDS.high ? "split" : "recycle")}
        ${bar("Worst item", impact.maxRiskScore, statusTone)}
        <p class="impact-scale tabular">Ticks at ${LOAD_THRESHOLDS.moderate}, ${LOAD_THRESHOLDS.high} and ${LOAD_THRESHOLDS.reject}, the same thresholds the cart and the engine use.</p>
      </div>
      <p class="impact-finding">${finding}</p>
    </div>`;
}

export function renderStreamBadge(stream, label) {
  return `<span class="stream-badge stream-${escapeHtml(stream)}">${getStreamSvgIcon(stream)}<span>${escapeHtml(label)}</span></span>`;
}

export function renderBarcodeMathStrip(check) {
  if (!check) {
    return `<span class="math-chip">Barcode math idle. Pick a resin code or enter a 12-digit UPC.</span>`;
  }
  if (!check.valid) {
    return [
      `<span class="math-chip math-chip-err">Format: ${escapeHtml(check.format)}</span>`,
      `<span class="math-chip math-chip-err">Expected check digit: ${check.expectedCheckDigit ?? "n/a"}</span>`,
      `<span class="math-chip math-chip-err">Found: ${check.actualCheckDigit ?? "n/a"}</span>`
    ].join("");
  }
  const payload = check.normalized.slice(0, -1);
  return [
    `<span class="math-chip">Format: <strong>${escapeHtml(check.format)}</strong></span>`,
    `<span class="math-chip">Payload: <strong>${escapeHtml(payload)}</strong></span>`,
    `<span class="math-chip">Mod-10 check: <strong>${check.actualCheckDigit}</strong></span>`,
    check.ean13 ? `<span class="math-chip">EAN-13: <strong>${escapeHtml(check.ean13)}</strong></span>` : ""
  ].join("");
}

/** Banded gauge: four tier zones plus a marker, with text alternatives. */
export function renderContaminationGauge(score, tier, mrfFailureMode) {
  const safeScore = Math.max(0, Math.min(100, Number(score) || 0));
  return `
    <div class="risk-meter-box">
      <div class="risk-meter-top">
        <span>Sorting facility contamination risk</span>
        <span class="tabular risk-score-readout tier-${escapeHtml(tier)}">${safeScore}/100, ${escapeHtml(TIER_LABELS[tier] || tier)}</span>
      </div>
      <div class="risk-bar-track" role="meter" aria-valuenow="${safeScore}" aria-valuemin="0" aria-valuemax="100" aria-valuetext="${safeScore} of 100, ${escapeHtml(TIER_LABELS[tier] || tier)} tier" aria-label="Sorting facility contamination risk score">
        <span class="risk-zone zone-low" style="width: 25%"></span>
        <span class="risk-zone zone-moderate" style="width: 30%"></span>
        <span class="risk-zone zone-high" style="width: 30%"></span>
        <span class="risk-zone zone-critical" style="width: 15%"></span>
        <span class="risk-marker marker-${escapeHtml(tier)}" style="left: ${safeScore}%"></span>
      </div>
      <div class="gauge-scale-labels tabular" aria-hidden="true">
        <span>0 Low</span>
        <span>25 Moderate</span>
        <span>55 High</span>
        <span>85+ Reject</span>
      </div>
      <p class="mrf-note"><strong>Sorting facility physics:</strong> ${escapeHtml(mrfFailureMode)}</p>
    </div>
  `;
}

function renderIssueList(issues) {
  const visible = issues.filter((entry) => entry.severity !== "info" || entry.code === "BARCODE_NOT_IN_CATALOG");
  if (visible.length === 0) {
    return "";
  }
  const label = { error: "Error", warning: "Check", info: "Note" };
  return `<ul class="issue-list">${visible
    .map(
      (entry) =>
        `<li class="issue issue-${escapeHtml(entry.severity)}"><strong>${escapeHtml(label[entry.severity] || "Note")}:</strong> ${escapeHtml(entry.message)}</li>`
    )
    .join("")}</ul>`;
}

/** Evidence ladder and confidence pill. Confidence is provenance, not a probability. */
export function renderEvidencePanel(assessment) {
  const steps = EVIDENCE_BASES.map((entry) => {
    const active = entry.id === assessment.basis;
    return `<li class="ladder-step${active ? " is-active" : ""}"${active ? ' aria-current="step"' : ""}><span class="ladder-rank tabular">${entry.rank}</span><span class="ladder-text">${escapeHtml(entry.label)}${active ? '<span class="sr-only"> (current basis)</span>' : ""}</span></li>`;
  }).join("");
  return `
    <section class="evidence-panel" aria-label="How this result was identified">
      <div class="evidence-head">
        <h4>How this was identified</h4>
        <span class="confidence-pill confidence-${escapeHtml(assessment.confidence)}">${escapeHtml(CONFIDENCE_LABELS[assessment.confidence])}</span>
      </div>
      <ol class="evidence-ladder" aria-label="Evidence ladder, strongest first">${steps}</ol>
      <p class="evidence-note">${escapeHtml(assessment.confidenceReason)}</p>
      <p class="evidence-footnote">Confidence shows how the item was identified. It is not a probability that the municipal rule is correct.</p>
      ${renderIssueList(assessment.issues)}
    </section>
  `;
}

function renderSourceLine(ev) {
  return `<div class="dropoff-row source-row"><strong>Official source:</strong> <a class="inline-link" href="${escapeHtml(ev.officialSourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(ev.cityName)}<span class="sr-only"> (opens in a new tab)</span></a>. Rules verified ${escapeHtml(RULES_SNAPSHOT_META.lastVerifiedDate)}.</div>`;
}

const CITE_KIND_LABELS = {
  verbatim: "City rule text",
  interpretation: "Applied rule",
  inference: "Engine estimate"
};

/** Municipal rule trace: the exact snapshot fields behind the verdict, quoted. */
export function renderRuleCitations(citations) {
  if (!Array.isArray(citations) || citations.length === 0) {
    return "";
  }
  const items = citations
    .map(
      (entry) => `
      <li class="rule-cite">
        <div class="rule-cite-head">
          <code class="rule-id">${escapeHtml(entry.ruleId)}</code>
          <span class="cite-kind cite-kind-${escapeHtml(entry.kind)}">${escapeHtml(CITE_KIND_LABELS[entry.kind] || entry.kind)}</span>
        </div>
        <p class="rule-quote">${escapeHtml(entry.quote)}</p>
      </li>`
    )
    .join("");
  const source = citations[0] && citations[0].source ? citations[0].source : "data/municipal-rules-2026.json";
  return `<div class="rule-trace">
    <h4>Municipal rule trace</h4>
    <ul class="rule-cite-list">${items}</ul>
    <p class="rule-source tabular">Fields quoted from ${escapeHtml(source)}, snapshot verified ${escapeHtml(RULES_SNAPSHOT_META.lastVerifiedDate)}.</p>
  </div>`;
}

export function renderSingleEvaluation(ev, assessment) {
  const stepsHtml = ev.prepSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join("");
  const resinBadge = ev.resinInfo
    ? `<p class="eval-jurisdiction tabular"><strong>Polymer stamp:</strong> ${escapeHtml(ev.resinInfo.symbol)} (${escapeHtml(ev.resinInfo.polymer)})</p>`
    : "";
  return `
    <div class="eval-header">
      <div>
        <h3 class="eval-title">${escapeHtml(ev.itemTitle)}</h3>
        <p class="eval-jurisdiction">${escapeHtml(ev.cityName)}, ${escapeHtml(ev.operator)}</p>
        ${resinBadge}
      </div>
    </div>
    ${renderVerdictBanner(ev)}
    ${renderContaminationGauge(ev.contaminationRiskScore, ev.contaminationTier, ev.mrfFailureMode)}
    ${renderRuleCitations(ev.ruleCitations)}
    ${renderEvidencePanel(assessment)}
    <div class="eval-section">
      <h4>Required household preparation steps</h4>
      <ol class="prep-list">${stepsHtml}</ol>
    </div>
    <div class="dropoff-card">
      <div class="dropoff-row"><strong>Local drop-off and ordinance guidance:</strong> ${escapeHtml(ev.dropOffNote)}</div>
      <div class="dropoff-row tabular"><strong>Primary facility:</strong> ${escapeHtml(ev.dropOffFacility.name)} (${escapeHtml(ev.dropOffFacility.address)})</div>
      <div class="dropoff-row"><strong>Plastic film return:</strong> ${escapeHtml(ev.dropOffFacility.retailBagDropOff)}</div>
      <div class="dropoff-row divergence-callout"><strong>Riverside vs. Houston:</strong> ${escapeHtml(ev.cityDivergenceNote)}</div>
      ${renderSourceLine(ev)}
    </div>
  `;
}

function renderCompareColumn(ev, tag) {
  return `
    <div class="compare-col">
      <div class="compare-col-head">
        <h4>${escapeHtml(ev.cityName)}</h4>
        <span class="mono-tag tabular">${escapeHtml(tag)}</span>
      </div>
      ${renderVerdictBanner(ev)}
      <p class="compare-risk-line tabular"><strong>Contamination risk:</strong> ${ev.contaminationRiskScore}/100 (${escapeHtml(TIER_LABELS[ev.contaminationTier])})</p>
      ${renderRuleCitations(ev.ruleCitations)}
      <ol class="prep-list">${ev.prepSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
      <p class="compare-facility-line tabular"><strong>Facility:</strong> ${escapeHtml(ev.dropOffFacility.name)}, ${escapeHtml(ev.dropOffFacility.address)}</p>
    </div>
  `;
}

/** Dramatizes a true municipal divergence: the same item, two different verdicts. */
function renderVerdictFlip(sl, ho) {
  return `
    <div class="verdict-flip" role="note" aria-label="The two cities give different verdicts for this item">
      <p class="verdict-flip-title">Same item. Different verdict.</p>
      <div class="verdict-flip-cols">
        <div class="flip-city">
          <span class="flip-city-name">Riverside</span>
          ${renderVerdictChip(sl.stream)}
          <span class="flip-verdict-label">${escapeHtml(sl.badgeLabel)}</span>
        </div>
        <span class="flip-arrow" aria-hidden="true">&#8594;</span>
        <div class="flip-city">
          <span class="flip-city-name">Houston</span>
          ${renderVerdictChip(ho.stream)}
          <span class="flip-verdict-label">${escapeHtml(ho.badgeLabel)}</span>
        </div>
      </div>
    </div>`;
}

export function renderComparisonView(comp, assessment) {
  const sl = comp.Riverside;
  const ho = comp.houston;
  const aligned = comp.sameStream;
  const badgeStream = aligned ? sl.stream : "SPLIT_DISPOSAL";
  const badgeText = aligned ? "Same stream in both cities" : `Rules differ (risk delta ${comp.riskDelta} pts)`;
  return `
    <div class="eval-header">
      <div>
        <h3 class="eval-title">${escapeHtml(comp.itemTitle)}</h3>
        <p class="eval-jurisdiction">Side-by-side municipal comparison: Riverside and Houston</p>
      </div>
      ${renderStreamBadge(badgeStream, badgeText)}
    </div>
    ${aligned ? "" : renderVerdictFlip(sl, ho)}
    <div class="risk-meter-box">
      <p class="mrf-note" style="margin: 0"><strong>Key ordinance comparison:</strong> ${escapeHtml(comp.divergenceSummary)}</p>
      <p class="mrf-note"><strong>Sorting facility physics:</strong> ${escapeHtml(sl.mrfFailureMode)}</p>
    </div>
    ${renderEvidencePanel(assessment)}
    <div class="compare-columns">
      ${renderCompareColumn(sl, "county")}
      ${renderCompareColumn(ho, "SWMD")}
    </div>
    <p class="source-row">Rules verified ${escapeHtml(RULES_SNAPSHOT_META.lastVerifiedDate)}. Sources: <a class="inline-link" href="${escapeHtml(sl.officialSourceUrl)}" target="_blank" rel="noopener noreferrer">Riverside<span class="sr-only"> (opens in a new tab)</span></a> and <a class="inline-link" href="${escapeHtml(ho.officialSourceUrl)}" target="_blank" rel="noopener noreferrer">Houston<span class="sr-only"> (opens in a new tab)</span></a>.</p>
  `;
}

export function renderCart(summary) {
  if (summary.itemCount === 0) {
    return {
      badgeClass: "stream-badge stream-SPLIT_DISPOSAL tabular",
      badgeText: "Cart empty (0 items)",
      html: `<p class="empty-batch-msg">Use "Add current item to virtual cart" to test how a single tangler or battery affects an otherwise clean recycling bin.</p>`
    };
  }
  let badgeClass;
  let badgeText;
  if (summary.loadStatus === "CLEAN_CURBSIDE_LOAD") {
    badgeClass = "stream-badge stream-RECYCLE_CART tabular";
    badgeText = `Clean curbside load (average risk ${summary.averageRiskScore}/100)`;
  } else if (summary.loadStatus === "NEEDS_SORTING_FIXES") {
    badgeClass = "stream-badge stream-SPLIT_DISPOSAL tabular";
    badgeText = `Preparation needed (max risk ${summary.maxRiskScore}/100)`;
  } else {
    const count = summary.criticalHazards.length;
    badgeClass = "stream-badge stream-SPECIAL_DROPOFF tabular";
    badgeText = `Contaminated load alert (${count} hazard or tangler item${count === 1 ? "" : "s"})`;
  }
  const html = renderCartRiskProfile(summary) + `<div class="batch-chip-grid">` + summary.evaluations
    .map(
      (ev, index) => `
      <div class="batch-chip">
        <div class="batch-chip-top">
          <strong>${escapeHtml(ev.itemTitle)}</strong>
          <button type="button" class="text-btn" data-action="remove-cart" data-index="${index}" aria-label="Remove ${escapeHtml(ev.itemTitle)} from the cart">Remove</button>
        </div>
        <span class="batch-chip-meta">Stream: <strong>${escapeHtml(ev.badgeLabel)}</strong></span>
        <span class="batch-chip-meta tabular">Contamination score: <strong>${ev.contaminationRiskScore}/100</strong> (${escapeHtml(TIER_LABELS[ev.contaminationTier])})</span>
      </div>`
    )
    .join("") + `</div>`;
  return { badgeClass, badgeText, html };
}

const TIER_FILL = { LOW: "var(--accent)", MODERATE: "var(--amber)", HIGH: "var(--amber-text)", CRITICAL: "var(--hazard)" };

/**
 * Per-item risk profile for the virtual cart: one bar per item, drawn against
 * the same 25, 55 and 85 thresholds the load status uses. Pure SVG, no canvas,
 * so it prints and scales cleanly.
 */
export function renderCartRiskProfile(summary) {
  const items = summary.evaluations || [];
  if (items.length === 0) {
    return "";
  }
  const width = 640;
  const height = 132;
  const padLeft = 34;
  const padRight = 8;
  const padTop = 10;
  const padBottom = 22;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const slot = plotW / items.length;
  const barW = Math.max(6, Math.min(44, slot * 0.62));
  const y = (score) => padTop + plotH - (Math.max(0, Math.min(100, score)) / 100) * plotH;
  const thresholds = [
    { v: 25, label: "25" },
    { v: 55, label: "55" },
    { v: 85, label: "85" }
  ]
    .map((t) => `<line x1="${padLeft}" x2="${width - padRight}" y1="${y(t.v).toFixed(1)}" y2="${y(t.v).toFixed(1)}" class="cart-threshold${t.v === 85 ? " is-reject" : ""}"/><text x="${padLeft - 6}" y="${(y(t.v) + 3.5).toFixed(1)}" class="cart-axis" text-anchor="end">${t.label}</text>`)
    .join("");
  const bars = items
    .map((ev, index) => {
      const x = padLeft + slot * index + (slot - barW) / 2;
      const top = y(ev.contaminationRiskScore);
      const h = padTop + plotH - top;
      return `<g><title>${escapeHtml(ev.itemTitle)}: ${ev.contaminationRiskScore}/100, ${escapeHtml(TIER_LABELS[ev.contaminationTier])}</title><rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(1.5, h).toFixed(1)}" rx="2" fill="${TIER_FILL[ev.contaminationTier]}"/><text x="${(x + barW / 2).toFixed(1)}" y="${height - 7}" class="cart-axis" text-anchor="middle">${index + 1}</text></g>`;
    })
    .join("");
  const avgY = y(summary.averageRiskScore);
  const label = `Risk profile of ${items.length} cart item${items.length === 1 ? "" : "s"}: average ${summary.averageRiskScore}, maximum ${summary.maxRiskScore} out of 100`;
  return `<figure class="cart-profile"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(label)}" preserveAspectRatio="none">
    <rect x="${padLeft}" y="${padTop}" width="${plotW}" height="${plotH}" class="cart-plot"/>
    ${thresholds}${bars}
    <line x1="${padLeft}" x2="${width - padRight}" y1="${avgY.toFixed(1)}" y2="${avgY.toFixed(1)}" class="cart-average"/>
  </svg><figcaption class="cart-profile-key tabular"><span class="key-swatch is-avg" aria-hidden="true"></span>Average ${summary.averageRiskScore}<span class="key-swatch is-reject" aria-hidden="true"></span>Reject line 85</figcaption></figure>`;
}

function renderStreamBar(streamCounts, total, label) {
  const entries = Object.entries(streamCounts);
  if (total === 0 || entries.length === 0) {
    return `<p class="empty-batch-msg">No evaluated rows.</p>`;
  }
  const segments = entries
    .map(([stream, count]) => `<span class="stream-seg stream-${escapeHtml(stream)}" style="width: ${((count / total) * 100).toFixed(2)}%" title="${escapeHtml(streamLabel(stream))}: ${count}"></span>`)
    .join("");
  const legend = entries
    .map(([stream, count]) => `<li><span class="legend-dot stream-${escapeHtml(stream)}" aria-hidden="true"></span>${escapeHtml(streamLabel(stream))}: <strong class="tabular">${count}</strong></li>`)
    .join("");
  return `<div class="stream-bar" role="img" aria-label="${escapeHtml(label)}">${segments}</div><ul class="stream-legend">${legend}</ul>`;
}

const STATUS_LABELS = { OK: "OK", WARN: "Check", ERROR: "Error" };

export function renderBatchReport(result) {
  const totals = result.totals;
  const parseErrors = result.parse.errors || [];
  const kpis = [
    ["Rows read", totals.rows],
    ["Evaluated", totals.evaluated],
    ["Need a check", totals.warnings],
    ["Could not identify", totals.errors],
    ["Cities disagree", totals.divergent]
  ]
    .map(([label, value]) => `<div class="kpi-cell"><dt>${escapeHtml(label)}</dt><dd class="tabular">${value}</dd></div>`)
    .join("");

  const cityCards = Object.values(result.cities)
    .map((city) => {
      const status = city.itemCount === 0 ? "EMPTY_BATCH" : city.loadStatus;
      const statusClass =
        status === "CLEAN_CURBSIDE_LOAD" ? "RECYCLE_CART" : status === "NEEDS_SORTING_FIXES" ? "SPLIT_DISPOSAL" : "SPECIAL_DROPOFF";
      return `
        <div class="city-summary-card">
          <div class="city-summary-head"><h4>${escapeHtml(city.cityName)}</h4><span class="stream-badge stream-${statusClass}">${escapeHtml(LOAD_STATUS_LABELS[status])}</span></div>
          <p class="tabular city-summary-meta">Average risk ${city.averageRiskScore}/100, maximum ${city.maxRiskScore}/100</p>
          <p class="diversion-line"><strong class="tabular">${city.cartEligible} of ${city.itemCount}</strong> evaluated items are cart-eligible (<strong class="tabular">${city.cartEligiblePct}%</strong>)${city.notCartEligible > 0 ? `; <strong class="tabular">${city.notCartEligible}</strong> must stay out of the cart` : ""}</p>
          ${renderStreamBar(city.streamCounts, city.itemCount, `${city.cityName} stream mix`)}
        </div>`;
    })
    .join("");

  const errorLines = [
    ...parseErrors.map((entry) => `<li><span class="tabular">${entry.line ? `Line ${entry.line}` : "Input"}:</span> ${escapeHtml(entry.message)}</li>`),
    ...result.rows
      .filter((row) => row.status === "ERROR")
      .map((row) => `<li><span class="tabular">Line ${row.line}:</span> ${escapeHtml(row.issues.map((entry) => entry.message).join(" "))}</li>`)
  ];
  const errorBlock = errorLines.length
    ? `<div class="batch-errors" role="alert"><h4>Rows that need attention</h4><ul>${errorLines.join("")}</ul></div>`
    : "";

  const tableRows = result.rows
    .map((row) => {
      const sl = row.cities ? row.cities["Riverside-tx"] : null;
      const ho = row.cities ? row.cities["houston-tx"] : null;
      const cell = (city) =>
        city
          ? `${renderStreamBadge(city.stream, city.badgeLabel)}<span class="cell-sub tabular">Risk ${city.riskScore}/100</span>`
          : `<span class="cell-sub">Not evaluated</span>`;
      return `<tr class="row-${escapeHtml(row.status)}">
        <td data-label="Line" class="tabular">${row.line}</td>
        <td data-label="Item"><strong>${escapeHtml(row.label || row.itemTitle || "Unlabeled row")}</strong>${row.itemTitle && row.label ? `<span class="cell-sub">${escapeHtml(row.itemTitle)}</span>` : ""}</td>
        <td data-label="Evidence"><span class="confidence-pill confidence-${escapeHtml(row.confidence)}">${escapeHtml(CONFIDENCE_LABELS[row.confidence])}</span></td>
        <td data-label="Riverside">${cell(sl)}</td>
        <td data-label="Houston">${cell(ho)}</td>
        <td data-label="Status"><span class="status-pill status-${escapeHtml(row.status)}">${escapeHtml(STATUS_LABELS[row.status])}</span>${row.streamsDiverge ? '<span class="cell-sub">Cities differ</span>' : ""}</td>
      </tr>`;
    })
    .join("");

  return `
    <dl class="kpi-strip" aria-label="Batch totals">${kpis}</dl>
    <div class="city-summary-grid">${cityCards}</div>
    ${errorBlock}
    ${
      result.rows.length
        ? `<div class="table-wrap"><table class="stack-table batch-table"><caption class="sr-only">Per-row inspection results for Riverside and Houston</caption><thead><tr><th scope="col">Line</th><th scope="col">Item</th><th scope="col">Evidence</th><th scope="col">Riverside</th><th scope="col">Houston</th><th scope="col">Status</th></tr></thead><tbody>${tableRows}</tbody></table></div>`
        : ""
    }
  `;
}

function kpi(label, value, hint) {
  return `<div class="kpi-cell"><dt>${escapeHtml(label)}</dt><dd class="tabular">${escapeHtml(value)}</dd>${hint ? `<span class="kpi-hint">${escapeHtml(hint)}</span>` : ""}</div>`;
}

function heatStyle(count, max) {
  return max === 0 ? "--heat: 0" : `--heat: ${(count / max).toFixed(3)}`;
}

export function renderBenchmark(result) {
  const { cart, stream, tiers, barcode, latency, meta } = result;
  const maxStream = Math.max(0, ...stream.labels.flatMap((truth) => stream.labels.map((pred) => stream.matrix[truth][pred])));
  const usedLabels = stream.labels.filter(
    (label) => stream.labels.some((other) => stream.matrix[label][other] > 0 || stream.matrix[other][label] > 0)
  );

  const streamHeader = usedLabels.map((label) => `<th scope="col">${escapeHtml(streamLabel(label))}</th>`).join("");
  const streamRows = usedLabels
    .map(
      (truth) =>
        `<tr><th scope="row">${escapeHtml(streamLabel(truth))}</th>${usedLabels
          .map((pred) => {
            const count = stream.matrix[truth][pred];
            const diagonal = truth === pred;
            return `<td class="matrix-cell tabular${diagonal ? " is-diagonal" : count > 0 ? " is-miss" : ""}" style="${heatStyle(count, maxStream)}">${count}</td>`;
          })
          .join("")}</tr>`
    )
    .join("");

  const maxTier = Math.max(1, ...tiers.map((row) => row.total));
  const tierRows = tiers
    .map(
      (row) => `<tr>
        <th scope="row"><span class="tier-chip tier-${row.tier}">${escapeHtml(TIER_LABELS[row.tier])}</span></th>
        <td data-label="Evaluations" class="tabular">${row.total}</td>
        <td data-label="Curbside" class="tabular">${row.cartTrue}</td>
        <td data-label="Not curbside" class="tabular">${row.cartFalse}</td>
        <td data-label="Split"><div class="tier-bar" role="img" aria-label="${escapeHtml(TIER_LABELS[row.tier])} tier: ${row.cartTrue} curbside, ${row.cartFalse} not curbside"><span class="tier-bar-ok" style="width: ${((row.cartTrue / maxTier) * 100).toFixed(2)}%"></span><span class="tier-bar-no" style="width: ${((row.cartFalse / maxTier) * 100).toFixed(2)}%"></span></div></td>
      </tr>`
    )
    .join("");

  const openGaps = result.knownGaps.filter((gap) => gap.stillOpen);
  const gapBlock = result.knownGaps.length
    ? `<div class="gap-card${openGaps.length ? " has-open" : ""}"><h4>Inferred rule extensions: ${result.knownGaps.length - openGaps.length} handled, ${openGaps.length} open</h4><ul>${result.knownGaps
        .map(
          (gap) =>
            `<li><span class="gap-state ${gap.stillOpen ? "is-open" : "is-ok"}">${gap.stillOpen ? "Open" : "Handled"}</span> <strong>${escapeHtml(gap.label)}</strong> in ${escapeHtml(gap.city === "houston-tx" ? "Houston" : "Riverside")}: expected ${escapeHtml(streamLabel(gap.expectedStream))}, engine says ${escapeHtml(streamLabel(gap.actualStream))}.</li>`
        )
        .join("")}</ul><p class="kpi-hint">These cases extend a stated city rule to a similar item, so they are inferences. They are scored separately and never counted in the headline numbers.</p></div>`
    : "";

  const failureBlock = result.failures.length
    ? `<div class="batch-errors" role="alert"><h4>Scored failures (${result.failures.length})</h4><ul>${result.failures
        .map((failure) => `<li><span class="tabular">${escapeHtml(failure.caseId)}</span> in ${escapeHtml(failure.city)}, ${escapeHtml(failure.field)}: expected ${escapeHtml(failure.expected)}, got ${escapeHtml(failure.actual)}</li>`)
        .join("")}</ul></div>`
    : `<p class="benchmark-pass">Every scored case matched the snapshot-anchored ground truth.</p>`;

  const bc = barcode.confusion;
  const tr = barcode.transpositions;

  return `
    <p class="benchmark-scope"><span class="data-badge is-computed">Computed in this tab</span> ${meta.baseCases} anchored cases plus ${meta.catalogCases} catalog barcodes, ${meta.scoredEvaluations} city evaluations. ${meta.unanchoredCatalogItems.length} catalog items have no snapshot rule and are not scored. The score measures agreement with the rules snapshot verified ${escapeHtml(meta.rulesSnapshot.lastVerifiedDate)}, not field accuracy at a real facility.</p>
    ${failureBlock}
    <dl class="kpi-strip" aria-label="Recycling cart routing metrics">
      ${kpi("Accuracy", formatPercent(cart.accuracy), `${cart.tp + cart.tn} of ${cart.total} correct`)}
      ${kpi("Precision", formatPercent(cart.precision), "Cart routing that was right")}
      ${kpi("Recall", formatPercent(cart.recall), "Cart items found")}
      ${kpi("False positives", String(cart.fp), "Wish-cycling errors")}
      ${kpi("Stream accuracy", formatPercent(stream.accuracy), `${stream.correct} of ${stream.scored} streams`)}
    </dl>
    <div class="benchmark-grid">
      <div class="benchmark-card">
        <h4>Cart routing confusion matrix</h4>
        <div class="table-wrap"><table class="matrix-table"><caption class="sr-only">Rows are ground truth, columns are the engine decision</caption>
          <thead><tr><th scope="col"><span class="sr-only">Ground truth</span></th><th scope="col">Engine: cart</th><th scope="col">Engine: other</th></tr></thead>
          <tbody>
            <tr><th scope="row">Truth: curbside</th><td class="matrix-cell tabular is-diagonal" style="${heatStyle(cart.tp, Math.max(cart.tp, cart.tn, cart.fp, cart.fn))}">${cart.tp}</td><td class="matrix-cell tabular${cart.fn ? " is-miss" : ""}" style="${heatStyle(cart.fn, Math.max(cart.tp, cart.tn, cart.fp, cart.fn))}">${cart.fn}</td></tr>
            <tr><th scope="row">Truth: not curbside</th><td class="matrix-cell tabular${cart.fp ? " is-miss" : ""}" style="${heatStyle(cart.fp, Math.max(cart.tp, cart.tn, cart.fp, cart.fn))}">${cart.fp}</td><td class="matrix-cell tabular is-diagonal" style="${heatStyle(cart.tn, Math.max(cart.tp, cart.tn, cart.fp, cart.fn))}">${cart.tn}</td></tr>
          </tbody></table></div>
      </div>
      <div class="benchmark-card">
        <h4>Disposal stream confusion matrix</h4>
        <div class="table-wrap"><table class="matrix-table"><caption class="sr-only">Rows are ground truth stream, columns are the engine stream</caption>
          <thead><tr><th scope="col"><span class="sr-only">Ground truth</span></th>${streamHeader}</tr></thead>
          <tbody>${streamRows}</tbody></table></div>
      </div>
    </div>
    <div class="benchmark-card">
      <h4>Risk tier calibration</h4>
      <div class="table-wrap"><table class="stack-table tier-table"><caption class="sr-only">Evaluations per risk tier by ground truth outcome</caption>
        <thead><tr><th scope="col">Tier</th><th scope="col">Evaluations</th><th scope="col">Curbside</th><th scope="col">Not curbside</th><th scope="col">Split</th></tr></thead>
        <tbody>${tierRows}</tbody></table></div>
      <p class="kpi-hint">A well-calibrated tier is all curbside (Low, Moderate) or all not curbside (High, Critical).</p>
    </div>
    <div class="benchmark-grid">
      <div class="benchmark-card">
        <h4>Barcode integrity</h4>
        <dl class="kpi-strip kpi-strip-compact">
          ${kpi("Check digit accuracy", formatPercent(barcode.accuracy), `TP ${bc.tp}, FP ${bc.fp}, FN ${bc.fn}, TN ${bc.tn}`)}
          ${kpi("Transpositions caught", `${tr.detected} of ${tr.tried}`, formatPercent(tr.detectionRate))}
          ${kpi("Substitutions caught", `${barcode.substitutions.detected} of ${barcode.substitutions.tried}`, formatPercent(barcode.substitutions.detectionRate))}
        </dl>
        <p class="kpi-hint">${tr.undetected === tr.undetectedExplainedByDigitGapOfFive ? `All ${tr.undetected} missed swaps exchange digits that differ by 5, a known blind spot of the GS1 Modulo-10 check.` : "Some missed swaps are not explained by the digit gap rule; investigate."}</p>
      </div>
      <div class="benchmark-card">
        <h4>Engine latency</h4>
        <dl class="kpi-strip kpi-strip-compact">
          ${kpi("Median", formatMs(latency.p50, BROWSER_TIMER_FLOOR_MS), `${latency.samples} evaluations`)}
          ${kpi("95th percentile", formatMs(latency.p95, BROWSER_TIMER_FLOOR_MS), "")}
          ${kpi("Slowest", formatMs(latency.max, BROWSER_TIMER_FLOOR_MS), "")}
        </dl>
        <p class="kpi-hint"><span class="data-badge is-computed">Measured live</span>In this browser tab just now, so it varies by device. Browser timers round to about 0.1 ms. Never written to exports.</p>
      </div>
    </div>
    ${gapBlock}
  `;
}

export function renderPrintReport(vm, batchResult) {
  const { comparison, assessment } = vm;
  const sl = comparison.Riverside;
  const ho = comparison.houston;
  const cityBlock = (ev) => `
    <section class="print-city">
      <h3>${escapeHtml(ev.cityName)}</h3>
      <p><strong>Stream:</strong> ${escapeHtml(ev.badgeLabel)}. <strong>Risk:</strong> ${ev.contaminationRiskScore}/100 (${escapeHtml(TIER_LABELS[ev.contaminationTier])}).</p>
      <ol>${ev.prepSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
      <p><strong>Facility:</strong> ${escapeHtml(ev.dropOffFacility.name)}, ${escapeHtml(ev.dropOffFacility.address)}</p>
      <p><strong>Source:</strong> ${escapeHtml(ev.officialSourceUrl)}</p>
    </section>`;
  const batchBlock = batchResult
    ? `<section class="print-batch"><h3>Batch inspection summary</h3>
        <p>${batchResult.totals.rows} rows read, ${batchResult.totals.evaluated} evaluated, ${batchResult.totals.errors} could not be identified, ${batchResult.totals.divergent} where the two cities disagree.</p>
        <table><thead><tr><th>Line</th><th>Item</th><th>Riverside</th><th>Houston</th></tr></thead><tbody>${batchResult.rows
          .map(
            (row) =>
              `<tr><td>${row.line}</td><td>${escapeHtml(row.label || row.itemTitle || "Unlabeled row")}</td><td>${row.cities ? escapeHtml(row.cities["Riverside-tx"].badgeLabel) : "Not evaluated"}</td><td>${row.cities ? escapeHtml(row.cities["houston-tx"].badgeLabel) : "Not evaluated"}</td></tr>`
          )
          .join("")}</tbody></table></section>`
    : "";
  return `
    <h2>BinCheck inspection report</h2>
    <p class="print-meta">Item: <strong>${escapeHtml(comparison.itemTitle)}</strong>. Evidence: ${escapeHtml(assessment.basisLabel)}, ${escapeHtml(CONFIDENCE_LABELS[assessment.confidence].toLowerCase())}. Rules verified ${escapeHtml(RULES_SNAPSHOT_META.lastVerifiedDate)}.</p>
    <p class="print-meta">${escapeHtml(comparison.divergenceSummary)}</p>
    <div class="print-cities">${cityBlock(sl)}${cityBlock(ho)}</div>
    ${batchBlock}
    <p class="print-foot">Generated locally in the browser. Confirm any borderline item with the official city source above.</p>
  `;
}

export function renderShortcutList() {
  return SHORTCUTS.map(
    (entry) =>
      `<li><kbd>${escapeHtml(entry.key === "Escape" ? "Esc" : entry.key)}</kbd><span>${escapeHtml(entry.description)}</span></li>`
  ).join("");
}
