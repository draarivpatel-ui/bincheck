/**
 * BinCheck wish-cycling and MRF hazard cascade lab.
 *
 * A deterministic impact simulator for the top physical contaminants at a
 * materials recovery facility: film tanglers, lithium-ion ignition, liquid in
 * the paper stream, grease in the fiber bale, and sharps/hazmat. Each scenario
 * is a fixed stage table; feeding more contaminated items can only reach the
 * same or later stages (severity and downtime are non-decreasing, bale yield
 * is non-increasing), which the self-tests verify by sweep.
 *
 * Pure and deterministic: no DOM, no clock, no network.
 */

import { evaluateItemDisposal } from "./bincheck-engine.js";

export const CASCADE_MAX_COUNT = 10;

/**
 * Stage tables. `at` is the contaminant count where the stage first engages.
 * severity adds to the scenario's impact score (capped at 100), downtimeMin is
 * modeled line-stop minutes contributed when the stage engages, and baleHit is
 * the percentage-point drop applied to clean-fiber bale yield.
 */
export const CASCADE_SCENARIOS = Object.freeze({
  "film-tangler": Object.freeze({
    id: "film-tangler",
    title: "#4 film and bag tangler",
    materialId: "resin-4-ldpe-film",
    headline: "Flexible bags wrap the spinning star-screen shafts.",
    stages: Object.freeze([
      Object.freeze({ at: 1, name: "Film reaches presort", detail: "Loose film rides the infeed belt past manual presort stations.", severity: 15, downtimeMin: 0, baleHit: 0 }),
      Object.freeze({ at: 2, name: "Wrap begins on the shafts", detail: "Film winds around the cardboard star-screen rotors and drags 3D containers into the paper stream.", severity: 25, downtimeMin: 15, baleHit: 4 }),
      Object.freeze({ at: 4, name: "Shaft jam forces a line stop", detail: "Torque on the screen shafts trips the motor; the whole single-stream line halts.", severity: 35, downtimeMin: 45, baleHit: 8 }),
      Object.freeze({ at: 8, name: "Manual cutout and missed picks", detail: "Crews cut film off shafts between moving discs while clean containers bypass the stopped NIR jets.", severity: 25, downtimeMin: 120, baleHit: 12 })
    ]),
    alternative: "Return clean, dry film to front-of-store retail drop-off bins (H-E-B, Kroger, Target, Walmart). Soiled film goes in the trash cart, never loose in recycling."
  }),
  "lithium-ignition": Object.freeze({
    id: "lithium-ignition",
    title: "Lithium-ion compaction ignition",
    materialId: "lithium-household-battery",
    headline: "A crushed cell can start a truck or facility fire.",
    stages: Object.freeze([
      Object.freeze({ at: 1, name: "Cell enters the compactor zone", detail: "The battery rides the line toward baler compression; casing damage starts the hazard clock.", severity: 35, downtimeMin: 0, baleHit: 0 }),
      Object.freeze({ at: 2, name: "Puncture and short circuit", detail: "Compactor blades or truck packers breach the cell; internal short begins heating the electrolyte.", severity: 25, downtimeMin: 30, baleHit: 5 }),
      Object.freeze({ at: 4, name: "Thermal runaway", detail: "Cell temperature runs away; smoke and flame reach paper and film on the same belt.", severity: 25, downtimeMin: 120, baleHit: 20 }),
      Object.freeze({ at: 6, name: "Load rejection and evacuation", detail: "The load is dumped for fire response; the facility loses the shift and the surrounding fiber is written off.", severity: 15, downtimeMin: 480, baleHit: 40 })
    ]),
    alternative: "Tape the terminals and use household hazardous drop-off: county County Recycling Center (Riverside), Westpark or North ESC BOPA (Houston), or Call2Recycle retail kiosks. Never any cart."
  }),
  "liquid-bale": Object.freeze({
    id: "liquid-bale",
    title: "Liquid-filled bottle in the paper stream",
    materialId: "liquid-full-bottle",
    headline: "Heavy bottles dodge the air jets and soak the fiber.",
    stages: Object.freeze([
      Object.freeze({ at: 1, name: "Bottle misses the air jet", detail: "A half-full bottle is too heavy for the optical ejector puff and drops past its target bunker.", severity: 15, downtimeMin: 0, baleHit: 0 }),
      Object.freeze({ at: 2, name: "Liquid reaches the paper bunker", detail: "The bottle lands in the fiber pile or bursts under the baler, wetting clean cardboard.", severity: 20, downtimeMin: 0, baleHit: 6 }),
      Object.freeze({ at: 5, name: "Bale moisture grade drops", detail: "Saturated fiber fails the mill moisture spec; the bale is downgraded on the scale ticket.", severity: 25, downtimeMin: 20, baleHit: 15 }),
      Object.freeze({ at: 10, name: "Bale rejected at the mill", detail: "The outbound paper bale is refused and re-processed or landfilled at facility cost.", severity: 40, downtimeMin: 60, baleHit: 30 })
    ]),
    alternative: "Pour leftover liquid down the drain, recap, and the empty #1 or #2 bottle goes straight in the cart. If it cannot be emptied, it goes in the trash."
  }),
  "grease-fiber": Object.freeze({
    id: "grease-fiber",
    title: "Grease degrading the fiber bale",
    materialId: "greasy-pizza-box",
    headline: "Pizza oil cannot be washed out of paper pulp.",
    stages: Object.freeze([
      Object.freeze({ at: 1, name: "Oil transfers to clean fiber", detail: "Grease and cheese contact clean paper on the belt and inside the baler.", severity: 15, downtimeMin: 0, baleHit: 3 }),
      Object.freeze({ at: 3, name: "Fiber repulp fails spec", detail: "Hydrophobic oil survives the pulping vat and leaves weak spots and holes in recycled sheet.", severity: 30, downtimeMin: 0, baleHit: 10 }),
      Object.freeze({ at: 6, name: "Bale downgraded to landfill", detail: "The fiber bale misses its grade and is landfilled, losing the whole load of clean cardboard with it.", severity: 40, downtimeMin: 30, baleHit: 25 })
    ]),
    alternative: "Tear off the clean lid and recycle it. In both cities the grease-soaked base goes in the trash (or an organics cart where one exists), never whole into recycling."
  }),
  "sharps-hazmat": Object.freeze({
    id: "sharps-hazmat",
    title: "Sharps and hazmat in the cart",
    materialId: "broken-glass-ceramic",
    headline: "Shards and chemical containers reach human sorters.",
    stages: Object.freeze([
      Object.freeze({ at: 1, name: "Shards embed in the fiber stream", detail: "Broken glass and ceramics ride into the paper line, abrading belts and contaminating cullet-free fiber.", severity: 25, downtimeMin: 0, baleHit: 4 }),
      Object.freeze({ at: 2, name: "Sorter exposure and slowdown", detail: "Presort crews slow the belt and work around sharps; gloves and pickers take the hits.", severity: 30, downtimeMin: 20, baleHit: 6 }),
      Object.freeze({ at: 4, name: "Injury incident and line stop", detail: "A puncture or chemical splash forces a safety stop and incident review; the line idles.", severity: 45, downtimeMin: 90, baleHit: 12 })
    ]),
    alternative: "Wrap shards in cardboard, tape it, and place in the trash cart. Paint, chemicals and sharps containers go to household hazardous drop-off (county County or Houston ESC), never the curb."
  })
});

export const CASCADE_SCENARIO_IDS = Object.freeze(Object.keys(CASCADE_SCENARIOS));

export function normalizeCascadeId(value) {
  const id = String(value ?? "").trim();
  return Object.hasOwn(CASCADE_SCENARIOS, id) ? id : null;
}

export function clampCascadeCount(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(CASCADE_MAX_COUNT, n));
}

/**
 * Runs one cascade scenario at `count` contaminated items inside a cart of
 * `cleanCount` clean #1 PET bottles. Deterministic; pure.
 *
 * Returns reached stages, cumulative severity (0-100), modeled downtime
 * minutes, modeled clean-fiber bale yield percentage (floor 0), the verdict
 * the contaminant itself earns from the real engine, and the safe-disposal
 * alternative text.
 */
export function simulateCascade(scenarioId, { count = 0, cleanCount = 20, city = "Riverside-tx" } = {}) {
  const id = normalizeCascadeId(scenarioId);
  if (!id) {
    return null;
  }
  const scenario = CASCADE_SCENARIOS[id];
  const safeCount = clampCascadeCount(count);
  const safeClean = Math.max(0, Math.min(40, Math.round(Number(cleanCount)) || 0));

  const reached = scenario.stages.filter((stage) => safeCount >= stage.at);
  const severity = Math.min(100, reached.reduce((acc, stage) => acc + stage.severity, 0));
  const downtimeMin = reached.reduce((acc, stage) => acc + stage.downtimeMin, 0);
  const baleYieldPct = Math.max(0, 100 - reached.reduce((acc, stage) => acc + stage.baleHit, 0));

  const itemEval = evaluateItemDisposal({ materialId: scenario.materialId, city });
  const alertLevel =
    severity >= 85 ? "FACILITY_EMERGENCY" : severity >= 55 ? "LINE_STOP" : severity >= 25 ? "PROCESS_DAMAGE" : safeCount > 0 ? "CONTAMINANT_PRESENT" : "CLEAR";

  return {
    scenarioId: id,
    title: scenario.title,
    headline: scenario.headline,
    count: safeCount,
    cleanCount: safeClean,
    stages: scenario.stages.map((stage) => ({
      ...stage,
      reached: safeCount >= stage.at
    })),
    reachedCount: reached.length,
    stageCount: scenario.stages.length,
    severity,
    downtimeMin,
    baleYieldPct,
    alertLevel,
    itemTitle: itemEval.itemTitle,
    itemStream: itemEval.stream,
    itemRisk: itemEval.contaminationRiskScore,
    alternative: scenario.alternative
  };
}

/**
 * Runs every scenario from a { scenarioId: count } map (the lab state) and
 * returns per-scenario results plus a combined severity index: the strongest
 * cascade dominates, and each additional active scenario adds a fifth of its
 * severity, capped at 100. Deterministic.
 */
export function runCascadeLab(counts = {}, { cleanCount = 20, city = "Riverside-tx" } = {}) {
  const results = CASCADE_SCENARIO_IDS.map((id) => simulateCascade(id, { count: counts[id] || 0, cleanCount, city }));
  const active = results.filter((result) => result.count > 0);
  const sorted = [...active].sort((x, y) => y.severity - x.severity);
  const combinedSeverity = Math.min(
    100,
    sorted.reduce((acc, result, index) => acc + (index === 0 ? result.severity : result.severity / 5), 0)
  );
  return {
    cleanCount: results.length ? results[0].cleanCount : 20,
    results,
    activeCount: active.length,
    totalItems: results.reduce((acc, result) => acc + result.count, 0),
    totalDowntimeMin: results.reduce((acc, result) => acc + result.downtimeMin, 0),
    worstBaleYieldPct: results.reduce((min, result) => Math.min(min, result.baleYieldPct), 100),
    combinedSeverity: Math.round(combinedSeverity)
  };
}
