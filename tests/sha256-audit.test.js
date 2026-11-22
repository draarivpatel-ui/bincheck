import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { sha256, sha256Hex, hmacSha256Hex, utf8Bytes, bytesToHex, hexToBytes } from "../js/bincheck-sha256.js";
import {
  AUDIT_SCHEMA,
  SIGNED_AUDIT_SCHEMA,
  AUDIT_SIGNATURE_ALGORITHM,
  AUDIT_KEY_ID,
  buildDiversionAudit,
  buildSignedAudit,
  signAuditPayload,
  signedAuditToJson,
  signedAuditToCsv,
  signedAuditToMarkdown,
  verifySignedAudit,
  canonicalJson
} from "../js/bincheck-audit.js";
import { MUNICIPAL_BASKET_IDS, MRF_PROFILE_IDS } from "../js/bincheck-municipal.js";

const enc = new TextEncoder();

/* ---------------- SHA-256 FIPS 180-4 known-answer vectors ---------------- */

test("sha256: FIPS 180-4 empty message vector", () => {
  assert.equal(sha256Hex(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
});

test("sha256: FIPS 180-4 'abc' vector", () => {
  assert.equal(sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("sha256: FIPS 180-4 two-block 448-bit vector", () => {
  assert.equal(
    sha256Hex("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"),
    "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"
  );
});

test("sha256: FIPS 180-4 896-bit padding-edge vector", () => {
  assert.equal(
    sha256Hex("abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu"),
    "cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1"
  );
});

test("sha256: million 'a' vector matches the published digest", () => {
  assert.equal(sha256Hex("a".repeat(1000000)), "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0");
});

test("sha256: byte-array input hashes identically to the string form", () => {
  assert.deepEqual([...sha256(enc.encode("bincheck"))], [...sha256("bincheck")]);
  assert.equal(sha256Hex([98, 105, 110]), sha256Hex("bin"));
});

test("sha256: every padding boundary length matches node:crypto exactly", () => {
  const ref = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
  for (let length = 0; length <= 130; length += 1) {
    const bytes = new Uint8Array(length).map((_, i) => (i * 7 + length) & 0xff);
    assert.equal(sha256Hex(bytes), ref(bytes), `${length} bytes`);
  }
});

test("sha256: accepts Uint8Array, plain arrays and strings with equal output", () => {
  const bytes = utf8Bytes("uniform");
  assert.equal(sha256Hex(bytes), sha256Hex([...bytes]));
  assert.equal(sha256Hex(bytes), sha256Hex("uniform"));
});

test("sha256: output is always 32 bytes and hex is always 64 lowercase chars", () => {
  for (const input of ["", "x", "long input ".repeat(50)]) {
    assert.equal(sha256(input).length, 32);
    assert.match(sha256Hex(input), /^[0-9a-f]{64}$/);
  }
});

test("utf8: encodes ASCII, two-byte, three-byte and astral characters exactly", () => {
  assert.deepEqual([...utf8Bytes("abc")], [0x61, 0x62, 0x63]);
  assert.deepEqual([...utf8Bytes("é")], [0xc3, 0xa9]);
  assert.deepEqual([...utf8Bytes("\u4e2d")], [0xe4, 0xb8, 0xad]);
  assert.deepEqual([...utf8Bytes("\u{1f30d}")], [0xf0, 0x9f, 0x8c, 0x8d]);
  assert.deepEqual([...utf8Bytes("a\u{1f30d}z")], [0x61, 0xf0, 0x9f, 0x8c, 0x8d, 0x7a]);
});

test("utf8: matches the platform TextEncoder on a mixed corpus", () => {
  for (const sample of ["", "plain", "café", "", "\u{1f30d}\u{1f3d6}", "tab\tline\nfeed", "ünïcodé ✓"]) {
    assert.deepEqual([...utf8Bytes(sample)], [...enc.encode(sample)], JSON.stringify(sample));
  }
});

test("hex codec: round-trips, uppercases down, and rejects malformed input", () => {
  assert.equal(bytesToHex(hexToBytes("deadbeef")), "deadbeef");
  assert.deepEqual([...hexToBytes("A0ff")], [0xa0, 0xff]);
  assert.equal(hexToBytes("abc"), null);
  assert.equal(hexToBytes("zz"), null);
  assert.equal(hexToBytes("0x00"), null);
  assert.equal(bytesToHex(new Uint8Array([0, 15, 255])), "000fff");
});

/* ---------------- HMAC-SHA-256 (RFC 4231) ---------------- */

test("hmac: RFC 4231 test case 1", () => {
  const got = hmacSha256Hex(new Uint8Array(20).fill(0x0b), "Hi There");
  assert.equal(got, "b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7");
});

test("hmac: RFC 4231 test case 2 (Jefe)", () => {
  const got = hmacSha256Hex("Jefe", "what do ya want for nothing?");
  assert.equal(got, "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843");
});

test("hmac: RFC 4231 test case 3 (20 x 0xaa key, 50 x 0xdd data)", () => {
  const got = hmacSha256Hex(new Uint8Array(20).fill(0xaa), new Uint8Array(50).fill(0xdd));
  assert.equal(got, "773ea91e36800e46854db8ebd09181a72959098b3ef8c122d9635514ced565fe");
});

test("hmac: RFC 4231 test case 6 (key larger than block size)", () => {
  const got = hmacSha256Hex(new Uint8Array(131).fill(0xaa), "Test Using Larger Than Block-Size Key - Hash Key First");
  assert.equal(got, "60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54");
});

test("hmac: over-block-size keys and under-block-size keys both work", () => {
  const long = hmacSha256Hex("k".repeat(200), "payload");
  const short = hmacSha256Hex("k", "payload");
  assert.match(long, /^[0-9a-f]{64}$/);
  assert.match(short, /^[0-9a-f]{64}$/);
  assert.notEqual(long, short);
});

test("hmac: identical inputs always produce the identical tag", () => {
  assert.equal(hmacSha256Hex("key", "message"), hmacSha256Hex("key", "message"));
  assert.notEqual(hmacSha256Hex("key", "message"), hmacSha256Hex("key", "messagf"));
});

test("hmac: matches node:crypto HMAC across key sizes and message sizes", () => {
  for (const keyLen of [0, 1, 32, 64, 65, 100, 200]) {
    for (const msgLen of [0, 1, 55, 64, 200]) {
      const key = new Uint8Array(keyLen).map((_, i) => (i * 3 + 1) & 0xff);
      const msg = new Uint8Array(msgLen).map((_, i) => (i * 5 + 2) & 0xff);
      const ref = crypto.createHmac("sha256", key).update(msg).digest("hex");
      assert.equal(hmacSha256Hex(key, msg), ref, `key ${keyLen} msg ${msgLen}`);
    }
  }
});

/* ---------------- canonical JSON ---------------- */

test("canonicalJson: object keys serialize in sorted order recursively", () => {
  assert.equal(canonicalJson({ b: 1, a: { d: 4, c: 3 } }), '{"a":{"c":3,"d":4},"b":1}');
  assert.equal(canonicalJson({ z: [3, { y: 2, x: 1 }], a: "s" }), '{"a":"s","z":[3,{"x":1,"y":2}]}');
});

test("canonicalJson: arrays keep order and primitives match JSON.stringify", () => {
  assert.equal(canonicalJson([3, 1, 2]), "[3,1,2]");
  assert.equal(canonicalJson(null), "null");
  assert.equal(canonicalJson("a\nb"), '"a\\nb"');
  assert.equal(canonicalJson(4.25), "4.25");
  assert.equal(canonicalJson(true), "true");
});

test("canonicalJson: same logical payload is byte-identical regardless of key order", () => {
  const x = { a: 1, b: { c: 2, d: 3 }, e: [4, 5] };
  const y = { e: [4, 5], b: { d: 3, c: 2 }, a: 1 };
  assert.equal(canonicalJson(x), canonicalJson(y));
});

/* ---------------- audit payload ---------------- */

test("audit: schema, snapshot meta, basket and profiles shape", () => {
  const audit = buildDiversionAudit({ basketId: "tricky-household", profileIds: ["Riverside-tx", "houston-tx"] });
  assert.equal(audit.schema, AUDIT_SCHEMA);
  assert.equal(audit.rulesSnapshot.schemaVersion, "2026.10");
  assert.equal(audit.rulesSnapshot.lastVerifiedDate, "2026-10-20");
  assert.equal(audit.basket.id, "tricky-household");
  assert.equal(audit.basket.itemCount, 14);
  assert.equal(audit.profiles.length, 2);
  assert.equal(audit.rows.length, 14);
  assert.equal(audit.generatedOn, null, "no clock: deterministic exports");
});

test("audit: falls back to both city snapshots when no profiles are given", () => {
  const audit = buildDiversionAudit({ basketId: "tricky-household" });
  assert.deepEqual(audit.profiles.map((p) => p.profileId), ["Riverside-tx", "houston-tx"]);
});

test("audit: unknown profile ids are dropped, unknown basket falls back", () => {
  const audit = buildDiversionAudit({ basketId: "not-a-basket", profileIds: ["nope", "houston-tx", ""] });
  assert.equal(audit.basket.id, "tricky-household");
  assert.deepEqual(audit.profiles.map((p) => p.profileId), ["houston-tx"]);
});

test("audit: single-profile audits have no conflicts and null deltas", () => {
  const audit = buildDiversionAudit({ basketId: "tricky-household", profileIds: ["Riverside-tx"] });
  assert.deepEqual(audit.conflicts, []);
  assert.equal(audit.deltas, null);
});

test("audit: per-row streams cover every audited profile and agree flags work", () => {
  const audit = buildDiversionAudit({ basketId: "tricky-household", profileIds: ["Riverside-tx", "dual-stream-glass-out"] });
  for (const row of audit.rows) {
    assert.ok(row.streams["Riverside-tx"]);
    assert.ok(row.streams["dual-stream-glass-out"]);
    assert.equal(typeof row.agree, "boolean");
  }
  const glass = audit.rows.find((r) => r.materialId === "glass-jar-bottle");
  assert.equal(glass.agree, false);
  assert.equal(glass.streams["Riverside-tx"], "RECYCLE_CART");
  assert.equal(glass.streams["dual-stream-glass-out"], "SPECIAL_DROPOFF");
});

test("audit: profile caps at four and only valid ids survive", () => {
  const audit = buildDiversionAudit({ basketId: "kitchen-week", profileIds: [...MRF_PROFILE_IDS, "extra-one"] });
  assert.equal(audit.profiles.length, 4);
});

test("audit: factors are disclosed per basket material with a basis", () => {
  for (const basketId of MUNICIPAL_BASKET_IDS) {
    const audit = buildDiversionAudit({ basketId, profileIds: ["Riverside-tx", "houston-tx"] });
    const materialIds = new Set(audit.rows.map((r) => r.materialId));
    for (const materialId of materialIds) {
      assert.ok(audit.factors[materialId], `${basketId}/${materialId} missing factor row`);
      assert.ok(typeof audit.factors[materialId].basis === "string" && audit.factors[materialId].basis.length > 4);
      assert.ok(typeof audit.factors[materialId].factor === "number");
    }
    assert.match(audit.factorBasis, /EPA WARM/);
  }
});

test("audit: profile rows carry the disclosed metric set", () => {
  const audit = buildDiversionAudit({ basketId: "kitchen-week", profileIds: ["Riverside-tx", "organics-mandatory"] });
  for (const p of audit.profiles) {
    for (const field of ["diversionRatePct", "curbsideRatePct", "divertedLbs", "dropOffLbs", "trashLbs", "naiveCartContaminationPct", "contaminationRiskIndex", "co2eAvoidedKg"]) {
      assert.ok(Number.isFinite(p[field]), `${p.profileId} missing ${field}`);
    }
    assert.ok(p.streamCounts && typeof p.streamCounts === "object");
  }
});

/* ---------------- signing ---------------- */

test("sign: envelope carries schema, algorithm, key id and a 64-hex digest", () => {
  const signed = signAuditPayload({ any: "payload" });
  assert.equal(signed.schema, SIGNED_AUDIT_SCHEMA);
  assert.equal(signed.signature.algorithm, AUDIT_SIGNATURE_ALGORITHM);
  assert.equal(signed.signature.keyId, AUDIT_KEY_ID);
  assert.match(signed.signature.digest, /^[0-9a-f]{64}$/);
});

test("sign: same payload signs identically, different payloads sign differently", () => {
  const a = signAuditPayload({ x: 1 });
  const b = signAuditPayload({ x: 1 });
  const c = signAuditPayload({ x: 2 });
  assert.equal(a.signature.digest, b.signature.digest);
  assert.notEqual(a.signature.digest, c.signature.digest);
});

test("sign: key order in the payload does not change the digest", () => {
  const a = signAuditPayload({ first: 1, second: 2 });
  const b = signAuditPayload({ second: 2, first: 1 });
  assert.equal(a.signature.digest, b.signature.digest);
});

test("signed audit: full build produces a verifying envelope", () => {
  const signed = buildSignedAudit({ basketId: "tricky-household", profileIds: ["Riverside-tx", "houston-tx"] });
  assert.equal(signed.payload.schema, AUDIT_SCHEMA);
  assert.equal(verifySignedAudit(signedAuditToJson(signed)).ok, true);
});

/* ---------------- JSON export ---------------- */

test("json export: is byte-identical across repeated calls and parses back", () => {
  const signed = buildSignedAudit({ basketId: "tricky-household", profileIds: ["Riverside-tx", "houston-tx"] });
  const a = signedAuditToJson(signed);
  const b = signedAuditToJson(signed);
  assert.equal(a, b);
  const parsed = JSON.parse(a);
  assert.equal(parsed.schema, SIGNED_AUDIT_SCHEMA);
  assert.equal(parsed.signature.digest, signed.signature.digest);
  assert.ok(a.endsWith("\n"));
});

test("json export: generatedOn stamps re-sign so the export still verifies", () => {
  const signed = buildSignedAudit({ basketId: "tricky-household", profileIds: ["Riverside-tx", "houston-tx"] });
  const stamped = signedAuditToJson(signed, { generatedOn: "2026-10-26" });
  const parsed = JSON.parse(stamped);
  assert.equal(parsed.payload.generatedOn, "2026-10-26");
  assert.notEqual(parsed.signature.digest, signed.signature.digest, "payload changed so digest must change");
  assert.equal(verifySignedAudit(stamped).ok, true);
});

test("json export: deterministic across the same logical inputs", () => {
  const a = signedAuditToJson(buildSignedAudit({ basketId: "everything", profileIds: ["houston-tx", "rural-transfer-station"] }));
  const b = signedAuditToJson(buildSignedAudit({ basketId: "everything", profileIds: ["houston-tx", "rural-transfer-station"] }));
  assert.equal(a, b);
});

/* ---------------- CSV export ---------------- */

test("csv export: uses CRLF line endings throughout", () => {
  const csv = signedAuditToCsv(buildSignedAudit({ basketId: "tricky-household", profileIds: ["Riverside-tx", "houston-tx"] }));
  assert.ok(csv.endsWith("\r\n"));
  assert.equal(/[^\r]\n/.test(csv), false, "a bare LF would break the CRLF contract");
});

test("csv export: has a metric section, one row per item, conflicts and a signature footer", () => {
  const csv = signedAuditToCsv(buildSignedAudit({ basketId: "tricky-household", profileIds: ["Riverside-tx", "houston-tx"] }));
  const lines = csv.trimEnd().split("\r\n");
  assert.equal(lines[0], "section,field,Riverside-tx,houston-tx,note");
  assert.ok(lines.some((l) => l.startsWith("profile_metric,diversion_rate_pct,")));
  assert.equal(lines.filter((l) => l.startsWith("item,")).length, 14);
  assert.ok(lines.at(-2).startsWith("signature,HMAC-SHA-256,bincheck-local-integrity-v1,"));
  assert.ok(lines.at(-1).startsWith("provenance,rules_snapshot,"));
});

test("csv export: quotes cells containing commas, quotes and newlines safely", () => {
  const signed = signAuditPayload({
    schema: AUDIT_SCHEMA,
    rulesSnapshot: { schemaVersion: "x", lastVerifiedDate: "y" },
    generatedOn: null,
    basket: { id: "b", name: 'Basket, "quoted"\nname', itemCount: 0, totalLbs: 0 },
    profiles: [{ profileId: "p1", profileName: "P, One", profileKind: "k", diversionRatePct: 0, curbsideRatePct: 0, divertedLbs: 0, curbsideLbs: 0, dropOffLbs: 0, trashLbs: 0, naiveCartContaminationPct: 0, contaminationRiskIndex: 0, co2eAvoidedKg: 0, streamCounts: {} }],
    rows: [{ materialId: "m", condition: "clean", label: 'It,"em"\nX', weightLbs: 1, streams: { p1: "TRASH_CART" }, agree: true }],
    conflicts: [],
    deltas: null,
    factorBasis: "basis",
    factors: {}
  });
  const csv = signedAuditToCsv(signed);
  assert.ok(csv.includes('"It,""em""\nX"'), "embedded quote and newline stay inside one quoted cell");
  assert.ok(csv.includes("P, One") === false || csv.includes('"P, One"'), "comma cell is quoted");
});

test("csv export: formula-leading values are single-quote guarded", () => {
  for (const hostile of ["=1+1", "+2*3", "-4", "@cmd", "\t=1", "\r=2"]) {
    const signed = signAuditPayload({
      schema: AUDIT_SCHEMA,
      rulesSnapshot: { schemaVersion: "x", lastVerifiedDate: "y" },
      generatedOn: null,
      basket: { id: "b", name: "b", itemCount: 0, totalLbs: 0 },
      profiles: [{ profileId: "p1", profileName: "p", profileKind: "k", diversionRatePct: 0, curbsideRatePct: 0, divertedLbs: 0, curbsideLbs: 0, dropOffLbs: 0, trashLbs: 0, naiveCartContaminationPct: 0, contaminationRiskIndex: 0, co2eAvoidedKg: 0, streamCounts: {} }],
      rows: [{ materialId: "m", condition: "clean", label: hostile, weightLbs: 1, streams: { p1: "TRASH_CART" }, agree: true }],
      conflicts: [],
      deltas: null,
      factorBasis: "basis",
      factors: {}
    });
    const csv = signedAuditToCsv(signed);
    assert.ok(csv.includes(`item,'${hostile}`.replace("\t", "\\t").replace("\r", "\\r")) || csv.includes(`'${hostile}`), `formula cell ${JSON.stringify(hostile)} is guarded`);
  }
});

test("csv export: real export contains no unguarded formula-triggering cells", () => {
  const csv = signedAuditToCsv(buildSignedAudit({ basketId: "tricky-household", profileIds: MRF_PROFILE_IDS.slice(0, 4) }));
  for (const line of csv.split("\r\n")) {
    for (const cell of line.split(",")) {
      assert.equal(/^[=+\-@\t\r]/.test(cell), false, `unguarded cell ${JSON.stringify(cell)}`);
    }
  }
});

/* ---------------- Markdown export ---------------- */

test("markdown export: has title, metric table, item table and signature block", () => {
  const md = signedAuditToMarkdown(buildSignedAudit({ basketId: "tricky-household", profileIds: ["Riverside-tx", "houston-tx"] }));
  assert.match(md, /^# BinCheck Diversion Audit/);
  assert.match(md, /\| Metric \| Riverside, TX \| Houston, TX \|/);
  assert.match(md, /Diversion rate/);
  assert.match(md, /Lifecycle CO2e avoided/);
  assert.match(md, /## Signature/);
  assert.match(md, /`[0-9a-f]{64}`/);
  assert.ok(md.endsWith("\n"));
});

test("markdown export: conflict section appears only when conflicts exist", () => {
  const withConflicts = signedAuditToMarkdown(buildSignedAudit({ basketId: "tricky-household", profileIds: ["Riverside-tx", "dual-stream-glass-out"] }));
  assert.match(withConflicts, /## Rule-conflict alerts/);
  const identical = signedAuditToMarkdown(buildSignedAudit({ basketId: "tricky-household", profileIds: ["Riverside-tx", "Riverside-tx"] }));
  assert.equal(/Rule-conflict alerts/.test(identical), false);
});

test("markdown export: deterministic and discloses the factor basis", () => {
  const a = signedAuditToMarkdown(buildSignedAudit({ basketId: "kitchen-week", profileIds: ["houston-tx", "organics-mandatory"] }));
  const b = signedAuditToMarkdown(buildSignedAudit({ basketId: "kitchen-week", profileIds: ["houston-tx", "organics-mandatory"] }));
  assert.equal(a, b);
  assert.match(a, /EPA WARM-style planning factors/);
});

/* ---------------- verification and tamper detection ---------------- */

test("verify: a fresh signed export verifies intact", () => {
  for (const basketId of MUNICIPAL_BASKET_IDS) {
    const signed = buildSignedAudit({ basketId, profileIds: ["Riverside-tx", "dual-stream-glass-out"] });
    const result = verifySignedAudit(signedAuditToJson(signed));
    assert.equal(result.ok, true, basketId);
    assert.equal(result.code, "VERIFIED");
    assert.equal(result.report.basket.id, basketId);
  }
});

test("verify: editing any payload field flips verification to TAMPERED", () => {
  const signed = buildSignedAudit({ basketId: "tricky-household", profileIds: ["Riverside-tx", "houston-tx"] });
  const mutations = [
    (payload) => { payload.basket.itemCount = 99; },
    (payload) => { payload.profiles[0].diversionRatePct = 99.9; },
    (payload) => { payload.rows[0].streams["Riverside-tx"] = "TRASH_CART"; },
    (payload) => { payload.conflicts = []; },
    (payload) => { payload.basket.name = "edited"; },
    (payload) => { delete payload.rulesSnapshot.lastVerifiedDate; },
    (payload) => { payload.injected = true; }
  ];
  for (const mutate of mutations) {
    const copy = JSON.parse(signedAuditToJson(signed));
    mutate(copy.payload);
    const result = verifySignedAudit(JSON.stringify(copy));
    assert.equal(result.ok, false);
    assert.equal(result.code, "TAMPERED");
  }
});

test("verify: a single flipped hex character in the digest is caught", () => {
  const signed = buildSignedAudit({ basketId: "tricky-household", profileIds: ["Riverside-tx", "houston-tx"] });
  const json = signedAuditToJson(signed);
  const original = signed.signature.digest[0];
  const flipped = original === "0" ? "1" : "0";
  const result = verifySignedAudit(json.replace(`"digest": "${signed.signature.digest}`, `"digest": "${flipped}${signed.signature.digest.slice(1)}`));
  assert.equal(result.ok, false);
  assert.equal(result.code, "TAMPERED");
});

test("verify: whitespace-trimmed input still verifies; re-serialized input verifies", () => {
  const signed = buildSignedAudit({ basketId: "tricky-household", profileIds: ["Riverside-tx", "houston-tx"] });
  assert.equal(verifySignedAudit(`  ${signedAuditToJson(signed)}\n\n`).ok, true);
  const minified = JSON.stringify(JSON.parse(signedAuditToJson(signed)));
  assert.equal(verifySignedAudit(minified).ok, true, "canonical payload reserialization does not break the tag");
});

test("verify: malformed inputs fail closed with distinct codes and never throw", () => {
  assert.equal(verifySignedAudit("").code, "EMPTY");
  assert.equal(verifySignedAudit(null).code, "EMPTY");
  assert.equal(verifySignedAudit("not json at all").code, "NOT_JSON");
  assert.equal(verifySignedAudit("[1,2]").code, "WRONG_SCHEMA");
  assert.equal(verifySignedAudit("{}").code, "WRONG_SCHEMA");
  assert.equal(verifySignedAudit('{"schema":"bincheck-signed-audit/1"}').code, "WRONG_SCHEMA");
});

test("verify: wrong signature algorithm or key id is rejected", () => {
  const signed = buildSignedAudit({ basketId: "tricky-household", profileIds: ["Riverside-tx", "houston-tx"] });
  for (const mutation of [
    (s) => { s.signature.algorithm = "SHA-1"; },
    (s) => { s.signature.keyId = "evil-key"; }
  ]) {
    const copy = JSON.parse(signedAuditToJson(signed));
    mutation(copy);
    const result = verifySignedAudit(JSON.stringify(copy));
    assert.equal(result.ok, false);
    assert.equal(result.code, "WRONG_SIGNATURE_FORMAT");
  }
});

test("verify: a malformed digest value is rejected before comparison", () => {
  const signed = buildSignedAudit({ basketId: "tricky-household", profileIds: ["Riverside-tx", "houston-tx"] });
  const copy = JSON.parse(signedAuditToJson(signed));
  copy.signature.digest = "not-hex";
  const result = verifySignedAudit(JSON.stringify(copy));
  assert.equal(result.ok, false);
  assert.equal(result.code, "MALFORMED_DIGEST");
});

test("verify: oversized input is refused by the size limit", () => {
  const result = verifySignedAudit(`"${"x".repeat(300000)}"`);
  assert.equal(result.ok, false);
  assert.equal(result.code, "TOO_LARGE");
});

test("verify: result exposes expected and actual digests for display", () => {
  const signed = buildSignedAudit({ basketId: "tricky-household", profileIds: ["Riverside-tx", "houston-tx"] });
  const json = signedAuditToJson(signed).replace("14", "41");
  const result = verifySignedAudit(json);
  if (result.code === "TAMPERED" || result.code === "VERIFIED") {
    assert.match(result.expectedDigest, /^[0-9a-f]{64}$/);
    assert.match(result.actualDigest, /^[0-9a-f]{64}$/);
  } else {
    assert.ok(["NOT_JSON", "WRONG_SCHEMA"].includes(result.code) === false, `unexpected ${result.code}`);
    assert.equal(result.code, "TAMPERED");
  }
});
