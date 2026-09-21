---
name: Dependency runtime compatibility
description: Preserve external hosting compatibility when resolving blocked transitive dependencies.
---

Resolve blocked dependencies using versions compatible with the existing runtime; do not upgrade the runtime implicitly as part of post-merge repair.

**Why:** Updating Google Cloud Storage to its latest major removed a blocked XML-parser dependency but required Node 22, while this project's environment used Node 20. A maintained release in the existing major provided the dependency fix without that runtime change.

**How to apply:** Check package engines when updating parents of blocked dependencies, including when installation only produces warnings. Validate both the application build and the separate Vercel entrypoint; do not bypass the package firewall.