import test from "node:test";
import assert from "node:assert/strict";
import {
  parseCsv,
  parseBatchCsv,
  parseBatchBytes,
  inspectBatch,
  runBatchFromCsv,
  runBatchFromBytes,
  decodeBatchBytes,
  scanUtf8,
  assessCsvText,
  batchResultToCsv,
  batchResultToJson,
  SAMPLE_BATCH_CSV,
  BATCH_LIMITS,
  CSV_COLUMNS
} from "../js/bincheck-batch.js";
import { decodeShareHash, encodeShareHash } from "../js/bincheck-validate.js";
import {
  validateBarcodeCheckDigit,
  computeUpcCheckDigit,
  VERIFIED_BARCODE_CATALOG
} from "../src/bincheck-engine.js";

const enc = new TextEncoder();

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function utf16Bytes(text, littleEndian, bom) {
  const out = [];
  if (bom === "le") out.push(0xff, 0xfe);
  if (bom === "be") out.push(0xfe, 0xff);
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (littleEndian) out.push(code & 0xff, code >> 8);
    else out.push(code >> 8, code & 0xff);
  }
  return new Uint8Array(out);
}

/** A structurally complete minimal GIF: signature, screen descriptor, color table, blocks, trailer. */
function gifBytes(version = "89a") {
  return new Uint8Array([
    ...enc.encode(`GIF${version}`),
    0x01, 0x00, 0x01, 0x00, // 1x1 logical screen descriptor
    0x80, 0x00, 0x00, // global color table flag set, background, aspect ratio
    0x00, 0x00, 0x00, 0xff, 0xff, 0xff, // two-entry global color table
    0x21, 0xf9, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, // graphic control extension
    0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, // image descriptor
    0x02, 0x02, 0x44, 0x01, 0x00, // image data sub-block
    0x3b // trailer
  ]);
}

const KNOWN_ISSUE_CODES = new Set([
  "INVALID_CITY", "BARCODE_INVALID", "UNKNOWN_MATERIAL", "INVALID_RESIN",
  "UNKNOWN_CONDITION", "HASH_TOO_LONG", "HASH_BAD_ENCODING", "HASH_TOO_COMPLEX"
]);

/* ---------------- Binary container signatures ---------------- */

test("bytes: every known container signature is refused by name at offset 0", () => {
  const cases = [
    [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0], "PNG image"],
    [[0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0], "JPEG image"],
    [[...gifBytes("89a")], "GIF image"],
    [[...gifBytes("87a")], "GIF image"],
    [[0x50, 0x4b, 0x03, 0x04, 0x14, 0, 0, 0], "ZIP archive"],
    [[0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37], "PDF document"],
    [[0x1f, 0x8b, 0x08, 0x00, 0, 0, 0, 0], "gzip-compressed file"],
    [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0], "legacy Office document"],
    [[0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0, 0], "7z archive"],
    [[0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00, 0], "RAR archive"],
    [[...enc.encode("SQLite format 3"), 0, 0, 0, 0], "SQLite database"]
  ];
  for (const [bytes, name] of cases) {
    const decoded = decodeBatchBytes(new Uint8Array(bytes));
    assert.equal(decoded.ok, false, name);
    assert.equal(decoded.errors[0].code, "BINARY_INPUT", name);
    assert.equal(decoded.errors[0].offset, 0, name);
    assert.ok(decoded.errors[0].message.includes(name), `${name}: ${decoded.errors[0].message}`);
  }
});

test("bytes: RIFF is only flagged when a real form type follows the header", () => {
  for (const form of ["WAVE", "WEBP", "AVI "]) {
    const bytes = new Uint8Array([...enc.encode(`RIFF`), 0x10, 0, 0, 0, ...enc.encode(form), 0, 0, 0, 0]);
    const decoded = decodeBatchBytes(bytes);
    assert.equal(decoded.errors[0].code, "BINARY_INPUT", form);
    assert.ok(decoded.errors[0].message.includes("RIFF"), form);
  }
  const notRiff = decodeBatchBytes(enc.encode("RIFF,x,y,z\n1,2,3,4"));
  assert.equal(notRiff.ok, true, "a CSV row that starts with RIFF is still text");
});

test("bytes: a truncated signature shorter than the magic length is not a false positive", () => {
  assert.equal(decodeBatchBytes(new Uint8Array([0x89, 0x50])).errors[0].code, "INVALID_UTF8");
  assert.equal(decodeBatchBytes(new Uint8Array([0x89])).errors[0].code, "INVALID_UTF8");
  const pk = decodeBatchBytes(enc.encode("PK"));
  assert.equal(pk.ok, true, "the letters PK alone are text, not a ZIP header");
  assert.equal(pk.text, "PK");
});

test("bytes: a CSV that only starts with the letters GIF8 is text, never an image", () => {
  const csv = "GIF8-column,material\nAnything,resin-1-pet\n";
  const decoded = decodeBatchBytes(enc.encode(csv));
  assert.equal(decoded.ok, true, "GIF8-prefixed text decodes as UTF-8");
  assert.equal(decoded.encoding, "utf-8");
  const result = runBatchFromBytes(enc.encode(csv));
  assert.equal(result.totals.rows, 1, "the row is evaluated, not refused as an image");
  assert.equal(result.rows[0].input.material, "resin-1-pet");
});

test("bytes: even a header literally named GIF89a stays text without GIF structure", () => {
  for (const text of ["GIF89a,material\nAnything,resin-1-pet\n", "GIF87a", "GIF89a\nx\n"]) {
    const decoded = decodeBatchBytes(enc.encode(text));
    assert.equal(decoded.ok, true, `${JSON.stringify(text.slice(0, 20))} decodes as text`);
  }
  // Corrupted structure: signature is complete but the screen descriptor
  // does not continue into a real GIF block, so text still wins.
  const notGif = new Uint8Array([...enc.encode("GIF89a"), 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20]);
  assert.equal(decodeBatchBytes(notGif).ok, true);
});

test("bytes: a structurally complete GIF is still refused by name", () => {
  for (const version of ["89a", "87a"]) {
    const decoded = decodeBatchBytes(gifBytes(version));
    assert.equal(decoded.ok, false, version);
    assert.equal(decoded.errors[0].code, "BINARY_INPUT");
    assert.match(decoded.errors[0].message, /GIF image/);
  }
});

test("bytes: empty, null and non-byte inputs all resolve to EMPTY_INPUT", () => {
  for (const input of [new Uint8Array(0), new Uint8Array(0).buffer, [], null, undefined, "not-bytes"]) {
    const decoded = decodeBatchBytes(input);
    assert.equal(decoded.ok, false);
    assert.equal(decoded.errors[0].code, "EMPTY_INPUT");
  }
});

test("bytes: oversized files are refused before any decode work", () => {
  const decoded = decodeBatchBytes(new Uint8Array(BATCH_LIMITS.maxBytes + 1));
  assert.equal(decoded.ok, false);
  assert.equal(decoded.errors[0].code, "TOO_LARGE");
  const atLimit = decodeBatchBytes(new Uint8Array(BATCH_LIMITS.maxBytes));
  assert.notEqual(atLimit.errors[0]?.code, "TOO_LARGE", "exactly the limit is accepted for decoding");
});

test("bytes: NUL bytes anywhere mark the file as binary with the first offset", () => {
  const decoded = decodeBatchBytes(new Uint8Array([0x61, 0x2c, 0x62, 0x0a, 0x63, 0x00, 0x64]));
  assert.equal(decoded.ok, false);
  assert.equal(decoded.errors[0].code, "BINARY_INPUT");
  assert.equal(decoded.errors[0].offset, 5);
  assert.match(decoded.errors[0].message, /NUL byte/);
});

test("bytes: UTF-32 byte order marks are named instead of decoded as UTF-16", () => {
  for (const bom of [[0xff, 0xfe, 0x00, 0x00], [0x00, 0x00, 0xfe, 0xff]]) {
    const bytes = new Uint8Array([...bom, 0x61, 0, 0, 0]);
    const decoded = decodeBatchBytes(bytes);
    assert.equal(decoded.ok, false);
    assert.equal(decoded.errors[0].code, "UTF32_INPUT");
    assert.match(decoded.errors[0].message, /UTF-32/);
  }
});

/* ---------------- Strict UTF-8 scanner ---------------- */

test("utf8: plain ASCII and every legal multi-byte form scan clean", () => {
  assert.deepEqual(scanUtf8(new Uint8Array(0)), { valid: true, offset: 0 });
  const ascii = enc.encode("label,barcode\nSpring water,041220576463");
  assert.deepEqual(scanUtf8(ascii), { valid: true, offset: ascii.length });
  const text = enc.encode("a,é,漢,𐍈");
  const scan = scanUtf8(text);
  assert.equal(scan.valid, true);
  assert.equal(scan.offset, text.length);
});

test("utf8: a stray continuation byte is flagged at its own offset", () => {
  const scan = scanUtf8(new Uint8Array([0x61, 0x80, 0x62]));
  assert.equal(scan.valid, false);
  assert.equal(scan.offset, 1);
  assert.equal(scan.byte, 0x80);
  assert.equal(scan.code, "STRAY_CONTINUATION");
});

test("utf8: overlong encodings are rejected at both the lead and the restricted byte", () => {
  const c0 = scanUtf8(new Uint8Array([0xc0, 0x80]));
  assert.equal(c0.code, "OVERLONG_ENCODING");
  assert.equal(c0.offset, 0);
  const e0 = scanUtf8(new Uint8Array([0xe0, 0x80, 0x80]));
  assert.equal(e0.code, "OVERLONG_ENCODING");
  assert.equal(e0.offset, 1);
  const f0 = scanUtf8(new Uint8Array([0xf0, 0x80, 0x80, 0x80]));
  assert.equal(f0.code, "OVERLONG_ENCODING");
});

test("utf8: a sequence cut off at end of file reports the lead byte offset", () => {
  const scan = scanUtf8(new Uint8Array([0x61, 0x62, 0xc3]));
  assert.equal(scan.valid, false);
  assert.equal(scan.code, "TRUNCATED_SEQUENCE");
  assert.equal(scan.offset, 2);
});

test("utf8: UTF-16 surrogate halves and out-of-range code points are rejected", () => {
  const surrogate = scanUtf8(new Uint8Array([0xed, 0xa0, 0x80]));
  assert.equal(surrogate.code, "SURROGATE_CODE_POINT");
  assert.equal(surrogate.offset, 1);
  const tooHigh = scanUtf8(new Uint8Array([0xf4, 0x90, 0x80, 0x80]));
  assert.equal(tooHigh.code, "OUT_OF_RANGE");
  const badLead = scanUtf8(new Uint8Array([0xf5, 0x80, 0x80, 0x80]));
  assert.equal(badLead.code, "INVALID_LEAD_BYTE");
});

test("utf8: a wrong middle continuation reports its exact offset", () => {
  const scan = scanUtf8(new Uint8Array([0x61, 0xe2, 0x82, 0x41, 0x62]));
  assert.equal(scan.valid, false);
  assert.equal(scan.code, "BAD_CONTINUATION");
  assert.equal(scan.offset, 3);
  assert.equal(scan.byte, 0x41);
});

test("utf8: decode errors surface byte offset, hex byte and reason in the message", () => {
  const decoded = decodeBatchBytes(new Uint8Array([0x61, 0x2c, 0x62, 0xff, 0x63]));
  assert.equal(decoded.ok, false);
  const err = decoded.errors[0];
  assert.equal(err.code, "INVALID_UTF8");
  assert.equal(err.offset, 3);
  assert.equal(err.byte, 0xff);
  assert.equal(err.reason, "INVALID_LEAD_BYTE");
  assert.match(err.message, /Byte 3 \(0xFF\)/);
});

/* ---------------- UTF-16 detection and decoding ---------------- */

test("utf16: BOM-marked little and big endian files decode to identical text", () => {
  const csv = "label,barcode\nBottle,041220576463\n";
  for (const [bytes, encoding] of [
    [utf16Bytes(csv, true, "le"), "utf-16le"],
    [utf16Bytes(csv, false, "be"), "utf-16be"]
  ]) {
    const decoded = decodeBatchBytes(bytes);
    assert.equal(decoded.ok, true, encoding);
    assert.equal(decoded.encoding, encoding);
    assert.equal(decoded.text, csv);
    assert.ok(!decoded.text.startsWith("\uFEFF"), "BOM is consumed");
  }
});

test("utf16: BOM-less UTF-16 is detected from the interleaved NUL pattern", () => {
  const csv = "label,barcode,material\nBottle,041220576463,resin-1-pet\nCan,049000006346,aluminum-steel-can\n";
  const le = decodeBatchBytes(utf16Bytes(csv, true, null));
  assert.equal(le.ok, true);
  assert.equal(le.encoding, "utf-16le");
  const be = decodeBatchBytes(utf16Bytes(csv, false, null));
  assert.equal(be.ok, true);
  assert.equal(be.encoding, "utf-16be");
});

test("utf16: a broken surrogate pair or odd byte count is a named diagnostic", () => {
  const odd = decodeBatchBytes(new Uint8Array([0xff, 0xfe, 0x61, 0x00, 0x62]));
  assert.equal(odd.ok, false);
  assert.equal(odd.errors[0].code, "INVALID_UTF16");
  const loneSurrogate = decodeBatchBytes(new Uint8Array([0xff, 0xfe, 0x61, 0x00, 0x00, 0xd8, 0x62, 0x00]));
  assert.equal(loneSurrogate.ok, false);
  assert.equal(loneSurrogate.errors[0].code, "INVALID_UTF16");
});

test("utf16: a decoded file flows through parsing, inspection and stable totals", () => {
  const bytes = utf16Bytes("label,barcode\nBottle,041220576463\nCan,049000006346\n", true, "le");
  const result = runBatchFromBytes(bytes);
  assert.equal(result.parse.encoding, "utf-16le");
  assert.equal(result.totals.rows, 2);
  assert.equal(result.totals.evaluated, 2);
  assert.equal(result.decodedText.startsWith("label,barcode"), true);
});

/* ---------------- Text-level binary detection ---------------- */

test("text: NUL characters in pasted input reject the whole input by name", () => {
  for (const text of ["a\u0000b,c", "\u0000", "label\u0000,barcode\nx,041220576463"]) {
    const parsed = parseBatchCsv(text);
    assert.equal(parsed.rows.length, 0);
    assert.equal(parsed.errors[0].code, "BINARY_LIKE_INPUT");
    assert.match(parsed.errors[0].message, /NUL/);
  }
});

test("text: dense non-text control characters reject as binary-like", () => {
  const dense = parseBatchCsv("a\u0001\u0002\u0003b,c\n041220576463,,,,x");
  assert.equal(dense.errors[0].code, "BINARY_LIKE_INPUT");
  assert.equal(dense.rows.length, 0);
});

test("text: a single stray control character parses with a named warning", () => {
  const parsed = parseBatchCsv("label,barcode,material\nA long padded label \u0001 here,041220576463,resin-1-pet");
  assert.equal(parsed.rows.length, 1);
  assert.ok(parsed.errors.some((entry) => entry.code === "UNUSUAL_CHARACTERS"));
});

test("text: three or more U+FFFD replacement characters mark a lossy decode", () => {
  const parsed = parseBatchCsv("label,barcode\nx\uFFFD\uFFFD\uFFFD,041220576463");
  assert.equal(parsed.errors[0].code, "BINARY_LIKE_INPUT");
  const light = parseBatchCsv("label,barcode\nx\uFFFD,041220576463");
  assert.equal(light.rows.length, 1);
  assert.ok(light.errors.some((entry) => entry.code === "UNUSUAL_CHARACTERS"));
});

test("text: assessCsvText counts each suspicious class independently", () => {
  const clean = assessCsvText("a,b\nc,d");
  assert.equal(clean.ok, true);
  assert.deepEqual(clean.warnings, []);
  assert.equal(assessCsvText("a\u0000b").ok, false);
  assert.equal(assessCsvText("a\u0001\u0002\u0003").ok, false);
  assert.equal(assessCsvText("\uFFFD\uFFFD\uFFFD").ok, false);
  const warning = assessCsvText(`${"x".repeat(60)}\u0001`);
  assert.equal(warning.ok, true);
  assert.equal(warning.warnings.length, 1);
});

/* ---------------- CSV grammar edge cases ---------------- */

test("csv edge: a bare quote, a closed empty quote and a literal mid-field quote", () => {
  assert.equal(parseCsv('"').errors[0].code, "CSV_UNTERMINATED_QUOTE");
  const empty = parseCsv('""');
  assert.deepEqual(empty.records, [], "one empty quoted cell is a blank row");
  assert.deepEqual(empty.errors, []);
  const mid = parseCsv('a"b"c,d');
  assert.deepEqual(mid.records[0].cells, ['a"b"c', "d"]);
  assert.deepEqual(mid.errors, []);
  const escaped = parseCsv('""""');
  assert.deepEqual(escaped.records[0].cells, ['"']);
});

test("csv edge: whitespace before a quote still opens the quoted field", () => {
  const { records } = parseCsv('   "x,y",z');
  assert.deepEqual(records[0].cells, ["x,y", "z"]);
});

test("csv edge: comment rows need the mark in cell one, unquoted", () => {
  const { records } = parseCsv('#skip me\n"quoted # stays",1\nmid,#cell\nlast,2');
  assert.equal(records.length, 3);
  assert.deepEqual(records[0].cells, ["quoted # stays", "1"]);
  assert.deepEqual(records[1].cells, ["mid", "#cell"]);
});

test("csv edge: line endings of every kind split records identically", () => {
  for (const eol of ["\n", "\r", "\r\n"]) {
    const { records, errors } = parseCsv(`a,b${eol}c,d${eol}`);
    assert.equal(records.length, 2);
    assert.deepEqual(records[0].cells, ["a", "b"]);
    assert.deepEqual(records[1].cells, ["c", "d"]);
    assert.deepEqual(errors, []);
  }
  const mixed = parseCsv("a,b\rc,d\ne,f\r\ng,h");
  assert.equal(mixed.records.length, 4);
});

test("csv edge: a final record without a trailing newline still closes", () => {
  const { records } = parseCsv("a,b\nc,d");
  assert.equal(records.length, 2);
  assert.equal(records[1].line, 2);
});

test("csv edge: blank and whitespace-only lines never become records", () => {
  const { records } = parseCsv("\n\n   \n\t\na,b\n,\n,,\nlast,1\n");
  assert.equal(records.length, 2);
  assert.deepEqual(records[0].cells, ["a", "b"]);
  assert.deepEqual(records[1].cells, ["last", "1"]);
});

test("csv edge: trailing commas keep their empty cells and extra columns are counted", () => {
  const { records } = parseCsv("a,b,\nc,,d,e,f");
  assert.deepEqual(records[0].cells, ["a", "b", ""]);
  assert.deepEqual(records[1].cells, ["c", "", "d", "e", "f"]);
});

test("csv edge: a byte order mark only acts at position zero", () => {
  const { records } = parseCsv("a\nx\uFEFFb");
  assert.equal(records.length, 2);
  assert.equal(records[1].cells[0], "x\uFEFFb", "an interior mark is kept as cell data");
  const cellStart = parseCsv("a\n\uFEFFb");
  assert.equal(cellStart.records[1].cells[0], "b", "a mark at a cell edge trims like whitespace");
  const leading = parseCsv("\uFEFFa,b");
  assert.deepEqual(leading.records[0].cells, ["a", "b"]);
});

test("csv edge: an oversized single field still parses inside the byte limit", () => {
  const parsed = parseBatchCsv(`label,barcode\nrow,${"x".repeat(60000)}`);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].barcode.length, 60000);
});

test("csv edge: characters after a closing quote reject the row instead of merging into it", () => {
  const { records, errors, skippedRows } = parseCsv('label,material\n"Sample"junk,resin-1-pet\n');
  assert.equal(records.length, 1, "only the clean header row survives");
  assert.equal(skippedRows, 1);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].code, "CSV_TRAILING_CHARS");
  assert.match(errors[0].message, /junk/);

  const parsed = parseBatchCsv('label,material\n"Sample"junk,resin-1-pet\n');
  assert.equal(parsed.rows.length, 0, "the malformed row is skipped, not evaluated");
  const result = runBatchFromCsv('label,material\n"Sample"junk,resin-1-pet\n');
  assert.equal(result.rows.length, 0, "no row ever reports OK from corrupted input");
  assert.ok(result.parse.errors.some((entry) => entry.code === "CSV_TRAILING_CHARS"));

  // Whitespace padding after a closing quote stays legal and is not kept.
  const padded = parseCsv('"a" ,b\n"x"\t,"y"\n"p", "q"');
  assert.deepEqual(padded.errors, []);
  assert.equal(padded.records.length, 3);
  assert.deepEqual(padded.records[0].cells, ["a", "b"]);
  assert.deepEqual(padded.records[2].cells, ["p", "q"]);

  // Clean rows after a skipped one still parse, and only one error is logged per row.
  const mixed = parseCsv('"bad"junk,1\n"good",2\n"alsogood",3');
  assert.equal(mixed.records.length, 2);
  assert.equal(mixed.records[0].cells[0], "good");
  assert.equal(mixed.errors.length, 1);
  assert.equal(mixed.skippedRows, 1);
});

/* ---------------- Header and row limits ---------------- */

test("batch: non-string and whitespace-only inputs fail with EMPTY_INPUT, never a throw", () => {
  for (const input of [null, undefined, 42, {}, [], "   ", "\n\n", "\t"]) {
    const parsed = parseBatchCsv(input);
    assert.equal(parsed.rows.length, 0);
    assert.equal(parsed.errors[0].code, "EMPTY_INPUT");
  }
});

test("batch: the byte cap is inclusive at the limit and exclusive past it", () => {
  const ok = parseBatchCsv("x".repeat(BATCH_LIMITS.maxBytes));
  assert.ok(!ok.errors.some((entry) => entry.code === "TOO_LARGE"));
  assert.equal(parseBatchCsv("x".repeat(BATCH_LIMITS.maxBytes + 1)).errors[0].code, "TOO_LARGE");
});

test("batch: header aliases tolerate punctuation and case noise", () => {
  const aliasCases = [
    ["Bar Code", "barcode"], ["BARCODE", "barcode"], ["GTIN", "barcode"], ["e-a-n", "barcode"],
    ["material_id", "material"], ["Material-ID", "material"], ["category", "material"],
    ["re.sin", "resin"], ["SPI", "resin"], ["resincode", "resin"],
    ["Condition", "condition"], ["state", "condition"],
    ["Item", "label"], ["name", "label"], ["description", "label"]
  ];
  for (const [alias, expected] of aliasCases) {
    const parsed = parseBatchCsv(`material,${alias}\nresin-1-pet,zzz\n`);
    assert.equal(parsed.hasHeader, true, alias);
    assert.equal(parsed.columns[1], expected, alias);
  }
  const unknown = parseBatchCsv("material,mystery\nresin-1-pet,zzz\n");
  assert.equal(unknown.columns[1], null);
  assert.ok(unknown.errors.some((entry) => entry.code === "UNKNOWN_COLUMN"));
});

test("batch: a header made only of label and condition columns is treated as data", () => {
  const parsed = parseBatchCsv("label,condition\nx,clean\n");
  assert.equal(parsed.hasHeader, false, "no identifier column means no header");
  assert.equal(parsed.rows.length, 2);
});

test("batch: duplicate canonical headers are rejected naming both columns", () => {
  const parsed = parseBatchCsv("material,category\nresin-6-ps-foam,resin-1-pet\n");
  assert.equal(parsed.rows.length, 0, "a colliding header rejects the file instead of overwriting values");
  const dup = parsed.errors.find((entry) => entry.code === "DUPLICATE_COLUMN");
  assert.ok(dup, "a DUPLICATE_COLUMN error is reported");
  assert.equal(dup.column, "material");
  assert.deepEqual(dup.headers, ["material", "category"]);
  assert.match(dup.message, /"material"/);
  assert.match(dup.message, /"category"/);

  const result = runBatchFromCsv("material,category\nresin-6-ps-foam,resin-1-pet\n");
  assert.equal(result.rows.length, 0, "no row is evaluated from an ambiguous mapping");
  assert.ok(result.parse.errors.some((entry) => entry.code === "DUPLICATE_COLUMN"));

  // The single-column form of the same row proves the verdict the silent
  // overwrite was hiding: PS foam, not PET, in both cities.
  const single = runBatchFromCsv("material\nresin-6-ps-foam\n");
  assert.equal(single.rows[0].cities["Riverside-tx"].stream, "SPECIAL_DROPOFF");
  assert.equal(single.rows[0].cities["houston-tx"].stream, "TRASH_CART");

  for (const text of [
    "barcode,gtin\n041220576463,041220948321\n",
    "Material,material_id\nresin-1-pet,resin-2-hdpe\n",
    "resin,SPI\n1,2\n",
    "barcode,material,name,item\n041220576463,resin-1-pet,Bottle,Can\n"
  ]) {
    const p = parseBatchCsv(text);
    assert.equal(p.rows.length, 0, text);
    assert.ok(p.errors.some((entry) => entry.code === "DUPLICATE_COLUMN"), text);
  }

  // Distinct columns with one unknown still parse with just the warning.
  const mixed = parseBatchCsv("material,mystery\nresin-1-pet,x\n");
  assert.equal(mixed.rows.length, 1);
  assert.ok(!mixed.errors.some((entry) => entry.code === "DUPLICATE_COLUMN"));
});

test("batch: a malformed first record fails closed instead of guessing positional columns", () => {
  const text = '"material"junk,label\nresin-6-ps-foam,resin-1-pet\n';
  const parsed = parseBatchCsv(text);
  assert.equal(parsed.rows.length, 0, "no row is evaluated from an ambiguous mapping");
  assert.equal(parsed.hasHeader, false);
  assert.ok(parsed.errors.some((entry) => entry.code === "CSV_TRAILING_CHARS"));
  const ambiguous = parsed.errors.find((entry) => entry.code === "AMBIGUOUS_COLUMN_MAPPING");
  assert.ok(ambiguous, "the refusal is a named parse error");
  assert.equal(ambiguous.line, 1);
  assert.equal(parsed.droppedRows, 2, "the unreadable row and the surviving row are both counted");

  const result = runBatchFromCsv(text);
  assert.equal(result.rows.length, 0);
  assert.equal(result.totals.evaluated, 0, "positional guessing never assigns a verdict");
  assert.ok(result.parse.errors.some((entry) => entry.code === "AMBIGUOUS_COLUMN_MAPPING"));

  // The same data under a readable header shows the verdict the guess hid.
  const control = runBatchFromCsv("material,label\nresin-6-ps-foam,resin-1-pet\n");
  assert.equal(control.rows[0].cities["Riverside-tx"].stream, "SPECIAL_DROPOFF");
  assert.equal(control.rows[0].cities["houston-tx"].stream, "TRASH_CART");
});

test("batch: a malformed first record before a readable header maps by name, and data-row recovery is unchanged", () => {
  const afterBad = parseBatchCsv('"junk"x\nmaterial,label\nresin-1-pet,Bottle\n');
  assert.equal(afterBad.hasHeader, true, "a clean known header still sets the mapping");
  assert.equal(afterBad.rows.length, 1);
  assert.equal(afterBad.rows[0].material, "resin-1-pet");
  assert.equal(afterBad.droppedRows, 1);
  assert.ok(!afterBad.errors.some((entry) => entry.code === "AMBIGUOUS_COLUMN_MAPPING"));

  const midFile = parseBatchCsv('material,label\n"x"junk,Bottle\nresin-1-pet,Bottle\n"y"more,Can\nresin-2-hdpe,Can\n');
  assert.equal(midFile.hasHeader, true);
  assert.equal(midFile.rows.length, 2, "malformed data rows under a known header are still skipped, not fatal");
  assert.equal(midFile.droppedRows, 2);
  assert.ok(!midFile.errors.some((entry) => entry.code === "AMBIGUOUS_COLUMN_MAPPING"));

  const headerless = parseBatchCsv('041220576463,resin-1-pet\n"x"junk,resin-2-hdpe\n041220948321,resin-2-hdpe\n');
  assert.equal(headerless.rows.length, 2, "a malformed row after a clean first record keeps positional recovery");
  assert.ok(!headerless.errors.some((entry) => entry.code === "AMBIGUOUS_COLUMN_MAPPING"));
});

test("batch: dropped rows are counted for truncation, malformed and unterminated input", () => {
  const cut = parseBatchCsv("label,material\nBottle,resin-1-pet\n\"Broken");
  assert.equal(cut.rows.length, 1);
  assert.equal(cut.droppedRows, 1, "the unterminated record is counted as dropped");
  assert.equal(cut.incompleteInput, true);
  assert.equal(cut.truncated, true, "the swallowed tail marks the input truncated");
  assert.equal(cut.truncatedByRowLimit, false);
  assert.ok(cut.errors.some((entry) => entry.code === "CSV_UNTERMINATED_QUOTE"));

  const over = parseBatchCsv(`barcode\n${Array.from({ length: BATCH_LIMITS.maxRows + 3 }, () => "041220576463").join("\n")}`);
  assert.equal(over.truncated, true);
  assert.equal(over.truncatedByRowLimit, true);
  assert.equal(over.incompleteInput, false);
  assert.equal(over.droppedRows, 3);

  const malformed = parseBatchCsv('label,material\n"x"junk,resin-1-pet\nBottle,resin-1-pet\n"y"more,resin-2-hdpe\n');
  assert.equal(malformed.rows.length, 1);
  assert.equal(malformed.droppedRows, 2);

  const rejected = parseBatchCsv("material,category\nresin-6-ps-foam,resin-1-pet\nresin-1-pet,resin-2-hdpe\n");
  assert.equal(rejected.droppedRows, 2, "rejected data rows are counted too");

  const clean = parseBatchCsv("label,material\nBottle,resin-1-pet\n");
  assert.equal(clean.droppedRows, 0);
  assert.equal(clean.truncated, false);
  assert.equal(clean.truncatedByRowLimit, false);
  assert.equal(clean.incompleteInput, false);
});

test("batch: extra cells past the known columns are dropped with a named error", () => {
  const parsed = parseBatchCsv("barcode,material\n041220576463,resin-1-pet,extra,more,still\n");
  assert.ok(parsed.errors.some((entry) => entry.code === "EXTRA_CELLS"));
  assert.equal(parsed.rows[0].barcode, "041220576463");
  assert.equal(parsed.rows[0].material, "resin-1-pet");
});

test("batch: exactly the row cap parses clean and one over it truncates", () => {
  const atLimit = parseBatchCsv(`barcode\n${Array.from({ length: BATCH_LIMITS.maxRows }, () => "041220576463").join("\n")}`);
  assert.equal(atLimit.rows.length, BATCH_LIMITS.maxRows);
  assert.equal(atLimit.truncated, false);
  const over = parseBatchCsv(`barcode\n${Array.from({ length: BATCH_LIMITS.maxRows + 1 }, () => "041220576463").join("\n")}`);
  assert.equal(over.rows.length, BATCH_LIMITS.maxRows);
  assert.equal(over.truncated, true);
});

test("batch: byte-path results expose encoding and decoded text", () => {
  const bytes = enc.encode("label,barcode\nBottle,041220576463\n");
  const parsed = parseBatchBytes(bytes);
  assert.equal(parsed.encoding, "utf-8");
  assert.equal(parsed.decodedText, "label,barcode\nBottle,041220576463\n");
  assert.equal(parsed.bytes, bytes.length);
  const bad = parseBatchBytes(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  assert.equal(bad.decodedText, null);
  assert.equal(bad.rows.length, 0);
});

/* ---------------- Share hash hardening ---------------- */

test("hash: more than 24 pairs is refused as too complex before any decoding", () => {
  const hash = `#${Array.from({ length: 25 }, (_, i) => `x${i}=1`).join("&")}`;
  const { patch, issues } = decodeShareHash(hash);
  assert.deepEqual(patch, {});
  assert.deepEqual(issues.map((entry) => entry.code), ["HASH_TOO_COMPLEX"]);
});

test("hash: exactly 24 pairs still decode and unknown keys stay silent", () => {
  const pairs = ["b=041220576463", "c=houston-tx", ...Array.from({ length: 22 }, (_, i) => `z${i}=1`)];
  const { patch, issues } = decodeShareHash(`#${pairs.join("&")}`);
  assert.equal(patch.barcode, "041220576463");
  assert.equal(patch.cityMode, "houston-tx");
  assert.deepEqual(issues, []);
});

test("hash: degenerate inputs and percent-edge cases never throw", () => {
  for (const hash of ["#", "&", "=", "#%", "#b=%", "#b=%2", "#b=%zz", "#b=%41", "#b=+", "########", "#b=====", "plain text", 0, false, { toString: () => "#b=1" }]) {
    const { patch, issues } = decodeShareHash(hash);
    assert.ok(patch && typeof patch === "object");
    assert.ok(Array.isArray(issues));
  }
  const badEncoding = decodeShareHash("#b=%E0%A4%A");
  assert.equal(badEncoding.issues[0].code, "HASH_BAD_ENCODING");
});

test("hash: decode fuzz keeps the patch inside its declared key space", () => {
  const rng = mulberry32(20261121);
  const alphabet = "#&=%?abc0123456789\u0000\u2014~+/";
  for (let i = 0; i < 250; i += 1) {
    const length = Math.floor(rng() * 60);
    let hash = "";
    for (let j = 0; j < length; j += 1) hash += alphabet[Math.floor(rng() * alphabet.length)];
    const { patch, issues } = decodeShareHash(hash);
    for (const key of Object.keys(patch)) {
      assert.ok(["cityMode", "barcode", "materialId", "resinCode", "condition"].includes(key), `unexpected key ${key} from ${hash}`);
    }
    for (const entry of issues) {
      assert.ok(KNOWN_ISSUE_CODES.has(entry.code), `unexpected code ${entry.code} from ${hash}`);
    }
  }
});

test("hash: encode then decode round-trips every seeded valid state", () => {
  const rng = mulberry32(777);
  const cities = ["Riverside-tx", "houston-tx", "compare"];
  const conditions = ["clean", "greasy", "liquid-full", "broken"];
  const materials = ["resin-1-pet", "resin-5-pp", "glass-jar-bottle", "lithium-household-battery", "yard-trimmings-brush"];
  for (let i = 0; i < 60; i += 1) {
    const state = {
      cityMode: cities[Math.floor(rng() * cities.length)],
      barcode: VERIFIED_BARCODE_CATALOG[Math.floor(rng() * VERIFIED_BARCODE_CATALOG.length)].upc,
      materialId: materials[Math.floor(rng() * materials.length)],
      resinCode: 1 + Math.floor(rng() * 7),
      condition: conditions[Math.floor(rng() * conditions.length)]
    };
    const { patch, issues } = decodeShareHash(encodeShareHash(state));
    assert.deepEqual(issues, []);
    assert.equal(patch.cityMode, state.cityMode);
    assert.equal(patch.barcode, state.barcode);
    assert.equal(patch.materialId, state.materialId);
    assert.equal(patch.resinCode, state.resinCode);
    assert.equal(patch.condition, state.condition);
  }
});

/* ---------------- Barcode and resin fuzz ---------------- */

test("barcode fuzz: seeded digit strings of every length never throw and always classify", () => {
  const rng = mulberry32(4242);
  const formats = new Set(["EMPTY", "NON_NUMERIC", "INVALID_LENGTH", "UPC-A", "EAN-13", "EAN-8"]);
  for (let i = 0; i < 200; i += 1) {
    const length = Math.floor(rng() * 21);
    let digits = "";
    for (let j = 0; j < length; j += 1) digits += String(Math.floor(rng() * 10));
    const result = validateBarcodeCheckDigit(digits);
    assert.ok(formats.has(result.format), `format ${result.format} for "${digits}"`);
    if (result.valid) {
      assert.ok([8, 12, 13].includes(digits.length));
      assert.equal(result.expectedCheckDigit, result.actualCheckDigit);
    }
  }
});

test("barcode property: flipping any single digit in a valid code invalidates it", () => {
  for (const item of VERIFIED_BARCODE_CATALOG) {
    for (let pos = 0; pos < item.upc.length; pos += 1) {
      const original = Number(item.upc[pos]);
      const mutated = `${item.upc.slice(0, pos)}${(original + 1) % 10}${item.upc.slice(pos + 1)}`;
      const check = validateBarcodeCheckDigit(mutated);
      assert.equal(check.valid, false, `${item.upc} mutated at ${pos} to ${mutated}`);
    }
  }
});

test("barcode property: constructed payloads always validate back", () => {
  const rng = mulberry32(9);
  for (let i = 0; i < 50; i += 1) {
    let payload = "";
    for (let j = 0; j < 11; j += 1) payload += String(Math.floor(rng() * 10));
    const check = computeUpcCheckDigit(payload);
    const check2 = validateBarcodeCheckDigit(`${payload}${check}`);
    assert.equal(check2.valid, true, `payload ${payload}${check}`);
    assert.equal(check2.actualCheckDigit, check);
  }
});

test("barcode: unicode digits, exotic whitespace and object inputs are handled", () => {
  assert.equal(validateBarcodeCheckDigit("٠٤١٢٢٠٥٧٦٤٦٣").format, "NON_NUMERIC", "Arabic-Indic digits");
  assert.equal(validateBarcodeCheckDigit("４１２２０５７６４６").format, "NON_NUMERIC", "full-width digits");
  assert.equal(validateBarcodeCheckDigit(" 041220576463 ").valid, true, "NBSP-padded code trims");
  assert.equal(validateBarcodeCheckDigit(41220576463).format, "INVALID_LENGTH", "numeric input loses the leading zero");
  assert.equal(validateBarcodeCheckDigit({ toString: () => "041220576463" }).valid, true);
  assert.equal(validateBarcodeCheckDigit(["041220576463"]).valid, true, "array coercion is deterministic");
  assert.equal(validateBarcodeCheckDigit(Symbol ? "041220576463" : null).valid, true);
});

test("barcode: an all-zero UPC-A passes its own check digit (documented edge)", () => {
  const check = validateBarcodeCheckDigit("000000000000");
  assert.equal(check.valid, true);
  assert.equal(check.expectedCheckDigit, 0);
});

/* ---------------- Batch inspection invariants ---------------- */

test("batch invariants: totals, row statuses and city cells stay consistent on fuzzed rows", () => {
  const rng = mulberry32(1357);
  const barcodes = ["041220576463", "041220576464", "12345678", "", "abc", "0".repeat(20)];
  const materials = ["resin-1-pet", "resin-7-other", "glass-jar-bottle", "nope", "", "constructor"];
  const resins = ["1", "7", "0", "x", "", "11"];
  const conditions = ["clean", "greasy", "liquid-full", "broken", "wet", ""];
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const lines = ["label,barcode,material,resin,condition"];
  for (let i = 0; i < 120; i += 1) {
    lines.push([`row${i}`, pick(barcodes), pick(materials), pick(resins), pick(conditions)].join(","));
  }
  const result = runBatchFromCsv(lines.join("\n"));
  const totals = result.totals;
  assert.equal(totals.ok + totals.warnings + totals.errors, result.rows.length);
  assert.equal(totals.evaluated, totals.ok + totals.warnings);
  for (const row of result.rows) {
    if (row.status === "ERROR") {
      assert.equal(row.cities, null, "an unidentifiable row never gets a guessed stream");
      assert.equal(row.confidence, "LOW");
    } else {
      assert.ok(row.cities["Riverside-tx"].stream);
      assert.ok(row.cities["houston-tx"].stream);
      assert.ok(["HIGH", "MEDIUM", "LOW"].includes(row.confidence));
    }
    for (const entry of row.issues) {
      assert.ok(["error", "warning", "info"].includes(entry.severity));
    }
  }
  for (const city of Object.values(result.cities)) {
    const streamTotal = Object.values(city.streamCounts).reduce((a, b) => a + b, 0);
    assert.equal(streamTotal, city.itemCount);
    assert.equal(city.cartEligible + city.notCartEligible, city.itemCount);
  }
});

test("batch invariants: identical input always gives byte-identical exports", () => {
  const text = `label,barcode,material\n"x,1",041220576463,\ny,041220948321,resin-2-hdpe\nz,,resin-7-other`;
  for (const run of [runBatchFromCsv, (input) => runBatchFromBytes(enc.encode(input))]) {
    const a = run(text);
    const b = run(text);
    assert.equal(batchResultToCsv(a), batchResultToCsv(b));
    assert.equal(batchResultToJson(a), batchResultToJson(b));
    assert.deepEqual(a.rows, b.rows);
  }
});

test("batch invariants: seeded CSV fuzz never throws and keeps error codes known", () => {
  const rng = mulberry32(5150);
  const cells = ["041220576463", "resin-1-pet", "1", "clean", "x", "", ",", '"q"', "#tag", "3", "greasy"];
  const knownParseCodes = new Set([
    "CSV_UNTERMINATED_QUOTE", "CSV_TRAILING_CHARS", "UNKNOWN_COLUMN", "DUPLICATE_COLUMN", "ROW_LIMIT", "EXTRA_CELLS",
    "NO_DATA_ROWS", "UNUSUAL_CHARACTERS", "BINARY_LIKE_INPUT", "AMBIGUOUS_COLUMN_MAPPING"
  ]);
  for (let i = 0; i < 120; i += 1) {
    const rows = 1 + Math.floor(rng() * 6);
    const lines = [];
    for (let r = 0; r < rows; r += 1) {
      const cellCount = 1 + Math.floor(rng() * 6);
      lines.push(Array.from({ length: cellCount }, () => cells[Math.floor(rng() * cells.length)]).join(","));
    }
    const text = lines.join(rng() < 0.5 ? "\n" : "\r\n");
    const parsed = parseBatchCsv(text);
    assert.ok(parsed.rows.length <= BATCH_LIMITS.maxRows);
    for (const entry of parsed.errors) {
      assert.ok(knownParseCodes.has(entry.code), `code ${entry.code} from ${JSON.stringify(text)}`);
      assert.ok(Number.isInteger(entry.line));
    }
    assert.ok(parsed.columns.every((column) => CSV_COLUMNS.includes(column)));
    assert.doesNotThrow(() => inspectBatch(parsed.rows));
  }
});
