import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createFakeDom } from "./fake-dom.js";
import { createApp, DEMO_SCENARIOS } from "../src/app.js";
import { VERIFIED_BARCODE_CATALOG, MATERIAL_CATEGORIES } from "../src/bincheck-engine.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

function boot(options = {}) {
  const dom = createFakeDom(html, options);
  const downloads = [];
  const app = createApp({
    document: dom.document,
    window: dom.window,
    deps: {
      download: (name, mime, text) => downloads.push({ name, mime, text }),
      now: (() => { let t = 0; return () => (t += 0.1); })(),
      storage: options.storage
    }
  });
  return { dom, app, downloads, el: (id) => dom.byId.get(id) };
}

function memoryStorage(seed = {}) {
  const data = { ...seed };
  return {
    data,
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = String(value);
    },
    removeItem(key) {
      delete data[key];
    }
  };
}

const button = (dom, attr, value) => dom.all.find((el) => el.getAttribute(attr) === value);

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function streamFixture() {
  const track = { stops: 0, stop() { this.stops += 1; } };
  return { track, stream: { getTracks: () => [track] } };
}

async function settleCamera() {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
}

function installDetector(dom) {
  dom.window.BarcodeDetector = class {
    async detect() { return []; }
  };
}

test("ui: repeated camera starts share one pending request and one active stream", async () => {
  const { dom, el, app } = boot();
  const acquired = deferred();
  const fixture = streamFixture();
  let requests = 0;
  dom.window.navigator.mediaDevices = { getUserMedia() { requests += 1; return acquired.promise; } };
  installDetector(dom);
  const start = button(dom, "data-action", "camera-start");
  for (let i = 0; i < 10; i += 1) dom.click(start);
  assert.equal(requests, 1);
  acquired.resolve(fixture.stream);
  await settleCamera();
  assert.equal(el("camera-video").srcObject, fixture.stream);
  assert.equal(dom.intervals.size, 1);
  for (let i = 0; i < 10; i += 1) dom.click(start);
  assert.equal(requests, 1);
  assert.equal(dom.intervals.size, 1);
  app.destroy();
  assert.equal(fixture.track.stops, 1);
  assert.equal(dom.intervals.size, 0);
  assert.equal(el("camera-video").srcObject, null);
});

test("ui: stopping a pending camera acquisition immediately releases its late stream", async () => {
  const { dom, el, app } = boot();
  const acquired = deferred();
  const fixture = streamFixture();
  let plays = 0;
  el("camera-video").play = async () => { plays += 1; };
  dom.window.navigator.mediaDevices = { getUserMedia: () => acquired.promise };
  installDetector(dom);
  dom.click(button(dom, "data-action", "camera-start"));
  dom.click(button(dom, "data-action", "camera-stop"));
  acquired.resolve(fixture.stream);
  await settleCamera();
  assert.equal(fixture.track.stops, 1);
  assert.equal(plays, 0);
  assert.equal(el("camera-video").srcObject, null);
  assert.equal(el("camera-preview-wrap").classList.contains("hidden"), true);
  assert.equal(dom.intervals.size, 0);
  app.destroy();
});

test("ui: a restart waits for a cancelled acquisition to settle and releases the superseded stream", async () => {
  for (const outcome of ["resolve", "reject"]) {
    const { dom, el, app } = boot();
    const first = deferred();
    const second = deferred();
    const old = streamFixture();
    const current = streamFixture();
    let requests = 0;
    dom.window.navigator.mediaDevices = {
      getUserMedia() {
        requests += 1;
        if (requests === 1) return first.promise;
        assert.equal(old.track.stops, outcome === "resolve" ? 1 : 0);
        return second.promise;
      }
    };
    installDetector(dom);
    const start = button(dom, "data-action", "camera-start");
    dom.click(start);
    dom.click(button(dom, "data-action", "camera-stop"));
    dom.click(start);
    dom.click(start);
    assert.equal(requests, 1);
    if (outcome === "resolve") first.resolve(old.stream);
    else first.reject(new Error("permission declined"));
    await settleCamera();
    assert.equal(requests, 2);
    assert.equal(dom.intervals.size, 0);
    second.resolve(current.stream);
    await settleCamera();
    assert.equal(el("camera-video").srcObject, current.stream);
    assert.equal(dom.intervals.size, 1);
    assert.equal(current.track.stops, 0);
    app.destroy();
    assert.equal(current.track.stops, 1);
    assert.equal(dom.intervals.size, 0);
  }
});

test("ui: destroying a pending acquisition also cancels a requested restart", async () => {
  const { dom, el, app } = boot();
  const acquired = deferred();
  const fixture = streamFixture();
  let requests = 0;
  let plays = 0;
  el("camera-video").play = async () => { plays += 1; };
  dom.window.navigator.mediaDevices = { getUserMedia() { requests += 1; return acquired.promise; } };
  installDetector(dom);
  const start = button(dom, "data-action", "camera-start");
  dom.click(start);
  dom.click(button(dom, "data-action", "camera-stop"));
  dom.click(start);
  app.destroy();
  acquired.resolve(fixture.stream);
  await settleCamera();
  dom.click(start);
  assert.equal(requests, 1);
  assert.equal(fixture.track.stops, 1);
  assert.equal(plays, 0);
  assert.equal(el("camera-video").srcObject, null);
  assert.equal(dom.intervals.size, 0);
  assert.equal(dom.listenerCount(), 0);
});

test("ui: stop and destroy during video playback cannot resume a cancelled scanner", async () => {
  for (const action of ["stop", "destroy"]) {
    const { dom, el, app } = boot();
    const playing = deferred();
    const fixture = streamFixture();
    let detectors = 0;
    el("camera-video").play = () => playing.promise;
    dom.window.navigator.mediaDevices = { getUserMedia: async () => fixture.stream };
    dom.window.BarcodeDetector = class {
      constructor() { detectors += 1; }
    };
    dom.click(button(dom, "data-action", "camera-start"));
    await settleCamera();
    assert.equal(el("camera-video").srcObject, fixture.stream);
    if (action === "stop") dom.click(button(dom, "data-action", "camera-stop"));
    else app.destroy();
    playing.resolve();
    await settleCamera();
    assert.equal(fixture.track.stops, 1);
    assert.equal(detectors, 0);
    assert.equal(dom.intervals.size, 0);
    assert.equal(el("camera-video").srcObject, null);
    assert.equal(el("camera-preview-wrap").classList.contains("hidden"), true);
    app.destroy();
  }
});

test("ui: playback failure stops and detaches the acquired stream", async () => {
  const { dom, el, app } = boot();
  const fixture = streamFixture();
  dom.window.navigator.mediaDevices = { getUserMedia: async () => fixture.stream };
  installDetector(dom);
  el("camera-video").play = async () => { throw new Error("playback unavailable"); };
  dom.click(button(dom, "data-action", "camera-start"));
  await settleCamera();
  assert.equal(fixture.track.stops, 1);
  assert.equal(dom.intervals.size, 0);
  assert.equal(el("camera-video").srcObject, null);
  assert.equal(el("camera-preview-wrap").classList.contains("hidden"), true);
  assert.match(el("barcode-status").className, /invalid/);
  app.destroy();
  assert.equal(fixture.track.stops, 1);
});

test("ui: a throwing BarcodeDetector keeps the preview and reports manual entry instead", async () => {
  const { dom, el, app } = boot();
  const fixture = streamFixture();
  dom.window.navigator.mediaDevices = { getUserMedia: async () => fixture.stream };
  dom.window.BarcodeDetector = class {
    constructor() { throw new Error("unsupported scanner formats"); }
  };
  dom.click(button(dom, "data-action", "camera-start"));
  await settleCamera();
  assert.equal(fixture.track.stops, 0, "preview stays live; only the scanner degrades");
  assert.equal(dom.intervals.size, 0, "no detection interval is armed");
  assert.equal(el("camera-video").srcObject, fixture.stream);
  assert.equal(el("camera-preview-wrap").classList.contains("hidden"), false);
  assert.match(el("barcode-status").className, /valid/);
  assert.match(el("barcode-status").textContent, /cannot read barcodes automatically/);
  app.destroy();
  assert.equal(fixture.track.stops, 1, "destroy still releases the stream");
});

test("ui: stop, destroy and page hide deterministically clear scanner interval ID zero", async () => {
  for (const action of ["stop", "destroy", "pagehide"]) {
    const { dom, el, app } = boot();
    const fixture = streamFixture();
    const active = new Set();
    const cleared = [];
    dom.window.navigator.mediaDevices = { getUserMedia: async () => fixture.stream };
    dom.window.setInterval = () => { active.add(0); return 0; };
    dom.window.clearInterval = (id) => { cleared.push(id); active.delete(id); };
    installDetector(dom);
    dom.click(button(dom, "data-action", "camera-start"));
    await settleCamera();
    assert.equal(active.size, 1);
    if (action === "stop") dom.click(button(dom, "data-action", "camera-stop"));
    else if (action === "pagehide") dom.fireWindow("pagehide");
    else app.destroy();
    assert.deepEqual(cleared, [0]);
    assert.equal(active.size, 0);
    assert.equal(fixture.track.stops, 1);
    assert.equal(el("camera-video").srcObject, null);
    app.destroy();
    assert.deepEqual(cleared, [0]);
  }
});

test("ui: a late detection cannot stop or commit into a newer camera session", async () => {
  const { dom, el, app } = boot();
  const detected = deferred();
  const old = streamFixture();
  const current = streamFixture();
  let requests = 0;
  let detections = 0;
  dom.window.navigator.mediaDevices = { getUserMedia: async () => (++requests === 1 ? old.stream : current.stream) };
  dom.window.BarcodeDetector = class {
    detect() { detections += 1; return detected.promise; }
  };
  const start = button(dom, "data-action", "camera-start");
  dom.click(start);
  await settleCamera();
  const scan = [...dom.intervals.values()][0].fn;
  const pending = scan();
  await scan();
  assert.equal(detections, 1, "only one frame detection is pending");
  const barcode = app.getState().barcode;
  dom.click(button(dom, "data-action", "camera-stop"));
  dom.click(start);
  await settleCamera();
  detected.resolve([{ rawValue: "039800084118" }]);
  await pending;
  assert.equal(app.getState().barcode, barcode);
  assert.equal(old.track.stops, 1);
  assert.equal(current.track.stops, 0);
  assert.equal(el("camera-video").srcObject, current.stream);
  assert.equal(dom.intervals.size, 1);
  app.destroy();
  assert.equal(current.track.stops, 1);
  assert.equal(dom.intervals.size, 0);
});

test("ui: boot renders the default item, fills the catalog and the stat strip", () => {
  const { el, app } = boot();
  assert.match(el("evaluation-output").innerHTML, /H-E-B Pure Texas Spring Water/);
  assert.equal(el("catalog-select").children.length, VERIFIED_BARCODE_CATALOG.length);
  assert.equal(el("stat-barcodes").textContent, `${VERIFIED_BARCODE_CATALOG.length} GS1 codes`);
  assert.equal(el("stat-materials").textContent, `${Object.keys(MATERIAL_CATEGORIES).length} Streams`);
  assert.equal(el("catalog-select").value, "041220576463");
  assert.match(el("batch-items-container").innerHTML, /class="cart-profile"/);
  app.destroy();
});

test("ui: the city switcher sets aria-pressed on exactly one button and swaps the view", () => {
  const { dom, el, app } = boot();
  dom.click(button(dom, "data-city-mode", "compare"));
  const pressed = dom.all.filter((b) => b.hasAttribute("data-city-mode") && b.getAttribute("aria-pressed") === "true");
  assert.equal(pressed.length, 1);
  assert.equal(pressed[0].getAttribute("data-city-mode"), "compare");
  assert.match(el("evaluation-output").innerHTML, /compare-columns/);
  assert.equal(app.getState().cityMode, "compare");
  app.destroy();
});

test("ui: every demo pill in the page loads a scenario with a valid material", () => {
  const { dom, app } = boot();
  const pills = dom.all.filter((b) => b.getAttribute("data-action") === "demo");
  assert.equal(pills.length, Object.keys(DEMO_SCENARIOS).length);
  for (const pill of pills) {
    dom.click(pill);
    const scenario = DEMO_SCENARIOS[pill.getAttribute("data-demo")];
    assert.equal(app.getState().materialId, scenario.materialId, pill.getAttribute("data-demo"));
    assert.equal(app.getState().barcode, scenario.barcode);
  }
  app.destroy();
});

test("ui: typing a bad barcode marks the field invalid; Enter commits it", () => {
  const { dom, el, app } = boot();
  const input = el("barcode-input");
  dom.input(input, "041220576464");
  assert.equal(input.getAttribute("aria-invalid"), "true");
  assert.match(el("barcode-math-strip").innerHTML, /math-chip-err/);
  const ev = dom.key("Enter", input);
  assert.equal(ev.defaultPrevented, true);
  assert.equal(app.getState().barcode, "041220576464");
  assert.match(el("status-live").textContent, /Barcode rejected/);
  app.destroy();
});

test("ui: resin buttons and selects drive the state and stay in sync", () => {
  const { dom, el, app } = boot();
  dom.click(button(dom, "data-resin", "4"));
  assert.equal(app.getState().materialId, "resin-4-ldpe-film");
  assert.equal(button(dom, "data-resin", "4").getAttribute("aria-pressed"), "true");
  assert.equal(button(dom, "data-resin", "1").getAttribute("aria-pressed"), "false");
  dom.change(el("material-select"), "clean-cardboard-paper");
  dom.change(el("condition-select"), "greasy");
  assert.match(el("evaluation-output").innerHTML, /Grease-Soaked Cardboard or Paper/);
  assert.equal(el("material-select").value, "clean-cardboard-paper");
  dom.change(el("catalog-select"), "039800084118");
  assert.equal(app.getState().materialId, "lithium-household-battery");
  app.destroy();
});

test("ui: cart add, remove and reset update the badge and the SVG profile", () => {
  const { dom, el, app } = boot();
  dom.click(button(dom, "data-resin", "6"));
  dom.click(button(dom, "data-action", "add-cart"));
  assert.equal(app.getState().batchItems.length, 4);
  const removeBtn = { getAttribute: (k) => (k === "data-action" ? "remove-cart" : k === "data-index" ? "0" : null), closest() { return this; } };
  dom.click(removeBtn);
  assert.equal(app.getState().batchItems.length, 3);
  dom.click(button(dom, "data-action", "clear-cart"));
  assert.match(el("batch-summary-badge").textContent, /Cart empty/);
  assert.ok(!el("batch-items-container").innerHTML.includes("cart-profile"));
  app.destroy();
});

test("ui: batch sample runs, enables exports, and downloads deterministic files", () => {
  const { dom, el, app, downloads } = boot();
  assert.equal(el("export-csv-btn").disabled, true);
  dom.click(button(dom, "data-action", "load-sample"));
  dom.click(button(dom, "data-action", "run-batch"));
  assert.equal(el("export-csv-btn").disabled, false);
  assert.match(el("csv-results").innerHTML, /Rows read/);
  dom.click(button(dom, "data-action", "export-csv"));
  dom.click(button(dom, "data-action", "export-json"));
  assert.deepEqual(downloads.map((d) => d.name), ["bincheck-batch-results.csv", "bincheck-batch-results.json"]);
  assert.equal(JSON.parse(downloads[1].text).totals.rows, 9);
  dom.click(button(dom, "data-action", "clear-batch"));
  assert.equal(el("export-json-btn").disabled, true);
  app.destroy();
});

test("ui: an oversized CSV file is refused before it is read", async () => {
  const { dom, el, app } = boot();
  const fileInput = el("csv-file-input");
  let read = false;
  fileInput.files = [{ size: 10_000_000, text: async () => { read = true; return ""; } }];
  dom.change(fileInput);
  await new Promise((r) => setImmediate(r));
  assert.equal(read, false);
  assert.match(el("status-live").textContent, /The limit is 262144 bytes/);
  app.destroy();
});

test("ui: benchmark runs from the R shortcut and exports a report without latency", () => {
  const { dom, el, app, downloads } = boot();
  dom.key("r");
  assert.match(el("benchmark-output").innerHTML, /Cart routing confusion matrix/);
  assert.equal(el("benchmark-export-btn").disabled, false);
  dom.click(button(dom, "data-action", "export-benchmark"));
  const report = JSON.parse(downloads[0].text);
  assert.equal(report.failures.length, 0);
  assert.equal(report.latency, undefined);
  app.destroy();
});

test("ui: keyboard shortcuts switch cities, add to cart, and are ignored while typing", () => {
  const { dom, el, app } = boot();
  dom.key("h");
  assert.equal(app.getState().cityMode, "houston-tx");
  dom.key("c");
  assert.equal(app.getState().cityMode, "compare");
  dom.key("s");
  assert.equal(app.getState().cityMode, "Riverside-tx");
  dom.key("a");
  assert.equal(app.getState().batchItems.length, 4);
  dom.key("h", el("csv-input"));
  assert.equal(app.getState().cityMode, "Riverside-tx", "typing in the CSV box never triggers shortcuts");
  dom.key("/");
  assert.equal(el("barcode-input").focused, true);
  dom.key("b");
  assert.ok(el("batch-csv-heading").scrolledWith, "B jumps to batch");
  app.destroy();
});

test("ui: ? opens the shortcut dialog, other shortcuts pause while it is open, Escape closes it", () => {
  const { dom, el, app } = boot();
  dom.key("?");
  assert.equal(el("shortcut-dialog").open, true);
  dom.key("h");
  assert.equal(app.getState().cityMode, "Riverside-tx");
  dom.key("Escape");
  assert.equal(el("shortcut-dialog").open, false);
  assert.match(el("shortcut-list").innerHTML, /<kbd>\?<\/kbd>/);
  app.destroy();
});

test("ui: the single-key shortcut toggle disables letters, keeps Escape and Ctrl+Enter, and persists", () => {
  const storage = memoryStorage();
  const { dom, el, app, downloads } = boot({ storage });
  assert.equal(app.getState().singleKeyShortcuts, true, "shortcuts start enabled");
  assert.equal(el("shortcuts-toggle").checked, true);

  const headerToggle = el("shortcuts-toggle");
  headerToggle.checked = false;
  dom.change(headerToggle);
  assert.equal(app.getState().singleKeyShortcuts, false);
  assert.equal(storage.data["bincheck:single-key-shortcuts"], "off", "the choice is persisted");
  assert.equal(el("export-report-json-btn").getAttribute("aria-keyshortcuts"), null, "single-key shortcut withdrawn from AT");
  assert.equal(el("add-to-batch-btn").getAttribute("aria-keyshortcuts"), null);
  assert.equal(el("csv-run-btn").getAttribute("aria-keyshortcuts"), "Control+Enter", "modifier combo stays advertised");
  assert.equal(el("shortcuts-dialog-toggle").checked, false, "both toggles stay in sync");

  dom.key("d");
  assert.equal(downloads.length, 0, "D no longer downloads the report");
  dom.key("h");
  assert.equal(app.getState().cityMode, "Riverside-tx", "H no longer switches city");
  dom.key("?");
  assert.equal(el("shortcut-dialog").open, false, "? no longer opens the dialog");

  // The dialog stays reachable by click while disabled, and Escape still closes it.
  dom.click(button(dom, "data-action", "open-help"));
  assert.equal(el("shortcut-dialog").open, true);
  dom.key("Escape");
  assert.equal(el("shortcut-dialog").open, false);

  // Ctrl+Enter inside the CSV box still runs the inspection.
  dom.input(el("csv-input"), "label,barcode\nBottle,041220576463\n");
  const event = dom.key("Enter", el("csv-input"), { ctrlKey: true });
  assert.equal(event.defaultPrevented, true);
  assert.match(el("status-live").textContent, /Inspected 1 rows/);

  // The dialog toggle re-enables, restores aria-keyshortcuts and persists "on".
  const dialogToggle = el("shortcuts-dialog-toggle");
  dialogToggle.checked = true;
  dom.change(dialogToggle);
  assert.equal(app.getState().singleKeyShortcuts, true);
  assert.equal(storage.data["bincheck:single-key-shortcuts"], "on");
  assert.equal(el("export-report-json-btn").getAttribute("aria-keyshortcuts"), "d");
  assert.equal(el("shortcuts-toggle").checked, true);
  dom.key("d");
  assert.equal(downloads.length, 1, "D works again once re-enabled");
  app.destroy();
});

test("ui: the help dialog marks single-key shortcuts off whenever the toggle changes", () => {
  const { dom, el, app } = boot();
  const list = el("shortcut-list");
  assert.ok(!/shortcut-off/.test(list.innerHTML), "nothing is marked off while enabled");

  const headerToggle = el("shortcuts-toggle");
  headerToggle.checked = false;
  dom.change(headerToggle);
  const offRows = list.innerHTML.match(/<li class="shortcut-off">/g) || [];
  assert.equal(offRows.length, 10, "every printable single-key row is marked off");
  assert.match(list.innerHTML, /<li class="shortcut-off"><kbd>d<\/kbd>/, "D is marked off");
  assert.match(list.innerHTML, /<li class="shortcut-off"><kbd>p<\/kbd>/, "P is marked off");
  assert.match(list.innerHTML, /<li><kbd>Esc<\/kbd>/, "Escape is never marked off");
  assert.match(list.innerHTML, /class="shortcut-state">off</, "the off state is written out");

  const dialogToggle = el("shortcuts-dialog-toggle");
  dialogToggle.checked = true;
  dom.change(dialogToggle);
  assert.ok(!/shortcut-off/.test(list.innerHTML), "re-enabling clears every off mark");
  app.destroy();
});

test("ui: a stored off preference renders the help list with off marks at boot", () => {
  const { el, app } = boot({ storage: memoryStorage({ "bincheck:single-key-shortcuts": "off" }) });
  assert.match(el("shortcut-list").innerHTML, /<li class="shortcut-off"><kbd>d<\/kbd>/);
  app.destroy();
});

test("ui: a stored off preference disables shortcuts on the next session", () => {
  const storage = memoryStorage({ "bincheck:single-key-shortcuts": "off" });
  const { dom, el, app, downloads } = boot({ storage });
  assert.equal(app.getState().singleKeyShortcuts, false);
  assert.equal(el("shortcuts-toggle").checked, false);
  assert.equal(el("export-report-json-btn").getAttribute("aria-keyshortcuts"), null);
  dom.key("d");
  assert.equal(downloads.length, 0);
  dom.key("p");
  assert.equal(dom.window.printed, 0, "P no longer prints");
  app.destroy();

  const fresh = memoryStorage();
  const enabled = boot({ storage: fresh });
  assert.equal(enabled.app.getState().singleKeyShortcuts, true, "no stored value means enabled");
  enabled.app.destroy();
});

test("ui: share hash is written to the address bar, hydrated on boot, and copied on request", async () => {
  const first = boot();
  first.dom.click(button(first.dom, "data-city-mode", "houston-tx"));
  const lastUrl = first.dom.history.at(-1);
  assert.match(lastUrl, /^\/bincheck\/#c=houston-tx&b=041220576463/);
  first.app.destroy();

  const second = boot({ hash: "#c=compare&m=resin-6-ps-foam&k=clean" });
  assert.equal(second.app.getState().cityMode, "compare");
  assert.equal(second.app.getState().materialId, "resin-6-ps-foam");
  assert.equal(second.app.getState().barcode, "");
  second.dom.click(button(second.dom, "data-action", "copy-link"));
  await new Promise((r) => setImmediate(r));
  assert.match(second.dom.window.navigator.clipboard.writes[0], /#c=compare/);
  assert.match(second.el("status-live").textContent, /copied/);
  second.app.destroy();
});

test("ui: resin-only share links render the requested disposal stream with medium confidence", () => {
  for (const [hash, material, stream] of [
    ["#r=6&c=houston-tx", "resin-6-ps-foam", "TRASH_CART"],
    ["#r=3", "resin-3-pvc", "TRASH_CART"]
  ]) {
    const { app, el } = boot({ hash });
    assert.equal(app.getState().barcode, "");
    assert.equal(app.getState().materialId, material);
    assert.match(el("evaluation-output").innerHTML, new RegExp(stream));
    assert.match(el("evaluation-output").innerHTML, /Medium/);
    app.destroy();
  }
});

test("ui: printing the report fills the print section and cleans up after printing", () => {
  const { dom, el, app } = boot();
  dom.key("p");
  assert.equal(dom.window.printed, 1);
  assert.equal(el("print-report").innerHTML, "", "afterprint clears the report");
  assert.equal(dom.document.body.hasAttribute("data-print-mode"), false);
  app.destroy();
});

test("ui: reduced motion skips the scanner sweep animation", () => {
  const moving = boot();
  moving.dom.click(button(moving.dom, "data-resin", "2"));
  assert.ok(moving.el("scanner-deck").classList.contains("scanning"));
  moving.app.destroy();
  const calm = boot({ reducedMotion: true });
  calm.dom.click(button(calm.dom, "data-resin", "2"));
  assert.ok(!calm.el("scanner-deck").classList.contains("scanning"));
  calm.app.destroy();
});

test("ui: notices auto-clear on a timer and destroy removes every listener", () => {
  const { dom, el, app } = boot();
  dom.click(button(dom, "data-action", "add-cart"));
  assert.notEqual(el("status-live").textContent, "");
  const [timer] = [...dom.timers.values()].slice(-1);
  timer.fn();
  assert.equal(el("status-live").textContent, "");
  app.destroy();
  assert.equal(dom.listenerCount(), 0);
});

test("ui: camera scan reports a clear fallback when the camera API is missing", async () => {
  const { dom, el, app } = boot();
  dom.window.navigator = {};
  dom.click(button(dom, "data-action", "camera-start"));
  await new Promise((r) => setImmediate(r));
  assert.match(el("barcode-status").textContent, /Camera API unavailable/);
  app.destroy();
});

test("ui: camera requests only supported barcode formats and commits the detected code", async () => {
  const { dom, app } = boot();
  let formats;
  let scanFrame;
  let stopped = 0;
  dom.window.navigator.mediaDevices = {
    async getUserMedia() {
      return { getTracks: () => [{ stop: () => { stopped += 1; } }] };
    }
  };
  dom.window.BarcodeDetector = class {
    constructor(options) { formats = options.formats; }
    async detect() { return [{ rawValue: "041220948321", format: "upc_a" }]; }
  };
  dom.window.setInterval = (callback) => { scanFrame = callback; return 1; };
  dom.click(button(dom, "data-action", "camera-start"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(formats, ["upc_a", "ean_13", "ean_8"]);
  assert.ok(!formats.includes("upc_e"));
  await scanFrame();
  assert.equal(app.getState().barcode, "041220948321");
  assert.equal(app.getState().materialId, "resin-2-hdpe");
  assert.equal(stopped, 1);
  app.destroy();
});

/* ---------------- Static page and design rules ---------------- */

test("page: no decorative tagline under the site title and no eyebrow labels", () => {
  assert.ok(!/class="site-subtitle"/.test(html));
  assert.ok(!/class="(eyebrow|kicker|overline)/.test(html));
  assert.ok(!/batch-subtitle/.test(html), "section headings stand alone");
});

test("page: demo data is labeled as demo data wherever the catalog appears", () => {
  assert.match(html, /Demo barcode catalog/);
  assert.match(html, /data-badge is-demo/);
  assert.ok(!/Verified Texas/i.test(html));
});

test("page: every interactive control has an accessible name", () => {
  for (const match of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
    const text = match[2].replace(/<[^>]+>/g, "").trim();
    assert.ok(text.length > 0 || /aria-label=/.test(match[1]), `button without a name: ${match[1].slice(0, 80)}`);
  }
  for (const id of ["barcode-input", "catalog-select", "material-select", "condition-select", "csv-input", "csv-file-input"]) {
    assert.match(html, new RegExp(`<label[^>]+for="${id}"`), id);
  }
});

test("page: zero em or en dashes in shipped HTML, CSS and JS", () => {
  const files = ["index.html", "styles.css", "src/app.js", "src/render.js", "src/state.js", "js/bincheck-engine.js", "js/bincheck-batch.js", "js/bincheck-benchmark.js", "js/bincheck-validate.js", "js/ground-truth.js", "README.md"];
  for (const file of files) {
    const text = fs.readFileSync(path.join(root, file), "utf8");
    assert.ok(!/[\u2013\u2014]/.test(text), file);
  }
});

test("css: new components have styles, reduced motion and print rules exist", () => {
  for (const selector of [".data-badge", ".cart-profile", ".cart-threshold", ".gap-state", ".benchmark-scope", ".batch-chip-grid"]) {
    assert.ok(css.includes(selector), selector);
  }
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media print/);
});
