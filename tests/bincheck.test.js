import test from "node:test";
import assert from "node:assert/strict";
import {
  SUPPORTED_CITIES,
  RESIN_CODE_METADATA,
  MATERIAL_CATEGORIES,
  VERIFIED_BARCODE_CATALOG,
  computeUpcCheckDigit,
  validateBarcodeCheckDigit,
  lookupProductByBarcode,
  getContaminationTier,
  resolveMaterialProfile,
  evaluateItemDisposal,
  compareJurisdictions,
  scoreCartBatch
} from "../src/bincheck-engine.js";
import {
  normalizeTextTokens,
  verifySnapshotIntegrity
} from "../scripts/verify-city-sources.js";

test("1. SUPPORTED_CITIES defines Sugar Land and Houston municipal metadata", () => {
  assert.equal(SUPPORTED_CITIES["sugar-land-tx"].shortName, "Sugar Land, TX");
  assert.equal(SUPPORTED_CITIES["houston-tx"].shortName, "Houston, TX");
  assert.ok(SUPPORTED_CITIES["sugar-land-tx"].dropOffAddress.includes("1200 Blume Rd"));
  assert.ok(SUPPORTED_CITIES["houston-tx"].dropOffAddress.includes("5900 Westpark Dr"));
});

test("2. RESIN_CODE_METADATA accurately flags curbside acceptance for codes #1 through #7", () => {
  assert.equal(RESIN_CODE_METADATA[1].curbsideAcceptedSugarLand, true);
  assert.equal(RESIN_CODE_METADATA[1].curbsideAcceptedHouston, true);
  assert.equal(RESIN_CODE_METADATA[2].curbsideAcceptedSugarLand, true);
  assert.equal(RESIN_CODE_METADATA[2].curbsideAcceptedHouston, true);
  assert.equal(RESIN_CODE_METADATA[3].curbsideAcceptedSugarLand, false);
  assert.equal(RESIN_CODE_METADATA[3].curbsideAcceptedHouston, false);
  assert.equal(RESIN_CODE_METADATA[4].curbsideAcceptedSugarLand, false);
  assert.equal(RESIN_CODE_METADATA[4].curbsideAcceptedHouston, false);
  assert.equal(RESIN_CODE_METADATA[5].curbsideAcceptedSugarLand, true);
  assert.equal(RESIN_CODE_METADATA[5].curbsideAcceptedHouston, true);
  assert.equal(RESIN_CODE_METADATA[6].curbsideAcceptedSugarLand, false);
  assert.equal(RESIN_CODE_METADATA[6].curbsideAcceptedHouston, false);
  assert.equal(RESIN_CODE_METADATA[7].curbsideAcceptedSugarLand, false);
  assert.equal(RESIN_CODE_METADATA[7].curbsideAcceptedHouston, false);
});

test("3. computeUpcCheckDigit rejects empty or non-numeric inputs", () => {
  assert.equal(computeUpcCheckDigit(""), null);
  assert.equal(computeUpcCheckDigit("   "), null);
  assert.equal(computeUpcCheckDigit(null), null);
  assert.equal(computeUpcCheckDigit("0412205764A"), null);
});

test("4. computeUpcCheckDigit rejects unsupported payload lengths (not 7, 11, 12, or 13)", () => {
  assert.equal(computeUpcCheckDigit("12345"), null);
  assert.equal(computeUpcCheckDigit("123456"), null);
  assert.equal(computeUpcCheckDigit("12345678"), null);
  assert.equal(computeUpcCheckDigit("1234567890"), null);
  assert.equal(computeUpcCheckDigit("12345678901234"), null);
});

test("5. computeUpcCheckDigit computes valid check digits for 7, 11, 12, and 13 digit payloads", () => {
  assert.equal(computeUpcCheckDigit("04122057646"), 3);
  assert.equal(computeUpcCheckDigit("004122057646"), 3);
  assert.equal(computeUpcCheckDigit("1234567"), 0);
  assert.equal(computeUpcCheckDigit("1234567890123"), 1);
});

test("6. validateBarcodeCheckDigit handles empty input", () => {
  const res = validateBarcodeCheckDigit("   ");
  assert.equal(res.valid, false);
  assert.equal(res.format, "EMPTY");
  assert.equal(res.normalized, "");
});

test("7. validateBarcodeCheckDigit rejects non-numeric characters", () => {
  const res = validateBarcodeCheckDigit("041220-57646X");
  assert.equal(res.valid, false);
  assert.equal(res.format, "NON_NUMERIC");
});

test("8. validateBarcodeCheckDigit rejects invalid barcode lengths", () => {
  const shortRes = validateBarcodeCheckDigit("0412205764");
  assert.equal(shortRes.valid, false);
  assert.equal(shortRes.format, "INVALID_LENGTH");
  const nineRes = validateBarcodeCheckDigit("123456789");
  assert.equal(nineRes.valid, false);
  assert.equal(nineRes.format, "INVALID_LENGTH");
});

test("9. validateBarcodeCheckDigit validates 12-digit UPC-A with spaces/hyphens", () => {
  const res = validateBarcodeCheckDigit("0-41220-57646-3");
  assert.equal(res.valid, true);
  assert.equal(res.format, "UPC-A");
  assert.equal(res.normalized, "041220576463");
  assert.equal(res.ean13, "0041220576463");
  assert.equal(res.expectedCheckDigit, 3);
  assert.equal(res.actualCheckDigit, 3);
});

test("10. validateBarcodeCheckDigit detects tampered 12-digit UPC-A check digits", () => {
  const res = validateBarcodeCheckDigit("041220576469");
  assert.equal(res.valid, false);
  assert.equal(res.format, "UPC-A");
  assert.equal(res.expectedCheckDigit, 3);
  assert.equal(res.actualCheckDigit, 9);
  assert.ok(res.reason.includes("Invalid UPC-A check digit"));
});

test("11. validateBarcodeCheckDigit validates 13-digit EAN-13 with leading zero", () => {
  const res = validateBarcodeCheckDigit("0041220576463");
  assert.equal(res.valid, true);
  assert.equal(res.format, "EAN-13");
  assert.equal(res.normalized, "041220576463");
  assert.equal(res.ean13, "0041220576463");
});

test("12. validateBarcodeCheckDigit validates 13-digit EAN-13 without leading zero", () => {
  const payload = "400638133393";
  const cd = computeUpcCheckDigit(payload);
  const ean13 = `${payload}${cd}`;
  const res = validateBarcodeCheckDigit(ean13);
  assert.equal(res.valid, true);
  assert.equal(res.format, "EAN-13");
  assert.equal(res.normalized, ean13);
  assert.equal(res.ean13, ean13);
});

test("13. validateBarcodeCheckDigit validates 8-digit EAN-8 barcode", () => {
  const res = validateBarcodeCheckDigit("12345670");
  assert.equal(res.valid, true);
  assert.equal(res.format, "EAN-8");
  assert.equal(res.normalized, "12345670");
  assert.equal(res.ean13, "");
});

test("14. All 28 barcodes in VERIFIED_BARCODE_CATALOG pass GS1 Modulo-10 verification", () => {
  assert.equal(VERIFIED_BARCODE_CATALOG.length, 28);
  for (const item of VERIFIED_BARCODE_CATALOG) {
    const check = validateBarcodeCheckDigit(item.upc);
    assert.equal(check.valid, true, `Failed check digit for ${item.upc} (${item.productName})`);
  }
});

test("15. lookupProductByBarcode finds catalog items by 12-digit UPC-A and 13-digit EAN-13", () => {
  const byUpc = lookupProductByBarcode("041220576463");
  assert.equal(byUpc.found, true);
  assert.equal(byUpc.product.brand, "H-E-B");
  const byEan = lookupProductByBarcode("0041220576463");
  assert.equal(byEan.found, true);
  assert.equal(byEan.product.upc, "041220576463");
});

test("16. lookupProductByBarcode returns found=false for invalid or unlisted barcodes", () => {
  const invalid = lookupProductByBarcode("041220576460");
  assert.equal(invalid.found, false);
  assert.equal(invalid.validation.valid, false);
  assert.equal(invalid.product, null);

  const unlisted = lookupProductByBarcode("012345678905");
  assert.equal(unlisted.validation.valid, true);
  assert.equal(unlisted.found, false);
  assert.equal(unlisted.product, null);
});

test("17. getContaminationTier maps exact boundary scores (0, 24, 25, 54, 55, 84, 85, 100)", () => {
  assert.equal(getContaminationTier(0), "LOW");
  assert.equal(getContaminationTier(24), "LOW");
  assert.equal(getContaminationTier(25), "MODERATE");
  assert.equal(getContaminationTier(54), "MODERATE");
  assert.equal(getContaminationTier(55), "HIGH");
  assert.equal(getContaminationTier(84), "HIGH");
  assert.equal(getContaminationTier(85), "CRITICAL");
  assert.equal(getContaminationTier(100), "CRITICAL");
});

test("18. resolveMaterialProfile prioritizes explicit materialId or resolves from barcode/resinCode", () => {
  const fromBarcode = resolveMaterialProfile({ barcode: "039800084118" });
  assert.equal(fromBarcode.category.id, "lithium-household-battery");
  assert.equal(fromBarcode.resolvedProduct.brand, "Energizer");

  const fromResin = resolveMaterialProfile({ resinCode: 6 });
  assert.equal(fromResin.category.id, "resin-6-ps-foam");

  const fallbackDefault = resolveMaterialProfile({});
  assert.equal(fallbackDefault.category.id, "resin-1-pet");
});

test("19. resolveMaterialProfile escalates liquid-full #1/#2 bottles and broken glass", () => {
  const liquidPet = resolveMaterialProfile({ materialId: "resin-1-pet", condition: "liquid-full" });
  assert.equal(liquidPet.category.id, "liquid-full-bottle");

  const liquidHdpe = resolveMaterialProfile({ materialId: "resin-2-hdpe", condition: "liquid-full" });
  assert.equal(liquidHdpe.category.id, "liquid-full-bottle");

  const brokenGlass = resolveMaterialProfile({ materialId: "glass-jar-bottle", condition: "broken" });
  assert.equal(brokenGlass.category.id, "broken-glass-ceramic");
});

test("20. evaluateItemDisposal evaluates #1 PET bottle in Sugar Land vs Houston", () => {
  const sl = evaluateItemDisposal({ barcode: "041220576463", city: "sugar-land-tx" });
  assert.equal(sl.city, "sugar-land-tx");
  assert.equal(sl.stream, "RECYCLE_CART");
  assert.equal(sl.contaminationRiskScore, 10);
  assert.equal(sl.contaminationTier, "LOW");

  const ho = evaluateItemDisposal({ barcode: "041220576463", city: "houston-tx" });
  assert.equal(ho.city, "houston-tx");
  assert.equal(ho.stream, "RECYCLE_CART");
  assert.ok(ho.operator.includes("SWMD"));
});

test("21. evaluateItemDisposal flags #6 Polystyrene divergence between Sugar Land (Fort Bend drop-off) and Houston (Trash)", () => {
  const slFoam = evaluateItemDisposal({ materialId: "resin-6-ps-foam", city: "sugar-land-tx" });
  assert.equal(slFoam.stream, "SPECIAL_DROPOFF");
  assert.equal(slFoam.contaminationRiskScore, 86);

  const hoFoam = evaluateItemDisposal({ materialId: "resin-6-ps-foam", city: "houston-tx" });
  assert.equal(hoFoam.stream, "TRASH_CART");
  assert.equal(hoFoam.contaminationRiskScore, 91);
});

test("22. evaluateItemDisposal applies greasy condition penalty (+35) to non-pizza items", () => {
  const cleanCardboard = evaluateItemDisposal({ materialId: "clean-cardboard-paper", condition: "clean" });
  assert.equal(cleanCardboard.contaminationRiskScore, 10);

  const greasyCardboard = evaluateItemDisposal({ materialId: "clean-cardboard-paper", condition: "greasy" });
  assert.equal(greasyCardboard.contaminationRiskScore, 45);
  assert.equal(greasyCardboard.contaminationTier, "MODERATE");
});

test("23. evaluateItemDisposal does not double-penalize greasy-pizza-box when condition is greasy", () => {
  const pizzaClean = evaluateItemDisposal({ materialId: "greasy-pizza-box", condition: "clean" });
  const pizzaGreasy = evaluateItemDisposal({ materialId: "greasy-pizza-box", condition: "greasy" });
  assert.equal(pizzaClean.contaminationRiskScore, 68);
  assert.equal(pizzaGreasy.contaminationRiskScore, 68);
  assert.equal(pizzaGreasy.stream, "SPLIT_DISPOSAL");
});

test("24. evaluateItemDisposal enforces SPECIAL_DROPOFF for plastic grocery bags (#4 film) and lithium batteries", () => {
  const bag = evaluateItemDisposal({ barcode: "041220400126", city: "sugar-land-tx" });
  assert.equal(bag.stream, "SPECIAL_DROPOFF");
  assert.equal(bag.contaminationRiskScore, 95);
  assert.equal(bag.contaminationTier, "CRITICAL");

  const battery = evaluateItemDisposal({ barcode: "039800084118", city: "houston-tx" });
  assert.equal(battery.stream, "SPECIAL_DROPOFF");
  assert.equal(battery.contaminationRiskScore, 100);
  assert.equal(battery.contaminationTier, "CRITICAL");
});

test("25. evaluateItemDisposal verifies glass bottle acceptance vs broken glass rejection", () => {
  const intact = evaluateItemDisposal({ barcode: "021131500269", city: "sugar-land-tx", condition: "clean" });
  assert.equal(intact.stream, "RECYCLE_CART");
  assert.equal(intact.contaminationRiskScore, 25);

  const broken = evaluateItemDisposal({ barcode: "021131500269", city: "sugar-land-tx", condition: "broken" });
  assert.equal(broken.stream, "TRASH_CART");
  assert.equal(broken.contaminationRiskScore, 92);
});

test("26. evaluateItemDisposal verifies yard waste rules across Sugar Land and Houston", () => {
  const slYard = evaluateItemDisposal({ materialId: "yard-trimmings-brush", city: "sugar-land-tx" });
  assert.equal(slYard.stream, "GREEN_WASTE");
  assert.ok(slYard.prepSteps.some((s) => s.includes("40 lbs")));

  const hoYard = evaluateItemDisposal({ materialId: "yard-trimmings-brush", city: "houston-tx" });
  assert.equal(hoYard.stream, "GREEN_WASTE");
  assert.ok(hoYard.prepSteps.some((s) => s.includes("City of Houston logo")));
});

test("27. compareJurisdictions detects aligned vs divergent streams and computes riskDelta", () => {
  const petComp = compareJurisdictions({ materialId: "resin-1-pet" });
  assert.equal(petComp.sameStream, true);
  assert.equal(petComp.riskDelta, 0);

  const foamComp = compareJurisdictions({ materialId: "resin-6-ps-foam" });
  assert.equal(foamComp.sameStream, false);
  assert.equal(foamComp.riskDelta, 5);
  assert.equal(foamComp.sugarLand.stream, "SPECIAL_DROPOFF");
  assert.equal(foamComp.houston.stream, "TRASH_CART");
});

test("28. scoreCartBatch handles empty arrays and non-arrays safely", () => {
  const empty = scoreCartBatch([], "sugar-land-tx");
  assert.equal(empty.itemCount, 0);
  assert.equal(empty.loadStatus, "EMPTY_BATCH");
  assert.equal(empty.averageRiskScore, 0);

  const invalid = scoreCartBatch(null, "houston-tx");
  assert.equal(invalid.itemCount, 0);
  assert.equal(invalid.loadStatus, "EMPTY_BATCH");
});

test("29. scoreCartBatch scores a clean curbside load as CLEAN_CURBSIDE_LOAD", () => {
  const cleanBatch = scoreCartBatch(
    [
      { materialId: "resin-1-pet", condition: "clean" },
      { materialId: "aluminum-steel-can", condition: "clean" },
      { materialId: "clean-cardboard-paper", condition: "clean" }
    ],
    "sugar-land-tx"
  );
  assert.equal(cleanBatch.itemCount, 3);
  assert.equal(cleanBatch.loadStatus, "CLEAN_CURBSIDE_LOAD");
  assert.equal(cleanBatch.criticalHazards.length, 0);
  assert.equal(cleanBatch.maxRiskScore, 12 < 10 ? 12 : 10);
});

test("30. scoreCartBatch flags NEEDS_SORTING_FIXES when maxRiskScore is between 55 and 84", () => {
  const fixBatch = scoreCartBatch(
    [
      { materialId: "resin-1-pet", condition: "clean" },
      { materialId: "soiled-foil-tray", condition: "clean" }
    ],
    "sugar-land-tx"
  );
  assert.equal(fixBatch.maxRiskScore, 55);
  assert.equal(fixBatch.loadStatus, "NEEDS_SORTING_FIXES");
});

test("31. scoreCartBatch flags REJECTED_CONTAMINATED_LOAD when maxRiskScore >= 85", () => {
  const contaminated = scoreCartBatch(
    [
      { materialId: "resin-1-pet", condition: "clean" },
      { materialId: "resin-4-ldpe-film", condition: "clean" },
      { materialId: "lithium-household-battery", condition: "clean" }
    ],
    "houston-tx"
  );
  assert.equal(contaminated.maxRiskScore, 100);
  assert.equal(contaminated.loadStatus, "REJECTED_CONTAMINATED_LOAD");
  assert.equal(contaminated.criticalHazards.length, 2);
});

test("32. verifySnapshotIntegrity validates offline municipal rules JSON for both cities", () => {
  const report = verifySnapshotIntegrity();
  assert.equal(report.allPassed, true);
  assert.equal(report.jurisdictionsVerified, 2);
  assert.equal(report.details["sugar-land-tx"].passed, true);
  assert.equal(report.details["houston-tx"].passed, true);
  assert.equal(normalizeTextTokens("  #1 PET -- & Bags! "), "#1 pet bags");
});

test("33. evaluateItemDisposal handles #2 HDPE milk and detergent jugs accurately", () => {
  const res = evaluateItemDisposal({ barcode: "041220948321", city: "sugar-land-tx" });
  assert.equal(res.materialId, "resin-2-hdpe");
  assert.equal(res.resinCode, 2);
  assert.equal(res.stream, "RECYCLE_CART");
  assert.equal(res.contaminationRiskScore, 12);
});

test("34. evaluateItemDisposal rejects #3 PVC vinyl packaging in both jurisdictions", () => {
  const sl = evaluateItemDisposal({ resinCode: 3, city: "sugar-land-tx" });
  const ho = evaluateItemDisposal({ resinCode: 3, city: "houston-tx" });
  assert.equal(sl.stream, "TRASH_CART");
  assert.equal(ho.stream, "TRASH_CART");
  assert.equal(sl.contaminationRiskScore, 88);
  assert.equal(sl.contaminationTier, "CRITICAL");
});

test("35. evaluateItemDisposal accepts #5 PP yogurt and sour cream tubs when clean", () => {
  const chobani = evaluateItemDisposal({ barcode: "818290012630", city: "houston-tx" });
  assert.equal(chobani.materialId, "resin-5-pp");
  assert.equal(chobani.stream, "RECYCLE_CART");
  assert.equal(chobani.contaminationRiskScore, 22);
});

test("36. evaluateItemDisposal rejects #7 multi-layer snack bags and drink pouches", () => {
  const chips = evaluateItemDisposal({ barcode: "028400589864", city: "sugar-land-tx" });
  const pouch = evaluateItemDisposal({ barcode: "075925301129", city: "houston-tx" });
  assert.equal(chips.stream, "TRASH_CART");
  assert.equal(pouch.stream, "TRASH_CART");
  assert.equal(chips.contaminationRiskScore, 82);
});

test("37. evaluateItemDisposal routes electronics and cords to special drop-off", () => {
  const slEwaste = evaluateItemDisposal({ materialId: "electronics-ewaste", city: "sugar-land-tx" });
  const hoEwaste = evaluateItemDisposal({ materialId: "electronics-ewaste", city: "houston-tx" });
  assert.equal(slEwaste.stream, "SPECIAL_DROPOFF");
  assert.equal(hoEwaste.stream, "SPECIAL_DROPOFF");
  assert.equal(slEwaste.contaminationRiskScore, 96);
});

test("38. evaluateItemDisposal requires emptying liquid-filled bottles before recycling", () => {
  const fullBottle = evaluateItemDisposal({
    barcode: "041220576463",
    condition: "liquid-full",
    city: "sugar-land-tx"
  });
  assert.equal(fullBottle.materialId, "liquid-full-bottle");
  assert.equal(fullBottle.stream, "SPLIT_DISPOSAL");
  assert.equal(fullBottle.contaminationRiskScore, 74);
});

test("39. evaluateItemDisposal returns non-null resinInfo for numbered resin categories and null for non-plastics", () => {
  const pet = evaluateItemDisposal({ materialId: "resin-1-pet" });
  assert.ok(pet.resinInfo);
  assert.equal(pet.resinInfo.code, 1);

  const can = evaluateItemDisposal({ materialId: "aluminum-steel-can" });
  assert.equal(can.resinInfo, null);
});

test("40. evaluateItemDisposal caps contaminationRiskScore at 100 even when greasy condition is added", () => {
  const greasyBattery = evaluateItemDisposal({
    materialId: "lithium-household-battery",
    condition: "greasy"
  });
  assert.equal(greasyBattery.contaminationRiskScore, 100);
});

test("41. MATERIAL_CATEGORIES defines complete Sugar Land and Houston rule blocks for all 17 categories", () => {
  const keys = Object.keys(MATERIAL_CATEGORIES);
  assert.equal(keys.length, 17);
  for (const key of keys) {
    const cat = MATERIAL_CATEGORIES[key];
    assert.ok(cat.sugarLand.stream);
    assert.ok(cat.houston.stream);
    assert.ok(Array.isArray(cat.sugarLand.prepSteps));
    assert.ok(Array.isArray(cat.houston.prepSteps));
  }
});

test("42. scoreCartBatch accurately computes rounded averageRiskScore across mixed items", () => {
  const batch = scoreCartBatch(
    [
      { materialId: "aluminum-steel-can", condition: "clean" }, // 8
      { materialId: "resin-1-pet", condition: "clean" }, // 10
      { materialId: "glass-jar-bottle", condition: "clean" } // 25
    ],
    "sugar-land-tx"
  );
  assert.equal(batch.averageRiskScore, Math.round((8 + 10 + 25) / 3));
  assert.equal(batch.maxRiskScore, 25);
});

