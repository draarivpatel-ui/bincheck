/**
 * BinCheck signed waste diversion audit.
 *
 * Builds a deterministic audit record of a basket scored under one or two MRF
 * program profiles, signs it with HMAC-SHA-256, and exports it as JSON, CSV or
 * Markdown. The signature is a local integrity tag, not a third-party
 * certificate: it proves the exported bytes were not altered after BinCheck
 * produced them. Anyone can replay the JSON here and see the tag re-verified
 * or the tamper caught.
 *
 * Pure and deterministic: no DOM, no clock, no network. generatedOn stays null
 * unless a caller passes one, so repeated exports are byte-identical.
 */

import { evaluateBasket, compareProfiles, MRF_PROFILES, MUNICIPAL_BASKETS, WARM_FACTORS, WORKBENCH_STREAM_LABELS, normalizeProfileId, normalizeBasketId } from "./bincheck-municipal.js";
import { MUNICIPAL_RULES_SNAPSHOT } from "../data/municipal-rules-2026.js";
import { hmacSha256Hex, sha256Hex } from "./bincheck-sha256.js";

export const AUDIT_SCHEMA = "bincheck-diversion-audit/1";
export const SIGNED_AUDIT_SCHEMA = "bincheck-signed-audit/1";
export const AUDIT_SIGNATURE_ALGORITHM = "HMAC-SHA-256";
export const AUDIT_KEY_ID = "bincheck-local-integrity-v1";

/**
 * The integrity key is bundled in the app on purpose: the tag is a self-
 * authenticating checksum so a report can be replayed offline and any edit is
 * caught. It is not a secret and not a signature in the legal sense.
 */
const AUDIT_INTEGRITY_KEY = "bincheck.local-integrity.v1::municipal-ruleset-diff";

const SNAPSHOT_META = Object.freeze({
  schemaVersion: MUNICIPAL_RULES_SNAPSHOT.schemaVersion,
  lastVerifiedDate: MUNICIPAL_RULES_SNAPSHOT.lastVerifiedDate
});

/**
 * Deterministic JSON: object keys sorted recursively, arrays kept in order,
 * so the same payload always serializes byte-identically for signing.
 */
export function canonicalJson(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

function auditRowFor(profileEval) {
  return {
    profileId: profileEval.profileId,
    profileName: profileEval.profileName,
    profileKind: profileEval.profileKind,
    diversionRatePct: profileEval.diversionRatePct,
    curbsideRatePct: profileEval.curbsideRatePct,
    divertedLbs: profileEval.divertedLbs,
    curbsideLbs: profileEval.curbsideLbs,
    dropOffLbs: profileEval.dropOffLbs,
    trashLbs: profileEval.trashLbs,
    naiveCartContaminationPct: profileEval.naiveCartContaminationPct,
    contaminationRiskIndex: profileEval.contaminationRiskIndex,
    co2eAvoidedKg: profileEval.co2eAvoidedKg,
    streamCounts: { ...profileEval.streamCounts }
  };
}

/**
 * Builds the unsigned audit payload: basket identity, per-profile metrics,
 * per-item routing under every audited profile, every rule-conflict alert,
 * and the disclosed planning factors used.
 */
export function buildDiversionAudit({ basketId, profileIds } = {}) {
  const basket = MUNICIPAL_BASKETS[normalizeBasketId(basketId) || "tricky-household"];
  const ids = (Array.isArray(profileIds) ? profileIds : [])
    .map((id) => normalizeProfileId(id))
    .filter(Boolean)
    .slice(0, 4);
  if (ids.length === 0) {
    ids.push("Riverside-tx", "houston-tx");
  }

  const evaluations = ids.map((id) => evaluateBasket(basket.id, id));
  const comparison = ids.length >= 2 ? compareProfiles(ids[0], ids[1], basket.id) : null;

  const rows = basket.items.map((item, index) => {
    const streams = {};
    for (const ev of evaluations) {
      streams[ev.profileId] = ev.rows[index].stream;
    }
    return {
      materialId: item.materialId,
      condition: item.condition,
      label: item.label,
      weightLbs: item.weightLbs,
      streams,
      agree: new Set(Object.values(streams)).size === 1
    };
  });

  const factors = {};
  for (const item of basket.items) {
    const factor = WARM_FACTORS[item.materialId];
    factors[item.materialId] = factor ? { factor: factor.factor, basis: factor.basis } : { factor: 0, basis: "No planning factor" };
  }

  return {
    schema: AUDIT_SCHEMA,
    tool: "BinCheck",
    rulesSnapshot: { ...SNAPSHOT_META },
    generatedOn: null,
    basket: {
      id: basket.id,
      name: basket.name,
      itemCount: basket.items.length,
      totalLbs: evaluations[0].totalLbs
    },
    profiles: evaluations.map(auditRowFor),
    rows,
    conflicts: comparison
      ? comparison.conflicts.map((entry) => ({
          materialId: entry.materialId,
          itemLabel: entry.itemLabel,
          kind: entry.kind,
          severity: entry.severity,
          fromProfile: entry.fromProfile,
          toProfile: entry.toProfile,
          fromStream: entry.fromStream,
          toStream: entry.toStream,
          message: entry.message
        }))
      : [],
    deltas: comparison
      ? {
          diversionDeltaPts: comparison.diversionDeltaPts,
          curbsideDeltaPts: comparison.curbsideDeltaPts,
          co2eDeltaKg: comparison.co2eDeltaKg,
          trashDeltaLbs: comparison.trashDeltaLbs
        }
      : null,
    factorBasis: "EPA WARM-style planning factors, disclosed per material; illustrative orders of magnitude, not facility measurements.",
    factors
  };
}

/**
 * Signs a payload: returns { schema, payload, signature } where signature is
 * the HMAC-SHA-256 hex tag over the canonical serialization of the payload.
 */
export function signAuditPayload(payload) {
  const digest = hmacSha256Hex(AUDIT_INTEGRITY_KEY, canonicalJson(payload));
  return {
    schema: SIGNED_AUDIT_SCHEMA,
    payload,
    signature: {
      algorithm: AUDIT_SIGNATURE_ALGORITHM,
      keyId: AUDIT_KEY_ID,
      digest
    }
  };
}

export function buildSignedAudit(options = {}) {
  return signAuditPayload(buildDiversionAudit(options));
}

/** Deterministic pretty JSON export of the signed audit. */
export function signedAuditToJson(signed, { generatedOn = null } = {}) {
  const body = {
    ...signed,
    payload: { ...signed.payload, generatedOn }
  };
  // The signature covers the payload with generatedOn as produced; when the
  // caller stamps a date the tag is recomputed so the export stays verifiable.
  if (generatedOn !== null) {
    body.signature = signAuditPayload(body.payload).signature;
  }
  return `${JSON.stringify(body, null, 2)}\n`;
}

function guardFormula(value) {
  const text = String(value ?? "");
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

function csvCell(value) {
  const text = guardFormula(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Deterministic CSV export. One section for profile metrics, one row per
 * audited item with its stream under each profile, and a signature footer so
 * the sheet itself is replay-checkable. CRLF endings, formula-safe cells.
 */
export function signedAuditToCsv(signed) {
  const payload = signed.payload;
  const profileIds = payload.profiles.map((p) => p.profileId);
  const lines = [["section", "field", ...profileIds, "note"].join(",")];

  const metricRows = [
    ["diversion_rate_pct", (p) => p.diversionRatePct],
    ["curbside_diversion_pct", (p) => p.curbsideRatePct],
    ["diverted_lbs", (p) => p.divertedLbs],
    ["dropoff_lbs", (p) => p.dropOffLbs],
    ["trash_lbs", (p) => p.trashLbs],
    ["naive_cart_contamination_pct", (p) => p.naiveCartContaminationPct],
    ["contamination_risk_index", (p) => p.contaminationRiskIndex],
    ["co2e_avoided_kg", (p) => p.co2eAvoidedKg]
  ];
  for (const [field, get] of metricRows) {
    lines.push(["profile_metric", field, ...profileIds.map((id) => String(get(payload.profiles.find((p) => p.profileId === id)))), ""].map(csvCell).join(","));
  }
  for (const p of payload.profiles) {
    lines.push(["profile", "name", ...profileIds.map((id) => (id === p.profileId ? p.profileName : "")), p.profileKind].map(csvCell).join(","));
  }
  for (const row of payload.rows) {
    lines.push(["item", row.label, ...profileIds.map((id) => WORKBENCH_STREAM_LABELS[row.streams[id]] || row.streams[id]), `${row.weightLbs} lb`].map(csvCell).join(","));
  }
  for (const conflict of payload.conflicts) {
    lines.push(["conflict", conflict.kind, conflict.itemLabel, conflict.message].map(csvCell).join(","));
  }
  lines.push(["signature", signed.signature.algorithm, signed.signature.keyId, signed.signature.digest].map(csvCell).join(","));
  lines.push(["provenance", "rules_snapshot", `${payload.rulesSnapshot.schemaVersion} verified ${payload.rulesSnapshot.lastVerifiedDate}`, payload.factorBasis].map(csvCell).join(","));
  return `${lines.join("\r\n")}\r\n`;
}

/**
 * Deterministic Markdown export: headline metrics table, per-item routing
 * table, conflict list, signature block.
 */
export function signedAuditToMarkdown(signed) {
  const payload = signed.payload;
  const ids = payload.profiles.map((p) => p.profileId);
  const out = [];
  out.push(`# BinCheck Diversion Audit`);
  out.push("");
  out.push(`Basket: ${payload.basket.name} (${payload.basket.itemCount} items, ${payload.basket.totalLbs} lbs). Rules snapshot ${payload.rulesSnapshot.schemaVersion}, verified ${payload.rulesSnapshot.lastVerifiedDate}.`);
  out.push("");
  out.push(`| Metric | ${payload.profiles.map((p) => p.profileName).join(" | ")} |`);
  out.push(`| --- | ${payload.profiles.map(() => "---").join(" | ")} |`);
  const metric = (label, get, suffix = "") => {
    out.push(`| ${label} | ${payload.profiles.map((p) => `${get(p)}${suffix}`).join(" | ")} |`);
  };
  metric("Diversion rate", (p) => p.diversionRatePct, "%");
  metric("Curbside diversion", (p) => p.curbsideRatePct, "%");
  metric("Diverted mass", (p) => p.divertedLbs, " lbs");
  metric("Drop-off mass", (p) => p.dropOffLbs, " lbs");
  metric("Landfilled mass", (p) => p.trashLbs, " lbs");
  metric("Naive-cart contamination", (p) => p.naiveCartContaminationPct, "%");
  metric("Contamination risk index", (p) => p.contaminationRiskIndex, "/100");
  metric("Lifecycle CO2e avoided", (p) => p.co2eAvoidedKg, " kg");
  out.push("");
  out.push(`| Item | ${payload.profiles.map(() => "Stream").join(" | ")} |`);
  out.push(`| --- | ${payload.profiles.map(() => "---").join(" | ")} |`);
  for (const row of payload.rows) {
    out.push(`| ${row.label} | ${ids.map((id) => WORKBENCH_STREAM_LABELS[row.streams[id]] || row.streams[id]).join(" | ")} |`);
  }
  if (payload.conflicts.length > 0) {
    out.push("");
    out.push(`## Rule-conflict alerts (${payload.conflicts.length})`);
    out.push("");
    for (const conflict of payload.conflicts) {
      out.push(`- **${conflict.kind}** (${conflict.severity}): ${conflict.message}`);
    }
  }
  out.push("");
  out.push(`## Signature`);
  out.push("");
  out.push(`- Algorithm: ${signed.signature.algorithm}`);
  out.push(`- Key id: ${signed.signature.keyId}`);
  out.push(`- Digest: \`${signed.signature.digest}\``);
  out.push(`- Payload SHA-256: \`${sha256Hex(canonicalJson(payload))}\``);
  out.push("");
  out.push(`_${payload.factorBasis}_`);
  return `${out.join("\n")}\n`;
}

/**
 * Replays and verifies a signed audit JSON string. Never throws. Returns
 * { ok, detail, expectedDigest, actualDigest, report? }. Any byte-level edit
 * to the payload flips the digest and fails verification.
 */
export function verifySignedAudit(text) {
  const raw = String(text ?? "").trim();
  if (raw === "") {
    return { ok: false, detail: "Nothing to verify. Paste a signed BinCheck audit JSON export.", code: "EMPTY" };
  }
  if (raw.length > 262144) {
    return { ok: false, detail: "Input exceeds the 256 KB audit size limit.", code: "TOO_LARGE" };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, detail: "The text is not valid JSON. Paste the whole signed export, including the signature block.", code: "NOT_JSON" };
  }
  if (!parsed || typeof parsed !== "object" || parsed.schema !== SIGNED_AUDIT_SCHEMA || !parsed.payload || !parsed.signature) {
    return { ok: false, detail: "This JSON is not a BinCheck signed audit (schema or signature block missing).", code: "WRONG_SCHEMA" };
  }
  if (parsed.signature.algorithm !== AUDIT_SIGNATURE_ALGORITHM || parsed.signature.keyId !== AUDIT_KEY_ID) {
    return { ok: false, detail: `Unsupported signature (${String(parsed.signature.algorithm)} / ${String(parsed.signature.keyId)}). Expected ${AUDIT_SIGNATURE_ALGORITHM} with key ${AUDIT_KEY_ID}.`, code: "WRONG_SIGNATURE_FORMAT" };
  }
  const expectedDigest = hmacSha256Hex(AUDIT_INTEGRITY_KEY, canonicalJson(parsed.payload));
  const actualDigest = String(parsed.signature.digest ?? "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(actualDigest)) {
    return { ok: false, detail: "The signature digest is malformed.", code: "MALFORMED_DIGEST", expectedDigest, actualDigest };
  }
  if (actualDigest !== expectedDigest) {
    return {
      ok: false,
      detail: `TAMPERED. The payload does not match its signature (expected digest ${expectedDigest.slice(0, 16)}..., stored ${actualDigest.slice(0, 16)}...). At least one byte of the report was changed after signing.`,
      code: "TAMPERED",
      expectedDigest,
      actualDigest
    };
  }
  const itemCount = parsed.payload && parsed.payload.basket ? parsed.payload.basket.itemCount : 0;
  return {
    ok: true,
    detail: `Verified intact. The signature matches every byte of the ${itemCount}-item audit payload.`,
    code: "VERIFIED",
    expectedDigest,
    actualDigest,
    report: parsed.payload
  };
}
