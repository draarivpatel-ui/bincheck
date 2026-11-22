import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  VERIFIED_BARCODE_CATALOG,
  MATERIAL_CATEGORIES,
  evaluateItemDisposal,
  scoreCartBatch
} from "../js/bincheck-engine.js";
import {
  VERDICTS,
  verdictFor,
  searchItems,
  computeContaminationImpact,
  CLEAN_BASELINE_ITEM
} from "../src/insights.js";
import { renderVerdictBanner, renderSearchResults, renderImpact, renderVerdictIcon } from "../src/render.js";
import { createFakeDom, FakeElement } from "./fake-dom.js";
import { createApp } from "../src/app.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const CITIES = ["Riverside-tx", "houston-tx"];

test("verdicts: every stream the engine can return maps to a named verdict and icon", () => {
  const seen = new Set();
  for (const city of CITIES) {
    for (const id of Object.keys(MATERIAL_CATEGORIES)) {
      for (const condition of ["clean", "greasy", "liquid-full", "broken"]) {
        seen.add(evaluateItemDisposal({ materialId: id, condition, city }).stream);
      }
    }
  }
  for (const stream of seen) {
    assert.ok(VERDICTS[stream], `no verdict for ${stream}`);
    assert.notEqual(verdictFor(stream).key, "unknown");
    assert.match(renderVerdictIcon(verdictFor(stream).key), /<svg class="verdict-icon"/);
  }
  assert.deepEqual(Object.values(VERDICTS).map((v) => v.word), ["Recycle", "Trash", "Drop-off", "Yard waste", "Split it", "Organics"]);
  assert.equal(verdictFor("NOT_A_STREAM").key, "unknown");
});

test("search: matches every term, ranks title hits first, and carries both cities' engine verdicts", () => {
  assert.deepEqual(searchItems("   "), { query: "", total: 0, results: [], partial: false });
  assert.equal(searchItems("zzqx nothing").total, 0);
  const topo = searchItems("topo chico");
  assert.equal(topo.results[0].kind, "barcode");
  assert.match(topo.results[0].title, /Topo Chico/);
  const battery = searchItems("battery");
  assert.ok(battery.total >= 3);
  for (const r of battery.results) {
    const query = r.kind === "barcode" ? { barcode: r.value } : { materialId: r.value };
    const sl = evaluateItemDisposal({ ...query, condition: "clean", city: "Riverside-tx" });
    assert.equal(r.Riverside.stream, sl.stream, r.title);
    assert.equal(r.citiesDiffer, r.Riverside.stream !== r.houston.stream);
  }
  const bottles = searchItems("bottle");
  assert.ok(bottles.results.length <= 8);
  assert.ok(bottles.total > 8 || bottles.results.length === bottles.total, "cap respected");
  const foam = searchItems("foam");
  assert.ok(foam.results.some((r) => r.citiesDiffer), "#6 foam differs between the cities");
});

test("search Wave 2: natural compound queries resolve through aliases, stopwords and resin stamps", () => {
  const cases = [
    ["rinsed #5 yogurt tub with foil lid", "resin-5-pp"],
    ["paper coffee cup with plastic lid", "resin-7-other"],
    ["broken drinking glass", "broken-glass-ceramic"],
    ["crushed aluminum can", "aluminum-steel-can"],
    ["aerosol can empty", "aluminum-steel-can"],
    ["black plastic #5 takeout tray", "resin-5-pp"],
    ["solo cup", "resin-6-ps-foam"],
    ["tupperware", "resin-5-pp"],
    ["cereal box", "clean-cardboard-paper"],
    ["newspaper", "clean-cardboard-paper"],
    ["tv", "electronics-ewaste"],
    ["charger", "electronics-ewaste"],
    ["christmas lights", "electronics-ewaste"],
    ["greasy cardboard pizza box", "greasy-pizza-box"],
    ["batery", "lithium-household-battery"],
    ["number 5 plastic", "resin-5-pp"]
  ];
  for (const [query, expected] of cases) {
    const r = searchItems(query);
    assert.ok(
      r.results.some((hit) => hit.value === expected),
      `"${query}" -> ${expected}; got ${r.results.map((hit) => hit.value).join(", ") || "nothing"}`
    );
  }
  const ambiguous = searchItems("shredded paper in plastic bag");
  assert.equal(ambiguous.partial, true, "paper and film split the terms");
  for (const expected of ["clean-cardboard-paper", "resin-4-ldpe-film"]) {
    assert.ok(ambiguous.results.some((hit) => hit.value === expected), `shredded query -> ${expected}`);
  }
});

test("search Wave 2: plurals, diacritics, UPC digits and partial fallback all reach results", () => {
  assert.ok(searchItems("bottles").results.length >= 3, "plural bottle");
  const accent = searchItems("Tópo Chico");
  assert.ok(accent.results.some((r) => /Topo Chico/.test(r.title)), "diacritics fold");
  const upc = searchItems("041220948321");
  assert.equal(upc.results[0].kind, "barcode");
  assert.equal(upc.results[0].value, "041220948321");
  assert.equal(upc.partial, false, "a UPC is a full match");
  const cross = searchItems("yogurt battery");
  assert.equal(cross.partial, true, "terms split across two items flag closest matches");
  assert.ok(cross.results.length >= 2);
  assert.match(renderSearchResults(cross), /Closest matches/);
  const dead = searchItems("unobtainium frobnicate");
  assert.equal(dead.results.length, 0);
  assert.match(renderSearchResults(dead), /material category below/);
  const stopOnly = searchItems("the and of");
  assert.equal(stopOnly.total, 0, "stopwords alone match nothing");
});

test("search: results render escaped, and a hostile query is shown as text", () => {
  const out = renderSearchResults(searchItems('<img src=x onerror="1">'));
  assert.equal(/<img/.test(out), false);
  assert.match(out, /&lt;img src=x onerror=&quot;1&quot;&gt;/);
  const hits = renderSearchResults(searchItems("glass"));
  assert.match(hits, /data-action="search-pick"/);
  assert.match(hits, /verdict-chip verdict-recycle/);
});

test("calculator: one battery among 30 clean bottles is a rejected load even though the average is low", () => {
  const r = computeContaminationImpact({ query: { materialId: "lithium-household-battery", condition: "clean" }, cleanCount: 30, itemCount: 1 });
  assert.equal(r.total, 31);
  assert.equal(r.itemRisk, 100);
  assert.equal(r.loadStatus, "REJECTED_CONTAMINATED_LOAD");
  assert.ok(r.averageRiskScore < 25);
  assert.equal(r.averageHidesProblem, true);
  assert.equal(r.wrongItems, 1);
  const html = renderImpact(r);
  assert.match(html, /Contaminated load alert/);
  assert.match(html, /cannot dilute it/);
  assert.equal((html.match(/class="impact-cell /g) || []).length, 31);
});

test("calculator: numbers equal the engine's own scoreCartBatch for the same cart", () => {
  for (const city of CITIES) {
    for (const id of Object.keys(MATERIAL_CATEGORIES)) {
      const query = { materialId: id, condition: "clean" };
      const r = computeContaminationImpact({ query, city, cleanCount: 12, itemCount: 2 });
      const items = [...Array(12).fill(CLEAN_BASELINE_ITEM), query, query];
      const direct = scoreCartBatch(items, city);
      assert.equal(r.averageRiskScore, direct.averageRiskScore, `${id} ${city}`);
      assert.equal(r.maxRiskScore, direct.maxRiskScore);
      assert.equal(r.loadStatus, direct.loadStatus);
    }
  }
});

test("calculator: clamps inputs and handles an empty cart", () => {
  const r = computeContaminationImpact({ query: { materialId: "aluminum-steel-can" }, cleanCount: 999, itemCount: -4 });
  assert.equal(r.cleanCount, 40);
  assert.equal(r.itemCount, 0);
  assert.equal(r.loadStatus, "CLEAN_CURBSIDE_LOAD");
  const empty = computeContaminationImpact({ query: {}, cleanCount: 0, itemCount: 0 });
  assert.equal(empty.total, 0);
  assert.match(renderImpact(empty), /Add at least one item/);
  assert.equal(computeContaminationImpact({ cleanCount: "x", itemCount: "y" }).cleanCount, 20);
});

test("verdict banner escapes engine text and names the city", () => {
  const ev = evaluateItemDisposal({ barcode: VERIFIED_BARCODE_CATALOG[0].upc, city: "houston-tx" });
  const out = renderVerdictBanner({ ...ev, badgeLabel: '<b>"x"</b>' });
  assert.match(out, /data-stream="RECYCLE_CART"/);
  assert.match(out, /&lt;b&gt;&quot;x&quot;&lt;\/b&gt;/);
  assert.match(out, /Houston/);
});

test("ui: typing in search lists matches, Enter opens the top hit, and picks load the item", () => {
  const dom = createFakeDom(html);
  const app = createApp({ document: dom.document, window: dom.window, deps: { download() {}, now: () => 0 } });
  const el = (id) => dom.byId.get(id);
  assert.match(el("search-count").textContent, /^45 items$/);
  dom.input(el("item-search"), "topo");
  assert.match(el("search-results").innerHTML, /Topo Chico/);
  assert.match(el("search-count").textContent, /match/);
  const topo = VERIFIED_BARCODE_CATALOG.find((i) => /Topo Chico/.test(i.productName));
  const pick = new FakeElement("button", { "data-action": "search-pick", "data-kind": "barcode", "data-value": topo.upc });
  dom.click(pick);
  assert.equal(app.getState().barcode, topo.upc);
  const material = new FakeElement("button", { "data-action": "search-pick", "data-kind": "material", "data-value": "resin-6-ps-foam" });
  dom.click(material);
  assert.equal(app.getState().materialId, "resin-6-ps-foam");
  const esc = dom.key("Escape", el("item-search"));
  assert.equal(esc.defaultPrevented, true);
  assert.equal(el("search-results").innerHTML, "");
  app.destroy();
});

test("ui: calculator sliders re-score the load for the current item and city", () => {
  const dom = createFakeDom(html);
  const app = createApp({ document: dom.document, window: dom.window, deps: { download() {}, now: () => 0 } });
  const el = (id) => dom.byId.get(id);
  assert.match(el("impact-output").innerHTML, /Clean curbside load/);
  app.dispatch({ type: "SELECT_MATERIAL", materialId: "lithium-household-battery" });
  assert.match(el("impact-output").innerHTML, /Contaminated load alert/);
  dom.input(el("impact-count"), "0");
  assert.equal(el("impact-count-value").textContent, "0");
  assert.match(el("impact-output").innerHTML, /Clean curbside load/);
  dom.input(el("impact-clean"), "5");
  dom.input(el("impact-count"), "2");
  assert.equal((el("impact-output").innerHTML.match(/class="impact-cell /g) || []).length, 7);
  assert.match(el("impact-item-label").textContent, /Lithium/);
  app.destroy();
});

test("page: zero third-party hosts in markup, styles or CSP, and no inline scripts", () => {
  assert.equal(/fonts\.googleapis|fonts\.gstatic/.test(html), false);
  for (const m of html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"/g)) {
    assert.equal(/^https?:/i.test(m[1]), false, m[1]);
  }
  const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  assert.equal(/https?:/.test(csp), false);
  assert.match(csp, /script-src 'self';/);
  assert.equal(/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), false);
  assert.equal(/\son[a-z]+\s*=/i.test(html), false, "inline event handlers are blocked by script-src 'self'");
});
