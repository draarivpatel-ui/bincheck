/**
 * BinCheck workbench renderers: municipal ruleset diff, hazard cascade lab,
 * signed audit panel and in-page self-test results. Pure string builders,
 * every dynamic value escaped through escapeHtml, so they are unit testable
 * in plain Node.
 */

import { escapeHtml, renderVerdictIcon } from "./render.js";
import { WORKBENCH_STREAM_LABELS, MRF_PROFILES, CONFLICT_KIND_LABELS_EXPORTED } from "../js/bincheck-municipal.js";
import { CASCADE_SCENARIO_IDS } from "../js/bincheck-cascade.js";
import { verdictFor } from "./insights.js";
import { t, workbenchStreamLabelEs, conflictKindEs, auditDetailEs, normalizeLang } from "../js/bincheck-i18n.js";

function streamTone(stream) {
  return verdictFor(stream).key;
}

function streamLabel(stream, lang) {
  return normalizeLang(lang) === "es" ? workbenchStreamLabelEs(stream) : WORKBENCH_STREAM_LABELS[stream] || stream;
}

function renderStreamTag(stream, lang = "en") {
  const key = streamTone(stream);
  return `<span class="stream-tag verdict-${escapeHtml(key)}">${renderVerdictIcon(key, 12)}<span>${escapeHtml(streamLabel(stream, lang))}</span></span>`;
}

function metricRow(label, valueA, valueB, { suffix = "", invert = false } = {}) {
  const delta = Number(valueA) - Number(valueB);
  const better = delta === 0 ? "neutral" : invert ? delta < 0 : delta > 0;
  const cls = better === "neutral" ? "delta-neutral" : better ? "delta-better" : "delta-worse";
  const sign = delta > 0 ? "+" : "";
  return `<tr>
    <th scope="row">${escapeHtml(label)}</th>
    <td class="tabular">${escapeHtml(String(valueA))}${escapeHtml(suffix)}</td>
    <td class="tabular">${escapeHtml(String(valueB))}${escapeHtml(suffix)}</td>
    <td class="tabular ${cls}">${sign}${escapeHtml(String(Math.round(delta * 10) / 10))}${escapeHtml(suffix)}</td>
  </tr>`;
}

/**
 * The municipal diff card: two profile metric columns, the per-item routing
 * table, and the rule-conflict alert list. `diff` is compareProfiles output.
 */
export function renderMunicipalDiff(diff, lang = "en") {
  const { a, b } = diff;
  const kindTag = (profile) =>
    `<span class="data-badge ${profile.profileKind === "snapshot" ? "is-sourced" : "is-demo"}">${escapeHtml(t(lang, profile.profileKind === "snapshot" ? "diff.kindTag.snapshot" : "diff.kindTag.archetype"))}</span>`;

  const alertItems = diff.conflicts
    .map((entry) => {
      const icon = entry.severity === "critical" ? "dropoff" : entry.severity === "warning" ? "split" : "unknown";
      const kindLabel = normalizeLang(lang) === "es" ? conflictKindEs(entry.kind) : CONFLICT_KIND_LABELS_EXPORTED[entry.kind] || entry.kind;
      return `<li class="conflict-item conflict-${escapeHtml(entry.severity)}">
        <span class="conflict-icon">${renderVerdictIcon(icon, 14)}</span>
        <span><strong class="conflict-kind tabular">${escapeHtml(kindLabel)}</strong> ${escapeHtml(entry.message)}</span>
      </li>`;
    })
    .join("");

  const rows = diff.rows
    .map(
      (row) => `<tr${row.changed ? ' class="diff-row-changed"' : ""}>
        <th scope="row">${escapeHtml(row.label)} <span class="tabular diff-weight">${escapeHtml(String(row.weightLbs))} lb</span></th>
        <td data-label="${escapeHtml(a.shortName)}">${renderStreamTag(row.a.stream, lang)}${row.changed ? `<p class="diff-note">${escapeHtml(row.a.note || "")}</p>` : ""}</td>
        <td data-label="${escapeHtml(b.shortName)}">${renderStreamTag(row.b.stream, lang)}${row.changed ? `<p class="diff-note">${escapeHtml(row.b.note || "")}</p>` : ""}</td>
      </tr>`
    )
    .join("");

  const summaryA = a.profileSummary || MRF_PROFILES[a.profileId].summary;
  const summaryB = b.profileSummary || MRF_PROFILES[b.profileId].summary;

  return `
  <div class="diff-panel">
    <div class="diff-heads">
      <div class="diff-head-card">
        <div class="diff-head-row"><h4>${escapeHtml(a.profileName)}</h4>${kindTag(a)}</div>
        <p class="diff-summary">${escapeHtml(summaryA)}</p>
      </div>
      <div class="diff-head-card">
        <div class="diff-head-row"><h4>${escapeHtml(b.profileName)}</h4>${kindTag(b)}</div>
        <p class="diff-summary">${escapeHtml(summaryB)}</p>
      </div>
    </div>

    <div class="table-wrap">
      <table class="comparison-table stack-table diff-metrics-table">
        <caption class="sr-only">${escapeHtml(t(lang, "diff.metricsCaption", { a: a.profileName, b: b.profileName, basket: diff.basketName }))}</caption>
        <thead><tr><th scope="col">${escapeHtml(t(lang, "diff.metric", { basket: diff.basketName }))}</th><th scope="col">${escapeHtml(a.shortName)}</th><th scope="col">${escapeHtml(b.shortName)}</th><th scope="col">${escapeHtml(t(lang, "diff.ab"))}</th></tr></thead>
        <tbody>
          ${metricRow(t(lang, "diff.metric.diversionRate"), a.diversionRatePct, b.diversionRatePct, { suffix: "%" })}
          ${metricRow(t(lang, "diff.metric.curbsideOnly"), a.curbsideRatePct, b.curbsideRatePct, { suffix: "%" })}
          ${metricRow(t(lang, "diff.metric.divertedMass"), a.divertedLbs, b.divertedLbs, { suffix: " lb" })}
          ${metricRow(t(lang, "diff.metric.dropOffMass"), a.dropOffLbs, b.dropOffLbs, { suffix: " lb", invert: true })}
          ${metricRow(t(lang, "diff.metric.landfillMass"), a.trashLbs, b.trashLbs, { suffix: " lb", invert: true })}
          ${metricRow(t(lang, "diff.metric.cartContamination"), a.naiveCartContaminationPct, b.naiveCartContaminationPct, { suffix: "%", invert: true })}
          ${metricRow(t(lang, "diff.metric.contaminationRisk"), a.contaminationRiskIndex, b.contaminationRiskIndex, { suffix: "/100", invert: true })}
          ${metricRow(t(lang, "diff.metric.co2eAvoided"), a.co2eAvoidedKg, b.co2eAvoidedKg, { suffix: " kg" })}
        </tbody>
      </table>
    </div>
    <p class="field-help">${escapeHtml(t(lang, "diff.metricsHelp"))}</p>

    <div class="conflict-block">
      <h4>${escapeHtml(t(lang, "diff.conflicts"))} <span class="tabular mono-tag">${diff.conflicts.length}</span></h4>
      ${diff.conflicts.length === 0 ? `<p class="empty-batch-msg">${escapeHtml(t(lang, "diff.noConflicts"))}</p>` : `<ul class="conflict-list">${alertItems}</ul>`}
    </div>

    <div class="table-wrap">
      <table class="comparison-table stack-table diff-items-table">
        <caption class="sr-only">${escapeHtml(t(lang, "diff.caption"))}</caption>
        <thead><tr><th scope="col">${escapeHtml(t(lang, "diff.col.basket"))}</th><th scope="col">${escapeHtml(a.shortName)}</th><th scope="col">${escapeHtml(b.shortName)}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="rule-source tabular">${escapeHtml(t(lang, "diff.snapshotLine", { schema: diff.rulesSnapshot.schemaVersion, date: diff.rulesSnapshot.lastVerifiedDate }))}</p>
  </div>`;
}

/**
 * The hazard cascade lab output: one card per scenario with a stage ladder,
 * plus the combined severity readout for the whole lab.
 */
export function renderCascadeLab(lab, lang = "en") {
  const cards = lab.results
    .map((result) => {
      const stageItems = result.stages
        .map(
          (stage) => `<li class="cascade-stage ${stage.reached ? "is-reached" : ""}">
            <span class="cascade-stage-at tabular">${stage.at}+</span>
            <span class="cascade-stage-text"><strong>${escapeHtml(stage.name)}</strong><span class="cascade-stage-detail">${escapeHtml(stage.detail)}</span></span>
          </li>`
        )
        .join("");
      const level = result.count === 0 ? "idle" : result.alertLevel === "FACILITY_EMERGENCY" ? "critical" : result.alertLevel === "LINE_STOP" ? "high" : "moderate";
      return `<section class="cascade-card cascade-${escapeHtml(level)}" aria-label="${escapeHtml(result.title)}">
        <div class="cascade-card-head">
          <div>
            <h4>${escapeHtml(result.title)} <span class="tabular cascade-count-tag">x${result.count}</span></h4>
            <p class="cascade-headline">${escapeHtml(result.headline)}</p>
          </div>
          <span class="cascade-severity tabular severity-${escapeHtml(level)}">${result.severity}/100</span>
        </div>
        ${result.count > 0 ? `<ol class="cascade-stages">${stageItems}</ol>` : `<p class="empty-batch-msg">${escapeHtml(t(lang, "cascade.idleStage"))}</p>`}
        <div class="cascade-metrics tabular">
          <span>${escapeHtml(t(lang, "cascade.downtime"))} <strong>${escapeHtml(t(lang, "cascade.downtimeValue", { n: result.downtimeMin }))}</strong></span>
          <span>${escapeHtml(t(lang, "cascade.fiberYield"))} <strong>${escapeHtml(t(lang, "cascade.fiberValue", { n: result.baleYieldPct }))}</strong></span>
          <span>${escapeHtml(t(lang, "cascade.itemVerdict"))} <strong>${escapeHtml(t(lang, "cascade.riskValue", { stream: streamLabel(result.itemStream, lang), risk: result.itemRisk }))}</strong></span>
        </div>
        <p class="cascade-alt" id="cas-alt-${escapeHtml(result.scenarioId)}"><strong>${escapeHtml(t(lang, "cascade.safeRoute"))}</strong> ${escapeHtml(result.alternative)}</p>
      </section>`;
    })
    .join("");

  return `
  <div class="cascade-panel">
    <div class="cascade-lab-summary">
      <div class="impact-bar-row">
        <span class="impact-bar-label">${escapeHtml(t(lang, "cascade.severity"))}</span>
        <span class="impact-bar-track"><span class="impact-bar-fill verdict-dropoff" style="width: ${Math.max(1, lab.combinedSeverity)}%"></span></span>
        <strong class="impact-bar-value tabular">${lab.combinedSeverity}/100</strong>
      </div>
      <p class="impact-scale tabular">${escapeHtml(t(lang, "cascade.severityValue", { active: lab.activeCount, total: CASCADE_SCENARIO_IDS.length, items: lab.totalItems, pct: lab.worstBaleYieldPct, min: lab.totalDowntimeMin }))}</p>
    </div>
    <div class="cascade-grid">${cards}</div>
    <p class="field-help">${escapeHtml(t(lang, "cascade.footerHelp"))}</p>
  </div>`;
}

/** The signed audit panel: signature details for the current workbench export. */
export function renderAuditPanel({ signed }, lang = "en") {
  const digest = signed.signature.digest;
  return `
  <div class="audit-panel">
    <dl class="audit-sig-list tabular">
      <div><dt>${escapeHtml(t(lang, "audit.algorithm"))}</dt><dd>${escapeHtml(signed.signature.algorithm)}</dd></div>
      <div><dt>${escapeHtml(t(lang, "audit.keyId"))}</dt><dd>${escapeHtml(signed.signature.keyId)}</dd></div>
      <div><dt>${escapeHtml(t(lang, "audit.digest"))}</dt><dd class="audit-digest">${escapeHtml(digest)}</dd></div>
      <div><dt>${escapeHtml(t(lang, "audit.rows"))}</dt><dd>${escapeHtml(t(lang, "audit.rowsValue", { rows: signed.payload.rows.length, profiles: signed.payload.profiles.length }))}</dd></div>
    </dl>
    <p class="field-help">${escapeHtml(t(lang, "audit.panelHelp"))}</p>
  </div>`;
}

/** The verify result block under the replay textarea. */
export function renderAuditVerify(verifyResult, lang = "en") {
  if (!verifyResult) {
    return "";
  }
  const detail = normalizeLang(lang) === "es" ? auditDetailEs(verifyResult) : verifyResult.detail;
  return `<div class="audit-verify-result ${verifyResult.ok ? "verify-ok" : "verify-bad"}" role="status">
    ${renderVerdictIcon(verifyResult.ok ? "recycle" : "dropoff", 16)}
    <span>${escapeHtml(detail)}</span>
  </div>`;
}

/** The self-test panel output: aggregate badge plus per-check rows. */
export function renderSelfTests(result, lang = "en") {
  if (!result) {
    return `<p class="empty-batch-msg">${escapeHtml(t(lang, "selftest.notRun"))}</p>`;
  }
  const rows = result.results
    .map(
      (entry) => `<li class="selftest-row ${entry.pass ? "pass" : "fail"}">
        <span class="selftest-mark" aria-hidden="true">${entry.pass ? "&#10003;" : "&#10007;"}</span>
        <span class="selftest-id tabular">${escapeHtml(entry.id)}</span>
        <span class="selftest-detail">${escapeHtml(entry.detail)}</span>
      </li>`
    )
    .join("");
  return `
  <div class="selftest-panel">
    <div class="selftest-summary ${result.allPass ? "verify-ok" : "verify-bad"}" role="status">
      ${renderVerdictIcon(result.allPass ? "recycle" : "dropoff", 18)}
      <strong>${escapeHtml(t(lang, "selftest.summary", { passed: result.passed, total: result.total }))}${result.allPass ? "" : escapeHtml(t(lang, "selftest.failed", { n: result.failed }))}</strong>
    </div>
    <ul class="selftest-list">${rows}</ul>
  </div>`;
}
