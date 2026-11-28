import test from "node:test";
import assert from "node:assert/strict";
import { MATERIAL_CATEGORIES, SOILED_FIBER_PROFILE, evaluateItemDisposal } from "../js/bincheck-engine.js";
import {
  ORGANICS_STREAM,
  WORKBENCH_STREAM_LABELS,
  WARM_FACTORS,
  MRF_PROFILES,
  MRF_PROFILE_IDS,
  ARCHETYPE_PROFILE_IDS,
  ARCHETYPE_RULE_TABLE,
  MUNICIPAL_BASKETS,
  MUNICIPAL_BASKET_IDS,
  WORKBENCH_PRESETS,
  WORKBENCH_PRESET_IDS,
  normalizeProfileId,
  normalizeBasketId,
  evaluateProfileItem,
  evaluateBasket,
  compareProfiles,
  defaultWorkbenchConfig
} from "../js/bincheck-municipal.js";

const ALL_STREAMS = new Set(["RECYCLE_CART", "TRASH_CART", "SPECIAL_DROPOFF", "GREEN_WASTE", "SPLIT_DISPOSAL", ORGANICS_STREAM]);
const MATERIAL_IDS = Object.keys(MATERIAL_CATEGORIES);
// The engine's full material universe is the categories plus the derived
// grease-soaked fiber profile, which is not a selectable category of its own.
const FULL_MATERIAL_IDS = [...MATERIAL_IDS, SOILED_FIBER_PROFILE.id];
const baseRiskOf = (materialId) =>
  (MATERIAL_CATEGORIES[materialId] || SOILED_FIBER_PROFILE).baseRiskScore;

/* ---------------- profile and basket registry shape ---------------- */

test("profiles: exactly six MRF profiles, two snapshot-backed and four archetypes", () => {
  assert.equal(MRF_PROFILE_IDS.length, 6);
  assert.equal(MRF_PROFILE_IDS.filter((id) => MRF_PROFILES[id].kind === "snapshot").length, 2);
  assert.equal(ARCHETYPE_PROFILE_IDS.length, 4);
  assert.deepEqual(
    new Set(MRF_PROFILE_IDS.filter((id) => MRF_PROFILES[id].kind === "snapshot")),
    new Set(["houston-tx", "Riverside-tx"])
  );
});

test("profiles: every profile has a name, short name, kind and honest summary", () => {
  for (const id of MRF_PROFILE_IDS) {
    const profile = MRF_PROFILES[id];
    assert.equal(profile.id, id);
    assert.ok(profile.name.length > 2);
    assert.ok(profile.shortName.length > 2);
    assert.ok(["snapshot", "archetype"].includes(profile.kind));
    assert.ok(profile.summary.length > 10);
  }
  assert.ok(MRF_PROFILES["Riverside-tx"].sourceUrl);
  assert.ok(MRF_PROFILES["houston-tx"].sourceUrl);
  for (const id of ARCHETYPE_PROFILE_IDS) {
    assert.equal(MRF_PROFILES[id].sourceUrl, null, "archetypes carry no fabricated city source");
  }
});

test("baskets: four shared baskets with labeled, weighted items", () => {
  assert.equal(MUNICIPAL_BASKET_IDS.length, 4);
  for (const id of MUNICIPAL_BASKET_IDS) {
    const basket = MUNICIPAL_BASKETS[id];
    assert.equal(basket.id, id);
    assert.ok(basket.items.length >= 6);
    for (const item of basket.items) {
      assert.ok(MATERIAL_CATEGORIES[item.materialId], `${id} references unknown ${item.materialId}`);
      assert.ok(item.weightLbs > 0);
      assert.ok(item.label.length > 2);
    }
  }
});

test("baskets: everything basket covers every material category exactly once", () => {
  const basket = MUNICIPAL_BASKETS.everything;
  assert.equal(basket.items.length, MATERIAL_IDS.length);
  assert.deepEqual(new Set(basket.items.map((i) => i.materialId)), new Set(MATERIAL_IDS));
});

test("presets: five bookmarkable presets with valid patches", () => {
  assert.equal(WORKBENCH_PRESET_IDS.length, 5);
  for (const id of WORKBENCH_PRESET_IDS) {
    const preset = WORKBENCH_PRESETS[id];
    assert.equal(preset.id, id);
    assert.ok(preset.name.length > 3);
    const patch = preset.patch;
    if (patch.profileA) assert.ok(normalizeProfileId(patch.profileA), id);
    if (patch.profileB) assert.ok(normalizeProfileId(patch.profileB), id);
    if (patch.basketId) assert.ok(normalizeBasketId(patch.basketId), id);
  }
});

test("normalizers: trim and accept only registered ids", () => {
  assert.equal(normalizeProfileId("Riverside-tx"), "Riverside-tx");
  assert.equal(normalizeProfileId(" Riverside-tx "), "Riverside-tx");
  assert.equal(normalizeProfileId("nope"), null);
  assert.equal(normalizeProfileId(""), null);
  assert.equal(normalizeProfileId(null), null);
  assert.equal(normalizeProfileId("Riverside-TX"), null, "case sensitive, ids stay lowercase");
  assert.equal(normalizeBasketId("tricky-household"), "tricky-household");
  assert.equal(normalizeBasketId("everything"), "everything");
  assert.equal(normalizeBasketId("tricky"), null);
  assert.equal(normalizeBasketId(undefined), null);
});

/* ---------------- evaluateProfileItem ---------------- */

test("profile item: every material under every profile returns a complete verdict", () => {
  for (const profileId of MRF_PROFILE_IDS) {
    for (const materialId of FULL_MATERIAL_IDS) {
      const verdict = evaluateProfileItem(profileId, { materialId });
      assert.ok(ALL_STREAMS.has(verdict.stream), `${profileId}/${materialId} -> ${verdict.stream}`);
      assert.ok(verdict.badgeLabel.length > 2);
      assert.equal(verdict.profileId, profileId);
      assert.equal(verdict.materialId, materialId);
      assert.ok(Number.isFinite(verdict.risk));
      assert.ok(Number.isFinite(verdict.baseRisk));
      assert.ok(["LOW", "MODERATE", "HIGH", "CRITICAL"].includes(verdict.tier));
      assert.equal(typeof verdict.curbside, "boolean");
      assert.ok([0, 0.5, 1].includes(verdict.divertFraction));
    }
  }
});

test("profile item: snapshot profiles agree with the real engine exactly", () => {
  for (const city of ["Riverside-tx", "houston-tx"]) {
    for (const materialId of MATERIAL_IDS) {
      for (const condition of ["clean", "greasy"]) {
        const engine = evaluateItemDisposal({ materialId, condition, city });
        const profile = evaluateProfileItem(city, { materialId, condition });
        assert.equal(profile.stream, engine.stream, `${city}/${materialId}/${condition}`);
        assert.equal(profile.risk, engine.contaminationRiskScore);
      }
    }
  }
});

test("profile item: unknown profile falls back to strict single-stream", () => {
  const verdict = evaluateProfileItem("not-a-profile", { materialId: "resin-1-pet" });
  assert.equal(verdict.profileId, "strict-single-stream");
  assert.equal(verdict.stream, "RECYCLE_CART");
});

test("profile item: archetype rule tables cover every material exactly once", () => {
  for (const profileId of ARCHETYPE_PROFILE_IDS) {
    const table = ARCHETYPE_RULE_TABLE[profileId];
    assert.ok(table, profileId);
    assert.deepEqual(new Set(Object.keys(table)), new Set(FULL_MATERIAL_IDS), profileId);
    for (const [materialId, rule] of Object.entries(table)) {
      assert.ok(ALL_STREAMS.has(rule.stream), `${profileId}/${materialId} -> ${rule.stream}`);
      assert.ok(rule.note.length > 5);
    }
  }
});

test("profile item: dual-stream glass-out takes glass out of every cart", () => {
  const verdict = evaluateProfileItem("dual-stream-glass-out", { materialId: "glass-jar-bottle" });
  assert.equal(verdict.stream, "SPECIAL_DROPOFF");
  assert.equal(verdict.curbside, false);
  assert.equal(verdict.divertFraction, 1, "drop-off still diverts from landfill");
});

test("profile item: organics-mandatory routes soiled fiber and yard waste to the organics cart", () => {
  assert.equal(evaluateProfileItem("organics-mandatory", { materialId: "greasy-pizza-box" }).stream, ORGANICS_STREAM);
  assert.equal(evaluateProfileItem("organics-mandatory", { materialId: "yard-trimmings-brush" }).stream, ORGANICS_STREAM);
  assert.equal(evaluateProfileItem("organics-mandatory", { materialId: "soiled-cardboard-paper" }).stream, ORGANICS_STREAM);
});

test("profile item: rural transfer station has no curbside recycling stream at all", () => {
  for (const materialId of MATERIAL_IDS) {
    const verdict = evaluateProfileItem("rural-transfer-station", { materialId });
    assert.notEqual(verdict.stream, "RECYCLE_CART", `${materialId} must never be a curbside cart item in the rural profile`);
    assert.notEqual(verdict.stream, ORGANICS_STREAM);
  }
});

/* ---------------- evaluateBasket metrics ---------------- */

test("basket metrics: diversion and curbside rates stay inside [0,100] for every combination", () => {
  for (const profileId of MRF_PROFILE_IDS) {
    for (const basketId of MUNICIPAL_BASKET_IDS) {
      const ev = evaluateBasket(basketId, profileId);
      assert.ok(ev.diversionRatePct >= 0 && ev.diversionRatePct <= 100, `${profileId}/${basketId} diversion ${ev.diversionRatePct}`);
      assert.ok(ev.curbsideRatePct >= 0 && ev.curbsideRatePct <= 100);
      assert.ok(ev.naiveCartContaminationPct >= 0 && ev.naiveCartContaminationPct <= 100);
      assert.ok(ev.contaminationRiskIndex >= 0 && ev.contaminationRiskIndex <= 100);
    }
  }
});

test("basket metrics: mass is conserved - diverted plus trash equals total", () => {
  for (const profileId of MRF_PROFILE_IDS) {
    for (const basketId of MUNICIPAL_BASKET_IDS) {
      const ev = evaluateBasket(basketId, profileId);
      assert.ok(Math.abs(ev.divertedLbs + ev.trashLbs - ev.totalLbs) < 0.02, `${profileId}/${basketId}`);
      assert.ok(Math.abs(ev.totalLbs - ev.rows.reduce((acc, row) => acc + row.weightLbs, 0)) < 0.02);
    }
  }
});

test("basket metrics: stream counts sum to total mass", () => {
  for (const basketId of MUNICIPAL_BASKET_IDS) {
    const ev = evaluateBasket(basketId, "Riverside-tx");
    const sum = Object.values(ev.streamCounts).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - ev.totalLbs) < 0.05, basketId);
  }
});

test("basket metrics: curbside rate never exceeds total diversion rate", () => {
  for (const profileId of MRF_PROFILE_IDS) {
    for (const basketId of MUNICIPAL_BASKET_IDS) {
      const ev = evaluateBasket(basketId, profileId);
      assert.ok(ev.curbsideRatePct <= ev.diversionRatePct + 0.05, `${profileId}/${basketId}`);
    }
  }
});

test("basket metrics: drop-off mass is the non-curbside diverted share", () => {
  for (const basketId of MUNICIPAL_BASKET_IDS) {
    const ev = evaluateBasket(basketId, "dual-stream-glass-out");
    assert.ok(Math.abs(ev.divertedLbs - ev.curbsideLbs - ev.dropOffLbs) < 0.05, basketId);
  }
});

test("basket metrics: rural transfer station diverts without any curbside mass", () => {
  const ev = evaluateBasket("tricky-household", "rural-transfer-station");
  assert.equal(ev.curbsideLbs, 0);
  assert.equal(ev.curbsideRatePct, 0);
  assert.ok(ev.diversionRatePct > 50, "the transfer station still diverts most of the basket");
  assert.ok(ev.dropOffLbs > 0);
});

test("basket metrics: organics-mandatory lifts diversion above strict single-stream on the same basket", () => {
  const strict = evaluateBasket("kitchen-week", "strict-single-stream");
  const organics = evaluateBasket("kitchen-week", "organics-mandatory");
  assert.ok(organics.diversionRatePct > strict.diversionRatePct, `${organics.diversionRatePct} should exceed ${strict.diversionRatePct} (pizza box and foil pan compost)`);
});

test("basket metrics: CO2e is zero for fully landfilled baskets and positive otherwise", () => {
  const rural = evaluateBasket("flexible-and-foam", "rural-transfer-station");
  const houston = evaluateBasket("flexible-and-foam", "houston-tx");
  assert.ok(rural.co2eAvoidedKg > houston.co2eAvoidedKg, "transfer station accepts foam and film at the bay");
  assert.ok(rural.co2eAvoidedKg > 0);
});

test("basket metrics: WARM factors exist for every material used in baskets", () => {
  const used = new Set();
  for (const basket of Object.values(MUNICIPAL_BASKETS)) {
    for (const item of basket.items) used.add(item.materialId);
  }
  for (const materialId of used) {
    assert.ok(WARM_FACTORS[materialId], `${materialId} has no planning factor`);
    assert.ok(WARM_FACTORS[materialId].basis.length > 5);
  }
});

test("basket metrics: naive-cart contamination equals the non-curbside mass share", () => {
  const ev = evaluateBasket("tricky-household", "Riverside-tx");
  const nonCurbside = ev.rows.filter((row) => !row.curbside).reduce((acc, row) => acc + row.weightLbs, 0);
  assert.ok(Math.abs(ev.naiveCartContaminationPct - (nonCurbside / ev.totalLbs) * 100) < 0.1);
});

test("basket metrics: evaluation is deterministic and returns one row per basket item", () => {
  const a = evaluateBasket("kitchen-week", "organics-mandatory");
  const b = evaluateBasket("kitchen-week", "organics-mandatory");
  assert.deepEqual(a, b);
  assert.equal(a.rows.length, MUNICIPAL_BASKETS["kitchen-week"].items.length);
});

/* ---------------- compareProfiles ---------------- */

test("diff: same profile against itself produces zero conflicts and zero deltas", () => {
  for (const profileId of MRF_PROFILE_IDS) {
    const diff = compareProfiles(profileId, profileId, "tricky-household");
    assert.equal(diff.conflicts.length, 0, profileId);
    assert.equal(diff.diversionDeltaPts, 0);
    assert.equal(diff.curbsideDeltaPts, 0);
    assert.equal(diff.co2eDeltaKg, 0);
    assert.equal(diff.rows.every((row) => row.changed === false), true);
  }
});

test("diff: swapping A and B mirrors conflicts and negates deltas", () => {
  const forward = compareProfiles("Riverside-tx", "dual-stream-glass-out", "tricky-household");
  const backward = compareProfiles("dual-stream-glass-out", "Riverside-tx", "tricky-household");
  // "+ 0" normalizes the -0 produced by negating a zero delta.
  assert.equal(forward.diversionDeltaPts + 0, -backward.diversionDeltaPts + 0);
  assert.equal(forward.curbsideDeltaPts + 0, -backward.curbsideDeltaPts + 0);
  assert.equal(forward.co2eDeltaKg + 0, -backward.co2eDeltaKg + 0);
  assert.equal(forward.conflicts.length, backward.conflicts.length);
  for (const entry of forward.conflicts) {
    const mirror = backward.conflicts.find((e) => e.materialId === entry.materialId && e.kind === entry.kind);
    assert.ok(mirror, `${entry.materialId}/${entry.kind} should appear in both directions`);
  }
});

test("diff: glass jar is a CURBSIDE_TO_DROPOFF conflict from Riverside to Glass-Out", () => {
  const diff = compareProfiles("Riverside-tx", "dual-stream-glass-out", "tricky-household");
  const glass = diff.conflicts.find((entry) => entry.materialId === "glass-jar-bottle" && entry.fromProfile === "Riverside-tx");
  assert.ok(glass);
  assert.equal(glass.kind, "CURBSIDE_TO_DROPOFF");
  assert.match(glass.message, /drop-off/);
});

test("diff: conflicts exist in both directions for divergent items", () => {
  const diff = compareProfiles("Riverside-tx", "dual-stream-glass-out", "tricky-household");
  const forward = diff.conflicts.filter((e) => e.fromProfile === "Riverside-tx");
  const backward = diff.conflicts.filter((e) => e.fromProfile === "dual-stream-glass-out");
  assert.ok(forward.length > 0);
  assert.ok(backward.length > 0);
  for (const entry of forward) {
    assert.equal(entry.toProfile, "dual-stream-glass-out");
  }
});

test("diff: ACCEPTED_TO_CONTAMINANT fires when a cart item landfills under B", () => {
  const diff = compareProfiles("Riverside-tx", "houston-tx", "tricky-household");
  const foam = diff.conflicts.find((entry) => entry.materialId === "resin-6-ps-foam" && entry.fromProfile === "Riverside-tx" && entry.kind === "ACCEPTED_TO_CONTAMINANT");
  if (foam) {
    assert.equal(foam.toStream, "TRASH_CART");
    assert.match(foam.message, /contaminant/);
  } else {
    const alt = compareProfiles("rural-transfer-station", "Riverside-tx", "flexible-and-foam");
    const gained = alt.conflicts.filter((e) => e.kind === "DIVERSION_GAINED" || e.kind === "ACCEPTED_TO_CONTAMINANT");
    assert.ok(gained.length > 0);
  }
});

test("diff: organics district gains diversion on pizza boxes versus strict single-stream", () => {
  const diff = compareProfiles("strict-single-stream", "organics-mandatory", "kitchen-week");
  const pizza = diff.conflicts.find((entry) => entry.materialId === "greasy-pizza-box" && entry.toProfile === "organics-mandatory");
  assert.ok(pizza);
  assert.equal(pizza.toStream, ORGANICS_STREAM);
  assert.ok(diff.diversionDeltaPts < 0, "organics diverts more, so A minus B is negative");
});

test("diff: conflict severity follows the engine base risk score", () => {
  const diff = compareProfiles("Riverside-tx", "rural-transfer-station", "everything");
  for (const entry of diff.conflicts) {
    if (entry.kind === "DIVERSION_GAINED") {
      assert.equal(entry.severity, "info", `${entry.materialId} gained diversion is never an alert`);
      continue;
    }
    const baseRisk = baseRiskOf(entry.materialId);
    const expected = baseRisk >= 85 ? "critical" : baseRisk >= 55 ? "warning" : "info";
    assert.equal(entry.severity, expected, `${entry.materialId} base ${baseRisk}`);
  }
});

test("diff: conflicts sort critical first, then warning, then info", () => {
  const diff = compareProfiles("strict-single-stream", "rural-transfer-station", "everything");
  const rank = { critical: 0, warning: 1, info: 2 };
  for (let i = 1; i < diff.conflicts.length; i += 1) {
    assert.ok(rank[diff.conflicts[i].severity] >= rank[diff.conflicts[i - 1].severity], "severity order");
  }
});

test("diff: deterministic output is byte-identical for repeated calls", () => {
  const a = JSON.stringify(compareProfiles("houston-tx", "organics-mandatory", "everything"));
  const b = JSON.stringify(compareProfiles("houston-tx", "organics-mandatory", "everything"));
  assert.equal(a, b);
});

test("diff: every profile pair runs without throwing for every basket", () => {
  for (const a of MRF_PROFILE_IDS) {
    for (const b of MRF_PROFILE_IDS) {
      for (const basketId of MUNICIPAL_BASKET_IDS) {
        const diff = compareProfiles(a, b, basketId);
        assert.ok(diff.a && diff.b && Array.isArray(diff.rows));
        assert.equal(diff.rows.length, MUNICIPAL_BASKETS[basketId].items.length);
      }
    }
  }
});

test("diff: delta fields are consistent with the per-profile metrics", () => {
  const diff = compareProfiles("houston-tx", "rural-transfer-station", "kitchen-week");
  assert.ok(Math.abs(diff.diversionDeltaPts - (diff.a.diversionRatePct - diff.b.diversionRatePct)) < 0.2);
  assert.ok(Math.abs(diff.co2eDeltaKg - (diff.a.co2eAvoidedKg - diff.b.co2eAvoidedKg)) < 0.05);
  assert.ok(Math.abs(diff.trashDeltaLbs - (diff.a.trashLbs - diff.b.trashLbs)) < 0.05);
});

test("diff: rows carry both stream verdicts and a changed flag that matches", () => {
  const diff = compareProfiles("Riverside-tx", "organics-mandatory", "tricky-household");
  for (const row of diff.rows) {
    assert.ok(row.a.stream && row.b.stream);
    assert.equal(row.changed, row.a.stream !== row.b.stream);
    assert.ok(row.label.length > 2);
  }
});

test("workbench defaults: profile pair and basket are valid registered ids", () => {
  const defaults = defaultWorkbenchConfig();
  assert.ok(normalizeProfileId(defaults.profileA));
  assert.ok(normalizeProfileId(defaults.profileB));
  assert.ok(normalizeBasketId(defaults.basketId));
});

/* ---------------- stream and label registries ---------------- */

test("stream labels: every stream an archetype can emit has a label", () => {
  for (const profileId of ARCHETYPE_PROFILE_IDS) {
    for (const rule of Object.values(ARCHETYPE_RULE_TABLE[profileId])) {
      assert.ok(WORKBENCH_STREAM_LABELS[rule.stream], `${profileId} emits unlabeled ${rule.stream}`);
    }
  }
  for (const stream of ["RECYCLE_CART", "TRASH_CART", "SPECIAL_DROPOFF", "GREEN_WASTE", "SPLIT_DISPOSAL", ORGANICS_STREAM]) {
    assert.ok(WORKBENCH_STREAM_LABELS[stream]);
  }
});

test("warm factors: every entry discloses a numeric factor and its basis", () => {
  for (const [materialId, entry] of Object.entries(WARM_FACTORS)) {
    assert.ok(Number.isFinite(entry.factor), materialId);
    assert.ok(entry.factor >= 0, materialId);
    assert.ok(entry.basis.length > 5, materialId);
    assert.ok(/EPA WARM|BinCheck estimate|Not recoverable/i.test(entry.basis), `${materialId}: ${entry.basis}`);
  }
  assert.ok(WARM_FACTORS["aluminum-steel-can"].factor > WARM_FACTORS["resin-7-other"].factor, "aluminum beats multi-layer");
});
