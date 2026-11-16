import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseCsv,
  parseBatchCsv,
  inspectBatch,
  runBatchFromCsv,
  batchResultToCsv,
  batchResultToJson,
  SAMPLE_BATCH_CSV,
  BATCH_LIMITS,
  EXPORT_COLUMNS
} from "../js/bincheck-batch.js";
import {
  runBenchmark,
  verifyGroundTruthAnchors,
  checkAnchor,
  percentile,
  benchmarkToJson,
  benchmarkToText,
  buildCatalogCases
} from "../js/bincheck-benchmark.js";
import { GROUND_TRUTH_CASES, KNOWN_GAP_CASES, EXTERNAL_BARCODE_VECTORS } from "../js/ground-truth.js";
import { VERIFIED_BARCODE_CATALOG, validateBarcodeCheckDigit, evaluateItemDisposal } from "../src/bincheck-engine.js";
import { runCli } from "../scripts/run-benchmark.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const snapshot = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../data/municipal-rules-2026.json"), "utf8"));
const clock = () => {
  let t = 0;
  return () => (t += 0.5);
};

/* ---------------- CSV parsing ---------------- */

test("csv: material and resin data take precedence over header aliases in labels", () => {
  const text = ",resin-1-pet,1,clean,barcode\n,resin-3-pvc,3,clean,PVC";
  const parsed = parseBatchCsv(text);
  assert.equal(parsed.hasHeader, false);
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.rows.length, 2);
  assert.deepEqual(parsed.rows.map((row) => row.label), ["barcode", "PVC"]);
  const result = runBatchFromCsv(text);
  assert.equal(result.totals.rows, 2);
  assert.equal(result.totals.evaluated, 2);
  assert.equal(result.totals.errors, 0);
  assert.deepEqual(result.rows.map((row) => row.materialId), ["resin-1-pet", "resin-3-pvc"]);
});

test("csv: headerless material-only and resin-only rows retain identifier-like labels", () => {
  for (const label of ["barcode", "material", "resin", "PVC", "constructor", "__proto__", "toString", "valueOf"]) {
    for (const [material, resin, expected] of [
      ["resin-1-pet", "", "resin-1-pet"],
      ["", "3", "resin-3-pvc"],
      ["resin-3-pvc", "#3", "resin-3-pvc"]
    ]) {
      const text = ["", material, resin, "clean", label].join(",");
      const result = runBatchFromCsv(text);
      assert.equal(result.parse.hasHeader, false, text);
      assert.deepEqual(result.parse.errors, [], text);
      assert.equal(result.totals.evaluated, 1, text);
      assert.equal(result.rows[0].label, label);
      assert.equal(result.rows[0].materialId, expected);
    }
  }
});

test("csv: quoted commas, escaped quotes, CRLF and embedded newlines parse exactly", () => {
  const { records, errors } = parseCsv('a,"b,c","say ""hi"""\r\n"multi\nline",2,3\r\n');
  assert.equal(errors.length, 0);
  assert.deepEqual(records[0].cells, ["a", "b,c", 'say "hi"']);
  assert.deepEqual(records[1].cells, ["multi\nline", "2", "3"]);
});

test("csv: quoted CR, CRLF and LF each advance one source line without changing contents", () => {
  for (const newline of ["\r", "\r\n", "\n"]) {
    const text = `"first${newline}second",1${newline}"third${newline}fourth",2${newline}"open`;
    const parsed = parseCsv(text);
    assert.deepEqual(parsed.records, [
      { line: 1, cells: [`first${newline}second`, "1"] },
      { line: 3, cells: [`third${newline}fourth`, "2"] }
    ]);
    assert.equal(parsed.errors[0].code, "CSV_UNTERMINATED_QUOTE");
    assert.equal(parsed.errors[0].line, 5);
  }
  const mixed = parseCsv('"a\rb\r\nc\nd",1\rnext,2');
  assert.equal(mixed.records[0].cells[0], "a\rb\r\nc\nd");
  assert.equal(mixed.records[1].line, 5);
});

test("csv: an unterminated quote stops parsing with a line-numbered error", () => {
  const { errors } = parseCsv('a,b\n"open,2\n3,4');
  assert.equal(errors[0].code, "CSV_UNTERMINATED_QUOTE");
  assert.equal(errors[0].line, 2);
});

test("csv: empty, oversized and header-only inputs are rejected with a reason", () => {
  assert.equal(parseBatchCsv("").errors[0].code, "EMPTY_INPUT");
  assert.equal(parseBatchCsv("x".repeat(BATCH_LIMITS.maxBytes + 1)).errors[0].code, "TOO_LARGE");
  assert.equal(parseBatchCsv("label,barcode\n").errors[0].code, "NO_DATA_ROWS");
  assert.equal(parseBatchCsv("label,notes\nx,y\n").hasHeader, false, "label names alone cannot identify a header");
});

test("csv: rows past the row limit are cut and reported", () => {
  const body = Array.from({ length: BATCH_LIMITS.maxRows + 7 }, () => "041220576463").join("\n");
  const parsed = parseBatchCsv(`barcode\n${body}`);
  assert.equal(parsed.rows.length, BATCH_LIMITS.maxRows);
  assert.equal(parsed.truncated, true);
  assert.ok(parsed.errors.some((e) => e.code === "ROW_LIMIT"));
});

test("csv: headerless rows are read as barcode, material, resin, condition, label", () => {
  const parsed = parseBatchCsv("041220576463,resin-1-pet,1,clean,My bottle\n");
  assert.equal(parsed.hasHeader, false);
  assert.equal(parsed.rows[0].label, "My bottle");
  assert.equal(parsed.rows[0].material, "resin-1-pet");
});

test("csv: label aliases never consume a headerless barcode row", () => {
  for (const label of ["Name", "label", "item", "description", "barcode", "material", "resin", "condition"]) {
    const result = runBatchFromCsv(`041220576463,,,,${label}\n041220948321,,,,Milk`);
    assert.equal(result.parse.hasHeader, false, label);
    assert.equal(result.totals.rows, 2);
    assert.equal(result.totals.evaluated, 2);
    assert.equal(result.rows[0].label, label);
    assert.equal(result.rows[0].input.barcode, "041220576463");
  }
  assert.equal(parseBatchCsv("041220576464,,,,resin").hasHeader, false, "a mistyped barcode is still a data row");
  assert.equal(parseBatchCsv("0412-2057 6463,,,,barcode").hasHeader, false);
});

test("csv: identifier aliases detect real headers and prototype names become unknown columns", () => {
  for (const [alias, column] of [["UPC", "barcode"], ["EAN", "barcode"], ["material_id", "material"], ["Category", "material"], ["resin_code", "resin"], ["SPI", "resin"]]) {
    const parsed = parseBatchCsv(`${alias},Name\nvalue,Bottle`);
    assert.equal(parsed.hasHeader, true, alias);
    assert.deepEqual(parsed.columns, [column, "label"]);
    assert.equal(parsed.rows[0][column], "value");
  }
  const text = "constructor,barcode,material\nignored,041220576463,resin-1-pet";
  const parsed = parseBatchCsv(text);
  const result = runBatchFromCsv(text);
  assert.equal(result.parse.hasHeader, true);
  assert.deepEqual(parsed.columns, [null, "barcode", "material"]);
  assert.ok(result.parse.errors.some((entry) => entry.code === "UNKNOWN_COLUMN"));
  assert.equal(result.totals.evaluated, 1);
  assert.equal(result.rows[0].input.material, "resin-1-pet");
});

/* ---------------- Batch inspection ---------------- */

test("batch: the sample evaluates every row in both cities and finds the one divergent item", () => {
  const result = runBatchFromCsv(SAMPLE_BATCH_CSV);
  assert.equal(result.totals.rows, 9);
  assert.equal(result.totals.evaluated, 9);
  assert.equal(result.totals.errors, 0);
  assert.equal(result.totals.divergent, 1);
  for (const row of result.rows) {
    assert.ok(row.cities["sugar-land-tx"] && row.cities["houston-tx"], `row ${row.line} has both cities`);
  }
});

test("batch: an unidentifiable row is an error and is never guessed into a stream", () => {
  const result = runBatchFromCsv("label,barcode\nMystery,036000291452\nBad,041220576464\n");
  assert.equal(result.totals.errors, 2);
  for (const row of result.rows) {
    assert.equal(row.status, "ERROR");
    assert.equal(row.cities, null);
  }
});

test("batch: prototype materials are rejected without crashing inspection", () => {
  for (const material of ["constructor", "__proto__", "toString", "valueOf"]) {
    const result = runBatchFromCsv(`material,label\n${material},Unknown`);
    assert.equal(result.totals.errors, 1, material);
    assert.equal(result.totals.evaluated, 0);
    assert.equal(result.rows[0].cities, null);
    assert.ok(result.rows[0].issues.some((entry) => entry.code === "UNKNOWN_MATERIAL"));
  }
});

test("batch: a catalog barcode with a contradictory resin is reported with low confidence", () => {
  const result = runBatchFromCsv("barcode,resin\n041220576463,3");
  assert.equal(result.totals.evaluated, 1);
  assert.equal(result.rows[0].status, "WARN");
  assert.equal(result.rows[0].confidence, "LOW");
  assert.ok(result.rows[0].issues.some((entry) => entry.code === "RESIN_MATERIAL_CONFLICT"));
});

test("batch: per-city totals are internally consistent (invariant)", () => {
  const result = runBatchFromCsv(SAMPLE_BATCH_CSV + "\nExtra,,greasy-pizza-box,,greasy\nJunk,,nope,,\n");
  for (const city of Object.values(result.cities)) {
    const streamTotal = Object.values(city.streamCounts).reduce((a, b) => a + b, 0);
    assert.equal(streamTotal, city.itemCount);
    assert.ok(city.maxRiskScore >= city.averageRiskScore);
  }
  assert.equal(result.totals.ok + result.totals.warnings + result.totals.errors, result.totals.rows);
});

test("batch: inspectBatch of zero rows is a valid empty result", () => {
  const result = inspectBatch([]);
  assert.equal(result.totals.rows, 0);
  assert.equal(result.rows.length, 0);
});

/* ---------------- Exports ---------------- */

test("export: CSV has a fixed header, CRLF endings and one line per row", () => {
  const result = runBatchFromCsv(SAMPLE_BATCH_CSV);
  const csv = batchResultToCsv(result);
  const lines = csv.split("\r\n").filter(Boolean);
  assert.equal(lines[0], EXPORT_COLUMNS.map((c) => (typeof c === "string" ? c : c.key)).join(","));
  assert.equal(lines.length, result.rows.length + 1);
  assert.ok(!/(?<!\r)\n/.test(csv), "no bare LF line endings");
});

test("export: spreadsheet formula injection is neutralized in every exported cell", () => {
  const result = runBatchFromCsv('label,barcode,material\n"=HYPERLINK(""http://x"")",041220576463,\n+SUM(A1),,resin-5-pp\n@cmd,,resin-2-hdpe\n-2+3,,resin-1-pet\n');
  const csv = batchResultToCsv(result);
  for (const line of csv.split("\r\n").slice(1).filter(Boolean)) {
    const label = line.split(",")[1].replace(/^"/, "");
    assert.ok(!/^[=+@-]/.test(label), `label cell must not start with a formula trigger: ${label}`);
  }
});

test("export: CSV and JSON exports are byte-identical across runs (deterministic)", () => {
  const a = runBatchFromCsv(SAMPLE_BATCH_CSV);
  const b = runBatchFromCsv(SAMPLE_BATCH_CSV);
  assert.equal(batchResultToCsv(a), batchResultToCsv(b));
  assert.equal(batchResultToJson(a), batchResultToJson(b));
  assert.equal(JSON.parse(batchResultToJson(a)).generatedOn, null, "no timestamp unless asked");
  assert.match(batchResultToJson(a, { generatedOn: "2026-11-15" }), /"generatedOn": "2026-11-15"/);
});

/* ---------------- Ground truth integrity ---------------- */

test("ground truth: every anchor holds in the bundled municipal snapshot", () => {
  assert.deepEqual(verifyGroundTruthAnchors(snapshot), []);
});

test("ground truth: a tampered snapshot is caught (anti-drift regression)", () => {
  const tampered = structuredClone(snapshot);
  tampered.jurisdictions["houston-tx"].curbsideCartRules.acceptedResins = [1, 2];
  tampered.jurisdictions["sugar-land-tx"].curbsideCartRules.plasticBagsAllowedInCart = true;
  const broken = verifyGroundTruthAnchors(tampered);
  assert.ok(broken.some((b) => b.city === "houston-tx" && b.anchor.value === 5));
  assert.ok(broken.some((b) => b.city === "sugar-land-tx" && b.anchor.path.endsWith("plasticBagsAllowedInCart")));
});

test("ground truth: anchor operators behave as documented", () => {
  const city = { a: { list: [1, 2], text: "Return to Store Drop-Off bins", arr: ["Foam blocks", "Paint"] } };
  assert.equal(checkAnchor(city, { path: "a.list", op: "includes", value: 2 }), true);
  assert.equal(checkAnchor(city, { path: "a.list", op: "includes", value: 3 }), false);
  assert.equal(checkAnchor(city, { path: "a.text", op: "matches", value: "store drop-off" }), true);
  assert.equal(checkAnchor(city, { path: "a.arr", op: "anyMatches", value: "foam" }), true);
  assert.equal(checkAnchor(city, { path: "a.arr", op: "noneMatch", value: "battery" }), true);
  assert.equal(checkAnchor(city, { path: "a.missing", op: "equals", value: 1 }), false);
});

test("ground truth: case ids are unique and every expectation names a real city with anchors", () => {
  const ids = [...GROUND_TRUTH_CASES, ...KNOWN_GAP_CASES].map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const c of [...GROUND_TRUTH_CASES, ...KNOWN_GAP_CASES]) {
    const cities = Object.keys(c.expect);
    assert.ok(cities.length >= 1, c.id);
    for (const city of cities) {
      assert.ok(["sugar-land-tx", "houston-tx"].includes(city), `${c.id} ${city}`);
      assert.ok(c.expect[city].anchors.length >= 1, `${c.id} ${city} is anchored to the snapshot`);
    }
  }
});

test("ground truth: external barcode vectors match the engine's verdicts", () => {
  for (const vector of EXTERNAL_BARCODE_VECTORS) {
    assert.equal(validateBarcodeCheckDigit(vector.code).valid, vector.valid, vector.code || "(empty)");
  }
});

test("ground truth: inferred split notes describe the former gap and the current disposal rule", () => {
  for (const entry of KNOWN_GAP_CASES) {
    assert.equal(entry.inferred, true);
    assert.match(entry.note, /previously kept/);
    assert.match(entry.note, /now infers/);
    assert.match(entry.note, /recycle the clean part and trash the soiled part/);
    for (const city of Object.keys(entry.expect)) {
      assert.equal(evaluateItemDisposal({ ...entry.query, city }).stream, "SPLIT_DISPOSAL");
    }
  }
});

/* ---------------- Benchmark ---------------- */

test("benchmark: zero scored failures, confusion matrix sums to the evaluation count", () => {
  const r = runBenchmark({ now: clock() });
  assert.equal(r.failures.length, 0);
  assert.equal(r.cart.tp + r.cart.fp + r.cart.fn + r.cart.tn, r.meta.scoredEvaluations);
  const streamTotal = Object.values(r.stream.matrix).flatMap((row) => Object.values(row)).reduce((a, b) => a + b, 0);
  assert.equal(streamTotal, r.stream.scored);
  const tierTotal = r.tiers.reduce((a, row) => a + row.total, 0);
  assert.equal(tierTotal, r.meta.scoredEvaluations);
});

test("benchmark: risk tiers are perfectly separated (Low and Moderate curbside, High and Critical not)", () => {
  const r = runBenchmark({ now: clock() });
  for (const row of r.tiers) {
    if (row.tier === "LOW" || row.tier === "MODERATE") assert.equal(row.cartFalse, 0, row.tier);
    else assert.equal(row.cartTrue, 0, row.tier);
  }
});

test("benchmark: GS1 catches every single-digit substitution and only misses gap-of-five transpositions", () => {
  const { barcode } = runBenchmark({ now: clock() });
  assert.equal(barcode.substitutions.tried, VERIFIED_BARCODE_CATALOG.reduce((n, item) => n + item.upc.length * 9, 0));
  assert.equal(barcode.substitutions.detected, barcode.substitutions.tried);
  assert.equal(barcode.transpositions.undetected, barcode.transpositions.undetectedExplainedByDigitGapOfFive);
  assert.equal(barcode.confusion.fp + barcode.confusion.fn, 0);
});

test("benchmark: the inferred grease-soaked cardboard extension is handled and kept out of headline numbers", () => {
  const r = runBenchmark({ now: clock() });
  assert.equal(r.knownGaps.length, 2);
  assert.ok(r.knownGaps.every((g) => g.inferred && !g.stillOpen));
  assert.ok(!r.meta.scoredCases || ![...GROUND_TRUTH_CASES].some((c) => c.id === "gap-greasy-cardboard"));
});

test("benchmark: a deliberately wrong engine answer is reported as a failure (planted defect)", () => {
  const wrong = [{ ...GROUND_TRUTH_CASES[0], id: "planted", expect: { "sugar-land-tx": { cart: false, stream: "TRASH_CART", anchors: [] } } }];
  const r = runBenchmark({ now: clock(), cases: wrong, includeCatalog: false });
  assert.equal(r.cart.fp, 1);
  assert.ok(r.failures.some((f) => f.caseId === "planted" && f.field === "cart"));
  assert.ok(r.failures.some((f) => f.caseId === "planted" && f.field === "stream"));
  assert.equal(r.falsePositives[0].caseId, "planted");
});

test("benchmark: catalog expansion only scores items whose material is anchored", () => {
  const { cases, unanchored } = buildCatalogCases();
  assert.equal(cases.length + unanchored.length, VERIFIED_BARCODE_CATALOG.length);
  for (const c of cases) {
    const ev = evaluateItemDisposal({ ...c.query, city: "houston-tx" });
    assert.ok(ev.matchedProduct, `${c.id} resolves through its barcode`);
  }
});

test("benchmark: JSON report is deterministic and excludes latency unless requested", () => {
  const a = benchmarkToJson(runBenchmark({ now: clock() }));
  const b = benchmarkToJson(runBenchmark({ now: clock() }));
  assert.equal(a, b);
  assert.ok(!a.includes('"latency"'));
  assert.ok(benchmarkToJson(runBenchmark({ now: clock() }), { includeLatency: true }).includes('"latency"'));
});

test("benchmark: text report states its scope and lists inferred extensions", () => {
  const text = benchmarkToText(runBenchmark({ now: clock() }), { includeLatency: true });
  assert.match(text, /not field accuracy/);
  assert.match(text, /Inferred rule extensions \(scored separately\): 2 handled, 0 open/);
  assert.match(text, /Single-digit substitutions detected: (\d+)\/\1 \(100\.0%\)/);
  assert.match(text, /Latency over \d+ evaluations/);
});

test("benchmark: percentile uses nearest rank and handles empty input", () => {
  assert.equal(percentile([], 50), null);
  assert.equal(percentile([1, 2, 3, 4], 50), 2);
  assert.equal(percentile([1, 2, 3, 4], 100), 4);
  assert.equal(percentile([7], 95), 7);
});

test("cli: run-benchmark exits 0, and --json output parses with no latency", () => {
  let out = "";
  let err = "";
  const io = { out: (t) => (out += t), err: (t) => (err += t) };
  assert.equal(runCli([], io), 0);
  assert.match(out, /BinCheck calibration benchmark/);
  out = "";
  assert.equal(runCli(["--json"], io), 0);
  const parsed = JSON.parse(out);
  assert.equal(parsed.failures.length, 0);
  assert.equal(parsed.latency, undefined);
  assert.equal(err, "");
});

test("benchmark: JSON rates are rounded to four decimals at every depth, and the text explains every missed swap", () => {
  const result = runBenchmark({ now: clock() });
  const parsed = JSON.parse(benchmarkToJson(result));
  assert.equal(parsed.barcode.transpositions.detectionRate, Math.round(result.barcode.transpositions.detectionRate * 10000) / 10000);
  assert.notEqual(parsed.barcode.transpositions.detectionRate, result.barcode.transpositions.detectionRate, "raw rate has more digits");
  const decimals = (n) => (String(n).split(".")[1] || "").length;
  const walk = (node) => {
    if (typeof node === "number") assert.ok(decimals(node) <= 4, String(node));
    else if (node && typeof node === "object") Object.values(node).forEach(walk);
  };
  walk(parsed);
  assert.match(benchmarkToText(result), /every miss swaps digits that differ by 5/);
});
