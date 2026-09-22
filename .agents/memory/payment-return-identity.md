---
name: Payment return identity
description: Why payment return identity must not depend on the browser's last active checkout.
---

Treat a provider return as a reference to one specific payment, never as a request to display whichever payment the browser last remembers. Missing identity or missing browser authorization must fail closed rather than select another attempt.

**Why:** A customer supplied a successful provider transaction reference alongside a cancellation screen. Production records proved the screen belonged to an older closed attempt, while the supplied transaction's order was paid. Payment success also does not establish merchant settlement.

**How to apply:** Keep the public attempt identifier separate from its private authorization capability. Preserve authorization before create requests so a lost response remains safely retryable. Migration from legacy browser state must verify the old capability before retiring it; a network error is not evidence that no payment exists.