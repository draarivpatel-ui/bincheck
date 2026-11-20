import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluateItemDisposal,
  compareJurisdictions,
  buildRuleCitations,
  MATERIAL_CATEGORIES,
  resolveMaterialProfile
} from "../src/bincheck-engine.js";
import { MUNICIPAL_RULES_SNAPSHOT } from "../data/municipal-rules-2026.js";
import { runBatchFromCsv, SAMPLE_BATCH_CSV, batchResultToCsv } from "../js/bincheck-batch.js";
import { renderRuleCitations, renderSingleEvaluation, renderComparisonView } from "../src/render.js";
import { assessEvidence } from "../js/bincheck-validate.js";
import { createFakeDom } from "./fake-dom.js";
import { createApp, DEMO_SCENARIOS, GUIDED_DEMOS } from "../src/app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const snapshotJson = JSON.parse(fs.readFileSync(path.join(root, "data", "municipal-rules-2026.json"), "utf8"));
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

const CITY_IDS = ["Riverside-tx", "houston-tx"];

/* ---------------- Snapshot parity ---------------- */

test("citations: the JS snapshot mirror is deep-equal to the canonical JSON", () => {
  assert.deepEqual(MUNICIPAL_RULES_SNAPSHOT, snapshotJson);
});

/* ---------------- Rule citation coverage ---------------- */

test("citations: every material category produces at least one citation in both cities", () => {
  for (const materialId of Object.keys(MATERIAL_CATEGORIES)) {
    for (const city of CITY_IDS) {
      const ev = evaluateItemDisposal({ materialId, city });
      assert.ok(Array.isArray(ev.ruleCitations), `${materialId}/${city} has no citation array`);
      assert.ok(ev.ruleCitations.length >= 1, `${materialId}/${city} has zero citations`);
      for (const entry of ev.ruleCitations) {
        assert.ok(entry.ruleId.startsWith(`jurisdictions.${city}.`), `${materialId}: bad ruleId ${entry.ruleId}`);
        assert.ok(typeof entry.label === "string" && entry.label.length > 0);
        assert.ok(typeof entry.quote === "string" && entry.quote.length > 0);
        assert.ok(["verbatim", "interpretation", "inference"].includes(entry.kind), `${materialId}: bad kind ${entry.kind}`);
        assert.equal(entry.source, "data/municipal-rules-2026.json");
      }
    }
  }
});

test("citations: an accepted resin cites acceptedResins verbatim in both cities", () => {
  for (const city of CITY_IDS) {
    const ev = evaluateItemDisposal({ materialId: "resin-1-pet", city });
    const cite = ev.ruleCitations.find((c) => c.ruleId.endsWith("acceptedResins"));
    assert.ok(cite, `${city}: no acceptedResins citation`);
    assert.equal(cite.kind, "verbatim");
    assert.match(cite.quote, /#1/);
  }
});

test("citations: #6 foam cites rejected resins in both cities plus the county drop-off list in Riverside", () => {
  const sl = evaluateItemDisposal({ materialId: "resin-6-ps-foam", city: "Riverside-tx" });
  const slRejected = sl.ruleCitations.find((c) => c.ruleId.endsWith("rejectedResins"));
  assert.ok(slRejected && slRejected.kind === "verbatim");
  const slDropOff = sl.ruleCitations.find((c) => c.ruleId.includes("dropOffCenter.accepts"));
  assert.ok(slDropOff, "Riverside foam should cite dropOffCenter.accepts");
  assert.equal(slDropOff.kind, "verbatim");
  assert.match(slDropOff.quote, /Polystyrene|foam/i);

  const ho = evaluateItemDisposal({ materialId: "resin-6-ps-foam", city: "houston-tx" });
  assert.ok(ho.ruleCitations.some((c) => c.ruleId.endsWith("rejectedResins")));
  assert.equal(ho.ruleCitations.some((c) => c.ruleId.includes("dropOffCenter.accepts")), false, "Houston drop-off list does not name foam");
});

test("citations: #3 PVC is conditional in Riverside but rejected in Houston", () => {
  const sl = evaluateItemDisposal({ materialId: "resin-3-pvc", city: "Riverside-tx" });
  const cond = sl.ruleCitations.find((c) => c.ruleId.endsWith("conditionalResins"));
  assert.ok(cond, "Riverside PVC should cite conditionalResins");
  assert.equal(cond.kind, "interpretation");
  const ho = evaluateItemDisposal({ materialId: "resin-3-pvc", city: "houston-tx" });
  assert.ok(ho.ruleCitations.some((c) => c.ruleId.endsWith("rejectedResins")));
});

test("citations: plastic film cites the city bag rule verbatim in both cities", () => {
  for (const city of CITY_IDS) {
    const ev = evaluateItemDisposal({ materialId: "resin-4-ldpe-film", city });
    const bag = ev.ruleCitations.find((c) => c.ruleId.endsWith("bagNote"));
    assert.ok(bag, `${city}: no bagNote citation`);
    assert.equal(bag.kind, "verbatim");
    assert.match(bag.quote, /plasticBagsAllowedInCart = false/);
  }
});

test("citations: clean glass cites the glass note and broken glass marks Riverside as interpretation", () => {
  const slBroken = evaluateItemDisposal({ materialId: "broken-glass-ceramic", city: "Riverside-tx" });
  const slGlass = slBroken.ruleCitations.find((c) => c.ruleId.endsWith("glassNote"));
  assert.ok(slGlass);
  assert.equal(slGlass.kind, "interpretation", "Riverside snapshot does not name broken glass");
  const hoBroken = evaluateItemDisposal({ materialId: "broken-glass-ceramic", city: "houston-tx" });
  const hoGlass = hoBroken.ruleCitations.find((c) => c.ruleId.endsWith("glassNote"));
  assert.ok(hoGlass);
  assert.equal(hoGlass.kind, "verbatim");
  assert.match(hoGlass.quote, /prohibited/i);
});

test("citations: greasy pizza box is verbatim and other soiled fiber is interpretation", () => {
  const pizza = evaluateItemDisposal({ materialId: "greasy-pizza-box", city: "houston-tx" });
  const pizzaCite = pizza.ruleCitations.find((c) => c.ruleId.endsWith("greasyPizzaBoxRule"));
  assert.ok(pizzaCite && pizzaCite.kind === "verbatim");

  const { category } = resolveMaterialProfile({ materialId: "clean-cardboard-paper", condition: "greasy" });
  assert.equal(category.id, "soiled-cardboard-paper");
  const soiled = evaluateItemDisposal({ materialId: "clean-cardboard-paper", condition: "greasy", city: "Riverside-tx" });
  const soiledCite = soiled.ruleCitations.find((c) => c.ruleId.endsWith("greasyPizzaBoxRule"));
  assert.ok(soiledCite && soiledCite.kind === "interpretation");
});

test("citations: yard waste quotes the city green waste program verbatim", () => {
  const sl = evaluateItemDisposal({ materialId: "yard-trimmings-brush", city: "Riverside-tx" });
  const slCite = sl.ruleCitations.find((c) => c.ruleId.endsWith("greenWasteProgram"));
  assert.ok(slCite && slCite.kind === "verbatim");
  assert.match(slCite.quote, /40 pounds|paper lawn bags/i);
  const ho = evaluateItemDisposal({ materialId: "yard-trimmings-brush", city: "houston-tx" });
  const hoCite = ho.ruleCitations.find((c) => c.ruleId.endsWith("greenWasteProgram"));
  assert.match(hoCite.quote, /city logo|50 pounds/i);
});

test("citations: a lithium battery cites the drop-off accepted list in both cities", () => {
  for (const city of CITY_IDS) {
    const ev = evaluateItemDisposal({ materialId: "lithium-household-battery", city });
    const cite = ev.ruleCitations.find((c) => c.ruleId.includes("dropOffCenter.accepts"));
    assert.ok(cite, `${city}: no drop-off citation for batteries`);
    assert.equal(cite.kind, "verbatim");
    assert.match(cite.quote, /batter/i);
  }
});

test("citations: liquid-full bottles and unlisted materials carry an honest inference marker", () => {
  const liquid = evaluateItemDisposal({ materialId: "liquid-full-bottle", city: "Riverside-tx" });
  assert.ok(liquid.ruleCitations.some((c) => c.kind === "inference"), "liquid fill needs an inference citation");
  const can = evaluateItemDisposal({ materialId: "aluminum-steel-can", city: "houston-tx" });
  assert.ok(can.ruleCitations.every((c) => c.kind === "inference"), "unlisted metal can is inference only");
  const cites = buildRuleCitations("not-a-city", MATERIAL_CATEGORIES["resin-1-pet"]);
  assert.deepEqual(cites, []);
});

/* ---------------- Rule trace rendering ---------------- */

test("render: single evaluation shows the municipal rule trace with escaped quotes", () => {
  const ev = evaluateItemDisposal({ materialId: "resin-6-ps-foam", city: "houston-tx" });
  const htmlOut = renderSingleEvaluation(ev, assessEvidence({ materialId: "resin-6-ps-foam" }));
  assert.match(htmlOut, /Municipal rule trace/);
  assert.match(htmlOut, /curbsideCartRules\.rejectedResins/);
  assert.match(htmlOut, /cite-kind-verbatim/);
});

test("render: malicious text inside a citation is escaped", () => {
  const out = renderRuleCitations([
    { ruleId: "x.<script>", label: "t", quote: '<img src=x onerror="boom()">', kind: "verbatim", source: "s" }
  ]);
  assert.equal(out.includes("<script>"), false);
  assert.match(out, /&lt;img src=x/);
  assert.equal(renderRuleCitations([]), "");
  assert.equal(renderRuleCitations(null), "");
});

/* ---------------- Verdict flip banner ---------------- */

test("render: compare view shows the flip banner only when the streams diverge", () => {
  const foam = compareJurisdictions({ materialId: "resin-6-ps-foam" });
  assert.equal(foam.sameStream, false);
  const flipHtml = renderComparisonView(foam, assessEvidence({ materialId: "resin-6-ps-foam" }));
  assert.match(flipHtml, /verdict-flip/);
  assert.match(flipHtml, /Same item\. Different verdict\./);

  const pet = compareJurisdictions({ materialId: "resin-1-pet" });
  assert.equal(pet.sameStream, true);
  const sameHtml = renderComparisonView(pet, assessEvidence({ materialId: "resin-1-pet" }));
  assert.equal(sameHtml.includes("verdict-flip"), false);
});

test("render: compare columns embed a rule trace per city", () => {
  const comp = compareJurisdictions({ materialId: "resin-6-ps-foam" });
  const htmlOut = renderComparisonView(comp, assessEvidence({ materialId: "resin-6-ps-foam" }));
  assert.match(htmlOut, /jurisdictions\.Riverside-tx\.dropOffCenter\.accepts/);
  assert.match(htmlOut, /jurisdictions\.houston-tx\.curbsideCartRules\.rejectedResins/);
});

/* ---------------- CSV edge cases ---------------- */

test("csv: headerless rows wider than five cells report EXTRA_CELLS but still evaluate", () => {
  const result = runBatchFromCsv("041220576463,resin-1-pet,,clean,label one,EXTRA,ANOTHER");
  const extra = result.parse.errors.find((e) => e.code === "EXTRA_CELLS");
  assert.ok(extra, "no EXTRA_CELLS warning");
  assert.match(extra.message, /2 extra cell/);
  assert.equal(result.totals.evaluated, 1);
  assert.equal(result.rows[0].label, "label one");
});

test("csv: a data row wider than its header reports EXTRA_CELLS", () => {
  const csv = ["label,barcode,material", "Bottle,041220576463,,unexpected,extra"].join("\n");
  const result = runBatchFromCsv(csv);
  assert.ok(result.parse.errors.some((e) => e.code === "EXTRA_CELLS"));
  assert.equal(result.totals.evaluated, 1);
});

test("csv: unicode labels survive parse, inspection and export without mangling", () => {
  const csv = ["label,barcode,material,resin,condition", "Botella de agua \u00f1and\u00fa \ud83e\udeb4,041220576463,,,clean"].join("\n");
  const result = runBatchFromCsv(csv);
  assert.equal(result.totals.evaluated, 1);
  assert.equal(result.rows[0].label, "Botella de agua \u00f1and\u00fa \ud83e\udeb4");
  const exported = batchResultToCsv(result);
  assert.match(exported, /Botella de agua/);
  const renderCheck = JSON.stringify(result.rows[0]);
  assert.ok(renderCheck.includes("\u00f1"));
});

test("csv: deterministic diversion math on the synthetic sample batch", () => {
  const result = runBatchFromCsv(SAMPLE_BATCH_CSV);
  const sl = result.cities["Riverside-tx"];
  const ho = result.cities["houston-tx"];
  assert.equal(sl.itemCount, 9);
  assert.equal(sl.cartEligible, 4);
  assert.equal(sl.cartEligiblePct, 44);
  assert.equal(sl.notCartEligible, 5);
  assert.equal(ho.cartEligible, 4);
  assert.equal(ho.cartEligiblePct, 44);
  assert.equal(ho.notCartEligible, 5);
  const again = runBatchFromCsv(SAMPLE_BATCH_CSV);
  assert.deepEqual(again.cities["Riverside-tx"], sl);
});

/* ---------------- Guided demos ---------------- */

function boot() {
  const dom = createFakeDom(html);
  const app = createApp({
    document: dom.document,
    window: dom.window,
    deps: { download: () => {}, now: () => 0.1 }
  });
  return { dom, app, el: (id) => dom.byId.get(id) };
}

test("guided: city-flip demo forces compare mode on the divergent foam item", () => {
  const { dom, el, app } = boot();
  const card = dom.all.find((node) => node.getAttribute && node.getAttribute("data-guided") === "city-flip");
  assert.ok(card, "city-flip guided card not found in index.html");
  dom.click(card);
  const out = el("evaluation-output").innerHTML;
  assert.match(out, /verdict-flip/);
  assert.match(out, /Same item\. Different verdict\./);
  assert.match(out, /county|Special drop-off/i);
  app.destroy();
});

test("guided: contamination trap loads the lithium battery into the calculator at 30 clean bottles", () => {
  const { dom, el, app } = boot();
  const card = dom.all.find((node) => node.getAttribute && node.getAttribute("data-guided") === "contamination-trap");
  assert.ok(card);
  dom.click(card);
  assert.equal(el("impact-clean").value, "30");
  assert.equal(el("impact-count").value, "1");
  const out = el("impact-output").innerHTML;
  assert.match(out, /Batteries/);
  assert.match(out, /Contaminated load alert/);
  app.destroy();
});

test("guided: csv audit loads the synthetic sample and runs the inspection in one click", () => {
  const { dom, el, app } = boot();
  const card = dom.all.find((node) => node.getAttribute && node.getAttribute("data-guided") === "csv-audit");
  assert.ok(card);
  dom.click(card);
  assert.match(el("csv-input").value, /Spring water bottle/);
  const out = el("csv-results").innerHTML;
  assert.match(out, /cart-eligible/);
  assert.match(out, /44%/);
  app.destroy();
});

test("guided: all three demo ids in the rail resolve to a defined guided demo", () => {
  for (const id of Object.keys(GUIDED_DEMOS)) {
    const el = html.match(new RegExp(`data-guided="${id}"`));
    assert.ok(el, `guided demo ${id} missing from index.html`);
    const spec = GUIDED_DEMOS[id];
    if (spec.scenario) {
      assert.ok(DEMO_SCENARIOS[spec.scenario], `guided demo ${id} points at an unknown scenario`);
    }
  }
});
