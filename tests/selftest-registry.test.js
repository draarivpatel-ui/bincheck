import test from "node:test";
import assert from "node:assert/strict";
import { SELF_TESTS, runSelfTests } from "../js/bincheck-selftest.js";

/* The in-page self-test registry is itself test infrastructure: this file
   executes every registry entry as its own node:test so a failing in-page
   check also fails the suite. */

test("registry: every entry has a dotted id, a function, and no duplicates", () => {
  const ids = new Set();
  for (const entry of SELF_TESTS) {
    assert.match(entry.name, /^[a-z0-9]+(\.[a-z0-9-]+)+$/, `id ${entry.name} should be dotted`);
    assert.equal(typeof entry.fn, "function");
    assert.equal(ids.has(entry.name), false, `duplicate id ${entry.name}`);
    ids.add(entry.name);
  }
  assert.ok(SELF_TESTS.length >= 25, "the registry should cover every new workbench invariant");
});

test("registry: ids are namespaced across every module under test", () => {
  const prefixes = new Set(SELF_TESTS.map((entry) => entry.name.split(".")[0]));
  for (const expected of ["sha256", "hmac", "audit", "municipal", "safety", "cascade", "hash"]) {
    assert.ok(prefixes.has(expected), `registry is missing ${expected}.* checks`);
  }
});

test("runner: aggregate counts are consistent with the per-check results", () => {
  const result = runSelfTests();
  assert.equal(result.total, result.results.length);
  assert.equal(result.passed + result.failed, result.total);
  assert.equal(result.allPass, result.failed === 0);
  assert.equal(result.passed, result.results.filter((r) => r.pass).length);
});

test("runner: every self-test passes in Node exactly as it should in the browser", () => {
  const result = runSelfTests();
  const failures = result.results.filter((r) => !r.pass);
  assert.deepEqual(
    failures.map((f) => `${f.id}: ${f.detail}`),
    [],
    `${failures.length} self-test(s) failed`
  );
});

test("runner: each result carries id, pass flag and a human-readable detail", () => {
  for (const entry of runSelfTests().results) {
    assert.match(entry.id, /^[a-z0-9]+\./);
    assert.equal(typeof entry.pass, "boolean");
    assert.ok(entry.detail.length > 10, `${entry.id} needs a displayable detail`);
    assert.ok(Number.isFinite(entry.durationMs) && entry.durationMs >= 0);
  }
});

test("runner: an injected clock is used for duration reporting", () => {
  let tick = 0;
  const result = runSelfTests({ now: () => (tick += 5) });
  assert.equal(result.allPass, true);
  for (const entry of result.results) {
    assert.ok(entry.durationMs === 0 || entry.durationMs === 5, `${entry.id} duration ${entry.durationMs}`);
  }
});

test("runner: a check that throws is reported as a failure, not an exception", () => {
  SELF_TESTS.push({ name: "sabotage.throws", fn: () => { throw new Error("boom"); } });
  try {
    const result = runSelfTests();
    const row = result.results.find((r) => r.id === "sabotage.throws");
    assert.equal(row.pass, false);
    assert.match(row.detail, /boom/);
    assert.equal(result.allPass, false);
    assert.equal(result.failed, 1);
  } finally {
    SELF_TESTS.pop();
  }
});

/* One node:test per registry entry, so the suite count tracks the page. */
for (const entry of SELF_TESTS) {
  test(`selftest: ${entry.name}`, () => {
    const outcome = entry.fn();
    assert.equal(outcome.pass, true, outcome.detail || "no detail");
  });
}
