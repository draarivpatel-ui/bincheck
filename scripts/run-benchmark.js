#!/usr/bin/env node
/**
 * Calibration benchmark CLI.
 *
 *   node scripts/run-benchmark.js            text report (includes measured latency)
 *   node scripts/run-benchmark.js --json     deterministic JSON report (no latency)
 *   node scripts/run-benchmark.js --json --latency   JSON including latency
 *
 * First confirms every ground-truth anchor still holds in the municipal
 * snapshot, then grades the engine. Exits 1 if an anchor is broken or any
 * scored case fails. Known gaps are reported but do not fail the run.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  runBenchmark,
  verifyGroundTruthAnchors,
  benchmarkToJson,
  benchmarkToText
} from "../js/bincheck-benchmark.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SNAPSHOT_PATH = path.resolve(__dirname, "../data/municipal-rules-2026.json");

export function runCli(argv = process.argv.slice(2), io = { out: (text) => process.stdout.write(text), err: (text) => process.stderr.write(text) }) {
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf-8"));
  const broken = verifyGroundTruthAnchors(snapshot);
  if (broken.length > 0) {
    io.err(`Ground truth anchors broken: ${broken.length}\n`);
    for (const entry of broken) {
      io.err(`  ${entry.caseId} (${entry.city}) ${entry.anchor.path} ${entry.anchor.op} ${entry.anchor.value}\n`);
    }
    return 1;
  }

  const result = runBenchmark();
  const includeLatency = argv.includes("--latency") || !argv.includes("--json");
  if (argv.includes("--json")) {
    io.out(benchmarkToJson(result, { includeLatency: argv.includes("--latency") }));
  } else {
    io.out(benchmarkToText(result, { includeLatency }));
  }
  return result.failures.length > 0 ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  process.exitCode = runCli();
}
