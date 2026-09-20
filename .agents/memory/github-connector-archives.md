---
name: GitHub connector archive fallback
description: How to inspect a repository when the connected GitHub API rejects archive downloads.
---

The connected GitHub proxy may return 403 for repository `zipball` downloads even when normal repository reads are authorized. Do not treat that response as proof that repository access is unavailable.

**Why:** ARK-X tree and file APIs worked with the active GitHub connection while the archive endpoint returned `403 Forbidden`.

**How to apply:** Use the recursive Git tree endpoint for inventory, then retrieve only required files through the contents or blob endpoints. For a synchronized workspace, verify the branch/commit and use local source for broad analysis while treating GitHub inventory as the repository check.