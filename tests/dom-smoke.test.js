import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SUPPORTED_CITIES,
  RESIN_CODE_METADATA,
  MATERIAL_CATEGORIES,
  VERIFIED_BARCODE_CATALOG,
  evaluateItemDisposal,
  compareJurisdictions
} from "../src/bincheck-engine.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const indexHtml = fs.readFileSync(path.join(repoRoot, "index.html"), "utf8");
const stylesCss = fs.readFileSync(path.join(repoRoot, "styles.css"), "utf8");
const appJs = fs.readFileSync(path.join(repoRoot, "src/app.js"), "utf8");

test("DOM Smoke 01: index.html starts with HTML5 doctype and lang=en", () => {
  assert.match(indexHtml.trimStart(), /^<!DOCTYPE html>/i);
  assert.match(indexHtml, /<html\s+lang="en"/i);
});

test("DOM Smoke 02: index.html contains exactly one <h1> element", () => {
  const h1Matches = indexHtml.match(/<h1\b[^>]*>/gi) || [];
  assert.equal(h1Matches.length, 1);
});

test("DOM Smoke 03: heading hierarchy in index.html never skips levels", () => {
  const levels = [...indexHtml.matchAll(/<h([1-6])\b/gi)].map((m) => Number(m[1]));
  assert.ok(levels.length >= 4);
  assert.equal(levels[0], 1);
  for (let i = 1; i < levels.length; i += 1) {
    assert.ok(
      levels[i] <= levels[i - 1] + 1,
      `Heading level jumped from h${levels[i - 1]} to h${levels[i]}`
    );
  }
});

test("DOM Smoke 04: all id attributes in index.html are unique", () => {
  const ids = [...indexHtml.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(ids.length >= 15);
  const uniqueIds = new Set(ids);
  assert.equal(uniqueIds.size, ids.length, "Duplicate IDs found in index.html");
});

test("DOM Smoke 05: OpenGraph and Twitter meta tags are complete", () => {
  assert.match(indexHtml, /property="og:title"\s+content="[^"]+"/);
  assert.match(indexHtml, /property="og:description"\s+content="[^"]+"/);
  assert.match(indexHtml, /property="og:type"\s+content="website"/);
  assert.match(indexHtml, /property="og:url"\s+content="https:\/\/[^"]+"/);
  assert.match(indexHtml, /name="twitter:card"\s+content="summary_large_image"/);
});

test("DOM Smoke 06: inline SVG favicon link is present in <head>", () => {
  assert.match(indexHtml, /<link\s+rel="icon"\s+type="image\/svg\+xml"\s+href="data:image\/svg\+xml,/);
});

test("DOM Smoke 07: accessible skip-link points to #main-content and target exists", () => {
  assert.match(indexHtml, /<a\s+class="skip-link"\s+href="#main-content">/);
  assert.match(indexHtml, /<main\s+id="main-content"/);
});

test("DOM Smoke 08: <noscript> fallback banner is present inside <body>", () => {
  assert.match(indexHtml, /<noscript>[\s\S]*?<div\s+class="noscript-banner"[\s\S]*?<\/noscript>/);
});

test("DOM Smoke 09: styles.css enforces overflow-x: clip on html and body", () => {
  assert.match(stylesCss, /html,\s*body\s*\{\s*overflow-x:\s*clip;/);
});

test("DOM Smoke 10: styles.css provides :focus-visible outline and reduced-motion guard", () => {
  assert.match(stylesCss, /:focus-visible\s*\{[\s\S]*?outline:/);
  assert.match(stylesCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test("DOM Smoke 11: styles.css enforces tabular-nums on numeric readouts", () => {
  assert.match(stylesCss, /font-variant-numeric:\s*tabular-nums/);
});

test("DOM Smoke 12: zero em-dashes or en-dashes across HTML, CSS, and UI JS", () => {
  assert.equal(/[\u2013\u2014]/.test(indexHtml), false);
  assert.equal(/[\u2013\u2014]/.test(stylesCss), false);
  assert.equal(/[\u2013\u2014]/.test(appJs), false);
});

test("DOM Smoke 13: zero emoji characters across HTML, CSS, and UI JS", () => {
  const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  assert.equal(emojiRegex.test(indexHtml), false);
  assert.equal(emojiRegex.test(stylesCss), false);
  assert.equal(emojiRegex.test(appJs), false);
});

test("DOM Smoke 14: zero uppercase CSS transforms in styles.css", () => {
  assert.equal(/text-transform\s*:\s*uppercase/i.test(stylesCss), false);
});

test("DOM Smoke 15: all 7 SPI resin buttons (#1 to #7) exist in index.html and match engine metadata", () => {
  for (let code = 1; code <= 7; code += 1) {
    assert.match(indexHtml, new RegExp(`data-resin="${code}"`));
    assert.ok(RESIN_CODE_METADATA[code], `Missing RESIN_CODE_METADATA[${code}]`);
  }
});

test("DOM Smoke 16: all 17 material <option> values in #material-select match MATERIAL_CATEGORIES", () => {
  const selectMatch = indexHtml.match(/<select id="material-select"[\s\S]*?<\/select>/);
  assert.ok(selectMatch);
  const optionValues = [...selectMatch[0].matchAll(/value="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(optionValues.length, 17);
  for (const val of optionValues) {
    assert.ok(MATERIAL_CATEGORIES[val], `Option ${val} missing in MATERIAL_CATEGORIES`);
  }
});

test("DOM Smoke 17: all 3 jurisdiction mode buttons exist and match SUPPORTED_CITIES or compare mode", () => {
  assert.match(indexHtml, /data-city-mode="sugar-land-tx"/);
  assert.match(indexHtml, /data-city-mode="houston-tx"/);
  assert.match(indexHtml, /data-city-mode="compare"/);
  assert.ok(SUPPORTED_CITIES["sugar-land-tx"]);
  assert.ok(SUPPORTED_CITIES["houston-tx"]);
});

test("DOM Smoke 18: all 7 one-tap demo scenario pills in index.html are wired in src/app.js", () => {
  const demoIds = [...indexHtml.matchAll(/data-demo="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(demoIds.length, 7);
  for (const id of demoIds) {
    assert.ok(appJs.includes(`"${id}":`), `Demo scenario ${id} missing in src/app.js`);
  }
});

test("DOM Smoke 19: all DOM element IDs referenced via getElementById in src/app.js exist in index.html", () => {
  const htmlIds = new Set([...indexHtml.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const jsIds = [...appJs.matchAll(/getElementById\("([^"]+)"\)/g)].map((m) => m[1]);
  assert.ok(jsIds.length >= 10);
  for (const id of jsIds) {
    assert.ok(htmlIds.has(id), `ID #${id} referenced in src/app.js is missing from index.html`);
  }
});

test("DOM Smoke 20: engine evaluation & jurisdiction comparison produce clean strings for all 28 catalog items", () => {
  assert.equal(VERIFIED_BARCODE_CATALOG.length, 28);
  for (const item of VERIFIED_BARCODE_CATALOG) {
    const comp = compareJurisdictions({ barcode: item.upc });
    assert.ok(comp.itemTitle.includes(item.productName));
    assert.equal(/[\u2013\u2014]/.test(comp.divergenceSummary), false);
    const single = evaluateItemDisposal({ barcode: item.upc, city: "sugar-land-tx" });
    assert.ok(single.prepSteps.length >= 2);
  }
});
