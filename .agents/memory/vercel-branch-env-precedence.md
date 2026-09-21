---
name: Vercel branch environment precedence
description: Branch-specific Preview variables can shadow Preview-wide settings even after an earlier branch setup appeared to fail.
---

Audit both Preview-wide and `gitBranch`-scoped Vercel variables before changing or validating an acceptance deployment. A matching branch-specific variable takes precedence over the Preview-wide value.

**Why:** A rejected branch-scoped setup still left branch-specific variable records. Once the branch existed, those stale records shadowed later Preview-wide updates and caused deployed verifier fingerprints to differ from the configured values.

**How to apply:** List environment-variable metadata without decrypting values, group matching keys by target and branch, and update the narrowest effective scope. Rebuild and verify non-secret behavior before testing.