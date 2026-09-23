import assert from "node:assert/strict";
import test from "node:test";
import { quotationTotals } from "../shared/quotation-totals.js";
import { validated } from "../shared/admin-documents-routes.js";

const input = {
  partyName: "Example customer",
  contact: "",
  notes: "",
  dueDate: null,
  status: "draft",
  items: [{ description: "Catalog product", quantity: 2, unitPrice: 120.5 }],
};

test("quotation discount reduces the persisted total, not the line prices", () => {
  assert.deepEqual(quotationTotals(input.items, 20), { subtotal: 241, total: 221 });
  assert.equal(validated({ ...input, discount: 20 }, "quotation")?.total, 221);
  assert.equal(validated(input, "quotation")?.discount, 0);
});

test("discount cannot exceed subtotal or apply to a purchase order", () => {
  assert.equal(validated({ ...input, discount: 241.01 }, "quotation"), null);
  assert.equal(validated({ ...input, discount: -1 }, "quotation"), null);
  assert.equal(validated({ ...input, discount: 0.001 }, "quotation"), null);
  assert.equal(validated({ ...input, discount: 20 }, "purchase_order"), null);
  assert.equal(validated(input, "purchase_order")?.total, 241);
});