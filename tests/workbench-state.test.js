import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { encodeShareHash, decodeShareHash } from "../js/bincheck-validate.js";
import { WORKBENCH_PRESETS, WORKBENCH_PRESET_IDS, MRF_PROFILE_IDS, MUNICIPAL_BASKET_IDS } from "../js/bincheck-municipal.js";
import { CASCADE_SCENARIO_IDS, CASCADE_MAX_COUNT } from "../js/bincheck-cascade.js";
import { createInitialState, reduce, selectViewModel } from "../src/state.js";
import {
  renderMunicipalDiff,
  renderCascadeLab,
  renderAuditPanel,
  renderAuditVerify,
  renderSelfTests
} from "../src/workbench-render.js";
import { buildSignedAudit, verifySignedAudit, signedAuditToJson } from "../js/bincheck-audit.js";
import { runSelfTests } from "../js/bincheck-selftest.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const indexHtml = readFileSync(join(repoRoot, "index.html"), "utf8");

/* ---------------- initial state ---------------- */

test("state: workbench defaults are all valid registered ids", () => {
  const s = createInitialState();
  assert.ok(MRF_PROFILE_IDS.includes(s.municipalProfileA));
  assert.ok(MRF_PROFILE_IDS.includes(s.municipalProfileB));
  assert.ok(MUNICIPAL_BASKET_IDS.includes(s.municipalBasket));
  assert.deepEqual(s.cascadeCounts, {});
  assert.equal(s.workbenchPreset, null);
  assert.equal(s.selfTestResult, null);
  assert.equal(s.auditInput, "");
  assert.equal(s.auditResult, null);
});

test("state: overriding workbench fields on creation works", () => {
  const s = createInitialState({ municipalProfileA: "houston-tx", cascadeCounts: { "film-tangler": 2 } });
  assert.equal(s.municipalProfileA, "houston-tx");
  assert.equal(s.cascadeCounts["film-tangler"], 2);
});

/* ---------------- SET_MUNICIPAL_PROFILE / SET_MUNICIPAL_BASKET ---------------- */

test("reducer: SET_MUNICIPAL_PROFILE writes slot A and slot B independently", () => {
  const s0 = createInitialState();
  const s1 = reduce(s0, { type: "SET_MUNICIPAL_PROFILE", slot: "A", profileId: "houston-tx" });
  assert.equal(s1.municipalProfileA, "houston-tx");
  assert.equal(s1.municipalProfileB, "dual-stream-glass-out");
  const s2 = reduce(s1, { type: "SET_MUNICIPAL_PROFILE", slot: "B", profileId: "organics-mandatory" });
  assert.equal(s2.municipalProfileA, "houston-tx");
  assert.equal(s2.municipalProfileB, "organics-mandatory");
});

test("reducer: SET_MUNICIPAL_PROFILE rejects unknown ids and bad slots as no-ops", () => {
  const s0 = createInitialState();
  for (const action of [
    { type: "SET_MUNICIPAL_PROFILE", slot: "A", profileId: "not-a-profile" },
    { type: "SET_MUNICIPAL_PROFILE", slot: "A", profileId: "" },
    { type: "SET_MUNICIPAL_PROFILE", slot: "A", profileId: null },
    { type: "SET_MUNICIPAL_PROFILE", slot: "C", profileId: "houston-tx" },
    { type: "SET_MUNICIPAL_PROFILE", slot: "a", profileId: "houston-tx" },
    { type: "SET_MUNICIPAL_PROFILE", profileId: "houston-tx" }
  ]) {
    assert.equal(reduce(s0, action), s0, JSON.stringify(action));
  }
});

test("reducer: SET_MUNICIPAL_BASKET accepts registered baskets only", () => {
  const s0 = createInitialState();
  const s1 = reduce(s0, { type: "SET_MUNICIPAL_BASKET", basketId: "kitchen-week" });
  assert.equal(s1.municipalBasket, "kitchen-week");
  assert.equal(reduce(s0, { type: "SET_MUNICIPAL_BASKET", basketId: "kitchen" }), s0);
  assert.equal(reduce(s0, { type: "SET_MUNICIPAL_BASKET", basketId: 42 }), s0);
});

test("reducer: changing any diff control clears the applied preset flag", () => {
  const s0 = reduce(createInitialState(), { type: "APPLY_WORKBENCH_PRESET", presetId: "diff-glass-out" });
  assert.equal(s0.workbenchPreset, "diff-glass-out");
  for (const action of [
    { type: "SET_MUNICIPAL_PROFILE", slot: "A", profileId: "houston-tx" },
    { type: "SET_MUNICIPAL_BASKET", basketId: "everything" },
    { type: "SET_CASCADE_COUNT", scenarioId: "film-tangler", count: 1 }
  ]) {
    assert.equal(reduce(s0, action).workbenchPreset, null);
  }
});

/* ---------------- cascade counts ---------------- */

test("reducer: SET_CASCADE_COUNT sets, updates, clamps and deletes at zero", () => {
  let s = createInitialState();
  s = reduce(s, { type: "SET_CASCADE_COUNT", scenarioId: "film-tangler", count: 3 });
  assert.equal(s.cascadeCounts["film-tangler"], 3);
  s = reduce(s, { type: "SET_CASCADE_COUNT", scenarioId: "film-tangler", count: 99 });
  assert.equal(s.cascadeCounts["film-tangler"], CASCADE_MAX_COUNT);
  s = reduce(s, { type: "SET_CASCADE_COUNT", scenarioId: "film-tangler", count: 0 });
  assert.deepEqual(s.cascadeCounts, {});
});

test("reducer: SET_CASCADE_COUNT ignores unknown scenario ids", () => {
  const s0 = createInitialState();
  assert.equal(reduce(s0, { type: "SET_CASCADE_COUNT", scenarioId: "made-up", count: 5 }), s0);
  const s1 = reduce(s0, { type: "SET_CASCADE_COUNT", scenarioId: "lithium-ignition", count: -3 });
  assert.deepEqual(s1.cascadeCounts, {});
});

test("reducer: RESET_CASCADE clears all counts and reports a notice", () => {
  let s = createInitialState();
  s = reduce(s, { type: "SET_CASCADE_COUNT", scenarioId: "film-tangler", count: 4 });
  s = reduce(s, { type: "RESET_CASCADE" });
  assert.deepEqual(s.cascadeCounts, {});
  assert.match(s.notice, /reset/i);
  const idleState = createInitialState();
  assert.equal(reduce(idleState, { type: "RESET_CASCADE" }), idleState, "reset on an empty lab is a no-op");
});

test("reducer: every scenario id is accepted by SET_CASCADE_COUNT", () => {
  let s = createInitialState();
  for (const id of CASCADE_SCENARIO_IDS) {
    s = reduce(s, { type: "SET_CASCADE_COUNT", scenarioId: id, count: 2 });
  }
  assert.equal(Object.keys(s.cascadeCounts).length, CASCADE_SCENARIO_IDS.length);
});

/* ---------------- presets ---------------- */

test("reducer: APPLY_WORKBENCH_PRESET applies the full patch", () => {
  for (const presetId of WORKBENCH_PRESET_IDS) {
    const s = reduce(createInitialState(), { type: "APPLY_WORKBENCH_PRESET", presetId });
    const patch = WORKBENCH_PRESETS[presetId].patch;
    assert.equal(s.workbenchPreset, presetId);
    if (patch.profileA) assert.equal(s.municipalProfileA, patch.profileA);
    if (patch.profileB) assert.equal(s.municipalProfileB, patch.profileB);
    if (patch.basketId) assert.equal(s.municipalBasket, patch.basketId);
    if (patch.cascadeCounts) assert.deepEqual(s.cascadeCounts, { ...patch.cascadeCounts });
    assert.match(s.notice, /loaded/i);
  }
});

test("reducer: APPLY_WORKBENCH_PRESET with an unknown id is a no-op", () => {
  const s0 = createInitialState();
  for (const presetId of ["nope", "", null, "cascade"]) {
    assert.equal(reduce(s0, { type: "APPLY_WORKBENCH_PRESET", presetId }), s0);
  }
});

test("reducer: cascade presets leave the diff controls untouched", () => {
  const s = reduce(createInitialState(), { type: "APPLY_WORKBENCH_PRESET", presetId: "cascade-battery" });
  assert.equal(s.municipalProfileA, "Riverside-tx");
  assert.equal(s.municipalProfileB, "dual-stream-glass-out");
  assert.equal(s.cascadeCounts["lithium-ignition"], 1);
});

/* ---------------- audit + self-test state ---------------- */

test("reducer: SET_AUDIT_INPUT stores text capped at 256 KiB", () => {
  const s = reduce(createInitialState(), { type: "SET_AUDIT_INPUT", text: "abc" });
  assert.equal(s.auditInput, "abc");
  const huge = reduce(createInitialState(), { type: "SET_AUDIT_INPUT", text: "x".repeat(300000) });
  assert.equal(huge.auditInput.length, 262144);
  assert.equal(reduce(createInitialState(), { type: "SET_AUDIT_INPUT", text: null }).auditInput, "");
});

test("reducer: SET_AUDIT_RESULT guards malformed results and sets the notice", () => {
  const s0 = createInitialState();
  assert.equal(reduce(s0, { type: "SET_AUDIT_RESULT", result: null }), s0);
  assert.equal(reduce(s0, { type: "SET_AUDIT_RESULT", result: {} }), s0);
  const ok = reduce(s0, { type: "SET_AUDIT_RESULT", result: { ok: true, code: "VERIFIED" } });
  assert.equal(ok.auditResult.code, "VERIFIED");
  assert.match(ok.notice, /verified/i);
  const bad = reduce(s0, { type: "SET_AUDIT_RESULT", result: { ok: false, code: "TAMPERED" } });
  assert.match(bad.notice, /failed/i);
});

test("reducer: SET_SELFTEST_RESULT guards malformed results", () => {
  const s0 = createInitialState();
  assert.equal(reduce(s0, { type: "SET_SELFTEST_RESULT", result: null }), s0);
  assert.equal(reduce(s0, { type: "SET_SELFTEST_RESULT", result: { results: "nope" } }), s0);
  const ran = runSelfTests();
  const s1 = reduce(s0, { type: "SET_SELFTEST_RESULT", result: ran });
  assert.equal(s1.selfTestResult.total, ran.total);
  assert.match(s1.notice, /self-tests/i);
});

/* ---------------- HYDRATE ---------------- */

test("reducer: HYDRATE restores a full workbench patch", () => {
  const s0 = createInitialState();
  const s1 = reduce(s0, {
    type: "HYDRATE",
    patch: {
      municipalProfileA: "houston-tx",
      municipalProfileB: "rural-transfer-station",
      municipalBasket: "flexible-and-foam",
      cascadeCounts: { "film-tangler": 4, "lithium-ignition": 1 }
    }
  });
  assert.equal(s1.municipalProfileA, "houston-tx");
  assert.equal(s1.municipalProfileB, "rural-transfer-station");
  assert.equal(s1.municipalBasket, "flexible-and-foam");
  assert.equal(s1.cascadeCounts["film-tangler"], 4);
  assert.equal(s1.cascadeCounts["lithium-ignition"], 1);
});

test("reducer: HYDRATE drops invalid workbench values but keeps the rest", () => {
  const s0 = createInitialState();
  const s1 = reduce(s0, {
    type: "HYDRATE",
    patch: { municipalProfileA: "not-a-profile", municipalProfileB: "houston-tx", municipalBasket: "bad", cascadeCounts: { bogus: 9, "film-tangler": 3 } }
  });
  assert.equal(s1.municipalProfileA, s0.municipalProfileA, "invalid A stays at default");
  assert.equal(s1.municipalProfileB, "houston-tx");
  assert.equal(s1.municipalBasket, s0.municipalBasket);
  assert.deepEqual(s1.cascadeCounts, { "film-tangler": 3 });
});

test("reducer: HYDRATE expands a preset patch before applying keys", () => {
  const s0 = createInitialState();
  const s1 = reduce(s0, { type: "HYDRATE", patch: { workbenchPreset: "diff-organics" } });
  assert.equal(s1.workbenchPreset, "diff-organics");
  assert.equal(s1.municipalProfileA, "strict-single-stream");
  assert.equal(s1.municipalProfileB, "organics-mandatory");
  assert.equal(s1.municipalBasket, "tricky-household");
});

test("reducer: HYDRATE ignores unknown preset ids", () => {
  const s0 = createInitialState();
  const s1 = reduce(s0, { type: "HYDRATE", patch: { workbenchPreset: "not-a-preset" } });
  assert.equal(s1.workbenchPreset, null);
});

test("reducer: HYDRATE clamps cascade counts to the slider range", () => {
  const s = reduce(createInitialState(), {
    type: "HYDRATE",
    patch: { cascadeCounts: { "film-tangler": 999, "lithium-ignition": -2 } }
  });
  assert.equal(s.cascadeCounts["film-tangler"], CASCADE_MAX_COUNT);
  assert.equal(s.cascadeCounts["lithium-ignition"], 0);
});

test("reducer: HYDRATE with explicit keys overrides a preset in the same patch", () => {
  const s = reduce(createInitialState(), {
    type: "HYDRATE",
    patch: { workbenchPreset: "diff-glass-out", municipalProfileA: "houston-tx" }
  });
  assert.equal(s.municipalProfileA, "houston-tx", "explicit key wins over preset expansion");
});

/* ---------------- selectViewModel ---------------- */

test("view model: workbench diff, cascade lab and preset are always populated", () => {
  const vm = selectViewModel(createInitialState());
  assert.ok(vm.workbench.diff.a && vm.workbench.diff.b);
  assert.ok(Array.isArray(vm.workbench.diff.conflicts));
  assert.equal(vm.workbench.cascade.results.length, CASCADE_SCENARIO_IDS.length);
  assert.equal(vm.workbench.preset, null);
});

test("view model: workbench follows the reducer state", () => {
  let s = createInitialState();
  s = reduce(s, { type: "SET_MUNICIPAL_PROFILE", slot: "B", profileId: "organics-mandatory" });
  s = reduce(s, { type: "SET_CASCADE_COUNT", scenarioId: "lithium-ignition", count: 2 });
  const vm = selectViewModel(s);
  assert.equal(vm.workbench.diff.b.profileId, "organics-mandatory");
  const lithium = vm.workbench.cascade.results.find((r) => r.scenarioId === "lithium-ignition");
  assert.equal(lithium.count, 2);
  assert.ok(lithium.severity >= 55);
});

test("view model: share hash carries the new workbench keys after the existing five", () => {
  const s = reduce(createInitialState(), { type: "SET_CASCADE_COUNT", scenarioId: "film-tangler", count: 3 });
  const vm = selectViewModel(s);
  const hash = vm.shareHash;
  const keyOrder = [...hash.matchAll(/(?:^#|&)([a-z]+)=/g)].map((m) => m[1]);
  const existing = ["c", "b", "m", "r", "k"].filter((k) => keyOrder.includes(k));
  const appended = keyOrder.filter((k) => ["pa", "pb", "bk", "cas", "bin"].includes(k));
  assert.deepEqual(keyOrder.slice(0, existing.length), existing, "existing keys keep their original order");
  for (const key of ["pa", "pb", "bk", "cas"]) {
    assert.ok(appended.includes(key), `${key} missing from ${hash}`);
  }
});

/* ---------------- share-hash codec round trips ---------------- */

test("hash: workbench keys round-trip exactly", () => {
  const state = createInitialState({
    municipalProfileA: "strict-single-stream",
    municipalProfileB: "organics-mandatory",
    municipalBasket: "kitchen-week",
    cascadeCounts: { "film-tangler": 3, "lithium-ignition": 1 }
  });
  const hash = encodeShareHash(state);
  const { patch, issues } = decodeShareHash(hash);
  assert.deepEqual(issues, []);
  assert.equal(patch.municipalProfileA, "strict-single-stream");
  assert.equal(patch.municipalProfileB, "organics-mandatory");
  assert.equal(patch.municipalBasket, "kitchen-week");
  assert.deepEqual(patch.cascadeCounts, { "film-tangler": 3, "lithium-ignition": 1 });
});

test("hash: preset id encodes as bin= and decodes to a preset patch", () => {
  const hash = encodeShareHash(createInitialState({ workbenchPreset: "cascade-battery" }));
  assert.ok(hash.includes("bin=cascade-battery"));
  const { patch, issues } = decodeShareHash(hash);
  assert.deepEqual(issues, []);
  assert.equal(patch.workbenchPreset, "cascade-battery");
});

test("hash: every registered preset encodes and decodes", () => {
  for (const presetId of WORKBENCH_PRESET_IDS) {
    const hash = encodeShareHash(createInitialState({ workbenchPreset: presetId }));
    const { patch, issues } = decodeShareHash(hash);
    assert.deepEqual(issues, []);
    assert.equal(patch.workbenchPreset, presetId);
  }
});

test("hash: cascade counts encode in scenario order and only above zero", () => {
  const hash = encodeShareHash(createInitialState({
    cascadeCounts: { "sharps-hazmat": 2, "film-tangler": 1, "grease-fiber": 0, bogus: 5 }
  }));
  const cas = hash.match(/cas=([^&]*)/)[1];
  const ids = decodeURIComponent(cas).split(",").map((p) => p.split(":")[0]);
  assert.deepEqual(ids, ids.slice().sort(), "counts emit in registry order");
  assert.ok(!decodeURIComponent(cas).includes("grease-fiber"), "zero counts are never emitted");
  assert.ok(!decodeURIComponent(cas).includes("bogus"), "unknown ids are never emitted");
});

test("hash: malformed workbench values produce issues, never a patch", () => {
  const cases = [
    ["#pa=not-a-profile", "UNKNOWN_PROFILE"],
    ["#pb=bogus", "UNKNOWN_PROFILE"],
    ["#bk=nothing", "UNKNOWN_BASKET"],
    ["#cas=broken", "INVALID_CASCADE"],
    ["#cas=film-tangler", "INVALID_CASCADE"],
    ["#cas=film-tangler:abc", "INVALID_CASCADE"],
    ["#cas=bogus:3", "INVALID_CASCADE"],
    ["#cas=", "INVALID_CASCADE"],
    ["#bin=not-a-preset", "UNKNOWN_PRESET"]
  ];
  for (const [hash, code] of cases) {
    const { patch, issues } = decodeShareHash(hash);
    assert.ok(issues.some((i) => i.code === code), `${hash} should produce ${code}, got ${issues.map((i) => i.code)}`);
    assert.equal(patch.municipalProfileA, undefined);
    assert.equal(patch.cascadeCounts, undefined);
    assert.equal(patch.workbenchPreset, undefined);
  }
});

test("hash: cas count digits are clamped through the decoder path", () => {
  const { patch, issues } = decodeShareHash("#cas=film-tangler:7");
  assert.deepEqual(issues, []);
  assert.equal(patch.cascadeCounts["film-tangler"], 7);
});

test("hash: duplicate workbench keys keep the first occurrence", () => {
  const { patch } = decodeShareHash("#pa=houston-tx&pa=organics-mandatory");
  assert.equal(patch.municipalProfileA, "houston-tx");
});

test("hash: encode+decode+hydrate restores the whole workbench from a bookmark", () => {
  const source = createInitialState({
    municipalProfileA: "houston-tx",
    municipalProfileB: "rural-transfer-station",
    municipalBasket: "flexible-and-foam",
    cascadeCounts: { "sharps-hazmat": 3 }
  });
  const hash = encodeShareHash(source);
  const { patch } = decodeShareHash(hash);
  const hydrated = reduce(createInitialState(), { type: "HYDRATE", patch });
  assert.equal(hydrated.municipalProfileA, "houston-tx");
  assert.equal(hydrated.municipalProfileB, "rural-transfer-station");
  assert.equal(hydrated.municipalBasket, "flexible-and-foam");
  assert.equal(hydrated.cascadeCounts["sharps-hazmat"], 3);
});

/* ---------------- workbench renderers ---------------- */

test("render: municipal diff table exposes both profiles, metrics and conflicts", () => {
  const vm = selectViewModel(createInitialState());
  const html = renderMunicipalDiff(vm.workbench.diff);
  assert.ok(html.includes("Riverside"));
  assert.ok(html.includes("Glass-Out"));
  assert.ok(/diversion/i.test(html));
  assert.ok(/CO2e|CO₂|co2e/i.test(html));
  assert.ok(/conflict/i.test(html));
  assert.ok(html.includes("<table"));
});

test("render: cascade lab shows every scenario with its stage table and alternative", () => {
  const vm = selectViewModel(reduce(createInitialState(), { type: "SET_CASCADE_COUNT", scenarioId: "film-tangler", count: 4 }));
  const html = renderCascadeLab(vm.workbench.cascade);
  for (const id of CASCADE_SCENARIO_IDS) {
    assert.ok(html.length > 0, id);
  }
  assert.ok(/retail drop-off|film/i.test(html));
  assert.ok(/illustrative|planning/i.test(html), "planning disclosure must be visible");
});

test("render: audit panel shows the signature fields and the integrity disclaimer", () => {
  const signed = buildSignedAudit({ basketId: "tricky-household", profileIds: ["Riverside-tx", "houston-tx"] });
  const html = renderAuditPanel({ signed });
  assert.ok(html.includes("HMAC-SHA-256"));
  assert.ok(html.includes(signed.signature.digest.slice(0, 32)));
  assert.ok(/not a third-party certificate|self-check/i.test(html));
  assert.ok(/14 items/.test(html));
});

test("render: audit verify renders pass and fail states distinctly", () => {
  const good = verifySignedAudit(signedAuditToJson(buildSignedAudit({ basketId: "tricky-household" })));
  const bad = verifySignedAudit("not json");
  const goodHtml = renderAuditVerify(good);
  const badHtml = renderAuditVerify(bad);
  assert.ok(goodHtml.includes("verify-ok"));
  assert.ok(badHtml.includes("verify-bad"));
  assert.equal(renderAuditVerify(null), "");
});

test("render: self-test panel renders aggregate and per-check rows", () => {
  const result = runSelfTests();
  const html = renderSelfTests(result);
  assert.ok(html.includes(`${result.passed}/${result.total}`));
  for (const entry of result.results.slice(0, 5)) {
    assert.ok(html.includes(entry.id));
  }
  assert.equal(renderSelfTests(null).includes("Not run yet"), true);
});

test("render: hostile strings inside details are HTML-escaped", () => {
  const xss = { ok: false, detail: '<img src=x onerror="alert(1)"><script>alert(2)</script>' };
  const html = renderAuditVerify(xss);
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes('onerror="alert'));
  assert.ok(html.includes("&lt;img"));
  const selftest = renderSelfTests({ total: 1, passed: 0, failed: 1, allPass: false, results: [{ id: "x", pass: false, detail: "<b>bad</b>" }] });
  assert.ok(!selftest.includes("<b>bad</b>"));
  assert.ok(selftest.includes("&lt;b&gt;"));
});

/* ---------------- index.html coverage ---------------- */

test("index: every workbench element the app expects exists", () => {
  for (const id of [
    "municipal-profile-a",
    "municipal-profile-b",
    "municipal-basket",
    "municipal-diff-output",
    "cascade-output",
    "audit-panel-output",
    "audit-verify-input",
    "audit-verify-output",
    "selftest-output"
  ]) {
    assert.ok(indexHtml.includes(`id="${id}"`), `missing #${id}`);
  }
});

test("index: every workbench action the app handles is present on a control", () => {
  for (const action of [
    "apply-preset",
    "cascade-reset",
    "export-audit-json",
    "export-audit-csv",
    "export-audit-md",
    "copy-audit",
    "load-audit-demo",
    "verify-audit",
    "run-selftests"
  ]) {
    assert.ok(indexHtml.includes(`data-action="${action}"`), `missing action ${action}`);
  }
});

test("index: all five cascade sliders exist with data-cascade attributes", () => {
  for (const id of CASCADE_SCENARIO_IDS) {
    assert.ok(indexHtml.includes(`data-cascade="${id}"`), `missing slider ${id}`);
  }
});

test("index: preset pills cover all five presets", () => {
  for (const presetId of WORKBENCH_PRESET_IDS) {
    assert.ok(indexHtml.includes(`data-preset="${presetId}"`), `missing preset pill ${presetId}`);
  }
});

test("index: workbench controls carry accessible labels", () => {
  for (const id of ["municipal-profile-a", "municipal-profile-b", "municipal-basket", "audit-verify-input"]) {
    const tag = indexHtml.match(new RegExp(`<[^>]*id="${id}"[^>]*>`))[0];
    const labelled =
      /aria-label/.test(tag) ||
      /aria-labelledby/.test(tag) ||
      indexHtml.includes(`for="${id}"`) ||
      id === "audit-verify-input";
    assert.ok(labelled, `#${id} has no accessible name: ${tag}`);
  }
});
