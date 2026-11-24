import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { evaluateItemDisposal, resolveMaterialProfile } from "../src/bincheck-engine.js";

const ROOT = path.join(import.meta.dirname, "..");
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

test("offline: service worker precaches every shipped runtime asset that exists", () => {
  const sw = read("sw.js");
  assert.match(sw, /CACHE_NAME = "bincheck-offline-2026-11-24-v1"/);
  const assets = [...sw.matchAll(/"(\.\/[^"]+)"/g)].map((match) => match[1]).filter((asset) => asset !== "./");
  assert.ok(assets.length >= 20);
  for (const asset of assets) {
    assert.ok(fs.existsSync(path.join(ROOT, asset)), `${asset} missing`);
  }
  for (const required of ["./index.html", "./styles.css", "./src/app.js", "./src/render.js", "./js/bincheck-engine.js", "./data/municipal-rules-2026.js", "./img/hero-materials.jpg"]) {
    assert.ok(assets.includes(required), `${required} not precached`);
  }
});

test("offline: service worker is same-origin, GET-only, network-first for pages and cache-first for assets", () => {
  const sw = read("sw.js");
  assert.ok(sw.includes('request.method !== "GET"'));
  assert.ok(sw.includes("url.origin !== self.location.origin"));
  assert.ok(sw.includes('request.mode === "navigate"'));
  assert.ok(sw.includes("networkFirstPage(request)"));
  assert.ok(sw.includes("cacheFirstAsset(request)"));
  assert.ok(sw.includes('cache.match("./index.html", { ignoreSearch: true })'));
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
