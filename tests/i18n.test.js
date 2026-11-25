import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  UI_STRINGS,
  t,
  normalizeLang,
  SUPPORTED_LANGS,
  DEFAULT_LANG,
  LANGUAGE_STORAGE_KEY,
  VERDICTS_ES,
  STREAM_LABELS_ES,
  TIER_LABELS_ES,
  CONDITION_LABELS_ES,
  MATERIALS_ES,
  CATALOG_ES,
  CITY_ES,
  cityNameFor,
  cityShortNameFor,
  materialTitleEs,
  conditionLabelEs,
  streamLabelEs,
  tierLabelEs,
  barcodeReasonEs,
  issueMessageEs,
  parseErrorMessageEs,
  auditDetailEs,
  localizeEvaluation,
  localizeComparison,
  localizeCartSummary,
  localizeDiff,
  localizeCascadeLab,
  profileNameEs,
  basketLabelEs,
  presetLabelEs,
  localizeBatchResult,
  CASCADE_ES,
  PRESETS_ES,
  SELFTEST_DETAILS_ES,
  selfTestDetailEs
} from "../js/bincheck-i18n.js";
import {
  VERIFIED_BARCODE_CATALOG,
  MATERIAL_CATEGORIES,
  SUPPORTED_CITIES,
  validateBarcodeCheckDigit,
  evaluateItemDisposal,
  compareJurisdictions,
  scoreCartBatch
} from "../js/bincheck-engine.js";
import { runBatchFromCsv, SAMPLE_BATCH_CSV, batchResultToCsv, batchResultToJson } from "../js/bincheck-batch.js";
import { compareProfiles, MRF_PROFILE_IDS, WORKBENCH_PRESETS } from "../js/bincheck-municipal.js";
import { runCascadeLab, CASCADE_SCENARIO_IDS, CASCADE_SCENARIOS } from "../js/bincheck-cascade.js";
import { encodeShareHash, decodeShareHash, CITY_MODES } from "../js/bincheck-validate.js";
import { verdictFor, searchItems, computeContaminationImpact } from "../src/insights.js";
import { createInitialState, reduce, selectViewModel, SHORTCUTS } from "../src/state.js";
import {
  renderSingleEvaluation,
  renderComparisonView,
  renderSearchResults,
  renderCart,
  renderBatchReport,
  renderShortcutList
} from "../src/render.js";
import { renderMunicipalDiff, renderCascadeLab } from "../src/workbench-render.js";
import { createFakeDom } from "./fake-dom.js";
import { createApp } from "../src/app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

/* ---------------- dictionary integrity ---------------- */

test("i18n: every English key has a Spanish translation and vice versa", () => {
  const en = UI_STRINGS.en;
  const es = UI_STRINGS.es;
  const missingInEs = Object.keys(en).filter((k) => !(k in es));
  const missingInEn = Object.keys(es).filter((k) => !(k in en));
  assert.deepEqual(missingInEs, []);
  assert.deepEqual(missingInEn, []);
});

test("i18n: the only untranslated values are the known language-neutral set", () => {
  // Units, abbreviations, proper nouns, template skeletons and words spelled
  // the same in both languages (e.g. "Error") may stay identical; a new UI
  // string must be translated or it shows up here as a diff.
  const identical = Object.entries(UI_STRINGS.en)
    .filter(([k, v]) => UI_STRINGS.es[k] === v)
    .map(([k]) => k)
    .sort();
  assert.deepEqual(identical, [
    "batch.byteLoc",
    "bench.gapNote",
    "bench.latencyP95Label",
    "bench.macro",
    "bench.tp",
    "cart.maxItemName",
    "cascade.downtimeValue",
    "cascade.fiberValue",
    "diff.unit.kg",
    "diff.unit.pct",
    "diff.unit.pctPt",
    "diff.unit.per100",
    "diff.weight",
    "evidence.material",
    "evidence.sev.error",
    "gauge.score",
    "group.language",
    "guide.dl.hou",
    "guide.dl.sl",
    "issue.sev.error",
    "lang.en",
    "lang.es",
    "live.compare",
    "math.ean13",
    "print.cityLine"
  ]);
});

test("i18n: t() resolves keys, interpolates vars, falls back es -> en -> key", () => {
  assert.equal(t("en", "skip.link"), "Skip to main content");
  assert.equal(t("es", "skip.link"), "Saltar al contenido principal");
  assert.equal(t("es", "search.matches", { n: 3 }), "3 coincidencias");
  assert.equal(t("en", "search.matches", { n: 3 }), "3 matches");
  // Missing key -> raw key, never undefined or a crash.
  assert.equal(t("es", "no.such.key"), "no.such.key");
  assert.equal(t("fr", "skip.link"), "Skip to main content"); // unsupported -> en
  // Vars are stringified; missing vars stay literal.
  assert.equal(t("en", "notice.cartFull", { n: 50 }), t("en", "notice.cartFull", { n: 50 }));
});

test("i18n: normalizeLang and supported-language constants", () => {
  assert.deepEqual(SUPPORTED_LANGS, ["en", "es"]);
  assert.equal(DEFAULT_LANG, "en");
  assert.equal(normalizeLang("es"), "es");
  assert.equal(normalizeLang("ES"), "es");
  assert.equal(normalizeLang("es-MX"), "es");
  assert.equal(normalizeLang("en"), "en");
  assert.equal(normalizeLang("fr"), "en");
  assert.equal(normalizeLang(""), "en");
  assert.equal(normalizeLang(null), "en");
  assert.equal(LANGUAGE_STORAGE_KEY, "bincheck:language");
});

/* ---------------- label dictionaries ---------------- */

test("i18n: ES label dictionaries cover every engine stream, tier and condition", () => {
  const seenStreams = new Set();
  for (const city of ["Riverside-tx", "houston-tx"]) {
    for (const id of Object.keys(MATERIAL_CATEGORIES)) {
      for (const condition of ["clean", "greasy", "liquid-full", "broken"]) {
        seenStreams.add(evaluateItemDisposal({ materialId: id, condition, city }).stream);
      }
    }
  }
  for (const stream of seenStreams) {
    assert.ok(STREAM_LABELS_ES[stream], `no ES stream label for ${stream}`);
    assert.ok(VERDICTS_ES[stream], `no ES verdict for ${stream}`);
    assert.notEqual(verdictFor(stream, "es").word, verdictFor(stream, "en").word === stream ? stream : "\0");
  }
  for (const condition of ["clean", "greasy", "liquid-full", "broken"]) {
    assert.ok(CONDITION_LABELS_ES[condition], `no ES condition label for ${condition}`);
  }
  for (const tier of ["LOW", "MODERATE", "HIGH", "CRITICAL"]) {
    assert.ok(TIER_LABELS_ES[tier], `no ES tier label for ${tier}`);
  }
});

test("i18n: every material id and catalog UPC has a Spanish title", () => {
  for (const id of Object.keys(MATERIAL_CATEGORIES)) {
    assert.ok(MATERIALS_ES[id], `no MATERIALS_ES entry for ${id}`);
    assert.ok(MATERIALS_ES[id].title, `no ES title for ${id}`);
    assert.equal(materialTitleEs(id), MATERIALS_ES[id].title);
  }
  assert.equal(materialTitleEs("not-a-material"), "not-a-material");
  for (const item of VERIFIED_BARCODE_CATALOG) {
    assert.ok(CATALOG_ES[item.upc], `no CATALOG_ES entry for ${item.upc} (${item.productName})`);
  }
});

test("i18n: city names and short names localize", () => {
  for (const id of Object.keys(SUPPORTED_CITIES)) {
    assert.ok(CITY_ES[id], `no CITY_ES for ${id}`);
    assert.notEqual(cityNameFor(id, "es"), "");
    assert.equal(cityShortNameFor(id), SUPPORTED_CITIES[id].shortName);
  }
  assert.equal(cityNameFor("houston-tx", "en"), SUPPORTED_CITIES["houston-tx"].name);
});

/* ---------------- object localizers ---------------- */

test("i18n: localizeEvaluation translates labels but keeps citation quotes English", () => {
  const en = evaluateItemDisposal({ materialId: "resin-6-ps-foam", condition: "clean", city: "houston-tx" });
  const es = localizeEvaluation(en, "es");
  assert.notEqual(es, en);
  assert.notEqual(es.itemTitle, en.itemTitle);
  assert.equal(es.cityName, CITY_ES["houston-tx"].name);
  // Ordinance quotes are verbatim English by design.
  assert.deepEqual(
    es.ruleCitations.map((c) => c.quote),
    en.ruleCitations.map((c) => c.quote)
  );
  // Citation chip labels are translated.
  assert.notDeepEqual(
    es.ruleCitations.map((c) => c.label),
    en.ruleCitations.map((c) => c.label)
  );
  // en pass-through returns the same object.
  assert.equal(localizeEvaluation(en, "en"), en);
  assert.equal(localizeEvaluation(en, "fr"), en);
  assert.equal(localizeEvaluation(null, "es"), null);
});

test("i18n: localizeComparison and localizeCartSummary translate visible strings", () => {
  const evalA = evaluateItemDisposal({ materialId: "glass-jar-bottle", condition: "clean", city: "Riverside-tx" });
  const evalB = evaluateItemDisposal({ materialId: "glass-jar-bottle", condition: "clean", city: "houston-tx" });
  const comparison = compareJurisdictions(evalA, evalB);
  const es = localizeComparison(comparison, "es");
  assert.notEqual(es, comparison);
  const cart = scoreCartBatch(
    [
      { materialId: "resin-1-pet", condition: "clean" },
      { materialId: "lithium-household-battery", condition: "clean" }
    ],
    "houston-tx"
  );
  const cartEs = localizeCartSummary(cart, "es");
  assert.notEqual(cartEs, cart);
  assert.equal(localizeCartSummary(cart, "en"), cart);
});

test("i18n: localizeDiff and localizeCascadeLab translate workbench output", () => {
  const diff = compareProfiles("Riverside-tx", "dual-stream-glass-out", "tricky-household");
  const es = localizeDiff(diff, "es");
  assert.notEqual(es, diff);
  assert.equal(localizeDiff(diff, "en"), diff);
  const lab = runCascadeLab({ "lithium-ignition": 3 });
  const labEs = localizeCascadeLab(lab, "es");
  assert.notEqual(labEs, lab);
  assert.equal(localizeCascadeLab(lab, "en"), lab);
});

test("i18n: profile, basket and preset names resolve in Spanish with fallback", () => {
  for (const id of MRF_PROFILE_IDS) {
    assert.notEqual(profileNameEs(id, "name"), "");
  }
  assert.notEqual(basketLabelEs("tricky-household", "resin-1-pet", 0, "fallback"), "");
  assert.notEqual(presetLabelEs("diff-glass-out", "Glass in vs. glass out"), "");
  assert.equal(presetLabelEs("unknown-preset", "keep me"), "keep me");
});

/* ---------------- barcode / issue / error / audit localizers ---------------- */

test("i18n: barcodeReasonEs mirrors every reasonCode", () => {
  for (const [raw, code] of [["", "empty"], ["abc", "non_numeric"], ["123", "invalid_length"], ["041220576464", "bad_check_digit"], ["041220576463", "valid"]]) {
    const check = validateBarcodeCheckDigit(raw);
    assert.equal(check.reasonCode, code, `${raw} -> ${check.reasonCode}`);
    const es = barcodeReasonEs(check);
    assert.ok(es && es !== check.reason || code === "valid" && es !== check.reason, `ES reason for ${code}`);
    assert.notEqual(es, "");
  }
  assert.equal(barcodeReasonEs(null), "");
  assert.equal(barcodeReasonEs({ reason: "raw fallback" }), "raw fallback");
});

test("i18n: issueMessageEs covers the codes the engine can emit", () => {
  const evaluation = evaluateItemDisposal({ materialId: "not-real", condition: "clean", city: "houston-tx" });
  for (const issue of evaluation.issues || []) {
    const es = issueMessageEs(issue);
    assert.ok(es && es !== "", `empty ES message for ${issue.code}`);
  }
  assert.equal(issueMessageEs(null), "");
  assert.equal(issueMessageEs({ code: "UNMAPPED", message: "keep" }), "keep");
});

test("i18n: parseErrorMessageEs covers batch parse errors", () => {
  const result = runBatchFromCsv("col1,col2\n1,2,3,4,5,6\n", "Riverside-tx");
  assert.ok(result.totals.errors >= 0);
  const bad = runBatchFromCsv("", "Riverside-tx");
  for (const err of bad.errors || []) {
    const es = parseErrorMessageEs(err);
    assert.ok(es && es !== "", `empty ES parse message for ${err.code}`);
  }
  assert.equal(parseErrorMessageEs(null), "");
  assert.equal(parseErrorMessageEs({ code: "UNMAPPED", message: "keep" }), "keep");
});

test("i18n: auditDetailEs switches on result code for every failure path", () => {
  for (const code of ["EMPTY", "TOO_LARGE", "NOT_JSON", "WRONG_SCHEMA", "WRONG_SIGNATURE_FORMAT", "MALFORMED_DIGEST", "TAMPERED", "VERIFIED"]) {
    const result = { code, ok: code === "VERIFIED", report: { basket: { itemCount: 7 } }, expectedDigest: "ab".repeat(16), actualDigest: "cd".repeat(16) };
    const es = auditDetailEs(result);
    assert.ok(es && es !== "", `empty ES detail for ${code}`);
  }
  assert.equal(auditDetailEs(null), "");
  assert.equal(auditDetailEs({ code: "UNKNOWN", detail: "raw" }), "raw");
});

/* ---------------- search in Spanish ---------------- */

test("i18n: Spanish queries match the catalog through ES aliases", () => {
  const cases = [
    ["botella de agua", "resin-1-pet"],
    ["bateria", "lithium-household-battery"],
    ["pila", "lithium-household-battery"],
    ["caja de pizza", "greasy-pizza-box"],
    ["bolsa de plastico", "resin-4-ldpe-film"],
    ["vaso de espuma", "resin-6-ps-foam"],
    ["frasco de vidrio", "glass-jar-bottle"],
    ["recortes de jardin", "yard-trimmings-brush"],
    ["lata de aluminio", "aluminum-steel-can"],
    ["carton", "clean-cardboard-paper"]
  ];
  for (const [query, materialId] of cases) {
    const r = searchItems(query, { lang: "es" });
    assert.ok(r.total > 0, `no ES results for "${query}"`);
    assert.ok(
      r.results.some((x) => x.value === materialId),
      `"${query}" did not surface ${materialId}; got ${r.results.map((x) => x.value).join(",")}`
    );
  }
});

test("i18n: ES search results carry Spanish titles and verdicts", () => {
  const r = searchItems("botella", { lang: "es" });
  const pet = r.results.find((x) => x.value === "resin-1-pet");
  assert.ok(pet);
  assert.equal(pet.title, MATERIALS_ES["resin-1-pet"].title);
  assert.equal(pet.sub, t("es", "search.categorySub"));
  assert.equal(pet.Riverside.verdict.word, VERDICTS_ES.RECYCLE_CART.word);
});

test("i18n: ES catalog search matches Spanish product names and aliases", () => {
  const topo = searchItems("topo chico", { lang: "es" });
  assert.equal(topo.results[0].kind, "barcode");
  assert.equal(topo.results[0].value, "021131500269");
  assert.equal(topo.results[0].title, CATALOG_ES["021131500269"]);
  const yogurt = searchItems("yogur", { lang: "es" });
  assert.ok(yogurt.results.some((x) => x.value === "818290012630"), "ES 'yogur' did not reach Chobani");
});

test("i18n: English search is unaffected and cross-language queries both work", () => {
  const en = searchItems("battery", { lang: "en" });
  assert.ok(en.results.some((x) => x.value === "lithium-household-battery"));
  const es = searchItems("battery", { lang: "es" });
  assert.ok(es.results.some((x) => x.value === "lithium-household-battery"));
  assert.equal(searchItems("botella", { lang: "en" }).total, searchItems("botella", { lang: "es" }).total);
});

/* ---------------- verdicts and impact in Spanish ---------------- */

test("i18n: verdictFor returns Spanish words under es", () => {
  assert.equal(verdictFor("RECYCLE_CART", "es").word, VERDICTS_ES.RECYCLE_CART.word);
  assert.equal(verdictFor("RECYCLE_CART", "en").word, "Recycle");
  assert.equal(verdictFor("TRASH_CART", "es").where, VERDICTS_ES.TRASH_CART.where);
  assert.notEqual(verdictFor("SPLIT_DISPOSAL", "es").word, "Split it");
});

test("i18n: contamination impact localizes item title and verdict", () => {
  const en = computeContaminationImpact({ query: { materialId: "lithium-household-battery", condition: "clean" }, lang: "en" });
  const es = computeContaminationImpact({ query: { materialId: "lithium-household-battery", condition: "clean" }, lang: "es" });
  assert.equal(es.itemTitle, MATERIALS_ES["lithium-household-battery"].title);
  assert.equal(es.itemVerdict.word, VERDICTS_ES[en.itemStream].word);
  assert.equal(es.maxRiskScore, en.maxRiskScore); // engine numbers stay identical
});

/* ---------------- state: language reducer + share hash ---------------- */

test("i18n: SET_LANGUAGE validates and stores language; notice comes from dict", () => {
  const s = createInitialState();
  const es = reduce(s, { type: "SET_LANGUAGE", language: "es" });
  assert.equal(es.language, "es");
  assert.equal(es.notice, t("es", "notice.languageSet"));
  const back = reduce(es, { type: "SET_LANGUAGE", language: "en" });
  assert.equal(back.language, "en");
  assert.equal(back.notice, t("en", "notice.languageSet"));
  // Same language is a no-op returning the same object.
  assert.equal(reduce(s, { type: "SET_LANGUAGE", language: "en" }), s);
  // Garbage normalizes to en, which is a no-op from a clean state.
  assert.equal(reduce(s, { type: "SET_LANGUAGE", language: "klingon" }), s);
});

test("i18n: share hash round-trips the l= language key", () => {
  const state = { ...createInitialState(), language: "es" };
  const hash = encodeShareHash(state);
  assert.match(hash, /l=es/);
  const decoded = decodeShareHash(hash);
  assert.equal(decoded.patch.language, "es");
  const en = encodeShareHash({ ...createInitialState(), language: "en" });
  assert.doesNotMatch(en, /l=/);
  assert.equal(decodeShareHash("#l=fr").patch.language, undefined);
  assert.ok(decodeShareHash("#l=fr").issues.length >= 1);
});

test("i18n: view model is identical for en except the language field", () => {
  const en = selectViewModel(createInitialState());
  const es = selectViewModel({ ...createInitialState(), language: "es" });
  assert.equal(es.language, "es");
  assert.equal(en.language, "en");
  // The engine data behind the view never changes with language.
  assert.equal(es.evaluation.contaminationRiskScore, en.evaluation.contaminationRiskScore);
  assert.equal(es.evaluation.stream, en.evaluation.stream);
});

/* ---------------- render layer in Spanish ---------------- */

test("i18n: renderSingleEvaluation and renderComparisonView emit Spanish", () => {
  const s = { ...createInitialState(), language: "es", materialId: "resin-6-ps-foam", resinCode: 6 };
  const vm = selectViewModel(s);
  const out = renderSingleEvaluation(vm.evaluation, vm.assessment, "es");
  assert.match(out, /Español|espum|Recicl|Depósito|Basura|Especial|Entrega/i);
  const cmp = selectViewModel({ ...createInitialState(), language: "es", cityMode: "compare" });
  const out2 = renderComparisonView(cmp.comparison, cmp.assessment, "es");
  assert.ok(out2.length > 0);
  // English render is unchanged.
  const vmEn = selectViewModel(createInitialState());
  assert.match(renderSingleEvaluation(vmEn.evaluation, vmEn.assessment, "en"), /Recycle|Trash|Drop-off|Yard|Split|Organics/);
});

test("i18n: renderSearchResults, renderCart and renderBatchReport emit Spanish", () => {
  const r = searchItems("botella", { lang: "es" });
  const out = renderSearchResults(r, "es");
  assert.ok(out.includes(MATERIALS_ES["resin-1-pet"].title) || /aria|href/.test(out));
  const cart = scoreCartBatch([{ materialId: "resin-1-pet", condition: "clean" }], "Riverside-tx");
  const esCart = renderCart(cart, "es");
  const enCart = renderCart(cart, "en");
  assert.notEqual(esCart.html, enCart.html);
  const batch = runBatchFromCsv("barcode,material\n041220576463,\n,resin-6-ps-foam\n", "Riverside-tx");
  const esBatch = renderBatchReport(batch, "es");
  const enBatch = renderBatchReport(batch, "en");
  assert.notEqual(esBatch, enBatch);
});

test("i18n: workbench diff and cascade render in Spanish", () => {
  const diff = compareProfiles("Riverside-tx", "dual-stream-glass-out", "tricky-household");
  const es = renderMunicipalDiff(diff, "es");
  const en = renderMunicipalDiff(diff, "en");
  assert.notEqual(es, en);
  const lab = runCascadeLab({ "lithium-ignition": 2, "film-tangler": 4 });
  assert.notEqual(renderCascadeLab(lab, "es"), renderCascadeLab(lab, "en"));
});

test("i18n: renderShortcutList includes the language shortcut in Spanish", () => {
  const es = renderShortcutList(true, "es");
  assert.match(es, /language|Español|idioma/i);
  const en = renderShortcutList(true, "en");
  assert.match(en, /language|English/i);
  assert.notEqual(es, en);
  assert.ok(SHORTCUTS.some((s) => s.id === "language"));
});

/* ---------------- app-level language switching ---------------- */

function bootApp(options = {}) {
  const dom = createFakeDom(html, options);
  // fake-dom has no documentElement; app.js only needs lang get/set on it.
  dom.document.documentElement = {
    attrs: { lang: "en" },
    getAttribute(name) { return this.attrs[name] ?? null; },
    setAttribute(name, value) { this.attrs[name] = String(value); }
  };
  const app = createApp({
    document: dom.document,
    window: dom.window,
    deps: {
      download: () => {},
      now: (() => { let t = 0; return () => (t += 0.1); })(),
      storage: options.storage
    }
  });
  return { dom, app };
}

function memoryStorage(seed = {}) {
  const data = { ...seed };
  return {
    data,
    getItem(k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem(k, v) { data[k] = String(v); },
    removeItem(k) { delete data[k]; }
  };
}

test("i18n: clicking the ES toggle flips state, html lang and persists", () => {
  const storage = memoryStorage();
  const { dom, app } = bootApp({ storage });
  const esBtn = dom.all.find((el) => el.getAttribute("data-action") === "set-language" && el.getAttribute("data-lang") === "es");
  assert.ok(esBtn, "no ES toggle in markup");
  dom.click(esBtn);
  assert.equal(app.getState().language, "es");
  assert.equal(storage.data[LANGUAGE_STORAGE_KEY], "es");
  assert.equal(dom.document.documentElement && dom.document.documentElement.getAttribute("lang"), "es");
  const enBtn = dom.all.find((el) => el.getAttribute("data-action") === "set-language" && el.getAttribute("data-lang") === "en");
  dom.click(enBtn);
  assert.equal(app.getState().language, "en");
  assert.equal(storage.data[LANGUAGE_STORAGE_KEY], "en");
});

test("i18n: stored language preference is read on boot and beats nothing", () => {
  const storage = memoryStorage({ [LANGUAGE_STORAGE_KEY]: "es" });
  const { app } = bootApp({ storage });
  assert.equal(app.getState().language, "es");
  const storage2 = memoryStorage({ [LANGUAGE_STORAGE_KEY]: "bogus" });
  const { app: app2 } = bootApp({ storage: storage2 });
  assert.equal(app2.getState().language, "en");
});

test("i18n: share-hash l=es wins over stored preference", () => {
  const storage = memoryStorage({ [LANGUAGE_STORAGE_KEY]: "en" });
  const dom = createFakeDom(html, { hash: "#l=es", storage });
  const app = createApp({ document: dom.document, window: dom.window, deps: { download: () => {}, now: () => 0, storage } });
  assert.equal(app.getState().language, "es");
});

test("i18n: the l keyboard shortcut toggles language", () => {
  const { dom, app } = bootApp();
  dom.key("l");
  assert.equal(app.getState().language, "es");
  dom.key("l");
  assert.equal(app.getState().language, "en");
});

test("i18n: rendered output is Spanish after switching, English after switching back", () => {
  const { dom, app } = bootApp();
  const esBtn = dom.all.find((el) => el.getAttribute("data-action") === "set-language" && el.getAttribute("data-lang") === "es");
  dom.click(esBtn);
  const esOut = dom.byId.get("evaluation-output").innerHTML;
  const enOut = renderSingleEvaluation(
    selectViewModel(createInitialState()).evaluation,
    selectViewModel(createInitialState()).assessment,
    "en"
  );
  assert.notEqual(esOut, enOut);
  const enBtn = dom.all.find((el) => el.getAttribute("data-action") === "set-language" && el.getAttribute("data-lang") === "en");
  dom.click(enBtn);
  assert.equal(dom.byId.get("evaluation-output").innerHTML, enOut);
});

test("i18n: Spanish search in the live UI shows Spanish results", () => {
  const storage = memoryStorage({ [LANGUAGE_STORAGE_KEY]: "es" });
  const { dom, app } = bootApp({ storage });
  const input = dom.byId.get("item-search");
  dom.input(input, "bateria");
  const out = dom.byId.get("search-results").innerHTML;
  assert.match(out, new RegExp(MATERIALS_ES["lithium-household-battery"].title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").slice(0, 12)));
});

test("i18n: markup exposes the lang toggle and every data-i18n key resolves in ES", () => {
  assert.match(html, /data-action="set-language"[^>]*data-lang="es"/);
  assert.match(html, /data-action="set-language"[^>]*data-lang="en"/);
  const keys = [...html.matchAll(/data-i18n(?:-[a-z]+)?="([^"]+)"/g)].map((m) => m[1]);
  const missing = keys.filter((k) => t("es", k) === k || t("en", k) === k);
  assert.deepEqual([...new Set(missing)], []);
});


/* ---------------- ES parity guards (regressions found in the 2026-11-25 UI audit) ---------------- */

test("i18n parity: every cascade scenario has a Spanish entry with the same stage count", () => {
  for (const id of CASCADE_SCENARIO_IDS) {
    const es = CASCADE_ES[id];
    assert.ok(es, `CASCADE_ES is missing ${id}`);
    assert.equal(es.stages.length, CASCADE_SCENARIOS[id].stages.length, `stage count for ${id}`);
    for (const field of ["title", "headline", "alternative"]) {
      assert.ok(es[field] && es[field] !== CASCADE_SCENARIOS[id][field], `${id}.${field} is translated`);
    }
  }
  assert.deepEqual(Object.keys(CASCADE_ES).sort(), [...CASCADE_SCENARIO_IDS].sort());
});

test("i18n parity: a Spanish cascade lab run carries no English stage text", () => {
  const counts = Object.fromEntries(CASCADE_SCENARIO_IDS.map((id) => [id, 10]));
  const lab = runCascadeLab(counts);
  const es = localizeCascadeLab(lab, "es");
  es.results.forEach((r, i) => {
    const en = lab.results[i];
    assert.notEqual(r.title, en.title);
    assert.notEqual(r.alternative, en.alternative);
    r.stages.forEach((stage, k) => {
      assert.notEqual(stage.name, en.stages[k].name, `${r.scenarioId} stage ${k} name`);
      assert.notEqual(stage.detail, en.stages[k].detail, `${r.scenarioId} stage ${k} detail`);
    });
  });
});

test("i18n parity: every workbench preset has a Spanish label and the ES notice names it", () => {
  for (const id of Object.keys(WORKBENCH_PRESETS)) {
    assert.ok(PRESETS_ES[id] && PRESETS_ES[id].label, `PRESETS_ES is missing ${id}`);
    const next = reduce({ ...createInitialState(), language: "es" }, { type: "APPLY_WORKBENCH_PRESET", presetId: id });
    assert.ok(!/undefined/.test(next.notice), next.notice);
    assert.ok(next.notice.includes(PRESETS_ES[id].label), next.notice);
    const enNext = reduce(createInitialState(), { type: "APPLY_WORKBENCH_PRESET", presetId: id });
    assert.ok(enNext.notice.includes(WORKBENCH_PRESETS[id].name), enNext.notice);
  }
});

test("i18n parity: ES diff rows and conflict alerts are translated for every profile pair", () => {
  for (const a of MRF_PROFILE_IDS) {
    for (const b of MRF_PROFILE_IDS) {
      if (a === b) continue;
      const diff = compareProfiles(a, b, "tricky-household");
      const es = localizeDiff(diff, "es");
      diff.rows.forEach((row, i) => {
        if (!row.changed) return;
        assert.notEqual(es.rows[i].a.note, row.a.note, `${a} vs ${b} ${row.materialId} note A`);
        assert.notEqual(es.rows[i].b.note, row.b.note, `${a} vs ${b} ${row.materialId} note B`);
      });
      diff.conflicts.forEach((c, i) => {
        assert.notEqual(es.conflicts[i].itemLabel, c.itemLabel, `${a} vs ${b} conflict label`);
        assert.ok(es.conflicts[i].message.startsWith(`${es.conflicts[i].itemLabel}:`), es.conflicts[i].message);
      });
    }
  }
});

test("i18n parity: ES batch display is localized while CSV and JSON exports stay byte-stable English", () => {
  const result = runBatchFromCsv(SAMPLE_BATCH_CSV);
  const csvBefore = batchResultToCsv(result);
  const jsonBefore = batchResultToJson(result);
  const es = localizeBatchResult(result, "es");
  const html = renderBatchReport(es, "es");
  assert.ok(!html.includes("Recycle in Curbside Cart"), "ES batch table shows the Spanish badge");
  assert.ok(html.includes(CATALOG_ES[result.rows.find((r) => r.engineInput && CATALOG_ES[r.engineInput.barcode]).engineInput.barcode]));
  assert.equal(batchResultToCsv(result), csvBefore);
  assert.equal(batchResultToJson(result), jsonBefore);
  assert.equal(localizeBatchResult(result, "en"), result);
});

test("i18n parity: every passing in-page self-test has a Spanish description; failures stay verbatim", async () => {
  const { runSelfTests } = await import("../js/bincheck-selftest.js");
  const run = runSelfTests();
  for (const entry of run.results) {
    assert.ok(SELFTEST_DETAILS_ES[entry.id], `SELFTEST_DETAILS_ES is missing ${entry.id}`);
    const es = selfTestDetailEs(entry);
    assert.notEqual(es, entry.detail, `${entry.id} is translated`);
    const hex = /([0-9a-f]{16})\.\.\.$/.exec(entry.detail);
    if (hex) assert.ok(es.includes(hex[1]), `${entry.id} keeps its digest prefix`);
  }
  const failed = { id: "audit.csv.crlf", pass: false, detail: "Threw: boom" };
  assert.equal(selfTestDetailEs(failed), "Threw: boom");
  assert.equal(Object.keys(SELFTEST_DETAILS_ES).length, run.results.length);
});

test("render: stacked diff metric cells name their profile column on phones", async () => {
  const { renderMunicipalDiff } = await import("../src/workbench-render.js");
  for (const lang of ["en", "es"]) {
    const diff = localizeDiff(compareProfiles("Riverside-tx", "houston-tx", "tricky-household"), lang);
    const html = renderMunicipalDiff(diff, lang);
    const metricCells = html.split("diff-metrics-table")[1].split("</table>")[0].match(/<td [^>]*>/g);
    assert.equal(metricCells.length, 8 * 3);
    for (const cell of metricCells) assert.match(cell, /data-label="[^"]+"/, cell);
  }
});
