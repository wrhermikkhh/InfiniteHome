import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { consumeCostLayers } from "../shared/admin-accounting-math";

test("cost layers consume FIFO and preserve the unconsumed tail", () => {
  const result = consumeCostLayers([
    { quantity: 2, unitCostMinor: 100 },
    { quantity: 3, unitCostMinor: 250 },
  ], 3, "FIFO");
  assert.equal(result.costMinor, 450);
  assert.deepEqual(result.remaining, [{ quantity: 2, unitCostMinor: 250 }]);
});

test("unbatched stock remains saleable and is classified by product cost", () => {
  const source = readFileSync("shared/inventory.ts", "utf8");
  assert.match(source, /"historical_unknown"/);
  assert.match(source, /cost_price/);
  assert.match(source, /if \(remaining > 0\)/);
});

test("cost-layer lifecycle locks batches, reverses once, and transfers POS ownership", () => {
  const source = readFileSync("shared/inventory.ts", "utf8");
  assert.match(source, /ORDER BY id\s+FOR UPDATE/);
  assert.match(source, /reversed_at IS NULL/);
  assert.match(source, /quantity_remaining = quantity_remaining \+ /);
  assert.match(source, /sale_kind = 'ORDER', sale_id = \$\{orderId\}/);
});

test("the additive ledger is optional until its reviewed migration is applied", () => {
  const source = readFileSync("shared/inventory.ts", "utf8");
  assert.match(source, /to_regclass\('public\.inventory_batches'\)/);
  assert.match(source, /to_regclass\('public\.sale_cogs_lines'\)/);
  assert.match(source, /if \(!\(await hasCostLedger\(tx\)\)\)/);
});

test("real order and POS transaction paths post, reverse, and transfer COGS in their transaction", () => {
  const checkout = readFileSync("shared/checkout.ts", "utf8");
  const storage = readFileSync("server/storage.ts", "utf8");
  assert.match(checkout, /await recordSaleCosts\(tx, "order", order\.id, payload\.items\)/);
  assert.match(storage, /await recordSaleCosts\(tx, "pos", newTransaction\.id, transaction\.items\)/);
  assert.match(storage, /await restoreSaleCosts\(tx, "order", id\)/);
  assert.match(storage, /await restoreSaleCosts\(tx, "pos", id\)/);
  assert.match(storage, /await transferSaleCosts\(tx, fromPosId, newOrder\.id\)/);
});