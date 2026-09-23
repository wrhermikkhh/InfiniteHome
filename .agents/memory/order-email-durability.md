---
name: Order email durability
description: Delivery guarantees and duplicate prevention for order notifications sent through Resend.
---

Treat each recipient and order event as a separate durable notification. Record customer confirmation, sales notification, and each status update independently, and combine the database ledger with a stable provider idempotency key.

**Why:** RedotPay originally bypassed notification calls, Resend rejection responses were swallowed, and coupling customer and sales delivery meant one mailbox failure could repeatedly resend to the other.

**How to apply:** Any new order-email path must use the shared durable sender, propagate provider rejection, keep network I/O outside database transactions, and never mark a skipped or malformed-recipient send as successful.