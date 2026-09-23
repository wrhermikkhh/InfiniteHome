---
name: Finance reporting semantics
description: How to distinguish order bookings, completed POS sales, and confirmed payment receipts in admin reporting.
---

Treat order value as booked value, not proof that money was received. Keep customer-facing and admin-facing labels explicit about this distinction. Count completed POS sales separately and never double-count a POS sale that was converted into a delivery order.

**Why:** Order status does not establish payment settlement, particularly for bank transfers, COD, and pre-order balances. Payment providers can also use a different currency from the storefront. Combining totals into a single "revenue" number would present unverified amounts as collected funds.

**How to apply:** When extending Finance or Analytics, define the event and currency behind every monetary metric. Join confirmed payment events for a received-money view rather than inferring payment from an order or invoice status; preserve the separate booked-order view.