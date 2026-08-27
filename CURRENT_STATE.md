# BriefCraft — CURRENT STATE

Date: 2026-08-27

- **Recovery target / last user-confirmed stable build: 3.8.43.**
- Stable commit: `b17638ff3925214636b772d43a93dbb2ba204d5d`.
- Permanent recovery branch: `recovery/briefcraft-3.8.43-stable`.
- Exact reconstructed recovery ZIP: `BriefCraft-AI-3.8.43-STABLE-RECOVERY.zip`, SHA-256 `80d44340a804547ba8ab1bda42acbd9e6cc7315d10845b8e03003966baf7bf8c`.
- `versions/index.json`, `versions/3.8.43.json`, and `versions/3.8.43-package.json` are the recovery/version registry.
- The legacy OWNER updater that writes patches into a user-selected local extension folder is **paused and deprecated**. It cannot support one installation across home/work PCs reliably.
- **Chrome Web Store publication/review is postponed until BriefCraft is product-ready.** The prepared 3.8.55 CWS package is archived only and must not be submitted now.
- Active development architecture: private GitHub full version packages → owner-only native Dev Updater → fixed hidden application directory on each PC → one-click update + `chrome.runtime.reload()`.
- The owner must never select or manage the application-source directory. The updater owns a deterministic path such as `%LOCALAPPDATA%\\BriefCraft Dev\\current`; the project/data folder remains completely separate.
- One-time setup per PC: install/register the native updater and load the fixed unpacked BriefCraft directory once. After that, updates and rollbacks are driven from BriefCraft without asking for folders.
- Private GitHub authentication belongs in the native helper / OS credential store, never in extension code or project files.
- The native updater must download complete immutable builds, verify SHA-256, retain several previous versions, perform an atomic replacement, report progress to BriefCraft through Native Messaging, and reload the extension only after verification.
- A future public release will switch the same build pipeline to Chrome Web Store delivery; Google review is not part of the current development loop.
- Prepared but parked package: 3.8.55, file `BriefCraft-AI-3.8.55-CWS-BETA-3.8.43-STABLE.zip`, SHA-256 `768b4b8035e8649da770aafbc802508360eecb4b1aa482ab7ca30a73ec584366`.
- Keep the working GitHub repository private. Public source does not solve Chrome Manifest V3 delivery restrictions.
- From now on, every runtime-tested stable version must receive a permanent `recovery/briefcraft-<version>-stable` branch, complete package hash, and an entry in `versions/index.json` before newer risky work begins.
- Preserve the fixed extension manifest `key` forever.
- Proven transports retained by stable 3.8.43: GPT direct authenticated session; DeepSeek direct authenticated hidden web-session.
- Payment research memory: `docs/PRODAMUS.md`.
