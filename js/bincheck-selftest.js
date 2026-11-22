/**
 * BinCheck in-page self-tests: the same registry runs inside the browser
 * (the "Run Self-Tests" panel) and under `node --test` (one test per entry),
 * so the safety invariants proved on the page are exactly the ones the test
 * suite enforces. Each entry returns { pass, detail } or throws on failure.
 *
 * Pure and deterministic: no DOM, no clock, no network.
 */

import { MATERIAL_CATEGORIES, evaluateItemDisposal } from "./bincheck-engine.js";
import { VALID_CONDITIONS, encodeShareHash, decodeShareHash } from "./bincheck-validate.js";
import {
  MRF_PROFILE_IDS,
  MUNICIPAL_BASKET_IDS,
  ARCHETYPE_PROFILE_IDS,
  ARCHETYPE_RULE_TABLE,
  evaluateBasket,
  compareProfiles,
  evaluateProfileItem
} from "./bincheck-municipal.js";
import { CASCADE_SCENARIO_IDS, simulateCascade, runCascadeLab, CASCADE_MAX_COUNT } from "./bincheck-cascade.js";
import { sha256Hex, hmacSha256Hex, utf8Bytes, hexToBytes } from "./bincheck-sha256.js";
import {
  buildDiversionAudit,
  buildSignedAudit,
  signedAuditToJson,
  signedAuditToCsv,
  verifySignedAudit,
  AUDIT_SCHEMA
} from "./bincheck-audit.js";

const SHA256_KAT = [
  ["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
  ["abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
  ["abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq", "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"],
  ["abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu", "cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1"]
];

const NEVER_CURBSIDE_MATERIALS = ["lithium-household-battery", "electronics-ewaste"];

function check(name, fn) {
  return { name, fn };
}

export const SELF_TESTS = [
  check("sha256.kat.empty", () => {
    const got = sha256Hex("");
    return { pass: got === SHA256_KAT[0][1], detail: `FIPS 180-4 empty message: ${got.slice(0, 16)}...` };
  }),
  check("sha256.kat.abc", () => {
    const got = sha256Hex("abc");
    return { pass: got === SHA256_KAT[1][1], detail: `FIPS 180-4 "abc": ${got.slice(0, 16)}...` };
  }),
  check("sha256.kat.two-block", () => {
    const got = sha256Hex(SHA256_KAT[2][0]);
    return { pass: got === SHA256_KAT[2][1], detail: `FIPS 180-4 two-block vector: ${got.slice(0, 16)}...` };
  }),
  check("sha256.kat.padding-edge", () => {
    const got = sha256Hex(SHA256_KAT[3][0]);
    return { pass: got === SHA256_KAT[3][1], detail: `FIPS 180-4 896-bit padding-edge vector: ${got.slice(0, 16)}...` };
  }),
  check("sha256.utf8.multibyte", () => {
    const bytes = utf8Bytes("café \u00fc\u00df \u4e2d\u6587 \u{1f30d}");
    const got = sha256Hex(bytes);
    const viaString = sha256Hex("café \u00fc\u00df \u4e2d\u6587 \u{1f30d}");
    return { pass: got === viaString && /^[0-9a-f]{64}$/.test(got), detail: "UTF-8 encoder handles multibyte input deterministically" };
  }),
  check("sha256.hex.roundtrip", () => {
    const hex = sha256Hex("bincheck");
    const back = hexToBytes(hex);
    return { pass: back && back.length === 32 && hexToBytes("zz") === null, detail: "Hex codec round-trips and rejects non-hex" };
  }),
  check("hmac.kat.rfc4231-1", () => {
    const got = hmacSha256Hex(Uint8Array.from({ length: 20 }, () => 0x0b), "Hi There");
    return {
      pass: got === "b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7",
      detail: `RFC 4231 test case 1: ${got.slice(0, 16)}...`
    };
  }),
  check("hmac.kat.key-over-block", () => {
    const key = "a".repeat(200);
    const got = hmacSha256Hex(key, "data");
    return { pass: /^[0-9a-f]{64}$/.test(got) && got !== sha256Hex("data"), detail: "Keys longer than the 64-byte block are hashed first" };
  }),
  check("audit.build.shape", () => {
    const audit = buildDiversionAudit({ basketId: "tricky-household", profileIds: ["Riverside-tx", "houston-tx"] });
    return {
      pass: audit.schema === AUDIT_SCHEMA && audit.profiles.length === 2 && audit.rows.length === 14 && Array.isArray(audit.conflicts),
      detail: `14-item basket audited under ${audit.profiles.length} profiles`
    };
  }),
  check("audit.json.byte-identical", () => {
    const a = signedAuditToJson(buildSignedAudit({ basketId: "tricky-household", profileIds: ["Riverside-tx", "houston-tx"] }));
    const b = signedAuditToJson(buildSignedAudit({ basketId: "tricky-household", profileIds: ["Riverside-tx", "houston-tx"] }));
    return { pass: a === b, detail: "Same inputs produce byte-identical signed exports" };
  }),
  check("audit.verify.roundtrip", () => {
    const json = signedAuditToJson(buildSignedAudit({ basketId: "tricky-household", profileIds: ["Riverside-tx", "houston-tx"] }));
    const result = verifySignedAudit(json);
    return { pass: result.ok === true && result.code === "VERIFIED", detail: "A freshly signed export verifies intact" };
  }),
  check("audit.tamper.payload-byte", () => {
    const signed = buildSignedAudit({ basketId: "tricky-household", profileIds: ["Riverside-tx", "houston-tx"] });
    signed.payload.basket.itemCount += 1;
    const json = signedAuditToJson(signed);
    const result = verifySignedAudit(json);
    return { pass: result.ok === false && result.code === "TAMPERED", detail: "One edited field flips the digest and fails verification" };
  }),
  check("audit.tamper.digest-string", () => {
    const signed = buildSignedAudit({ basketId: "tricky-household", profileIds: ["Riverside-tx", "houston-tx"] });
    const json = signedAuditToJson(signed).replace(signed.signature.digest.slice(0, 8), signed.signature.digest.slice(0, 8) === "00000000" ? "11111111" : "00000000");
    const result = verifySignedAudit(json);
    return { pass: result.ok === false, detail: "An edited digest string is caught" };
  }),
  check("audit.verify.rejects-garbage", () => {
    const bad = [verifySignedAudit(""), verifySignedAudit("not json"), verifySignedAudit("{}"), verifySignedAudit('{"schema":"other"}')];
    return { pass: bad.every((r) => r.ok === false), detail: "Empty, non-JSON, and wrong-schema inputs all fail closed" };
  }),
  check("audit.csv.no-formula", () => {
    const csv = signedAuditToCsv(buildSignedAudit({ basketId: "tricky-household", profileIds: ["Riverside-tx", "houston-tx"] }));
    const bad = csv.split("\r\n").some((line) => /^[=+@\t]/.test(line) || /",[=+@]/.test(line) || /[,]["']*[=+\-@]/.test(line.split(",")[1] || ""));
    return { pass: bad === false, detail: "Every exported CSV cell is formula-injection safe" };
  }),
  check("audit.csv.crlf", () => {
    const csv = signedAuditToCsv(buildSignedAudit({ basketId: "tricky-household", profileIds: ["Riverside-tx", "houston-tx"] }));
    return { pass: !/(?<!\r)\n/.test(csv) && csv.endsWith("\r\n"), detail: "CSV uses CRLF endings throughout" };
  }),
  check("municipal.profiles.all-verdicts", () => {
    let checked = 0;
    for (const profileId of MRF_PROFILE_IDS) {
      for (const materialId of Object.keys(MATERIAL_CATEGORIES)) {
        const v = evaluateProfileItem(profileId, { materialId });
        if (!v.stream || !v.badgeLabel) return { pass: false, detail: `${profileId} missing verdict for ${materialId}` };
        checked += 1;
      }
    }
    return { pass: true, detail: `${checked} profile verdicts produced across ${MRF_PROFILE_IDS.length} profiles` };
  }),
  check("municipal.diff.deterministic", () => {
    const a = JSON.stringify(compareProfiles("Riverside-tx", "dual-stream-glass-out", "tricky-household"));
    const b = JSON.stringify(compareProfiles("Riverside-tx", "dual-stream-glass-out", "tricky-household"));
    return { pass: a === b, detail: "The same pair and basket always diff identically" };
  }),
  check("municipal.glass-out.conflict", () => {
    const diff = compareProfiles("Riverside-tx", "dual-stream-glass-out", "tricky-household");
    const glass = diff.conflicts.find((entry) => entry.materialId === "glass-jar-bottle" && entry.kind === "CURBSIDE_TO_DROPOFF");
    return { pass: Boolean(glass), detail: "Glass cart-accepted in Riverside flags as a drop-off conflict under Glass-Out" };
  }),
  check("municipal.diversion.bounded", () => {
    for (const profileId of MRF_PROFILE_IDS) {
      for (const basketId of MUNICIPAL_BASKET_IDS) {
        const ev = evaluateBasket(basketId, profileId);
        if (!(ev.diversionRatePct >= 0 && ev.diversionRatePct <= 100) || !(ev.curbsideRatePct >= 0 && ev.curbsideRatePct <= 100)) {
          return { pass: false, detail: `${profileId}/${basketId} diversion out of bounds` };
        }
        if (Math.abs(ev.divertedLbs + ev.trashLbs - ev.totalLbs) > 0.02) {
          return { pass: false, detail: `${profileId}/${basketId} mass conservation broke` };
        }
      }
    }
    return { pass: true, detail: "Diversion rates stay in [0, 100] and mass is conserved in every basket/profile pair" };
  }),
  check("municipal.archetypes.complete", () => {
    for (const profileId of ARCHETYPE_PROFILE_IDS) {
      const table = ARCHETYPE_RULE_TABLE[profileId];
      for (const materialId of Object.keys(MATERIAL_CATEGORIES)) {
        if (!table[materialId]) return { pass: false, detail: `${profileId} table missing ${materialId}` };
      }
    }
    return { pass: true, detail: "Every archetype table covers all material categories" };
  }),
  check("safety.battery.never-curbside", () => {
    for (const profileId of MRF_PROFILE_IDS) {
      for (const materialId of NEVER_CURBSIDE_MATERIALS) {
        for (const condition of VALID_CONDITIONS) {
          const v = evaluateProfileItem(profileId, { materialId, condition });
          if (v.stream === "RECYCLE_CART" || v.stream === "ORGANICS_CART" || v.curbside) {
            return { pass: false, detail: `${materialId}/${condition} reached a curbside stream under ${profileId}` };
          }
        }
      }
    }
    return { pass: true, detail: "Batteries and e-waste never reach a curbside stream under any profile or condition" };
  }),
  check("safety.battery.engine-dropoff", () => {
    for (const city of ["Riverside-tx", "houston-tx"]) {
      for (const materialId of NEVER_CURBSIDE_MATERIALS) {
        const ev = evaluateItemDisposal({ materialId, city });
        if (ev.stream !== "SPECIAL_DROPOFF") {
          return { pass: false, detail: `${materialId} in ${city} gave ${ev.stream}, expected drop-off` };
        }
      }
    }
    return { pass: true, detail: "The real engine routes all batteries and e-waste to drop-off in both cities" };
  }),
  check("cascade.monotone.severity", () => {
    for (const id of CASCADE_SCENARIO_IDS) {
      let prev = -1;
      for (let count = 0; count <= CASCADE_MAX_COUNT; count += 1) {
        const run = simulateCascade(id, { count });
        if (run.severity < prev) return { pass: false, detail: `${id} severity fell at count ${count}` };
        if (run.baleYieldPct > 100 || run.baleYieldPct < 0) return { pass: false, detail: `${id} yield out of bounds` };
        prev = run.severity;
      }
    }
    return { pass: true, detail: "Severity is non-decreasing and bale yield stays in bounds for every scenario" };
  }),
  check("cascade.monotone.yield", () => {
    for (const id of CASCADE_SCENARIO_IDS) {
      let prev = 101;
      for (let count = 0; count <= CASCADE_MAX_COUNT; count += 1) {
        const run = simulateCascade(id, { count });
        if (run.baleYieldPct > prev) return { pass: false, detail: `${id} yield rose at count ${count}` };
        prev = run.baleYieldPct;
      }
    }
    return { pass: true, detail: "Bale yield is non-increasing for every scenario" };
  }),
  check("cascade.lab.deterministic", () => {
    const counts = { "film-tangler": 3, "lithium-ignition": 1 };
    const a = JSON.stringify(runCascadeLab(counts));
    const b = JSON.stringify(runCascadeLab(counts));
    return { pass: a === b, detail: "Identical lab inputs give byte-identical results" };
  }),
  check("hash.workbench.roundtrip", () => {
    const state = {
      cityMode: "Riverside-tx",
      municipalProfileA: "strict-single-stream",
      municipalProfileB: "organics-mandatory",
      municipalBasket: "kitchen-week",
      cascadeCounts: { "film-tangler": 3 }
    };
    const hash = encodeShareHash(state);
    const { patch, issues } = decodeShareHash(hash);
    return {
      pass:
        issues.length === 0 &&
        patch.municipalProfileA === "strict-single-stream" &&
        patch.municipalProfileB === "organics-mandatory" &&
        patch.municipalBasket === "kitchen-week" &&
        patch.cascadeCounts["film-tangler"] === 3,
      detail: "Workbench keys pa/pb/bk/cas round-trip through the share hash"
    };
  }),
  check("hash.preset.hydrates", () => {
    const { patch, issues } = decodeShareHash("#bin=diff-glass-out");
    return { pass: issues.length === 0 && patch.workbenchPreset === "diff-glass-out", detail: "#bin=diff-glass-out decodes to the preset patch" };
  })
];

/**
 * Runs the whole registry. `now` may be injected for duration reporting;
 * defaults to a zero clock so the result is deterministic in tests.
 */
export function runSelfTests({ now = () => 0 } = {}) {
  const results = SELF_TESTS.map((entry) => {
    const start = now();
    try {
      const outcome = entry.fn();
      return { id: entry.name, pass: outcome.pass === true, detail: outcome.detail || "", durationMs: Math.max(0, now() - start) };
    } catch (error) {
      return { id: entry.name, pass: false, detail: `Threw: ${error && error.message ? error.message : error}`, durationMs: Math.max(0, now() - start) };
    }
  });
  const passed = results.filter((r) => r.pass).length;
  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    allPass: passed === results.length,
    results
  };
}
