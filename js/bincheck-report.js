/**
 * BinCheck single-item inspection report: a deterministic audit record of one
 * item's identification evidence and both cities' verdicts, exportable as
 * byte-stable JSON or CSV.
 *
 * Pure and deterministic. No DOM, no clock, no network. The same query always
 * yields byte-identical output; generatedOn stays null unless a caller passes
 * one explicitly.
 */

import {
  evaluateItemDisposal,
  compareJurisdictions,
  validateBarcodeCheckDigit
} from "./bincheck-engine.js";
import {
  assessEvidence,
  RULES_SNAPSHOT_META,
  CITY_IDS
} from "./bincheck-validate.js";

export const INSPECTION_REPORT_SCHEMA = "bincheck-inspection/1";
export const INSPECTION_REPORT_CSV_COLUMNS = Object.freeze(["section", "field", "sugar_land", "houston"]);

/**
 * Assembles the full audit record for one item: the normalized input, the
 * evidence basis and confidence, the GS1 check digit math, both city verdicts
 * with prep steps and quoted rule citations, and the comparison summary.
 */
export function buildInspectionReport(query = {}) {
  const assessment = assessEvidence(query);
  const normalized = assessment.query;

  const cities = Object.fromEntries(
    CITY_IDS.map((cityId) => {
      const ev = evaluateItemDisposal({ ...normalized, city: cityId });
      return [
        cityId,
        {
          stream: ev.stream,
          badgeLabel: ev.badgeLabel,
          riskScore: ev.contaminationRiskScore,
          tier: ev.contaminationTier,
          prepSteps: [...ev.prepSteps],
          dropOffNote: ev.dropOffNote,
          facility: {
            name: ev.dropOffFacility.name,
            address: ev.dropOffFacility.address,
            hours: ev.dropOffFacility.hours
          },
          citations: ev.ruleCitations.map((cite) => ({ ruleId: cite.ruleId, kind: cite.kind, quote: cite.quote })),
          sourceUrl: ev.officialSourceUrl
        }
      ];
    })
  );

  const comparison = compareJurisdictions(normalized);
  const check = normalized.barcode ? validateBarcodeCheckDigit(normalized.barcode) : null;

  return {
    schema: INSPECTION_REPORT_SCHEMA,
    tool: "BinCheck",
    rulesSnapshot: { ...RULES_SNAPSHOT_META },
    generatedOn: null,
    input: {
      barcode: normalized.barcode ?? "",
      materialId: normalized.materialId ?? "",
      resinCode: normalized.resinCode ?? "",
      condition: normalized.condition ?? "clean"
    },
    identification: {
      basis: assessment.basis,
      basisLabel: assessment.basisLabel,
      confidence: assessment.confidence,
      confidenceReason: assessment.confidenceReason,
      issues: assessment.issues.map((entry) => ({ code: entry.code, severity: entry.severity, message: entry.message }))
    },
    barcode: check
      ? {
          format: check.format,
          valid: check.valid,
          normalized: check.normalized,
          ean13: check.ean13,
          expectedCheckDigit: check.expectedCheckDigit,
          actualCheckDigit: check.actualCheckDigit,
          reason: check.reason
        }
      : null,
    item: {
      title: comparison.itemTitle,
      materialId: comparison.materialId,
      matchedProduct: assessment.catalogProduct
        ? {
            upc: assessment.catalogProduct.upc,
            brand: assessment.catalogProduct.brand,
            productName: assessment.catalogProduct.productName,
            packagingSummary: assessment.catalogProduct.packagingSummary
          }
        : null
    },
    cities,
    comparison: {
      sameStream: comparison.sameStream,
      riskDelta: comparison.riskDelta,
      divergenceSummary: comparison.divergenceSummary
    }
  };
}

function guardFormula(value) {
  const text = String(value ?? "");
  return /^[\s\u0085\u180E\u200B\u200C\u200D\u2060\uFEFF]*[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

function reportCsvCell(value) {
  const text = guardFormula(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Deterministic JSON export. generatedOn is null unless the caller supplies
 * one, so repeated exports of the same query are byte-identical.
 */
export function inspectionReportToJson(report, options = {}) {
  const payload = { ...report, generatedOn: options.generatedOn ?? null };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

/**
 * Deterministic CSV export: a two-city comparison sheet with one row per
 * audited field. City-agnostic fields sit in the sugar_land column with the
 * houston column empty. CRLF endings, formula-safe cells, fixed row order.
 */
export function inspectionReportToCsv(report) {
  const lines = [INSPECTION_REPORT_CSV_COLUMNS.join(",")];
  const add = (section, field, Riverside = "", houston = "") => {
    lines.push([section, field, Riverside, houston].map(reportCsvCell).join(","));
  };
  const sl = report.cities["Riverside-tx"];
  const ho = report.cities["houston-tx"];
  const citations = (city) => city.citations.map((cite) => `${cite.ruleId} (${cite.kind}): ${cite.quote}`).join(" | ");

  add("meta", "tool", report.tool);
  add("meta", "schema", report.schema);
  add("meta", "rules_snapshot", `${report.rulesSnapshot.schemaVersion} verified ${report.rulesSnapshot.lastVerifiedDate}`);
  add("input", "barcode", report.input.barcode);
  add("input", "material", report.input.materialId);
  add("input", "resin_code", report.input.resinCode === "" ? "" : String(report.input.resinCode));
  add("input", "condition", report.input.condition);
  add("identification", "basis", report.identification.basis);
  add("identification", "confidence", report.identification.confidence);
  add("identification", "confidence_reason", report.identification.confidenceReason);
  add("identification", "issues", report.identification.issues.map((entry) => `${entry.severity}:${entry.code}`).join(";"));
  if (report.barcode) {
    add("barcode", "format", report.barcode.format);
    add("barcode", "valid", report.barcode.valid ? "yes" : "no");
    add("barcode", "normalized", report.barcode.normalized);
    add("barcode", "check_digit", `expected ${report.barcode.expectedCheckDigit}, found ${report.barcode.actualCheckDigit}`);
  }
  add("item", "title", report.item.title);
  add("item", "material_id", report.item.materialId);
  if (report.item.matchedProduct) {
    add("item", "catalog_product", `${report.item.matchedProduct.productName} (${report.item.matchedProduct.brand}, ${report.item.matchedProduct.upc})`);
  }
  add("result", "stream", sl.stream, ho.stream);
  add("result", "badge", sl.badgeLabel, ho.badgeLabel);
  add("result", "risk_score", String(sl.riskScore), String(ho.riskScore));
  add("result", "tier", sl.tier, ho.tier);
  add("result", "prep_steps", sl.prepSteps.join(" | "), ho.prepSteps.join(" | "));
  add("result", "drop_off_note", sl.dropOffNote, ho.dropOffNote);
  add("result", "facility", `${sl.facility.name}, ${sl.facility.address}`, `${ho.facility.name}, ${ho.facility.address}`);
  add("result", "rule_citations", citations(sl), citations(ho));
  add("compare", "same_stream", report.comparison.sameStream ? "yes" : "no");
  add("compare", "risk_delta", String(report.comparison.riskDelta));
  add("compare", "divergence", report.comparison.divergenceSummary);
  return `${lines.join("\r\n")}\r\n`;
}
