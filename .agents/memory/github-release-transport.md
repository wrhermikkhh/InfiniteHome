---
name: GitHub release transport
description: Safely publishing this external GitHub-to-Vercel project when the workspace Git remote lacks write authentication.
---

Use the connected GitHub integration rather than requesting credentials if the workspace remote rejects a push. Preserve the current `main` commit as parent and update its ref without force.

**Why:** A GitHub API upload of large binary files appeared successful but silently carried shortened content when a single shell callback returned more than roughly 80 KiB. Vercel built successfully despite the damaged repository images. A successful upload or build alone does not establish content integrity.

**How to apply:** When constructing Git blobs through the connected API, read binary base64 in small chunks, compare every returned blob SHA against the local `git hash-object`, and compare the final remote Git tree against the local release tree. Then verify the Vercel production deployment and live endpoints. Do not store or print connector credentials.

When publishing only selected workspace changes against the remote base tree, compare recursive **blob** paths and hashes; directory tree hashes naturally change when descendants change, and new files naturally increase the blob count. Allowlist changed/new blob paths and verify every unrelated existing blob is unchanged.

Normalize each line of shell-reported Git hashes before comparing it with an API-reported blob SHA. **Why:** A multi-line shell result can contain CRLF separators, leaving a trailing carriage return on an otherwise correct hash and causing a false integrity failure. **How to apply:** Trim individual hash lines, not just the full output string; still verify uploaded blob SHAs against the normalized hashes before changing a branch ref.