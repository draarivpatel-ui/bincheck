# BinCheck: Verified Houston & Sugar Land Municipal Recycling & Barcode Rules Engine

**Live Web App:** [https://aariv.me/bincheck/](https://aariv.me/bincheck/)

BinCheck is a browser-based and CLI-verifiable municipal solid waste, SPI plastic resin code (`#1` through `#7`), and GS1 barcode (`UPC-A` / `EAN-13`) rules engine tailored to **City of Sugar Land, TX** (Republic Services / Fort Bend County Recycling Center) and **City of Houston, TX** (Solid Waste Management Department / Westpark Consumer Recycling Center / Neighborhood Depositories).

## Why BinCheck Exists

Wish-cycling (tossing questionable plastics, greasy pizza boxes, film bags, or batteries into a single-stream cart hoping they can be recycled) is one of the largest drivers of Material Recovery Facility (MRF) line shutdowns and rejected municipal bales across Greater Houston and Fort Bend County:

1. **Flexible Film Tanglers (`#4 LDPE` Grocery Bags):** Plastic grocery bags, bread bags, and shrink wrap twist tightly around rotating star-screen shafts, forcing manual MRF shutdowns every shift. Both Sugar Land and Houston ban film bags in curbside carts and route clean dry film to retail store drop-off kiosks (H-E-B, Kroger, Target, Walmart).
2. **Jurisdictional Rule Divergences:** Neighboring municipalities enforce distinct rules. For example, clean `#6 Polystyrene` foam blocks can be taken to the **Fort Bend County Recycling Center** (1200 Blume Rd, Rosenberg) for densifier processing, whereas **City of Houston SWMD** rejects `#6` foam in both curbside green carts and standard depositories. Similarly, Sugar Land weekly Green Waste accepts standard kraft paper lawn bags (40 lb limit), whereas Houston requires bags stamped with the official City of Houston biodegradable logo (50 lb limit).
3. **Thermal Runaway & Optical Sorting Physics:** Lithium-ion batteries punctured by collection truck compactors ignite MRF fires, while half-full beverage bottles exceed the mass threshold of optical Near-Infrared (NIR) air-classification jets and drop into the paper stream.

## Key Features

- **GS1 Modulo-10 Barcode Validator & 28 Verified Texas Product Barcodes:** Validates 8-digit (`EAN-8`), 12-digit (`UPC-A`), and 13-digit (`EAN-13`) check digits in real time and includes 28 verified barcodes for common Texas household products (H-E-B, Ozarka, Topo Chico, Whataburger, Blue Bell, Dr Pepper, Coca-Cola, Chobani, Tide, Clorox, Reynolds Wrap, Energizer, Duracell, and more).
- **SPI Plastic Resin Code (`#1` to `#7`) & Condition Matrix:** Evaluates `#1 PETE`, `#2 HDPE`, `#3 PVC`, `#4 LDPE`, `#5 PP`, `#6 PS`, and `#7 Other` alongside item condition (`Clean & Dry`, `Food or Grease Stained`, `Still Contains Liquid`, `Broken or Shattered`).
- **Side-by-Side Jurisdiction Comparison:** Instantly compares disposal streams, MRF contamination risk scores (`0-100`), preparation checklists, and drop-off addresses between **Sugar Land, TX** and **Houston, TX**.
- **Household Cart Batch Contamination Simulator:** Allows residents to build a multi-item virtual cart load and see how a single tangler or battery affects overall bin acceptance.
- **Printable 1-Page Kitchen & Garage Sorting Guide:** Dedicated `@media print` layout for posting a clean reference table inside a pantry or garage.
- **Hardened Municipal Source Verifier (`scripts/verify-city-sources.js`):** Token-agnostic verification script backed by a deterministic offline rules snapshot (`data/municipal-rules-2026.json`).

## Repository Structure

```text
bincheck/
|-- index.html                      # Interactive web app & printable 1-page sorting guide
|-- styles.css                      # Responsive UI + @media print stylesheet
|-- src/
|   |-- app.js                      # Browser UI controller, camera BarcodeDetector & batch simulator
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

## Quick Start & Verification

Requires **Node.js 18+** (zero external runtime dependencies).

```bash
# 1. Run the 42-test unit suite
npm test

# 2. Verify the offline municipal rules snapshot for Sugar Land and Houston
npm run verify:sources
```

## Official Municipal Data Sources

- **City of Sugar Land Solid Waste & Recycling (Republic Services):** `https://www.sugarlandtx.gov/361/Solid-Waste-and-Recycling`
- **Fort Bend County Recycling Center & Household Hazardous Waste (HHW):** `1200 Blume Rd, Rosenberg, TX 77471`
- **City of Houston Solid Waste Management Department (SWMD):** `https://www.houstontx.gov/solidwaste/recycling.html`
- **Houston Westpark Consumer Recycling Center:** `5900 Westpark Dr, Houston, TX 77057`

## License

Released under the [MIT License](./LICENSE).
