# BinCheck: Sugar Land & Houston Municipal Recycling & Barcode Rules Engine

**Live Web App:** [https://aariv.me/bincheck/](https://aariv.me/bincheck/)

I built BinCheck because sorting recycling at home in Sugar Land is way more confusing than the little triangle stamp on the bottom of a plastic cup makes it look. A few miles down US-59, the rules change between the City of Sugar Land (Republic Services curbside carts and the Fort Bend County Recycling Center on Blume Rd in Rosenberg) and the City of Houston (Solid Waste Management Department green carts and the Westpark Consumer Recycling Center).

When people guess and toss questionable items into their curbside cart ("wish-cycling"), it causes real physical problems at the Material Recovery Facility (MRF):

1. **Plastic grocery bags (`#4 LDPE` film) jam the sorting shafts:** Flexible bags wrap around the spinning star-screen shafts that separate flat cardboard from 3D bottles. Workers have to climb into the machine with utility knives every shift to cut bags off the axles. Both Sugar Land and Houston ban plastic bags from curbside carts and tell residents to bring clean, dry film back to H-E-B, Kroger, Target, or Walmart front-of-store drop-off bins.
2. **Sugar Land and Houston do not accept the same items:** Clean `#6 Polystyrene` (Styrofoam) blocks can be dropped off at the Fort Bend County Recycling Center (`1200 Blume Rd, Rosenberg, TX 77471`) where they run a foam densifier, while Houston SWMD puts `#6` foam straight in the black garbage cart. Yard trimmings also work differently: Sugar Land takes standard kraft paper lawn bags up to 40 lbs, while Houston requires bags printed with the official City of Houston biodegradable logo (up to 50 lbs).
3. **Half-full bottles and lithium batteries break the line:** Optical Near-Infrared (NIR) sorters identify `#1 PET` and `#2 HDPE` plastics in milliseconds and fire a timed puff of compressed air to pop the bottle over a divider wall. If a water bottle is still half full of liquid, it is too heavy for the air jet and drops into the paper bale. Worse, if a lithium-ion battery gets crushed by a collection truck compactor or MRF baler, it can puncture and start a facility fire.

## What BinCheck Does

- **GS1 Modulo-10 Barcode Checksum & 28 Verified Texas Barcodes:** Checks 8-digit (`EAN-8`), 12-digit (`UPC-A`), and 13-digit (`EAN-13`) barcodes using the official GS1 Modulo-10 check-digit math, and comes pre-loaded with 28 real barcodes from Texas grocery shelves (H-E-B Pure Texas Spring Water, Ozarka, Topo Chico, Whataburger Spicy Ketchup, Blue Bell, Dr Pepper, Chobani, Tide, Clorox, Reynolds Wrap, Energizer, Duracell, and more).
- **SPI Resin Code (`#1` to `#7`) & Condition Inspector:** Evaluates `#1 PETE`, `#2 HDPE`, `#3 PVC`, `#4 LDPE`, `#5 PP`, `#6 PS`, and `#7 Other` alongside how the item actually looks in your kitchen (`Empty, Clean & Dry`, `Food or Grease Stained`, `Still Contains Liquid`, or `Broken or Shattered`).
- **Side-by-Side Sugar Land vs. Houston Comparison:** Compares the exact curbside stream, MRF contamination risk score (`0-100`), preparation steps, and drop-off addresses between Sugar Land and Houston.
- **Virtual Cart Contamination Simulator:** Lets you build a multi-item bin load to see how adding one greasy pizza box, plastic grocery bag, or lithium battery changes the status of an otherwise clean cart.
- **1-Page Printable Kitchen & Garage Guide:** Includes an `@media print` layout so families can print a single-page reference sheet for the pantry or garage door.
- **Offline & Live Municipal Source Verifier (`scripts/verify-city-sources.js`):** Verifies the rule engine against a deterministic snapshot (`data/municipal-rules-2026.json`) of Sugar Land and Houston solid waste guidelines.

## Repository Layout

```text
bincheck/
|-- DESIGN.md                       # Swiss Civic Industrial design system & specification tokens
|-- index.html                      # Interactive web app & printable 1-page sorting guide
|-- styles.css                      # Swiss specification sheet UI + @media print stylesheet
|-- src/
|   |-- app.js                      # Browser UI controller, laser scanner deck & batch simulator
|   `-- bincheck-engine.js          # ES module entry point re-exporting core engine functions
|-- js/
|   `-- bincheck-engine.js          # Pure rules engine, GS1 check-digit math & 28-item catalog
|-- data/
|   `-- municipal-rules-2026.json   # Verified Sugar Land & Houston solid waste rules snapshot
|-- scripts/
|   `-- verify-city-sources.js      # Token-agnostic municipal source verifier (--offline / --live)
`-- tests/
    `-- bincheck.test.js            # 42 unit tests using Node's native test runner
```

## Running the Tests Locally

Requires **Node.js 18+** (zero external runtime packages).

```bash
# 1. Run all 42 unit tests
npm test

# 2. Verify the municipal rules snapshot for Sugar Land and Houston
npm run verify:sources
```

## Municipal References

- **City of Sugar Land Solid Waste & Recycling (Republic Services):** `https://www.sugarlandtx.gov/361/Solid-Waste-and-Recycling`
- **Fort Bend County Recycling Center & Household Hazardous Waste (HHW):** `1200 Blume Rd, Rosenberg, TX 77471`
- **City of Houston Solid Waste Management Department (SWMD):** `https://www.houstontx.gov/solidwaste/recycling.html`
- **Houston Westpark Consumer Recycling Center:** `5900 Westpark Dr, Houston, TX 77057`

## License

Released under the [MIT License](./LICENSE).
