import assert from "node:assert/strict";
import test from "node:test";
import { quoteLineFromProduct } from "../client/src/lib/quotation-catalog.js";
import type { Product } from "../client/src/lib/products.js";

const product: Product = {
  id: "catalog-1", name: "Cotton Sheets", price: 350, category: "Bedding", image: "",
  variants: [{ size: "Single", price: 350 }, { size: "Queen", price: 500 }],
  colors: ["White", "Blue"], isOnSale: true, salePercent: 10,
};

test("catalog selection snapshots selected variant, color, and current sale price", () => {
  assert.deepEqual(quoteLineFromProduct(product, "Queen", "Blue"), {
    description: "Cotton Sheets (Queen / Blue)", quantity: 1, unitPrice: 450,
  });
  assert.equal(quoteLineFromProduct(product, "Unknown", "Blue"), null);
});

test("pre-order quotes use full price, not the checkout deposit", () => {
  const preorder = { ...product, isPreOrder: true, preOrderPrice: 800, preOrderInitialPayment: 100 };
  assert.equal(quoteLineFromProduct(preorder, "Queen", "White")?.unitPrice, 800);
  assert.equal(quoteLineFromProduct({ ...preorder, preOrderPrice: null }, "Queen", "White"), null);
});

test("normal products without variants retain their catalog price", () => {
  assert.deepEqual(quoteLineFromProduct({ ...product, variants: [], colors: [], isOnSale: false }, "Standard", ""), {
    description: "Cotton Sheets", quantity: 1, unitPrice: 350,
  });
});