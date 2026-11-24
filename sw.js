/* BinCheck offline shell. Cache-first static assets, network-first page navigations. */
const CACHE_NAME = "bincheck-offline-2026-11-24-v1";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./img/hero-materials.jpg",
  "./img/hero-materials.png",
  "./data/municipal-rules-2026.js",
  "./data/municipal-rules-2026.json",
  "./src/app.js",
  "./src/bincheck-engine.js",
  "./src/insights.js",
  "./src/render.js",
  "./src/state.js",
  "./src/workbench-render.js",
  "./js/bincheck-audit.js",
  "./js/bincheck-batch.js",
  "./js/bincheck-benchmark.js",
  "./js/bincheck-cascade.js",
  "./js/bincheck-engine.js",
  "./js/bincheck-municipal.js",
  "./js/bincheck-report.js",
  "./js/bincheck-selftest.js",
  "./js/bincheck-sha256.js",
  "./js/bincheck-validate.js",
  "./js/ground-truth.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function networkFirstPage(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      await cache.put("./index.html", fresh.clone());
    }
    return fresh;
  } catch (_) {
    const cached = await cache.match("./index.html", { ignoreSearch: true });
    if (cached) return cached;
    throw _;
  }
}

async function cacheFirstAsset(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const fresh = await fetch(request);
  if (fresh && fresh.ok && new URL(request.url).origin === self.location.origin) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, fresh.clone());
  }
  return fresh;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }
  event.respondWith(cacheFirstAsset(request));
});
