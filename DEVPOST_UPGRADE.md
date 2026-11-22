# BinCheck Devpost update

Paste-ready sections for the Devpost project page. Every number below was copied from `node scripts/run-benchmark.js` and `npm test` on the current code. Rerun both before pasting if the code changes.

## Inspiration

Riverside and Houston sit a few miles apart on US-59, yet they disagree about foam, glass drop-off, yard bags and which plastics belong in the cart. Guessing ("wish-cycling") jams sorting shafts with plastic film, sends heavy half-full bottles into the paper bale, and puts lithium batteries into trucks that crush them. I wanted a tool that answers "which bin?" for both cities and shows its evidence instead of asking to be trusted.

## What it does

BinCheck looks an item up by barcode, resin code or material, sets its condition, and returns the disposal stream for Riverside, Houston, or both side by side. Each answer carries a contamination risk gauge, prep steps, the drop-off facility and a link to the official city page. An evidence ladder says how the item was identified and lowers confidence when inputs contradict each other.

A virtual cart shows how one battery or plastic bag changes an otherwise clean load, with a live chart of every item against the reject threshold. Batch mode checks up to 500 CSV rows against both cities and exports deterministic CSV and JSON reports. Rows it cannot identify are reported as errors and never guessed.

The workbench upgrade adds four panels on top of that engine. A municipal ruleset comparator sorts the same tricky-item basket under six MRF program profiles (the two real city snapshots plus four labeled illustrative archetypes) and reports rule-conflict alerts, diversion and curbside-only rates, contamination risk, trash deltas and lifecycle CO2e deltas with disclosed EPA WARM-style factors. A hazard cascade lab models five documented MRF failure modes (film tanglers, lithium ignition, liquid in the paper bale, grease in the fiber bale, sharps) as deterministic stage tables with safe-disposal alternatives; its downtime and yield figures are labeled planning values, not facility measurements. A signed export produces HMAC-SHA-256 tagged JSON, CSV and Markdown audits with an in-page tamper verifier, and a Run Self-Tests panel executes the same 28-check registry the test suite runs.

## How we built it

The engine is plain JavaScript with no dependencies. The UI is a pure reducer plus renderers, and the controller takes its document as a parameter, so the whole interface runs under Node's built-in test runner against a stand-in DOM built from the real page. The audit signature is a dependency-free SHA-256 and HMAC implementation checked against the FIPS 180-4 known-answer vectors, and the browser audit drives real headless Chromium over the DevTools Protocol with no test framework.

The calibration benchmark is the part I am proudest of. Its ground truth is not taken from the engine. Each case points at a specific field in the cities' rules snapshot, and the benchmark refuses to run if any of those anchors stop holding. A test edits the snapshot on purpose to prove the guard trips.

| Benchmark result | Value |
| --- | --- |
| City evaluations scored | 69 |
| Curbside routing | 32 true positives, 37 true negatives, 0 false positives, 0 false negatives |
| Disposal stream accuracy | 58 of 58 |
| Single-digit barcode errors caught | 3,024 of 3,024 |
| Adjacent digit swaps caught | 226 of 245, and every miss swaps two digits that differ by 5 |
| Automated tests | 519 passing |
| Headless Chromium checks | 70 passing across 1440x900 and 390x844 |

These numbers measure agreement with the published city rules, not accuracy at a real facility. No household testing has been done.

## Challenges

The benchmark exposed a real gap. Grease-soaked cardboard that was not a pizza box stayed in the recycling cart with only a score penalty. Both cities publish a tear-and-split rule for greasy pizza boxes, so BinCheck now applies that rule to other soiled fiber. Because that extends the cities' wording, those cases are labeled as inferences and scored separately from the headline numbers. Writing the tests for the fix also caught the new profile taking the grease penalty twice, which is fixed.

The tests also caught that a CSV without a header row was read in a different column order than the help text promised.

## Accomplishments

Every number on the page is labeled by where it came from. City rules show their snapshot date. The barcode catalog is marked as demo data, since its product pairings are illustrative. Benchmark figures are marked as computed in the tab, and latency readings below the browser's timer resolution say so instead of showing a fake 0.000 ms.

## What's next

Refreshing the rules snapshot against the city sites on a schedule with `npm run verify:live`, and adding more county County cities.

## Built with

JavaScript, HTML, CSS, SVG, Node.js test runner
