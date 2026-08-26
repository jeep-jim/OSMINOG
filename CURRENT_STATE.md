# BriefCraft — CURRENT STATE

Date: 2026-08-27

- **Recovery target / last user-confirmed stable build: 3.8.43.**
- Stable commit: `b17638ff3925214636b772d43a93dbb2ba204d5d`.
- Permanent recovery branch: `recovery/briefcraft-3.8.43-stable`.
- `versions/index.json` and `versions/3.8.43.json` are the recovery/version registry.
- 3.8.51 was rejected and was not the installed base; 3.8.52 explicitly installed over 3.8.50.
- Current recovery feed: **3.8.54**, a one-time rollback engine that reverses 3.8.52, 3.8.50, 3.8.49, 3.8.48, 3.8.47, 3.8.46, 3.8.45 and 3.8.44, then writes local manifest version back to **3.8.43** and reloads.
- Before rollback, key source files are copied locally to `.briefcraft-recovery/3.8.53/`.
- After the user confirms that 3.8.43 is restored, replace the temporary rollback feed with a stable/no-update 3.8.43 feed before continuing work.
- From now on, every runtime-tested stable version must receive a permanent `recovery/briefcraft-<version>-stable` branch and an entry in `versions/index.json` before newer risky work begins.
- OWNER online updater remains the development update channel.
- Preserve the fixed extension manifest `key` forever.
- Proven transports retained by stable 3.8.43: GPT direct authenticated session; DeepSeek direct authenticated hidden web-session.
- Payment research memory: `docs/PRODAMUS.md`.
