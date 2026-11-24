/**
 * BinCheck i18n module: English and Spanish dictionaries, Spanish mirrors of
 * every engine data string, and localizers that translate engine output for
 * display. Engine modules always produce English; translation happens at the
 * view layer so exports (CSV / JSON / Markdown) stay byte-stable English and
 * quoted city ordinance text stays verbatim English. Any string without a
 * Spanish entry falls back to English, so coverage can never break a view.
 */
import { SUPPORTED_CITIES } from "./bincheck-engine.js";

export const SUPPORTED_LANGS = Object.freeze(["en", "es"]);
export const DEFAULT_LANG = "en";
export const LANGUAGE_STORAGE_KEY = "bincheck:language";

export function normalizeLang(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  return raw === "es" || raw.startsWith("es-") || raw.startsWith("es_") ? "es" : "en";
}

/* ---------------- UI chrome + renderer literals ---------------- */

export const UI_STRINGS = Object.freeze({
  en: Object.freeze({
    "title.page": "BinCheck | Riverside & Houston Municipal Recycling Rules Engine & Barcode Disposal Verifier",
    "meta.description": "BinCheck is a two-city municipal recycling rules engine and barcode disposal verifier for Riverside and Houston, Texas. Confirm what each cart, drop-off and prep rule actually allows before the truck arrives.",
    "html.lang": "en",
    "skip.link": "Skip to main content",
    "nav.sections": "Page sections",
    "nav.inspect": "Inspect an item",
    "nav.batch": "Batch CSV",
    "nav.diff": "Municipal diff",
    "nav.cascade": "Cascade lab",
    "nav.audit": "Signed audit",
    "nav.selftest": "Self-tests",
    "nav.benchmark": "Benchmark",
    "nav.guide": "Kitchen guide",
    "nav.shortcuts": "Shortcuts",
    "nav.keyShortcuts": "Key shortcuts",
    "header.printGuide": "Print 1-Page Kitchen Guide",
    "group.jurisdiction": "Jurisdiction mode",
    "group.language": "Language / Idioma",
    "lang.en": "EN",
    "lang.es": "ES",
    "city.compare": "Side-by-Side Comparison",
    "hero.line1": "Stop wish-cycling at the curb.",
    "hero.line2": "Verify what actually survives the",
    "hero.accent": "optical sorter.",
    "hero.lead": "Crossing the city limit between Riverside (Republic Services and the county County Recycling Center on Blume Rd) and Houston (SWMD and Westpark) changes which plastics, yard bags, and foam blocks are accepted. Inspect any product by GS1 barcode, SPI polymer stamp, or physical contamination state before it jams a star-screen shaft.",
    "hero.imgAlt": "Municipal material specification overview showing PET bottles, HDPE jugs, corrugated cardboard, and SPI resin stamps",
    "stats.catalog": "Demo barcode catalog",
    "stats.resin": "Polymer Mold Codes",
    "stats.materials": "Material Profiles",
    "stats.cities": "Ordinance Jurisdictions",
    "stats.gs1Codes": "{n} GS1 codes",
    "stats.materialsCount": "{n} Streams",
    "stats.citiesCount": "{n} Cities",
    "guided.heading": "Try it in three clicks",
    "guided.cityFlip.name": "Watch a city line flip the verdict",
    "guided.cityFlip.desc": "The same #6 foam cup goes to a county drop-off in Riverside but the trash cart in Houston.",
    "guided.trap.name": "Load a contamination trap",
    "guided.trap.desc": "One lithium battery inside 30 clean bottles shows why the average hides the hazard.",
    "guided.csv.name": "Audit a synthetic household CSV",
    "guided.csv.desc": "Nine illustrative rows scored per city, with the share that is cart-eligible.",
    "search.heading": "Find any item",
    "search.srLabel": "Search the demo catalog and material categories",
    "search.placeholder": "Type glass, pizza, battery, foam, Topo Chico...",
    "search.itemsCount": "{n} items",
    "search.matches": "{n} matches",
    "search.closeMatches": "{n} close matches",
    "search.empty": "Type to search across product names, materials, and packaging",
    "search.partial": "The catalog and the material list are search indexes, not the rules engine. If nothing matches, pick the material category below.",
    "search.showing": "Showing {shown} of {total} matches",
    "search.noMatch": "No catalog item or material matches \"{query}\". Pick the closest material category below, or try words like glass, pizza, battery or foam.",
    "search.partialNote": "No item matches every word. Closest matches:",
    "search.categorySub": "Material category",
    "search.demoSub": "{brand}, UPC {upc}, demo data",
    "search.citiesDiffer": "Cities differ",
    "demo.subheading": "Or try a common item",
    "demo.pet": "Try #1 PET Water Bottle",
    "demo.pizza": "Try Greasy Pizza Box",
    "demo.glass": "Try Glass Jar (Riverside vs Houston)",
    "demo.bag": "Try Plastic Grocery Bag",
    "demo.battery": "Try Lithium Battery",
    "demo.foam": "Try #6 Styrofoam Cup",
    "demo.yard": "Try Yard Trimmings Bag",
    "panel.inspector": "Barcode, Resin Code & Material Inspector",
    "rules.badge": "Rules",
    "rules.chipTitle": "Date the bundled Riverside and Houston rules snapshot was last checked against the city sites",
    "nav.shortcutsTitle": "Turn the single-letter keyboard shortcuts on or off",
    "field.barcode": "GS1 Barcode Lookup (UPC-A 12-Digit or EAN-13)",
    "barcode.placeholder": "e.g. 041220576463 (H-E-B Spring Water)",
    "barcode.statusIdle": "Enter any 12-digit UPC-A or 13-digit EAN-13 barcode, or choose a material category below.",
    "barcode.statusMatched": "Matched: {name} ({pack}).",
    "barcode.statusUnmatched": "Not in the demo catalog; evaluating using the selected material or resin rule.",
    "btn.verifyUpc": "Verify UPC",
    "btn.cameraScan": "Camera Scan",
    "btn.cameraStop": "Stop Camera",
    "camera.title": "Use the device camera to read a barcode live",
    "camera.frameAlt": "Camera barcode reader",
    "catalog.label": "Or pick from the demo catalog",
    "catalog.badge": "Demo data",
    "catalog.badgeTitle": "Every code passes the GS1 check digit. Product pairings are illustrative, not scanned from shelves.",
    "catalog.choose": "Choose a catalog barcode",
    "resin.label": "SPI Plastic Resin Identification Code (#1 to #7)",
    "resin.groupAria": "SPI Resin Codes",
    "resin.other": "Other",
    "field.material": "Material / Item Category",
    "field.condition": "Item Condition",
    "btn.addCart": "Add Current Item to Virtual Cart",
    "btn.resetCart": "Reset Virtual Cart",
    "result.srHeading": "Inspection result",
    "btn.reportCsv": "Download report CSV",
    "btn.reportJson": "Download report JSON",
    "btn.share": "Copy share link",
    "btn.printReport": "Print inspection report",
    "cart.heading": "Virtual cart",
    "impact.heading": "Contamination calculator",
    "impact.itemLabel": "Current item",
    "impact.cleanLabel": "Clean #1 PET bottles in the cart:",
    "impact.countLabel": "Copies of the current item:",
    "impact.note": "Pick any item above, then drag. Every number comes from the same rules engine and thresholds as the cart.",
    "impact.empty": "Pick an item in the inspector above, then set the counts.",
    "impact.avgRisk": "Average risk",
    "impact.worstItem": "Worst single item",
    "impact.scaleNote": "Scale 0-100.",
    "impact.itemsSummary": "{total} items, {wrong} in the wrong bin ({share})",
    "impact.gridAria": "Cart contents, {clean} clean bottles and {count} copies of the item",
    "impact.cellCleanTitle": "Clean #1 PET bottle",
    "impact.finding.onlyClean": "Average {avg}. All bottles are clean and empty, so the load clears the curbside bar in both cities.",
    "impact.finding.hidden": "Average {avg}. The math still clears the curbside bar, but {worst} stays {stream} wherever it lands: the average hides the hazard, so it must be pulled by hand.",
    "impact.finding.ok": "Average {avg}. Nothing here poisons the load; keep every item in its own stream as shown.",
    "impact.finding.other": "Average {avg}. The problem is spread across the load rather than one item.",
    "impact.finding.clean": "All clean.",
    "impact.finding.trap": "Averages hide it: {worst} is {tier} risk ({risk}) and stays {stream}.",
    "impact.finding.contaminated": "Load is {tier} ({avg} average) and the truck can refuse it.",
    "impact.finding.benign": "No single item poisons the load; keep items in their own streams.",
    "impact.addItem": "Add at least one item to see a load status.",
    "impact.finding.allClean": "With only clean bottles the load is clean, average risk {avg}/100.",
    "impact.finding.hiddenWorst": "The average risk is only {avg}/100, but load status follows the worst item. {count} {item} at {risk}/100 makes this a \"{status}\" load, and adding more clean bottles cannot dilute it. {word} is the right place for it.",
    "impact.finding.staysClean": "{item} belongs in the cart (risk {risk}/100), so the load stays \"{status}\".",
    "impact.finding.spread": "Average risk {avg}/100, worst item {max}/100: \"{status}\". {word} is the right place for this item.",
    "impact.ticks": "Ticks at {m}, {h} and {r}, the same thresholds the cart and the engine use.",
    "csv.heading": "Batch CSV inspection",
    "csv.tag": "Up to 500 rows, 256 KB",
    "csv.pasteLabel": "Paste CSV text",
    "csv.help": "Columns: label, barcode, material, resin, condition. A header row is optional; without one, columns are read as barcode, material, resin, condition, label. Material uses ids like resin-1-pet or glass-jar-bottle. Lines starting with # are ignored. Rows BinCheck cannot identify are listed as errors and never guessed. The bundled sample is an illustrative synthetic dataset, not real household records. Ctrl+Enter (or Cmd+Enter) inside the box runs the inspection.",
    "btn.runInspection": "Run inspection",
    "btn.loadSample": "Load synthetic sample",
    "btn.clear": "Clear",
    "csv.fileLabel": "Or choose a CSV file",
    "csv.empty": "No batch yet. Load the sample or paste your own rows, then choose Run inspection.",
    "btn.resultsCsv": "Download results CSV",
    "btn.resultsJson": "Download results JSON",
    "batch.rowsRead": "Rows read",
    "batch.evaluated": "Evaluated",
    "batch.warnings": "Need a check",
    "batch.errors": "Could not identify",
    "batch.divergent": "Cities disagree",
    "batch.avgMax": "Average risk {avg}/100, maximum {max}/100",
    "batch.eligible": "{n} of {total} evaluated items are cart-eligible ({pct}%)",
    "batch.notEligible": "{n} must stay out of the cart",
    "batch.attention": "Rows that need attention",
    "batch.line": "Line",
    "batch.item": "Item",
    "batch.evidence": "Evidence",
    "batch.status": "Status",
    "batch.notEvaluated": "Not evaluated",
    "batch.citiesDiffer": "Cities differ",
    "batch.unlabeled": "Unlabeled row",
    "batch.risk": "Risk {n}/100",
    "batch.streamMixAria": "{name} stream mix",
    "batch.caption": "Per-row inspection results for Riverside and Houston",
    "batch.noRows": "No evaluated rows.",
    "batch.lineLoc": "Line {n}",
    "batch.byteLoc": "Byte {n}",
    "batch.inputLoc": "Input",
    "batch.eligibleLine": "{n} evaluated items are cart-eligible ({pct})",
    "batch.stayOut": "{n} must stay out of the cart",
    "bench.heading": "Calibration benchmark",
    "btn.runBenchmark": "Run benchmark",
    "btn.benchJson": "Download report JSON",
    "bench.empty": "No run yet. The benchmark scores labeled ground-truth cases plus every catalog item against both cities.",
    "bench.scope": "{cases} labeled cases plus {catalog} catalog items x {cities} cities, {n} runs",
    "bench.kpiAccuracy": "Accuracy",
    "bench.kpiPrecision": "Precision",
    "bench.kpiRecall": "Recall",
    "bench.kpiFp": "False positives",
    "bench.kpiStream": "Stream accuracy",
    "bench.tp": "{n} TP",
    "bench.casePrecision": "Case precision",
    "bench.macro": "Macro",
    "bench.weighted": "Weighted",
    "bench.ofFp": "of {n} FP",
    "bench.sixStreams": "6 streams, all cases",
    "bench.matrixTitle": "Cart routing confusion matrix",
    "bench.matrixAria": "Cart routing confusion matrix, rows are truth and columns are predictions",
    "bench.matrixCaption": "Truth down the side, predictions across the top. Cart means the curbside recycling stream; Not cart is every other route pooled.",
    "bench.streamTitle": "Stream confusion matrix",
    "bench.streamAria": "Full stream confusion matrix, rows are truth and columns are predictions",
    "bench.streamCaption": "Truth down the side, predictions across the top. Only cells with at least one case render.",
    "bench.tierTitle": "Contamination tier calibration",
    "bench.tierAria": "Contamination tier calibration table",
    "bench.band": "Band",
    "bench.cases": "Cases",
    "bench.streamAcc": "Stream accuracy",
    "bench.avgAbs": "Average abs delta",
    "bench.tierCaption": "Risk bands pooled across both cities.",
    "bench.failures": "Failures",
    "bench.failCase": "{id} in {city}: expected {expected}, got {actual}",
    "bench.gapTitle": "Known snapshot gaps",
    "bench.gapHelp": "Anchors prove the label; anchors plus an engine note prove the note.",
    "bench.gapOpen": "{open} of {total} known gaps still open",
    "bench.gapClosed": "All {total} known snapshot gaps closed",
    "bench.gapRowOpen": "OPEN {label} in {city}: expected {expected}, got {actual}",
    "bench.gapRowClosed": "CLOSED {label} in {city}: {actual}",
    "bench.gapNote": "{label}: {note}",
    "bench.barcodeTitle": "Barcode integrity",
    "bench.barcodePass": "{n}/{total} catalog codes pass GS1 check digit",
    "bench.latencyTitle": "Single-item latency",
    "bench.latencyMean": "mean {mean}ms p95 {p95}ms ({runs} runs)",
    "bench.latencyMeanLabel": "mean",
    "bench.latencyP95Label": "p95",
    "diff.heading": "Municipal ruleset diff and diversion comparator",
    "diff.tag": "6 MRF profiles",
    "diff.help": "One basket of tricky household items, scored under two program profiles: the two real city snapshots (Riverside and Houston, from the bundled rules engine) and four illustrative archetypes. Rule-conflict alerts flag anything that is cart-accepted under one profile but contaminating under the other.",
    "field.profileA": "Profile A",
    "field.profileB": "Profile B",
    "field.basket": "Household basket",
    "preset.groupAria": "Workbench presets",
    "preset.glass": "Glass in vs. glass out",
    "preset.organics": "Compulsory organics district",
    "preset.rural": "City cart vs. rural transfer station",
    "preset.battery": "One battery in the cart",
    "preset.tangler": "Film wraps the star-screens",
    "diff.metric": "Metric ({basket})",
    "diff.ab": "A minus B",
    "diff.metric.diversionRate": "Diversion rate",
    "diff.metric.curbsideOnly": "Curbside-only diversion",
    "diff.metric.divertedMass": "Diverted mass",
    "diff.metric.dropOffMass": "Needs a drop-off trip",
    "diff.metric.landfillMass": "Landfilled mass",
    "diff.metric.cartContamination": "Naive-cart contamination",
    "diff.metric.contaminationRisk": "Contamination risk index",
    "diff.metric.co2eAvoided": "Lifecycle CO2e avoided",
    "diff.unit.pct": "{n}%",
    "diff.unit.pctPt": "{n} pt",
    "diff.unit.kg": "{n} kg",
    "diff.unit.per100": "{n} / 100",
    "diff.conflicts": "Rule-conflict alerts",
    "diff.conflict.count": "{open} open, {total} modeled",
    "diff.noConflicts": "No conflicts: every basket item routes to the same kind of stream under both profiles.",
    "diff.kindTag.snapshot": "Real city snapshot",
    "diff.kindTag.archetype": "Illustrative archetype",
    "diff.col.basket": "Basket item",
    "diff.col.stream": "Stream",
    "diff.col.prep": "Prep + note",
    "diff.col.city": "City",
    "diff.weight": "{n} kg",
    "diff.caption": "Item by item routing under both profiles",
    "diff.conflictCaption": "One row per basket item that lands in a different stream or gains or loses diversion when moving from profile A to profile B.",
    "diff.metricsCaption": "Diversion and contamination metrics for {a} versus {b} on the {basket}",
    "diff.metricsHelp": "Diversion counts recycling, organics, green waste, split-share and drop-off mass that avoids landfill. CO2e uses EPA WARM-style planning factors disclosed per material in the signed audit; they are planning estimates, not facility measurements. Item masses are illustrative household estimates.",
    "diff.snapshotLine": "Snapshot profiles: {schema} verified {date}. Archetypes are illustrative planning models, not claims about any named city.",
    "diff.sharedCaption": "Unchanged rows are pooled at the bottom.",
    "diff.sameStream": "Same stream in both profiles",
    "diff.sharedRule": "Shared stream rule",
    "diff.andMore": "and {n} more",
    "diff.helpLink": "City sources used",
    "cascade.heading": "Wish-cycling and MRF hazard cascade lab",
    "btn.cascadeReset": "Reset lab",
    "cascade.help": "Feed up to 10 copies of each top contaminant into a load of 20 clean #1 PET bottles. Each deterministic stage engages at a fixed count: the same inputs always produce the same failure path. Sliders drive the physical failure modes documented at real materials recovery facilities.",
    "cascade.film": "#4 film and bags:",
    "cascade.lithium": "Lithium-ion batteries:",
    "cascade.liquid": "Liquid-filled bottles:",
    "cascade.grease": "Grease-soaked pizza boxes:",
    "cascade.sharps": "Sharps and hazmat items:",
    "cascade.max": "{n} max",
    "cascade.prompt": "Set any slider above 0 to model a cascade.",
    "cascade.downtime": "Modeled downtime:",
    "cascade.downtimeValue": "{n} min",
    "cascade.fiberYield": "Clean-fiber bale yield:",
    "cascade.fiberValue": "{n}%",
    "cascade.itemVerdict": "Item verdict:",
    "cascade.riskValue": "{stream} (risk {risk}/100)",
    "cascade.safeRoute": "Safe route:",
    "cascade.severity": "Combined line severity",
    "cascade.severityValue": "{active} of {total} scenarios active, {items} contaminant items, worst bale yield {pct}%, modeled downtime {min} min across the lab.",
    "cascade.idleStage": "Set the slider for this scenario above zero to see where the failure starts.",
    "cascade.footerHelp": "A deterministic model of documented MRF failure modes: each stage engages at a fixed contaminant count and severity can only stay the same or rise. Downtime and yield are illustrative planning figures, not measurements from any facility.",
    "cascade.stageCount": "{n} stages",
    "audit.heading": "Signed diversion audit export",
    "audit.help": "Exports the current profile pair and basket as a signed audit: deterministic JSON, CSV (formula-injection safe) or Markdown, each carrying an HMAC-SHA-256 integrity tag computed in pure JavaScript. Paste a JSON export back below to replay it: any edited byte fails verification. The tag proves integrity, it is not a third-party certificate.",
    "btn.auditJson": "Download signed JSON",
    "btn.auditCsv": "Download CSV",
    "btn.auditMd": "Download Markdown",
    "btn.auditCopy": "Copy JSON",
    "audit.replayLabel": "Paste a signed audit JSON to verify",
    "audit.placeholder": "Paste a signed BinCheck audit export (JSON with a \"signature\" block)",
    "btn.verifySignature": "Verify signature",
    "btn.loadAudit": "Load current export into the box",
    "audit.algorithm": "Algorithm",
    "audit.keyId": "Key id",
    "audit.digest": "Digest",
    "audit.rows": "Audit rows",
    "audit.rowsValue": "{rows} items, {profiles} profiles",
    "audit.panelHelp": "HMAC-SHA-256 over the canonical JSON payload. The integrity key ships with the app, so anyone can replay this export here and see the tag recomputed; the signature proves the bytes were not edited after export. It is a self-check integrity tag, not a third-party certificate.",
    "audit.verify": "Verification",
    "audit.detail.EMPTY": "Nothing to verify. Paste a signed BinCheck audit JSON export.",
    "audit.detail.TOO_LARGE": "Input exceeds the 256 KB audit size limit.",
    "audit.detail.NOT_JSON": "The text is not valid JSON. Paste the whole signed export, including the signature block.",
    "audit.detail.WRONG_SCHEMA": "This JSON is not a BinCheck signed audit (schema or signature block missing).",
    "audit.detail.WRONG_SIGNATURE_FORMAT": "Unsupported signature. Expected {algo} with key {keyId}.",
    "audit.detail.MALFORMED_DIGEST": "The signature digest is malformed.",
    "audit.detail.TAMPERED": "TAMPERED. The payload does not match its signature (expected digest {expected}..., stored {actual}...). At least one byte of the report was changed after signing.",
    "audit.detail.VERIFIED": "Verified intact. The signature matches every byte of the {rows}-item audit payload.",
    "audit.suffix.signedAt": "Signed at {time}.",
    "audit.suffix.engine": "Engine {version}, rules {snapshot}.",
    "audit.suffix.schema": "Schema {schema}.",
    "selftest.heading": "In-page self-tests",
    "btn.runSelfTests": "Run Self-Tests",
    "selftest.help": "The same safety checks that run in the Node test suite, live in this tab: FIPS 180-4 SHA-256 known-answer vectors, the battery-never-curbside invariant under every profile and condition, diff determinism, diversion-rate bounds, cascade monotonicity, CSV escaping, and tamper detection.",
    "selftest.notRun": "Not run yet in this tab. The same registry ships in the test suite.",
    "selftest.summary": "{passed}/{total} self-tests passed",
    "selftest.failed": ", {n} failed",
    "guide.heading": "Kitchen and garage sorting guide",
    "guide.badge": "From city sites, checked 2026-10-20",
    "guide.caption": "Riverside and Houston curbside rules by household item",
    "guide.col.item": "Household Item / Material",
    "guide.col.sl": "City of Riverside, TX (Republic Services)",
    "guide.col.hou": "City of Houston, TX (SWMD)",
    "guide.col.physics": "MRF Sorting Physics & Preparation Rule",
    "guide.dl.item": "Household item",
    "guide.dl.sl": "Riverside, TX",
    "guide.dl.hou": "Houston, TX",
    "guide.dl.physics": "Sorting physics and preparation",
    "guide.meta": "Sources: City of Riverside Solid Waste and Recycling (Republic Services, county County Recycling Center) and City of Houston SWMD (Westpark, Neighborhood Depositories).",
    "guide.row.pet.item": "#1 PET & #2 HDPE Bottles/Jugs",
    "guide.row.pet.sl": "Recycle in Curbside Cart",
    "guide.row.pet.hou": "Recycle in Green Cart",
    "guide.row.pet.physics": "Empty all liquid so optical NIR air jets can eject containers accurately; keep loose.",
    "guide.row.pp.item": "#5 Polypropylene (PP) Tubs",
    "guide.row.pp.sl": "Recycle in Curbside Cart (Clean)",
    "guide.row.pp.hou": "Recycle in Green Cart (Clean)",
    "guide.row.pp.physics": "Rinse dairy/food residue; discard foil peel lids in trash.",
    "guide.row.film.item": "Plastic Grocery Bags (#4 Film)",
    "guide.row.film.sl": "Never in Cart (Retail Store Drop-Off)",
    "guide.row.film.hou": "Never in Cart (Retail Store Drop-Off)",
    "guide.row.film.physics": "#1 MRF shaft tangler. Return clean dry film to H-E-B, Kroger, or Target store kiosks.",
    "guide.row.glass.item": "Clean Glass Bottles & Jars",
    "guide.row.glass.sl": "Accepted in Curbside Cart",
    "guide.row.glass.hou": "Accepted in Green Cart & Depositories",
    "guide.row.glass.physics": "Remove metal caps (recycle separately). Never include broken glass, ceramics, or Pyrex.",
    "guide.row.foam.item": "#6 Polystyrene / Styrofoam",
    "guide.row.foam.sl": "Clean Foam to county Drop-Off; Food Foam in Trash",
    "guide.row.foam.hou": "Black Garbage Cart Only",
    "guide.row.foam.physics": "county County Recycling Center (1200 Blume Rd) densifies clean #6 foam; never place in carts.",
    "guide.row.pizza.item": "Greasy Pizza Boxes",
    "guide.row.pizza.sl": "Tear Clean Lid for Cart / Trash Bottom",
    "guide.row.pizza.hou": "Tear Clean Lid for Cart / Trash Bottom",
    "guide.row.pizza.physics": "Pizza oil permanently weakens wet paper pulp; always tear off clean cardboard lids.",
    "guide.row.battery.item": "Lithium & Household Batteries",
    "guide.row.battery.sl": "county County HHW Drop-Off Only",
    "guide.row.battery.hou": "Houston Westpark / North ESC BOPA Only",
    "guide.row.battery.physics": "Compaction punctures lithium cells, sparking MRF truck and facility fires. Tape terminals.",
    "guide.row.yard.item": "Yard Trimmings & Brush",
    "guide.row.yard.sl": "Kraft Paper Bags / Cans (<span class=\"tabular\">40 lb</span> limit)",
    "guide.row.yard.hou": "City-Logo Compostable Bags Only (<span class=\"tabular\">50 lb</span> limit)",
    "guide.row.yard.physics": "Houston requires bags stamped with the official City biodegradable logo.",
    "dialog.title": "Keyboard shortcuts",
    "dialog.close": "Close",
    "dialog.singleKey": "Single-key shortcuts",
    "dialog.help": "Single-key shortcuts pause while you type in a field and can be switched off here. Escape and Ctrl+Enter always work.",
    "dialog.off": "off",
    "footer.brand": "BinCheck Municipal Rules Engine",
    "shortcut.focus-barcode": "Focus the barcode field",
    "shortcut.city-Riverside-tx": "Show Riverside rules",
    "shortcut.city-houston-tx": "Show Houston rules",
    "shortcut.city-compare": "Compare both cities side by side",
    "shortcut.add-to-cart": "Add the current item to the virtual cart",
    "shortcut.goto-batch": "Jump to batch CSV inspection",
    "shortcut.run-benchmark": "Run the calibration benchmark",
    "shortcut.download-report": "Download the inspection report as JSON",
    "shortcut.print-report": "Print the inspection report",
    "shortcut.open-help": "Show this shortcut list",
    "shortcut.close-help": "Close the shortcut list",
    "shortcut.language": "Switch language",
    "cart.rule": "Rule",
    "cart.risk": "Risk",
    "cart.hazards": "{n} critical hazard item(s): {items}",
    "cart.removeItem": "Remove {name} from the cart",
    "cart.addToSee": "Add an item from the inspector above.",
    "cart.cityCol": "{city} routing",
    "cart.streamMixAria": "Cart stream mix",
    "cart.summaryAria": "Cart summary",
    "cart.riskScore": "Risk score",
    "cart.maxItem": "Max single item",
    "cart.maxItemName": "{name} ({risk})",
    "cart.itemsInCart": "{n} item(s) in cart",
    "cart.streamCounts": "Stream counts",
    "status.idle": "Enter any 12-digit UPC-A or 13-digit EAN-13 barcode, or choose a material category below.",
    "status.cameraUnavailable": "Camera API unavailable in this browser context; use keyboard UPC entry or the demo catalog.",
    "status.cameraManual": "Camera preview active. This browser cannot read barcodes automatically; type the printed 12-digit code in the field above.",
    "status.cameraDenied": "Camera permission declined or unavailable; use direct UPC input or pick from the demo catalog.",
    "status.cameraError": "Camera could not read codes here; type the code instead.",
    "status.cameraDone": "Camera closed.",
    "eval.same": "Same stream in both cities",
    "eval.diff": "Same item. Different verdict.",
    "eval.prepHeading": "Required household preparation steps",
    "eval.dropoff": "Drop-off site",
    "eval.hours": "Hours:",
    "eval.bags": "Retail bag drop:",
    "eval.yard": "Yard rule:",
    "eval.mrf": "MRF failure mode",
    "eval.ruleCites": "Rule citations",
    "eval.localized": "Localized",
    "eval.confidence": "Confidence:",
    "eval.riskLabel": "Contamination risk score",
    "eval.basis": "Evidence basis:",
    "eval.notes": "City divergence",
    "eval.resinNote": "Resin code #{code}: {polymer}",
    "eval.resinCommon": "Common: {items}",
    "eval.cityCellAria": "{city} verdict",
    "eval.sameBadge": "Same stream",
    "eval.divergesBadge": "Diverges",
    "evidence.heading": "Evidence panel",
    "evidence.basis": "Evidence basis",
    "evidence.confidence": "Confidence",
    "evidence.query": "Normalized query",
    "evidence.barcode": "Barcode",
    "evidence.material": "Material",
    "evidence.resin": "Resin code",
    "evidence.condition": "Condition",
    "evidence.none": "none",
    "evidence.checks": "Checks and advisories",
    "evidence.allClear": "No conflicts or advisories.",
    "evidence.sev.error": "error",
    "evidence.sev.warning": "warning",
    "evidence.sev.advisory": "advisory",
    "issue.sev.error": "Error",
    "issue.sev.warning": "Check",
    "issue.sev.info": "Note",
    "evidence.howIdentified": "How this was identified",
    "evidence.currentBasis": "(current basis)",
    "evidence.ladderAria": "Evidence ladder, strongest first",
    "evidence.footnote": "Confidence shows how the item was identified. It is not a probability that the municipal rule is correct.",
    "evidence.panelAria": "How this result was identified",
    "evidence.itemIdentified": "Item identified",
    "evidence.identifiedAs": "as {title}",
    "evidence.notIdentified": "No item identified",
    "confidence.reason.catalog": "A catalog barcode matched, so the rule is applied to the exact product packaging.",
    "confidence.reason.category": "The rule comes from the category you chose; BinCheck cannot see the physical item.",
    "confidence.reason.resin": "Only a resin stamp was given, so the default item for that resin is used.",
    "confidence.reason.fallback": "No usable evidence was given, so a default rule is shown. Do not trust this answer.",
    "verdict.streamAria": "{stream} stream",
    "notice.matchedProduct": "Matched {name}.",
    "notice.barcodeCleared": "Barcode cleared.",
    "notice.barcodeRejected": "Barcode rejected: {reason}",
    "notice.barcodeNotInCatalog": "Valid barcode, not in the demo catalog. Using the selected category.",
    "notice.resinSelected": "Resin code {code} selected.",
    "notice.scenarioLoaded": "Scenario loaded.",
    "notice.cartFull": "Cart is full ({n} items). Remove an item first.",
    "notice.itemAdded": "Item added. Cart now holds {n}.",
    "notice.itemRemoved": "Item removed from the cart.",
    "notice.cartEmptied": "Cart emptied.",
    "notice.sampleLoaded": "Synthetic sample CSV loaded. Choose Run inspection.",
    "notice.batchDone": "Inspected {rows} rows: {evaluated} evaluated, {errors} could not be identified.",
    "notice.decodedNote": " (decoded from {enc})",
    "notice.batchCleared": "Batch cleared.",
    "notice.benchmarkDone": "Benchmark finished: {failures} failures across {evaluations} evaluations.",
    "notice.presetLoaded": "Preset \"{name}\" loaded.",
    "notice.selftestPass": "Self-tests: {passed}/{total} passed.",
    "notice.selftestFail": "Self-tests: {failed} of {total} FAILED.",
    "notice.auditOk": "Signed audit verified intact.",
    "notice.auditFail": "Audit check failed: see the verifier panel.",
    "notice.singleKeyOn": "Single-key shortcuts on.",
    "notice.singleKeyOff": "Single-key shortcuts off. Escape and Ctrl+Enter still work.",
    "notice.shareCopied": "Share link copied to the clipboard.",
    "notice.shareFallback": "Copy this link: {url}",
    "notice.fileTooLarge": "File is {size} bytes. The limit is {max} bytes.",
    "notice.fileUnreadable": "That file could not be read.",
    "notice.auditCopied": "Signed audit JSON copied to the clipboard.",
    "notice.clipboardUnavailable": "Clipboard unavailable; use Download signed JSON instead.",
    "notice.auditDemoLoaded": "Current signed export loaded into the replay box.",
    "notice.cascadeReset": "Cascade lab reset.",
    "notice.hashIgnored": "Share link: {n} unreadable value(s) were ignored.",
    "notice.languageSet": "Language set to English.",
    "live.compare.same": "Same stream in both cities",
    "live.compare.diff": "the two cities disagree",
    "live.compare": "{item}: {rel}. Riverside: {sl}. Houston: {hou}.",
    "live.single": "{item} in {city}: {badge}. Risk {risk} of 100, {tier}. Confidence {confidence}.",
    "live.idle": "Pick an item or barcode to see the city verdict.",
    "print.reportTitle": "BinCheck inspection report",
    "print.guideTitle": "BinCheck kitchen and garage sorting guide",
    "print.cityLine": "{city} ({operator})",
    "print.itemLine": "Item: {item}",
    "print.streamLine": "Stream: {stream}",
    "print.badgeLine": "Badge: {badge}",
    "print.riskLine": "Contamination risk: {risk}/100 ({tier})",
    "print.prepLine": "Prep steps:",
    "print.noteLine": "Note: {note}",
    "print.mrfLine": "MRF failure mode: {mrf}",
    "print.sameLine": "Same stream in both cities.",
    "print.diffLine": "The two cities route this item differently.",
    "print.confidenceLine": "Evidence basis: {basis}. Confidence: {confidence}.",
    "print.issuesLine": "Checks:",
    "print.batchLine": "Batch: {rows} rows read, {evaluated} evaluated, {errors} unidentified, {divergent} divergent.",
    "print.cartLine": "Cart: {n} items, average risk {avg}, status {status}.",
    "print.footer": "BinCheck demo. Verify odd items on the city sites.",
    "math.idle": "Barcode math idle. Pick a resin code or enter a 12-digit UPC.",
    "math.format": "Format:",
    "math.payload": "Payload:",
    "math.check": "Mod-10 check:",
    "math.ean13": "EAN-13:",
    "math.expected": "Expected check digit:",
    "math.found": "Found:",
    "gauge.label": "Sorting facility contamination risk",
    "gauge.score": "{score}/100, {tier}",
    "gauge.scaleLow": "0 Low",
    "gauge.scaleMod": "25 Moderate",
    "gauge.scaleHigh": "55 High",
    "gauge.scaleReject": "85+ Reject",
    "gauge.aria": "Sorting facility contamination risk score",
    "gauge.valuetext": "{score} of 100, {tier} tier",
    "gauge.physics": "Sorting facility physics:",
    "cites.officialSource": "Official source:",
    "cites.newTab": "(opens in a new tab)",
    "cites.verified": "Rules verified {date}.",
    "cites.heading": "Municipal rule trace",
    "cites.fieldsNote": "Fields quoted from {source}, snapshot verified {date}.",
    "eval.polymerStamp": "Polymer stamp:",
    "eval.dropoffGuidance": "Local drop-off and ordinance guidance:",
    "eval.facility": "Primary facility:",
    "eval.filmReturn": "Plastic film return:",
    "eval.vs": "Riverside vs. Houston:",
    "eval.risk": "Contamination risk:",
    "eval.facilityShort": "Facility:",
    "eval.flipAria": "The two cities give different verdicts for this item",
    "eval.sideBySide": "Side-by-side municipal comparison: Riverside and Houston",
    "eval.rulesDiffer": "Rules differ (risk delta {n} pts)",
    "eval.keyOrdinance": "Key ordinance comparison:",
    "eval.sourcesLine": "Rules verified {date}. Sources:",
    "eval.sourcesAnd": "and",
    "cart.emptyBadge": "Cart empty (0 items)",
    "cart.emptyMsg": "Use \"Add current item to virtual cart\" to test how a single tangler or battery affects an otherwise clean recycling bin.",
    "cart.cleanBadge": "Clean curbside load (average risk {n}/100)",
    "cart.prepBadge": "Preparation needed (max risk {n}/100)",
    "cart.hazardBadge": "Contaminated load alert ({n} hazard or tangler items)",
    "cart.stream": "Stream:",
    "cart.score": "Contamination score:",
    "cart.remove": "Remove",
    "cart.profileAria": "Risk profile of {n} cart items: average {avg}, maximum {max} out of 100",
    "cart.avg": "Average {n}",
    "cart.rejectLine": "Reject line 85",
    "batch.kpiAria": "Batch totals",
    "batch.cityAria": "{name} stream mix",
    "bench.scopeBadge": "Computed in this tab",
    "bench.scopeText": "{base} anchored cases plus {catalog} catalog barcodes, {n} city evaluations. {unanchored} catalog items have no snapshot rule and are not scored. The score measures agreement with the rules snapshot verified {date}, not field accuracy at a real facility.",
    "bench.cartAria": "Recycling cart routing metrics",
    "bench.kpiAccuracyHint": "{ok} of {total} correct",
    "bench.kpiPrecisionHint": "Cart routing that was right",
    "bench.kpiRecallHint": "Cart items found",
    "bench.kpiFpHint": "Wish-cycling errors",
    "bench.kpiStreamHint": "{ok} of {total} streams",
    "bench.matrixHeading": "Cart routing confusion matrix",
    "bench.streamHeading": "Disposal stream confusion matrix",
    "bench.matrixCaption2": "Rows are ground truth, columns are the engine decision",
    "bench.streamCaption2": "Rows are ground truth stream, columns are the engine stream",
    "bench.truth": "Ground truth",
    "bench.engineCart": "Engine: cart",
    "bench.engineOther": "Engine: other",
    "bench.truthCart": "Truth: curbside",
    "bench.truthOther": "Truth: not curbside",
    "bench.tierHeading": "Risk tier calibration",
    "bench.tierCaption": "Evaluations per risk tier by ground truth outcome",
    "bench.tierCol.tier": "Tier",
    "bench.tierCol.evals": "Evaluations",
    "bench.tierCol.cart": "Curbside",
    "bench.tierCol.notCart": "Not curbside",
    "bench.tierCol.split": "Split",
    "bench.tierHint": "A well-calibrated tier is all curbside (Low, Moderate) or all not curbside (High, Critical).",
    "bench.tierAria": "{tier} tier: {ok} curbside, {no} not curbside",
    "bench.gapHeading": "Inferred rule extensions: {closed} handled, {open} open",
    "bench.gap.open": "Open",
    "bench.gap.handled": "Handled",
    "bench.gapRow": "{label} in {city}: expected {expected}, engine says {actual}.",
    "bench.gapHint": "These cases extend a stated city rule to a similar item, so they are inferences. They are scored separately and never counted in the headline numbers.",
    "bench.failHeading": "Scored failures ({n})",
    "bench.failRow": "{id} in {city}, {field}: expected {expected}, got {actual}",
    "bench.pass": "Every scored case matched the snapshot-anchored ground truth.",
    "bench.barcodeHeading": "Barcode integrity",
    "bench.checkAcc": "Check digit accuracy",
    "bench.transp": "Transpositions caught",
    "bench.transpValue": "{n} of {total}",
    "bench.subs": "Substitutions caught",
    "bench.gapNote2.ok": "All {n} missed swaps exchange digits that differ by 5, a known blind spot of the GS1 Modulo-10 check.",
    "bench.gapNote2.bad": "Some missed swaps are not explained by the digit gap rule; investigate.",
    "bench.latencyHeading": "Engine latency",
    "bench.median": "Median",
    "bench.p95": "95th percentile",
    "bench.slowest": "Slowest",
    "bench.evals": "{n} evaluations",
    "bench.latencyHint": "In this browser tab just now, so it varies by device. Browser timers round to about 0.1 ms. Never written to exports.",
    "bench.measured": "Measured live",
    "print.metaItem": "Item: {item}. Evidence: {basis}, {confidence}. Rules verified {date}.",
    "print.batchHeading": "Batch inspection summary",
    "print.batchSummary": "{rows} rows read, {evaluated} evaluated, {errors} could not be identified, {divergent} where the two cities disagree.",
    "print.notEval": "Not evaluated",
    "print.stream": "Stream:",
    "print.risk": "Risk:",
    "print.facility": "Facility:",
    "print.source": "Source:",
    "print.generated": "Generated locally in the browser. Confirm any borderline item with the official city source above.",
    "os.both": "both cities"
  }),

  es: Object.freeze({
    "title.page": "BinCheck | Motor de reglas de reciclaje municipal de Riverside y Houston y verificador de eliminación por código de barras",
    "meta.description": "BinCheck es un motor de reglas de reciclaje municipal de dos ciudades y un verificador de eliminación por código de barras para Riverside y Houston, Texas. Confirme qué permite cada carrito, depósito y regla de preparación antes de que llegue el camión.",
    "html.lang": "es",
    "skip.link": "Saltar al contenido principal",
    "nav.sections": "Secciones de la página",
    "nav.inspect": "Inspeccione un artículo",
    "nav.batch": "CSV por lotes",
    "nav.diff": "Comparación municipal",
    "nav.cascade": "Laboratorio de cascada",
    "nav.audit": "Auditoría firmada",
    "nav.selftest": "Autopruebas",
    "nav.benchmark": "Prueba de calibración",
    "nav.guide": "Guía de cocina",
    "nav.shortcuts": "Atajos",
    "nav.keyShortcuts": "Atajos de teclado",
    "header.printGuide": "Imprimir guía de cocina de 1 página",
    "group.jurisdiction": "Modo de jurisdicción",
    "group.language": "Language / Idioma",
    "lang.en": "EN",
    "lang.es": "ES",
    "city.compare": "Comparación lado a lado",
    "hero.line1": "Deje de reciclar a ciegas en la acera.",
    "hero.line2": "Verifique qué realmente sobrevive al",
    "hero.accent": "clasificador óptico.",
    "hero.lead": "Cruzar el límite municipal entre Riverside (Republic Services y el Centro de Reciclaje del Condado de county en Blume Rd) y Houston (SWMD y Westpark) cambia qué plásticos, bolsas de jardín y bloques de espuma se aceptan. Inspeccione cualquier producto por código de barras GS1, sello de polímero SPI o estado físico de contaminación antes de que atasque un eje de criba de estrellas.",
    "hero.imgAlt": "Resumen de especificaciones de materiales municipales con botellas PET, envases HDPE, cartón corrugado y sellos de resina SPI",
    "stats.catalog": "Catálogo demo de códigos de barras",
    "stats.resin": "Códigos de molde de polímeros",
    "stats.materials": "Perfiles de materiales",
    "stats.cities": "Jurisdicciones de ordenanzas",
    "stats.gs1Codes": "{n} códigos GS1",
    "stats.materialsCount": "{n} flujos",
    "stats.citiesCount": "{n} ciudades",
    "guided.heading": "Pruébelo en tres clics",
    "guided.cityFlip.name": "Vea cómo una línea municipal cambia el veredicto",
    "guided.cityFlip.desc": "El mismo vaso de espuma #6 va a un depósito del Condado de county en Riverside pero al carrito de basura en Houston.",
    "guided.trap.name": "Cargue una trampa de contaminación",
    "guided.trap.desc": "Una batería de litio dentro de 30 botellas limpias muestra por qué el promedio oculta el peligro.",
    "guided.csv.name": "Audite un CSV hogareño sintético",
    "guided.csv.desc": "Nueve filas ilustrativas evaluadas por ciudad, con la parte elegible para el carrito.",
    "search.heading": "Encuentre cualquier artículo",
    "search.srLabel": "Busque en el catálogo demo y las categorías de materiales",
    "search.placeholder": "Escriba vidrio, pizza, batería, unicel, Topo Chico...",
    "search.itemsCount": "{n} artículos",
    "search.matches": "{n} coincidencias",
    "search.closeMatches": "{n} coincidencias cercanas",
    "search.empty": "Escriba para buscar en nombres de productos, materiales y empaques",
    "search.partial": "El catálogo y la lista de materiales son índices de búsqueda, no el motor de reglas. Si nada coincide, elija la categoría de material abajo.",
    "search.showing": "Mostrando {shown} de {total} coincidencias",
    "search.noMatch": "Ningún artículo del catálogo ni material coincide con \"{query}\". Elija la categoría de material más cercana abajo, o pruebe palabras como vidrio, pizza, batería o unicel.",
    "search.partialNote": "Ningún artículo coincide con todas las palabras. Coincidencias más cercanas:",
    "search.categorySub": "Categoría de material",
    "search.demoSub": "{brand}, UPC {upc}, datos demo",
    "search.citiesDiffer": "Las ciudades difieren",
    "demo.subheading": "O pruebe un artículo común",
    "demo.pet": "Pruebe botella de agua PET #1",
    "demo.pizza": "Pruebe caja de pizza grasosa",
    "demo.glass": "Pruebe frasco de vidrio (Riverside vs. Houston)",
    "demo.bag": "Pruebe bolsa de supermercado",
    "demo.battery": "Pruebe batería de litio",
    "demo.foam": "Pruebe vaso de unicel #6",
    "demo.yard": "Pruebe bolsa de recortes de jardín",
    "panel.inspector": "Inspector de código de barras, código de resina y material",
    "rules.badge": "Reglas",
    "rules.chipTitle": "Fecha en que la captura de reglas incluida de Riverside y Houston se verificó por última vez contra los sitios de las ciudades",
    "nav.shortcutsTitle": "Active o desactive los atajos de una letra",
    "field.barcode": "Búsqueda de código GS1 (UPC-A de 12 dígitos o EAN-13)",
    "barcode.placeholder": "ej. 041220576463 (agua H-E-B)",
    "barcode.statusIdle": "Escriba cualquier código UPC-A de 12 dígitos o EAN-13 de 13 dígitos, o elija una categoría de material abajo.",
    "barcode.statusMatched": "Coincidió: {name} ({pack}).",
    "barcode.statusUnmatched": "No está en el catálogo demo; se evalúa con la regla del material o la resina seleccionada.",
    "btn.verifyUpc": "Verificar UPC",
    "btn.cameraScan": "Escanear con cámara",
    "btn.cameraStop": "Detener cámara",
    "camera.title": "Use la cámara del dispositivo para leer un código de barras en vivo",
    "camera.frameAlt": "Lector de códigos de barras por cámara",
    "catalog.label": "O elija del catálogo demo",
    "catalog.badge": "Datos demo",
    "catalog.badgeTitle": "Cada código pasa el dígito de verificación GS1. Los emparejamientos con productos son ilustrativos, no escaneados de anaqueles.",
    "catalog.choose": "Elija un código del catálogo",
    "resin.label": "Código de identificación de resina plástica SPI (#1 a #7)",
    "resin.groupAria": "Códigos de resina SPI",
    "resin.other": "Otro",
    "field.material": "Categoría de material / artículo",
    "field.condition": "Condición del artículo",
    "btn.addCart": "Agregar el artículo actual al carrito virtual",
    "btn.resetCart": "Restablecer el carrito virtual",
    "result.srHeading": "Resultado de la inspección",
    "btn.reportCsv": "Descargar reporte CSV",
    "btn.reportJson": "Descargar reporte JSON",
    "btn.share": "Copiar enlace para compartir",
    "btn.printReport": "Imprimir reporte de inspección",
    "cart.heading": "Carrito virtual",
    "impact.heading": "Calculadora de contaminación",
    "impact.itemLabel": "Artículo actual",
    "impact.cleanLabel": "Botellas limpias PET #1 en el carrito:",
    "impact.countLabel": "Copias del artículo actual:",
    "impact.note": "Elija cualquier artículo arriba y arrastre. Cada número proviene del mismo motor de reglas y umbrales que el carrito.",
    "impact.empty": "Elija un artículo en el inspector de arriba y luego ajuste los valores.",
    "impact.avgRisk": "Riesgo promedio",
    "impact.worstItem": "Peor artículo",
    "impact.scaleNote": "Escala 0-100.",
    "impact.itemsSummary": "{total} artículos, {wrong} en el contenedor equivocado ({share})",
    "impact.gridAria": "Contenido del carrito, {clean} botellas limpias y {count} copias del artículo",
    "impact.cellCleanTitle": "Botella limpia PET #1",
    "impact.finding.onlyClean": "Promedio {avg}. Todas las botellas están limpias y vacías, así que la carga supera el nivel de acera en ambas ciudades.",
    "impact.finding.hidden": "Promedio {avg}. La matemática todavía supera el nivel de acera, pero {worst} sigue siendo {stream} donde caiga: el promedio oculta el peligro, así que hay que sacarlo a mano.",
    "impact.finding.ok": "Promedio {avg}. Nada aquí envenena la carga; mantenga cada artículo en su propio flujo como se muestra.",
    "impact.finding.other": "Promedio {avg}. El problema está repartido en la carga y no en un solo artículo.",
    "impact.finding.clean": "Todo limpio.",
    "impact.finding.trap": "Los promedios lo ocultan: {worst} tiene riesgo {tier} ({risk}) y sigue siendo {stream}.",
    "impact.finding.contaminated": "La carga es {tier} ({avg} promedio) y el camión puede rechazarla.",
    "impact.finding.benign": "Ningún artículo envenena la carga; mantenga los artículos en sus propios flujos.",
    "impact.addItem": "Agregue al menos un artículo para ver el estado de la carga.",
    "impact.finding.allClean": "Con solo botellas limpias la carga está limpia, riesgo promedio {avg}/100.",
    "impact.finding.hiddenWorst": "El riesgo promedio es solo {avg}/100, pero el estado de la carga sigue al peor artículo. {count} {item} a {risk}/100 hace que esta sea una carga \"{status}\", y agregar más botellas limpias no puede diluirlo. {word} es el lugar correcto.",
    "impact.finding.staysClean": "{item} va en el carrito (riesgo {risk}/100), así que la carga sigue \"{status}\".",
    "impact.finding.spread": "Riesgo promedio {avg}/100, peor artículo {max}/100: \"{status}\". {word} es el lugar correcto para este artículo.",
    "impact.ticks": "Marcas en {m}, {h} y {r}, los mismos umbrales que usan el carrito y el motor.",
    "csv.heading": "Inspección por lotes de CSV",
    "csv.tag": "Hasta 500 filas, 256 KB",
    "csv.pasteLabel": "Pegue texto CSV",
    "csv.help": "Columnas: label, barcode, material, resin, condition. La fila de encabezado es opcional; sin ella, las columnas se leen como barcode, material, resin, condition, label. Material usa identificadores como resin-1-pet o glass-jar-bottle. Las líneas que empiezan con # se ignoran. Las filas que BinCheck no puede identificar se listan como errores y nunca se adivinan. La muestra incluida es un conjunto de datos sintético ilustrativo, no registros domésticos reales. Ctrl+Enter (o Cmd+Enter) dentro del cuadro ejecuta la inspección.",
    "btn.runInspection": "Ejecutar inspección",
    "btn.loadSample": "Cargar muestra sintética",
    "btn.clear": "Limpiar",
    "csv.fileLabel": "O elija un archivo CSV",
    "csv.empty": "Aún no hay lote. Cargue la muestra o pegue sus propias filas y elija Ejecutar inspección.",
    "btn.resultsCsv": "Descargar resultados CSV",
    "btn.resultsJson": "Descargar resultados JSON",
    "batch.rowsRead": "Filas leídas",
    "batch.evaluated": "Evaluadas",
    "batch.warnings": "Necesitan revisión",
    "batch.errors": "Sin identificar",
    "batch.divergent": "Las ciudades difieren",
    "batch.avgMax": "Riesgo promedio {avg}/100, máximo {max}/100",
    "batch.eligible": "{n} de {total} artículos evaluados son elegibles para el carrito ({pct}%)",
    "batch.notEligible": "{n} deben quedarse fuera del carrito",
    "batch.attention": "Filas que necesitan atención",
    "batch.line": "Línea",
    "batch.item": "Artículo",
    "batch.evidence": "Evidencia",
    "batch.status": "Estado",
    "batch.notEvaluated": "No evaluada",
    "batch.citiesDiffer": "Las ciudades difieren",
    "batch.unlabeled": "Fila sin nombre",
    "batch.risk": "Riesgo {n}/100",
    "batch.streamMixAria": "Mezcla de flujos de {name}",
    "batch.caption": "Resultados de inspección por fila para Riverside y Houston",
    "batch.noRows": "Sin filas evaluadas.",
    "batch.lineLoc": "Línea {n}",
    "batch.byteLoc": "Byte {n}",
    "batch.inputLoc": "Entrada",
    "batch.eligibleLine": "{n} artículos evaluados son elegibles para el carrito ({pct})",
    "batch.stayOut": "{n} deben quedarse fuera del carrito",
    "bench.heading": "Prueba de calibración",
    "btn.runBenchmark": "Ejecutar prueba",
    "btn.benchJson": "Descargar reporte JSON",
    "bench.empty": "Aún no hay ejecución. La prueba califica casos etiquetados de referencia más cada artículo del catálogo contra ambas ciudades.",
    "bench.scope": "{cases} casos etiquetados más {catalog} artículos del catálogo x {cities} ciudades, {n} ejecuciones",
    "bench.kpiAccuracy": "Exactitud",
    "bench.kpiPrecision": "Precisión",
    "bench.kpiRecall": "Cobertura",
    "bench.kpiFp": "Falsos positivos",
    "bench.kpiStream": "Exactitud de flujo",
    "bench.tp": "{n} TP",
    "bench.casePrecision": "Precisión por caso",
    "bench.macro": "Macro",
    "bench.weighted": "Ponderada",
    "bench.ofFp": "de {n} FP",
    "bench.sixStreams": "6 flujos, todos los casos",
    "bench.matrixTitle": "Matriz de confusión de enrutamiento del carrito",
    "bench.matrixAria": "Matriz de confusión de enrutamiento del carrito, las filas son la verdad y las columnas las predicciones",
    "bench.matrixCaption": "La verdad va abajo al costado, las predicciones arriba. Carrito significa el flujo de reciclaje de la acera; Fuera del carrito agrupa todas las demás rutas.",
    "bench.streamTitle": "Matriz de confusión de flujos",
    "bench.streamAria": "Matriz de confusión completa de flujos, las filas son la verdad y las columnas las predicciones",
    "bench.streamCaption": "La verdad va abajo al costado, las predicciones arriba. Solo se dibujan las celdas con al menos un caso.",
    "bench.tierTitle": "Calibración de niveles de contaminación",
    "bench.tierAria": "Tabla de calibración de niveles de contaminación",
    "bench.band": "Banda",
    "bench.cases": "Casos",
    "bench.streamAcc": "Exactitud de flujo",
    "bench.avgAbs": "Delta absoluta promedio",
    "bench.tierCaption": "Bandas de riesgo agrupadas en ambas ciudades.",
    "bench.failures": "Fallos",
    "bench.failCase": "{id} en {city}: se esperaba {expected}, se obtuvo {actual}",
    "bench.gapTitle": "Brechas conocidas de la captura",
    "bench.gapHelp": "Los anclajes prueban la etiqueta; los anclajes más una nota del motor prueban la nota.",
    "bench.gapOpen": "{open} de {total} brechas conocidas siguen abiertas",
    "bench.gapClosed": "Las {total} brechas conocidas de la captura están cerradas",
    "bench.gapRowOpen": "ABIERTA {label} en {city}: se esperaba {expected}, se obtuvo {actual}",
    "bench.gapRowClosed": "CERRADA {label} en {city}: {actual}",
    "bench.gapNote": "{label}: {note}",
    "bench.barcodeTitle": "Integridad de códigos de barras",
    "bench.barcodePass": "{n}/{total} códigos del catálogo pasan el dígito verificador GS1",
    "bench.latencyTitle": "Latencia por artículo",
    "bench.latencyMean": "media {mean} ms p95 {p95} ms ({runs} ejecuciones)",
    "bench.latencyMeanLabel": "media",
    "bench.latencyP95Label": "p95",
    "diff.heading": "Comparación de reglas municipales y comparador de desvíos",
    "diff.tag": "6 perfiles de MRF",
    "diff.help": "Una canasta de artículos domésticos difíciles, evaluada bajo dos perfiles de programa: las dos capturas de ciudades reales (Riverside y Houston, del motor de reglas incluido) y cuatro arquetipos ilustrativos. Las alertas de conflicto de reglas marcan todo lo que el carrito acepta bajo un perfil pero que contamina bajo el otro.",
    "preset.groupAria": "Preajustes del banco de trabajo",
    "field.profileA": "Perfil A",
    "field.profileB": "Perfil B",
    "field.basket": "Canasta hogareña",
    "preset.glass": "Vidrio adentro vs. vidrio afuera",
    "preset.organics": "Distrito de orgánicos obligatorios",
    "preset.rural": "Carrito de ciudad vs. estación rural de transferencia",
    "preset.battery": "Una batería en el carrito",
    "preset.tangler": "La película enrolla las cribas de estrellas",
    "diff.metric": "Métrica ({basket})",
    "diff.ab": "A menos B",
    "diff.metric.diversionRate": "Tasa de desvío",
    "diff.metric.curbsideOnly": "Desvío solo en la acera",
    "diff.metric.divertedMass": "Masa desviada",
    "diff.metric.dropOffMass": "Requiere viaje al depósito",
    "diff.metric.landfillMass": "Masa al relleno sanitario",
    "diff.metric.cartContamination": "Contaminación del carrito ingenuo",
    "diff.metric.contaminationRisk": "Índice de riesgo de contaminación",
    "diff.metric.co2eAvoided": "CO2e evitado del ciclo de vida",
    "diff.unit.pct": "{n}%",
    "diff.unit.pctPt": "{n} pt",
    "diff.unit.kg": "{n} kg",
    "diff.unit.per100": "{n} / 100",
    "diff.conflicts": "Alertas de conflicto de reglas",
    "diff.conflict.count": "{open} abiertas, {total} modeladas",
    "diff.noConflicts": "Sin conflictos: cada artículo de la canasta va al mismo tipo de flujo bajo ambos perfiles.",
    "diff.kindTag.snapshot": "Captura real de la ciudad",
    "diff.kindTag.archetype": "Arquetipo ilustrativo",
    "diff.col.basket": "Artículo de la canasta",
    "diff.col.stream": "Flujo",
    "diff.col.prep": "Preparación + nota",
    "diff.col.city": "Ciudad",
    "diff.weight": "{n} kg",
    "diff.caption": "Ruteo artículo por artículo bajo ambos perfiles",
    "diff.conflictCaption": "Una fila por artículo de la canasta que cae en un flujo distinto o gana o pierde desvío al pasar del perfil A al perfil B.",
    "diff.metricsCaption": "Métricas de desvío y contaminación para {a} frente a {b} en la {basket}",
    "diff.metricsHelp": "El desvío cuenta reciclaje, orgánicos, residuos verdes, masa dividida y masa de depósito que evita el relleno. El CO2e usa factores de planificación estilo EPA WARM declarados por material en la auditoría firmada; son estimaciones de planificación, no mediciones de planta. Las masas de los artículos son estimaciones domésticas ilustrativas.",
    "diff.snapshotLine": "Perfiles de captura real: {schema} verificado {date}. Los arquetipos son modelos ilustrativos de planificación, no afirmaciones sobre ninguna ciudad nombrada.",
    "diff.sharedCaption": "Las filas sin cambios se agrupan abajo.",
    "diff.sameStream": "Mismo flujo en ambos perfiles",
    "diff.sharedRule": "Regla de flujo compartida",
    "diff.andMore": "y {n} más",
    "diff.helpLink": "Fuentes de las ciudades usadas",
    "cascade.heading": "Laboratorio de cascada de peligros del MRF y reciclaje a ciegas",
    "btn.cascadeReset": "Restablecer laboratorio",
    "cascade.help": "Introduzca hasta 10 copias de cada contaminante principal en una carga de 20 botellas limpias PET #1. Cada etapa determinista se activa a un conteo fijo: las mismas entradas siempre producen el mismo camino de falla. Los controles accionan los modos físicos de falla documentados en plantas reales de recuperación de materiales.",
    "cascade.film": "Película y bolsas #4:",
    "cascade.lithium": "Baterías de iones de litio:",
    "cascade.liquid": "Botellas con líquido:",
    "cascade.grease": "Cajas de pizza grasosas:",
    "cascade.sharps": "Objetos punzantes y peligrosos:",
    "cascade.max": "{n} máx.",
    "cascade.prompt": "Mueva cualquier control arriba de 0 para modelar una cascada.",
    "cascade.downtime": "Tiempo de parada modelado:",
    "cascade.downtimeValue": "{n} min",
    "cascade.fiberYield": "Rendimiento de paca de fibra limpia:",
    "cascade.fiberValue": "{n}%",
    "cascade.itemVerdict": "Veredicto del artículo:",
    "cascade.riskValue": "{stream} (riesgo {risk}/100)",
    "cascade.safeRoute": "Ruta segura:",
    "cascade.severity": "Severidad combinada de la línea",
    "cascade.severityValue": "{active} de {total} escenarios activos, {items} artículos contaminantes, peor rendimiento de paca {pct}%, tiempo de parada modelado {min} min en todo el laboratorio.",
    "cascade.idleStage": "Suba el control de este escenario por encima de cero para ver dónde empieza la falla.",
    "cascade.footerHelp": "Un modelo determinista de modos de falla documentados en MRF: cada etapa se activa a un conteo fijo de contaminantes y la severidad solo puede mantenerse o subir. El tiempo de parada y el rendimiento son cifras ilustrativas de planificación, no mediciones de ninguna planta.",
    "cascade.stageCount": "{n} etapas",
    "audit.heading": "Exportación de auditoría de desvío firmada",
    "audit.help": "Exporta el par de perfiles actual y la canasta como auditoría firmada: JSON determinista, CSV (seguro contra inyección de fórmulas) o Markdown, cada uno con una etiqueta de integridad HMAC-SHA-256 calculada en JavaScript puro. Pegue una exportación JSON abajo para repetirla: cualquier byte editado falla la verificación. La etiqueta prueba integridad, no es un certificado de terceros.",
    "btn.auditJson": "Descargar JSON firmado",
    "btn.auditCsv": "Descargar CSV",
    "btn.auditMd": "Descargar Markdown",
    "btn.auditCopy": "Copiar JSON",
    "audit.replayLabel": "Pegue un JSON de auditoría firmada para verificar",
    "audit.placeholder": "Pegue una exportación de auditoría firmada de BinCheck (JSON con un bloque \"signature\")",
    "btn.verifySignature": "Verificar firma",
    "btn.loadAudit": "Cargar la exportación actual en el cuadro",
    "audit.algorithm": "Algoritmo",
    "audit.keyId": "ID de clave",
    "audit.digest": "Resumen",
    "audit.rows": "Filas de auditoría",
    "audit.rowsValue": "{rows} artículos, {profiles} perfiles",
    "audit.panelHelp": "HMAC-SHA-256 sobre el contenido JSON canónico. La clave de integridad se distribuye con la app, así que cualquiera puede repetir esta exportación aquí y ver la etiqueta recalculada; la firma prueba que los bytes no se editaron después de la exportación. Es una etiqueta de integridad de autocomprobación, no un certificado de terceros.",
    "audit.verify": "Verificación",
    "audit.detail.EMPTY": "Nada que verificar. Pegue una exportación de auditoría firmada de BinCheck en JSON.",
    "audit.detail.TOO_LARGE": "La entrada supera el límite de tamaño de auditoría de 256 KB.",
    "audit.detail.NOT_JSON": "El texto no es JSON válido. Pegue la exportación firmada completa, incluido el bloque de firma.",
    "audit.detail.WRONG_SCHEMA": "Este JSON no es una auditoría firmada de BinCheck (falta el esquema o el bloque de firma).",
    "audit.detail.WRONG_SIGNATURE_FORMAT": "Firma no compatible. Se esperaba {algo} con la clave {keyId}.",
    "audit.detail.MALFORMED_DIGEST": "El resumen de la firma está mal formado.",
    "audit.detail.TAMPERED": "ALTERADO. El contenido no coincide con su firma (resumen esperado {expected}..., guardado {actual}...). Al menos un byte del informe cambió después de la firma.",
    "audit.detail.VERIFIED": "Verificado intacto. La firma coincide con cada byte del contenido de auditoría de {rows} artículos.",
    "audit.suffix.signedAt": "Firmado a las {time}.",
    "audit.suffix.engine": "Motor {version}, reglas {snapshot}.",
    "audit.suffix.schema": "Esquema {schema}.",
    "selftest.heading": "Autopruebas en la página",
    "btn.runSelfTests": "Ejecutar autopruebas",
    "selftest.help": "Las mismas verificaciones de seguridad que corren en la suite de pruebas de Node, en vivo en esta pestaña: vectores de respuesta conocida SHA-256 FIPS 180-4, el invariante de que la batería nunca va en la acera bajo cada perfil y condición, determinismo del diff, límites de la tasa de desvío, monotonía de cascada, escape de CSV y detección de alteraciones.",
    "selftest.notRun": "Aún no se ejecutan en esta pestaña. El mismo registro viene en la suite de pruebas.",
    "selftest.summary": "{passed}/{total} autopruebas pasaron",
    "selftest.failed": ", {n} fallaron",
    "guide.heading": "Guía de clasificación para cocina y garaje",
    "guide.badge": "De los sitios de las ciudades, verificado 2026-10-20",
    "guide.caption": "Reglas de recolección en la acera de Riverside y Houston por artículo doméstico",
    "guide.col.item": "Artículo / material del hogar",
    "guide.col.sl": "Ciudad de Riverside, TX (Republic Services)",
    "guide.col.hou": "Ciudad de Houston, TX (SWMD)",
    "guide.col.physics": "Física de clasificación del MRF y regla de preparación",
    "guide.dl.item": "Artículo del hogar",
    "guide.dl.sl": "Riverside, TX",
    "guide.dl.hou": "Houston, TX",
    "guide.dl.physics": "Física de clasificación y preparación",
    "guide.meta": "Fuentes: Manejo de Residuos Sólidos y Reciclaje de la Ciudad de Riverside (Republic Services, Centro de Reciclaje del Condado de county) y SWMD de la Ciudad de Houston (Westpark, Depósitos Vecinales).",
    "guide.row.pet.item": "Botellas/envases PET #1 y HDPE #2",
    "guide.row.pet.sl": "Recicle en el carrito de la acera",
    "guide.row.pet.hou": "Recicle en el carrito verde",
    "guide.row.pet.physics": "Vacíe todo líquido para que los chorros de aire ópticos NIR expulsen los envases con precisión; manténgalos sueltos.",
    "guide.row.pp.item": "Envases de polipropileno (PP) #5",
    "guide.row.pp.sl": "Recicle en el carrito de la acera (limpios)",
    "guide.row.pp.hou": "Recicle en el carrito verde (limpios)",
    "guide.row.pp.physics": "Enjuague residuos de lácteos/comida; tire las tapas de aluminio despegables a la basura.",
    "guide.row.film.item": "Bolsas de plástico de compras (película #4)",
    "guide.row.film.sl": "Nunca en el carrito (depósito en tiendas)",
    "guide.row.film.hou": "Nunca en el carrito (depósito en tiendas)",
    "guide.row.film.physics": "El enredante número 1 de ejes del MRF. Devuelva la película limpia y seca a los quioscos de H-E-B, Kroger o Target.",
    "guide.row.glass.item": "Botellas y frascos de vidrio limpios",
    "guide.row.glass.sl": "Aceptados en el carrito de la acera",
    "guide.row.glass.hou": "Aceptados en el carrito verde y depósitos",
    "guide.row.glass.physics": "Quite las tapas metálicas (recíclelas por separado). Nunca incluya vidrio roto, cerámica ni Pyrex.",
    "guide.row.foam.item": "Poliestireno / unicel #6",
    "guide.row.foam.sl": "Espuma limpia al depósito de county; espuma con comida a la basura",
    "guide.row.foam.hou": "Solo carrito negro de basura",
    "guide.row.foam.physics": "El Centro de Reciclaje del Condado de county (1200 Blume Rd) densifica espuma #6 limpia; nunca la ponga en los carritos.",
    "guide.row.pizza.item": "Cajas de pizza grasosas",
    "guide.row.pizza.sl": "Tapa limpia al carrito / base a la basura",
    "guide.row.pizza.hou": "Tapa limpia al carrito / base a la basura",
    "guide.row.pizza.physics": "El aceite de pizza debilita permanentemente la pulpa de papel húmeda; siempre arranque las tapas limpias de cartón.",
    "guide.row.battery.item": "Baterías de litio y domésticas",
    "guide.row.battery.sl": "Solo depósito HHW del Condado de county",
    "guide.row.battery.hou": "Solo Houston Westpark / ESC del Norte BOPA",
    "guide.row.battery.physics": "La compactación perfora las celdas de litio y provoca incendios en camiones e instalaciones del MRF. Cubra las terminales con cinta.",
    "guide.row.yard.item": "Recortes de jardín y cepillo",
    "guide.row.yard.sl": "Bolsas de papel kraft / botes (límite de <span class=\"tabular\">40 lb</span>)",
    "guide.row.yard.hou": "Solo bolsas compostables con el logo de la ciudad (límite de <span class=\"tabular\">50 lb</span>)",
    "guide.row.yard.physics": "Houston exige bolsas con el sello biodegradable oficial de la Ciudad.",
    "dialog.title": "Atajos de teclado",
    "dialog.close": "Cerrar",
    "dialog.singleKey": "Atajos de una tecla",
    "dialog.help": "Los atajos de una tecla se pausan mientras escribe en un campo y pueden desactivarse aquí. Escape y Ctrl+Enter siempre funcionan.",
    "dialog.off": "apagado",
    "footer.brand": "BinCheck Motor de Reglas Municipales",
    "shortcut.focus-barcode": "Enfocar el campo de código de barras",
    "shortcut.city-Riverside-tx": "Ver reglas de Riverside",
    "shortcut.city-houston-tx": "Ver reglas de Houston",
    "shortcut.city-compare": "Comparar ambas ciudades lado a lado",
    "shortcut.add-to-cart": "Agregar el artículo actual al carrito virtual",
    "shortcut.goto-batch": "Ir a la inspección por lotes de CSV",
    "shortcut.run-benchmark": "Ejecutar la prueba de calibración",
    "shortcut.download-report": "Descargar el reporte de inspección como JSON",
    "shortcut.print-report": "Imprimir el reporte de inspección",
    "shortcut.open-help": "Mostrar esta lista de atajos",
    "shortcut.close-help": "Cerrar la lista de atajos",
    "shortcut.language": "Cambiar de idioma",
    "cart.rule": "Regla",
    "cart.risk": "Riesgo",
    "cart.hazards": "{n} artículo(s) de peligro crítico: {items}",
    "cart.removeItem": "Quitar {name} del carrito",
    "cart.addToSee": "Agregue un artículo desde el inspector de arriba.",
    "cart.cityCol": "Ruta en {city}",
    "cart.streamMixAria": "Mezcla de flujos del carrito",
    "cart.summaryAria": "Resumen del carrito",
    "cart.riskScore": "Puntaje de riesgo",
    "cart.maxItem": "Artículo máximo",
    "cart.maxItemName": "{name} ({risk})",
    "cart.itemsInCart": "{n} artículo(s) en el carrito",
    "cart.streamCounts": "Conteo por flujo",
    "status.idle": "Escriba cualquier código UPC-A de 12 dígitos o EAN-13 de 13, o elija una categoría de material abajo.",
    "status.cameraUnavailable": "El escaneo por cámara no está disponible en este navegador. Escriba el código.",
    "status.cameraManual": "Cámara detenida; escriba el código manualmente.",
    "status.cameraDenied": "Se negó el permiso de cámara; escriba el código.",
    "status.cameraError": "La cámara no pudo leer códigos aquí; escriba el código.",
    "status.cameraDone": "Cámara cerrada.",
    "eval.same": "Mismo flujo en ambas ciudades",
    "eval.diff": "Mismo artículo. Veredicto distinto.",
    "eval.prepHeading": "Pasos de preparación obligatorios en el hogar",
    "eval.dropoff": "Sitio de depósito",
    "eval.hours": "Horario:",
    "eval.bags": "Devolución de bolsas en tienda:",
    "eval.yard": "Regla de jardín:",
    "eval.mrf": "Modo de falla en el MRF",
    "eval.ruleCites": "Citas de reglas",
    "eval.localized": "Traducido",
    "eval.confidence": "Confianza:",
    "eval.riskLabel": "Puntaje de riesgo de contaminación",
    "eval.basis": "Base de evidencia:",
    "eval.notes": "Divergencia entre ciudades",
    "eval.resinNote": "Código de resina #{code}: {polymer}",
    "eval.resinCommon": "Común: {items}",
    "eval.cityCellAria": "Veredicto de {city}",
    "eval.sameBadge": "Mismo flujo",
    "eval.divergesBadge": "Difiere",
    "evidence.heading": "Panel de evidencia",
    "evidence.basis": "Base de evidencia",
    "evidence.confidence": "Confianza",
    "evidence.query": "Consulta normalizada",
    "evidence.barcode": "Código de barras",
    "evidence.material": "Material",
    "evidence.resin": "Código de resina",
    "evidence.condition": "Condición",
    "evidence.none": "ninguno",
    "evidence.checks": "Verificaciones y avisos",
    "evidence.allClear": "Sin conflictos ni avisos.",
    "evidence.sev.error": "error",
    "evidence.sev.warning": "aviso",
    "evidence.sev.advisory": "recomendación",
    "issue.sev.error": "Error",
    "issue.sev.warning": "Revise",
    "issue.sev.info": "Nota",
    "evidence.howIdentified": "Cómo se identificó",
    "evidence.currentBasis": "(base actual)",
    "evidence.ladderAria": "Escalera de evidencia, la más fuerte primero",
    "evidence.footnote": "La confianza muestra cómo se identificó el artículo. No es una probabilidad de que la regla municipal sea correcta.",
    "evidence.panelAria": "Cómo se identificó este resultado",
    "evidence.itemIdentified": "Artículo identificado",
    "evidence.identifiedAs": "como {title}",
    "evidence.notIdentified": "Ningún artículo identificado",
    "confidence.reason.catalog": "Coincidió un código de barras del catálogo, así que la regla se aplica al empaque exacto del producto.",
    "confidence.reason.category": "La regla proviene de la categoría que eligió; BinCheck no puede ver el artículo físico.",
    "confidence.reason.resin": "Solo se dio un sello de resina, así que se usa el artículo predeterminado de esa resina.",
    "confidence.reason.fallback": "No se dio evidencia utilizable, así que se muestra una regla predeterminada. No confíe en esta respuesta.",
    "verdict.streamAria": "flujo de {stream}",
    "notice.matchedProduct": "Coincidió con {name}.",
    "notice.barcodeCleared": "Código de barras borrado.",
    "notice.barcodeRejected": "Código rechazado: {reason}",
    "notice.barcodeNotInCatalog": "Código válido, pero no está en el catálogo demo. Se usa la categoría seleccionada.",
    "notice.resinSelected": "Código de resina {code} seleccionado.",
    "notice.scenarioLoaded": "Escenario cargado.",
    "notice.cartFull": "El carrito está lleno ({n} artículos). Quite un artículo primero.",
    "notice.itemAdded": "Artículo agregado. El carrito ahora tiene {n}.",
    "notice.itemRemoved": "Artículo quitado del carrito.",
    "notice.cartEmptied": "Carrito vaciado.",
    "notice.sampleLoaded": "CSV de muestra sintética cargado. Elija Ejecutar inspección.",
    "notice.batchDone": "Se inspeccionaron {rows} filas: {evaluated} evaluadas, {errors} sin identificar.",
    "notice.decodedNote": " (decodificado de {enc})",
    "notice.batchCleared": "Lote borrado.",
    "notice.benchmarkDone": "Prueba terminada: {failures} fallos en {evaluations} evaluaciones.",
    "notice.presetLoaded": "Preconfiguración \"{name}\" cargada.",
    "notice.selftestPass": "Autopruebas: {passed}/{total} pasaron.",
    "notice.selftestFail": "Autopruebas: {failed} de {total} FALLARON.",
    "notice.auditOk": "Auditoría firmada verificada intacta.",
    "notice.auditFail": "La verificación falló: vea el panel del verificador.",
    "notice.singleKeyOn": "Atajos de una tecla activados.",
    "notice.singleKeyOff": "Atajos de una tecla apagados. Escape y Ctrl+Enter siguen funcionando.",
    "notice.shareCopied": "Enlace copiado al portapapeles.",
    "notice.shareFallback": "Copie este enlace: {url}",
    "notice.fileTooLarge": "El archivo tiene {size} bytes. El límite es {max} bytes.",
    "notice.fileUnreadable": "Ese archivo no se pudo leer.",
    "notice.auditCopied": "JSON de auditoría firmada copiado al portapapeles.",
    "notice.clipboardUnavailable": "Portapapeles no disponible; use Descargar JSON firmado.",
    "notice.auditDemoLoaded": "Exportación firmada actual cargada en el cuadro de verificación.",
    "notice.cascadeReset": "Laboratorio de cascada restablecido.",
    "notice.hashIgnored": "Enlace compartido: {n} valor(es) ilegible(s) se ignoraron.",
    "notice.languageSet": "Idioma cambiado a español.",
    "live.compare.same": "mismo flujo en ambas ciudades",
    "live.compare.diff": "las dos ciudades difieren",
    "live.compare": "{item}: {rel}. Riverside: {sl}. Houston: {hou}.",
    "live.single": "{item} en {city}: {badge}. Riesgo {risk} de 100, {tier}. Confianza {confidence}.",
    "live.idle": "Elija un artículo o código de barras para ver el veredicto de la ciudad.",
    "print.reportTitle": "Reporte de inspección de BinCheck",
    "print.guideTitle": "Guía de clasificación de BinCheck para cocina y garaje",
    "print.cityLine": "{city} ({operator})",
    "print.itemLine": "Artículo: {item}",
    "print.streamLine": "Flujo: {stream}",
    "print.badgeLine": "Distintivo: {badge}",
    "print.riskLine": "Riesgo de contaminación: {risk}/100 ({tier})",
    "print.prepLine": "Pasos de preparación:",
    "print.noteLine": "Nota: {note}",
    "print.mrfLine": "Modo de falla en el MRF: {mrf}",
    "print.sameLine": "Mismo flujo en ambas ciudades.",
    "print.diffLine": "Las dos ciudades enrutan este artículo de forma distinta.",
    "print.confidenceLine": "Base de evidencia: {basis}. Confianza: {confidence}.",
    "print.issuesLine": "Verificaciones:",
    "print.batchLine": "Lote: {rows} filas leídas, {evaluated} evaluadas, {errors} sin identificar, {divergent} divergentes.",
    "print.cartLine": "Carrito: {n} artículos, riesgo promedio {avg}, estado {status}.",
    "print.footer": "Demo de BinCheck. Verifique los artículos raros en los sitios de las ciudades.",
    "math.idle": "Matemática de código inactiva. Elija un código de resina o escriba un UPC de 12 dígitos.",
    "math.format": "Formato:",
    "math.payload": "Datos:",
    "math.check": "Verificación Mod-10:",
    "math.ean13": "EAN-13:",
    "math.expected": "Dígito verificador esperado:",
    "math.found": "Encontrado:",
    "gauge.label": "Riesgo de contaminación de la planta de clasificación",
    "gauge.score": "{score}/100, {tier}",
    "gauge.scaleLow": "0 Bajo",
    "gauge.scaleMod": "25 Moderado",
    "gauge.scaleHigh": "55 Alto",
    "gauge.scaleReject": "85+ Rechazo",
    "gauge.aria": "Puntaje de riesgo de contaminación de la planta de clasificación",
    "gauge.valuetext": "{score} de 100, nivel {tier}",
    "gauge.physics": "Física de la planta de clasificación:",
    "cites.officialSource": "Fuente oficial:",
    "cites.newTab": "(abre en una pestaña nueva)",
    "cites.verified": "Reglas verificadas {date}.",
    "cites.heading": "Traza de reglas municipales",
    "cites.fieldsNote": "Campos citados de {source}, captura verificada {date}.",
    "eval.polymerStamp": "Sello de polímero:",
    "eval.dropoffGuidance": "Guía local de depósito y ordenanza:",
    "eval.facility": "Instalación principal:",
    "eval.filmReturn": "Devolución de película plástica:",
    "eval.vs": "Riverside vs. Houston:",
    "eval.risk": "Riesgo de contaminación:",
    "eval.facilityShort": "Instalación:",
    "eval.flipAria": "Las dos ciudades dan veredictos distintos para este artículo",
    "eval.sideBySide": "Comparación municipal lado a lado: Riverside y Houston",
    "eval.rulesDiffer": "Las reglas difieren (delta de riesgo {n} pts)",
    "eval.keyOrdinance": "Comparación clave de ordenanzas:",
    "eval.sourcesLine": "Reglas verificadas {date}. Fuentes:",
    "eval.sourcesAnd": "y",
    "cart.emptyBadge": "Carrito vacío (0 artículos)",
    "cart.emptyMsg": "Use \"Agregar el artículo actual al carrito virtual\" para probar cómo un solo enredador o batería afecta un contenedor de reciclaje que está limpio.",
    "cart.cleanBadge": "Carga limpia de acera (riesgo promedio {n}/100)",
    "cart.prepBadge": "Necesita preparación (riesgo máximo {n}/100)",
    "cart.hazardBadge": "Alerta de carga contaminada ({n} artículos peligrosos o enredadores)",
    "cart.stream": "Flujo:",
    "cart.score": "Puntaje de contaminación:",
    "cart.remove": "Quitar",
    "cart.profileAria": "Perfil de riesgo de {n} artículos del carrito: promedio {avg}, máximo {max} de 100",
    "cart.avg": "Promedio {n}",
    "cart.rejectLine": "Línea de rechazo 85",
    "batch.kpiAria": "Totales del lote",
    "batch.cityAria": "Combinación de flujos de {name}",
    "bench.scopeBadge": "Calculado en esta pestaña",
    "bench.scopeText": "{base} casos anclados más {catalog} códigos de catálogo, {n} evaluaciones por ciudad. {unanchored} artículos del catálogo no tienen regla en la captura y no se califican. El puntaje mide concordancia con la captura de reglas verificada {date}, no la precisión en campo de una instalación real.",
    "bench.cartAria": "Métricas de enrutamiento del carrito de reciclaje",
    "bench.kpiAccuracyHint": "{ok} de {total} correctos",
    "bench.kpiPrecisionHint": "Enrutamiento al carrito que fue correcto",
    "bench.kpiRecallHint": "Artículos de carrito encontrados",
    "bench.kpiFpHint": "Errores de reciclaje ilusorio",
    "bench.kpiStreamHint": "{ok} de {total} flujos",
    "bench.matrixHeading": "Matriz de confusión de enrutamiento al carrito",
    "bench.streamHeading": "Matriz de confusión de flujos de eliminación",
    "bench.matrixCaption2": "Las filas son la verdad de referencia, las columnas la decisión del motor",
    "bench.streamCaption2": "Las filas son el flujo de referencia, las columnas el flujo del motor",
    "bench.truth": "Verdad de referencia",
    "bench.engineCart": "Motor: carrito",
    "bench.engineOther": "Motor: otro",
    "bench.truthCart": "Referencia: en acera",
    "bench.truthOther": "Referencia: no en acera",
    "bench.tierHeading": "Calibración de niveles de riesgo",
    "bench.tierCaption": "Evaluaciones por nivel de riesgo según el resultado de referencia",
    "bench.tierCol.tier": "Nivel",
    "bench.tierCol.evals": "Evaluaciones",
    "bench.tierCol.cart": "En acera",
    "bench.tierCol.notCart": "No en acera",
    "bench.tierCol.split": "División",
    "bench.tierHint": "Un nivel bien calibrado es todo en acera (Bajo, Moderado) o todo no en acera (Alto, Crítico).",
    "bench.tierAria": "nivel {tier}: {ok} en acera, {no} no en acera",
    "bench.gapHeading": "Extensiones de reglas inferidas: {closed} resueltas, {open} abiertas",
    "bench.gap.open": "Abierta",
    "bench.gap.handled": "Resuelta",
    "bench.gapRow": "{label} en {city}: se esperaba {expected}, el motor dice {actual}.",
    "bench.gapHint": "Estos casos extienden una regla municipal declarada a un artículo similar, por lo que son inferencias. Se califican por separado y nunca se cuentan en las cifras principales.",
    "bench.failHeading": "Fallas calificadas ({n})",
    "bench.failRow": "{id} en {city}, {field}: se esperaba {expected}, se obtuvo {actual}",
    "bench.pass": "Cada caso calificado coincidió con la verdad de referencia anclada en la captura.",
    "bench.barcodeHeading": "Integridad de códigos de barras",
    "bench.checkAcc": "Precisión del dígito verificador",
    "bench.transp": "Transposiciones detectadas",
    "bench.transpValue": "{n} de {total}",
    "bench.subs": "Sustituciones detectadas",
    "bench.gapNote2.ok": "Las {n} transposiciones no detectadas intercambian dígitos que difieren en 5, un punto ciego conocido de la verificación GS1 Modulo-10.",
    "bench.gapNote2.bad": "Algunas transposiciones no detectadas no se explican por la regla de la brecha de dígitos; investigue.",
    "bench.latencyHeading": "Latencia del motor",
    "bench.median": "Mediana",
    "bench.p95": "Percentil 95",
    "bench.slowest": "Más lento",
    "bench.evals": "{n} evaluaciones",
    "bench.latencyHint": "Medido en esta pestaña del navegador justo ahora, por eso varía según el dispositivo. Los temporizadores del navegador redondean a unos 0,1 ms. Nunca se escribe en las exportaciones.",
    "bench.measured": "Medido en vivo",
    "print.metaItem": "Artículo: {item}. Evidencia: {basis}, {confidence}. Reglas verificadas {date}.",
    "print.batchHeading": "Resumen de inspección por lotes",
    "print.batchSummary": "{rows} filas leídas, {evaluated} evaluadas, {errors} no identificadas, {divergent} donde las dos ciudades difieren.",
    "print.notEval": "No evaluado",
    "print.stream": "Flujo:",
    "print.risk": "Riesgo:",
    "print.facility": "Instalación:",
    "print.source": "Fuente:",
    "print.generated": "Generado localmente en el navegador. Confirme cualquier artículo dudoso con la fuente municipal oficial indicada arriba.",
    "os.both": "ambas ciudades"
  })
});

/** Interpolates `{name}` placeholders; falls back es -> en -> the key itself. */
export function t(lang, key, vars = {}) {
  const dict = UI_STRINGS[normalizeLang(lang)] || UI_STRINGS.en;
  let text = dict[key];
  if (text === undefined) text = UI_STRINGS.en[key];
  if (text === undefined) return String(key);
  return String(text).replace(/\{(\w+)\}/g, (m, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : m);
}

/* ---------------- label dictionaries ---------------- */

export const VERDICTS_ES = Object.freeze({
  RECYCLE_CART: Object.freeze({ word: "Reciclar", where: "carrito de reciclaje de la acera" }),
  TRASH_CART: Object.freeze({ word: "Basura", where: "carrito de basura" }),
  SPECIAL_DROPOFF: Object.freeze({ word: "Depósito", where: "llévelo a un sitio de depósito" }),
  GREEN_WASTE: Object.freeze({ word: "Residuos verdes", where: "recolección de residuos verdes de la ciudad" }),
  SPLIT_DISPOSAL: Object.freeze({ word: "Divídalo", where: "una parte se recicla, otra va a la basura" }),
  ORGANICS_CART: Object.freeze({ word: "Orgánicos", where: "carrito de orgánicos de la acera" })
});

export const STREAM_LABELS_ES = Object.freeze({
  RECYCLE_CART: "Carrito de reciclaje",
  SPLIT_DISPOSAL: "Disposición dividida",
  SPECIAL_DROPOFF: "Depósito especial",
  TRASH_CART: "Carrito de basura",
  GREEN_WASTE: "Residuos verdes",
  ORGANICS_CART: "Carrito de orgánicos"
});

export const WORKBENCH_STREAM_LABELS_ES = Object.freeze({
  RECYCLE_CART: "Carrito de reciclaje",
  ORGANICS_CART: "Carrito de orgánicos",
  GREEN_WASTE: "Recolección de residuos verdes",
  SPECIAL_DROPOFF: "Estación de depósito",
  SPLIT_DISPOSAL: "Disposición dividida",
  TRASH_CART: "Carrito de basura"
});

export const TIER_LABELS_ES = Object.freeze({
  LOW: "Bajo",
  MODERATE: "Moderado",
  HIGH: "Alto",
  CRITICAL: "Crítico"
});

export const CONFIDENCE_LABELS_ES = Object.freeze({
  HIGH: "Confianza alta",
  MEDIUM: "Confianza media",
  LOW: "Confianza baja"
});

export const LOAD_STATUS_LABELS_ES = Object.freeze({
  EMPTY_BATCH: "Sin artículos",
  CLEAN_CURBSIDE_LOAD: "Carga limpia de acera",
  NEEDS_SORTING_FIXES: "Necesita preparación",
  REJECTED_CONTAMINATED_LOAD: "Alerta de carga contaminada"
});

export const STATUS_LABELS_ES = Object.freeze({ OK: "OK", WARN: "Revise", ERROR: "Error" });

export const CITE_KIND_LABELS_ES = Object.freeze({
  verbatim: "Texto de la regla de la ciudad",
  interpretation: "Regla aplicada",
  inference: "Estimación del motor"
});

export const EVIDENCE_BASES_ES = Object.freeze({
  CATALOG_MATCH: Object.freeze({
    label: "Coincidencia de código de barras del catálogo demo",
    detail: "El código de barras pasó el dígito verificador GS1 y coincidió con uno de los productos del catálogo demo."
  }),
  USER_CATEGORY: Object.freeze({
    label: "Categoría elegida por usted",
    detail: "La regla proviene de la categoría de material que eligió. BinCheck no puede confirmar el artículo físico."
  }),
  RESIN_CODE: Object.freeze({
    label: "Solo código de resina SPI",
    detail: "Solo se dio un sello de resina, así que se usó el artículo predeterminado de ese polímero."
  }),
  FALLBACK_DEFAULT: Object.freeze({
    label: "Regla predeterminada, sin artículo identificado",
    detail: "No se proporcionó nada utilizable, así que se usó la regla predeterminada del motor (botella PET #1). No confíe en este resultado."
  })
});

export const CONDITION_LABELS_ES = Object.freeze({
  "clean": "Vacío, limpio y seco",
  "greasy": "Manchado de comida o grasa",
  "liquid-full": "Aún contiene líquido",
  "broken": "Roto o quebrado"
});

export const RESIN_ES = Object.freeze({
  1: Object.freeze({ polymer: "Tereftalato de polietileno", commonItems: "Botellas de agua, botellas de refresco, envases de aderezo de ensalada, frascos de crema de cacahuate" }),
  2: Object.freeze({ polymer: "Polietileno de alta densidad", commonItems: "Envases de leche, botellas de detergente de lavandería, botellas de shampoo, envases de cloro" }),
  3: Object.freeze({ polymer: "Cloruro de polivinilo", commonItems: "Tuberías de plomería, revestimiento de vinilo, empaques burbuja, envoltura transparente de comida" }),
  4: Object.freeze({ polymer: "Polietileno de baja densidad", commonItems: "Bolsas de supermercado, bolsas de pan, película de tintorería, botellas exprimibles" }),
  5: Object.freeze({ polymer: "Polipropileno", commonItems: "Recipientes de yogur, tinas de mantequilla/margarina, envases de comida para llevar, tapas de botellas" }),
  6: Object.freeze({ polymer: "Poliestireno (espuma expandida o rígida)", commonItems: "Envases de unicel para llevar, cartones de huevo de espuma, vasos de café desechables, cacahuetes de empaque" }),
  7: Object.freeze({ polymer: "Policarbonato, bioplástico PLA o laminado multicapa", commonItems: "Bolsas de jugo, bolsas de papitas, envases de 5 galones, vasos PLA compostables" })
});

export const CITY_ES = Object.freeze({
  "Riverside-tx": Object.freeze({
    name: "Ciudad de Riverside, TX",
    operator: "Republic Services (Residuos Sólidos y Reciclaje de Riverside)",
    dropOffName: "Centro de Reciclaje del Condado de county",
    dropOffHours: "Lun-Sáb 8:00 AM - 4:00 PM (residentes del Condado de county)",
    retailBagDropOff: "Contenedores de devolución de película plástica al frente de H-E-B, Kroger o Target (Riverside)",
    greenWasteBagRule: "Bolsas de césped de papel compostables, botes reutilizables o atados amarrados de menos de 4 pies y 40 lb"
  }),
  "houston-tx": Object.freeze({
    name: "Ciudad de Houston, TX",
    operator: "Departamento de Manejo de Residuos Sólidos de la Ciudad de Houston (SWMD)",
    dropOffName: "Depósito Vecinal de la Ciudad de Houston / Centro de Reciclaje Westpark",
    dropOffHours: "Mar-Dom 9:00 AM - 6:00 PM (Westpark Lun-Sáb 8:00 AM - 5:00 PM)",
    retailBagDropOff: "Quioscos de devolución de película plástica de H-E-B, Kroger o Walmart (Houston)",
    greenWasteBagRule: "Bolsas biodegradables compostables aprobadas por la ciudad (con el logo de la Ciudad de Houston) o atados de menos de 4 pies y 50 lb"
  })
});

export function cityNameFor(cityId, lang = "en") {
  if (normalizeLang(lang) === "es" && CITY_ES[cityId]) return CITY_ES[cityId].name;
  return SUPPORTED_CITIES[cityId] ? SUPPORTED_CITIES[cityId].name : String(cityId ?? "");
}

export function cityShortNameFor(cityId) {
  return SUPPORTED_CITIES[cityId] ? SUPPORTED_CITIES[cityId].shortName : String(cityId ?? "");
}

export function cityOperatorFor(cityId, lang = "en") {
  if (normalizeLang(lang) === "es" && CITY_ES[cityId]) return CITY_ES[cityId].operator;
  return SUPPORTED_CITIES[cityId] ? SUPPORTED_CITIES[cityId].operator : "";
}

/* ---------------- Spanish material mirror ----------------
 * Per material id: title, mrfFailureMode, divergenceSummary and per-city
 * badgeLabel / prepSteps / dropOffNote. Anything absent falls back to the
 * English engine string. */

export const MATERIALS_ES = Object.freeze({
  "resin-1-pet": Object.freeze({
    title: "Botella o envase de plástico PET #1, transparente o de color",
    mrfFailureMode: "El peso del líquido hace que los chorros de aire ópticos desvíen el PET #1 hacia el flujo de papel; vacíe siempre antes de tirar al contenedor.",
    divergenceSummary: "Riverside y Houston aceptan botellas PET #1 vacías en la acera, aunque SWMD de Houston recomienda mantener las botellas en 3D en lugar de aplanarlas para los separadores de tambor.",
    Riverside: Object.freeze({
      badgeLabel: "Recicle en el carrito de la acera",
      prepSteps: Object.freeze([
        "Vacíe todo el líquido y enjuague rápidamente (no necesita jabón).",
        "Deje la tapa de rosca puesta solo después de vaciar y aplastar ligeramente para sacar el aire.",
        "Colóquela suelta en el carrito de reciclaje de Riverside; nunca ponga los reciclables en bolsa."
      ]),
      dropOffNote: "Se acepta en el carrito de reciclaje común de la acera."
    }),
    houston: Object.freeze({
      badgeLabel: "Recicle en el carrito verde",
      prepSteps: Object.freeze([
        "Drene todo el líquido restante para que los clasificadores ópticos expulsen la botella correctamente.",
        "Enjuague los residuos y mantenga la pieza suelta dentro del carrito verde de reciclaje automatizado de Houston.",
        "No la aplaste por completo hasta dejarla plana en 2D, para que los separadores de tambor la reconozcan como envase."
      ]),
      dropOffNote: "Se acepta en el carrito verde de Houston y en todos los Depósitos Vecinales."
    })
  }),
  "resin-2-hdpe": Object.freeze({
    title: "Envase rígido HDPE #2 o botella de detergente",
    mrfFailureMode: "El residuo químico o de grasa de leche genera moho en las pacas de plástico y degrada la calidad de olor del pellet reciclado.",
    divergenceSummary: "Ambas ciudades aceptan envases limpios HDPE #2 de leche y detergente en la acera; ambas prohíben envases de aceite de motor o pesticidas en el carrito.",
    Riverside: Object.freeze({
      badgeLabel: "Recicle en el carrito de la acera",
      prepSteps: Object.freeze([
        "Vacíe por completo la leche, el detergente o el limpiador y enjuague con agua.",
        "Tire las bombas de spray con gatillo (que contienen resortes de metal) en la basura; las tapas de rosca pueden quedarse.",
        "Colóquelo suelto en el carrito de reciclaje de Riverside."
      ]),
      dropOffNote: "Se acepta en el carrito de Riverside."
    }),
    houston: Object.freeze({
      badgeLabel: "Recicle en el carrito verde",
      prepSteps: Object.freeze([
        "Enjuague el residuo de detergente o leche y deje escurrir.",
        "Retire las boquillas de spray con resorte metálico antes de poner el envase HDPE #2 en el carrito verde.",
        "Nunca ponga envases #2 de aceite de motor o pesticidas en el carrito de reciclaje."
      ]),
      dropOffNote: "Se acepta en el carrito verde de Houston y en el Centro de Reciclaje Westpark."
    })
  }),
  "resin-3-pvc": Object.freeze({
    title: "Empaque o tubería de vinilo PVC #3",
    mrfFailureMode: "El PVC libera gas de ácido clorhídrico a las temperaturas de fusión del PET (260 C) y arruina lotes completos de varias toneladas de resina PET #1.",
    divergenceSummary: "Ambas ciudades rechazan el PVC #3 en los carritos de reciclaje porque el cloro contamina la molienda de PET #1.",
    Riverside: Object.freeze({
      badgeLabel: "Solo al carrito de basura (no reciclar)",
      prepSteps: Object.freeze([
        "Revise el código del triángulo buscando #3 (PVC/V) y manténgalo fuera del carrito de reciclaje.",
        "Coloque empaques pequeños de PVC o artículos de vinilo en el carrito de basura común.",
        "Lleve los retazos grandes de tubería de PVC de construcción al depósito de materiales del Centro de Reciclaje del Condado de county."
      ]),
      dropOffNote: "Prohibido en el reciclaje de la acera; el PVC de construcción a granel va a la instalación del Condado de county."
    }),
    houston: Object.freeze({
      badgeLabel: "Solo al carrito negro de basura",
      prepSteps: Object.freeze([
        "Mantenga el PVC #3 fuera del carrito verde de Houston para evitar contaminar la fundición de PET.",
        "Coloque los empaques pequeños de vinilo en el carrito negro de basura.",
        "Lleve las tuberías de PVC de plomería a un Depósito Vecinal de Houston como basura pesada."
      ]),
      dropOffNote: "Prohibido en el reciclaje de la acera de Houston."
    })
  }),
  "resin-4-ldpe-film": Object.freeze({
    title: "Bolsa de plástico de supermercado / envoltura de película LDPE #4",
    mrfFailureMode: "Las bolsas y películas flexibles LDPE #4 se enrollan en los ejes giratorios de las cribas de estrellas del MRF y obligan a paradas de línea manuales y peligrosas en cada turno.",
    divergenceSummary: "Prohibición idéntica de alta prioridad en los carritos de Riverside y Houston: las bolsas de plástico son el enredador de ejes número uno del MRF y deben ir a los quioscos de devolución de las tiendas.",
    Riverside: Object.freeze({
      badgeLabel: "Solo devolución en tienda (nunca en el carrito)",
      prepSteps: Object.freeze([
        "Nunca ponga bolsas de plástico sueltas ni reciclables embolsados en su carrito de reciclaje de Riverside.",
        "Vacíe, limpie y seque las bolsas de supermercado, las bolsas de pan y el plástico de burbujas.",
        "Devuelva la película limpia y seca a los contenedores de devolución al frente de las tiendas H-E-B, Kroger o Target de Riverside, o tire la película sucia en la basura."
      ]),
      dropOffNote: "Devuelva la película #4 limpia y seca a los contenedores de tienda de H-E-B / Kroger en Riverside."
    }),
    houston: Object.freeze({
      badgeLabel: "Solo devolución de película en tienda",
      prepSteps: Object.freeze([
        "Mantenga todas las bolsas de plástico, el shrink wrap y la película fuera del carrito verde de Houston.",
        "Sacuda los recibos y las migas para que la película quede completamente limpia y seca.",
        "Lleve las bolsas limpias a los quioscos de recolección de H-E-B, Kroger o Walmart en Houston, o ponga las bolsas mojadas o sucias en el carrito negro de basura."
      ]),
      dropOffNote: "Devuelva la película limpia y seca a los quioscos de las tiendas; nunca la ponga en los carritos verdes de Houston."
    })
  }),
  "resin-5-pp": Object.freeze({
    title: "Recipiente o envase de comida para llevar de polipropileno #5",
    mrfFailureMode: "Los recipientes de yogur o comida con residuos introducen bacterias orgánicas y hacen que los clasificadores ópticos NIR lean mal las superficies oscuras o recubiertas.",
    divergenceSummary: "Riverside y Houston aceptan recipientes PP #5 limpios en la acera; las bandejas negras #5 siguen siendo propensas al rechazo óptico NIR.",
    Riverside: Object.freeze({
      badgeLabel: "Recicle en el carrito de la acera (limpio y seco)",
      prepSteps: Object.freeze([
        "Raspe y enjuague todo el residuo de yogur, dip o comida para llevar del recipiente PP #5.",
        "Retire las tapas de aluminio despegables y tírelas en la basura.",
        "Coloque los recipientes rígidos #5 limpios y sueltos en el carrito de reciclaje de Riverside."
      ]),
      dropOffNote: "Se acepta en el carrito de reciclaje común de Riverside cuando está limpio."
    }),
    houston: Object.freeze({
      badgeLabel: "Recicle en el carrito verde (limpio y seco)",
      prepSteps: Object.freeze([
        "Lave la grasa de comida y el residuo de lácteos de los envases de polipropileno #5.",
        "Tenga en cuenta que las bandejas negras #5 de comida para llevar a menudo no pueden ser leídas por los sensores ópticos NIR y conviene reutilizarlas o tirarlas.",
        "Coloque los recipientes #5 transparentes o de color claro sueltos en el carrito verde de Houston."
      ]),
      dropOffNote: "Se acepta en el carrito verde de Houston y en el depósito de Westpark."
    })
  }),
  "resin-6-ps-foam": Object.freeze({
    title: "Vaso o envase de poliestireno espumado #6 (Styrofoam)",
    mrfFailureMode: "El poliestireno expandido #6 se rompe en perlas de espuma con carga estática bajo la compactación, contaminando las pacas de papel y obstruyendo las boquillas de aire ópticas.",
    divergenceSummary: "Divergencia clave: el Centro de Reciclaje del Condado de county acepta espuma #6 limpia para residentes de Riverside y county, mientras que SWMD de Houston rechaza la espuma #6 tanto en los carritos como en los depósitos comunes.",
    Riverside: Object.freeze({
      badgeLabel: "Carrito de basura o depósito de county",
      prepSteps: Object.freeze([
        "Nunca ponga vasos de unicel, envases de comida para llevar ni cacahuetes de empaque en el carrito de Riverside.",
        "Lleve los bloques y empaques de espuma #6 limpios y embolsados al Centro de Reciclaje del Condado de county (1200 Blume Rd, Rosenberg) para su procesamiento en el densificador.",
        "Coloque los vasos y envases de espuma manchados de comida directamente en el carrito de basura."
      ]),
      dropOffNote: "La espuma #6 limpia se acepta en el Centro de Reciclaje del Condado de county; la espuma con residuos de comida va a la basura."
    }),
    houston: Object.freeze({
      badgeLabel: "Solo al carrito negro de basura",
      prepSteps: Object.freeze([
        "Mantenga todos los vasos de unicel #6, cartones de huevo y bloques de espuma fuera del carrito verde de Houston.",
        "Embale bien los cacahuetes de empaque de espuma antes de ponerlos en el carrito negro de basura para que no vuelen hacia los drenajes pluviales.",
        "Reutilice la espuma de envío limpia o consulte programas especiales de devolución por correo."
      ]),
      dropOffNote: "No se acepta en los carritos de Houston ni en los Depósitos Vecinales comunes."
    })
  }),
  "resin-7-other": Object.freeze({
    title: "Bolsa multicapa #7, bioplástico PLA o resina mixta",
    mrfFailureMode: "Los bioplásticos PLA (#7) y las bolsas de snacks multicapa no se funden de forma compatible con PET #1 ni HDPE #2 y arruinan la integridad estructural de la escama reciclada.",
    divergenceSummary: "Riverside y Houston rechazan las bolsas multicapa #7 y los bioplásticos PLA en el reciclaje municipal.",
    Riverside: Object.freeze({
      badgeLabel: "Solo al carrito de basura",
      prepSteps: Object.freeze([
        "No ponga bolsas #7, bolsas de papitas ni vasos de plástico PLA \"compostable\" en el carrito de reciclaje de Riverside.",
        "Deseche los empaques #7 en su carrito de basura común."
      ]),
      dropOffNote: "No se acepta en el reciclaje de la acera de Riverside."
    }),
    houston: Object.freeze({
      badgeLabel: "Solo al carrito negro de basura",
      prepSteps: Object.freeze([
        "Mantenga los artículos #7, las bolsas de jugo y los vasos de bioplástico fuera del carrito verde de Houston.",
        "Colóquelos en el carrito negro de basura residencial."
      ]),
      dropOffNote: "No se acepta en el reciclaje de la acera ni en los depósitos de Houston."
    })
  }),
  "glass-jar-bottle": Object.freeze({
    title: "Botella de vidrio para bebidas o frasco de comida limpio",
    mrfFailureMode: "Los frascos sin enjuagar atraen plagas, mientras que los fragmentos de vidrio roto se incrustan en las fibras de cartón húmedo y desgastan los rodamientos de las bandas del MRF.",
    divergenceSummary: "Riverside ha aceptado vidrio en su carrito de flujo único de Republic Services desde hace tiempo; Houston restableció el vidrio en la acera tras abrir el MRF de FCC Environmental y aún mantiene contenedores dedicados en Westpark y los Depósitos Vecinales para casco de mayor pureza.",
    Riverside: Object.freeze({
      badgeLabel: "Aceptado en el carrito de Riverside",
      prepSteps: Object.freeze([
        "Vacíe y enjuague los frascos de vidrio de pasta, botellas de condimentos y botellas de bebidas.",
        "Retire las tapas de metal y coloque tanto la tapa como el frasco de vidrio intacto sueltos en el carrito de reciclaje de Riverside.",
        "Las etiquetas de papel pueden quedarse en el vidrio."
      ]),
      dropOffNote: "Se acepta en el carrito de Riverside y en el Centro de Reciclaje del Condado de county."
    }),
    houston: Object.freeze({
      badgeLabel: "Carrito verde o Depósito Vecinal",
      prepSteps: Object.freeze([
        "Enjuague bien las botellas y frascos de vidrio y retire las tapas metálicas (recicle las tapas por separado).",
        "Coloque las botellas y los frascos intactos en su carrito verde de Houston (con separación de vidrio en el MRF de FCC Environmental) o llévelos directamente a Westpark o a los Depósitos Vecinales para una recuperación de casco de vidrio más limpia.",
        "Nunca incluya vasos de mesa, Pyrex, vidrio de ventana ni espejos."
      ]),
      dropOffNote: "Se acepta en el carrito verde de Houston (MRF de FCC) y en los contenedores de vidrio de Westpark y los 6 Depósitos Vecinales."
    })
  }),
  "broken-glass-ceramic": Object.freeze({
    title: "Vidrio roto, taza de cerámica, Pyrex o espejo",
    mrfFailureMode: "La cerámica y el vidrio borosilicato resistente al calor (Pyrex) tienen puntos de fusión más altos que el vidrio de envases, lo que causa inclusiones débiles tipo piedra y explosiones de botellas en los hornos de vidrio.",
    divergenceSummary: "Ambas jurisdicciones prohíben estrictamente vidrio roto, cerámica, Pyrex y espejos en el reciclaje.",
    Riverside: Object.freeze({
      badgeLabel: "Envuelva con cuidado y colóquelo en el carrito de basura",
      prepSteps: Object.freeze([
        "Nunca ponga vidrio roto, trastes de cerámica, Pyrex ni espejos en el carrito de reciclaje.",
        "Envuelva los fragmentos afilados en cartón grueso o periódico y péguelo con cinta para proteger a las cuadrillas de recolección.",
        "Coloque el paquete envuelto en el carrito de basura."
      ]),
      dropOffNote: "Prohibido en todos los flujos de reciclaje."
    }),
    houston: Object.freeze({
      badgeLabel: "Envuelva con cuidado y colóquelo en el carrito negro de basura",
      prepSteps: Object.freeze([
        "Mantenga el vidrio roto, la cerámica y los espejos fuera del carrito verde de Houston.",
        "Encaje o envuelva bien los fragmentos afilados y rotule \"Vidrio roto\" antes de colocarlos en el carrito negro de basura."
      ]),
      dropOffNote: "Prohibido en los carritos de Houston y en los contenedores de vidrio de los depósitos."
    })
  }),
  "aluminum-steel-can": Object.freeze({
    title: "Lata de bebida de aluminio o lata de acero para sopa, vacía",
    mrfFailureMode: "Los separadores de corrientes inducidas (para aluminio) y los imanes de banda cruzada (para acero) recuperan el metal con más del 95% de eficiencia si las latas están vacías y no están anidadas dentro de bolsas de plástico.",
    divergenceSummary: "Riverside y Houston tratan las latas limpias de aluminio y hojalata/acero como sus reciclables de acera de mayor valor y menor contaminación.",
    Riverside: Object.freeze({
      badgeLabel: "Reciclaje de alto valor en la acera",
      prepSteps: Object.freeze([
        "Vacíe todo el líquido o la comida de la lata de aluminio o acero y enjuáguela.",
        "Mantenga las latas de aluminio y las de acero separadas entre sí (no meta latas de aluminio dentro de latas de acero).",
        "Colóquelas sueltas en el carrito de reciclaje de Riverside."
      ]),
      dropOffNote: "Se acepta en el carrito de Riverside y en el Centro de Reciclaje del Condado de county."
    }),
    houston: Object.freeze({
      badgeLabel: "Reciclaje de alto valor en el carrito verde",
      prepSteps: Object.freeze([
        "Drene y enjuague por completo las latas de bebida o de comida.",
        "Empuje las tapas afiladas de las latas de acero dentro de la lata o retírelas limpiamente para que los clasificadores no se corten.",
        "Colóquelas sueltas en el carrito verde de Houston."
      ]),
      dropOffNote: "Se acepta en el carrito verde de Houston y en todos los Depósitos Vecinales."
    })
  }),
  "soiled-foil-tray": Object.freeze({
    title: "Papel de aluminio o charola de aluminio para hornear",
    mrfFailureMode: "Las hojas de aluminio con costra de queso o arrugadas planas contaminan las fibras de papel con grasa o viajan por las cribas de papel 2D en lugar de caer al imán de corrientes inducidas.",
    divergenceSummary: "Ambas ciudades exigen que el aluminio esté completamente libre de grasa de comida; hacer una bola de más de 2 pulgadas evita que las hojas planas viajen hacia el flujo de papel 2D.",
    Riverside: Object.freeze({
      badgeLabel: "Haga una bola de 2 pulgadas si está limpio / basura si tiene grasa",
      prepSteps: Object.freeze([
        "Si el aluminio tiene queso horneado, grasa de carne o salsa de lasaña, colóquelo en el carrito de basura.",
        "Si el papel de aluminio está limpio, forme una bola apretada en 3D de al menos 2 pulgadas de diámetro para que los separadores de corrientes inducidas puedan expulsarlo.",
        "Coloque las bolas de aluminio limpio o las charolas enjuagadas en el carrito de reciclaje de Riverside."
      ]),
      dropOffNote: "Las bolas de aluminio limpio de 2 pulgadas se aceptan en la acera; el aluminio con grasa va a la basura."
    }),
    houston: Object.freeze({
      badgeLabel: "Solo charolas limpias / el aluminio con grasa a la basura",
      prepSteps: Object.freeze([
        "Deseche el papel de aluminio con residuos de comida en el carrito negro de basura de Houston.",
        "Enjuague las charolas rígidas de aluminio para pay o asados hasta que queden completamente limpias antes de colocarlas en el carrito verde."
      ]),
      dropOffNote: "Las charolas limpias se aceptan; el aluminio sucio va a la basura."
    })
  }),
  "clean-cardboard-paper": Object.freeze({
    title: "Caja de cartón corrugado, sobre de envío o papel de oficina limpio",
    mrfFailureMode: "Los sobres con forro de burbujas y las almohadas de aire de plástico mezcladas dentro de cajas sin aplanar atascan las cribas de discos de cartón y contaminan las tinas de pulpa.",
    divergenceSummary: "Riverside y Houston aceptan cartón y papel limpio y aplanado en la acera; los sobres acolchados con plástico deben separarse.",
    Riverside: Object.freeze({
      badgeLabel: "Aplane y recicle en el carrito",
      prepSteps: Object.freeze([
        "Retire todas las almohadas de aire de plástico, el plástico de burbujas y los insertos de unicel de las cajas de envío.",
        "Desarme y aplane las cajas de cartón corrugado para que queden sueltas dentro del carrito de reciclaje de Riverside con la tapa cerrada.",
        "Mantenga el papel y el cartón secos."
      ]),
      dropOffNote: "Las cargas grandes de cartón aplanado también se aceptan en el Centro de Reciclaje del Condado de county."
    }),
    houston: Object.freeze({
      badgeLabel: "Aplane y recicle en el carrito verde",
      prepSteps: Object.freeze([
        "Retire la película plástica de empaque y los insertos de espuma.",
        "Aplane las cajas de cartón para evitar que se atasquen dentro del carrito verde automatizado de Houston.",
        "Lleve las cajas de mudanza sobrantes a Westpark o a cualquier Depósito Vecinal de Houston."
      ]),
      dropOffNote: "Se acepta en el carrito verde y en todos los Depósitos Vecinales de Houston."
    })
  }),
  "greasy-pizza-box": Object.freeze({
    title: "Caja de pizza corrugada manchada de grasa",
    mrfFailureMode: "El aceite hidrofóbico de la pizza y el queso derretido no se pueden lavar de las fibras de celulosa durante la pulpa en agua, lo que crea puntos débiles y agujeros en el cartón reciclado.",
    divergenceSummary: "Riverside y Houston recomiendan la regla de cortar y dividir: recicle la tapa limpia y tire la mitad inferior grasosa.",
    Riverside: Object.freeze({
      badgeLabel: "Corte la tapa para reciclar / la base grasosa a la basura",
      prepSteps: Object.freeze([
        "Retire todos los restos de masa, queso, papeles encerados y los trípodes plásticos que sostienen la pizza.",
        "Corte la tapa limpia de la caja de pizza y aplánela para el carrito de reciclaje de Riverside.",
        "Ponga la mitad inferior manchada de grasa de la caja en su carrito de basura común."
      ]),
      dropOffNote: "Las tapas limpias cortadas van al reciclaje de la acera; las bases grasosas van a la basura."
    }),
    houston: Object.freeze({
      badgeLabel: "Divida la caja: la tapa limpia al carrito verde, la base a la basura",
      prepSteps: Object.freeze([
        "Separe la tapa de cartón sin manchas y colóquela en el carrito verde de Houston.",
        "Coloque la base saturada de aceite y cualquier cartón con costra de queso en el carrito negro de basura."
      ]),
      dropOffNote: "Las tapas limpias se aceptan en el carrito verde; las bases grasosas van al carrito negro de basura."
    })
  }),
  "soiled-cardboard-paper": Object.freeze({
    title: "Cartón o papel saturado de grasa",
    mrfFailureMode: "El aceite hidrofóbico de la pizza y el queso derretido no se pueden lavar de las fibras de celulosa durante la pulpa en agua, lo que crea puntos débiles y agujeros en el cartón reciclado.",
    divergenceSummary: "Ambas ciudades aplican la regla de cortar y dividir a la fibra grasosa: recicle la parte limpia y tire la parte grasosa.",
    Riverside: Object.freeze({
      badgeLabel: "Recicle la parte limpia / la parte grasosa a la basura",
      prepSteps: Object.freeze([
        "Raspe los residuos de comida.",
        "Arranque cualquier cartón o papel limpio y seco y aplánelo para el carrito de reciclaje de Riverside.",
        "Ponga la parte saturada de grasa en su carrito de basura común."
      ]),
      dropOffNote: "Las tapas limpias cortadas van al reciclaje de la acera; las bases grasosas van a la basura."
    }),
    houston: Object.freeze({
      badgeLabel: "Divida: la parte limpia al carrito verde, la parte grasosa a la basura",
      prepSteps: Object.freeze([
        "Arranque cualquier cartón o papel limpio y seco para el carrito verde de Houston.",
        "Coloque la parte saturada de grasa en el carrito negro de basura."
      ]),
      dropOffNote: "Las tapas limpias se aceptan en el carrito verde; las bases grasosas van al carrito negro de basura."
    })
  }),
  "lithium-household-battery": Object.freeze({
    title: "Batería de iones de litio, recargable o doméstica",
    mrfFailureMode: "PELIGRO CRÍTICO DE INCENDIO: las cuchillas de compactación en los camiones de recolección y los empacadores del MRF perforan las celdas de iones de litio y causan incendios por fuga térmica que destruyen instalaciones de clasificación.",
    divergenceSummary: "Ambas ciudades clasifican las baterías como peligro crítico de incendio prohibido en los carritos: Riverside dirige a los residentes al Centro de Reciclaje del Condado de county (Rosenberg), mientras Houston los dirige a Westpark o a los depósitos BOPA del ESC del Norte.",
    Riverside: Object.freeze({
      badgeLabel: "Solo depósito de residuos peligrosos (riesgo de incendio)",
      prepSteps: Object.freeze([
        "NUNCA ponga baterías de iones de litio, recargables, de botón o AA/AAA ni en el carrito de reciclaje ni en el de basura.",
        "Aplique cinta transparente sobre el terminal positivo (+) de las baterías de litio y recargables para evitar cortocircuitos.",
        "Llévelas al depósito HHW del Centro de Reciclaje del Condado de county (1200 Blume Rd, Rosenberg) o a los quioscos minoristas Call2Recycle (Home Depot / Lowe's / Best Buy)."
      ]),
      dropOffNote: "Depósito obligatorio en el Centro de Reciclaje del Condado de county (1200 Blume Rd) o en contenedores Call2Recycle."
    }),
    houston: Object.freeze({
      badgeLabel: "Depósito BOPA / Centro de Servicios Ambientales",
      prepSteps: Object.freeze([
        "NUNCA ponga baterías en el carrito verde de Houston ni en el carrito negro de basura por el peligro de incendio en camiones y en el MRF.",
        "Cubra los terminales de las baterías con cinta transparente no conductora y guárdelas en un contenedor fresco y seco.",
        "Llévelas al Centro de Reciclaje Westpark de la Ciudad de Houston (5900 Westpark Dr), al Centro de Servicios Ambientales del Norte (11500 North Freeway) o a los eventos móviles de recolección BOPA participantes."
      ]),
      dropOffNote: "Depósito en el Centro de Reciclaje Westpark de Houston o en el ESC del Norte (programa BOPA)."
    })
  }),
  "electronics-ewaste": Object.freeze({
    title: "Electrónicos, cables, cordones de corriente o electrodomésticos pequeños",
    mrfFailureMode: "Los cordones de corriente se enrollan en las cribas de discos del MRF como cables de acero, mientras que los circuitos contienen soldadura de plomo, interruptores de mercurio y celdas de litio integradas.",
    divergenceSummary: "Ambas ciudades prohíben cables y residuos electrónicos en los carritos: Riverside usa el Centro de Reciclaje del Condado de county en Rosenberg, mientras Houston usa el Centro de Reciclaje Westpark.",
    Riverside: Object.freeze({
      badgeLabel: "Depósito de residuos electrónicos del Condado de county",
      prepSteps: Object.freeze([
        "No ponga electrónicos, cargadores, cables HDMI o de extensión ni tostadoras en el carrito de reciclaje de Riverside.",
        "Borre los datos personales de teléfonos o computadoras antes del depósito.",
        "Lleve los electrónicos y los cables al Centro de Reciclaje del Condado de county (1200 Blume Rd, Rosenberg) o a los quioscos de residuos electrónicos de Best Buy / Staples."
      ]),
      dropOffNote: "Se acepta en el Centro de Reciclaje del Condado de county (puede aplicar una cuota pequeña por artículo para monitores CRT/TV)."
    }),
    houston: Object.freeze({
      badgeLabel: "Residuos electrónicos en Westpark / Depósito Vecinal",
      prepSteps: Object.freeze([
        "Mantenga todos los cables, electrónicos y electrodomésticos pequeños fuera del carrito verde de Houston.",
        "Lleve computadoras, monitores, televisores y cables al Centro de Reciclaje Westpark (5900 Westpark Dr), a los eventos del socio CompuCycle o a los Depósitos Vecinales de Houston."
      ]),
      dropOffNote: "Se acepta gratis para residentes de Houston en el Centro de Reciclaje Westpark."
    })
  }),
  "yard-trimmings-brush": Object.freeze({
    title: "Recortes de jardín, hojas, pasto cortado y ramas",
    mrfFailureMode: "El pasto y las hojas húmedas vertidas en los carritos de flujo único cubren el papel y el cartón con humedad y savia ricas en nitrógeno y arruinan las pacas de fibra.",
    divergenceSummary: "Diferencia importante: Riverside acepta bolsas de papel kraft comunes o botes reutilizables (límite de 40 lb), mientras Houston exige estrictamente bolsas con el logo oficial biodegradable de la Ciudad de Houston (límite de 50 lb) y rechaza residuos de jardín en bolsas de plástico comunes.",
    Riverside: Object.freeze({
      badgeLabel: "Recolección semanal de residuos verdes de Riverside",
      prepSteps: Object.freeze([
        "Nunca ponga hojas, pasto cortado ni ramas dentro de su carrito de reciclaje de flujo único.",
        "Coloque los recortes de jardín en bolsas de papel compostables o en contenedores reutilizables (menos de 40 lb) en la acera en su día semanal programado de recolección de residuos verdes de Riverside.",
        "Amarre los atados de ramas con cordel natural, de menos de 4 pies de largo y 40 libras."
      ]),
      dropOffNote: "Se recolecta semanalmente en la acera con el programa de residuos verdes de Riverside o se deja en la instalación del Condado de county."
    }),
    houston: Object.freeze({
      badgeLabel: "Residuos de jardín de Houston (solo bolsas compostables con el logo de la ciudad)",
      prepSteps: Object.freeze([
        "Mantenga todo el pasto, las hojas y las ramas fuera del carrito verde de Houston.",
        "Embale los recortes de jardín SOLO en bolsas biodegradables compostables aprobadas por la ciudad con el logo oficial de la Ciudad de Houston (menos de 50 lb), colocadas a 3 pies de los carritos en su día programado de residuos de jardín.",
        "Haga atados de ramas pequeñas de menos de 4 pies de largo y 18 pulgadas de diámetro, o use la recolección de Residuos de Árboles de Meses Impares para ramas grandes."
      ]),
      dropOffNote: "Requiere bolsas biodegradables con el logo de la ciudad en la acera, o depósito en los Depósitos Vecinales de Houston."
    })
  }),
  "liquid-full-bottle": Object.freeze({
    title: "Botella plástica de bebida medio llena con líquido y tapa",
    mrfFailureMode: "Las botellas pesadas llenas de líquido exceden el umbral de masa de los chorros de clasificación de aire ópticos, caen al búnker de papel y empapan las pacas de cartón al ser aplastadas.",
    divergenceSummary: "Ambas ciudades rechazan las botellas con líquido porque el peso extra vence a los eyectores de aire ópticos y moja las pacas de papel.",
    Riverside: Object.freeze({
      badgeLabel: "Vacíe el líquido primero, luego recicle la botella",
      prepSteps: Object.freeze([
        "Destape y vierta el resto del agua, jugo, refresco u otro líquido de comida o bebida en el drenaje o en la tierra.",
        "Nunca vierta químicos, aceite de motor, pesticidas u otros líquidos no alimentarios en el drenaje ni en la tierra; siga la guía de residuos domésticos peligrosos de Riverside.",
        "Una vez completamente vacía, vuelva a poner la tapa y coloque la botella vacía suelta en el carrito de reciclaje de Riverside.",
        "Si no puede vaciar el líquido (por ejemplo, aceite o aderezo echado a perder), coloque la botella sellada en el carrito de basura."
      ]),
      dropOffNote: "Reciclable en la acera solo después de vaciar todo el líquido."
    }),
    houston: Object.freeze({
      badgeLabel: "Drene todo el líquido antes del carrito verde",
      prepSteps: Object.freeze([
        "Vacíe el líquido restante de comida o bebida antes de poner cualquier botella en el carrito verde automatizado de Houston.",
        "Nunca vierta químicos, aceite de motor, pesticidas u otros líquidos no alimentarios en el drenaje ni en la tierra; siga la guía de residuos domésticos peligrosos de Houston.",
        "Los clasificadores ópticos NIR del MRF de FCC Environmental de Houston no pueden expulsar por aire los envases pesados llenos de líquido.",
        "Coloque la botella vacía en el carrito verde."
      ]),
      dropOffNote: "Reciclable en el carrito verde de Houston solo después de vaciar el líquido."
    })
  })
});

/** Spanish titles for the demo barcode catalog, keyed by UPC. */
export const CATALOG_ES = Object.freeze({
  "041220576463": "Botella de Agua Natural de Manantial H-E-B (16.9 fl oz)",
  "012000001598": "Botella de Agua Purificada Aquafina (20 fl oz)",
  "049000028904": "Paquete de 12 Latas de Aluminio Coca-Cola Classic (12 fl oz)",
  "049000006346": "Lata de Aluminio Coca-Cola Classic (12 fl oz)",
  "078000082166": "Botella de Plástico Dr Pepper Original de 2 Litros",
  "072554000027": "Envase de Agua Natural de Manantial Ozarka (1 galón)",
  "041220948321": "Envase de Leche Entera Grado A H-E-B (1 galón)",
  "037000973072": "Botella de Detergente Líquido para Ropa Tide Original (92 fl oz)",
  "044600015996": "Envase de Cloro Desinfectante Clorox (81 fl oz)",
  "021131500269": "Botella de Vidrio de Agua Mineral Topo Chico (12 fl oz)",
  "041220794386": "Frasco de Vidrio de Salsa Asada H-E-B (16 oz)",
  "051000012517": "Lata de Acero de Sopa Condensada de Tomate Campbell's (10.75 oz)",
  "041220192847": "Lata de Acero de Frijoles Charros H-E-B (15 oz)",
  "818290012630": "Vaso Individual de Yogur Griego Sin Grasa Chobani (5.3 oz)",
  "041220831043": "Tina de Crema Agria H-E-B Creamy Creations (16 oz)",
  "071892102059": "Botella Exprimible de Ketchup Picante Whataburger (20 oz)",
  "071892300110": "Tina de Medio Galón de Vainilla Casera Blue Bell",
  "073287001060": "Vasos de Espuma para Bebidas Dart (Poliestireno #6)",
  "041220400126": "Bolsas de Plástico para Supermercado y Almacenaje H-E-B Texas Tough",
  "013700021107": "Bolsas de Basura con Cordón Hefty Ultra Strong",
  "010900001120": "Papel de Aluminio de Alto Rendimiento Reynolds Wrap (75 pies²)",
  "041333415017": "Paquete de Baterías AA / Litio Duracell Coppertop",
  "039800084118": "Baterías AA de Litio Energizer Ultimate (paquete de 4)",
  "072140001056": "Caja de Pizza Corrugada (tapa limpia, base manchada de grasa)",
  "041220660018": "Caja de Envío Kraft Corrugada (limpia y aplanada)",
  "028400589864": "Bolsa de Papitas Metalizada Multicapa Doritos / Lay's",
  "075925301129": "Bolsa de Jugo Multicapa con Forro de Aluminio Capri Sun",
  "041220311088": "Bolsas de Papel Kraft para Recortes de Jardín y Hojas (paquete de 5)"
});

/** Spanish product-search aliases per UPC, merged into the search index. */
export const CATALOG_SEARCH_ALIASES_ES = Object.freeze({
  "041220576463": "agua heb botella manantial pet",
  "012000001598": "agua aquafina botella",
  "049000028904": "coca cola latas refresco paquete",
  "049000006346": "coca cola lata refresco",
  "078000082166": "dr pepper refresco botella dos litros",
  "072554000027": "agua ozarka galon envase",
  "041220948321": "leche heb galon envase",
  "037000973072": "detergente tide ropa lavanderia botella",
  "044600015996": "cloro clorox blanqueador envase",
  "021131500269": "topo chico agua mineral vidrio botella",
  "041220794386": "salsa heb frasco vidrio",
  "051000012517": "sopa campbells lata tomate",
  "041220192847": "frijoles charros heb lata",
  "818290012630": "yogur chobani vaso griego",
  "041220831043": "crema agria heb tina",
  "071892102059": "ketchup whataburger botella exprimible catsup",
  "071892300110": "helado blue bell vainilla tina carton",
  "073287001060": "vasos unicel dart espuma poliestireno",
  "041220400126": "bolsas heb plastico supermercado",
  "013700021107": "bolsas basura hefty cordon",
  "010900001120": "papel aluminio reynolds rollo",
  "041333415017": "baterias duracell aa pilas",
  "039800084118": "baterias energizer litio aa pilas",
  "072140001056": "caja pizza digiorno grasosa carton",
  "041220660018": "caja envio carton kraft aplanada",
  "028400589864": "papitas doritos lays bolsa frituras",
  "075925301129": "capri sun jugo bolsa",
  "041220311088": "bolsas papel kraft jardin hojas"
});

/** Spanish material-search aliases, merged into the search index. */
export const MATERIAL_SEARCH_ALIASES_ES = Object.freeze({
  "resin-1-pet": "botella de plastico pet numero 1 transparente refresco agua envase",
  "resin-2-hdpe": "envase hdpe numero 2 leche detergente cloro shampoo galon",
  "resin-3-pvc": "pvc vinilo numero 3 tuberia empaque burbuja",
  "resin-4-ldpe-film": "bolsa de plastico supermercado pelicula ldpe numero 4 envoltura pan",
  "resin-5-pp": "recipiente polipropileno numero 5 yogur comida para llevar tapa",
  "resin-6-ps-foam": "unicel espuma poliestireno numero 6 vaso envase espuma cacahuetes",
  "resin-7-other": "numero 7 multicapa bolsa papitas jugo bioplastico pla compostable",
  "glass-jar-bottle": "frasco de vidrio botella vidrio salsa condimento limpio",
  "broken-glass-ceramic": "vidrio roto quebrado ceramica taza pyrex espejo plato",
  "aluminum-steel-can": "lata de aluminio acero refresco sopa atun hojalata vacia",
  "soiled-foil-tray": "papel de aluminio charola aluminio hornear grasoso sucio",
  "clean-cardboard-paper": "carton limpio caja corrugado papel oficina sobre envio aplanado",
  "greasy-pizza-box": "caja de pizza grasosa carton grasa domicilio",
  "soiled-cardboard-paper": "carton papel grasoso sucio manchado aceite",
  "lithium-household-battery": "bateria pila litio ion recargable aa aaa boton celular",
  "electronics-ewaste": "electronicos cables cordon cargador electrodomestico tostadora telefono computadora",
  "yard-trimmings-brush": "recortes jardin hojas pasto ramas jardineria cesped",
  "liquid-full-bottle": "botella medio llena liquido bebida con tapa agua jugo refresco"
});

/* ---------------- municipal workbench mirrors ---------------- */

export const PROFILE_ES = Object.freeze({
  "Riverside-tx": Object.freeze({ name: "Riverside, TX", shortName: "Riverside", summary: "Carrito de flujo único de Republic Services más el depósito del Condado de county (reglas de captura real)." }),
  "houston-tx": Object.freeze({ name: "Houston, TX", shortName: "Houston", summary: "Carrito verde de SWMD más Westpark y los Depósitos Vecinales (reglas de captura real)." }),
  "strict-single-stream": Object.freeze({ name: "Flujo Único Estricto", shortName: "Flujo Único Estricto", summary: "Distrito ilustrativo conservador de flujo único: botellas #1 #2 #5, vidrio, metales y fibra limpia en un solo carrito." }),
  "dual-stream-glass-out": Object.freeze({ name: "Doble Flujo, sin Vidrio", shortName: "Doble Flujo sin Vidrio", summary: "Distrito ilustrativo de doble flujo: papel y envases en carritos separados, vidrio solo en iglús de depósito." }),
  "organics-mandatory": Object.freeze({ name: "Orgánicos Obligatorios en la Acera", shortName: "Orgánicos Obligatorios", summary: "Distrito ilustrativo con carrito obligatorio de orgánicos en la acera para fibra con residuos de comida y residuos de jardín." }),
  "rural-transfer-station": Object.freeze({ name: "Estación Rural de Depósito / Transferencia", shortName: "Estación Rural de Transferencia", summary: "Distrito rural ilustrativo sin reciclaje en la acera; todo se clasifica en una bahía de la estación de transferencia." })
});

export const BASKETS_ES = Object.freeze({
  "tricky-household": Object.freeze({
    name: "Canasta hogareña difícil (14 artículos)",
    labels: Object.freeze({
      "resin-1-pet": "Botella de agua PET #1",
      "resin-2-hdpe": "Envase de leche HDPE #2",
      "resin-4-ldpe-film": "Bolsa de supermercado y envoltura de película",
      "resin-5-pp": "Recipiente de yogur PP #5",
      "resin-6-ps-foam": "Vaso de espuma #6 para llevar",
      "resin-7-other": "Bolsa metalizada de papitas (#7)",
      "glass-jar-bottle": "Frasco de vidrio de salsa",
      "aluminum-steel-can": "Lata de refresco y lata de sopa",
      "soiled-foil-tray": "Charola de aluminio grasosa",
      "clean-cardboard-paper": "Caja de envío aplanada",
      "greasy-pizza-box": "Caja de pizza a domicilio",
      "lithium-household-battery": "Batería de iones de litio",
      "yard-trimmings-brush": "Bolsa de pasto cortado",
      "liquid-full-bottle": "Botella de jugo medio llena"
    })
  }),
  "flexible-and-foam": Object.freeze({
    name: "Canasta de película, espuma y flexibles (6 artículos)",
    labels: Object.freeze({
      "resin-4-ldpe-film:0": "Paquete de película de supermercado",
      "resin-4-ldpe-film:1": "Película con residuos de comida",
      "resin-6-ps-foam:2": "Bloques de espuma de envío",
      "resin-6-ps-foam:3": "Envase de espuma manchado de comida",
      "resin-7-other:4": "Multipack de bolsas de snacks",
      "resin-7-other:5": "Cartón de helado recubierto"
    })
  }),
  "kitchen-week": Object.freeze({
    name: "Una semana de empaques de cocina (9 artículos)",
    labels: Object.freeze({
      "resin-1-pet": "Botellas de bebida (4)",
      "resin-2-hdpe": "Envases de leche y detergente (2)",
      "glass-jar-bottle": "Frascos de salsa (3)",
      "aluminum-steel-can": "Latas (8)",
      "clean-cardboard-paper:4": "Cajas de cereal y correo",
      "clean-cardboard-paper:5": "Servilletas y platos de papel grasosos",
      "greasy-pizza-box": "Caja de pizza del viernes",
      "soiled-foil-tray": "Charola de comida para llevar",
      "liquid-full-bottle": "Botella de aderezo medio llena"
    })
  }),
  "everything": Object.freeze({ name: "Cada categoría de material (17 artículos)" })
});

export const PRESETS_ES = Object.freeze({
  "diff-glass-out": Object.freeze({ label: "Vidrio adentro vs. vidrio afuera" }),
  "diff-organics": Object.freeze({ label: "Distrito de orgánicos obligatorios" }),
  "diff-rural": Object.freeze({ label: "Carrito de ciudad vs. estación rural de transferencia" }),
  "cascade-battery": Object.freeze({ label: "Una batería en el carrito" }),
  "cascade-tangler": Object.freeze({ label: "La película enrolla las cribas de estrellas" })
});

/** Spanish rule-note mirrors for the four illustrative archetypes. */
export const ARCHETYPE_NOTES_ES = Object.freeze({
  "strict-single-stream": Object.freeze({
    "resin-1-pet": "Se acepta en el carrito cuando está vacía y con la tapa puesta.",
    "resin-2-hdpe": "Se acepta en el carrito cuando está vacía y enjuagada.",
    "resin-3-pvc": "No se acepta; el PVC arruina la molienda de PET.",
    "resin-4-ldpe-film": "Las cribas de estrellas se enrollan; use contenedores de tienda.",
    "resin-5-pp": "Se acepta en el carrito cuando está limpio.",
    "resin-6-ps-foam": "La espuma se rompe en las cribas; solo en la basura.",
    "resin-7-other": "No se acepta en la acera.",
    "glass-jar-bottle": "Enjuague y quite las tapas; se acepta en el carrito.",
    "broken-glass-ceramic": "El vidrio roto es peligroso para las cuadrillas; envuélvalo y tírelo.",
    "aluminum-steel-can": "Alto valor; vacío y suelto en el carrito.",
    "soiled-foil-tray": "Solo charolas limpias; el aluminio con grasa es basura.",
    "clean-cardboard-paper": "Aplánelo; el cartón húmedo o con cera no se acepta.",
    "greasy-pizza-box": "Recicle la tapa limpia; la parte grasosa es basura.",
    "soiled-cardboard-paper": "La fibra saturada de grasa contamina la pulpa.",
    "lithium-household-battery": "Riesgo de incendio; los carritos provocan incendios en camiones y MRF.",
    "electronics-ewaste": "Los cables enrollan los ejes; los circuitos llevan plomo.",
    "yard-trimmings-brush": "Los orgánicos húmedos arruinan las pacas de fibra.",
    "liquid-full-bottle": "Vacíe primero; el líquido derrota a los clasificadores de aire."
  }),
  "dual-stream-glass-out": Object.freeze({
    "resin-1-pet": "El carrito de envases lo acepta vacío.",
    "resin-2-hdpe": "El carrito de envases lo acepta vacío.",
    "resin-3-pvc": "Ningún carrito lo acepta.",
    "resin-4-ldpe-film": "Solo contenedores de tienda.",
    "resin-5-pp": "El carrito de envases lo acepta limpio.",
    "resin-6-ps-foam": "Ningún carrito lo acepta.",
    "resin-7-other": "Ningún carrito lo acepta.",
    "glass-jar-bottle": "Solo iglú de depósito; el vidrio rompe las cribas de fibra.",
    "broken-glass-ceramic": "Envuélvalo y tírelo a la basura.",
    "aluminum-steel-can": "El carrito de envases lo acepta vacío.",
    "soiled-foil-tray": "Solo charolas limpias.",
    "clean-cardboard-paper": "El carrito de fibra lo acepta aplanado.",
    "greasy-pizza-box": "La tapa limpia al carrito de fibra; la parte grasosa a la basura.",
    "soiled-cardboard-paper": "La fibra con grasa degrada la pulpa del carrito de fibra.",
    "lithium-household-battery": "Solo depósito de residuos peligrosos.",
    "electronics-ewaste": "Bahía de residuos electrónicos de la estación de transferencia.",
    "yard-trimmings-brush": "Montón de residuos de jardín del depósito.",
    "liquid-full-bottle": "Vacíe antes de ponerla en el carrito de envases."
  }),
  "organics-mandatory": Object.freeze({
    "resin-1-pet": "Carrito de reciclaje, vacía.",
    "resin-2-hdpe": "Carrito de reciclaje, vacía.",
    "resin-3-pvc": "Basura.",
    "resin-4-ldpe-film": "Devolución de película en tienda.",
    "resin-5-pp": "Carrito de reciclaje, limpio.",
    "resin-6-ps-foam": "Basura.",
    "resin-7-other": "Basura.",
    "glass-jar-bottle": "Carrito de reciclaje, enjuagado.",
    "broken-glass-ceramic": "Basura envuelta.",
    "aluminum-steel-can": "Carrito de reciclaje, vacía.",
    "soiled-foil-tray": "Las charolas limpias se reciclan; el aluminio con grasa es basura.",
    "clean-cardboard-paper": "Carrito de reciclaje, aplanado.",
    "greasy-pizza-box": "La fibra con comida va al carrito de orgánicos.",
    "soiled-cardboard-paper": "La fibra grasosa va al carrito de orgánicos.",
    "lithium-household-battery": "Depósito HHW obligatorio.",
    "electronics-ewaste": "Depósito de residuos electrónicos.",
    "yard-trimmings-brush": "Carrito de orgánicos o depósito.",
    "liquid-full-bottle": "Vacíe el líquido primero."
  }),
  "rural-transfer-station": Object.freeze({
    "resin-1-pet": "Sin acera; clasifíquela en la bahía de envases de la estación.",
    "resin-2-hdpe": "Bahía de envases de la estación.",
    "resin-3-pvc": "Foso de basura de la estación.",
    "resin-4-ldpe-film": "Contenedor de película de la estación o basura.",
    "resin-5-pp": "Bahía de envases de la estación.",
    "resin-6-ps-foam": "Foso de basura de la estación.",
    "resin-7-other": "Foso de basura de la estación.",
    "glass-jar-bottle": "Iglú de vidrio de la estación.",
    "broken-glass-ceramic": "Foso de basura, envuelto.",
    "aluminum-steel-can": "Gaveta de metales de la estación.",
    "soiled-foil-tray": "Charolas limpias a la gaveta de metales.",
    "clean-cardboard-paper": "Empacadora de fibra de la estación.",
    "greasy-pizza-box": "La parte grasosa va al foso de basura.",
    "soiled-cardboard-paper": "La fibra grasosa va al foso de basura.",
    "lithium-household-battery": "Caseta de baterías de la estación.",
    "electronics-ewaste": "Jaula de residuos electrónicos de la estación.",
    "yard-trimmings-brush": "Montón de residuos verdes de la estación.",
    "liquid-full-bottle": "Vacíela, luego a la bahía de envases."
  })
});

/* ---------------- cascade lab mirrors ---------------- */

export const CASCADE_ES = Object.freeze({
  "film-tangler": Object.freeze({
    title: "Enredador de película en las cribas de estrellas",
    headline: "La película y las bolsas #4 se enrollan en los ejes de las cribas de estrellas y detienen la línea para corte manual.",
    alternative: "Devuelva la película limpia a los contenedores de tienda; nunca la ponga en el carrito.",
    stages: Object.freeze([
      Object.freeze({ name: "Recolección en la acera", detail: "La película suelta se escapa por la tapa del carrito y se pega a la tolva del camión." }),
      Object.freeze({ name: "Criba de estrellas del MRF", detail: "Las películas flexibles se enrollan en los ejes giratorios y bloquean los espacios entre discos que separan el material 2D del 3D." }),
      Object.freeze({ name: "Parada de línea", detail: "Los operadores paran la línea y cortan la película enredada a mano; los modelos del sector registran hasta 30-60 minutos por turno." }),
      Object.freeze({ name: "Contaminación de pacas", detail: "Los retazos de película se infestan en las pacas de papel y disparan reclamos de calidad de la fábrica." })
    ])
  }),
  "lithium-battery": Object.freeze({
    title: "Evento térmico de batería de litio",
    headline: "Una batería de iones de litio perforada puede iniciar un incendio por fuga térmica en el camión o en el piso del MRF.",
    alternative: "Llévela a un punto de depósito HHW o a un quiosco de baterías; nunca la ponga en ningún carrito.",
    stages: Object.freeze([
      Object.freeze({ name: "Compactación en el camión", detail: "Las cuchillas de compactación perforan la celda y la cortocircuitan." }),
      Object.freeze({ name: "Fuga térmica", detail: "La celda cortocircuitada se calienta en cascada; los vapores de electrolito inflamable se encienden cerca del papel y el plástico." }),
      Object.freeze({ name: "Respuesta de emergencia", detail: "La cuadrilla descarga la carga en la calle o pide ayuda a bomberos; los incendios en el MRF destruyen bandas y sensores." }),
      Object.freeze({ name: "Pérdida de material", detail: "Una sola batería puede quemar el valor de un camión completo de material reciclable." })
    ])
  }),
  "liquid-bottle": Object.freeze({
    title: "Carga de líquido en envases",
    headline: "Las botellas medio llenas pesan demasiado para los eyectores de aire ópticos y empapan las pacas de fibra.",
    alternative: "Vacíe los líquidos de comida o bebida antes de reciclar; jamás vierta químicos en el drenaje o en la tierra.",
    stages: Object.freeze([
      Object.freeze({ name: "Carga en el carrito", detail: "El líquido aumenta la masa del artículo y se vierte al compactarse." }),
      Object.freeze({ name: "Falla del clasificador óptico", detail: "Los eyectores de aire calibrados para envases vacíos no pueden empujar una botella pesada llena de líquido fuera de la banda." }),
      Object.freeze({ name: "Contaminación de fibra", detail: "El líquido derramado empapa el cartón y el papel, bajando el grado y el precio de la paca." }),
      Object.freeze({ name: "Peligro de resbalón", detail: "El líquido azucarado en el piso de clasificación crea superficies resbalosas para los operadores." })
    ])
  }),
  "greasy-fiber": Object.freeze({
    title: "Fibra saturada de grasa",
    headline: "El cartón saturado de grasa no se repulpa limpiamente; el aceite forma agujeros y puntos débiles en la hoja reciclada.",
    alternative: "Corte la tapa limpia para el carrito y tire la parte grasosa.",
    stages: Object.freeze([
      Object.freeze({ name: "Lectura errónea del residente", detail: "La caja completa entra al carrito porque 'el cartón se recicla'." }),
      Object.freeze({ name: "Falla en el repulpado", detail: "El aceite hidrofóbico no se mezcla con la pulpa en agua y forma agujeros y puntos débiles en la hoja nueva." }),
      Object.freeze({ name: "Rechazo de paca", detail: "Las fábricas rechazan pacas de fibra con manchas de grasa visibles; la carga completa pasa a basura." }),
      Object.freeze({ name: "Propagación de olor", detail: "La comida en descomposición atrae plagas a la instalación de almacenamiento." })
    ])
  }),
  "sharps-hazmat": Object.freeze({
    title: "Objetos punzantes y residuos peligrosos",
    headline: "Las agujas, cuchillas y químicos en el carrito lesionan a los clasificadores de línea y contaminan la instalación.",
    alternative: "Use el programa municipal de residuos peligrosos domésticos; nunca los carritos.",
    stages: Object.freeze([
      Object.freeze({ name: "Exposición en la acera", detail: "Las agujas sueltas perforan los guantes cuando la cuadrilla compacta el carrito." }),
      Object.freeze({ name: "Lesiones en la banda", detail: "Los clasificadores manuales agarran bolsas que esconden cuchillas o vidrio." }),
      Object.freeze({ name: "Contaminación química", detail: "Los químicos derramados dañan las bandas y exponen a la cuadrilla a vapores." }),
      Object.freeze({ name: "Costo de cierre", detail: "Los eventos de materiales peligrosos fuerzan paradas de línea y limpieza profesional." })
    ])
  })
});

/* ---------------- issue / error / audit message builders ---------------- */

const ISSUE_ES = Object.freeze({
  INVALID_CITY: (p) => `Jurisdicción desconocida "${p.value}". Use Riverside-tx o houston-tx.`,
  UNKNOWN_MATERIAL: (p) => `Material desconocido "${p.value}". Elija una de las ${p.count} categorías de materiales.`,
  INVALID_RESIN: () => "El código de resina debe ser un número entero del 1 al 7.",
  UNKNOWN_CONDITION: (p) => `Condición desconocida "${p.value}". Se trató como limpio.`,
  BARCODE_INVALID: (p) => barcodeReasonEs({ valid: false, reasonCode: p.reasonCode, reasonParams: p }),
  BARCODE_NOT_IN_CATALOG: () => "Código válido, pero no está en el catálogo demo. La regla usa la categoría seleccionada.",
  BARCODE_MATERIAL_CONFLICT: (p) => `El catálogo lista este código como ${p.catalog}, pero se seleccionó ${p.selected}. Se usa la categoría seleccionada.`,
  RESIN_MATERIAL_CONFLICT: (p) => `El código de resina ${p.resinCode} contradice ${p.materialId}, que tiene ${p.identifiedResin === null || p.identifiedResin === undefined ? "ningún código de resina plástica" : `el código de resina ${p.identifiedResin}`}. Se usa el material identificado.`,
  CONDITION_NOT_APPLICABLE: (p) => p.kind === "broken"
    ? "La condición de roto solo cambia la regla para el vidrio. Se ignoró para este material."
    : "La condición de líquido solo cambia la regla para botellas PET #1 y HDPE #2. Se ignoró para este material.",
  GREASY_PAPER_ADVISORY: () => "El papel saturado de grasa no puede repulparse, así que se aplica la regla municipal de la caja de pizza: recicle solo la parte limpia y tire la parte sucia. Aplicar esa regla más allá de las cajas de pizza es una inferencia.",
  NO_ITEM_IDENTIFIED: () => "No se proporcionó coincidencia de código, categoría o código de resina.",
  EMPTY_ROW: () => "La fila no tiene código de barras, material ni código de resina.",
  UNMAPPED_CONDITION: (p) => `El valor "${p.value}" en la columna ${p.column} parece una condición, pero esa columna no tiene un nombre reconocido, así que no se leyó y la condición real de la fila es desconocida. Nombre esa columna "condition" o mueva el valor a la columna de condición y ejecute de nuevo.`
});

export function issueMessageEs(issue) {
  if (!issue || typeof issue.code !== "string") return issue ? issue.message : "";
  const builder = ISSUE_ES[issue.code];
  if (!builder) return issue.message;
  const params = issue.params && typeof issue.params === "object" ? issue.params : {};
  if (issue.code === "NO_ITEM_IDENTIFIED" && params.kind === "batch") {
    return "El código de barras no está en el catálogo demo y no se dio material ni código de resina.";
  }
  return builder(params);
}

const PARSE_ERROR_ES = Object.freeze({
  EMPTY_INPUT: () => "El archivo está vacío. Pegue texto CSV o elija un archivo con filas.",
  TOO_LARGE: (p) => `El archivo tiene ${p.byteCount} bytes. El límite es ${p.maxBytes} bytes.`,
  BINARY_INPUT: (p) => p.count !== undefined
    ? `El archivo tiene ${p.count} bytes NUL (el primero en el byte ${p.firstNul}); eso es dato binario, no texto CSV.`
    : `Esto parece ${p.format}, no texto CSV. Reexporte los datos como archivo .csv simple o pegue las filas.`,
  BINARY_LIKE_INPUT: (p) => p.kind === "replacement"
    ? `La entrada tiene ${p.count} caracteres de reemplazo (U+FFFD), residuo de decodificar bytes que no eran texto UTF-8. Exporte un archivo .csv simple o pegue filas separadas por comas.`
    : p.kind === "control"
      ? `La entrada tiene ${p.count} caracteres de control no textuales. Parece un dato binario, no texto CSV. Exporte un archivo .csv simple o pegue filas separadas por comas.`
      : `La entrada tiene ${p.count} caracteres NUL. Eso es dato binario, no texto CSV. Exporte un archivo .csv simple o pegue filas separadas por comas.`,
  UNUSUAL_CHARACTERS: (p) => `Se encontraron ${p.count} caracteres de control o de reemplazo inusuales; las filas se leyeron igual.`,
  UTF32_INPUT: () => "El archivo es texto codificado UTF-32, que los navegadores no pueden decodificar. Guárdelo como CSV UTF-8 e inténtelo de nuevo.",
  INVALID_UTF16: (p) => `El archivo parece ${p.encoding} pero no se pudo decodificar (conteo de bytes impar o un par sustituto roto). Guárdelo como CSV UTF-8 e inténtelo de nuevo.`,
  INVALID_UTF8: (p) => `El byte ${p.offset} (${p.hex}) ${UTF8_DETAIL_ES[p.reason] || "es un byte UTF-8 no válido"}. El archivo no es texto UTF-8 válido; reexpórtelo como CSV.`,
  CSV_TRAILING_CHARS: (p) => `Caracteres ("${p.junk}") siguen a una comilla de cierre, así que la fila que empieza en la línea ${p.recordLine} no se pudo leer y se omitió.`,
  CSV_UNTERMINATED_QUOTE: () => "Un campo entrecomillado nunca se cerró. Se ignoró el resto del archivo.",
  AMBIGUOUS_COLUMN_MAPPING: (p) => p.variant === "quote"
    ? "La primera fila de datos tiene una comilla donde un campo entrecomillado no puede empezar, así que puede ser una fila de encabezado dañada. Adivinar posiciones podría etiquetar mal cada fila, así que no se evaluaron filas. Corrija esa fila o agregue una fila de encabezado e inténtelo de nuevo."
    : "La primera fila de datos no se pudo leer, así que es imposible saber si nombraba las columnas. Adivinar posiciones podría etiquetar mal cada fila, así que no se evaluaron filas. Corrija esa fila o agregue una fila de encabezado e inténtelo de nuevo.",
  UNKNOWN_COLUMN: (p) => `La columna "${p.column}" no se reconoce y se ignoró.`,
  DUPLICATE_COLUMN: (p) => `Los encabezados ${p.detail} mapean a la columna "${p.column}", así que un valor sobrescribiría silenciosamente al otro. Renombre o quite una columna e inténtelo de nuevo.`,
  ROW_LIMIT: (p) => `Solo se leyeron las primeras ${p.max} filas.`,
  EXTRA_CELLS: (p) => `La fila tiene ${p.count} celda(s) extra más allá de las ${p.columns} columnas conocidas; los datos extra se ignoraron.`,
  NO_DATA_ROWS: () => "No se encontraron filas de datos."
});

const UTF8_DETAIL_ES = Object.freeze({
  STRAY_CONTINUATION: "es un byte de continuación sin byte inicial antes",
  OVERLONG_ENCODING: "usa más bytes de los necesarios para codificar un carácter (forma larga, prohibida en UTF-8)",
  BAD_CONTINUATION: "aparece donde se requería un byte de continuación",
  TRUNCATED_SEQUENCE: "termina el archivo a la mitad de un carácter multibyte",
  SURROGATE_CODE_POINT: "codifica una mitad sustituta de UTF-16, que UTF-8 prohíbe",
  OUT_OF_RANGE: "codifica un punto de código por encima de U+10FFFF, el tope de Unicode",
  INVALID_LEAD_BYTE: "es un byte inicial no válido en UTF-8"
});

export function parseErrorMessageEs(entry) {
  if (!entry || typeof entry.code !== "string") return entry ? entry.message : "";
  const builder = PARSE_ERROR_ES[entry.code];
  if (!builder) return entry.message;
  return builder(entry.params && typeof entry.params === "object" ? entry.params : {});
}

/** Spanish barcode-check reason, mirroring validateBarcodeCheckDigit output. */
export function barcodeReasonEs(check) {
  const p = (check && check.reasonParams) || {};
  switch (check && check.reasonCode) {
    case "empty": return "La entrada del código de barras está vacía.";
    case "non_numeric": return "El código debe contener solo dígitos (0-9), espacios o guiones.";
    case "invalid_length": return `Se esperaban 8 (EAN-8), 12 (UPC-A) o 13 (EAN-13) dígitos; se recibieron ${p.count}.`;
    case "bad_check_digit": return `Dígito verificador ${p.format} inválido: se esperaba ${p.expected}, se encontró ${p.actual}.`;
    case "valid": return `Código ${p.format} válido (dígito verificador GS1 Modulo-10 ${p.actual} verificado).`;
    default: return check && check.reason ? String(check.reason) : "";
  }
}

/** Spanish verify-detail for verifySignedAudit results, keyed by result.code. */
export function auditDetailEs(result) {
  if (!result) return "";
  const code = result.code;
  const rows = result.report && result.report.basket ? result.report.basket.itemCount : 0;
  switch (code) {
    case "EMPTY": return t("es", "audit.detail.EMPTY");
    case "TOO_LARGE": return t("es", "audit.detail.TOO_LARGE");
    case "NOT_JSON": return t("es", "audit.detail.NOT_JSON");
    case "WRONG_SCHEMA": return t("es", "audit.detail.WRONG_SCHEMA");
    case "WRONG_SIGNATURE_FORMAT": return t("es", "audit.detail.WRONG_SIGNATURE_FORMAT");
    case "MALFORMED_DIGEST": return t("es", "audit.detail.MALFORMED_DIGEST");
    case "TAMPERED":
      return t("es", "audit.detail.TAMPERED", {
        expected: String(result.expectedDigest || "").slice(0, 16),
        actual: String(result.actualDigest || "").slice(0, 16)
      });
    case "VERIFIED": return t("es", "audit.detail.VERIFIED", { rows });
    default: return result.detail || "";
  }
}

/* ---------------- verdict / label getters ---------------- */

export function streamLabelEs(stream) {
  return STREAM_LABELS_ES[stream] || stream;
}

export function workbenchStreamLabelEs(stream) {
  return WORKBENCH_STREAM_LABELS_ES[stream] || stream;
}

export function tierLabelEs(tier) {
  return TIER_LABELS_ES[tier] || tier;
}

export function confidenceLabelEs(confidence) {
  return CONFIDENCE_LABELS_ES[confidence] || confidence;
}

export function loadStatusLabelEs(status) {
  return LOAD_STATUS_LABELS_ES[status] || status;
}

export function statusLabelEs(status) {
  return STATUS_LABELS_ES[status] || status;
}

export function citeKindLabelEs(kind) {
  return CITE_KIND_LABELS_ES[kind] || kind;
}

export function conditionLabelEs(condition) {
  return CONDITION_LABELS_ES[condition] || condition;
}

export function materialTitleEs(materialId) {
  const entry = MATERIALS_ES[materialId];
  return entry ? entry.title : materialId;
}

/** ES title for a batch row: catalog product name when a barcode matched. */
export function itemTitleEs(materialId, upc) {
  if (upc && CATALOG_ES[upc]) return CATALOG_ES[upc];
  return materialTitleEs(materialId);
}

/* ---------------- object localizers ---------------- */

const CITY_KEY = Object.freeze({ "Riverside-tx": "Riverside", "houston-tx": "houston" });

function localizedCityBlock(materialId, cityId) {
  const entry = MATERIALS_ES[materialId];
  const key = CITY_KEY[cityId];
  return entry && key && entry[key] ? entry[key] : null;
}

/**
 * Returns a display copy of an engine evaluation with every user-facing string
 * translated. Verbatim city-ordinance citation quotes stay English on purpose;
 * their kind chip reads "Texto de la regla de la ciudad".
 */
export function localizeEvaluation(evaluation, lang) {
  if (normalizeLang(lang) !== "es" || !evaluation || typeof evaluation !== "object") return evaluation;
  const materialId = evaluation.materialId;
  const es = MATERIALS_ES[materialId] || null;
  const block = localizedCityBlock(materialId, evaluation.city);
  const cityEs = CITY_ES[evaluation.city] || null;
  const out = { ...evaluation };
  if (cityEs) {
    out.cityName = cityEs.name;
    out.operator = cityEs.operator;
  }
  if (evaluation.matchedProduct && CATALOG_ES[evaluation.matchedProduct.upc]) {
    out.itemTitle = `${CATALOG_ES[evaluation.matchedProduct.upc]} (${evaluation.matchedProduct.brand})`;
  } else if (es) {
    out.itemTitle = es.title;
  }
  if (block) {
    out.badgeLabel = block.badgeLabel;
    if (Array.isArray(block.prepSteps)) out.prepSteps = [...block.prepSteps];
    if (block.dropOffNote) out.dropOffNote = block.dropOffNote;
  }
  if (es) {
    out.mrfFailureMode = es.mrfFailureMode;
    if (es.divergenceSummary) out.cityDivergenceNote = es.divergenceSummary;
  }
  if (evaluation.resinInfo && RESIN_ES[evaluation.resinInfo.code]) {
    out.resinInfo = { ...evaluation.resinInfo, ...RESIN_ES[evaluation.resinInfo.code] };
  }
  if (evaluation.dropOffFacility && cityEs) {
    out.dropOffFacility = {
      ...evaluation.dropOffFacility,
      name: cityEs.dropOffName,
      hours: cityEs.dropOffHours,
      retailBagDropOff: cityEs.retailBagDropOff,
      greenWasteBagRule: cityEs.greenWasteBagRule
    };
  }
  if (evaluation.barcodeValidation && evaluation.barcodeValidation.reasonCode) {
    out.barcodeValidation = { ...evaluation.barcodeValidation, reason: barcodeReasonEs(evaluation.barcodeValidation) };
  }
  if (Array.isArray(evaluation.ruleCitations)) {
    out.ruleCitations = evaluation.ruleCitations.map((cite) => {
      const tail = String(cite.ruleId || "").split(".").pop();
      const fieldEs = RULE_FIELD_LABELS_ES[tail];
      return {
        ...cite,
        label: fieldEs && cityEs ? `${cityEs.name}: ${fieldEs}` : cite.label
      };
    });
  }
  return out;
}

/** Rule-citation field labels keyed by the ruleId path tail the engine cites. */
export const RULE_FIELD_LABELS_ES = Object.freeze({
  curbsideCartRules: "reglas del carrito",
  acceptedResins: "códigos de resina aceptados",
  conditionalResins: "códigos de resina condicionales",
  rejectedResins: "códigos de resina rechazados",
  acceptsCleanGlassCurbside: "aceptación de vidrio limpio",
  glassNote: "regla del vidrio",
  plasticBagsAllowedInCart: "bolsas de plástico en el carrito",
  bagNote: "regla de bolsas y películas plásticas",
  greasyPizzaBoxRule: "regla de cajas de pizza grasosas",
  greenWasteProgram: "programa de residuos de jardín",
  accepts: "artículos aceptados en el centro de entrega"
});

export function localizeComparison(comparison, lang) {
  if (normalizeLang(lang) !== "es" || !comparison) return comparison;
  const itemId = comparison.materialId;
  const es = MATERIALS_ES[itemId] || null;
  return {
    ...comparison,
    itemTitle: comparison.matchedProduct && CATALOG_ES[comparison.matchedProduct.upc]
      ? `${CATALOG_ES[comparison.matchedProduct.upc]} (${comparison.matchedProduct.brand})`
      : (es ? es.title : comparison.itemTitle),
    Riverside: localizeEvaluation(comparison.Riverside, lang),
    houston: localizeEvaluation(comparison.houston, lang),
    divergenceSummary: es && es.divergenceSummary ? es.divergenceSummary : comparison.divergenceSummary
  };
}

export function localizeCartSummary(summary, lang) {
  if (normalizeLang(lang) !== "es" || !summary) return summary;
  return {
    ...summary,
    evaluations: (summary.evaluations || []).map((ev) => localizeEvaluation(ev, lang)),
    criticalHazards: (summary.criticalHazards || []).map((h) => {
      const es = MATERIALS_ES[h.materialId];
      return { ...h, itemTitle: es ? es.title : h.itemTitle, badgeLabel: h.badgeLabel };
    })
  };
}

export function localizeAssessment(assessment, lang) {
  if (normalizeLang(lang) !== "es" || !assessment) return assessment;
  const base = EVIDENCE_BASES_ES[assessment.basis];
  const reasonKeys = { CATALOG_MATCH: "confidence.reason.catalog", USER_CATEGORY: "confidence.reason.category", RESIN_CODE: "confidence.reason.resin", FALLBACK_DEFAULT: "confidence.reason.fallback" };
  return {
    ...assessment,
    basisLabel: base ? base.label : assessment.basisLabel,
    basisDetail: base ? base.detail : assessment.basisDetail,
    confidenceLabel: CONFIDENCE_LABELS_ES[assessment.confidence] || assessment.confidenceLabel,
    confidenceReason: reasonKeys[assessment.basis] ? t("es", reasonKeys[assessment.basis]) : assessment.confidenceReason,
    issues: (assessment.issues || []).map((issue) => ({ ...issue, message: issueMessageEs(issue) }))
  };
}

export function localizeImpact(impact, lang) {
  if (normalizeLang(lang) !== "es" || !impact) return impact;
  return { ...impact, itemTitle: materialTitleEs(impact.materialId) || impact.itemTitle };
}

export function localizeBatchResult(result, lang) {
  if (normalizeLang(lang) !== "es" || !result) return result;
  const localizeRow = (row) => {
    const materialId = row.materialId;
    const upc = row.engineInput && row.engineInput.barcode;
    const cities = row.cities
      ? Object.fromEntries(Object.entries(row.cities).map(([cityId, cell]) => {
          const block = localizedCityBlock(materialId, cityId);
          return [cityId, block ? { ...cell, badgeLabel: block.badgeLabel } : cell];
        }))
      : row.cities;
    return {
      ...row,
      itemTitle: row.status === "ERROR" || !materialId ? row.itemTitle : itemTitleEs(materialId, upc),
      cities,
      issues: (row.issues || []).map((issue) => ({ ...issue, message: issueMessageEs(issue) }))
    };
  };
  return {
    ...result,
    parse: result.parse
      ? { ...result.parse, errors: (result.parse.errors || []).map((e) => ({ ...e, message: parseErrorMessageEs(e) })) }
      : result.parse,
    rows: (result.rows || []).map(localizeRow)
  };
}

/* ---------------- workbench localizers ---------------- */

export function profileNameEs(profileId, field) {
  const entry = PROFILE_ES[profileId];
  return entry ? entry[field] : profileId;
}

export function basketLabelEs(basketId, materialId, index, fallback) {
  const basket = BASKETS_ES[basketId];
  if (!basket) return fallback;
  if (basketId === "everything") return materialTitleEs(materialId);
  if (!basket.labels) return fallback;
  return basket.labels[`${materialId}:${index}`] ?? basket.labels[materialId] ?? fallback;
}

export function localizeDiff(diff, lang) {
  if (normalizeLang(lang) !== "es" || !diff) return diff;
  const nameFor = (side) => ({
    ...side,
    profileName: profileNameEs(side.profileId, "name"),
    shortName: profileNameEs(side.profileId, "shortName"),
    basketName: BASKETS_ES[side.basketId] ? BASKETS_ES[side.basketId].name : side.basketName,
    profileSummary: PROFILE_ES[side.profileId] ? PROFILE_ES[side.profileId].summary : side.profileSummary
  });
  const rows = (diff.rows || []).map((row) => ({
    ...row,
    label: basketLabelEs(diff.basketId, row.materialId, row.index ?? 0, row.label),
    a: localizeDiffCell(row.a, diff, "a"),
    b: localizeDiffCell(row.b, diff, "b")
  }));
  const conflicts = (diff.conflicts || []).map((c) => ({
    ...c,
    itemLabel: basketLabelEs(diff.basketId, c.materialId, c.index ?? 0, c.itemLabel),
    message: conflictMessageEs(c)
  }));
  return {
    ...diff,
    a: nameFor(diff.a),
    b: nameFor(diff.b),
    basketName: BASKETS_ES[diff.basketId] ? BASKETS_ES[diff.basketId].name : diff.basketName,
    rows,
    conflicts
  };
}

function localizeDiffCell(cell, diff, side) {
  if (!cell) return cell;
  const profileId = diff && diff[side] ? diff[side].profileId : null;
  const es = MATERIALS_ES[cell.materialId] || null;
  const block = localizedCityBlock(cell.materialId, profileId);
  const out = { ...cell };
  if (block) {
    out.badgeLabel = block.badgeLabel;
    out.note = block.dropOffNote;
  } else if (profileId && ARCHETYPE_NOTES_ES[profileId] && ARCHETYPE_NOTES_ES[profileId][cell.materialId]) {
    out.badgeLabel = `${workbenchStreamLabelEs(cell.stream)} (${profileNameEs(profileId, "shortName")})`;
    out.note = ARCHETYPE_NOTES_ES[profileId][cell.materialId];
  } else if (es) {
    out.badgeLabel = workbenchStreamLabelEs(cell.stream);
  }
  return out;
}

const CONFLICT_KINDS_ES = Object.freeze({
  ACCEPTED_TO_CONTAMINANT: "Conflicto de regla",
  CURBSIDE_TO_DROPOFF: "De carrito a depósito",
  DIVERSION_LOST: "Desvío perdido",
  DIVERSION_GAINED: "Desvío ganado",
  STREAM_CHANGE: "Cambio de flujo"
});

export function conflictKindEs(kind) {
  return CONFLICT_KINDS_ES[kind] || kind;
}

export function conflictMessageEs(conflict) {
  const item = conflict.itemLabel || "";
  const from = profileNameEs(conflict.fromProfile, "shortName");
  const to = profileNameEs(conflict.toProfile, "shortName");
  const fromStream = workbenchStreamLabelEs(conflict.fromStream);
  const toStream = workbenchStreamLabelEs(conflict.toStream);
  switch (conflict.kind) {
    case "ACCEPTED_TO_CONTAMINANT":
      return `${item}: ${from} lo acepta en la acera pero ${to} lo manda al relleno. Si se pone en el carrito de ${to} se vuelve contaminante (riesgo ${conflict.toRisk}/100).`;
    case "CURBSIDE_TO_DROPOFF":
      return `${item}: ${from} lo acepta en el carrito pero ${to} requiere un viaje al depósito. Si se pone en el carrito contamina la carga (riesgo ${conflict.toRisk}/100).`;
    case "DIVERSION_LOST":
      return `${item}: se desvía en ${from} (${fromStream}) pero va al relleno en ${to}.`;
    case "DIVERSION_GAINED":
      return `${item}: va al relleno en ${from} pero se desvía en ${to} (${toStream}).`;
    case "STREAM_CHANGE":
      return `${item}: ${fromStream} en ${from}, ${toStream} en ${to}.`;
    default:
      return conflict.message || "";
  }
}

export function localizeCascadeLab(lab, lang) {
  if (normalizeLang(lang) !== "es" || !lab) return lab;
  return {
    ...lab,
    results: (lab.results || []).map((r) => {
      const es = CASCADE_ES[r.scenarioId];
      if (!es) return r;
      return {
        ...r,
        title: es.title,
        headline: es.headline,
        alternative: es.alternative,
        stages: (r.stages || []).map((s, i) => ({
          ...s,
          name: es.stages[i] ? es.stages[i].name : s.name,
          detail: es.stages[i] ? es.stages[i].detail : s.detail
        }))
      };
    }),
    itemTitle: materialTitleEs(lab.materialId) || lab.itemTitle
  };
}

export function presetLabelEs(presetId, fallback) {
  const entry = PRESETS_ES[presetId];
  return entry ? entry.label : fallback;
}
