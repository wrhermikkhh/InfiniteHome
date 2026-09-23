---
name: Currency and rate snapshots
description: The business rule for prospective USD conversion and native-currency receivables.
---

Keep receivables in their invoiced currency: USD receivables are summed as USD, MVR receivables as MVR. The MVR equivalent is useful for analysis but is not a native-currency balance. The starting USD conversion is 15.42 MVR per USD; an administrator may change it, but each new sale/order must retain the rate it was created with.

**Why:** The user explicitly does not want a later exchange-rate change to reprice existing invoices or orders, and aggregating USD receivables into an MVR balance hides currency exposure.

**How to apply:** Snapshot the active rate with new invoice/order/payment records. Read old snapshots when printing, reconciling, or recovering payment attempts. Never recompute old USD charges from the latest setting. Record realized FX separately from the original receivable and collected amounts.