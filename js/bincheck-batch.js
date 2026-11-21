/**
 * BinCheck batch inspection: raw byte sniffing, strict UTF-8 and UTF-16
 * decoding, CSV parsing, per-row evaluation across both jurisdictions,
 * aggregate load scoring, and deterministic exports.
 *
 * Pure and deterministic. No DOM, no clock, no network. The same input text
 * or bytes always yields byte-identical CSV and JSON output.
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
  VALID_CONDITIONS,
  CITY_IDS
} from "./bincheck-validate.js";

export const BATCH_LIMITS = Object.freeze({ maxBytes: 262144, maxRows: 500 });
export const CSV_COLUMNS = Object.freeze(["label", "barcode", "material", "resin", "condition"]);

/**
 * Magic signatures for file containers people drop onto the CSV picker by
 * mistake. Each entry is matched at offset 0; a file shorter than a signature
 * can never be confirmed and falls through to the text checks.
 */
const BINARY_SIGNATURES = [
  { format: "a PNG image", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { format: "a JPEG image", bytes: [0xff, 0xd8, 0xff] },
  { format: "a ZIP archive (spreadsheets such as .xlsx use this container)", bytes: [0x50, 0x4b, 0x03, 0x04] },
  { format: "a PDF document", bytes: [0x25, 0x50, 0x44, 0x46] },
  { format: "a gzip-compressed file", bytes: [0x1f, 0x8b] },
  { format: "a legacy Office document (OLE2, for example .xls)", bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] },
  { format: "a 7z archive", bytes: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c] },
  { format: "a RAR archive", bytes: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07] },
  { format: "a SQLite database", text: "SQLite format 3\u0000" }
];

function asciiAt(bytes, start, length) {
  let out = "";
  for (let i = 0; i < length; i += 1) out += String.fromCharCode(bytes[start + i]);
  return out;
}

function isTextByte(b) {
  return b === 0x09 || b === 0x0a || b === 0x0d || (b >= 0x20 && b <= 0x7e);
}

/**
 * GIF detection needs more than the four-byte "GIF8" prefix a plain text
 * header can start with (a CSV column literally named GIF8-column). Require
 * the complete GIF87a/GIF89a signature, a logical screen descriptor whose
 * next block is a real GIF marker, and at least one byte outside the
 * printable-text range. A valid text file can never satisfy all three.
 */
function looksLikeGif(bytes) {
  if (bytes.length < 14) return false;
  const signature = asciiAt(bytes, 0, 6);
  if (signature !== "GIF87a" && signature !== "GIF89a") return false;
  const width = bytes[6] | (bytes[7] << 8);
  const height = bytes[8] | (bytes[9] << 8);
  const packed = bytes[10];
  const tableBytes = packed & 0x80 ? 3 * (1 << ((packed & 0x07) + 1)) : 0;
  const nextBlock = 13 + tableBytes;
  const blockByte = nextBlock < bytes.length ? bytes[nextBlock] : -1;
  const plausible = width > 0 && height > 0 && (blockByte === 0x2c || blockByte === 0x21 || blockByte === 0x3b);
  if (!plausible) return false;
  for (const b of bytes) {
    if (!isTextByte(b)) return true;
  }
  return false;
}

function matchBinarySignature(bytes) {
  for (const sig of BINARY_SIGNATURES) {
    if (sig.bytes) {
      if (bytes.length < sig.bytes.length) continue;
      if (sig.bytes.every((b, i) => bytes[i] === b)) return sig;
    } else if (sig.text) {
      if (bytes.length < sig.text.length) continue;
      if (asciiAt(bytes, 0, sig.text.length) === sig.text) return sig;
    }
  }
  if (looksLikeGif(bytes)) {
    return { format: "a GIF image" };
  }
  if (bytes.length >= 12 && asciiAt(bytes, 0, 4) === "RIFF" && ["WAVE", "AVI ", "WEBP"].includes(asciiAt(bytes, 8, 4))) {
    return { format: "a RIFF media file (WAVE audio, AVI video, or WebP image)" };
  }
  return null;
}

const UTF32_LE_BOM = [0xff, 0xfe, 0x00, 0x00];
const UTF32_BE_BOM = [0x00, 0x00, 0xfe, 0xff];

function hasBytesAt(bytes, offset, expected) {
  if (bytes.length < offset + expected.length) return false;
  return expected.every((b, i) => bytes[offset + i] === b);
}

function utf16BomEncoding(bytes) {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return "utf-16le";
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return "utf-16be";
  return null;
}

/**
 * UTF-16 text saved without a byte order mark shows up as NUL bytes filling
 * every other position. When one parity is almost all NULs and the other is
 * mostly printable ASCII, the encoding is clear enough to decode safely.
 */
function guessUtf16Encoding(bytes) {
  const sample = Math.min(bytes.length, 256);
  if (sample < 16) return null;
  let evenNul = 0;
  let oddNul = 0;
  let evenPrint = 0;
  let oddPrint = 0;
  for (let i = 0; i < sample; i += 1) {
    const b = bytes[i];
    const printable = b >= 0x20 && b <= 0x7e;
    if (i % 2 === 0) {
      if (b === 0) evenNul += 1;
      if (printable) evenPrint += 1;
    } else {
      if (b === 0) oddNul += 1;
      if (printable) oddPrint += 1;
    }
  }
  const pairs = Math.ceil(sample / 2);
  if (oddNul / pairs >= 0.45 && evenPrint / pairs >= 0.45) return "utf-16le";
  if (evenNul / pairs >= 0.45 && oddPrint / pairs >= 0.45) return "utf-16be";
  return null;
}

const UTF8_FAILURE_DETAILS = {
  STRAY_CONTINUATION: "is a continuation byte with no lead byte before it",
  OVERLONG_ENCODING: "uses more bytes than needed to encode a character (overlong form, forbidden in UTF-8)",
  BAD_CONTINUATION: "appears where a continuation byte was required",
  TRUNCATED_SEQUENCE: "ends the file in the middle of a multi-byte character",
  SURROGATE_CODE_POINT: "encodes a UTF-16 surrogate half, which UTF-8 forbids",
  OUT_OF_RANGE: "encodes a code point above U+10FFFF, the Unicode ceiling",
  INVALID_LEAD_BYTE: "cannot start a UTF-8 character"
};

/**
 * Strict UTF-8 walk that reports the exact byte offset of the first malformed
 * sequence. Accepts only canonical encodings: no overlongs, no surrogate halves,
 * no code points past U+10FFFF, no truncated tails.
 */
export function scanUtf8(bytes) {
  const length = bytes.length;
  const isContinuation = (i) => i < length && bytes[i] >= 0x80 && bytes[i] <= 0xbf;
  let i = 0;
  while (i < length) {
    const b = bytes[i];
    if (b <= 0x7f) {
      i += 1;
      continue;
    }
    if (b <= 0xbf) {
      return { valid: false, offset: i, byte: b, code: "STRAY_CONTINUATION" };
    }
    if (b <= 0xc1) {
      return { valid: false, offset: i, byte: b, code: "OVERLONG_ENCODING" };
    }
    let size;
    let lo = 0x80;
    let hi = 0xbf;
    let restrictedCode = null;
    if (b <= 0xdf) {
      size = 2;
    } else if (b === 0xe0) {
      size = 3;
      lo = 0xa0;
      restrictedCode = "OVERLONG_ENCODING";
    } else if (b === 0xed) {
      size = 3;
      hi = 0x9f;
      restrictedCode = "SURROGATE_CODE_POINT";
    } else if (b <= 0xef) {
      size = 3;
    } else if (b === 0xf0) {
      size = 4;
      lo = 0x90;
      restrictedCode = "OVERLONG_ENCODING";
    } else if (b <= 0xf3) {
      size = 4;
    } else if (b === 0xf4) {
      size = 4;
      hi = 0x8f;
      restrictedCode = "OUT_OF_RANGE";
    } else {
      return { valid: false, offset: i, byte: b, code: "INVALID_LEAD_BYTE" };
    }
    if (i + size > length) {
      return { valid: false, offset: i, byte: b, code: "TRUNCATED_SEQUENCE" };
    }
    for (let k = 1; k < size; k += 1) {
      if (!isContinuation(i + k)) {
        return { valid: false, offset: i + k, byte: bytes[i + k], code: "BAD_CONTINUATION" };
      }
    }
    const second = bytes[i + 1];
    if (restrictedCode && (second < lo || second > hi)) {
      return { valid: false, offset: i + 1, byte: second, code: restrictedCode };
    }
    i += size;
  }
  return { valid: true, offset: length };
}

/**
 * Counts characters in pasted text that cannot belong in a real CSV export:
 * NULs, C0/C1 control characters other than tab and line breaks, and U+FFFD
 * replacement characters left behind by a lossy decode.
 */
export function assessCsvText(text) {
  let nul = 0;
  let control = 0;
  let replacement = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp === 0) nul += 1;
    else if (cp === 0xfffd) replacement += 1;
    else if ((cp < 0x20 && cp !== 0x09 && cp !== 0x0a && cp !== 0x0d) || (cp >= 0x7f && cp <= 0x9f)) control += 1;
  }
  if (nul > 0) {
    return {
      ok: false,
      error: {
        line: 0,
        code: "BINARY_LIKE_INPUT",
        offset: 0,
        message: `Input holds ${nul} NUL character${nul === 1 ? "" : "s"}. That is binary data, not CSV text. Export a plain .csv file or paste comma-separated rows.`
      }
    };
  }
  if (control >= 3 || (control > 0 && control * 50 > text.length)) {
    return {
      ok: false,
      error: {
        line: 0,
        code: "BINARY_LIKE_INPUT",
        offset: 0,
        message: `Input holds ${control} non-text control characters. It looks like binary data, not CSV text. Export a plain .csv file or paste comma-separated rows.`
      }
    };
  }
  if (replacement >= 3) {
    return {
      ok: false,
      error: {
        line: 0,
        code: "BINARY_LIKE_INPUT",
        offset: 0,
        message: `Input holds ${replacement} replacement characters (U+FFFD), the residue of decoding bytes that were not UTF-8 text. Export a plain .csv file or paste comma-separated rows.`
      }
    };
  }
  const warnings = [];
  if (control > 0 || replacement > 0) {
    warnings.push({
      line: 0,
      code: "UNUSUAL_CHARACTERS",
      message: `${control + replacement} unusual control or replacement character(s) were found; the rows were still read.`
    });
  }
  return { ok: true, warnings };
}

/**
 * Turns raw file bytes into CSV text with a full diagnostic trail. Detection
 * order: known binary signatures, UTF-32 byte order marks, UTF-16 byte order
 * marks, UTF-16 NUL pattern without a mark, strict UTF-8, then leftover NUL
 * bytes. Never throws.
 */
export function decodeBatchBytes(input) {
  let bytes;
  if (input instanceof Uint8Array) {
    bytes = input;
  } else if (input && typeof input.byteLength === "number") {
    bytes = new Uint8Array(input);
  } else if (Array.isArray(input)) {
    bytes = Uint8Array.from(input);
  } else {
    bytes = new Uint8Array(0);
  }
  const byteCount = bytes.length;

  const done = (ok, fields) => ({ ok, text: null, encoding: null, byteCount, errors: [], ...fields });

  if (byteCount === 0) {
    return done(false, {
      errors: [{ line: 0, code: "EMPTY_INPUT", offset: 0, message: "The file is empty. Paste CSV text or choose a file with rows." }]
    });
  }
  if (byteCount > BATCH_LIMITS.maxBytes) {
    return done(false, {
      errors: [{ line: 0, code: "TOO_LARGE", offset: 0, message: `File is ${byteCount} bytes. The limit is ${BATCH_LIMITS.maxBytes} bytes.` }]
    });
  }

  const signature = matchBinarySignature(bytes);
  if (signature) {
    return done(false, {
      errors: [{
        line: 0,
        code: "BINARY_INPUT",
        offset: 0,
        format: signature.format,
        message: `This looks like ${signature.format}, not CSV text. Re-export the data as a plain .csv file or paste the rows.`
      }]
    });
  }

  if (hasBytesAt(bytes, 0, UTF32_LE_BOM) || hasBytesAt(bytes, 0, UTF32_BE_BOM)) {
    return done(false, {
      errors: [{
        line: 0,
        code: "UTF32_INPUT",
        offset: 0,
        message: "The file is UTF-32 encoded text, which browsers cannot decode. Save it as UTF-8 CSV and try again."
      }]
    });
  }

  const utf16 = utf16BomEncoding(bytes) || guessUtf16Encoding(bytes);
  if (utf16) {
    try {
      const text = new TextDecoder(utf16, { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
      return done(true, { text, encoding: utf16 });
    } catch {
      return done(false, {
        errors: [{
          line: 0,
          code: "INVALID_UTF16",
          offset: 0,
          encoding: utf16,
          message: `The file looks ${utf16.toUpperCase()} but could not be decoded (odd byte count or a broken surrogate pair). Save it as UTF-8 CSV and try again.`
        }]
      });
    }
  }

  const scan = scanUtf8(bytes);
  if (!scan.valid) {
    const hex = `0x${scan.byte.toString(16).toUpperCase().padStart(2, "0")}`;
    return done(false, {
      errors: [{
        line: 0,
        code: "INVALID_UTF8",
        offset: scan.offset,
        byte: scan.byte,
        reason: scan.code,
        message: `Byte ${scan.offset} (${hex}) ${UTF8_FAILURE_DETAILS[scan.code]}. The file is not valid UTF-8 text; re-export it as CSV.`
      }]
    });
  }

  let firstNul = -1;
  let nulCount = 0;
  for (let i = 0; i < byteCount; i += 1) {
    if (bytes[i] === 0) {
      nulCount += 1;
      if (firstNul === -1) firstNul = i;
    }
  }
  if (nulCount > 0) {
    return done(false, {
      errors: [{
        line: 0,
        code: "BINARY_INPUT",
        offset: firstNul,
        format: "binary data with NUL bytes",
        message: `The file holds ${nulCount} NUL byte${nulCount === 1 ? "" : "s"} (first at byte ${firstNul}); that is binary data, not CSV text.`
      }]
    });
  }

  return done(true, { text: new TextDecoder("utf-8").decode(bytes), encoding: "utf-8" });
}
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

/* Spreadsheet exports write these into empty cells; none is a plausible column name. */
const SPARSE_EMPTY_TOKENS = new Set(["", "-", "--", "n/a", "na", "n.a.", "null", "none", "0", ".", "\u2013", "\u2014"]);

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
  let afterCloseQuote = false;
  let recordMalformed = false;
  let skippedRows = 0;
  let malformedFirstLine = null;
  let suspectFirstLine = null;
  let recordBareQuote = false;
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
    if (recordMalformed) {
      skippedRows += 1;
      if (malformedFirstLine === null && records.length === 0) {
        malformedFirstLine = recordLine;
      }
    } else if (!blank && !isComment) {
      if (recordBareQuote && records.length === 0) {
        suspectFirstLine = recordLine;
      }
      records.push({ line: recordLine, cells });
    }
    cells = [];
    touched = false;
    touchedQuotedFirst = false;
    recordMalformed = false;
    recordBareQuote = false;
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
          afterCloseQuote = true;
        }
      } else {
        if (ch === "\r" || (ch === "\n" && source[i - 1] !== "\r")) {
          line += 1;
        }
        field += ch;
      }
      continue;
    }
    if (afterCloseQuote) {
      if (ch === " " || ch === "\t") {
        continue;
      }
      if (ch !== "," && ch !== "\n" && ch !== "\r") {
        if (!recordMalformed) {
          recordMalformed = true;
          const junk = source.slice(i, i + 20).split(/[,\r\n]/)[0];
          errors.push(
            csvError(
              line,
              "CSV_TRAILING_CHARS",
              `Characters ("${junk}") follow a closing quote, so the row starting on line ${recordLine} could not be read and was skipped.`
            )
          );
        }
        field += ch;
        touched = true;
        continue;
      }
      afterCloseQuote = false;
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
      if (ch === '"') recordBareQuote = true;
      field += ch;
      touched = true;
    }
  }

  if (inQuotes) {
    skippedRows += 1;
    if (malformedFirstLine === null && records.length === 0) {
      malformedFirstLine = recordLine;
    }
    errors.push(csvError(recordLine, "CSV_UNTERMINATED_QUOTE", "A quoted field was never closed. The rest of the file was ignored."));
    return { records, errors, skippedRows, malformedFirstLine, suspectFirstLine, unterminatedQuote: true };
  }
  if (touched || field !== "" || cells.length > 0) {
    endRecord();
  }
  return { records, errors, skippedRows, malformedFirstLine, suspectFirstLine, unterminatedQuote: false };
}

/**
 * Parses batch CSV text into normalized row objects.
 * Returns { rows, errors, hasHeader, columns, truncated, truncatedByRowLimit,
 * incompleteInput, droppedRows, bytes }.
 * `truncated` is true whenever part of the input was left unprocessed, whether
 * the row cap cut it (`truncatedByRowLimit`) or an unclosed quoted field
 * swallowed the rest of the file (`incompleteInput`).
 * `droppedRows` counts only records whose boundaries are known: rows past the
 * limit, malformed quoted rows, rows left unevaluated by a rejected mapping,
 * and the one record an unclosed quote began. Text trapped inside an unclosed
 * field is never counted as additional rows.
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
      truncatedByRowLimit: false,
      incompleteInput: false,
      droppedRows: 0,
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
      truncatedByRowLimit: false,
      incompleteInput: false,
      droppedRows: 0,
      bytes
    };
  }

  const sanity = assessCsvText(text);
  if (!sanity.ok) {
    return {
      rows: [],
      errors: [sanity.error],
      hasHeader: false,
      columns: [...CSV_COLUMNS],
      truncated: false,
      truncatedByRowLimit: false,
      incompleteInput: false,
      droppedRows: 0,
      bytes
    };
  }

  const parsed = parseCsv(text);
  errors.push(...parsed.errors, ...sanity.warnings);
  let records = parsed.records;
  let columns = [...HEADERLESS_COLUMNS];
  let hasHeader = false;
  let droppedRows = parsed.skippedRows || 0;
  const incompleteInput = parsed.unterminatedQuote === true;

  if (parsed.malformedFirstLine !== null) {
    // The first content row could not be read, so nothing establishes whether
    // it named the columns. Falling back to positional columns or trusting a
    // later surviving row as the header would be a guess that can silently
    // assign values to the wrong fields, so the whole input is refused instead.
    droppedRows += records.length;
    errors.push(csvError(
      parsed.malformedFirstLine,
      "AMBIGUOUS_COLUMN_MAPPING",
      "The first data row could not be read, so it is impossible to tell whether it named the columns. Guessing column positions could silently mislabel every row, so no rows were evaluated. Fix that row or add a header row and try again."
    ));
    return { rows: [], errors, hasHeader: false, columns, truncated: incompleteInput, truncatedByRowLimit: false, incompleteInput, droppedRows, bytes };
  }
  if (parsed.suspectFirstLine !== null) {
    // The first content row survived only because the grammar tolerates a
    // quote mark where no quoted field can open, so it may be a damaged
    // header row. Same refusal as an unreadable first row: mapping by name
    // or by position would be a guess.
    droppedRows += records.length;
    errors.push(csvError(
      parsed.suspectFirstLine,
      "AMBIGUOUS_COLUMN_MAPPING",
      "The first data row holds a quote mark where a quoted field cannot begin, so it may be a damaged header row. Guessing column positions could silently mislabel every row, so no rows were evaluated. Fix that row or add a header row and try again."
    ));
    return { rows: [], errors, hasHeader: false, columns, truncated: incompleteInput, truncatedByRowLimit: false, incompleteInput, droppedRows, bytes };
  }

  if (records.length > 0) {
    const firstCells = records[0].cells.map((cell) => cell.toLowerCase().replace(/[^a-z0-9]/g, ""));
    const headerColumns = firstCells.map((cell) => Object.hasOwn(HEADER_ALIASES, cell) ? HEADER_ALIASES[cell] : null);
    const hasIdentifierColumn = headerColumns.some((column) => column === "barcode" || column === "material" || column === "resin");
    const namedColumns = headerColumns.filter((column) => column !== null);
    const namedColumnCount = namedColumns.length;
    // A first cell that is itself a column name plus a duplicated
    // canonical column is a malformed header, not data: fail closed on
    // it so the duplicate check below can reject the file. Data rows
    // keep the exemption because their first cell is a value, never an
    // alias ("041220576463,,,clean,barcode,upc" stays data).
    const firstCellIsName = headerColumns[0] !== null;
    const hasDuplicateColumn = new Set(namedColumns).size < namedColumnCount;
    let lastNamedIndex = -1;
    headerColumns.forEach((column, index) => {
      if (column !== null) lastNamedIndex = index;
    });
    const hasBarcodeData = records[0].cells.some((cell) => /^\d{8,14}$/.test(cell.replace(/[\s-]/g, "")));
    const hasMaterialData = normalizeMaterialToken(records[0].cells[1]) !== null;
    const hasResinData = parseResinCode(records[0].cells[2]).valid;
    // A condition word in the fourth cell counts as positional evidence
    // only in a sparse row: the two positional slots before it must be
    // empty or hold export placeholders ("-", "0", "n/a") that no real
    // column would be named. With a word filled in cells 1 or 2 the row
    // is a header whose fourth column is literally named like a
    // condition ("upc,qty,notes,clean"), while "upc,,,clean,x" and
    // "upc,-,-,clean,x" are headerless rows whose cells happen to hold
    // header words - and reading them as headers would silently drop
    // every later row's condition cell into unnamed columns.
    const sparseEmptyCell = (cell) => SPARSE_EMPTY_TOKENS.has(String(cell ?? "").trim().toLowerCase());
    // A condition column named after the sparse fourth cell means the row
    // declares its own layout: the condition word in that slot is an
    // unnamed header cell and real condition values land in the named
    // column, so "barcode,,,clean,condition" is a sparse header, not
    // headerless data whose label happens to read "condition". Once an input
    // passes all file-level checks (byte limit, binary sniffing, and text
    // encoding), header detection inspects only row 1 so valid CSV rows past
    // BATCH_LIMITS.maxRows never alter header detection or earlier verdicts;
    // any row that strands a non-clean condition token in an unmapped cell
    // fails closed below.
    const namedConditionIndex = headerColumns.indexOf("condition", 4);
    const hasConditionData = namedConditionIndex < 0
      && VALID_CONDITIONS.includes(String(records[0].cells[3] ?? "").trim().toLowerCase())
      && sparseEmptyCell(records[0].cells[1])
      && sparseEmptyCell(records[0].cells[2]);
    // Data evidence sitting among the names (before the last one) can
    // never be an extra unknown column: "041220576463,,,clean,Item,upc"
    // and "upc,resin-1-pet,,clean,material" are headerless data rows
    // whose cells happen to hold header words. Only cells after the
    // last name are extra column-name slots, so a numeric, resin-like
    // or UPC-looking extra header cell ("material,label,1") never
    // downgrades a named header row into a data row.
    const dataBeforeNames = namedColumnCount >= 2 && (
      records[0].cells.slice(0, lastNamedIndex).some((cell) => /^\d{8,14}$/.test(cell.replace(/[\s-]/g, "")))
      || (lastNamedIndex > 1 && hasMaterialData)
      || (lastNamedIndex > 2 && hasResinData)
      || hasConditionData
    );
    const looksLikeData = (hasBarcodeData || hasMaterialData || hasResinData || hasConditionData)
      && !(firstCellIsName && hasDuplicateColumn)
      && (namedColumnCount < 2 || (hasMaterialData && hasResinData) || dataBeforeNames);
    if (hasIdentifierColumn && !looksLikeData) {
      hasHeader = true;
      columns = headerColumns;
      records[0].cells.forEach((cell, index) => {
        if (!columns[index] && cell.trim() !== "") {
          errors.push(csvError(records[0].line, "UNKNOWN_COLUMN", `Column "${cell.slice(0, 30)}" is not recognized and was ignored.`));
        }
      });
      const firstIndexOf = new Map();
      const duplicateIndexes = new Map();
      headerColumns.forEach((column, index) => {
        if (!column) return;
        if (firstIndexOf.has(column)) {
          if (!duplicateIndexes.has(column)) duplicateIndexes.set(column, [firstIndexOf.get(column)]);
          duplicateIndexes.get(column).push(index);
        } else {
          firstIndexOf.set(column, index);
        }
      });
      if (duplicateIndexes.size > 0) {
        for (const [column, indexes] of duplicateIndexes) {
          const detail = indexes.map((index) => `"${records[0].cells[index].slice(0, 30)}" (column ${index + 1})`).join(" and ");
          errors.push({
            line: records[0].line,
            code: "DUPLICATE_COLUMN",
            column,
            headers: indexes.map((index) => records[0].cells[index]),
            message: `Headers ${detail} both map to the "${column}" column, so one value would silently overwrite the other. Rename or remove a column and try again.`
          });
        }
        droppedRows += records.length - 1;
        return { rows: [], errors, hasHeader, columns, truncated: incompleteInput, truncatedByRowLimit: false, incompleteInput, droppedRows, bytes };
      }
      records = records.slice(1);
    }
  }

  let truncatedByRowLimit = false;
  if (records.length > BATCH_LIMITS.maxRows) {
    truncatedByRowLimit = true;
    droppedRows += records.length - BATCH_LIMITS.maxRows;
    errors.push(csvError(records[BATCH_LIMITS.maxRows].line, "ROW_LIMIT", `Only the first ${BATCH_LIMITS.maxRows} rows were read.`));
    records = records.slice(0, BATCH_LIMITS.maxRows);
  }

  const rows = records.map((record) => {
    const row = { line: record.line, label: "", barcode: "", material: "", resin: "", condition: "" };
    if (record.cells.length > columns.length) {
      errors.push(
        csvError(
          record.line,
          "EXTRA_CELLS",
          `Row has ${record.cells.length - columns.length} extra cell(s) beyond the ${columns.length} known columns; extra data was ignored.`
        )
      );
    }
    let droppedCondition = null;
    record.cells.forEach((cell, index) => {
      const column = columns[index];
      if (column) {
        row[column] = cell;
      } else if (droppedCondition === null) {
        const normalizedCell = String(cell ?? "").trim().toLowerCase();
        if (VALID_CONDITIONS.includes(normalizedCell) && normalizedCell !== "clean") {
          droppedCondition = { value: String(cell).trim(), column: index + 1 };
        }
      }
    });
    // A non-clean condition word (greasy, liquid-full, broken) that lands in
    // a cell the column mapping cannot reach (an unrecognized header cell or
    // a cell past the known columns) is never silently discarded: when the
    // mapped condition holds no recognized condition word (empty, an export
    // placeholder, or a value that is not a condition) the row's real
    // condition is unknown, so the row is flagged and inspectBatch fails it
    // closed instead of reporting a verdict. Default "clean" is benign when
    // omitted because an empty condition already defaults to clean.
    if (droppedCondition !== null
      && !VALID_CONDITIONS.includes(String(row.condition ?? "").trim().toLowerCase())) {
      row.droppedCondition = droppedCondition;
    }
    return row;
  });

  if (rows.length === 0 && errors.length === 0) {
    errors.push(csvError(0, "NO_DATA_ROWS", "No data rows were found."));
  }

  return {
    rows,
    errors,
    hasHeader,
    columns,
    truncated: truncatedByRowLimit || incompleteInput,
    truncatedByRowLimit,
    incompleteInput,
    droppedRows,
    bytes
  };
}

function summarizeCity(cityId, evaluatedRows) {
  const items = evaluatedRows.map((row) => row.engineInput);
  const summary = scoreCartBatch(items, cityId);
  const streamCounts = {};
  for (const evaluation of summary.evaluations) {
    streamCounts[evaluation.stream] = (streamCounts[evaluation.stream] || 0) + 1;
  }
  const cartEligible = summary.evaluations.filter((ev) => ev.stream === "RECYCLE_CART").length;
  return {
    city: cityId,
    cityName: SUPPORTED_CITIES[cityId].shortName,
    itemCount: summary.itemCount,
    averageRiskScore: summary.averageRiskScore,
    maxRiskScore: summary.maxRiskScore,
    loadStatus: summary.loadStatus,
    streamCounts: Object.fromEntries(Object.entries(streamCounts).sort(([a], [b]) => (a < b ? -1 : 1))),
    hazards: summary.criticalHazards,
    cartEligible,
    cartEligiblePct: summary.itemCount === 0 ? 0 : Math.round((cartEligible / summary.itemCount) * 100),
    notCartEligible: summary.itemCount - cartEligible
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

    if (row.droppedCondition) {
      const dropped = row.droppedCondition;
      errorIssues.unshift({
        code: "UNMAPPED_CONDITION",
        severity: "error",
        field: "condition",
        message: `The value "${String(dropped.value).slice(0, 40)}" in column ${dropped.column} looks like a condition, but that column has no recognized name, so it was not read and the row's real condition is unknown. Name that column "condition" or move the value into the condition column and run again.`
      });
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
      truncatedByRowLimit: parsed.truncatedByRowLimit,
      incompleteInput: parsed.incompleteInput,
      droppedRows: parsed.droppedRows,
      bytes: parsed.bytes,
      encoding: "utf-8"
    },
    decodedText: null,
    ...inspection
  };
}

/**
 * Parses raw file bytes into normalized row objects. The decode diagnostics
 * are merged ahead of the CSV diagnostics so a caller can always explain why
 * zero rows came back. `decodedText` is the decoded source when the bytes were
 * readable text (UTF-8 or UTF-16), otherwise null so binary garbage never lands
 * in the textarea.
 */
export function parseBatchBytes(input) {
  const decoded = decodeBatchBytes(input);
  if (!decoded.ok) {
    return {
      rows: [],
      errors: decoded.errors,
      hasHeader: false,
      columns: [...CSV_COLUMNS],
      truncated: false,
      truncatedByRowLimit: false,
      incompleteInput: false,
      droppedRows: 0,
      bytes: decoded.byteCount,
      encoding: decoded.encoding,
      decodedText: null
    };
  }
  const parsed = parseBatchCsv(decoded.text);
  return {
    ...parsed,
    bytes: decoded.byteCount,
    encoding: decoded.encoding,
    decodedText: decoded.text
  };
}

/** One call from raw bytes to full result: decode, parse, then inspect. */
export function runBatchFromBytes(input) {
  const parsed = parseBatchBytes(input);
  const inspection = inspectBatch(parsed.rows);
  return {
    parse: {
      errors: parsed.errors,
      hasHeader: parsed.hasHeader,
      truncated: parsed.truncated,
      truncatedByRowLimit: parsed.truncatedByRowLimit,
      incompleteInput: parsed.incompleteInput,
      droppedRows: parsed.droppedRows,
      bytes: parsed.bytes,
      encoding: parsed.encoding
    },
    decodedText: parsed.decodedText,
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
  const parse = result.parse || {};
  const payload = {
    tool: "BinCheck",
    rulesSnapshot: { ...RULES_SNAPSHOT_META },
    generatedOn: options.generatedOn ?? null,
    parse: {
      hasHeader: parse.hasHeader === true,
      encoding: parse.encoding ?? null,
      bytes: Number.isInteger(parse.bytes) ? parse.bytes : null,
      truncated: parse.truncated === true,
      truncatedByRowLimit: parse.truncatedByRowLimit === true,
      incompleteInput: parse.incompleteInput === true,
      droppedRows: Number.isInteger(parse.droppedRows) ? parse.droppedRows : 0,
      errors: (Array.isArray(parse.errors) ? parse.errors : []).map((entry) => ({ ...entry }))
    },
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
