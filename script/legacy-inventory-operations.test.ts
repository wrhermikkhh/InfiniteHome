import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// All tests exit before any database connection; no ambient application secrets.
const invoke = (script: string, args: string[], extraEnv = {}) => spawnSync(process.execPath, ["--import", "tsx", `script/${script}`, ...args], {
  env: { PATH: process.env.PATH, HOME: process.env.HOME, ...extraEnv }, encoding: "utf8",
});
const raceScript = "legacy-inventory-postgres-acceptance.ts";
test("race harness requires deliberate opt-in before any connection", () => {
  const r = invoke(raceScript, []);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Explicit disposable opt-in required/);
});
test("race harness refuses app environment names without using their values", () => {
  const r = invoke(raceScript, ["--disposable-local-only"], { DATABASE_URL: "NOT_A_CONNECTION" });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Refusing application/);
  assert.doesNotMatch(r.stderr, /NOT_A_CONNECTION/);
});
for (const url of [
  "postgresql://test@example.invalid/inventory_disposable_test",
  "postgresql://test@127.0.0.1/store",
  "postgresql://test:fake-password@127.0.0.1/inventory_disposable_test",
  "postgresql://test@127.0.0.1/inventory_disposable_test?host=remote",
]) {
  test(`race harness refuses unsafe target shape ${url.replace("fake-password", "[redacted]")}`, () => {
    const r = invoke(raceScript, ["--disposable-local-only", "--database-url", url]);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /Only loopback inventory_disposable/);
    assert.doesNotMatch(r.stderr, /fake-password/);
  });
}
test("historical plan structural validation is offline, explicit and deterministic", () => {
  const dir = mkdtempSync(join(tmpdir(), "inventory-plan-test-"));
  try {
    const path = join(dir, "plan.json");
    // This is an isolated validation fixture, not store allocation evidence.
    const plan = {
      version: 1, target: { hostname: "example.invalid", database: "offline_fixture" },
      reviewedBy: "offline-test", reviewedAt: "2026-01-01T00:00:00Z",
      entries: [{
        ownerType: "order", ownerId: "test-only", snapshotSha256: "a".repeat(64),
        evidenceReference: "offline-fixture", explanation: "Structure validation only",
        disposition: "outstanding", allocations: [{ productId: "test-product", qty: 1, key: null, preorder: false, capped: true }],
      }],
    };
    writeFileSync(path, JSON.stringify(plan));
    const first = invoke("legacy-inventory-reconcile.ts", ["--validate-plan", path]);
    assert.equal(first.status, 0, first.stderr);
    const second = invoke("legacy-inventory-reconcile.ts", ["--validate-plan", path]);
    assert.equal(first.stdout, second.stdout);
    assert.match(JSON.parse(first.stdout).planSha256, /^[a-f0-9]{64}$/);
    plan.entries[0].allocations[0].qty = -1;
    writeFileSync(path, JSON.stringify(plan));
    const invalid = invoke("legacy-inventory-reconcile.ts", ["--validate-plan", path]);
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stderr, /positive integer/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test("historical inspection never falls back to application DATABASE_URL", () => {
  const r = invoke("legacy-inventory-reconcile.ts", ["--inspect", "order:test"], { DATABASE_URL: "NOT_A_CONNECTION" });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /explicitly supply INVENTORY_RECONCILIATION_URL/);
  assert.doesNotMatch(r.stderr, /NOT_A_CONNECTION/);
});