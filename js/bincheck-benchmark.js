/**
 * BinCheck calibration benchmark.
 *
 * Grades the live engine against snapshot-anchored ground truth
 * (js/ground-truth.js) and reports:
 *   - a binary confusion matrix for "does the engine route this item into the
 *     recycling cart" (false positives are the harmful wish-cycling errors),
 *   - a multi-class confusion matrix over disposal streams,
 *   - a risk-tier calibration table (how each tier splits real outcomes),
 *   - barcode integrity diagnostics (GS1 check digit and transposition blind spots),
 *   - per-call latency percentiles measured with an injected clock.
 *
 * Everything except `latency` is deterministic. Latency depends on the device,
 * so callers supply `now` (tests use a fake clock) and exports omit it by default.
 */

import {
  SUPPORTED_CITIES,
  VERIFIED_BARCODE_CATALOG,
  evaluateItemDisposal,
  validateBarcodeCheckDigit
} from "./bincheck-engine.js";
import { RULES_SNAPSHOT_META } from "./bincheck-validate.js";
import {
  GROUND_TRUTH_CASES,
  GROUND_TRUTH_META,
  KNOWN_GAP_CASES,
  EXTERNAL_BARCODE_VECTORS
} from "./ground-truth.js";

export const STREAM_ORDER = Object.freeze([
  "RECYCLE_CART",
  "SPLIT_DISPOSAL",
  "SPECIAL_DROPOFF",
  "TRASH_CART",
  "GREEN_WASTE"
]);
export const TIER_ORDER = Object.freeze(["LOW", "MODERATE", "HIGH", "CRITICAL"]);
const CITY_IDS = Object.keys(SUPPORTED_CITIES);

function defaultNow() {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function ratio(numerator, denominator) {
  return denominator === 0 ? null : numerator / denominator;
}

export function percentile(sortedValues, p) {
  if (!Array.isArray(sortedValues) || sortedValues.length === 0) {
    return null;
  }
  const rank = Math.ceil((p / 100) * sortedValues.length);
  return sortedValues[Math.min(sortedValues.length - 1, Math.max(0, rank - 1))];
}

function resolvePath(root, dottedPath) {
  return dottedPath.split(".").reduce((node, key) => (node === undefined || node === null ? undefined : node[key]), root);
}

/** Checks one anchor against a city object from the snapshot. */
export function checkAnchor(cityObject, anchor) {
  const actual = resolvePath(cityObject, anchor.path);
  switch (anchor.op) {
    case "includes":
      return Array.isArray(actual) && actual.includes(anchor.value);
    case "equals":
      return actual === anchor.value;
    case "matches":
      return typeof actual === "string" && new RegExp(anchor.value, "i").test(actual);
    case "anyMatches":
      return Array.isArray(actual) && actual.some((entry) => new RegExp(anchor.value, "i").test(String(entry)));
    case "noneMatch":
      return Array.isArray(actual) && !actual.some((entry) => new RegExp(anchor.value, "i").test(String(entry)));
    default:
      return false;
  }
}

/**
 * Confirms every anchor in the ground truth holds in the supplied snapshot.
 * Returns an array of { caseId, city, anchor } for anchors that do not hold.
 */
export function verifyGroundTruthAnchors(snapshot, cases = [...GROUND_TRUTH_CASES, ...KNOWN_GAP_CASES]) {
  const broken = [];
  for (const testCase of cases) {
    for (const [cityId, side] of Object.entries(testCase.expect)) {
      const cityObject = snapshot?.jurisdictions?.[cityId];
      for (const anchor of side.anchors || []) {
        if (!cityObject || !checkAnchor(cityObject, anchor)) {
          broken.push({ caseId: testCase.id, city: cityId, anchor });
        }
      }
    }
  }
  return broken;
}

/**
 * Expands the catalog into barcode-driven cases. A catalog item inherits the
 * expectation of the base case that shares its material category. Items whose
 * category has no anchored base case are returned in `unanchored` and are not
 * scored (the snapshot says nothing about them).
 */
export function buildCatalogCases(catalog = VERIFIED_BARCODE_CATALOG, baseCases = GROUND_TRUTH_CASES) {
  const baseByMaterial = new Map();
  for (const baseCase of baseCases) {
    if (baseCase.query.materialId && !baseCase.query.condition) {
      baseByMaterial.set(baseCase.query.materialId, baseCase);
    }
  }
  // Pizza box is anchored with a greasy condition; catalog entries use the same category.
  const pizzaCase = baseCases.find((entry) => entry.id === "pizza-box");
  if (pizzaCase) {
    baseByMaterial.set("greasy-pizza-box", pizzaCase);
  }

  const cases = [];
  const unanchored = [];
  for (const item of catalog) {
    const base = baseByMaterial.get(item.materialId);
    if (!base) {
      unanchored.push({ upc: item.upc, productName: item.productName, materialId: item.materialId });
      continue;
    }
    cases.push({
      id: `barcode-${item.upc}`,
      label: item.productName,
      group: "barcode",
      query: { barcode: item.upc },
      expect: base.expect
    });
  }
  return { cases, unanchored };
}

function emptyMatrix(labels) {
  const matrix = {};
  for (const truth of labels) {
    matrix[truth] = {};
    for (const predicted of labels) {
      matrix[truth][predicted] = 0;
    }
  }
  return matrix;
}

function barcodeDiagnostics(catalog) {
  const confusion = { tp: 0, fp: 0, fn: 0, tn: 0 };
  const record = (code, expectedValid) => {
    const predictedValid = validateBarcodeCheckDigit(code).valid;
    if (expectedValid && predictedValid) confusion.tp += 1;
    else if (expectedValid && !predictedValid) confusion.fn += 1;
    else if (!expectedValid && predictedValid) confusion.fp += 1;
    else confusion.tn += 1;
  };

  for (const vector of EXTERNAL_BARCODE_VECTORS) {
    record(vector.code, vector.valid);
  }
  for (const item of catalog) {
    record(item.upc, true);
    const body = item.upc.slice(0, -1);
    const wrongCheck = (Number(item.upc.slice(-1)) + 1) % 10;
    record(`${body}${wrongCheck}`, false);
  }

  let transpositionsTried = 0;
  let transpositionsDetected = 0;
  let undetectedExplained = 0;
  for (const item of catalog) {
    const digits = item.upc.split("");
    for (let i = 0; i < digits.length - 1; i += 1) {
      if (digits[i] === digits[i + 1]) {
        continue;
      }
      const swapped = [...digits];
      [swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]];
      transpositionsTried += 1;
      if (!validateBarcodeCheckDigit(swapped.join("")).valid) {
        transpositionsDetected += 1;
      } else if (Math.abs(Number(digits[i]) - Number(digits[i + 1])) === 5) {
        undetectedExplained += 1;
      }
    }
  }
  const undetected = transpositionsTried - transpositionsDetected;

  // Exhaustive single-digit substitutions: every position, every wrong digit.
  // The GS1 weights (1 and 3) are both coprime to 10, so the check must catch
  // all of them; this is a regression guard on the check-digit math itself.
  let substitutionsTried = 0;
  let substitutionsDetected = 0;
  for (const item of catalog) {
    const digits = item.upc.split("");
    for (let i = 0; i < digits.length; i += 1) {
      for (let d = 0; d <= 9; d += 1) {
        if (String(d) === digits[i]) {
          continue;
        }
        const mutated = [...digits];
        mutated[i] = String(d);
        substitutionsTried += 1;
        if (!validateBarcodeCheckDigit(mutated.join("")).valid) {
          substitutionsDetected += 1;
        }
      }
    }
  }

  return {
    confusion,
    accuracy: ratio(confusion.tp + confusion.tn, confusion.tp + confusion.tn + confusion.fp + confusion.fn),
    transpositions: {
      tried: transpositionsTried,
      detected: transpositionsDetected,
      undetected,
      undetectedExplainedByDigitGapOfFive: undetectedExplained,
      detectionRate: ratio(transpositionsDetected, transpositionsTried)
    },
    substitutions: {
      tried: substitutionsTried,
      detected: substitutionsDetected,
      detectionRate: ratio(substitutionsDetected, substitutionsTried)
    }
  };
}

/**
 * Runs the full benchmark. Options: { now, cases, catalog, includeCatalog }.
 * Returns a plain object; `latency` is the only non-deterministic section.
 */
export function runBenchmark(options = {}) {
  const now = options.now || defaultNow;
  const catalog = options.catalog || VERIFIED_BARCODE_CATALOG;
  const baseCases = options.cases || GROUND_TRUTH_CASES;
  const catalogExpansion = options.includeCatalog === false ? { cases: [], unanchored: [] } : buildCatalogCases(catalog, baseCases);
  const scoredCases = [...baseCases, ...catalogExpansion.cases];

  const cart = { tp: 0, fp: 0, fn: 0, tn: 0 };
  const streamMatrix = emptyMatrix(STREAM_ORDER);
  const tiers = Object.fromEntries(TIER_ORDER.map((tier) => [tier, { total: 0, cartTrue: 0, cartFalse: 0 }]));
  const failures = [];
  const samples = [];
  let evaluations = 0;
  let streamScored = 0;
  let streamCorrect = 0;
  const falsePositives = [];

  const grade = (testCase, cityId, side, evaluation) => {
    const predictedCart = evaluation.stream === "RECYCLE_CART";
    if (side.cart && predictedCart) cart.tp += 1;
    else if (side.cart && !predictedCart) cart.fn += 1;
    else if (!side.cart && predictedCart) cart.fp += 1;
    else cart.tn += 1;

    if (!side.cart && predictedCart) {
      falsePositives.push({ caseId: testCase.id, city: cityId, itemTitle: evaluation.itemTitle });
    }
    if (side.cart !== predictedCart) {
      failures.push({ caseId: testCase.id, city: cityId, field: "cart", expected: side.cart, actual: predictedCart });
    }

    const tier = tiers[evaluation.contaminationTier];
    tier.total += 1;
    if (side.cart) tier.cartTrue += 1;
    else tier.cartFalse += 1;

    if (side.stream) {
      streamScored += 1;
      streamMatrix[side.stream][evaluation.stream] += 1;
      if (side.stream === evaluation.stream) {
        streamCorrect += 1;
      } else {
        failures.push({ caseId: testCase.id, city: cityId, field: "stream", expected: side.stream, actual: evaluation.stream });
      }
    }
  };

  for (const testCase of scoredCases) {
    for (const cityId of CITY_IDS) {
      const side = testCase.expect[cityId];
      if (!side) {
        continue;
      }
      const start = now();
      const evaluation = evaluateItemDisposal({ ...testCase.query, city: cityId });
      const end = now();
      samples.push(Math.max(0, end - start));
      evaluations += 1;
      grade(testCase, cityId, side, evaluation);
    }
  }

  const knownGaps = [];
  for (const gapCase of KNOWN_GAP_CASES) {
    for (const cityId of CITY_IDS) {
      const side = gapCase.expect[cityId];
      if (!side) {
        continue;
      }
      const evaluation = evaluateItemDisposal({ ...gapCase.query, city: cityId });
      knownGaps.push({
        caseId: gapCase.id,
        label: gapCase.label,
        city: cityId,
        expectedStream: side.stream,
        actualStream: evaluation.stream,
        stillOpen: evaluation.stream !== side.stream,
        inferred: Boolean(gapCase.inferred),
        note: gapCase.note
      });
    }
  }

  const sortedSamples = [...samples].sort((a, b) => a - b);
  const total = cart.tp + cart.fp + cart.fn + cart.tn;
  const sampleSum = samples.reduce((acc, value) => acc + value, 0);

  const tierRows = TIER_ORDER.map((tier) => ({
    tier,
    total: tiers[tier].total,
    cartTrue: tiers[tier].cartTrue,
    cartFalse: tiers[tier].cartFalse,
    notCurbsideShare: ratio(tiers[tier].cartFalse, tiers[tier].total)
  }));

  return {
    meta: {
      groundTruth: GROUND_TRUTH_META.name,
      rulesSnapshot: { ...RULES_SNAPSHOT_META },
      baseCases: baseCases.length,
      catalogCases: catalogExpansion.cases.length,
      scoredCases: scoredCases.length,
      scoredEvaluations: evaluations,
      unanchoredCatalogItems: catalogExpansion.unanchored
    },
    cart: {
      ...cart,
      total,
      accuracy: ratio(cart.tp + cart.tn, total),
      precision: ratio(cart.tp, cart.tp + cart.fp),
      recall: ratio(cart.tp, cart.tp + cart.fn),
      falsePositiveRate: ratio(cart.fp, cart.fp + cart.tn)
    },
    stream: {
      labels: [...STREAM_ORDER],
      matrix: streamMatrix,
      scored: streamScored,
      correct: streamCorrect,
      accuracy: ratio(streamCorrect, streamScored)
    },
    tiers: tierRows,
    falsePositives,
    failures,
    knownGaps,
    barcode: barcodeDiagnostics(catalog),
    latency: {
      unit: "ms",
      samples: samples.length,
      p50: percentile(sortedSamples, 50),
      p95: percentile(sortedSamples, 95),
      max: sortedSamples.length ? sortedSamples[sortedSamples.length - 1] : null,
      mean: samples.length ? sampleSum / samples.length : null,
      totalMs: sampleSum
    }
  };
}

function stableRound(value) {
  return typeof value === "number" ? Math.round(value * 10000) / 10000 : value;
}

function roundRates(node) {
  if (Array.isArray(node)) {
    return node.map(roundRates);
  }
  if (node && typeof node === "object") {
    return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, roundRates(value)]));
  }
  return stableRound(node);
}

/** Deterministic JSON report. Latency is excluded unless includeLatency is true. */
export function benchmarkToJson(result, options = {}) {
  const { latency, ...rest } = result;
  const payload = { tool: "BinCheck benchmark", ...rest };
  if (options.includeLatency) {
    payload.latency = latency;
  }
  return `${JSON.stringify(roundRates(payload), null, 2)}\n`;
}

/** Plain-text report for the CLI. */
export function benchmarkToText(result, options = {}) {
  const pct = (value) => (value === null ? "n/a" : `${(value * 100).toFixed(1)}%`);
  const lines = [];
  lines.push("BinCheck calibration benchmark");
  lines.push(`Ground truth: ${result.meta.groundTruth} (rules verified ${result.meta.rulesSnapshot.lastVerifiedDate})`);
  lines.push(`Scored: ${result.meta.scoredCases} cases, ${result.meta.scoredEvaluations} city evaluations`);
  lines.push("");
  lines.push("Recycling cart routing (positive = engine routes item into the cart)");
  lines.push(`  TP ${result.cart.tp}  FP ${result.cart.fp}  FN ${result.cart.fn}  TN ${result.cart.tn}`);
  lines.push(`  accuracy ${pct(result.cart.accuracy)}  precision ${pct(result.cart.precision)}  recall ${pct(result.cart.recall)}  false positive rate ${pct(result.cart.falsePositiveRate)}`);
  lines.push("");
  lines.push(`Stream accuracy: ${result.stream.correct}/${result.stream.scored} (${pct(result.stream.accuracy)})`);
  lines.push("");
  lines.push("Risk tier calibration");
  for (const row of result.tiers) {
    lines.push(`  ${row.tier.padEnd(9)} total ${String(row.total).padStart(3)}  curbside ${String(row.cartTrue).padStart(3)}  not curbside ${String(row.cartFalse).padStart(3)}`);
  }
  lines.push("");
  const bc = result.barcode;
  lines.push(`Barcode check digit: accuracy ${pct(bc.accuracy)}  (TP ${bc.confusion.tp} FP ${bc.confusion.fp} FN ${bc.confusion.fn} TN ${bc.confusion.tn})`);
  const explained = bc.transpositions.undetected === bc.transpositions.undetectedExplainedByDigitGapOfFive;
  lines.push(`Adjacent transpositions detected: ${bc.transpositions.detected}/${bc.transpositions.tried} (${pct(bc.transpositions.detectionRate)})${explained ? "; every miss swaps digits that differ by 5" : ""}`);
  lines.push(`Single-digit substitutions detected: ${bc.substitutions.detected}/${bc.substitutions.tried} (${pct(bc.substitutions.detectionRate)})`);
  lines.push("");
  const open = result.knownGaps.filter((gap) => gap.stillOpen);
  const closed = result.knownGaps.filter((gap) => !gap.stillOpen);
  lines.push(`Inferred rule extensions (scored separately): ${closed.length} handled, ${open.length} open`);
  for (const gap of result.knownGaps) {
    lines.push(`  ${gap.stillOpen ? "OPEN  " : "OK    "}${gap.label} (${gap.city}): expected ${gap.expectedStream}, engine says ${gap.actualStream}`);
  }
  lines.push("");
  lines.push("Scope: these numbers measure agreement with the bundled municipal rules snapshot, not field accuracy at a real facility.");
  if (result.failures.length > 0) {
    lines.push("");
    lines.push(`FAILURES: ${result.failures.length}`);
    for (const failure of result.failures) {
      lines.push(`  ${failure.caseId} (${failure.city}) ${failure.field}: expected ${failure.expected}, got ${failure.actual}`);
    }
  }
  if (options.includeLatency) {
    lines.push("");
    const ms = (value) => (value === null ? "n/a" : `${value.toFixed(3)}ms`);
    lines.push(`Latency over ${result.latency.samples} evaluations: p50 ${ms(result.latency.p50)}  p95 ${ms(result.latency.p95)}  max ${ms(result.latency.max)}`);
  }
  return `${lines.join("\n")}\n`;
}
