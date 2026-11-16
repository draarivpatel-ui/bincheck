/**
 * BinCheck ground truth for the calibration benchmark.
 *
 * Every expectation is anchored to the verified municipal snapshot
 * (data/municipal-rules-2026.json), not to the engine's own output. Each anchor
 * is a machine-checkable claim about the snapshot; verifyGroundTruthAnchors()
 * in js/bincheck-benchmark.js confirms the snapshot really says what the case
 * assumes, so the benchmark cannot silently drift into grading the engine
 * against itself.
 *
 * Two label levels are used because the snapshot supports two levels of claim:
 *   cart   (boolean)  Whether the item belongs in the curbside recycling cart.
 *                     Resins listed as "conditional" are treated as NOT
 *                     unconditionally cart-eligible (false), the conservative
 *                     reading that matches what a sorter should tell a resident.
 *   stream (string)   The exact disposal stream, only where an anchor proves it.
 *
 * Anchor operators: includes (array contains value), equals, matches (string at
 * path matches the pattern, case-insensitive), anyMatches (some array element
 * matches), noneMatch (no array element matches).
 */

const SL = "sugar-land-tx";
const HOU = "houston-tx";

const accepted = (code) => ({ path: "curbsideCartRules.acceptedResins", op: "includes", value: code });
const conditional = (code) => ({ path: "curbsideCartRules.conditionalResins", op: "includes", value: code });
const rejected = (code) => ({ path: "curbsideCartRules.rejectedResins", op: "includes", value: code });

function recycleResin(code, materialId) {
  const side = { cart: true, stream: "RECYCLE_CART", anchors: [accepted(code)] };
  return {
    id: `resin-${code}`,
    label: `#${code} resin item`,
    group: "resin",
    query: { materialId },
    expect: { [SL]: side, [HOU]: { ...side, anchors: [accepted(code)] } }
  };
}

export const GROUND_TRUTH_META = Object.freeze({
  name: "BinCheck municipal ground truth 2026",
  snapshotFile: "data/municipal-rules-2026.json",
  snapshotSchemaVersion: "2026.10",
  labelNotes: Object.freeze([
    "cart = belongs in the curbside recycling cart.",
    "Conditional resins count as not unconditionally cart-eligible.",
    "Stream labels are scored only where an anchor proves the exact stream."
  ])
});

export const GROUND_TRUTH_CASES = Object.freeze([
  recycleResin(1, "resin-1-pet"),
  recycleResin(2, "resin-2-hdpe"),
  {
    id: "resin-3",
    label: "#3 PVC item",
    group: "resin",
    query: { materialId: "resin-3-pvc" },
    expect: {
      [SL]: { cart: false, anchors: [conditional(3)] },
      [HOU]: { cart: false, anchors: [rejected(3)] }
    }
  },
  {
    id: "resin-4",
    label: "#4 film and plastic grocery bag",
    group: "resin",
    query: { materialId: "resin-4-ldpe-film" },
    expect: {
      [SL]: {
        cart: false,
        stream: "SPECIAL_DROPOFF",
        anchors: [
          conditional(4),
          { path: "curbsideCartRules.plasticBagsAllowedInCart", op: "equals", value: false },
          { path: "curbsideCartRules.bagNote", op: "matches", value: "store drop-off" }
        ]
      },
      [HOU]: {
        cart: false,
        stream: "SPECIAL_DROPOFF",
        anchors: [
          rejected(4),
          { path: "curbsideCartRules.plasticBagsAllowedInCart", op: "equals", value: false },
          { path: "curbsideCartRules.bagNote", op: "matches", value: "retail grocery drop-off" }
        ]
      }
    }
  },
  recycleResin(5, "resin-5-pp"),
  {
    id: "resin-6",
    label: "#6 polystyrene foam",
    group: "resin",
    query: { materialId: "resin-6-ps-foam" },
    expect: {
      [SL]: {
        cart: false,
        stream: "SPECIAL_DROPOFF",
        anchors: [
          rejected(6),
          { path: "dropOffCenter.accepts", op: "anyMatches", value: "Polystyrene \\(#6 foam\\)" }
        ]
      },
      [HOU]: {
        cart: false,
        stream: "TRASH_CART",
        anchors: [
          rejected(6),
          { path: "dropOffCenter.accepts", op: "noneMatch", value: "polystyrene|foam" }
        ]
      }
    }
  },
  {
    id: "resin-7",
    label: "#7 other and multi-layer pouch",
    group: "resin",
    query: { materialId: "resin-7-other" },
    expect: {
      [SL]: { cart: false, anchors: [conditional(7)] },
      [HOU]: { cart: false, anchors: [rejected(7)] }
    }
  },
  {
    id: "glass-clean",
    label: "Clean glass bottle or jar",
    group: "glass",
    query: { materialId: "glass-jar-bottle" },
    expect: {
      [SL]: {
        cart: true,
        stream: "RECYCLE_CART",
        anchors: [{ path: "curbsideCartRules.acceptsCleanGlassCurbside", op: "equals", value: true }]
      },
      [HOU]: {
        cart: true,
        stream: "RECYCLE_CART",
        anchors: [{ path: "curbsideCartRules.acceptsCleanGlassCurbside", op: "equals", value: true }]
      }
    }
  },
  {
    id: "glass-broken",
    label: "Broken glass (Houston rule only)",
    group: "glass",
    query: { materialId: "glass-jar-bottle", condition: "broken" },
    expect: {
      [HOU]: {
        cart: false,
        anchors: [{ path: "curbsideCartRules.glassNote", op: "matches", value: "Broken glass.*prohibited" }]
      }
    }
  },
  {
    id: "pizza-box",
    label: "Greasy pizza box",
    group: "paper",
    query: { materialId: "greasy-pizza-box", condition: "greasy" },
    expect: {
      [SL]: {
        cart: false,
        stream: "SPLIT_DISPOSAL",
        anchors: [{ path: "curbsideCartRules.greasyPizzaBoxRule", op: "matches", value: "tear off.*trash cart" }]
      },
      [HOU]: {
        cart: false,
        stream: "SPLIT_DISPOSAL",
        anchors: [{ path: "curbsideCartRules.greasyPizzaBoxRule", op: "matches", value: "detach.*garbage cart" }]
      }
    }
  },
  {
    id: "yard-trimmings",
    label: "Yard trimmings and brush",
    group: "green",
    query: { materialId: "yard-trimmings-brush" },
    expect: {
      [SL]: {
        cart: false,
        stream: "GREEN_WASTE",
        anchors: [{ path: "curbsideCartRules.greenWasteProgram", op: "matches", value: "yard trimmings" }]
      },
      [HOU]: {
        cart: false,
        stream: "GREEN_WASTE",
        anchors: [{ path: "curbsideCartRules.greenWasteProgram", op: "matches", value: "yard trimmings" }]
      }
    }
  },
  {
    id: "battery",
    label: "Lithium or household battery",
    group: "hazard",
    query: { materialId: "lithium-household-battery" },
    expect: {
      [SL]: { cart: false, stream: "SPECIAL_DROPOFF", anchors: [{ path: "dropOffCenter.accepts", op: "anyMatches", value: "batter" }] },
      [HOU]: { cart: false, stream: "SPECIAL_DROPOFF", anchors: [{ path: "dropOffCenter.accepts", op: "anyMatches", value: "batter" }] }
    }
  },
  {
    id: "electronics",
    label: "Electronics and power cords",
    group: "hazard",
    query: { materialId: "electronics-ewaste" },
    expect: {
      [SL]: { cart: false, stream: "SPECIAL_DROPOFF", anchors: [{ path: "dropOffCenter.accepts", op: "anyMatches", value: "electronics" }] },
      [HOU]: { cart: false, stream: "SPECIAL_DROPOFF", anchors: [{ path: "dropOffCenter.accepts", op: "anyMatches", value: "electronics" }] }
    }
  }
]);

/**
 * A former engine gap: grease-soaked cardboard originally stayed in the
 * recycling cart with a moderate score. The engine now extends the snapshot's
 * pizza box rule to other soiled fiber: recycle the clean part and trash the
 * soiled part. That extension is an inference (inferred: true), reported
 * separately in the benchmark and excluded from headline accuracy.
 */
export const KNOWN_GAP_CASES = Object.freeze([
  {
    id: "gap-greasy-cardboard",
    label: "Grease-soaked cardboard that is not a pizza box",
    group: "paper",
    inferred: true,
    query: { materialId: "clean-cardboard-paper", condition: "greasy" },
    note: "The engine previously kept this item in the recycling cart with a grease penalty. It now infers the pizza box split rule for other soiled fiber: recycle the clean part and trash the soiled part.",
    expect: {
      [SL]: {
        cart: false,
        stream: "SPLIT_DISPOSAL",
        anchors: [{ path: "curbsideCartRules.greasyPizzaBoxRule", op: "matches", value: "grease-soaked" }]
      },
      [HOU]: {
        cart: false,
        stream: "SPLIT_DISPOSAL",
        anchors: [{ path: "curbsideCartRules.greasyPizzaBoxRule", op: "matches", value: "grease-saturated" }]
      }
    }
  }
]);

/** Barcode integrity vectors with externally published, known-valid codes. */
export const EXTERNAL_BARCODE_VECTORS = Object.freeze([
  Object.freeze({ code: "036000291452", valid: true, format: "UPC-A" }),
  Object.freeze({ code: "4006381333931", valid: true, format: "EAN-13" }),
  Object.freeze({ code: "96385074", valid: true, format: "EAN-8" }),
  Object.freeze({ code: "73513537", valid: true, format: "EAN-8" }),
  Object.freeze({ code: "", valid: false, format: "EMPTY" }),
  Object.freeze({ code: "12345", valid: false, format: "INVALID_LENGTH" }),
  Object.freeze({ code: "04122057646A", valid: false, format: "NON_NUMERIC" }),
  Object.freeze({ code: "04122057646", valid: false, format: "INVALID_LENGTH" })
]);
