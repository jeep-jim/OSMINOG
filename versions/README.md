# BriefCraft version registry

From 2026-08-27 onward every runtime-tested stable build must get a permanent recovery ref before newer work continues.

## Rules

1. Never delete a stable recovery branch.
2. Stable branch format: `recovery/briefcraft-<version>-stable`.
3. `versions/index.json` is the human/machine registry.
4. Every stable record stores the exact Git commit that published that version's update manifest, its tested status, and the previous stable/base.
5. Before a new risky update, create/verify the recovery ref for the currently working version.
6. Rollbacks must use historical update manifests in reverse order; do not approximate or rebuild from memory.
7. Preserve the fixed Chrome extension manifest `key` forever.

The first pinned recovery is **3.8.43** at commit `b17638ff3925214636b772d43a93dbb2ba204d5d`.
