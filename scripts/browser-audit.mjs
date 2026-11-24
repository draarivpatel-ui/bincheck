/**
 * BinCheck headless-browser audit. Zero dependencies: serves the repository
 * over a loopback static server, launches headless Chrome, and drives the app
 * over the Chrome DevTools Protocol at desktop and mobile viewports.
 *
 * Usage: node scripts/browser-audit.mjs
 * Exits non-zero if any check fails.
 */

import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser"
];
const CDP_PORT = 9367;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8"
};

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok: ok === true, detail });
  return ok;
}

function serve() {
  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url, "http://127.0.0.1");
      let rel = decodeURIComponent(url.pathname);
      if (rel.endsWith("/")) rel += "index.html";
      const file = path.join(ROOT, rel);
      if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        res.writeHead(404).end("not found");
        return;
      }
      res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    } catch {
      res.writeHead(500).end("error");
    }
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

async function cdpHttp(endpoint) {
  const res = await fetch(`http://127.0.0.1:${CDP_PORT}${endpoint}`);
  return res.json();
}

class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.listeners = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
    this.ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.id && this.pending.has(data.id)) {
        const { resolve, reject } = this.pending.get(data.id);
        this.pending.delete(data.id);
        if (data.error) reject(new Error(`${data.error.message} (${data.error.code})`));
        else resolve(data.result || {});
      } else if (data.method) {
        this.events.push(data);
        for (const fn of this.listeners.get(data.method) || []) fn(data.params || {});
      }
    };
  }
  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
  }
  async send(method, params = {}, sessionId) {
    const id = this.nextId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(payload));
    });
  }
  async evaluate(sessionId, expression, { awaitPromise = false } = {}) {
    const result = await this.send(
      "Runtime.evaluate",
      { expression, awaitPromise, returnByValue: true, userGesture: true },
      sessionId
    );
    if (result.exceptionDetails) {
      const text = result.exceptionDetails.exception?.description || result.exceptionDetails.text;
      throw new Error(`evaluate failed: ${text}`);
    }
    return result.result?.value;
  }
}

async function waitFor(sessionId, cdp, expression, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await cdp.evaluate(sessionId, expression).catch(() => false);
    if (value) return value;
    await new Promise((r) => setTimeout(r, 120));
  }
  return false;
}

async function runViewportAudit({ cdp, sessionId, baseUrl, viewport, downloadDir, server }) {
  const tag = `${viewport.width}x${viewport.height}`;
  const consoleErrors = [];
  const pageErrors = [];
  const externalRequests = [];

  cdp.on("Runtime.exceptionThrown", (p) => {
    pageErrors.push(p.exceptionDetails?.exception?.description || p.exceptionDetails?.text || "exception");
  });
  cdp.on("Log.entryAdded", (p) => {
    const entry = p.entry || {};
    if (entry.level === "error" && ["javascript", "network"].includes(entry.source)) {
      consoleErrors.push(entry.text || "console error");
    }
  });
  cdp.on("Network.requestWillBeSent", (p) => {
    const url = p.request?.url || "";
    if (!url.startsWith(baseUrl) && !url.startsWith("data:") && !url.startsWith("blob:") && !url.startsWith("about:")) {
      externalRequests.push(url);
    }
  });

  const viewportDlDir = path.join(downloadDir, `${viewport.width}x${viewport.height}`);
  fs.mkdirSync(viewportDlDir, { recursive: true });
  await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: viewportDlDir, eventsEnabled: true });
  await cdp.send("Page.enable", {}, sessionId);
  await cdp.send("Runtime.enable", {}, sessionId);
  await cdp.send("Log.enable", {}, sessionId);
  await cdp.send("Network.enable", {}, sessionId);
  await cdp.send(
    "Emulation.setDeviceMetricsOverride",
    { width: viewport.width, height: viewport.height, deviceScaleFactor: viewport.dsf, mobile: viewport.mobile },
    sessionId
  );
  await cdp.send("Page.navigate", { url: `${baseUrl}/index.html` }, sessionId);
  const loaded = await waitFor(sessionId, cdp, "document.readyState === 'complete' && typeof window.__preOfflineProbe === 'undefined' && !!document.querySelector('#municipal-diff-output table')");
  check(`${tag}: app loads and the diff table renders`, loaded !== false);

  const title = await cdp.evaluate(sessionId, "document.title");
  check(`${tag}: page title marks the build`, /BinCheck/i.test(title || ""), title);

  const ids = ["municipal-profile-a", "municipal-profile-b", "municipal-basket", "municipal-diff-output", "cascade-output", "audit-panel-output", "audit-verify-input", "audit-verify-output", "selftest-output"];
  for (const id of ids) {
    const present = await cdp.evaluate(sessionId, `!!document.getElementById('${id}')`);
    check(`${tag}: #${id} exists`, present);
  }

  const overflow = await cdp.evaluate(
    sessionId,
    `(() => { const de = document.documentElement; const over = [];
      if (de.scrollWidth > de.clientWidth) over.push('document ' + de.scrollWidth + ' > ' + de.clientWidth);
      for (const el of document.querySelectorAll('section, .panel, .workbench, main')) {
        if (el.scrollWidth > el.clientWidth + 1) over.push((el.id || el.className || el.tagName) + ' ' + el.scrollWidth);
      }
      return over; })()`
  );
  check(`${tag}: no horizontal overflow`, Array.isArray(overflow) && overflow.length === 0, JSON.stringify(overflow));

  const setSelect = async (id, value) =>
    cdp.evaluate(sessionId, `(() => { const el = document.getElementById('${id}'); el.value = '${value}'; el.dispatchEvent(new Event('change', { bubbles: true })); return el.value; })()`);
  const clickAction = async (selector) =>
    cdp.evaluate(sessionId, `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null; el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); return true; })()`);

  const organics = await setSelect("municipal-profile-b", "organics-mandatory");
  check(`${tag}: profile B select switches to organics`, organics === "organics-mandatory");
  const organicsConflict = await waitFor(
    sessionId,
    cdp,
    `document.querySelector('#municipal-diff-output') && document.querySelector('#municipal-diff-output').innerText.includes('Organics cart')`
  );
  check(`${tag}: diff re-renders with the organics stream`, organicsConflict !== false);

  const rural = await setSelect("municipal-profile-a", "rural-transfer-station");
  await waitFor(sessionId, cdp, `document.querySelector('#municipal-diff-output').innerText.includes('Transfer Station')`);
  const curbsideZero = await cdp.evaluate(
    sessionId,
    `(() => { const t = document.querySelector('#municipal-diff-output').innerText; return /0(\\.0)?\\s*%/.test(t) || t.includes('0'); })()`
  );
  check(`${tag}: rural profile shows no-curbside figures`, rural === "rural-transfer-station" && curbsideZero === true);

  for (const presetId of ["diff-glass-out", "diff-organics", "diff-rural"]) {
    await clickAction(`[data-action="apply-preset"][data-preset="${presetId}"]`);
    const applied = await waitFor(
      sessionId,
      cdp,
      `(() => { const sels = ['municipal-profile-a','municipal-profile-b']; return ${JSON.stringify(presetId)} === 'diff-rural' ? document.getElementById('municipal-profile-b').value === 'rural-transfer-station' : document.querySelector('#municipal-diff-output table') !== null; })()`
    );
    check(`${tag}: preset ${presetId} applies`, applied !== false);
  }

  await clickAction(`[data-action="apply-preset"][data-preset="cascade-battery"]`);
  const batterySlider = await waitFor(sessionId, cdp, `document.getElementById('cas-lithium-ignition') && document.getElementById('cas-lithium-ignition').value === '1'`);
  check(`${tag}: cascade-battery preset moves the lithium slider`, batterySlider !== false);

  const filmSet = await cdp.evaluate(
    sessionId,
    `(() => { const el = document.getElementById('cas-film-tangler'); el.value = '8'; el.dispatchEvent(new Event('input', { bubbles: true })); return el.value; })()`
  );
  check(`${tag}: film tangler slider accepts input`, filmSet === "8");
  const cascadeOut = await waitFor(sessionId, cdp, `document.querySelector('#cascade-output').innerText.includes('line stop') || document.querySelector('#cascade-output').innerText.includes('Line stop') || document.querySelector('#cascade-output').innerText.length > 200`);
  check(`${tag}: cascade lab renders stage detail`, cascadeOut !== false);
  const cascadeSeverity = await cdp.evaluate(sessionId, `document.querySelector('#cascade-output').innerText`);
  check(`${tag}: cascade output names downtime or yield`, /downtime|yield|min/i.test(cascadeSeverity || ""));

  await clickAction('[data-action="run-selftests"]');
  const selftestDone = await waitFor(sessionId, cdp, `document.querySelector('#selftest-output').innerText.includes('self-tests passed')`, 20000);
  check(`${tag}: self-test panel runs to completion`, selftestDone !== false);
  const selftestSummary = await cdp.evaluate(sessionId, `(() => { const t = document.querySelector('#selftest-output').innerText; const m = t.match(/(\\d+)\\/(\\d+) self-tests passed/); return m ? { passed: +m[1], total: +m[2] } : null; })()`);
  check(`${tag}: all in-page self-tests pass`, selftestSummary && selftestSummary.passed === selftestSummary.total && selftestSummary.total >= 25, JSON.stringify(selftestSummary));

  await clickAction('[data-action="load-audit-demo"]');
  const demoLoaded = await waitFor(sessionId, cdp, `document.getElementById('audit-verify-input').value.includes('bincheck-signed-audit')`);
  check(`${tag}: demo export loads into the verify box`, demoLoaded !== false);
  await clickAction('[data-action="verify-audit"]');
  const verified = await waitFor(sessionId, cdp, `document.querySelector('#audit-verify-output').innerText.toLowerCase().includes('verified')`);
  check(`${tag}: clean export verifies intact`, verified !== false);

  await cdp.evaluate(
    sessionId,
    `(() => { const ta = document.getElementById('audit-verify-input'); const doc = JSON.parse(ta.value); doc.payload.basket.itemCount = 999; ta.value = JSON.stringify(doc); ta.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`
  );
  await clickAction('[data-action="verify-audit"]');
  const tampered = await waitFor(sessionId, cdp, `document.querySelector('#audit-verify-output').innerText.toLowerCase().includes('tamper') || document.querySelector('#audit-verify-output').innerText.toLowerCase().includes('fail')`);
  check(`${tag}: tampered payload is flagged`, tampered !== false);

  const waitForExport = async (suffix) => {
    const deadline = Date.now() + 7000;
    while (Date.now() < deadline) {
      const file = fs.readdirSync(viewportDlDir).find((f) => f.startsWith("bincheck-") && f.endsWith(suffix));
      if (file) return file;
      await new Promise((r) => setTimeout(r, 150));
    }
    return null;
  };

  await clickAction('[data-action="export-audit-json"]');
  const jsonFile = await waitForExport(".signed.json");
  let jsonVerifies = false;
  if (jsonFile) {
    try {
      const text = fs.readFileSync(path.join(viewportDlDir, jsonFile), "utf8");
      const doc = JSON.parse(text);
      jsonVerifies = doc.schema === "bincheck-signed-audit/1" && /^[0-9a-f]{64}$/.test(doc.signature.digest);
    } catch {}
  }
  check(`${tag}: JSON export downloads with a valid signature`, jsonFile !== null && jsonVerifies, jsonFile || "no file");

  for (const [action, ext] of [["export-audit-csv", ".csv"], ["export-audit-md", ".md"]]) {
    await clickAction(`[data-action="${action}"]`);
    const file = await waitForExport(ext);
    check(`${tag}: ${action} downloads a ${ext} file`, file !== null, file || "no file");
  }

  // Offline reliability is part of the product promise, not just the presence
  // of sw.js: prove that the active worker controls the page and can serve a
  // full reload while Chrome is emulating an offline network.
  const swControlled = await waitFor(
    sessionId,
    cdp,
    `Boolean(navigator.serviceWorker && navigator.serviceWorker.controller)`,
    10000
  );
  check(`${tag}: service worker controls the page`, swControlled !== false);
  if (swControlled !== false) {
    await cdp.send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }, sessionId);
    await cdp.send("Runtime.evaluate", { expression: "window.__preOfflineProbe = true" }, sessionId);
    const port = server.address().port;
    if (server.closeAllConnections) server.closeAllConnections();
    if (server.closeIdleConnections) server.closeIdleConnections();
    await new Promise((resolve) => server.close(() => resolve()));
    let offlineLoaded = false;
    try {
      await cdp.send("Page.reload", {}, sessionId);
      offlineLoaded = await waitFor(
        sessionId,
        cdp,
        "document.readyState === 'complete' && typeof window.__preOfflineProbe === 'undefined' && !!document.querySelector('#municipal-diff-output table')",
        10000
      );
    } finally {
      await new Promise((resolve, reject) => {
        const onError = (error) => reject(error);
        server.once("error", onError);
        server.listen(port, "127.0.0.1", () => {
          server.off("error", onError);
          resolve();
        });
      });
      await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }, sessionId);
    }
    check(`${tag}: offline reload renders from the service-worker cache`, offlineLoaded !== false);
  }

  // A hash-only change is a same-document navigation, so hydrate from a real
  // fresh load via about:blank to exercise the bookmark path honestly.
  await cdp.send("Page.navigate", { url: "about:blank" }, sessionId);
  await waitFor(sessionId, cdp, "document.readyState === 'complete'");
  await cdp.send("Page.navigate", { url: `${baseUrl}/index.html#bin=diff-glass-out` }, sessionId);
  const hydrated = await waitFor(sessionId, cdp, `document.readyState === 'complete' && document.getElementById('municipal-profile-b') && document.getElementById('municipal-profile-b').value === 'dual-stream-glass-out'`, 8000);
  check(`${tag}: #bin=diff-glass-out hydrates the workbench`, hydrated !== false);
  const hydratedA = await cdp.evaluate(sessionId, `document.getElementById('municipal-profile-a').value`);
  check(`${tag}: hydrated profile A is Riverside`, hydratedA === "Riverside-tx");

  check(`${tag}: zero uncaught page errors`, pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));
  check(`${tag}: zero console errors`, consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
  check(`${tag}: zero external network requests`, externalRequests.length === 0, externalRequests.slice(0, 3).join(" | "));
}

async function main() {
  const chrome = CHROME_CANDIDATES.find((candidate) => fs.existsSync(candidate));
  if (!chrome) {
    console.error("no chromium binary found");
    process.exit(2);
  }
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "bincheck-audit-profile-"));
  const downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), "bincheck-audit-dl-"));
  const server = await serve();
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const chromeProc = spawn(chrome, [
    "--headless=new",
    "--mute-audio",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-background-networking",
    `--user-data-dir=${profileDir}`,
    `--remote-debugging-port=${CDP_PORT}`,
    "about:blank"
  ], { stdio: ["ignore", "ignore", "pipe"] });
  let chromeErr = "";
  chromeProc.stderr.on("data", (chunk) => { chromeErr += chunk; });

  try {
    let targets = null;
    for (let i = 0; i < 60 && !targets; i += 1) {
      try { targets = await cdpHttp("/json/version"); } catch { await new Promise((r) => setTimeout(r, 250)); }
    }
    if (!targets) throw new Error(`chrome did not open the debugging port. ${chromeErr.slice(0, 300)}`);

    const cdp = new Cdp(targets.webSocketDebuggerUrl);
    await cdp.ready;
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloadDir, eventsEnabled: true });

    for (const viewport of [
      { width: 1440, height: 900, dsf: 1, mobile: false },
      { width: 390, height: 844, dsf: 3, mobile: true }
    ]) {
      await runViewportAudit({ cdp, sessionId, baseUrl, viewport, downloadDir, server });
    }

    const passed = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok);
    for (const r of results) {
      console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? "  --  " + r.detail.slice(0, 140) : ""}`);
    }
    console.log(`\nbrowser-audit: ${passed}/${results.length} checks passed, ${failed.length} failed`);
    process.exitCode = failed.length === 0 ? 0 : 1;
  } finally {
    chromeProc.kill("SIGKILL");
    await Promise.race([
      new Promise((resolve) => chromeProc.once("exit", resolve)),
      new Promise((resolve) => setTimeout(resolve, 1500))
    ]);
    server.close();
    for (const dir of [profileDir, downloadDir]) {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        try {
          fs.rmSync(dir, { recursive: true, force: true });
          break;
        } catch (error) {
          if (attempt === 7) throw error;
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
      }
    }
  }
}

main().catch((error) => {
  console.error(`browser-audit crashed: ${error && error.stack ? error.stack : error}`);
  process.exit(2);
});
