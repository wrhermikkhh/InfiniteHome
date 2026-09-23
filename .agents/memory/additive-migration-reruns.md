---
name: Additive migration reruns
description: Why a first successful ledger migration does not prove its compatibility preflight is repeatable.
---

For additive migrations with fail-closed checks of existing tables and indexes, verify both a fresh application and a rerun against the newly created objects before relying on idempotency.

**Why:** On the first application, existing-object checks can skip every target. An initial success therefore does not exercise their type comparisons or expected index definitions; a later rerun can fail even though the tables were created correctly.

**How to apply:** Preflight names and roles, apply only to an appropriate development or isolated database, rerun there without changing existing data, and resolve any validation mismatch before considering a production rollout.