import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialState,
  reduce,
  selectViewModel,
  resolveShortcut,
  SHORTCUTS,
  MAX_CART_ITEMS
} from "../src/state.js";
import {
  escapeHtml,
  renderBarcodeMathStrip,
  renderContaminationGauge,
  renderCart,
  renderCartRiskProfile,
  renderSingleEvaluation,
  renderComparisonView,
  renderBatchReport,
  renderBenchmark,
  renderPrintReport,
  renderShortcutList,
  streamLabel,
  formatPercent,
  formatMs
} from "../src/render.js";
import { scoreCartBatch, validateBarcodeCheckDigit, RESIN_CODE_METADATA } from "../src/bincheck-engine.js";
import { runBatchFromCsv, SAMPLE_BATCH_CSV } from "../js/bincheck-batch.js";
import { runBenchmark } from "../js/bincheck-benchmark.js";
import { encodeShareHash, decodeShareHash, assessEvidence, normalizeMaterialToken, normalizeQuery, EVIDENCE_BASES } from "../js/bincheck-validate.js";

const fixedClock = () => {
  let t = 0;
  return () => (t += 0.25);
};

/* ---------------- Reducer ---------------- */

test("state: initial state is a clean PET bottle in Riverside with a three-item cart", () => {
  const s = createInitialState();
  assert.equal(s.cityMode, "Riverside-tx");
  assert.equal(s.materialId, "resin-1-pet");
  assert.equal(s.batchItems.length, 3);
  assert.equal(s.batchResult, null);
});

test("state: unknown or malformed actions return the same object", () => {
  const s = createInitialState();
  assert.equal(reduce(s, null), s);
  assert.equal(reduce(s, { type: 42 }), s);
  assert.equal(reduce(s, { type: "NOPE" }), s);
});

test("state: SET_CITY_MODE accepts the three modes and ignores anything else", () => {
  const s = createInitialState();
  for (const mode of ["houston-tx", "compare", "Riverside-tx"]) {
    assert.equal(reduce(s, { type: "SET_CITY_MODE", mode }).cityMode, mode);
  }
  assert.equal(reduce(s, { type: "SET_CITY_MODE", mode: "austin-tx" }), s);
});

test("state: COMMIT_BARCODE on a catalog code adopts its material and resin", () => {
  const s = reduce(createInitialState({ materialId: "glass-jar-bottle", resinCode: null }), { type: "COMMIT_BARCODE", raw: " 041220576463 " });
  assert.equal(s.barcode, "041220576463");
  assert.equal(s.materialId, "resin-1-pet");
  assert.equal(s.resinCode, 1);
  assert.match(s.notice, /^Matched /);
});

test("state: COMMIT_BARCODE explains a rejected check digit and an empty field", () => {
  const bad = reduce(createInitialState(), { type: "COMMIT_BARCODE", raw: "041220576464" });
  assert.match(bad.notice, /^Barcode rejected: Invalid UPC-A check digit/);
  const empty = reduce(createInitialState(), { type: "COMMIT_BARCODE", raw: "   " });
  assert.equal(empty.notice, "Barcode cleared.");
});

test("state: COMMIT_BARCODE on a valid code outside the catalog keeps the chosen category", () => {
  const s = reduce(createInitialState({ materialId: "resin-5-pp", resinCode: 5 }), { type: "COMMIT_BARCODE", raw: "036000291452" });
  assert.equal(s.materialId, "resin-5-pp");
  assert.match(s.notice, /not in the demo catalog/);
});

test("state: TYPE_BARCODE stores a capped draft without committing", () => {
  const s = reduce(createInitialState(), { type: "TYPE_BARCODE", raw: "9".repeat(80) });
  assert.equal(s.draftBarcode.length, 40);
  assert.equal(s.barcode, "041220576463");
});

test("state: SELECT_RESIN and SELECT_MATERIAL clear the barcode and keep resin in sync", () => {
  const r = reduce(createInitialState(), { type: "SELECT_RESIN", code: 6 });
  assert.equal(r.resinCode, 6);
  assert.equal(r.materialId, "resin-6-ps-foam");
  assert.equal(r.barcode, "");
  assert.equal(reduce(r, { type: "SELECT_RESIN", code: 9 }), r);

  const m = reduce(r, { type: "SELECT_MATERIAL", materialId: "lithium-household-battery" });
  assert.equal(m.resinCode, null);
  assert.equal(reduce(m, { type: "SELECT_MATERIAL", materialId: "<script>" }), m);
});

test("state: SET_CONDITION accepts only the four known conditions", () => {
  const s = createInitialState();
  assert.equal(reduce(s, { type: "SET_CONDITION", condition: "greasy" }).condition, "greasy");
  assert.equal(reduce(s, { type: "SET_CONDITION", condition: "wet" }), s);
});

test("state: APPLY_DEMO can force compare mode and rejects unknown materials", () => {
  const s = reduce(createInitialState(), {
    type: "APPLY_DEMO",
    scenario: { barcode: "073287001060", materialId: "resin-6-ps-foam", resinCode: 6, condition: "clean", forceMode: "compare" }
  });
  assert.equal(s.cityMode, "compare");
  assert.equal(s.materialId, "resin-6-ps-foam");
  const base = createInitialState();
  assert.equal(reduce(base, { type: "APPLY_DEMO", scenario: { materialId: "unobtainium" } }), base);
});

test("state: the cart adds, removes by index, rejects bad indexes, clears, and caps at MAX_CART_ITEMS", () => {
  let s = reduce(createInitialState(), { type: "ADD_TO_CART" });
  assert.equal(s.batchItems.length, 4);
  s = reduce(s, { type: "REMOVE_FROM_CART", index: 0 });
  assert.equal(s.batchItems.length, 3);
  assert.equal(reduce(s, { type: "REMOVE_FROM_CART", index: 99 }), s);
  assert.equal(reduce(s, { type: "REMOVE_FROM_CART", index: -1 }), s);
  assert.equal(reduce(s, { type: "REMOVE_FROM_CART", index: 1.5 }), s);
  assert.equal(reduce(s, { type: "CLEAR_CART" }).batchItems.length, 0);

  let full = createInitialState({ batchItems: [] });
  for (let i = 0; i < MAX_CART_ITEMS + 5; i += 1) full = reduce(full, { type: "ADD_TO_CART" });
  assert.equal(full.batchItems.length, MAX_CART_ITEMS);
  assert.match(full.notice, /Cart is full/);
});

test("state: HYDRATE applies only validated fields and backfills material from a catalog barcode", () => {
  const s = reduce(createInitialState(), {
    type: "HYDRATE",
    patch: { cityMode: "houston-tx", barcode: "039800084118", condition: "broken" }
  });
  assert.equal(s.cityMode, "houston-tx");
  assert.equal(s.materialId, "lithium-household-battery");
  assert.equal(s.condition, "broken");
  const ignored = reduce(createInitialState(), { type: "HYDRATE", patch: { cityMode: "mars", materialId: "x", condition: "y", resinCode: 11 } });
  assert.equal(ignored.cityMode, "Riverside-tx");
  assert.equal(ignored.materialId, "resin-1-pet");
});

test("state: resin-only hashes replace inherited identifiers with the polymer default", () => {
  const original = createInitialState({ draftBarcode: "123" });
  for (let code = 1; code <= 7; code += 1) {
    for (const barcodePart of ["", "&b="]) {
      const { patch, issues } = decodeShareHash(`#r=${code}${barcodePart}`);
      const state = reduce(original, { type: "HYDRATE", patch });
      assert.deepEqual(issues, []);
      assert.equal(state.barcode, "");
      assert.equal(state.draftBarcode, null);
      assert.equal(state.materialId, RESIN_CODE_METADATA[code].defaultMaterialId);
      assert.equal(state.resinCode, code);
      assert.equal(selectViewModel(state).assessment.confidence, "MEDIUM");
    }
  }
  assert.equal(original.barcode, "041220576463", "hydration does not mutate the starting state");
  const foam = reduce(original, { type: "HYDRATE", patch: decodeShareHash("#r=6&c=houston-tx").patch });
  assert.equal(selectViewModel(foam).evaluation.stream, "TRASH_CART");
  const pvc = reduce(original, { type: "HYDRATE", patch: decodeShareHash("#r=3").patch });
  assert.equal(selectViewModel(pvc).evaluation.stream, "TRASH_CART");
});

test("state: hydration preserves supplied resin conflicts after catalog identification", () => {
  const state = reduce(createInitialState(), {
    type: "HYDRATE",
    patch: decodeShareHash("#b=041220576463&r=3").patch
  });
  assert.equal(state.materialId, "resin-1-pet");
  assert.equal(state.resinCode, 3);
  assert.equal(selectViewModel(state).assessment.confidence, "LOW");
});

test("state: batch actions load the sample, run it, surface blocking parse errors, and clear", () => {
  let s = reduce(createInitialState(), { type: "LOAD_SAMPLE_CSV" });
  assert.equal(s.csvText, SAMPLE_BATCH_CSV);
  s = reduce(s, { type: "RUN_BATCH" });
  assert.equal(s.batchResult.totals.rows, 9);
  assert.match(s.notice, /^Inspected 9 rows/);
  const empty = reduce(createInitialState(), { type: "RUN_BATCH" });
  assert.equal(empty.notice, "Paste CSV text or choose a file first.");
  assert.equal(reduce(s, { type: "CLEAR_BATCH" }).batchResult, null);
});

test("state: SET_BENCHMARK ignores malformed results; notices are capped and clearable", () => {
  const s = createInitialState();
  assert.equal(reduce(s, { type: "SET_BENCHMARK", result: {} }), s);
  const done = reduce(s, { type: "SET_BENCHMARK", result: runBenchmark({ now: fixedClock() }) });
  assert.match(done.notice, /^Benchmark finished: 0 failures across \d+ evaluations\.$/);
  const long = reduce(s, { type: "SET_NOTICE", text: "x".repeat(900) });
  assert.equal(long.notice.length, 400);
  const cleared = reduce(long, { type: "CLEAR_NOTICE" });
  assert.equal(cleared.notice, "");
  assert.equal(reduce(cleared, { type: "CLEAR_NOTICE" }), cleared, "clearing an empty notice does not re-render");
});

test("state: the reducer never mutates its input (frozen state survives every action)", () => {
  const deepFreeze = (o) => {
    Object.freeze(o);
    for (const v of Object.values(o)) if (v && typeof v === "object" && !Object.isFrozen(v)) deepFreeze(v);
    return o;
  };
  const s = deepFreeze(createInitialState());
  const actions = [
    { type: "SET_CITY_MODE", mode: "compare" },
    { type: "COMMIT_BARCODE", raw: "049000006346" },
    { type: "SELECT_RESIN", code: 2 },
    { type: "ADD_TO_CART" },
    { type: "REMOVE_FROM_CART", index: 0 },
    { type: "LOAD_SAMPLE_CSV" },
    { type: "HYDRATE", patch: { condition: "greasy" } }
  ];
  for (const action of actions) assert.doesNotThrow(() => reduce(s, action), action.type);
});

/* ---------------- View model and shortcuts ---------------- */

test("view model: compare mode has no single evaluation and a two-city live summary", () => {
  const vm = selectViewModel(createInitialState({ cityMode: "compare" }));
  assert.equal(vm.evaluation, null);
  assert.match(vm.liveSummary, /Riverside: .*Houston: /);
  assert.equal(vm.shareHash, encodeShareHash(createInitialState({ cityMode: "compare" })));
});

test("view model: a draft barcode drives the status line before it is committed", () => {
  const vm = selectViewModel(createInitialState({ draftBarcode: "12345" }));
  assert.equal(vm.barcodeStatus.tone, "invalid");
  assert.equal(vm.barcodeStatus.invalid, true);
  const idle = selectViewModel(createInitialState({ barcode: "", draftBarcode: null }));
  assert.equal(idle.barcodeStatus.tone, "idle");
  assert.equal(idle.barcodeCheck, null);
});

test("shortcuts: every listed key resolves, modifiers and typing suppress them, Escape always closes", () => {
  for (const entry of SHORTCUTS) {
    assert.equal(resolveShortcut({ key: entry.key, targetTag: "BODY" }), entry.id, entry.key);
  }
  assert.equal(resolveShortcut({ key: "S", targetTag: "BODY" }), "city-Riverside-tx", "case-insensitive letters");
  assert.equal(resolveShortcut({ key: "s", ctrlKey: true }), null);
  assert.equal(resolveShortcut({ key: "s", metaKey: true }), null);
  assert.equal(resolveShortcut({ key: "a", targetTag: "INPUT" }), null);
  assert.equal(resolveShortcut({ key: "a", targetTag: "TEXTAREA" }), null);
  assert.equal(resolveShortcut({ key: "a", targetTag: "DIV", isContentEditable: true }), null);
  assert.equal(resolveShortcut({ key: "Escape", targetTag: "INPUT" }), "close-help");
  assert.equal(resolveShortcut({ key: "z" }), null);
  assert.equal(resolveShortcut(null), null);
  const keys = SHORTCUTS.map((s) => s.key.toLowerCase());
  assert.equal(new Set(keys).size, keys.length, "no duplicate shortcut keys");
});

test("shortcuts: the single-key toggle suppresses printable keys but never Escape", () => {
  for (const entry of SHORTCUTS) {
    if (entry.key === "Escape") continue;
    assert.equal(resolveShortcut({ key: entry.key, targetTag: "BODY" }, false), null, `${entry.key} disabled`);
  }
  assert.equal(resolveShortcut({ key: "Escape", targetTag: "BODY" }, false), "close-help", "Escape always resolves");
  assert.equal(resolveShortcut({ key: "Escape", targetTag: "INPUT" }, false), "close-help");
  assert.equal(resolveShortcut({ key: "d", targetTag: "BODY" }, true), "download-report", "enabled default unchanged");

  const off = reduce(createInitialState(), { type: "SET_SINGLE_KEY_SHORTCUTS", enabled: false });
  assert.equal(off.singleKeyShortcuts, false);
  assert.match(off.notice, /off/i);
  const again = reduce(off, { type: "SET_SINGLE_KEY_SHORTCUTS", enabled: false });
  assert.equal(again, off, "a redundant toggle returns the same state");
  const on = reduce(off, { type: "SET_SINGLE_KEY_SHORTCUTS", enabled: true });
  assert.equal(on.singleKeyShortcuts, true);
  assert.match(on.notice, /on/i);
  assert.equal(createInitialState().singleKeyShortcuts, true, "defaults on");
});

/* ---------------- Share links ---------------- */

test("share hash: encode then decode round-trips every field", () => {
  const state = { cityMode: "houston-tx", barcode: "0412-2057 6463", materialId: "resin-5-pp", resinCode: 5, condition: "greasy" };
  const hash = encodeShareHash(state);
  assert.equal(hash, "#c=houston-tx&b=041220576463&m=resin-5-pp&r=5&k=greasy");
  const { patch, issues } = decodeShareHash(hash);
  assert.deepEqual(patch, { cityMode: "houston-tx", barcode: "041220576463", materialId: "resin-5-pp", resinCode: 5, condition: "greasy" });
  assert.equal(issues.length, 0);
});

test("share hash: encoder never emits a barcode its own decoder would reject", () => {
  for (const barcode of ["abc", "12ab", "123456789012345", "<img>", "0000000000000000000001"]) {
    const hash = encodeShareHash({ cityMode: "houston-tx", barcode });
    assert.equal(/(^|[#&])b=/.test(hash), false, `encodeShareHash must not emit b= for ${barcode}`);
  }
  assert.match(encodeShareHash({ barcode: "041220576463" }), /(^|[#&])b=041220576463/, "digits still encode");
  assert.match(encodeShareHash({ barcode: "0" }), /(^|[#&])b=0/, "single zero digit encodes");
});

test("share hash: hostile or malformed input is dropped with a reason and never throws", () => {
  const cases = [
    "#c=paris&b=12ab&m=%3Cimg%3E&r=0&k=soggy",
    "#b=%E0%A4%A",
    `#${"b=1&".repeat(200)}`,
    "#=x&&c",
    null,
    undefined
  ];
  for (const hash of cases) {
    assert.doesNotThrow(() => decodeShareHash(hash));
  }
  const { patch, issues } = decodeShareHash(cases[0]);
  assert.deepEqual(patch, {});
  assert.deepEqual(issues.map((i) => i.code).sort(), ["BARCODE_INVALID", "INVALID_CITY", "INVALID_RESIN", "UNKNOWN_CONDITION", "UNKNOWN_MATERIAL"]);
  assert.equal(decodeShareHash(cases[2]).issues[0].code, "HASH_TOO_LONG");
  assert.equal(decodeShareHash("#c=compare&c=houston-tx").patch.cityMode, "compare", "first duplicate key wins");
});

/* ---------------- Evidence ---------------- */

test("evidence: ladder ranks are 1..4 and each basis maps to a confidence", () => {
  assert.deepEqual(EVIDENCE_BASES.map((b) => b.rank), [1, 2, 3, 4]);
  assert.equal(assessEvidence({ barcode: "041220576463" }).confidence, "HIGH");
  assert.equal(assessEvidence({ materialId: "resin-5-pp" }).basis, EVIDENCE_BASES[1].id);
  assert.equal(assessEvidence({ resinCode: 3 }).basis, EVIDENCE_BASES[2].id);
  assert.equal(assessEvidence({}).basis, EVIDENCE_BASES[3].id);
  assert.equal(assessEvidence({}).confidence, "LOW");
});

test("evidence: contradictory resin stamps lower confidence for catalog and selected materials", () => {
  for (const query of [
    { barcode: "041220576463", resin: 3 },
    { barcode: "041220576463", materialId: "resin-1-pet", resinCode: 3 },
    { materialId: RESIN_CODE_METADATA[3].defaultMaterialId, resinCode: 1 },
    { materialId: "glass-jar-bottle", resinCode: 1 }
  ]) {
    const assessment = assessEvidence(query);
    assert.equal(assessment.confidence, "LOW");
    const conflict = assessment.issues.find((entry) => entry.code === "RESIN_MATERIAL_CONFLICT");
    assert.equal(conflict.severity, "warning");
    assert.equal(conflict.field, "resinCode");
    assert.match(assessment.confidenceReason, /contradict/);
  }
  const catalog = assessEvidence({ barcode: "041220576463", resinCode: 1 });
  assert.equal(catalog.confidence, "HIGH");
  assert.ok(!catalog.issues.some((entry) => entry.code === "RESIN_MATERIAL_CONFLICT"));
  const fullJug = assessEvidence({ materialId: "resin-2-hdpe", resinCode: 2, condition: "liquid-full" });
  assert.equal(fullJug.confidence, "MEDIUM", "condition transforms do not change the identified polymer");
  assert.ok(!fullJug.issues.some((entry) => entry.code === "RESIN_MATERIAL_CONFLICT"));
});

test("validation: prototype property names cannot identify a material or enter a share patch", () => {
  for (const token of ["constructor", "__proto__", "toString", "valueOf", "hasOwnProperty", "isPrototypeOf"]) {
    assert.equal(normalizeMaterialToken(token), null, token);
    const normalized = normalizeQuery({ materialId: token });
    assert.equal(normalized.query.materialId, undefined);
    assert.equal(normalized.issues[0].code, "UNKNOWN_MATERIAL");
    const assessment = assessEvidence({ materialId: token });
    assert.equal(assessment.basis, "FALLBACK_DEFAULT");
    assert.equal(assessment.confidence, "LOW");
    const decoded = decodeShareHash(`#m=${encodeURIComponent(token)}`);
    assert.deepEqual(decoded.patch, {});
    assert.equal(decoded.issues[0].code, "UNKNOWN_MATERIAL");
  }
  assert.equal(normalizeMaterialToken(" Resin_2_HDPE "), "resin-2-hdpe");
});

/* ---------------- Renderers ---------------- */

test("render: escapeHtml neutralizes every markup character", () => {
  assert.equal(escapeHtml(`<a href="x" onclick='y'>&</a>`), "&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;");
  assert.equal(escapeHtml(null), "");
});

test("render: user-controlled CSV labels never reach the page as markup", () => {
  const result = runBatchFromCsv('label,barcode\n"<img src=x onerror=alert(1)>",041220576463\n');
  const html = renderBatchReport(result);
  assert.ok(!html.includes("<img src=x"), "raw tag must be escaped");
  assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"));
});

test("render: barcode math strip covers idle, invalid and valid states", () => {
  assert.match(renderBarcodeMathStrip(null), /idle/);
  assert.match(renderBarcodeMathStrip(validateBarcodeCheckDigit("041220576464")), /math-chip-err/);
  const ok = renderBarcodeMathStrip(validateBarcodeCheckDigit("041220576463"));
  assert.match(ok, /Payload: <strong>04122057646<\/strong>/);
  assert.match(ok, /EAN-13: <strong>0041220576463<\/strong>/);
});

test("render: the gauge clamps out-of-range scores and exposes a meter role", () => {
  const html = renderContaminationGauge(250, "CRITICAL", "x");
  assert.match(html, /role="meter" aria-valuenow="100"/);
  assert.match(html, /left: 100%/);
  assert.match(renderContaminationGauge(-5, "LOW", "x"), /aria-valuenow="0"/);
});

test("render: cart summary picks the right badge for empty, clean, fix-needed and rejected loads", () => {
  assert.match(renderCart(scoreCartBatch([], "Riverside-tx")).badgeText, /Cart empty/);
  const clean = renderCart(scoreCartBatch([{ materialId: "aluminum-steel-can" }], "Riverside-tx"));
  assert.match(clean.badgeClass, /RECYCLE_CART/);
  const fix = renderCart(scoreCartBatch([{ materialId: "greasy-pizza-box" }], "Riverside-tx"));
  assert.match(fix.badgeText, /Preparation needed/);
  const bad = renderCart(scoreCartBatch([{ materialId: "lithium-household-battery" }, { materialId: "resin-4-ldpe-film" }], "houston-tx"));
  assert.match(bad.badgeText, /Contaminated load alert \(2 hazard or tangler items\)/);
});

test("render: the cart risk profile draws one bar per item, threshold lines, and an accessible label", () => {
  const summary = scoreCartBatch(
    [{ materialId: "aluminum-steel-can" }, { materialId: "greasy-pizza-box" }, { materialId: "lithium-household-battery" }],
    "Riverside-tx"
  );
  const svg = renderCartRiskProfile(summary);
  assert.equal((svg.match(/ rx="2" fill="/g) || []).length, 3, "one bar per item (the plot frame is not a bar)");
  assert.equal((svg.match(/class="cart-threshold/g) || []).length, 3);
  assert.match(svg, /aria-label="Risk profile of 3 cart items: average \d+, maximum 100 out of 100"/);
  assert.equal(renderCartRiskProfile(scoreCartBatch([], "Riverside-tx")), "");
  // Bar height is proportional to risk: the battery bar (100) is the tallest.
  const heights = [...svg.matchAll(/height="([\d.]+)" rx="2"/g)].map((m) => Number(m[1]));
  assert.equal(Math.max(...heights), heights[2]);
});

test("render: single and comparison views cite the official source and the snapshot date", () => {
  const vm = selectViewModel(createInitialState());
  const single = renderSingleEvaluation(vm.evaluation, vm.assessment);
  assert.match(single, /Official source:/);
  assert.match(single, /Rules verified 2026-10-20/);
  const cmp = renderComparisonView(vm.comparison, vm.assessment);
  assert.match(cmp, /Sources: .*Riverside.*Houston/s);
  assert.match(cmp, /target="_blank" rel="noopener noreferrer"/);
});

test("render: the benchmark view labels its numbers as computed and states its scope", () => {
  const html = renderBenchmark(runBenchmark({ now: fixedClock() }));
  assert.match(html, /data-badge is-computed/);
  assert.match(html, /not field accuracy/);
  assert.match(html, /Substitutions caught/);
  assert.match(html, /Inferred rule extensions: 2 handled, 0 open/);
  assert.match(html, /Every scored case matched/);
});

test("render: print report includes both cities and the batch table when a batch exists", () => {
  const state = reduce(reduce(createInitialState(), { type: "LOAD_SAMPLE_CSV" }), { type: "RUN_BATCH" });
  const html = renderPrintReport(selectViewModel(state), state.batchResult);
  assert.match(html, /City of Riverside/);
  assert.match(html, /City of Houston/);
  assert.match(html, /Batch inspection summary/);
  assert.ok(!renderPrintReport(selectViewModel(createInitialState()), null).includes("Batch inspection summary"));
});

test("render: helpers format consistently", () => {
  assert.equal(streamLabel("RECYCLE_CART").length > 0, true);
  assert.equal(formatPercent(0.5), "50.0%");
  assert.equal(formatPercent(null), "n/a");
  assert.match(formatMs(0.0123), /ms$/);
  assert.equal((renderShortcutList().match(/<li>/g) || []).length, SHORTCUTS.length);
});

/* ---------------- Query normalization and evidence edge cases ---------------- */


test("normalize: city is optional, but a present unknown city is an error and is dropped", () => {
  assert.deepEqual(normalizeQuery({}).issues, []);
  assert.equal(normalizeQuery({ city: "" }).issues.length, 0);
  assert.equal(normalizeQuery({ city: null }).issues.length, 0);
  const bad = normalizeQuery({ city: "dallas-tx" });
  assert.equal(bad.issues[0].code, "INVALID_CITY");
  assert.equal(bad.query.city, undefined);
  assert.equal(normalizeQuery({ city: "houston-tx" }).query.city, "houston-tx");
});

test("normalize: unknown material, bad resin and unknown condition are reported, condition falls back to clean", () => {
  const { query, issues } = normalizeQuery({ material: "moon-rock", resin: "12", condition: "Soggy" });
  assert.deepEqual(issues.map((i) => i.code), ["UNKNOWN_MATERIAL", "INVALID_RESIN", "UNKNOWN_CONDITION"]);
  assert.equal(query.condition, "clean");
  assert.equal(normalizeQuery("not an object").query.condition, "clean");
});

test("evidence: a condition that does not apply to the material is flagged, and only then", () => {
  const codes = (q) => assessEvidence(q).issues.map((i) => i.code);
  assert.ok(codes({ materialId: "aluminum-steel-can", condition: "liquid-full" }).includes("CONDITION_NOT_APPLICABLE"));
  assert.ok(!codes({ materialId: "resin-1-pet", condition: "liquid-full" }).includes("CONDITION_NOT_APPLICABLE"));
  assert.ok(codes({ materialId: "resin-5-pp", condition: "broken" }).includes("CONDITION_NOT_APPLICABLE"));
  assert.ok(!codes({ materialId: "glass-jar-bottle", condition: "broken" }).includes("CONDITION_NOT_APPLICABLE"));
  assert.ok(!codes({ materialId: "resin-5-pp", condition: "clean" }).includes("CONDITION_NOT_APPLICABLE"));
});

test("evidence: grease-soaked cardboard carries the inference advisory; clean cardboard and greasy plastic do not", () => {
  const codes = (q) => assessEvidence(q).issues.map((i) => i.code);
  const greasy = assessEvidence({ materialId: "clean-cardboard-paper", condition: "greasy" });
  assert.equal(greasy.resolvedMaterialId, "soiled-cardboard-paper");
  assert.ok(greasy.issues.some((i) => i.code === "GREASY_PAPER_ADVISORY" && /inference/.test(i.message)));
  assert.ok(!codes({ materialId: "clean-cardboard-paper", condition: "clean" }).includes("GREASY_PAPER_ADVISORY"));
  assert.ok(!codes({ materialId: "resin-5-pp", condition: "greasy" }).includes("GREASY_PAPER_ADVISORY"));
});

test("evidence: a failed check digit downgrades confidence to low; a valid one does not", () => {
  const bad = assessEvidence({ barcode: "041220576464", materialId: "resin-1-pet" });
  assert.equal(bad.confidence, "LOW");
  assert.match(bad.confidenceReason, /failed its check digit/);
  const good = assessEvidence({ barcode: "036000291452", materialId: "resin-1-pet" });
  assert.notEqual(good.confidence, "LOW");
  const conflict = assessEvidence({ barcode: "041220576463", materialId: "glass-jar-bottle" });
  assert.equal(conflict.confidence, "LOW");
  assert.ok(conflict.issues.some((i) => i.code === "BARCODE_MATERIAL_CONFLICT"));
  const fallback = assessEvidence({ barcode: "041220576464" });
  assert.equal(fallback.confidence, "LOW");
  assert.ok(!/failed its check digit/.test(fallback.confidenceReason), "already low, no duplicate reason");
});

import { parseResinCode } from "../js/bincheck-validate.js";

test("resin parsing: exact result objects for empty, malformed, out-of-range and valid input", () => {
  assert.deepEqual(parseResinCode(undefined), { empty: true, valid: false, code: null });
  assert.deepEqual(parseResinCode(null), { empty: true, valid: false, code: null });
  assert.deepEqual(parseResinCode("  # "), { empty: true, valid: false, code: null });
  assert.deepEqual(parseResinCode("3a"), { empty: false, valid: false, code: null });
  assert.deepEqual(parseResinCode("8"), { empty: false, valid: false, code: null });
  assert.deepEqual(parseResinCode(" #5 "), { empty: false, valid: true, code: 5 });
  assert.deepEqual(parseResinCode(7), { empty: false, valid: true, code: 7 });
});

test("render: latency below the browser timer floor is labeled, never shown as 0.000 ms", () => {
  assert.equal(formatMs(0, 0.1), "under 0.1 ms");
  assert.equal(formatMs(0.25, 0.1), "0.250 ms");
  assert.equal(formatMs(0), "0.000 ms", "the CLI path keeps raw precision");
});
