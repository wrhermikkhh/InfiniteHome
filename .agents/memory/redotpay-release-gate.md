---
name: RedotPay activation safety
description: Why configured merchant credentials do not mean RedotPay is cleared for live use.
---

Do not treat merchant credential setup or successful mocked payment tests as permission to activate RedotPay.

**Why:** Integration exposed existing unprotected admin mutation routes and incompatible legacy inventory updates. These prompted a combined auth/inventory/payment safety implementation, but offline tests still cannot prove a merchant account, proxy behavior, or live notification delivery works. Activation remains a separate externally verified step.

**How to apply:** Review the current release findings in `REDOTPAY_SETUP.md`, confirm they are actually resolved, and perform controlled provider acceptance testing before recommending live activation. The user corrected the exchange rate to MVR 15.42 per USD on 2026-09-21; this replaces the earlier MVR 21 choice and is not inferred from financial market data.

Historical stock allocations must be reconciled from operator evidence rather than reconstructed automatically from old order items.

**Why:** The previous development/Vercel paths differed in scalar-stock deductions and could separately commit restoration. Old line items cannot establish how much stock remains deducted; guessing would inflate inventory.

**How to apply:** Preserve the explicit audited historical reconciliation path and do not add an automatic allocation backfill merely to make old-order cancellation pass.