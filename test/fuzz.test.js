import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import fc from 'fast-check';

import { computeUpcCheckDigit, validateBarcodeCheckDigit } from '../src/bincheck-engine.js';
import { decodeBatchBytes, scanUtf8 } from '../js/bincheck-batch.js';
import { sha256Hex } from '../js/bincheck-sha256.js';
import {
  CITY_MODES,
  MATERIAL_IDS,
  VALID_CONDITIONS,
  decodeShareHash,
  encodeShareHash,
} from '../js/bincheck-validate.js';

const DEFAULT_FUZZ_SEED = 20261127;

function fuzzSeed() {
  const raw = process.env.FUZZ_SEED;
  if (raw === undefined) return DEFAULT_FUZZ_SEED;
  if (!/^-?\d+$/.test(raw)) throw new Error('FUZZ_SEED must be an integer');
  const seed = Number(raw);
  if (!Number.isSafeInteger(seed)) throw new Error('FUZZ_SEED must be a safe integer');
  return seed;
}

const digit = fc.integer({ min: 0, max: 9 });
const barcodePayload = fc.oneof(
  fc.array(digit, { minLength: 7, maxLength: 7 }).map((digits) => ({ length: 7, payload: digits.join('') })),
  fc.array(digit, { minLength: 11, maxLength: 11 }).map((digits) => ({ length: 11, payload: digits.join('') })),
  fc.array(digit, { minLength: 12, maxLength: 12 }).map((digits) => ({ length: 12, payload: digits.join('') }))
);
const textUnit = fc.constantFrom(
  'a', 'b', 'x', '0', '1', ' ', ',', '"', '\n', '\r', '\t', 'é', '漢', '😀', '-', '_', '/', '#'
);
const csvTextBody = fc.string({ unit: textUnit, maxLength: 80 });

test('fast-check GS1 payloads round-trip their check digit and reject every tampered digit', () => {
  fc.assert(fc.property(
    barcodePayload,
    fc.integer({ min: 0, max: 8 }),
    ({ length, payload }, tamperOffset) => {
      const checkDigit = computeUpcCheckDigit(payload);
      assert.ok(Number.isInteger(checkDigit), `no check digit for ${payload}`);
      const barcode = `${payload}${checkDigit}`;
      const valid = validateBarcodeCheckDigit(barcode);
      assert.equal(valid.valid, true, `valid generated barcode was rejected: ${barcode}`);
      assert.equal(valid.expectedCheckDigit, checkDigit);
      assert.equal(valid.actualCheckDigit, checkDigit);
      assert.equal(valid.format, length === 7 ? 'EAN-8' : length === 11 ? 'UPC-A' : 'EAN-13');

      const tamperedDigit = (checkDigit + 1 + tamperOffset) % 10;
      const tampered = validateBarcodeCheckDigit(`${payload}${tamperedDigit}`);
      assert.equal(tampered.valid, false, `tampered barcode was accepted: ${payload}${tamperedDigit}`);
      assert.equal(tampered.expectedCheckDigit, checkDigit);
      assert.equal(tampered.actualCheckDigit, tamperedDigit);
    }
  ), { seed: fuzzSeed(), numRuns: 100 });
});

test('fast-check pure SHA-256 matches the platform digest on arbitrary byte strings', () => {
  fc.assert(fc.property(
    fc.array(fc.integer({ min: 0, max: 255 }), { maxLength: 160 }),
    (bytes) => {
      const input = Uint8Array.from(bytes);
      const expected = createHash('sha256').update(Buffer.from(input)).digest('hex');
      assert.equal(sha256Hex(input), expected);
    }
  ), { seed: fuzzSeed(), numRuns: 100 });
});

test('fast-check valid UTF-8 CSV bytes decode exactly and scan clean', () => {
  fc.assert(fc.property(csvTextBody, (body) => {
    const text = `label,barcode\n${body}`;
    const bytes = new TextEncoder().encode(text);
    const scan = scanUtf8(bytes);
    assert.equal(scan.valid, true, `valid UTF-8 was rejected at byte ${scan.offset}`);
    assert.equal(scan.offset, bytes.length);
    const decoded = decodeBatchBytes(bytes);
    assert.equal(decoded.ok, true, `valid CSV bytes were rejected: ${decoded.errors[0]?.code}`);
    assert.equal(decoded.encoding, 'utf-8');
    assert.equal(decoded.text, text);
  }), { seed: fuzzSeed(), numRuns: 100 });
});

test('fast-check inserted NUL bytes are binary input even when the UTF-8 itself is valid', () => {
  fc.assert(fc.property(csvTextBody, csvTextBody, (left, right) => {
    const text = `label,barcode\n${left}\0${right}`;
    const bytes = new TextEncoder().encode(text);
    assert.equal(scanUtf8(bytes).valid, true, 'NUL is valid UTF-8 and must reach the binary-input policy');
    const decoded = decodeBatchBytes(bytes);
    assert.equal(decoded.ok, false, 'a NUL byte was accepted as CSV text');
    assert.equal(decoded.errors[0].code, 'BINARY_INPUT');
    assert.match(decoded.errors[0].message, /NUL byte/);
  }), { seed: fuzzSeed(), numRuns: 100 });
});

test('fast-check share hashes round-trip validated state and hostile hashes never corrupt the patch shape', () => {
  const digitText = fc.integer({ min: 1, max: 14 }).chain((length) => (
    fc.array(digit, { minLength: length, maxLength: length }).map((digits) => digits.join(''))
  ));
  const validState = fc.record({
    cityMode: fc.constantFrom(...CITY_MODES),
    barcode: digitText,
    materialId: fc.constantFrom(...MATERIAL_IDS),
    resinCode: fc.integer({ min: 1, max: 7 }),
    condition: fc.constantFrom(...VALID_CONDITIONS),
  });
  fc.assert(fc.property(validState, fc.string({ maxLength: 120 }), (state, hostileHash) => {
    const encoded = encodeShareHash(state);
    const roundTrip = decodeShareHash(encoded);
    assert.deepEqual(roundTrip.issues, []);
    assert.equal(roundTrip.patch.cityMode, state.cityMode);
    assert.equal(roundTrip.patch.barcode, state.barcode);
    assert.equal(roundTrip.patch.materialId, state.materialId);
    assert.equal(roundTrip.patch.resinCode, state.resinCode);
    assert.equal(roundTrip.patch.condition, state.condition);

    const hostile = decodeShareHash(hostileHash);
    assert.ok(hostile.patch && typeof hostile.patch === 'object' && !Array.isArray(hostile.patch));
    assert.ok(Array.isArray(hostile.issues));
    for (const key of Object.keys(hostile.patch)) {
      assert.ok([
        'cityMode', 'barcode', 'materialId', 'resinCode', 'condition',
        'municipalProfileA', 'municipalProfileB', 'municipalBasket', 'cascadeCounts',
        'workbenchPreset', 'language'
      ].includes(key), `unexpected patch key ${key}`);
    }
  }), { seed: fuzzSeed(), numRuns: 100 });
});
