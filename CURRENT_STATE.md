# BriefCraft — CURRENT STATE

Date: 2026-08-27

- **Recovery target / last user-confirmed stable product behavior: 3.8.43.**
- Stable commit: `b17638ff3925214636b772d43a93dbb2ba204d5d`.
- Permanent recovery branch: `recovery/briefcraft-3.8.43-stable`.
- Exact reconstructed recovery ZIP: `BriefCraft-AI-3.8.43-STABLE-RECOVERY.zip`, SHA-256 `80d44340a804547ba8ab1bda42acbd9e6cc7315d10845b8e03003966baf7bf8c`.
- The legacy updater that asks the owner to select a local application folder is deprecated and paused.
- Chrome Web Store submission is postponed until the product is ready.

## Active development installation

- One-time Windows bootstrap: `BriefCraft-AI-3.8.56-ONE-TIME-ONLINE-SETUP-WINDOWS.zip`.
- Bootstrap ZIP SHA-256: `641138a8459f957b10f34a11545d0e9127f3c1dafc4ed213354e9ff4d6753fab`.
- The installer owns `%LOCALAPPDATA%\\BriefCraft Dev\\extension`, `%LOCALAPPDATA%\\BriefCraft Dev\\updater`, and recovery builds under `%LOCALAPPDATA%\\BriefCraft Dev\\versions`.
- The user loads the fixed extension directory once in Chrome. No update folder is selected again.
- Native host: `com.briefcraft.updater`, host version `1.1.0`, extension ID `hfckimbjiahikihjoceoegilaiolmkgk`.
- BriefCraft 3.8.56 is the one-time bootstrap; 3.8.57 is the online update proof.
- The `3.8.56 → 3.8.57 → rollback to 3.8.56` chain passed an end-to-end updater test with SHA verification, backup creation and exact file-result verification.
- Public binary/feed branch: `jeep-jim/chernogram_new@briefcraft-releases`. It contains release manifests/filesets only; private BriefCraft source remains private.
- Dev feed: `briefcraft/channels/dev/chrome-extension.json`.
- 3.8.57 uses a cumulative fileset: complete `manifest.json` plus a SHA-guarded `editor.html` patch. Future releases may ship complete files and exact patches through the same feed.

## Unified platform layout

Private source branches:
- `platform/web-pwa`
- `platform/chrome-extension`
- `platform/windows`
- `platform/macos`
- `platform/android`
- `platform/ios`

Public dev release-feed placeholders exist for all six platforms. Chrome extension is active; other clients are prepared for future builds.

## Rules

- Preserve the fixed manifest `key` forever.
- Every tested stable version must receive a recovery branch, complete package/hash and version-registry entry before riskier work begins.
- Project/data folders are separate from application/update folders.
- A future public Chrome release will switch transport to Chrome Web Store without changing the product's Update-button UX.
- Proven transports retained by the stable core: GPT direct authenticated session; DeepSeek direct authenticated hidden web-session.
- Payment research memory: `docs/PRODAMUS.md`.
