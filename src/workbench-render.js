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

function streamTone(stream) {
  return verdictFor(stream).key;
}

function renderStreamTag(stream) {
  const key = streamTone(stream);
  return `<span class="stream-tag verdict-${escapeHtml(key)}">${renderVerdictIcon(key, 12)}<span>${escapeHtml(WORKBENCH_STREAM_LABELS[stream] || stream)}</span></span>`;
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
export function renderMunicipalDiff(diff) {
  const { a, b } = diff;
  const kindTag = (profile) =>
    `<span class="data-badge ${profile.profileKind === "snapshot" ? "is-sourced" : "is-demo"}">${profile.profileKind === "snapshot" ? "Real city snapshot" : "Illustrative archetype"}</span>`;

  const alertItems = diff.conflicts
    .map((entry) => {
      const icon = entry.severity === "critical" ? "dropoff" : entry.severity === "warning" ? "split" : "unknown";
      return `<li class="conflict-item conflict-${escapeHtml(entry.severity)}">
        <span class="conflict-icon">${renderVerdictIcon(icon, 14)}</span>
        <span><strong class="conflict-kind tabular">${escapeHtml(CONFLICT_KIND_LABELS_EXPORTED[entry.kind] || entry.kind)}</strong> ${escapeHtml(entry.message)}</span>
      </li>`;
    })
    .join("");

  const rows = diff.rows
    .map(
      (row) => `<tr${row.changed ? ' class="diff-row-changed"' : ""}>
        <th scope="row">${escapeHtml(row.label)} <span class="tabular diff-weight">${escapeHtml(String(row.weightLbs))} lb</span></th>
        <td data-label="${escapeHtml(a.shortName)}">${renderStreamTag(row.a.stream)}${row.changed ? `<p class="diff-note">${escapeHtml(row.a.note || "")}</p>` : ""}</td>
        <td data-label="${escapeHtml(b.shortName)}">${renderStreamTag(row.b.stream)}${row.changed ? `<p class="diff-note">${escapeHtml(row.b.note || "")}</p>` : ""}</td>
      </tr>`
    )
    .join("");

  return `
  <div class="diff-panel">
    <div class="diff-heads">
      <div class="diff-head-card">
        <div class="diff-head-row"><h4>${escapeHtml(a.profileName)}</h4>${kindTag(a)}</div>
        <p class="diff-summary">${escapeHtml(MRF_PROFILES[a.profileId].summary)}</p>
      </div>
      <div class="diff-head-card">
        <div class="diff-head-row"><h4>${escapeHtml(b.profileName)}</h4>${kindTag(b)}</div>
        <p class="diff-summary">${escapeHtml(MRF_PROFILES[b.profileId].summary)}</p>
      </div>
    </div>

    <div class="table-wrap">
      <table class="comparison-table stack-table diff-metrics-table">
        <caption class="sr-only">Diversion and contamination metrics for ${escapeHtml(a.profileName)} versus ${escapeHtml(b.profileName)} on the ${escapeHtml(diff.basketName)}</caption>
        <thead><tr><th scope="col">Metric (${escapeHtml(diff.basketName)})</th><th scope="col">${escapeHtml(a.shortName)}</th><th scope="col">${escapeHtml(b.shortName)}</th><th scope="col">A minus B</th></tr></thead>
        <tbody>
          ${metricRow("Diversion rate", a.diversionRatePct, b.diversionRatePct, { suffix: "%" })}
          ${metricRow("Curbside-only diversion", a.curbsideRatePct, b.curbsideRatePct, { suffix: "%" })}
          ${metricRow("Diverted mass", a.divertedLbs, b.divertedLbs, { suffix: " lb" })}
          ${metricRow("Needs a drop-off trip", a.dropOffLbs, b.dropOffLbs, { suffix: " lb", invert: true })}
          ${metricRow("Landfilled mass", a.trashLbs, b.trashLbs, { suffix: " lb", invert: true })}
          ${metricRow("Naive-cart contamination", a.naiveCartContaminationPct, b.naiveCartContaminationPct, { suffix: "%", invert: true })}
          ${metricRow("Contamination risk index", a.contaminationRiskIndex, b.contaminationRiskIndex, { suffix: "/100", invert: true })}
          ${metricRow("Lifecycle CO2e avoided", a.co2eAvoidedKg, b.co2eAvoidedKg, { suffix: " kg" })}
        </tbody>
      </table>
    </div>
    <p class="field-help">Diversion counts recycling, organics, green waste, split-share and drop-off mass that avoids landfill. CO2e uses EPA WARM-style planning factors disclosed per material in the signed audit; they are planning estimates, not facility measurements. Item masses are illustrative household estimates.</p>

    <div class="conflict-block">
      <h4>Rule-conflict alerts <span class="tabular mono-tag">${diff.conflicts.length}</span></h4>
      ${diff.conflicts.length === 0 ? `<p class="empty-batch-msg">No conflicts: every basket item routes to the same kind of stream under both profiles.</p>` : `<ul class="conflict-list">${alertItems}</ul>`}
    </div>

    <div class="table-wrap">
      <table class="comparison-table stack-table diff-items-table">
        <caption class="sr-only">Item by item routing under both profiles</caption>
        <thead><tr><th scope="col">Basket item</th><th scope="col">${escapeHtml(a.shortName)}</th><th scope="col">${escapeHtml(b.shortName)}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="rule-source tabular">Snapshot profiles: ${escapeHtml(diff.rulesSnapshot.schemaVersion)} verified ${escapeHtml(diff.rulesSnapshot.lastVerifiedDate)}. Archetypes are illustrative planning models, not claims about any named city.</p>
  </div>`;
}

/**
 * The hazard cascade lab output: one card per scenario with a stage ladder,
 * plus the combined severity readout for the whole lab.
 */
export function renderCascadeLab(lab) {
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
        ${result.count > 0 ? `<ol class="cascade-stages">${stageItems}</ol>` : `<p class="empty-batch-msg">Set the slider for this scenario above zero to see where the failure starts.</p>`}
        <div class="cascade-metrics tabular">
          <span>Modeled downtime: <strong>${result.downtimeMin} min</strong></span>
          <span>Clean-fiber bale yield: <strong>${result.baleYieldPct}%</strong></span>
          <span>Item verdict: <strong>${escapeHtml(WORKBENCH_STREAM_LABELS[result.itemStream] || result.itemStream)}</strong> (risk ${result.itemRisk}/100)</span>
        </div>
        <p class="cascade-alt" id="cas-alt-${escapeHtml(result.scenarioId)}"><strong>Safe route:</strong> ${escapeHtml(result.alternative)}</p>
      </section>`;
    })
    .join("");

  return `
  <div class="cascade-panel">
    <div class="cascade-lab-summary">
      <div class="impact-bar-row">
        <span class="impact-bar-label">Combined line severity</span>
        <span class="impact-bar-track"><span class="impact-bar-fill verdict-dropoff" style="width: ${Math.max(1, lab.combinedSeverity)}%"></span></span>
        <strong class="impact-bar-value tabular">${lab.combinedSeverity}/100</strong>
      </div>
      <p class="impact-scale tabular">${lab.activeCount} of ${CASCADE_SCENARIO_IDS.length} scenarios active, ${lab.totalItems} contaminant items, worst bale yield ${lab.worstBaleYieldPct}%, modeled downtime ${lab.totalDowntimeMin} min across the lab.</p>
    </div>
    <div class="cascade-grid">${cards}</div>
    <p class="field-help">A deterministic model of documented MRF failure modes: each stage engages at a fixed contaminant count and severity can only stay the same or rise. Downtime and yield are illustrative planning figures, not measurements from any facility.</p>
  </div>`;
}

/** The signed audit panel: signature details for the current workbench export. */
export function renderAuditPanel({ signed }) {
  const digest = signed.signature.digest;
  return `
  <div class="audit-panel">
    <dl class="audit-sig-list tabular">
      <div><dt>Algorithm</dt><dd>${escapeHtml(signed.signature.algorithm)}</dd></div>
      <div><dt>Key id</dt><dd>${escapeHtml(signed.signature.keyId)}</dd></div>
      <div><dt>Digest</dt><dd class="audit-digest">${escapeHtml(digest)}</dd></div>
      <div><dt>Audit rows</dt><dd>${signed.payload.rows.length} items, ${signed.payload.profiles.length} profiles</dd></div>
    </dl>
    <p class="field-help">HMAC-SHA-256 over the canonical JSON payload. The integrity key ships with the app, so anyone can replay this export here and see the tag recomputed; the signature proves the bytes were not edited after export. It is a self-check integrity tag, not a third-party certificate.</p>
  </div>`;
}

/** The verify result block under the replay textarea. */
export function renderAuditVerify(verifyResult) {
  if (!verifyResult) {
    return "";
  }
  return `<div class="audit-verify-result ${verifyResult.ok ? "verify-ok" : "verify-bad"}" role="status">
    ${renderVerdictIcon(verifyResult.ok ? "recycle" : "dropoff", 16)}
    <span>${escapeHtml(verifyResult.detail)}</span>
  </div>`;
}

/** The self-test panel output: aggregate badge plus per-check rows. */
export function renderSelfTests(result) {
  if (!result) {
    return `<p class="empty-batch-msg">Not run yet in this tab. The same registry ships in the test suite.</p>`;
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
      <strong>${result.passed}/${result.total} self-tests passed${result.allPass ? "" : `, ${result.failed} failed`}</strong>
    </div>
    <ul class="selftest-list">${rows}</ul>
  </div>`;
}
