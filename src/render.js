/**
 * BinCheck pure HTML renderers. Every function takes data and returns a string.
 * All dynamic text passes through escapeHtml. No DOM access, so every output is
 * unit testable in plain Node.
 */

import { EVIDENCE_BASES, RULES_SNAPSHOT_META } from "../js/bincheck-validate.js";
import {
  t,
  normalizeLang,
  issueMessageEs,
  parseErrorMessageEs,
  TIER_LABELS_ES,
  CONFIDENCE_LABELS_ES,
  LOAD_STATUS_LABELS_ES,
  STREAM_LABELS_ES,
  STATUS_LABELS_ES,
  CITE_KIND_LABELS_ES,
  EVIDENCE_BASES_ES
} from "../js/bincheck-i18n.js";
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

const isEs = (lang) => normalizeLang(lang) === "es";
const tierLabel = (tier, lang) => (isEs(lang) ? TIER_LABELS_ES[tier] || tier : TIER_LABELS[tier] || tier);
const confLabel = (confidence, lang) =>
  isEs(lang) ? CONFIDENCE_LABELS_ES[confidence] || confidence : CONFIDENCE_LABELS[confidence] || confidence;
const loadLabel = (status, lang) =>
  isEs(lang) ? LOAD_STATUS_LABELS_ES[status] || status : LOAD_STATUS_LABELS[status] || status;
const statusLabel = (status, lang) => (isEs(lang) ? STATUS_LABELS_ES[status] || status : STATUS_LABELS[status] || status);
const citeKindLabel = (kind, lang) => (isEs(lang) ? CITE_KIND_LABELS_ES[kind] || kind : CITE_KIND_LABELS[kind] || kind);

export function streamLabel(stream, lang = "en") {
  return isEs(lang) ? STREAM_LABELS_ES[stream] || String(stream) : STREAM_LABELS[stream] || String(stream);
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
export function renderVerdictBanner(ev, lang = "en") {
  const v = verdictFor(ev.stream, lang);
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
export function renderVerdictChip(stream, prefix = "", lang = "en") {
  const v = verdictFor(stream, lang);
  return `<span class="verdict-chip verdict-${escapeHtml(v.key)}">${renderVerdictIcon(v.key, 13)}<span>${prefix ? `<span class="verdict-chip-city">${escapeHtml(prefix)}</span> ` : ""}${escapeHtml(v.word)}</span></span>`;
}

/** Instant search results: one button per match, with both cities' verdicts. */
export function renderSearchResults(result, lang = "en") {
  if (!result.query) return "";
  if (result.results.length === 0) {
    return `<p class="search-empty">${escapeHtml(t(lang, "search.noMatch", { query: result.query }))}</p>`;
  }
  const partialNote = result.partial ? `<p class="search-more tabular">${escapeHtml(t(lang, "search.partialNote"))}</p>` : "";
  const more =
    result.total > result.results.length
      ? `<p class="search-more tabular">${escapeHtml(t(lang, "search.showing", { shown: result.results.length, total: result.total }))}</p>`
      : "";
  return `${partialNote}<ul class="search-list" role="list">${result.results
    .map(
      (r, i) => `
      <li>
        <button type="button" class="search-hit${r.citiesDiffer ? " cities-differ" : ""}" data-action="search-pick" data-kind="${escapeHtml(r.kind)}" data-value="${escapeHtml(r.value)}" data-search-index="${i}">
          <span class="search-hit-text">
            <span class="search-hit-title">${escapeHtml(r.title)}</span>
            <span class="search-hit-sub tabular">${escapeHtml(r.sub)}${r.citiesDiffer ? `, ${escapeHtml(t(lang, "search.citiesDiffer"))}` : ""}</span>
          </span>
          <span class="search-hit-verdicts">${renderVerdictChip(r.Riverside.stream, "SL", lang)}${renderVerdictChip(r.houston.stream, "HOU", lang)}</span>
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
export function renderImpact(impact, lang = "en") {
  if (impact.total === 0) {
    return `<p class="empty-batch-msg">${escapeHtml(t(lang, "impact.addItem"))}</p>`;
  }
  const v = impact.itemVerdict;
  const cells =
    Array.from({ length: impact.cleanCount }, () => `<span class="impact-cell verdict-recycle" title="${escapeHtml(t(lang, "impact.cellCleanTitle"))}"></span>`).join("") +
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
  const statusText = loadLabel(impact.loadStatus, lang);
  const status = escapeHtml(statusText);
  let finding;
  if (impact.itemCount === 0) {
    finding = escapeHtml(t(lang, "impact.finding.allClean", { avg: impact.averageRiskScore }));
  } else if (impact.averageHidesProblem) {
    finding = escapeHtml(
      t(lang, "impact.finding.hiddenWorst", {
        avg: impact.averageRiskScore,
        count: isEs(lang) || impact.itemCount !== 1 ? String(impact.itemCount) : "One",
        item: impact.itemTitle,
        risk: impact.itemRisk,
        status: statusText,
        word: v.word
      })
    );
  } else if (impact.itemStream === "RECYCLE_CART") {
    finding = escapeHtml(t(lang, "impact.finding.staysClean", { item: impact.itemTitle, risk: impact.itemRisk, status: statusText }));
  } else {
    finding = escapeHtml(
      t(lang, "impact.finding.spread", { avg: impact.averageRiskScore, max: impact.maxRiskScore, status: statusText, word: v.word })
    );
  }
  return `
    <div class="impact-result">
      <div class="impact-status verdict-${escapeHtml(statusTone)}">
        ${renderVerdictIcon(statusTone, 20)}
        <strong>${status}</strong>
        <span class="tabular">${escapeHtml(t(lang, "impact.itemsSummary", { total: impact.total, wrong: impact.wrongItems, share: formatPercent(impact.wrongShare) }))}</span>
      </div>
      <div class="impact-grid" role="img" aria-label="${escapeHtml(t(lang, "impact.gridAria", { clean: impact.cleanCount, count: impact.itemCount }))}">${cells}</div>
      <div class="impact-bars">
        ${bar(t(lang, "impact.avgRisk"), impact.averageRiskScore, impact.averageRiskScore >= LOAD_THRESHOLDS.reject ? "dropoff" : impact.averageRiskScore >= LOAD_THRESHOLDS.high ? "split" : "recycle")}
        ${bar(t(lang, "impact.worstItem"), impact.maxRiskScore, statusTone)}
        <p class="impact-scale tabular">${escapeHtml(t(lang, "impact.ticks", { m: LOAD_THRESHOLDS.moderate, h: LOAD_THRESHOLDS.high, r: LOAD_THRESHOLDS.reject }))}</p>
      </div>
      <p class="impact-finding">${finding}</p>
    </div>`;
}

export function renderStreamBadge(stream, label) {
  return `<span class="stream-badge stream-${escapeHtml(stream)}">${getStreamSvgIcon(stream)}<span>${escapeHtml(label)}</span></span>`;
}

export function renderBarcodeMathStrip(check, lang = "en") {
  if (!check) {
    return `<span class="math-chip">${escapeHtml(t(lang, "math.idle"))}</span>`;
  }
  if (!check.valid) {
    return [
      `<span class="math-chip math-chip-err">${escapeHtml(t(lang, "math.format"))} ${escapeHtml(check.format)}</span>`,
      `<span class="math-chip math-chip-err">${escapeHtml(t(lang, "math.expected"))} ${check.expectedCheckDigit ?? "n/a"}</span>`,
      `<span class="math-chip math-chip-err">${escapeHtml(t(lang, "math.found"))} ${check.actualCheckDigit ?? "n/a"}</span>`
    ].join("");
  }
  const payload = check.normalized.slice(0, -1);
  return [
    `<span class="math-chip">${escapeHtml(t(lang, "math.format"))} <strong>${escapeHtml(check.format)}</strong></span>`,
    `<span class="math-chip">${escapeHtml(t(lang, "math.payload"))} <strong>${escapeHtml(payload)}</strong></span>`,
    `<span class="math-chip">${escapeHtml(t(lang, "math.check"))} <strong>${check.actualCheckDigit}</strong></span>`,
    check.ean13 ? `<span class="math-chip">${escapeHtml(t(lang, "math.ean13"))} <strong>${escapeHtml(check.ean13)}</strong></span>` : ""
  ].join("");
}

/** Banded gauge: four tier zones plus a marker, with text alternatives. */
export function renderContaminationGauge(score, tier, mrfFailureMode, lang = "en") {
  const safeScore = Math.max(0, Math.min(100, Number(score) || 0));
  const tierName = tierLabel(tier, lang);
  return `
    <div class="risk-meter-box">
      <div class="risk-meter-top">
        <span>${escapeHtml(t(lang, "gauge.label"))}</span>
        <span class="tabular risk-score-readout tier-${escapeHtml(tier)}">${escapeHtml(t(lang, "gauge.score", { score: safeScore, tier: tierName }))}</span>
      </div>
      <div class="risk-bar-track" role="meter" aria-valuenow="${safeScore}" aria-valuemin="0" aria-valuemax="100" aria-valuetext="${escapeHtml(t(lang, "gauge.valuetext", { score: safeScore, tier: tierName }))}" aria-label="${escapeHtml(t(lang, "gauge.aria"))}">
        <span class="risk-zone zone-low" style="width: 25%"></span>
        <span class="risk-zone zone-moderate" style="width: 30%"></span>
        <span class="risk-zone zone-high" style="width: 30%"></span>
        <span class="risk-zone zone-critical" style="width: 15%"></span>
        <span class="risk-marker marker-${escapeHtml(tier)}" style="left: ${safeScore}%"></span>
      </div>
      <div class="gauge-scale-labels tabular" aria-hidden="true">
        <span>${escapeHtml(t(lang, "gauge.scaleLow"))}</span>
        <span>${escapeHtml(t(lang, "gauge.scaleMod"))}</span>
        <span>${escapeHtml(t(lang, "gauge.scaleHigh"))}</span>
        <span>${escapeHtml(t(lang, "gauge.scaleReject"))}</span>
      </div>
      <p class="mrf-note"><strong>${escapeHtml(t(lang, "gauge.physics"))}</strong> ${escapeHtml(mrfFailureMode)}</p>
    </div>
  `;
}

function renderIssueList(issues, lang = "en") {
  const visible = issues.filter((entry) => entry.severity !== "info" || entry.code === "BARCODE_NOT_IN_CATALOG");
  if (visible.length === 0) {
    return "";
  }
  const label = isEs(lang)
    ? { error: t(lang, "issue.sev.error"), warning: t(lang, "issue.sev.warning"), info: t(lang, "issue.sev.info") }
    : { error: "Error", warning: "Check", info: "Note" };
  const fallback = isEs(lang) ? label.info : "Note";
  return `<ul class="issue-list">${visible
    .map(
      (entry) =>
        `<li class="issue issue-${escapeHtml(entry.severity)}"><strong>${escapeHtml(label[entry.severity] || fallback)}:</strong> ${escapeHtml(isEs(lang) ? issueMessageEs(entry) : entry.message)}</li>`
    )
    .join("")}</ul>`;
}

/** Evidence ladder and confidence pill. Confidence is provenance, not a probability. */
export function renderEvidencePanel(assessment, lang = "en") {
  const steps = EVIDENCE_BASES.map((entry) => {
    const active = entry.id === assessment.basis;
    const label = isEs(lang) && EVIDENCE_BASES_ES[entry.id] ? EVIDENCE_BASES_ES[entry.id].label : entry.label;
    return `<li class="ladder-step${active ? " is-active" : ""}"${active ? ' aria-current="step"' : ""}><span class="ladder-rank tabular">${entry.rank}</span><span class="ladder-text">${escapeHtml(label)}${active ? `<span class="sr-only"> ${escapeHtml(t(lang, "evidence.currentBasis"))}</span>` : ""}</span></li>`;
  }).join("");
  return `
    <section class="evidence-panel" aria-label="${escapeHtml(t(lang, "evidence.panelAria"))}">
      <div class="evidence-head">
        <h4>${escapeHtml(t(lang, "evidence.howIdentified"))}</h4>
        <span class="confidence-pill confidence-${escapeHtml(assessment.confidence)}">${escapeHtml(confLabel(assessment.confidence, lang))}</span>
      </div>
      <ol class="evidence-ladder" aria-label="${escapeHtml(t(lang, "evidence.ladderAria"))}">${steps}</ol>
      <p class="evidence-note">${escapeHtml(assessment.confidenceReason)}</p>
      <p class="evidence-footnote">${escapeHtml(t(lang, "evidence.footnote"))}</p>
      ${renderIssueList(assessment.issues, lang)}
    </section>
  `;
}

function renderSourceLine(ev, lang = "en") {
  return `<div class="dropoff-row source-row"><strong>${escapeHtml(t(lang, "cites.officialSource"))}</strong> <a class="inline-link" href="${escapeHtml(ev.officialSourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(ev.cityName)}<span class="sr-only"> ${escapeHtml(t(lang, "cites.newTab"))}</span></a>. ${escapeHtml(t(lang, "cites.verified", { date: RULES_SNAPSHOT_META.lastVerifiedDate }))}</div>`;
}

const CITE_KIND_LABELS = {
  verbatim: "City rule text",
  interpretation: "Applied rule",
  inference: "Engine estimate"
};

/** Municipal rule trace: the exact snapshot fields behind the verdict, quoted. */
export function renderRuleCitations(citations, lang = "en") {
  if (!Array.isArray(citations) || citations.length === 0) {
    return "";
  }
  const items = citations
    .map(
      (entry) => `
      <li class="rule-cite">
        <div class="rule-cite-head">
          <code class="rule-id">${escapeHtml(entry.ruleId)}</code>
          <span class="cite-kind cite-kind-${escapeHtml(entry.kind)}">${escapeHtml(citeKindLabel(entry.kind, lang))}</span>
        </div>
        <p class="rule-quote">${escapeHtml(entry.quote)}</p>
      </li>`
    )
    .join("");
  const source = citations[0] && citations[0].source ? citations[0].source : "data/municipal-rules-2026.json";
  return `<div class="rule-trace">
    <h4>${escapeHtml(t(lang, "cites.heading"))}</h4>
    <ul class="rule-cite-list">${items}</ul>
    <p class="rule-source tabular">${escapeHtml(t(lang, "cites.fieldsNote", { source, date: RULES_SNAPSHOT_META.lastVerifiedDate }))}</p>
  </div>`;
}

export function renderSingleEvaluation(ev, assessment, lang = "en") {
  const stepsHtml = ev.prepSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join("");
  const resinBadge = ev.resinInfo
    ? `<p class="eval-jurisdiction tabular"><strong>${escapeHtml(t(lang, "eval.polymerStamp"))}</strong> ${escapeHtml(ev.resinInfo.symbol)} (${escapeHtml(ev.resinInfo.polymer)})</p>`
    : "";
  return `
    <div class="eval-header">
      <div>
        <h3 class="eval-title">${escapeHtml(ev.itemTitle)}</h3>
        <p class="eval-jurisdiction">${escapeHtml(ev.cityName)}, ${escapeHtml(ev.operator)}</p>
        ${resinBadge}
      </div>
    </div>
    ${renderVerdictBanner(ev, lang)}
    ${renderContaminationGauge(ev.contaminationRiskScore, ev.contaminationTier, ev.mrfFailureMode, lang)}
    ${renderRuleCitations(ev.ruleCitations, lang)}
    ${renderEvidencePanel(assessment, lang)}
    <div class="eval-section">
      <h4>${escapeHtml(t(lang, "eval.prepHeading"))}</h4>
      <ol class="prep-list">${stepsHtml}</ol>
    </div>
    <div class="dropoff-card">
      <div class="dropoff-row"><strong>${escapeHtml(t(lang, "eval.dropoffGuidance"))}</strong> ${escapeHtml(ev.dropOffNote)}</div>
      <div class="dropoff-row tabular"><strong>${escapeHtml(t(lang, "eval.facility"))}</strong> ${escapeHtml(ev.dropOffFacility.name)} (${escapeHtml(ev.dropOffFacility.address)})</div>
      <div class="dropoff-row"><strong>${escapeHtml(t(lang, "eval.filmReturn"))}</strong> ${escapeHtml(ev.dropOffFacility.retailBagDropOff)}</div>
      <div class="dropoff-row divergence-callout"><strong>${escapeHtml(t(lang, "eval.vs"))}</strong> ${escapeHtml(ev.cityDivergenceNote)}</div>
      ${renderSourceLine(ev, lang)}
    </div>
  `;
}

function renderCompareColumn(ev, tag, lang = "en") {
  return `
    <div class="compare-col">
      <div class="compare-col-head">
        <h4>${escapeHtml(ev.cityName)}</h4>
        <span class="mono-tag tabular">${escapeHtml(tag)}</span>
      </div>
      ${renderVerdictBanner(ev, lang)}
      <p class="compare-risk-line tabular"><strong>${escapeHtml(t(lang, "eval.risk"))}</strong> ${ev.contaminationRiskScore}/100 (${escapeHtml(tierLabel(ev.contaminationTier, lang))})</p>
      ${renderRuleCitations(ev.ruleCitations, lang)}
      <ol class="prep-list">${ev.prepSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
      <p class="compare-facility-line tabular"><strong>${escapeHtml(t(lang, "eval.facilityShort"))}</strong> ${escapeHtml(ev.dropOffFacility.name)}, ${escapeHtml(ev.dropOffFacility.address)}</p>
    </div>
  `;
}

/** Dramatizes a true municipal divergence: the same item, two different verdicts. */
function renderVerdictFlip(sl, ho, lang = "en") {
  return `
    <div class="verdict-flip" role="note" aria-label="${escapeHtml(t(lang, "eval.flipAria"))}">
      <p class="verdict-flip-title">${escapeHtml(t(lang, "eval.diff"))}</p>
      <div class="verdict-flip-cols">
        <div class="flip-city">
          <span class="flip-city-name">Riverside</span>
          ${renderVerdictChip(sl.stream, "", lang)}
          <span class="flip-verdict-label">${escapeHtml(sl.badgeLabel)}</span>
        </div>
        <span class="flip-arrow" aria-hidden="true">&#8594;</span>
        <div class="flip-city">
          <span class="flip-city-name">Houston</span>
          ${renderVerdictChip(ho.stream, "", lang)}
          <span class="flip-verdict-label">${escapeHtml(ho.badgeLabel)}</span>
        </div>
      </div>
    </div>`;
}

export function renderComparisonView(comp, assessment, lang = "en") {
  const sl = comp.Riverside;
  const ho = comp.houston;
  const aligned = comp.sameStream;
  const badgeStream = aligned ? sl.stream : "SPLIT_DISPOSAL";
  const badgeText = aligned ? t(lang, "eval.same") : t(lang, "eval.rulesDiffer", { n: comp.riskDelta });
  return `
    <div class="eval-header">
      <div>
        <h3 class="eval-title">${escapeHtml(comp.itemTitle)}</h3>
        <p class="eval-jurisdiction">${escapeHtml(t(lang, "eval.sideBySide"))}</p>
      </div>
      ${renderStreamBadge(badgeStream, badgeText)}
    </div>
    ${aligned ? "" : renderVerdictFlip(sl, ho, lang)}
    <div class="risk-meter-box">
      <p class="mrf-note" style="margin: 0"><strong>${escapeHtml(t(lang, "eval.keyOrdinance"))}</strong> ${escapeHtml(comp.divergenceSummary)}</p>
      <p class="mrf-note"><strong>${escapeHtml(t(lang, "gauge.physics"))}</strong> ${escapeHtml(sl.mrfFailureMode)}</p>
    </div>
    ${renderEvidencePanel(assessment, lang)}
    <div class="compare-columns">
      ${renderCompareColumn(sl, "county", lang)}
      ${renderCompareColumn(ho, "SWMD", lang)}
    </div>
    <p class="source-row">${escapeHtml(t(lang, "eval.sourcesLine", { date: RULES_SNAPSHOT_META.lastVerifiedDate }))} <a class="inline-link" href="${escapeHtml(sl.officialSourceUrl)}" target="_blank" rel="noopener noreferrer">Riverside<span class="sr-only"> ${escapeHtml(t(lang, "cites.newTab"))}</span></a> ${escapeHtml(t(lang, "eval.sourcesAnd"))} <a class="inline-link" href="${escapeHtml(ho.officialSourceUrl)}" target="_blank" rel="noopener noreferrer">Houston<span class="sr-only"> ${escapeHtml(t(lang, "cites.newTab"))}</span></a>.</p>
  `;
}

export function renderCart(summary, lang = "en") {
  if (summary.itemCount === 0) {
    return {
      badgeClass: "stream-badge stream-SPLIT_DISPOSAL tabular",
      badgeText: t(lang, "cart.emptyBadge"),
      html: `<p class="empty-batch-msg">${escapeHtml(t(lang, "cart.emptyMsg"))}</p>`
    };
  }
  let badgeClass;
  let badgeText;
  if (summary.loadStatus === "CLEAN_CURBSIDE_LOAD") {
    badgeClass = "stream-badge stream-RECYCLE_CART tabular";
    badgeText = t(lang, "cart.cleanBadge", { n: summary.averageRiskScore });
  } else if (summary.loadStatus === "NEEDS_SORTING_FIXES") {
    badgeClass = "stream-badge stream-SPLIT_DISPOSAL tabular";
    badgeText = t(lang, "cart.prepBadge", { n: summary.maxRiskScore });
  } else {
    const count = summary.criticalHazards.length;
    badgeClass = "stream-badge stream-SPECIAL_DROPOFF tabular";
    badgeText = t(lang, "cart.hazardBadge", { n: count });
  }
  const html = renderCartRiskProfile(summary, lang) + `<div class="batch-chip-grid">` + summary.evaluations
    .map(
      (ev, index) => `
      <div class="batch-chip">
        <div class="batch-chip-top">
          <strong>${escapeHtml(ev.itemTitle)}</strong>
          <button type="button" class="text-btn" data-action="remove-cart" data-index="${index}" aria-label="${escapeHtml(t(lang, "cart.removeItem", { name: ev.itemTitle }))}">${escapeHtml(t(lang, "cart.remove"))}</button>
        </div>
        <span class="batch-chip-meta">${escapeHtml(t(lang, "cart.stream"))} <strong>${escapeHtml(ev.badgeLabel)}</strong></span>
        <span class="batch-chip-meta tabular">${escapeHtml(t(lang, "cart.score"))} <strong>${ev.contaminationRiskScore}/100</strong> (${escapeHtml(tierLabel(ev.contaminationTier, lang))})</span>
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
export function renderCartRiskProfile(summary, lang = "en") {
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
      return `<g><title>${escapeHtml(ev.itemTitle)}: ${ev.contaminationRiskScore}/100, ${escapeHtml(tierLabel(ev.contaminationTier, lang))}</title><rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(1.5, h).toFixed(1)}" rx="2" fill="${TIER_FILL[ev.contaminationTier]}"/><text x="${(x + barW / 2).toFixed(1)}" y="${height - 7}" class="cart-axis" text-anchor="middle">${index + 1}</text></g>`;
    })
    .join("");
  const avgY = y(summary.averageRiskScore);
  const label = t(lang, "cart.profileAria", { n: items.length, avg: summary.averageRiskScore, max: summary.maxRiskScore });
  return `<figure class="cart-profile"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(label)}" preserveAspectRatio="none">
    <rect x="${padLeft}" y="${padTop}" width="${plotW}" height="${plotH}" class="cart-plot"/>
    ${thresholds}${bars}
    <line x1="${padLeft}" x2="${width - padRight}" y1="${avgY.toFixed(1)}" y2="${avgY.toFixed(1)}" class="cart-average"/>
  </svg><figcaption class="cart-profile-key tabular"><span class="key-swatch is-avg" aria-hidden="true"></span>${escapeHtml(t(lang, "cart.avg", { n: summary.averageRiskScore }))}<span class="key-swatch is-reject" aria-hidden="true"></span>${escapeHtml(t(lang, "cart.rejectLine"))}</figcaption></figure>`;
}

function renderStreamBar(streamCounts, total, label, lang = "en") {
  const entries = Object.entries(streamCounts);
  if (total === 0 || entries.length === 0) {
    return `<p class="empty-batch-msg">${escapeHtml(t(lang, "batch.noRows"))}</p>`;
  }
  const segments = entries
    .map(([stream, count]) => `<span class="stream-seg stream-${escapeHtml(stream)}" style="width: ${((count / total) * 100).toFixed(2)}%" title="${escapeHtml(streamLabel(stream, lang))}: ${count}"></span>`)
    .join("");
  const legend = entries
    .map(([stream, count]) => `<li><span class="legend-dot stream-${escapeHtml(stream)}" aria-hidden="true"></span>${escapeHtml(streamLabel(stream, lang))}: <strong class="tabular">${count}</strong></li>`)
    .join("");
  return `<div class="stream-bar" role="img" aria-label="${escapeHtml(label)}">${segments}</div><ul class="stream-legend">${legend}</ul>`;
}

const STATUS_LABELS = { OK: "OK", WARN: "Check", ERROR: "Error" };

export function renderBatchReport(result, lang = "en") {
  const totals = result.totals;
  const parseErrors = result.parse.errors || [];
  const kpis = [
    [t(lang, "batch.rowsRead"), totals.rows],
    [t(lang, "batch.evaluated"), totals.evaluated],
    [t(lang, "batch.warnings"), totals.warnings],
    [t(lang, "batch.errors"), totals.errors],
    [t(lang, "batch.divergent"), totals.divergent]
  ]
    .map(([label, value]) => `<div class="kpi-cell"><dt>${escapeHtml(label)}</dt><dd class="tabular">${value}</dd></div>`)
    .join("");

  const cityCards = Object.values(result.cities)
    .map((city) => {
      const status = city.itemCount === 0 ? "EMPTY_BATCH" : city.loadStatus;
      const statusClass =
        status === "CLEAN_CURBSIDE_LOAD" ? "RECYCLE_CART" : status === "NEEDS_SORTING_FIXES" ? "SPLIT_DISPOSAL" : "SPECIAL_DROPOFF";
      const eligibleHtml = t(lang, "batch.eligibleLine", {
        n: `<strong class="tabular">${city.cartEligible} ${isEs(lang) ? "de" : "of"} ${city.itemCount}</strong>`,
        pct: `<strong class="tabular">${city.cartEligiblePct}%</strong>`
      });
      const stayOut =
        city.notCartEligible > 0 ? `; ${t(lang, "batch.stayOut", { n: `<strong class="tabular">${city.notCartEligible}</strong>` })}` : "";
      return `
        <div class="city-summary-card">
          <div class="city-summary-head"><h4>${escapeHtml(city.cityName)}</h4><span class="stream-badge stream-${statusClass}">${escapeHtml(loadLabel(status, lang))}</span></div>
          <p class="tabular city-summary-meta">${escapeHtml(t(lang, "batch.avgMax", { avg: city.averageRiskScore, max: city.maxRiskScore }))}</p>
          <p class="diversion-line">${eligibleHtml}${stayOut}</p>
          ${renderStreamBar(city.streamCounts, city.itemCount, t(lang, "batch.streamMixAria", { name: city.cityName }), lang)}
        </div>`;
    })
    .join("");

  const errorLines = [
    ...parseErrors.map(
      (entry) =>
        `<li><span class="tabular">${escapeHtml(entry.line ? t(lang, "batch.lineLoc", { n: entry.line }) : Number.isInteger(entry.offset) ? t(lang, "batch.byteLoc", { n: entry.offset }) : t(lang, "batch.inputLoc"))}:</span> ${escapeHtml(isEs(lang) ? parseErrorMessageEs(entry) : entry.message)}</li>`
    ),
    ...result.rows
      .filter((row) => row.status === "ERROR")
      .map(
        (row) =>
          `<li><span class="tabular">${escapeHtml(t(lang, "batch.lineLoc", { n: row.line }))}:</span> ${escapeHtml(row.issues.map((entry) => (isEs(lang) ? issueMessageEs(entry) : entry.message)).join(" "))}</li>`
      )
  ];
  const errorBlock = errorLines.length
    ? `<div class="batch-errors" role="alert"><h4>${escapeHtml(t(lang, "batch.attention"))}</h4><ul>${errorLines.join("")}</ul></div>`
    : "";

  const tableRows = result.rows
    .map((row) => {
      const sl = row.cities ? row.cities["Riverside-tx"] : null;
      const ho = row.cities ? row.cities["houston-tx"] : null;
      const cell = (city) =>
        city
          ? `${renderStreamBadge(city.stream, city.badgeLabel)}<span class="cell-sub tabular">${escapeHtml(t(lang, "batch.risk", { n: city.riskScore }))}</span>`
          : `<span class="cell-sub">${escapeHtml(t(lang, "batch.notEvaluated"))}</span>`;
      return `<tr class="row-${escapeHtml(row.status)}">
        <td data-label="${escapeHtml(t(lang, "batch.line"))}" class="tabular">${row.line}</td>
        <td data-label="${escapeHtml(t(lang, "batch.item"))}"><strong>${escapeHtml(row.label || row.itemTitle || t(lang, "batch.unlabeled"))}</strong>${row.itemTitle && row.label ? `<span class="cell-sub">${escapeHtml(row.itemTitle)}</span>` : ""}</td>
        <td data-label="${escapeHtml(t(lang, "batch.evidence"))}"><span class="confidence-pill confidence-${escapeHtml(row.confidence)}">${escapeHtml(confLabel(row.confidence, lang))}</span></td>
        <td data-label="Riverside">${cell(sl)}</td>
        <td data-label="Houston">${cell(ho)}</td>
        <td data-label="${escapeHtml(t(lang, "batch.status"))}"><span class="status-pill status-${escapeHtml(row.status)}">${escapeHtml(statusLabel(row.status, lang))}</span>${row.streamsDiverge ? `<span class="cell-sub">${escapeHtml(t(lang, "batch.citiesDiffer"))}</span>` : ""}</td>
      </tr>`;
    })
    .join("");

  return `
    <dl class="kpi-strip" aria-label="${escapeHtml(t(lang, "batch.kpiAria"))}">${kpis}</dl>
    <div class="city-summary-grid">${cityCards}</div>
    ${errorBlock}
    ${
      result.rows.length
        ? `<div class="table-wrap"><table class="stack-table batch-table"><caption class="sr-only">${escapeHtml(t(lang, "batch.caption"))}</caption><thead><tr><th scope="col">${escapeHtml(t(lang, "batch.line"))}</th><th scope="col">${escapeHtml(t(lang, "batch.item"))}</th><th scope="col">${escapeHtml(t(lang, "batch.evidence"))}</th><th scope="col">Riverside</th><th scope="col">Houston</th><th scope="col">${escapeHtml(t(lang, "batch.status"))}</th></tr></thead><tbody>${tableRows}</tbody></table></div>`
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

export function renderBenchmark(result, lang = "en") {
  const { cart, stream, tiers, barcode, latency, meta } = result;
  const maxStream = Math.max(0, ...stream.labels.flatMap((truth) => stream.labels.map((pred) => stream.matrix[truth][pred])));
  const usedLabels = stream.labels.filter(
    (label) => stream.labels.some((other) => stream.matrix[label][other] > 0 || stream.matrix[other][label] > 0)
  );

  const streamHeader = usedLabels.map((label) => `<th scope="col">${escapeHtml(streamLabel(label, lang))}</th>`).join("");
  const streamRows = usedLabels
    .map(
      (truth) =>
        `<tr><th scope="row">${escapeHtml(streamLabel(truth, lang))}</th>${usedLabels
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
        <th scope="row"><span class="tier-chip tier-${row.tier}">${escapeHtml(tierLabel(row.tier, lang))}</span></th>
        <td data-label="${escapeHtml(t(lang, "bench.tierCol.evals"))}" class="tabular">${row.total}</td>
        <td data-label="${escapeHtml(t(lang, "bench.tierCol.cart"))}" class="tabular">${row.cartTrue}</td>
        <td data-label="${escapeHtml(t(lang, "bench.tierCol.notCart"))}" class="tabular">${row.cartFalse}</td>
        <td data-label="${escapeHtml(t(lang, "bench.tierCol.split"))}"><div class="tier-bar" role="img" aria-label="${escapeHtml(t(lang, "bench.tierAria", { tier: tierLabel(row.tier, lang), ok: row.cartTrue, no: row.cartFalse }))}"><span class="tier-bar-ok" style="width: ${((row.cartTrue / maxTier) * 100).toFixed(2)}%"></span><span class="tier-bar-no" style="width: ${((row.cartFalse / maxTier) * 100).toFixed(2)}%"></span></div></td>
      </tr>`
    )
    .join("");

  const openGaps = result.knownGaps.filter((gap) => gap.stillOpen);
  const gapBlock = result.knownGaps.length
    ? `<div class="gap-card${openGaps.length ? " has-open" : ""}"><h4>${escapeHtml(t(lang, "bench.gapHeading", { closed: result.knownGaps.length - openGaps.length, open: openGaps.length }))}</h4><ul>${result.knownGaps
        .map(
          (gap) =>
            `<li><span class="gap-state ${gap.stillOpen ? "is-open" : "is-ok"}">${gap.stillOpen ? escapeHtml(t(lang, "bench.gap.open")) : escapeHtml(t(lang, "bench.gap.handled"))}</span> ${escapeHtml(t(lang, "bench.gapRow", { label: gap.label, city: gap.city === "houston-tx" ? "Houston" : "Riverside", expected: streamLabel(gap.expectedStream, lang), actual: streamLabel(gap.actualStream, lang) }).replace(gap.label, `<strong>${escapeHtml(gap.label)}</strong>`))}</li>`
        )
        .join("")}</ul><p class="kpi-hint">${escapeHtml(t(lang, "bench.gapHint"))}</p></div>`
    : "";

  const failureBlock = result.failures.length
    ? `<div class="batch-errors" role="alert"><h4>${escapeHtml(t(lang, "bench.failHeading", { n: result.failures.length }))}</h4><ul>${result.failures
        .map((failure) => `<li><span class="tabular">${escapeHtml(failure.caseId)}</span> ${escapeHtml(t(lang, "bench.failRow", { id: "", city: failure.city, field: failure.field, expected: failure.expected, actual: failure.actual }).trim())}</li>`)
        .join("")}</ul></div>`
    : `<p class="benchmark-pass">${escapeHtml(t(lang, "bench.pass"))}</p>`;

  const bc = barcode.confusion;
  const tr = barcode.transpositions;

  return `
    <p class="benchmark-scope"><span class="data-badge is-computed">${escapeHtml(t(lang, "bench.scopeBadge"))}</span> ${escapeHtml(t(lang, "bench.scopeText", { base: meta.baseCases, catalog: meta.catalogCases, n: meta.scoredEvaluations, unanchored: meta.unanchoredCatalogItems.length, date: meta.rulesSnapshot.lastVerifiedDate }))}</p>
    ${failureBlock}
    <dl class="kpi-strip" aria-label="${escapeHtml(t(lang, "bench.cartAria"))}">
      ${kpi(t(lang, "bench.kpiAccuracy"), formatPercent(cart.accuracy), t(lang, "bench.kpiAccuracyHint", { ok: cart.tp + cart.tn, total: cart.total }))}
      ${kpi(t(lang, "bench.kpiPrecision"), formatPercent(cart.precision), t(lang, "bench.kpiPrecisionHint"))}
      ${kpi(t(lang, "bench.kpiRecall"), formatPercent(cart.recall), t(lang, "bench.kpiRecallHint"))}
      ${kpi(t(lang, "bench.kpiFp"), String(cart.fp), t(lang, "bench.kpiFpHint"))}
      ${kpi(t(lang, "bench.kpiStream"), formatPercent(stream.accuracy), t(lang, "bench.kpiStreamHint", { ok: stream.correct, total: stream.scored }))}
    </dl>
    <div class="benchmark-grid">
      <div class="benchmark-card">
        <h4>${escapeHtml(t(lang, "bench.matrixHeading"))}</h4>
        <div class="table-wrap"><table class="matrix-table"><caption class="sr-only">${escapeHtml(t(lang, "bench.matrixCaption2"))}</caption>
          <thead><tr><th scope="col"><span class="sr-only">${escapeHtml(t(lang, "bench.truth"))}</span></th><th scope="col">${escapeHtml(t(lang, "bench.engineCart"))}</th><th scope="col">${escapeHtml(t(lang, "bench.engineOther"))}</th></tr></thead>
          <tbody>
            <tr><th scope="row">${escapeHtml(t(lang, "bench.truthCart"))}</th><td class="matrix-cell tabular is-diagonal" style="${heatStyle(cart.tp, Math.max(cart.tp, cart.tn, cart.fp, cart.fn))}">${cart.tp}</td><td class="matrix-cell tabular${cart.fn ? " is-miss" : ""}" style="${heatStyle(cart.fn, Math.max(cart.tp, cart.tn, cart.fp, cart.fn))}">${cart.fn}</td></tr>
            <tr><th scope="row">${escapeHtml(t(lang, "bench.truthOther"))}</th><td class="matrix-cell tabular${cart.fp ? " is-miss" : ""}" style="${heatStyle(cart.fp, Math.max(cart.tp, cart.tn, cart.fp, cart.fn))}">${cart.fp}</td><td class="matrix-cell tabular is-diagonal" style="${heatStyle(cart.tn, Math.max(cart.tp, cart.tn, cart.fp, cart.fn))}">${cart.tn}</td></tr>
          </tbody></table></div>
      </div>
      <div class="benchmark-card">
        <h4>${escapeHtml(t(lang, "bench.streamHeading"))}</h4>
        <div class="table-wrap"><table class="matrix-table"><caption class="sr-only">${escapeHtml(t(lang, "bench.streamCaption2"))}</caption>
          <thead><tr><th scope="col"><span class="sr-only">${escapeHtml(t(lang, "bench.truth"))}</span></th>${streamHeader}</tr></thead>
          <tbody>${streamRows}</tbody></table></div>
      </div>
    </div>
    <div class="benchmark-card">
      <h4>${escapeHtml(t(lang, "bench.tierHeading"))}</h4>
      <div class="table-wrap"><table class="stack-table tier-table"><caption class="sr-only">${escapeHtml(t(lang, "bench.tierCaption"))}</caption>
        <thead><tr><th scope="col">${escapeHtml(t(lang, "bench.tierCol.tier"))}</th><th scope="col">${escapeHtml(t(lang, "bench.tierCol.evals"))}</th><th scope="col">${escapeHtml(t(lang, "bench.tierCol.cart"))}</th><th scope="col">${escapeHtml(t(lang, "bench.tierCol.notCart"))}</th><th scope="col">${escapeHtml(t(lang, "bench.tierCol.split"))}</th></tr></thead>
        <tbody>${tierRows}</tbody></table></div>
      <p class="kpi-hint">${escapeHtml(t(lang, "bench.tierHint"))}</p>
    </div>
    <div class="benchmark-grid">
      <div class="benchmark-card">
        <h4>${escapeHtml(t(lang, "bench.barcodeHeading"))}</h4>
        <dl class="kpi-strip kpi-strip-compact">
          ${kpi(t(lang, "bench.checkAcc"), formatPercent(barcode.accuracy), `TP ${bc.tp}, FP ${bc.fp}, FN ${bc.fn}, TN ${bc.tn}`)}
          ${kpi(t(lang, "bench.transp"), t(lang, "bench.transpValue", { n: tr.detected, total: tr.tried }), formatPercent(tr.detectionRate))}
          ${kpi(t(lang, "bench.subs"), t(lang, "bench.transpValue", { n: barcode.substitutions.detected, total: barcode.substitutions.tried }), formatPercent(barcode.substitutions.detectionRate))}
        </dl>
        <p class="kpi-hint">${escapeHtml(tr.undetected === tr.undetectedExplainedByDigitGapOfFive ? t(lang, "bench.gapNote2.ok", { n: tr.undetected }) : t(lang, "bench.gapNote2.bad"))}</p>
      </div>
      <div class="benchmark-card">
        <h4>${escapeHtml(t(lang, "bench.latencyHeading"))}</h4>
        <dl class="kpi-strip kpi-strip-compact">
          ${kpi(t(lang, "bench.median"), formatMs(latency.p50, BROWSER_TIMER_FLOOR_MS), t(lang, "bench.evals", { n: latency.samples }))}
          ${kpi(t(lang, "bench.p95"), formatMs(latency.p95, BROWSER_TIMER_FLOOR_MS), "")}
          ${kpi(t(lang, "bench.slowest"), formatMs(latency.max, BROWSER_TIMER_FLOOR_MS), "")}
        </dl>
        <p class="kpi-hint"><span class="data-badge is-computed">${escapeHtml(t(lang, "bench.measured"))}</span>${escapeHtml(t(lang, "bench.latencyHint"))}</p>
      </div>
    </div>
    ${gapBlock}
  `;
}

export function renderPrintReport(vm, batchResult, lang = "en") {
  const { comparison, assessment } = vm;
  const sl = comparison.Riverside;
  const ho = comparison.houston;
  const cityBlock = (ev) => `
    <section class="print-city">
      <h3>${escapeHtml(ev.cityName)}</h3>
      <p><strong>${escapeHtml(t(lang, "print.stream"))}</strong> ${escapeHtml(ev.badgeLabel)}. <strong>${escapeHtml(t(lang, "print.risk"))}</strong> ${ev.contaminationRiskScore}/100 (${escapeHtml(tierLabel(ev.contaminationTier, lang))}).</p>
      <ol>${ev.prepSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
      <p><strong>${escapeHtml(t(lang, "print.facility"))}</strong> ${escapeHtml(ev.dropOffFacility.name)}, ${escapeHtml(ev.dropOffFacility.address)}</p>
      <p><strong>${escapeHtml(t(lang, "print.source"))}</strong> ${escapeHtml(ev.officialSourceUrl)}</p>
    </section>`;
  const batchBlock = batchResult
    ? `<section class="print-batch"><h3>${escapeHtml(t(lang, "print.batchHeading"))}</h3>
        <p>${escapeHtml(t(lang, "print.batchSummary", { rows: batchResult.totals.rows, evaluated: batchResult.totals.evaluated, errors: batchResult.totals.errors, divergent: batchResult.totals.divergent }))}</p>
        <table><thead><tr><th>${escapeHtml(t(lang, "batch.line"))}</th><th>${escapeHtml(t(lang, "batch.item"))}</th><th>Riverside</th><th>Houston</th></tr></thead><tbody>${batchResult.rows
          .map(
            (row) =>
              `<tr><td>${row.line}</td><td>${escapeHtml(row.label || row.itemTitle || t(lang, "batch.unlabeled"))}</td><td>${row.cities ? escapeHtml(row.cities["Riverside-tx"].badgeLabel) : escapeHtml(t(lang, "print.notEval"))}</td><td>${row.cities ? escapeHtml(row.cities["houston-tx"].badgeLabel) : escapeHtml(t(lang, "print.notEval"))}</td></tr>`
          )
          .join("")}</tbody></table></section>`
    : "";
  return `
    <h2>${escapeHtml(t(lang, "print.reportTitle"))}</h2>
    <p class="print-meta">${escapeHtml(t(lang, "print.metaItem", { item: comparison.itemTitle, basis: assessment.basisLabel, confidence: confLabel(assessment.confidence, lang).toLowerCase(), date: RULES_SNAPSHOT_META.lastVerifiedDate })).replace(escapeHtml(comparison.itemTitle), `<strong>${escapeHtml(comparison.itemTitle)}</strong>`)}</p>
    <p class="print-meta">${escapeHtml(comparison.divergenceSummary)}</p>
    <div class="print-cities">${cityBlock(sl)}${cityBlock(ho)}</div>
    ${batchBlock}
    <p class="print-foot">${escapeHtml(t(lang, "print.generated"))}</p>
  `;
}

export function renderShortcutList(singleKeyOn = true, lang = "en") {
  return SHORTCUTS.map((entry) => {
    const off = !singleKeyOn && entry.key.length === 1;
    const description = isEs(lang) ? t("es", `shortcut.${entry.id}`) : entry.description;
    return `<li${off ? ' class="shortcut-off"' : ""}><kbd>${escapeHtml(entry.key === "Escape" ? "Esc" : entry.key)}</kbd><span>${escapeHtml(description)}${off ? ` <span class="shortcut-state">${escapeHtml(t(lang, "dialog.off"))}</span>` : ""}</span></li>`;
  }).join("");
}
