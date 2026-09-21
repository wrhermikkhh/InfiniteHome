---
name: RedotPay activation safety
description: Why configured merchant credentials do not mean RedotPay is cleared for live use.
---

Do not treat merchant credential setup or successful mocked payment tests as permission to activate RedotPay.

**Why:** Integration exposed existing unprotected admin mutation routes and incompatible legacy inventory updates. Enabling only the new payment flow would leave fulfillment unusable or let other checkouts overwrite reservations. The implementation was deliberately left disabled rather than silently expanding into a broad authentication refactor.

**How to apply:** Review the current release findings in `REDOTPAY_SETUP.md`, confirm they are actually resolved, and perform controlled provider acceptance testing before recommending live activation. The user corrected the exchange rate to MVR 15.42 per USD on 2026-09-21; this replaces the earlier MVR 21 choice and is not inferred from financial market data.