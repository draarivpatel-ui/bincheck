#!/usr/bin/env node
/**
 * Hardened Municipal Source Verifier (scripts/verify-city-sources.js)
 * Verifies City of Sugar Land Solid Waste & Recycling and City of Houston SWMD
 * municipal rules using token-agnostic normalized keyword extraction with
 * deterministic offline snapshot fallback (data/municipal-rules-2026.json).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SNAPSHOT_PATH = path.resolve(__dirname, "../data/municipal-rules-2026.json");

const EXPECTED_TOKENS = {
  "sugar-land-tx": [
    "republic services",
    "glass",
    "plastic bags",
    "fort bend county recycling center",
    "green waste"
  ],
  "houston-tx": [
    "solid waste management",
    "glass",
    "plastic bags",
    "westpark",
    "biodegradable"
  ]
};

export function normalizeTextTokens(rawText) {
  return String(rawText ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function verifySnapshotIntegrity(snapshotPath = SNAPSHOT_PATH) {
  const raw = fs.readFileSync(snapshotPath, "utf-8");
  const parsed = JSON.parse(raw);
  const report = {
    schemaVersion: parsed.schemaVersion,
    lastVerifiedDate: parsed.lastVerifiedDate,
    jurisdictionsVerified: 0,
    details: {},
    allPassed: true
  };

  for (const [cityId, requiredPhrases] of Object.entries(EXPECTED_TOKENS)) {
    const cityObj = parsed.jurisdictions?.[cityId];
    if (!cityObj) {
      report.allPassed = false;
      report.details[cityId] = { passed: false, missingTokens: requiredPhrases };
      continue;
    }
    const serialized = normalizeTextTokens(JSON.stringify(cityObj));
    const missingTokens = requiredPhrases.filter(
      (phrase) => !serialized.includes(normalizeTextTokens(phrase))
    );
    const passed = missingTokens.length === 0;
    if (!passed) {
      report.allPassed = false;
    } else {
      report.jurisdictionsVerified += 1;
    }
    report.details[cityId] = {
      passed,
      sourceUrl: cityObj.officialSourceUrl,
      provider: cityObj.provider,
      missingTokens
    };
  }

  return report;
}

async function fetchLiveWithFallback(cityId, url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "BinCheck-Municipal-Rule-Verifier/1.0" }
    });
    clearTimeout(timer);
    if (!res.ok) {
      return { liveReachable: false, status: res.status, fallbackUsed: true };
    }
    const text = await res.text();
    const normalized = normalizeTextTokens(text);
    const matched = EXPECTED_TOKENS[cityId].filter((tok) =>
      normalized.includes(normalizeTextTokens(tok))
    );
    return {
      liveReachable: true,
      status: res.status,
      matchedLiveTokens: matched.length,
      fallbackUsed: false
    };
  } catch (err) {
    return {
      liveReachable: false,
      error: err.message,
      fallbackUsed: true
    };
  }
}

async function runCli() {
  const isLive = process.argv.includes("--live");
  const snapshotReport = verifySnapshotIntegrity(SNAPSHOT_PATH);

  if (isLive) {
    for (const [cityId, info] of Object.entries(snapshotReport.details)) {
      if (info.sourceUrl) {
        info.liveCheck = await fetchLiveWithFallback(cityId, info.sourceUrl);
      }
    }
  }

  console.log(JSON.stringify(snapshotReport, null, 2));
  if (!snapshotReport.allPassed) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  runCli();
}
