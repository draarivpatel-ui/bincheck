/**
 * BinCheck batch inspection: CSV parsing, per-row evaluation across both
 * jurisdictions, aggregate load scoring, and deterministic exports.
 *
 * Pure and deterministic. No DOM, no clock, no network. The same input text
 * always yields byte-identical CSV and JSON output.
 */

import {
  SUPPORTED_CITIES,
  evaluateItemDisposal,
  scoreCartBatch,
  validateBarcodeCheckDigit
} from "./bincheck-engine.js";
import {
  RULES_SNAPSHOT_META,
  assessEvidence,
  normalizeMaterialToken,
  parseResinCode,
  CITY_IDS
} from "./bincheck-validate.js";

export const BATCH_LIMITS = Object.freeze({ maxBytes: 262144, maxRows: 500 });
export const CSV_COLUMNS = Object.freeze(["label", "barcode", "material", "resin", "condition"]);
/** Column order when the file has no header row, as documented next to the input. */
export const HEADERLESS_COLUMNS = Object.freeze(["barcode", "material", "resin", "condition", "label"]);

const HEADER_ALIASES = {
  label: "label",
  name: "label",
  item: "label",
  description: "label",
  barcode: "barcode",
  upc: "barcode",
  ean: "barcode",
  gtin: "barcode",
  material: "material",
  materialid: "material",
  category: "material",
  resin: "resin",
  resincode: "resin",
  spi: "resin",
  condition: "condition",
  state: "condition"
};

export const SAMPLE_BATCH_CSV = [
  "label,barcode,material,resin,condition",
  "Spring water bottle,041220576463,,,clean",
  "Milk jug,041220948321,,,clean",
  "Soup can,049000006346,,,clean",
  "Chip bag,028400589864,,,clean",
  "Grocery bag,041220400126,,,clean",
  "Foam cup,073287001060,,,clean",
  "Leftover pizza box,072140001056,,,greasy",
  "Half-full soda bottle,,resin-1-pet,,liquid-full",
  "Mistyped barcode,041220576464,resin-1-pet,,clean"
].join("\n");

function csvError(line, code, message) {
  return { line, code, message };
}

/**
 * Minimal RFC 4180 reader. Handles BOM, CRLF/CR/LF, quoted fields, doubled
 * quotes, and newlines inside quotes. Returns { records, errors } where each
 * record is { line, cells } and `line` is the 1-based starting line.
 */
export function parseCsv(text) {
  const records = [];
  const errors = [];
  const source = String(text ?? "").replace(/^\uFEFF/, "").replace(/\u0000/g, "");
  let cells = [];
  let field = "";
  let inQuotes = false;
  let fieldWasQuoted = false;
  let line = 1;
  let recordLine = 1;
  let touched = false;
  let touchedQuotedFirst = false;

  const endField = () => {
    cells.push(fieldWasQuoted ? field : field.trim());
    field = "";
    fieldWasQuoted = false;
  };
  const endRecord = () => {
    endField();
    const blank = cells.every((cell) => cell === "");
    const first = cells[0] ?? "";
    const isComment = !blank && first.startsWith("#") && !touchedQuotedFirst;
    if (!blank && !isComment) {
      records.push({ line: recordLine, cells });
    }
    cells = [];
    touched = false;
    touchedQuotedFirst = false;
  };

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (inQuotes) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === "\r" || (ch === "\n" && source[i - 1] !== "\r")) {
          line += 1;
        }
        field += ch;
      }
      continue;
    }
    if (ch === '"' && field.trim() === "") {
      inQuotes = true;
      fieldWasQuoted = true;
      field = "";
      if (cells.length === 0) {
        touchedQuotedFirst = true;
      }
      touched = true;
    } else if (ch === ",") {
      endField();
      touched = true;
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && source[i + 1] === "\n") {
        i += 1;
      }
      endRecord();
      line += 1;
      recordLine = line;
    } else {
      field += ch;
      touched = true;
    }
  }

  if (inQuotes) {
    errors.push(csvError(recordLine, "CSV_UNTERMINATED_QUOTE", "A quoted field was never closed. The rest of the file was ignored."));
    return { records, errors };
  }
  if (touched || field !== "" || cells.length > 0) {
    endRecord();
  }
  return { records, errors };
}

/**
 * Parses batch CSV text into normalized row objects.
 * Returns { rows, errors, hasHeader, columns, truncated, bytes }.
 */
export function parseBatchCsv(text) {
  const errors = [];
  if (typeof text !== "string" || text.trim() === "") {
    return {
      rows: [],
      errors: [csvError(0, "EMPTY_INPUT", "Paste CSV text or choose a file first.")],
      hasHeader: false,
      columns: [...CSV_COLUMNS],
      truncated: false,
      bytes: 0
    };
  }
  const bytes = new TextEncoder().encode(text).length;
  if (bytes > BATCH_LIMITS.maxBytes) {
    return {
      rows: [],
      errors: [csvError(0, "TOO_LARGE", `Input is ${bytes} bytes. The limit is ${BATCH_LIMITS.maxBytes} bytes.`)],
      hasHeader: false,
      columns: [...CSV_COLUMNS],
      truncated: false,
      bytes
    };
  }

  const parsed = parseCsv(text);
  errors.push(...parsed.errors);
  let records = parsed.records;
  let columns = [...HEADERLESS_COLUMNS];
  let hasHeader = false;

  if (records.length > 0) {
    const firstCells = records[0].cells.map((cell) => cell.toLowerCase().replace(/[^a-z0-9]/g, ""));
    const headerColumns = firstCells.map((cell) => Object.hasOwn(HEADER_ALIASES, cell) ? HEADER_ALIASES[cell] : null);
    const hasIdentifierColumn = headerColumns.some((column) => column === "barcode" || column === "material" || column === "resin");
    const hasBarcodeData = records[0].cells.some((cell) => /^\d{8,14}$/.test(cell.replace(/[\s-]/g, "")));
    const hasMaterialData = normalizeMaterialToken(records[0].cells[1]) !== null;
    const hasResinData = parseResinCode(records[0].cells[2]).valid;
    if (hasIdentifierColumn && !hasBarcodeData && !hasMaterialData && !hasResinData) {
      hasHeader = true;
      columns = headerColumns;
      records[0].cells.forEach((cell, index) => {
        if (!columns[index]) {
          errors.push(csvError(records[0].line, "UNKNOWN_COLUMN", `Column "${cell.slice(0, 30)}" is not recognized and was ignored.`));
        }
      });
      records = records.slice(1);
    }
  }

  let truncated = false;
  if (records.length > BATCH_LIMITS.maxRows) {
    truncated = true;
    errors.push(csvError(records[BATCH_LIMITS.maxRows].line, "ROW_LIMIT", `Only the first ${BATCH_LIMITS.maxRows} rows were read.`));
    records = records.slice(0, BATCH_LIMITS.maxRows);
  }

  const rows = records.map((record) => {
    const row = { line: record.line, label: "", barcode: "", material: "", resin: "", condition: "" };
    record.cells.forEach((cell, index) => {
      const column = columns[index];
      if (column) {
        row[column] = cell;
      }
    });
    return row;
  });

  if (rows.length === 0 && errors.length === 0) {
    errors.push(csvError(0, "NO_DATA_ROWS", "No data rows were found."));
  }

  return { rows, errors, hasHeader, columns, truncated, bytes };
}

function summarizeCity(cityId, evaluatedRows) {
  const items = evaluatedRows.map((row) => row.engineInput);
  const summary = scoreCartBatch(items, cityId);
  const streamCounts = {};
  for (const evaluation of summary.evaluations) {
    streamCounts[evaluation.stream] = (streamCounts[evaluation.stream] || 0) + 1;
  }
  return {
    city: cityId,
    cityName: SUPPORTED_CITIES[cityId].shortName,
    itemCount: summary.itemCount,
    averageRiskScore: summary.averageRiskScore,
    maxRiskScore: summary.maxRiskScore,
    loadStatus: summary.loadStatus,
    streamCounts: Object.fromEntries(Object.entries(streamCounts).sort(([a], [b]) => (a < b ? -1 : 1))),
    hazards: summary.criticalHazards
  };
}

/**
 * Evaluates parsed rows across both jurisdictions. Rows that cannot be
 * identified are reported as ERROR and excluded from load scoring; BinCheck
 * never guesses a rule for them.
 */
export function inspectBatch(rows = []) {
  const results = [];

  for (const row of Array.isArray(rows) ? rows : []) {
    const base = {
      line: row.line ?? 0,
      label: String(row.label ?? ""),
      input: {
        barcode: String(row.barcode ?? ""),
        material: String(row.material ?? ""),
        resin: String(row.resin ?? ""),
        condition: String(row.condition ?? "")
      }
    };
    const assessment = assessEvidence({
      barcode: row.barcode,
      materialId: row.material,
      resinCode: row.resin,
      condition: row.condition
    });
    const issues = assessment.issues;
    const hasError = issues.some((entry) => entry.severity === "error");
    const identified = assessment.basis !== "FALLBACK_DEFAULT";

    const barcodeCheck = assessment.query.barcode ? validateBarcodeCheckDigit(assessment.query.barcode) : null;
    const barcodeOnlyInvalid =
      barcodeCheck && !barcodeCheck.valid && !assessment.query.materialId && assessment.query.resinCode === undefined;

    let errorIssues = [];
    if (hasError) {
      errorIssues = issues.filter((entry) => entry.severity === "error");
    } else if (!identified && !assessment.query.barcode) {
      errorIssues = [{ code: "EMPTY_ROW", severity: "error", field: "item", message: "Row has no barcode, material, or resin code." }];
    } else if (barcodeOnlyInvalid) {
      errorIssues = issues.filter((entry) => entry.code === "BARCODE_INVALID").map((entry) => ({ ...entry, severity: "error" }));
    } else if (!identified) {
      errorIssues = [{ code: "NO_ITEM_IDENTIFIED", severity: "error", field: "item", message: "Barcode is not in the demo catalog and no material or resin code was given." }];
    }

    if (errorIssues.length > 0) {
      results.push({
        ...base,
        status: "ERROR",
        issues: errorIssues,
        evidenceBasis: assessment.basis,
        confidence: "LOW",
        itemTitle: "",
        materialId: "",
        cities: null,
        streamsDiverge: false,
        engineInput: null
      });
      continue;
    }

    const engineInput = { ...assessment.query };
    const cities = {};
    for (const cityId of CITY_IDS) {
      const ev = evaluateItemDisposal({ ...engineInput, city: cityId });
      cities[cityId] = {
        stream: ev.stream,
        badgeLabel: ev.badgeLabel,
        riskScore: ev.contaminationRiskScore,
        tier: ev.contaminationTier
      };
    }
    const first = evaluateItemDisposal({ ...engineInput, city: CITY_IDS[0] });
    const streamsDiverge = cities[CITY_IDS[0]].stream !== cities[CITY_IDS[1]].stream;

    results.push({
      ...base,
      status: issues.some((entry) => entry.severity === "warning") ? "WARN" : "OK",
      issues,
      evidenceBasis: assessment.basis,
      confidence: assessment.confidence,
      itemTitle: first.itemTitle,
      materialId: first.materialId,
      cities,
      streamsDiverge,
      engineInput
    });
  }

  const evaluated = results.filter((row) => row.status !== "ERROR");
  const confidenceCounts = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const row of evaluated) {
    confidenceCounts[row.confidence] += 1;
  }

  return {
    totals: {
      rows: results.length,
      evaluated: evaluated.length,
      ok: results.filter((row) => row.status === "OK").length,
      warnings: results.filter((row) => row.status === "WARN").length,
      errors: results.filter((row) => row.status === "ERROR").length,
      divergent: evaluated.filter((row) => row.streamsDiverge).length,
      confidence: confidenceCounts
    },
    cities: Object.fromEntries(CITY_IDS.map((cityId) => [cityId, summarizeCity(cityId, evaluated)])),
    rows: results
  };
}

/** One call from text to full result: parse then inspect. */
export function runBatchFromCsv(text) {
  const parsed = parseBatchCsv(text);
  const inspection = inspectBatch(parsed.rows);
  return {
    parse: {
      errors: parsed.errors,
      hasHeader: parsed.hasHeader,
      truncated: parsed.truncated,
      bytes: parsed.bytes
    },
    ...inspection
  };
}

function guardFormula(value) {
  const text = String(value ?? "");
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

function csvCell(value) {
  const text = guardFormula(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const EXPORT_COLUMNS = Object.freeze([
  "line",
  "label",
  "status",
  "issues",
  "evidence_basis",
  "confidence",
  "item",
  "material_id",
  "sugar_land_stream",
  "sugar_land_risk",
  "sugar_land_tier",
  "houston_stream",
  "houston_risk",
  "houston_tier",
  "streams_diverge"
]);

/** Deterministic CSV export. CRLF line endings, fixed column order, formula-safe cells. */
export function batchResultToCsv(result) {
  const lines = [EXPORT_COLUMNS.join(",")];
  for (const row of result.rows) {
    const sl = row.cities ? row.cities["Riverside-tx"] : null;
    const ho = row.cities ? row.cities["houston-tx"] : null;
    const values = [
      row.line,
      row.label,
      row.status,
      row.issues.map((entry) => entry.code).join(";"),
      row.evidenceBasis,
      row.confidence,
      row.itemTitle,
      row.materialId,
      sl ? sl.stream : "",
      sl ? sl.riskScore : "",
      sl ? sl.tier : "",
      ho ? ho.stream : "",
      ho ? ho.riskScore : "",
      ho ? ho.tier : "",
      row.cities ? (row.streamsDiverge ? "yes" : "no") : ""
    ];
    lines.push(values.map(csvCell).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

/** Deterministic JSON export. Contains no timestamps unless `generatedOn` is supplied. */
export function batchResultToJson(result, options = {}) {
  const payload = {
    tool: "BinCheck",
    rulesSnapshot: { ...RULES_SNAPSHOT_META },
    generatedOn: options.generatedOn ?? null,
    totals: result.totals,
    cities: result.cities,
    rows: result.rows.map((row) => ({
      line: row.line,
      label: row.label,
      status: row.status,
      issues: row.issues.map((entry) => ({ code: entry.code, severity: entry.severity, message: entry.message })),
      evidenceBasis: row.evidenceBasis,
      confidence: row.confidence,
      item: row.itemTitle,
      materialId: row.materialId,
      Riverside: row.cities ? row.cities["Riverside-tx"] : null,
      houston: row.cities ? row.cities["houston-tx"] : null,
      streamsDiverge: row.streamsDiverge
    }))
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export { normalizeMaterialToken, parseResinCode };
