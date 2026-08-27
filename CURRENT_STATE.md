# BriefCraft — CURRENT STATE

Date: 2026-08-27

- **Recovery target / last user-confirmed stable build: 3.8.43.**
- Stable commit: `b17638ff3925214636b772d43a93dbb2ba204d5d`.
- Permanent recovery branch: `recovery/briefcraft-3.8.43-stable`.
- Exact reconstructed recovery ZIP: `BriefCraft-AI-3.8.43-STABLE-RECOVERY.zip`, SHA-256 `80d44340a804547ba8ab1bda42acbd9e6cc7315d10845b8e03003966baf7bf8c`.
- `versions/index.json`, `versions/3.8.43.json`, and `versions/3.8.43-package.json` are the recovery/version registry.
- The legacy OWNER updater that writes patches into a user-selected local extension folder is **paused and deprecated**. It cannot support one installation across home/work PCs reliably.
- Correct Chrome architecture: private GitHub source/version archive → complete validated package → private Chrome Web Store beta/trusted-testers channel → Chrome-managed update on every PC.
- Prepared beta bootstrap package: **3.8.55**, behavior based on stable 3.8.43, file `BriefCraft-AI-3.8.55-CWS-BETA-3.8.43-STABLE.zip`, SHA-256 `768b4b8035e8649da770aafbc802508360eecb4b1aa482ab7ca30a73ec584366`.
- Release branch: `release/briefcraft-3.8.55-cws-beta`.
- In 3.8.55, the legacy local-folder/GitHub patch updater is removed; the Update control uses Chrome's store-managed update check only.
- One manual private Chrome Web Store bootstrap upload is required; afterward the installed store build updates without any local source folder.
- Setup guide: `docs/CWS_BETA_BOOTSTRAP.md`. Architecture record: `docs/UPDATE_ARCHITECTURE.md`.
- Keep the working GitHub repository private. Public source does not solve Chrome Manifest V3 delivery restrictions.
- From now on, every runtime-tested stable version must receive a permanent `recovery/briefcraft-<version>-stable` branch, complete package hash, and an entry in `versions/index.json` before newer risky work begins.
- Preserve the fixed extension manifest `key` forever.
- Proven transports retained by stable 3.8.43: GPT direct authenticated session; DeepSeek direct authenticated hidden web-session.
- Payment research memory: `docs/PRODAMUS.md`.
