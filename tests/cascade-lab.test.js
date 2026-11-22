import test from "node:test";
import assert from "node:assert/strict";
import { MATERIAL_CATEGORIES, evaluateItemDisposal } from "../js/bincheck-engine.js";
import {
  CASCADE_MAX_COUNT,
  CASCADE_SCENARIOS,
  CASCADE_SCENARIO_IDS,
  normalizeCascadeId,
  clampCascadeCount,
  simulateCascade,
  runCascadeLab
} from "../js/bincheck-cascade.js";

/* ---------------- registry shape ---------------- */

test("scenarios: five documented hazard cascades, one per top contaminant", () => {
  assert.equal(CASCADE_SCENARIO_IDS.length, 5);
  for (const id of CASCADE_SCENARIO_IDS) {
    const scenario = CASCADE_SCENARIOS[id];
    assert.equal(scenario.id, id);
    assert.ok(scenario.title.length > 5);
    assert.ok(scenario.headline.length > 10);
    assert.ok(scenario.alternative.length > 20, `${id} must name a safe-disposal alternative`);
    assert.ok(MATERIAL_CATEGORIES[scenario.materialId], `${id} anchors to a real material`);
  }
});

test("scenarios: stage thresholds are strictly increasing within each table", () => {
  for (const id of CASCADE_SCENARIO_IDS) {
    const ats = CASCADE_SCENARIOS[id].stages.map((s) => s.at);
    for (let i = 1; i < ats.length; i += 1) {
      assert.ok(ats[i] > ats[i - 1], `${id} stage ${i} threshold must exceed the previous one`);
      assert.ok(ats[i] <= CASCADE_MAX_COUNT, `${id} stage ${i} must be reachable at the slider max`);
    }
    assert.equal(ats[0], 1, `${id} first stage engages at one contaminated item`);
  }
});

test("scenarios: every stage contributes a nonnegative impact", () => {
  for (const id of CASCADE_SCENARIO_IDS) {
    for (const stage of CASCADE_SCENARIOS[id].stages) {
      assert.ok(stage.severity > 0, `${id}/${stage.name}`);
      assert.ok(stage.downtimeMin >= 0);
      assert.ok(stage.baleHit >= 0);
      assert.ok(stage.name.length > 3 && stage.detail.length > 10);
    }
  }
});

test("scenarios: lithium cascade is the fastest to facility emergency", () => {
  const atTwo = {};
  for (const id of CASCADE_SCENARIO_IDS) {
    const two = simulateCascade(id, { count: 2 });
    atTwo[id] = two.severity;
  }
  assert.equal(atTwo["lithium-ignition"], Math.max(...Object.values(atTwo)), "two batteries outrank any other pair of contaminants");
});

/* ---------------- normalizers ---------------- */

test("normalizeCascadeId: accepts registered ids, rejects anything else", () => {
  for (const id of CASCADE_SCENARIO_IDS) assert.equal(normalizeCascadeId(id), id);
  assert.equal(normalizeCascadeId(" film-tangler "), "film-tangler");
  assert.equal(normalizeCascadeId("Film-Tangler"), null);
  assert.equal(normalizeCascadeId(""), null);
  assert.equal(normalizeCascadeId(null), null);
  assert.equal(normalizeCascadeId({}), null);
});

test("clampCascadeCount: rounds, floors at zero, caps at the slider max", () => {
  assert.equal(clampCascadeCount(0), 0);
  assert.equal(clampCascadeCount(3), 3);
  assert.equal(clampCascadeCount(3.6), 4);
  assert.equal(clampCascadeCount(-5), 0);
  assert.equal(clampCascadeCount(999), CASCADE_MAX_COUNT);
  assert.equal(clampCascadeCount("7"), 7);
  assert.equal(clampCascadeCount("junk"), 0);
  assert.equal(clampCascadeCount(null), 0);
  assert.equal(clampCascadeCount(undefined), 0);
  assert.equal(clampCascadeCount(Infinity), 0);
  assert.equal(clampCascadeCount(NaN), 0);
});

/* ---------------- simulateCascade ---------------- */

test("simulate: zero count means a clear cart with no reached stages", () => {
  for (const id of CASCADE_SCENARIO_IDS) {
    const result = simulateCascade(id, { count: 0 });
    assert.equal(result.alertLevel, "CLEAR");
    assert.equal(result.reachedCount, 0);
    assert.equal(result.severity, 0);
    assert.equal(result.downtimeMin, 0);
    assert.equal(result.baleYieldPct, 100);
    assert.equal(result.stages.every((s) => !s.reached), true);
  }
});

test("simulate: unknown scenario id returns null, never throws", () => {
  assert.equal(simulateCascade("not-a-scenario", { count: 5 }), null);
  assert.equal(simulateCascade("", { count: 5 }), null);
});

test("simulate: severity, downtime and bale yield are monotonic in count", () => {
  for (const id of CASCADE_SCENARIO_IDS) {
    let prevSeverity = -1;
    let prevDowntime = -1;
    let prevYield = 101;
    for (let count = 0; count <= CASCADE_MAX_COUNT; count += 1) {
      const result = simulateCascade(id, { count });
      assert.ok(result.severity >= prevSeverity, `${id} severity dipped at ${count}`);
      assert.ok(result.downtimeMin >= prevDowntime, `${id} downtime dipped at ${count}`);
      assert.ok(result.baleYieldPct <= prevYield, `${id} bale yield rose at ${count}`);
      prevSeverity = result.severity;
      prevDowntime = result.downtimeMin;
      prevYield = result.baleYieldPct;
    }
  }
});

test("simulate: severity is capped at 100 and bale yield floored at 0", () => {
  for (const id of CASCADE_SCENARIO_IDS) {
    const maxed = simulateCascade(id, { count: CASCADE_MAX_COUNT });
    assert.ok(maxed.severity <= 100, id);
    assert.ok(maxed.baleYieldPct >= 0, id);
    assert.equal(maxed.reachedCount, maxed.stageCount, `all ${id} stages reached at max`);
  }
});

test("simulate: lithium is never curbside - the engine routes it to special drop-off", () => {
  for (const city of ["Riverside-tx", "houston-tx"]) {
    const result = simulateCascade("lithium-ignition", { count: 3, city });
    assert.equal(result.itemStream, "SPECIAL_DROPOFF");
    assert.equal(result.itemRisk, 100);
  }
});

test("simulate: stage reached flags line up exactly with the count", () => {
  const result = simulateCascade("film-tangler", { count: 4 });
  assert.deepEqual(result.stages.map((s) => s.reached), [true, true, true, false]);
  assert.equal(result.reachedCount, 3);
});

test("simulate: alert level tiers follow severity exactly", () => {
  const cases = [];
  for (const id of CASCADE_SCENARIO_IDS) {
    for (let count = 0; count <= CASCADE_MAX_COUNT; count += 1) {
      cases.push(simulateCascade(id, { count }));
    }
  }
  for (const result of cases) {
    const expected =
      result.severity >= 85 ? "FACILITY_EMERGENCY"
      : result.severity >= 55 ? "LINE_STOP"
      : result.severity >= 25 ? "PROCESS_DAMAGE"
      : result.count > 0 ? "CONTAMINANT_PRESENT" : "CLEAR";
    assert.equal(result.alertLevel, expected, `${result.scenarioId} @ ${result.count} sev ${result.severity}`);
  }
});

test("simulate: one battery already triggers process damage, two reach line stop territory", () => {
  const one = simulateCascade("lithium-ignition", { count: 1 });
  assert.equal(one.alertLevel, "PROCESS_DAMAGE");
  const two = simulateCascade("lithium-ignition", { count: 2 });
  assert.ok(two.severity >= 55);
  assert.equal(two.alertLevel, "LINE_STOP");
  const six = simulateCascade("lithium-ignition", { count: 6 });
  assert.equal(six.alertLevel, "FACILITY_EMERGENCY");
});

test("simulate: out-of-range counts clamp rather than throwing", () => {
  const result = simulateCascade("film-tangler", { count: 999 });
  assert.equal(result.count, CASCADE_MAX_COUNT);
  assert.equal(simulateCascade("film-tangler", { count: -4 }).count, 0);
});

test("simulate: deterministic - repeated calls are identical", () => {
  const a = JSON.stringify(simulateCascade("grease-fiber", { count: 6 }));
  const b = JSON.stringify(simulateCascade("grease-fiber", { count: 6 }));
  assert.equal(a, b);
});

test("simulate: each scenario exposes the contaminant's real engine verdict", () => {
  for (const id of CASCADE_SCENARIO_IDS) {
    const result = simulateCascade(id, { count: 1, city: "houston-tx" });
    const engine = evaluateItemDisposal({ materialId: CASCADE_SCENARIOS[id].materialId, city: "houston-tx" });
    assert.equal(result.itemStream, engine.stream, id);
    assert.equal(result.itemTitle, engine.itemTitle);
    assert.equal(result.itemRisk, engine.contaminationRiskScore);
  }
});

test("simulate: results carry stage metadata for the UI to render", () => {
  const result = simulateCascade("sharps-hazmat", { count: 2 });
  for (const stage of result.stages) {
    assert.ok(typeof stage.at === "number");
    assert.ok(typeof stage.severity === "number");
    assert.ok(typeof stage.downtimeMin === "number");
    assert.ok(typeof stage.baleHit === "number");
    assert.equal(typeof stage.reached, "boolean");
  }
});

/* ---------------- runCascadeLab ---------------- */

test("lab: empty counts produce a clean lab with zero combined severity", () => {
  const lab = runCascadeLab({});
  assert.equal(lab.activeCount, 0);
  assert.equal(lab.totalItems, 0);
  assert.equal(lab.combinedSeverity, 0);
  assert.equal(lab.worstBaleYieldPct, 100);
  assert.equal(lab.results.length, CASCADE_SCENARIO_IDS.length);
});

test("lab: every registered scenario runs even when counts are missing", () => {
  const lab = runCascadeLab({ "film-tangler": 3 });
  assert.deepEqual(lab.results.map((r) => r.scenarioId).sort(), [...CASCADE_SCENARIO_IDS].sort());
  assert.equal(lab.activeCount, 1);
});

test("lab: unknown count keys are ignored, never throw", () => {
  const lab = runCascadeLab({ bogus: 99, "lithium-ignition": 1 });
  assert.equal(lab.activeCount, 1);
  assert.equal(lab.totalItems, 1);
});

test("lab: combined severity is dominated by the single worst cascade", () => {
  const only = runCascadeLab({ "lithium-ignition": 4 });
  const solo = only.results.find((r) => r.scenarioId === "lithium-ignition");
  assert.equal(only.combinedSeverity, Math.round(solo.severity));
});

test("lab: each additional active cascade adds a fifth of its severity", () => {
  const combo = runCascadeLab({ "lithium-ignition": 6, "film-tangler": 8 });
  const lithium = combo.results.find((r) => r.scenarioId === "lithium-ignition");
  const film = combo.results.find((r) => r.scenarioId === "film-tangler");
  const worst = Math.max(lithium.severity, film.severity);
  const other = Math.min(lithium.severity, film.severity);
  assert.equal(combo.combinedSeverity, Math.min(100, Math.round(worst + other / 5)));
});

test("lab: combined severity caps at 100 when several cascades run hot", () => {
  const all = {};
  for (const id of CASCADE_SCENARIO_IDS) all[id] = CASCADE_MAX_COUNT;
  const lab = runCascadeLab(all);
  assert.ok(lab.combinedSeverity <= 100);
  assert.equal(lab.combinedSeverity, 100, "five maxed cascades saturate the index");
});

test("lab: totals aggregate item counts and downtime across scenarios", () => {
  const lab = runCascadeLab({ "film-tangler": 4, "lithium-ignition": 2, "grease-fiber": 0 });
  assert.equal(lab.totalItems, 6);
  const expectedDowntime = lab.results.reduce((acc, r) => acc + r.downtimeMin, 0);
  assert.equal(lab.totalDowntimeMin, expectedDowntime);
});

test("lab: worst bale yield is the minimum across all scenarios", () => {
  const lab = runCascadeLab({ "grease-fiber": 6, "sharps-hazmat": 1 });
  const worst = Math.min(...lab.results.map((r) => r.baleYieldPct));
  assert.equal(lab.worstBaleYieldPct, worst);
  assert.equal(lab.worstBaleYieldPct, lab.results.find((r) => r.scenarioId === "grease-fiber").baleYieldPct);
});

test("lab: combined severity is monotonic as every slider rises", () => {
  let prev = -1;
  for (let count = 0; count <= CASCADE_MAX_COUNT; count += 1) {
    const lab = runCascadeLab({
      "film-tangler": count,
      "lithium-ignition": Math.min(count, 6),
      "liquid-bale": count,
      "grease-fiber": Math.max(0, count - 1),
      "sharps-hazmat": Math.max(0, count - 2)
    });
    assert.ok(lab.combinedSeverity >= prev, `combined severity dipped at ${count}`);
    prev = lab.combinedSeverity;
  }
});

test("lab: downtime and yield metrics are also monotonic across the full sweep", () => {
  let prevDowntime = -1;
  let prevYield = 101;
  for (let count = 0; count <= CASCADE_MAX_COUNT; count += 1) {
    const lab = runCascadeLab({ "film-tangler": count, "liquid-bale": count });
    assert.ok(lab.totalDowntimeMin >= prevDowntime);
    assert.ok(lab.worstBaleYieldPct <= prevYield);
    prevDowntime = lab.totalDowntimeMin;
    prevYield = lab.worstBaleYieldPct;
  }
});

test("lab: deterministic - identical inputs give byte-identical results", () => {
  const a = JSON.stringify(runCascadeLab({ "film-tangler": 3, "sharps-hazmat": 2 }));
  const b = JSON.stringify(runCascadeLab({ "film-tangler": 3, "sharps-hazmat": 2 }));
  assert.equal(a, b);
});

test("lab: cleanCount flows through to the results", () => {
  const lab = runCascadeLab({ "film-tangler": 2 }, { cleanCount: 30 });
  assert.equal(lab.cleanCount, 30);
  for (const result of lab.results) assert.equal(result.cleanCount, 30);
});

test("lab: film tangler preset scenario reaches the line-stop stage at its preset count", () => {
  const lab = runCascadeLab({ "film-tangler": 2 });
  const film = lab.results.find((r) => r.scenarioId === "film-tangler");
  assert.equal(film.reachedCount, 2);
  assert.ok(film.downtimeMin >= 15, "shaft wrap begins costing downtime at two tanglers");
});
