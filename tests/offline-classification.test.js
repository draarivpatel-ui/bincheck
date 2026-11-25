import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateItemDisposal, resolveMaterialProfile } from "../src/bincheck-engine.js";
import { createApp } from "../src/app.js";
import { createFakeDom } from "./fake-dom.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

test("classification: liquid-full #2 HDPE keeps resin #2 instead of collapsing to #1 PET", () => {
  const profile = resolveMaterialProfile({ materialId: "resin-2-hdpe", condition: "liquid-full" });
  assert.equal(profile.category.id, "liquid-full-bottle");
  assert.equal(profile.category.resinCode, 2);
  const result = evaluateItemDisposal({ materialId: "resin-2-hdpe", condition: "liquid-full", city: "houston-tx" });
  assert.equal(result.resinCode, 2);
  assert.ok(result.ruleCitations.some((entry) => entry.quote.includes("#2 is in this list")), JSON.stringify(result.ruleCitations));
  assert.ok(!result.ruleCitations.some((entry) => entry.quote.includes("#1 is in this list")));
});

test("classification: liquid-full #1 PET still cites resin #1", () => {
  const result = evaluateItemDisposal({ materialId: "resin-1-pet", condition: "liquid-full", city: "Riverside-tx" });
  assert.equal(result.resinCode, 1);
  assert.ok(result.ruleCitations.some((entry) => entry.quote.includes("#1 is in this list")));
});

test("classification: liquid-full #2 chemical jugs warn against pouring chemicals out", () => {
  const result = evaluateItemDisposal({ barcode: "044600015996", condition: "liquid-full", city: "Riverside-tx" });
  assert.equal(result.resinCode, 2);
  assert.ok(result.prepSteps.some((step) => /Never pour chemicals, motor oil, pesticides/.test(step)), JSON.stringify(result.prepSteps));
  assert.ok(result.prepSteps.every((step) => !/pour all leftover liquid down the drain/.test(step)), JSON.stringify(result.prepSteps));
});

test("classification: direct liquid-full category honors an explicit #2 resin stamp", () => {
  const profile = resolveMaterialProfile({ materialId: "liquid-full-bottle", resinCode: 2, condition: "liquid-full" });
  assert.equal(profile.category.id, "liquid-full-bottle");
  assert.equal(profile.category.resinCode, 2);
  const result = evaluateItemDisposal({ materialId: "liquid-full-bottle", resinCode: 2, condition: "liquid-full", city: "houston-tx" });
  assert.equal(result.resinCode, 2);
  assert.ok(result.ruleCitations.some((entry) => entry.quote.includes("#2 is in this list")), JSON.stringify(result.ruleCitations));
});

test("offline: service worker precaches every shipped runtime asset that exists", () => {
  const sw = read("sw.js");
  assert.match(sw, /CACHE_NAME = "bincheck-offline-2026-11-25-v4"/);
  assert.ok(sw.includes('key.startsWith("bincheck-offline-")'), "activation must not delete other apps' caches");
  const assets = [...sw.matchAll(/"(\.\/[^"]+)"/g)].map((match) => match[1]).filter((asset) => asset !== "./");
  assert.ok(assets.length >= 20);
  for (const asset of assets) {
    assert.ok(fs.existsSync(path.join(ROOT, asset)), `${asset} missing`);
  }
  for (const required of ["./index.html", "./styles.css", "./src/app.js", "./src/render.js", "./js/bincheck-engine.js", "./data/municipal-rules-2026.js", "./img/hero-materials.jpg"]) {
    assert.ok(assets.includes(required), `${required} not precached`);
  }

  const seen = new Set();
  const importRe = /\b(?:import|export)\s+(?:[^'";]*?\s+from\s+)?["']([^"']+)["']/g;
  const visit = (file) => {
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(importRe)) {
      const specifier = match[1];
      if (!specifier.startsWith(".")) continue;
      const resolved = path.resolve(path.dirname(file), specifier);
      const rel = `./${path.relative(ROOT, resolved).split(path.sep).join("/")}`;
      if (seen.has(rel)) continue;
      seen.add(rel);
      assert.ok(fs.existsSync(resolved), `${rel} imported but missing`);
      visit(resolved);
    }
  };
  visit(path.join(ROOT, "src/app.js"));
  for (const moduleAsset of seen) {
    assert.ok(assets.includes(moduleAsset), `${moduleAsset} imported by the app but not precached`);
  }
});

test("offline: service worker is same-origin, GET-only, network-first for pages and runtime assets", () => {
  const sw = read("sw.js");
  assert.ok(sw.includes('request.method !== "GET"'));
  assert.ok(sw.includes("url.origin !== self.location.origin"));
  assert.ok(sw.includes('request.mode === "navigate"'));
  assert.ok(sw.includes("networkFirstPage(request)"));
  assert.ok(sw.includes("networkFirstAsset(request)"));
  assert.equal(/https?:\/\//.test(sw), false, "service worker must not depend on an external origin");
});

test("offline: the app registers the worker as a non-blocking enhancement", () => {
  const app = read("src/app.js");
  assert.ok(app.includes("registerOfflineCache(win)"));
  assert.ok(app.includes('nav.serviceWorker.register("./sw.js")'));
  assert.ok(app.includes(".catch(() =>"), "registration failure must not break the app");
});

test("offline: CSP still forbids external code and the page has no external scripts or styles", () => {
  const html = read("index.html");
  assert.match(html, /script-src 'self'/);
  assert.equal([...html.matchAll(/<script[^>]+src="(https?:)?\/\//g)].length, 0);
  assert.equal([...html.matchAll(/<link[^>]+href="(https?:)?\/\//g)].length, 0);
});

test("offline: non-html navigations cannot overwrite the app shell", () => {
  const sw = read("sw.js");
  assert.ok(sw.includes('type.includes("text/html")'));
  assert.ok(sw.includes("isShellNavigation"));
  assert.ok(sw.includes("fresh.status >= 500"));
  assert.ok(!sw.includes('ignoreSearch: true'));
});

test("offline: a throwing serviceWorker getter does not block the first render", () => {
  const dom = createFakeDom(read("index.html"));
  dom.window.location.protocol = "https:";
  Object.defineProperty(dom.window.navigator, "serviceWorker", {
    configurable: true,
    get() {
      throw new Error("sandboxed serviceWorker access");
    }
  });
  const app = createApp({
    document: dom.document,
    window: dom.window,
    deps: { download() {}, now: () => 0 }
  });
  assert.notEqual(dom.byId.get("evaluation-output").innerHTML, "");
  app.destroy();
});
