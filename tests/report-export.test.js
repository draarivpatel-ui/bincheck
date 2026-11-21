import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createFakeDom } from "./fake-dom.js";
import { createApp } from "../src/app.js";
import { createInitialState, reduce, resolveShortcut, SHORTCUTS } from "../src/state.js";
import {
  buildInspectionReport,
  inspectionReportToCsv,
  inspectionReportToJson,
  INSPECTION_REPORT_SCHEMA,
  INSPECTION_REPORT_CSV_COLUMNS
} from "../js/bincheck-report.js";
import { BATCH_LIMITS, SAMPLE_BATCH_CSV, runBatchFromCsv, runBatchFromBytes, batchResultToJson } from "../js/bincheck-batch.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const appJs = fs.readFileSync(path.join(root, "src", "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

const CATALOG_UPC = "041220576463";

function utf16Bytes(text, bom = [0xff, 0xfe]) {
  const out = [...bom];
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    out.push(code & 0xff, code >> 8);
  }
  return new Uint8Array(out).buffer;
}

async function settle() {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
}

function boot(options = {}) {
  const dom = createFakeDom(html, options);
  const downloads = [];
  const app = createApp({
    document: dom.document,
    window: dom.window,
    deps: { download: (name, mime, text) => downloads.push({ name, mime, text }) }
  });
  return { dom, app, downloads, el: (id) => dom.byId.get(id) };
}

const action = (dom, name) => dom.all.find((el) => el.getAttribute("data-action") === name);

/* ---------------- buildInspectionReport ---------------- */

test("report: a catalog barcode query builds a complete audit record", () => {
  const report = buildInspectionReport({ barcode: CATALOG_UPC });
  assert.equal(report.schema, INSPECTION_REPORT_SCHEMA);
  assert.equal(report.tool, "BinCheck");
  assert.equal(report.generatedOn, null);
  assert.equal(report.input.barcode, CATALOG_UPC);
  assert.ok(report.rulesSnapshot.schemaVersion);
  assert.ok(report.item.title.length > 0);
  assert.ok(report.item.matchedProduct);
  assert.equal(report.item.matchedProduct.upc, CATALOG_UPC);
  assert.equal(report.barcode.format, "UPC-A");
  assert.equal(report.barcode.valid, true);
  assert.ok(/^\d{13}$/.test(report.barcode.ean13), "the normalized EAN-13 form is kept");
  for (const cityId of ["Riverside-tx", "houston-tx"]) {
    const city = report.cities[cityId];
    assert.ok(city.stream, cityId);
    assert.ok(city.badgeLabel, cityId);
    assert.ok(Number.isInteger(city.riskScore));
    assert.ok(city.prepSteps.length > 0, `${cityId} prep steps`);
    assert.ok(city.facility.name, `${cityId} facility`);
    assert.ok(city.citations.length > 0, `${cityId} cites a rule`);
    assert.ok(city.citations.every((cite) => cite.ruleId && cite.kind && cite.quote));
    assert.ok(city.sourceUrl.startsWith("https://"), `${cityId} provenance`);
  }
  assert.equal(typeof report.comparison.sameStream, "boolean");
  assert.ok(Number.isInteger(report.comparison.riskDelta));
});

test("report: a material-only query carries no barcode section and no product", () => {
  const report = buildInspectionReport({ materialId: "glass-jar-bottle", condition: "clean" });
  assert.equal(report.barcode, null);
  assert.equal(report.item.matchedProduct, null);
  assert.equal(report.item.materialId, "glass-jar-bottle");
  assert.ok(report.cities["Riverside-tx"].stream);
});

test("report: an empty query still produces an honest record with issues", () => {
  const report = buildInspectionReport({});
  assert.equal(report.schema, INSPECTION_REPORT_SCHEMA);
  assert.ok(report.identification.issues.length > 0, "unidentified input is documented, never guessed");
  assert.ok(report.identification.issues.every((entry) => entry.code && entry.severity && entry.message));
});

test("report: the same query always builds deep-identical output", () => {
  const query = { barcode: CATALOG_UPC, condition: "greasy" };
  const a = buildInspectionReport(query);
  const b = buildInspectionReport(structuredClone(query));
  assert.deepEqual(a, b);
  assert.equal(inspectionReportToJson(a), inspectionReportToJson(b));
  assert.equal(inspectionReportToCsv(a), inspectionReportToCsv(b));
});

test("report: hostile property names and junk inputs never throw", () => {
  for (const query of [
    { barcode: "constructor", materialId: "__proto__", resinCode: "toString", condition: "valueOf" },
    { barcode: "9".repeat(40), materialId: "nope", resinCode: 99, condition: "mystery" },
    { barcode: {}, materialId: ["x"], resinCode: {}, condition: null },
    null,
    42,
    "resin-1-pet"
  ]) {
    const report = buildInspectionReport(query ?? {});
    assert.equal(report.schema, INSPECTION_REPORT_SCHEMA);
    assert.ok(report.identification.basis);
  }
});

/* ---------------- JSON export ---------------- */

test("report json: deterministic, parseable, and free of clock fields by default", () => {
  const report = buildInspectionReport({ barcode: CATALOG_UPC });
  const json = inspectionReportToJson(report);
  assert.ok(json.endsWith("\n"));
  const parsed = JSON.parse(json);
  assert.equal(parsed.schema, INSPECTION_REPORT_SCHEMA);
  assert.equal(parsed.generatedOn, null);
  assert.deepEqual(Object.keys(parsed.cities).sort(), ["houston-tx", "Riverside-tx"]);
  assert.equal(inspectionReportToJson(report), json);
});

test("report json: an explicit generatedOn is honored exactly", () => {
  const report = buildInspectionReport({ barcode: CATALOG_UPC });
  const json = inspectionReportToJson(report, { generatedOn: "2026-02-01" });
  assert.equal(JSON.parse(json).generatedOn, "2026-02-01");
});

/* ---------------- CSV export ---------------- */

test("report csv: fixed header, CRLF endings and a fixed row order", () => {
  const report = buildInspectionReport({ barcode: CATALOG_UPC });
  const csv = inspectionReportToCsv(report);
  assert.ok(csv.endsWith("\r\n"));
  assert.ok(!csv.includes("\n") || csv.split("\r\n").every((line) => !line.includes("\n") || line === ""));
  const lines = csv.split("\r\n");
  assert.equal(lines[0], INSPECTION_REPORT_CSV_COLUMNS.join(","));
  lines.pop();
  const sections = lines.slice(1).map((line) => line.split(",")[0]);
  const expected = [
    ...Array(3).fill("meta"),
    ...Array(4).fill("input"),
    ...Array(4).fill("identification"),
    ...Array(4).fill("barcode"),
    ...Array(3).fill("item"),
    ...Array(8).fill("result"),
    ...Array(3).fill("compare")
  ];
  assert.deepEqual(sections, expected);
});

test("report csv: a material-only report omits the barcode and product rows", () => {
  const csv = inspectionReportToCsv(buildInspectionReport({ materialId: "resin-1-pet" }));
  const lines = csv.trim().split("\r\n");
  assert.equal(lines.length, 25, `expected 1 header + 24 rows, got ${lines.length}`);
  assert.ok(!csv.includes("barcode,format"));
});

test("report csv: cells with commas, quotes and formula prefixes stay safe", () => {
  const report = buildInspectionReport({ barcode: CATALOG_UPC });
  const poisoned = {
    ...report,
    input: { ...report.input, barcode: "=2+2+cmd|' /C calc'!A0", condition: 'x"y' }
  };
  const csv = inspectionReportToCsv(poisoned);
  const barcodeLine = csv.split("\r\n").find((line) => line.startsWith("input,barcode,"));
  assert.ok(barcodeLine.includes("'="), `formula cell is quoted-safe: ${barcodeLine}`);
  const conditionLine = csv.split("\r\n").find((line) => line.startsWith("input,condition,"));
  assert.ok(conditionLine.includes('"x""y"'), `inner quote is doubled: ${conditionLine}`);
  const facilityLine = csv.split("\r\n").find((line) => line.startsWith("result,facility,"));
  assert.ok(facilityLine.includes('"'), `facility address with commas is quoted: ${facilityLine}`);
});

test("report csv: repeated exports are byte-identical", () => {
  const report = buildInspectionReport({ barcode: CATALOG_UPC });
  assert.equal(inspectionReportToCsv(report), inspectionReportToCsv(report));
});

/* ---------------- batch JSON parse diagnostics ---------------- */

test("batch json: parse errors, byte diagnostics, truncation and dropped rows are exported", () => {
  const result = runBatchFromCsv("label,material\nBottle,resin-1-pet\n\"Broken");
  assert.equal(result.rows.length, 1);
  const payload = JSON.parse(batchResultToJson(result));
  assert.equal(payload.parse.encoding, "utf-8");
  assert.equal(payload.parse.bytes, result.parse.bytes);
  assert.equal(payload.parse.hasHeader, true);
  assert.equal(payload.parse.truncated, false);
  assert.equal(payload.parse.droppedRows, 1, "the unterminated record is reported as dropped");
  assert.equal(payload.parse.errors.length, 1);
  assert.equal(payload.parse.errors[0].code, "CSV_UNTERMINATED_QUOTE");
  assert.equal(payload.rows.length, 1);

  const over = runBatchFromCsv(`barcode\n${Array.from({ length: BATCH_LIMITS.maxRows + 2 }, () => "041220576463").join("\n")}`);
  const overJson = JSON.parse(batchResultToJson(over));
  assert.equal(overJson.parse.truncated, true);
  assert.equal(overJson.parse.droppedRows, 2);
  assert.ok(overJson.parse.errors.some((entry) => entry.code === "ROW_LIMIT"));

  const utf16 = runBatchFromBytes(new Uint8Array(utf16Bytes("label,barcode\nBottle,041220576463\n")));
  const utf16Json = JSON.parse(batchResultToJson(utf16));
  assert.equal(utf16Json.parse.encoding, "utf-16le");
  assert.equal(utf16Json.parse.bytes > 0, true);
  assert.equal(utf16Json.parse.droppedRows, 0);

  // A rejected duplicate header also lands in the export diagnostics.
  const dup = runBatchFromCsv("material,category\nresin-6-ps-foam,resin-1-pet\n");
  const dupJson = JSON.parse(batchResultToJson(dup));
  assert.equal(dupJson.rows.length, 0);
  assert.equal(dupJson.parse.droppedRows, 1);
  assert.equal(dupJson.parse.errors.at(-1).code, "DUPLICATE_COLUMN");
});

test("batch json: diagnostics survive on results with no parse block and stay deterministic", () => {
  const clean = runBatchFromCsv(SAMPLE_BATCH_CSV);
  const a = batchResultToJson(clean);
  const b = batchResultToJson(clean);
  assert.equal(a, b);
  const payload = JSON.parse(a);
  assert.equal(payload.parse.errors.length, 0);
  assert.equal(payload.parse.truncated, false);
  assert.equal(payload.parse.droppedRows, 0);
});

/* ---------------- state: RUN_BATCH_FILE ---------------- */

test("state: UTF-8 file bytes inspect rows and update the textarea text", () => {
  const csv = "label,barcode\nBottle,041220576463\nCan,049000006346\n";
  const next = reduce(createInitialState({ csvText: "old" }), {
    type: "RUN_BATCH_FILE",
    bytes: new TextEncoder().encode(csv)
  });
  assert.equal(next.csvText, csv);
  assert.equal(next.batchResult.totals.rows, 2);
  assert.match(next.notice, /Inspected 2 rows/);
});

test("state: a UTF-16 file decodes, reports its encoding, and leaves clean text", () => {
  const csv = "label,barcode\nBottle,041220576463\n";
  const next = reduce(createInitialState(), {
    type: "RUN_BATCH_FILE",
    bytes: new Uint8Array(utf16Bytes(csv))
  });
  assert.equal(next.csvText, csv);
  assert.equal(next.batchResult.parse.encoding, "utf-16le");
  assert.match(next.notice, /UTF-16LE/);
});

test("state: a binary file is blocked by name and the previous text survives", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
  const before = createInitialState({ csvText: "label,barcode\nKeep me,041220576463\n" });
  const next = reduce(before, { type: "RUN_BATCH_FILE", bytes: png });
  assert.equal(next.csvText, before.csvText, "binary garbage never lands in the textarea");
  assert.equal(next.batchResult.totals.rows, 0);
  assert.equal(next.batchResult.parse.errors[0].code, "BINARY_INPUT");
  assert.match(next.notice, /PNG image/);
  const again = reduce(next, { type: "RUN_BATCH" });
  assert.equal(again.batchResult.totals.rows, 1, "the preserved text still runs cleanly");
});

test("state: an empty file and a corrupt UTF-16 file both fail without a throw", () => {
  const empty = reduce(createInitialState(), { type: "RUN_BATCH_FILE", bytes: new Uint8Array(0) });
  assert.match(empty.notice, /empty/i);
  const broken = reduce(createInitialState(), {
    type: "RUN_BATCH_FILE",
    bytes: new Uint8Array([0xff, 0xfe, 0x61, 0x00, 0x00, 0xd8])
  });
  assert.equal(broken.batchResult.parse.errors[0].code, "INVALID_UTF16");
  assert.match(broken.notice, /UTF-16/i);
});

test("state: every declared shortcut key resolves and none are duplicated", () => {
  const seen = new Set();
  for (const entry of SHORTCUTS) {
    assert.ok(!seen.has(entry.key), `duplicate key ${entry.key}`);
    seen.add(entry.key);
    const id = resolveShortcut({ key: entry.key, targetTag: "BODY" });
    assert.equal(id, entry.id, entry.key);
  }
  assert.equal(resolveShortcut({ key: "d", targetTag: "BODY" }), "download-report");
  assert.equal(resolveShortcut({ key: "d", targetTag: "INPUT" }), null, "typing guard");
  assert.equal(resolveShortcut({ key: "d", targetTag: "BODY", ctrlKey: true }), null, "modifier guard");
});

/* ---------------- app: report download + batch file paths ---------------- */

test("app: both report buttons download byte-stable reports", () => {
  const { dom, downloads } = boot();
  dom.click(action(dom, "export-report-json"));
  dom.click(action(dom, "export-report-csv"));
  assert.equal(downloads.length, 2);
  const [json, csv] = downloads;
  assert.equal(json.name, "bincheck-inspection-report.json");
  assert.equal(json.mime, "application/json");
  assert.equal(JSON.parse(json.text).schema, INSPECTION_REPORT_SCHEMA);
  assert.equal(csv.name, "bincheck-inspection-report.csv");
  assert.equal(csv.mime, "text/csv");
  assert.ok(csv.text.startsWith("section,field,sugar_land,houston"));
});

test("app: the D shortcut downloads the JSON report unless the user is typing", () => {
  const { dom, downloads, el } = boot();
  dom.key("d");
  assert.equal(downloads.length, 1);
  assert.equal(downloads[0].name, "bincheck-inspection-report.json");
  dom.key("d", el("barcode-input"));
  assert.equal(downloads.length, 1, "no download while typing in a field");
  dom.key("d", el("csv-input"));
  assert.equal(downloads.length, 1, "no download while typing in the CSV box");
});

test("app: Ctrl+Enter inside the CSV box runs the inspection", () => {
  const { dom, el } = boot();
  dom.input(el("csv-input"), "label,barcode\nBottle,041220576463\n");
  const event = dom.key("Enter", el("csv-input"), { ctrlKey: true });
  assert.equal(event.defaultPrevented, true);
  assert.match(el("csv-results").innerHTML, /041220576463|evaluated|Spring water/i);
  assert.match(el("status-live").textContent, /Inspected 1 rows/);
  const meta = dom.key("Enter", el("csv-input"), { metaKey: true });
  assert.equal(meta.defaultPrevented, true);
});

test("app: a PNG dropped on the file picker is refused by name and the textarea is untouched", async () => {
  const { dom, el } = boot();
  dom.input(el("csv-input"), "label,barcode\nKeep,041220576463\n");
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]).buffer;
  el("csv-file-input").files = [{ size: png.byteLength, arrayBuffer: async () => png }];
  dom.change(el("csv-file-input"));
  await settle();
  assert.match(el("status-live").textContent, /PNG image/);
  assert.equal(el("csv-input").value, "label,barcode\nKeep,041220576463\n");
  assert.match(el("csv-results").innerHTML, /Byte 0.*PNG image|PNG image.*Byte 0/s, "the structured byte diagnostic is rendered");
});

test("app: a valid CSV file through arrayBuffer runs and repopulates the textarea", async () => {
  const { dom, el } = boot();
  const csv = "label,barcode\nBottle,041220576463\n";
  const buf = new TextEncoder().encode(csv).buffer;
  el("csv-file-input").files = [{ size: buf.byteLength, arrayBuffer: async () => buf }];
  dom.change(el("csv-file-input"));
  await settle();
  assert.equal(el("csv-input").value, csv);
  assert.match(el("status-live").textContent, /Inspected 1 rows/);
});

test("app: a UTF-16 file through arrayBuffer is decoded and its encoding is named", async () => {
  const { dom, el } = boot();
  const buf = utf16Bytes("label,barcode\nBottle,041220576463\n");
  el("csv-file-input").files = [{ size: buf.byteLength, arrayBuffer: async () => buf }];
  dom.change(el("csv-file-input"));
  await settle();
  assert.match(el("status-live").textContent, /UTF-16LE/);
  assert.ok(el("csv-input").value.includes("041220576463"));
});

test("app: a legacy file with only text() still works, and a read failure is named", async () => {
  const { dom, el } = boot();
  const csv = "label,barcode\nCan,049000006346\n";
  el("csv-file-input").files = [{ size: csv.length, text: async () => csv }];
  dom.change(el("csv-file-input"));
  await settle();
  assert.match(el("status-live").textContent, /Inspected 1 rows/);

  el("csv-file-input").files = [{ size: 4, arrayBuffer: async () => { throw new Error("io"); }, text: async () => { throw new Error("io"); } }];
  dom.change(el("csv-file-input"));
  await settle();
  assert.match(el("status-live").textContent, /could not be read/);
});

test("app: an oversized file is refused by size before any read happens", async () => {
  const { dom, el } = boot();
  let reads = 0;
  el("csv-file-input").files = [{
    size: BATCH_LIMITS.maxBytes + 1,
    arrayBuffer: async () => { reads += 1; return new ArrayBuffer(8); },
    text: async () => { reads += 1; return "x"; }
  }];
  dom.change(el("csv-file-input"));
  await settle();
  assert.equal(reads, 0, "the file is never read past the limit");
  assert.match(el("status-live").textContent, /limit/);
});

/* ---------------- hygiene ---------------- */

test("hygiene: no smooth scrolling remains in shipped source", () => {
  for (const [name, text] of [["index.html", html], ["styles.css", css], ["src/app.js", appJs]]) {
    assert.ok(!/scroll-behavior:\s*smooth/.test(text), `${name} scroll-behavior`);
    assert.ok(!/behavior:\s*"smooth"/.test(text), `${name} scrollIntoView`);
  }
});

test("hygiene: every keyboard shortcut is exposed through aria-keyshortcuts", () => {
  for (const [id, shortcut] of [
    ["export-report-json-btn", "d"],
    ["barcode-input", "/"],
    ["csv-input", "b"],
    ["csv-run-btn", "Control+Enter"],
    ["print-report-btn", "p"],
    ["benchmark-run-btn", "r"],
    ["add-to-batch-btn", "a"],
    ["shortcut-help-btn", "?"]
  ]) {
    const tag = html.match(new RegExp(`<[^>]*id="${id}"[^>]*>`));
    assert.ok(tag, `${id} exists`);
    assert.match(tag[0], new RegExp(`aria-keyshortcuts="${shortcut.replace(/\?/g, "\\?").replace(/\//g, "\\/").replace(/\+/g, "\\+")}"`), `${id} aria-keyshortcuts`);
  }
  for (const mode of ["Riverside-tx", "houston-tx", "compare"]) {
    const tag = html.match(new RegExp(`<button[^>]*data-city-mode="${mode}"[^>]*>`));
    assert.ok(/aria-keyshortcuts/.test(tag[0]), `${mode} button has a declared shortcut`);
  }
});
