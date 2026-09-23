import assert from "node:assert/strict";
import test from "node:test";
import { renderBusinessDocument } from "../client/src/lib/business-print.js";

const quotation = {
  kind: "quotation" as const,
  number: "QT-42",
  date: "23 Sep 2026",
  partyName: "Island Homes",
  contactLines: ["island@example.com"],
  items: [{ description: "Lamp", quantity: 2, unitPrice: 100 }],
  summaryRows: [{ label: "Subtotal", value: 200 }, { label: "Discount", value: -20 }],
  total: 180,
  signature: true,
};

test("quotation print shows recipient, actual prices, discount and A4/A5 print controls", () => {
  const html = renderBusinessDocument(quotation);
  assert.match(html, /Prepared for/);
  assert.match(html, /Island Homes/);
  assert.match(html, /island@example\.com/);
  assert.match(html, /MVR 100\.00/);
  assert.match(html, /−MVR 20\.00/);
  assert.match(html, /MVR 180\.00/);
  assert.match(html, /<option value="A4">A4/);
  assert.match(html, /<option value="A5">A5/);
  assert.match(html, /thead\{display:table-header-group\}/);
  assert.match(html, /tbody tr\{break-inside:avoid\}/);
});

test("delivery note uses the same layout without any financial details", () => {
  const html = renderBusinessDocument({
    ...quotation,
    kind: "delivery_note",
    contactLines: ["Male', Maldives"],
    summaryRows: [{ label: "Subtotal", value: 200 }],
    total: 180,
  });
  assert.match(html, /Delivery Note/);
  assert.match(html, /Deliver to/);
  assert.match(html, /Please confirm receipt of these items/);
  assert.doesNotMatch(html, /<th class="amount">|<section class="summary">|Subtotal|MVR 100|MVR 180/);
});

test("invoice shows tax only when supplied and separates payment details from total", () => {
  const html = renderBusinessDocument({
    ...quotation,
    kind: "invoice",
    summaryRows: [{ label: "Subtotal", value: 200 }, { label: "GST (8%)", value: 16 }],
    total: 216,
    paymentRows: [{ label: "Cash Received", value: 250 }, { label: "Change Due", value: 34 }],
  });
  assert.match(html, /GST \(8%\)/);
  assert.ok(html.indexOf("MVR 216.00") < html.indexOf("Cash Received"));
  assert.match(html, /Change Due<\/span><strong>MVR 34\.00/);
});

test("print document escapes customer-provided fields before writing to a new window", () => {
  const html = renderBusinessDocument({
    ...quotation,
    partyName: '<img src=x onerror="alert(1)">',
    notes: '</script><script>alert(1)</script>',
    items: [{ description: "<b>unsafe</b>", quantity: 1, unitPrice: 5 }],
  });
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(html, /&lt;\/script&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /&lt;b&gt;unsafe&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<img src=x|<b>unsafe<\/b>/);
});