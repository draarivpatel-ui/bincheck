# BinCheck

Riverside and Houston recycling rules engine with GS1 barcode checks, batch CSV inspection, and a calibration benchmark anchored to the cities' own published rules.

**Live web app:** [https://aariv.me/bincheck/](https://aariv.me/bincheck/)

I built BinCheck because sorting recycling at home in Riverside is way more confusing than the little triangle stamp on the bottom of a plastic cup makes it look. A few miles down US-59, the rules change between the City of Riverside (Republic Services curbside carts and the county County Recycling Center on Blume Rd in Rosenberg) and the City of Houston (Solid Waste Management Department green carts and the Westpark Consumer Recycling Center).

When people guess and toss questionable items into their curbside cart ("wish-cycling"), it causes real physical problems at the Material Recovery Facility (MRF):

1. **Plastic grocery bags (`#4 LDPE` film) jam the sorting shafts.** Flexible bags wrap around the spinning star-screen shafts that separate flat cardboard from 3D bottles. Both Riverside and Houston ban plastic bags from curbside carts and tell residents to bring clean, dry film back to store drop-off bins.
2. **Riverside and Houston do not accept the same items.** Clean `#6 Polystyrene` blocks can be dropped off at the county County Recycling Center (`1200 Blume Rd, Rosenberg, TX 77471`), while Houston SWMD puts `#6` foam in the black garbage cart. Yard trimmings differ too: Riverside takes kraft paper lawn bags up to 40 lbs, while Houston requires bags printed with the City of Houston logo (up to 50 lbs).
3. **Half-full bottles and lithium batteries break the line.** Near-infrared sorters fire a puff of air to pop a `#1 PET` or `#2 HDPE` bottle over a divider wall. A bottle still half full of liquid is too heavy for the jet. A crushed lithium-ion battery can start a truck or facility fire.

## What BinCheck does

- **Instant search.** Type any word (`glass`, `pizza`, `battery`, `Topo Chico`) and BinCheck searches the 28 demo catalog products and 17 material categories as you type. Every hit shows the verdict for both cities, and items the two cities treat differently are marked. Arrow keys and Enter work from the search box.
- **Three-click walkthrough.** A guided rail runs the three signature moments with one tap each: a #6 foam cup flipping verdicts across the city line (drop-off in Riverside, trash cart in Houston), one lithium battery inside 30 clean bottles in the contamination calculator, and a synthetic nine-row household CSV audit with the cart-eligible share per city.
- **One-word verdicts.** Every answer leads with a large color-coded verdict and icon: **Recycle**, **Trash**, **Drop-off**, **Yard waste** (the cities' green waste collection) or **Split it** (part recycles, part goes in the trash). The same color and icon follow the verdict into search results and the side-by-side city view. When the cities disagree, a flip banner spells it out: same item, different verdict.
- **Municipal rule trace.** Every verdict lists the exact snapshot fields it came from (for example `curbsideCartRules.rejectedResins` or `dropOffCenter.accepts`), quoted from `data/municipal-rules-2026.json`. Each citation is marked verbatim (the city's own words), applied rule (a snapshot field value read conservatively), or engine estimate (no snapshot field names the item, so the material class decides).
- **Contamination calculator.** Two sliders put up to 5 copies of the current item into a cart of up to 40 clean #1 PET bottles. The engine scores that exact cart and shows the load status, the average and worst-item risk against the 25, 55 and 85 thresholds, and a grid of every item. It makes one engine rule visible: load status follows the worst item, so one lithium battery among 30 clean bottles still gives a contaminated-load alert even though the average risk is only 13 out of 100.
- **Item inspector.** Look an item up by barcode, SPI resin code (`#1` to `#7`), or material category, then set its condition (clean, greasy, still holding liquid, broken). The result shows the disposal stream, a 0 to 100 contamination risk gauge with the tier thresholds drawn on it, household prep steps, the drop-off facility, and the official city source.
- **Evidence ladder.** Every result says how the item was identified (catalog barcode, a category you picked, a resin code only, or a default rule) and drops confidence to low when inputs contradict each other or a barcode fails its check digit. Confidence describes the identification, not the odds that a city rule is right.
- **Side-by-side comparison.** One switch shows both cities at once, with a risk delta when they disagree.
- **Virtual cart.** Add items to a cart and watch the load status change. A live SVG chart draws one bar per item against the same 25, 55 and 85 thresholds the load status uses, plus the cart average.
- **Batch CSV inspection.** Paste or upload up to 500 rows (256 KB). Each row is checked against both cities, and each city summary reports the cart-eligible share (count and percent) plus how many items must stay out of the cart. Rows BinCheck cannot identify are listed as errors and never guessed, rows wider than the column set are flagged instead of silently truncated, and the bundled sample is labeled as an illustrative synthetic dataset. Results export as CSV (CRLF, fixed column order, spreadsheet formula cells neutralized) or JSON, and both exports are byte-identical across runs.
- **Calibration benchmark.** Grades the engine in the browser tab or from the command line (see below).
- **Municipal ruleset diff and comparator.** The same basket of tricky household items is sorted under six MRF program profiles: the two snapshot cities plus four clearly labeled illustrative archetypes (strict single-stream, dual-stream glass-out, organics-mandatory, and a rural transfer station with no carts). The table reports per-item routing, rule-conflict alerts in both directions, diversion and curbside-only rates, the naive-cart contamination share, trash deltas, and lifecycle CO2e deltas from disclosed EPA WARM-style planning factors.
- **Wish-cycling and MRF hazard cascade lab.** Five deterministic stage tables model documented facility failure modes: film wrapping star-screen shafts, lithium-ion compaction ignition, liquid degrading paper bales, grease degrading fiber bales, and sharps reaching sorters. Sliders feed 0 to 10 contaminated items in; severity, modeled downtime and bale yield can only move in one direction. All figures are labeled as illustrative planning values, not facility measurements, and each scenario ends with the safe-disposal alternative.
- **Signed diversion audit export.** One click produces a signed JSON, CSV, or Markdown audit of the current basket under the chosen profiles, tagged with HMAC-SHA-256 over a canonical payload. A replay panel verifies any pasted export and flags tampered bytes. The bundled key makes this a self-check integrity tag, not a third-party certificate, and the page says so.
- **In-page self-tests.** A "Run Self-Tests" panel executes the same 28-check registry the Node suite runs: FIPS SHA-256 known-answer vectors, the batteries-never-curbside safety invariant across all six profiles, diff determinism, diversion-rate bounds, cascade monotonicity, CSV escaping, tamper detection and share-hash round trips.
- **Works offline.** No web fonts, CDN scripts or trackers. The page uses system fonts, and its Content-Security-Policy allows scripts only from its own origin.
- **Share links, shortcuts and print.** The address bar always holds a validated share link, including the workbench profile pair, basket, cascade counts and presets (`#bin=diff-glass-out`). Keyboard shortcuts cover every main action (`?` lists them). A print stylesheet produces a one-page kitchen guide or an inspection report.

### Data provenance

| Data | Where it comes from | How the page labels it |
| --- | --- | --- |
| City rules | `data/municipal-rules-2026.json`, a snapshot of the Riverside and Houston solid waste pages, last checked 2026-10-20 | "Rules 2026-10-20" in the header, the official source link under every result, and a quoted field-level citation inside every verdict |
| Barcode catalog | 28 Texas-shelf product types with GS1-valid check digits | "Demo data" badge. The product-to-code pairings are illustrative and were not scanned from store shelves |
| Sample CSV | Nine fixed rows bundled for the one-click audit | Labeled in the panel and button copy as an illustrative synthetic dataset, not real household records |
| Benchmark and cart numbers | Computed by running the engine in the tab | "Computed in this tab" badge |
| Latency | Measured live with the browser timer | "Measured live" badge, and readings under the browser's 0.1 ms timer resolution are shown as "under 0.1 ms" |
| Archetype profiles | Four illustrative MRF program models (strict single-stream, dual-stream glass-out, organics-mandatory, rural transfer station) written as plain data rule tables | Labeled "archetype" in the profile picker and in the page summary; they carry no city source link |
| CO2e planning factors | EPA WARM-style avoided-emission factors per material, with a "BinCheck estimate" basis where WARM has no matching row | Each factor's basis is disclosed in the exported audit payload |
| Cascade downtime and yield | Fixed illustrative stage tables, one per contaminant | The panel states the figures are planning values, not facility measurements |
| Audit signature | HMAC-SHA-256 over canonical JSON using a key bundled with the app | Labeled a self-check integrity tag, not a third-party certificate |

## Calibration benchmark

`node scripts/run-benchmark.js` first confirms that every ground-truth anchor still holds in the rules snapshot, so the benchmark cannot drift into grading the engine against itself. It then grades the engine. Results from the current code:

| Metric | Result |
| --- | --- |
| Scored cases | 35 (13 anchored cases plus 22 catalog barcodes), 69 city evaluations |
| Curbside cart routing | TP 32, FP 0, FN 0, TN 37 (accuracy, precision and recall 100.0%) |
| Disposal stream accuracy | 58 of 58 |
| Risk tier separation | Low 26 and Moderate 6 all curbside; High 16 and Critical 21 all not curbside |
| Barcode check digit | 32 valid and 32 corrupted codes all classified correctly |
| Adjacent transpositions caught | 226 of 245 (92.2%); every miss swaps two digits that differ by 5, a known blind spot of GS1 Modulo-10 |
| Single-digit substitutions caught | 3,024 of 3,024 |
| Inferred rule extensions | 2 handled, 0 open (scored separately) |

**Scope.** These numbers measure agreement with the bundled rules snapshot. They are not field accuracy at a real facility, and no household testing has been done.

**The inferred extension.** Both cities publish a tear-and-split rule for grease-soaked pizza boxes. BinCheck applies that rule to other grease-soaked cardboard and paper. Because that goes one step past what the cities wrote, those cases are labeled as inferences and kept out of the headline numbers.

## Repository layout

```text
bincheck/
|-- index.html                    Web app and printable guide
|-- styles.css                    Design tokens, components, print and reduced-motion rules
|-- sw.js                         Offline shell with network-first assets and cache fallback
|-- DESIGN.md                     Design system notes
|-- src/
|   |-- app.js                    UI controller (DOM injected, so it runs under test)
|   |-- state.js                  Pure reducer, view model and keyboard shortcut map
|   |-- render.js                 HTML and SVG renderers (all text escaped)
|   |-- workbench-render.js       Diff table, cascade lab, audit and self-test renderers
|   |-- insights.js               Verdicts, instant search, contamination calculator
|   `-- bincheck-engine.js        ES module entry point
|-- js/
|   |-- bincheck-engine.js        Rules engine, GS1 check-digit math, catalog
|   |-- bincheck-validate.js      Query normalization, evidence ladder, share links
|   |-- bincheck-batch.js         CSV parser, batch inspection, CSV and JSON export
|   |-- bincheck-benchmark.js     Benchmark runner and reports
|   |-- bincheck-report.js        Single-item inspection report exports
|   |-- bincheck-municipal.js     Six MRF profiles, baskets, diff engine, CO2e factors
|   |-- bincheck-cascade.js       Five hazard cascade stage tables
|   |-- bincheck-audit.js         Signed audit export and replay verifier
|   |-- bincheck-sha256.js        Pure-JS SHA-256 and HMAC (FIPS 180-4)
|   |-- bincheck-selftest.js      Shared in-page and Node self-test registry
|   `-- ground-truth.js           Snapshot-anchored ground truth cases
|-- data/
|   |-- municipal-rules-2026.json  Canonical rules snapshot
|   `-- municipal-rules-2026.js    ES module mirror of the snapshot (parity-tested)
|-- scripts/
|   |-- run-benchmark.js          Benchmark CLI
|   |-- verify-city-sources.js    Offline and live source verifier
|   `-- browser-audit.mjs         Zero-dependency headless Chromium audit over CDP
`-- tests/                        574 tests in seventeen files, plus a stand-in DOM
```

## Running the tests

Requires Node.js 18 or newer. There is nothing to install.

```bash
npm test                    # node --test tests/*.test.js  (574 tests)
npm run benchmark           # text report with latency
node scripts/run-benchmark.js --json   # deterministic JSON report
npm run verify:sources      # check the rules snapshot offline
npm run audit               # headless Chromium audit at 1440x900, 820x1180 and 390x844 (needs Chrome or Chromium)
```

The suite covers the engine and GS1 math (45), the reducer, view model, share links, evidence ladder and renderers (46), share-link decoding and parser hardening (65), the CSV parser, batch exports, ground-truth anchors, benchmark and CLI (36), the UI controller driven through a stand-in document built from the real `index.html` (37), static page checks (20), repository hygiene with encoded and binary probes (5), the verdicts, instant search and contamination calculator (12), the single-item report exports (29), and the municipal rule citations, snapshot parity, guided demos, diversion math and extra-cell CSV rows (23). The workbench adds the SHA-256 and HMAC known-answer vectors, canonical signing, CSV formula guards and tamper detection (54), the six-profile diff engine with conservation and bound invariants (39), the hazard cascade sweep (31), the shared self-test registry running one Node test per in-page check (35), and the workbench reducer, hydration, share-hash keys, renderers and page controls (44). Offline caching and resin classification (10) plus the English/Spanish dictionaries, language switching, Spanish search aliases, localization fallbacks, share-hash language round trips and EN/ES parity guards for cascade stages, presets, diff notes, batch tables, self-test descriptions and stacked-table column labels (42) close out the suite. It includes a tampered-snapshot test, a planted wrong-answer test, and an HTML injection test for CSV labels. Regressions also cover resin-only links, contradictory resin stamps, prototype property names, headerless barcode and material/resin rows with identifier-like labels, quoted newline accounting, scanner format requests, cancelled camera acquisitions and deterministic scanner cleanup. The image guards check both hero formats and reject application segments or ancillary chunks.

`npm run audit` serves the repository locally, launches headless Chrome or Chromium, and drives the real page over the DevTools Protocol at 1440x900, 820x1180 and 390x844: 144 checks across the three viewports covering console errors, uncaught exceptions, external requests, horizontal overflow, profile diffs, cascade sliders, presets, hash hydration, the self-test panel, all three signed export formats with the tamper check, and the bilingual toggle: real pointer clicks switching English to Spanish and back, a Spanish item search, `document.documentElement.lang`, the `l=es` share-hash key, and localStorage persistence across a reload.

## Municipal references

- City of Riverside Solid Waste and Recycling (Republic Services): `https://www.Riversidetx.gov/361/Solid-Waste-and-Recycling`
- county County Recycling Center: `1200 Blume Rd, Rosenberg, TX 77471`
- City of Houston Solid Waste Management Department: `https://www.houstontx.gov/solidwaste/recycling.html`
- Houston Westpark Consumer Recycling Center: `5900 Westpark Dr, Houston, TX 77057`

## License

Released under the [MIT License](./LICENSE).
