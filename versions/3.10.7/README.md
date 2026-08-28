# OSMINOG Chrome 3.10.7 — UPDATE BRIDGE

Base: 3.10.6 CANVAS CONTROL.

This build is intentionally not a feature expansion. It connects the existing OSMINOG update button to the new Dev Hub native bridge.

## What changes
- The update button performs a real Dev Hub status check, update check and verified update request.
- After Dev Hub reports success, OSMINOG stores the existing reopen marker and calls `chrome.runtime.reload()`.
- The update popover reports real Dev Hub state/errors instead of saying automatic updates are disabled.
- Fixed Chrome manifest key and the legacy Native Messaging compatibility name `com.briefcraft.updater` are preserved.

## OSMINOG Dev Hub 1.1 bootstrap
- Dev Hub uses the public OSMINOG dev feed in `jeep-jim/chernogram_new@briefcraft-releases`.
- It automatically searches Chrome profile Preferences/Secure Preferences for the currently loaded extension ID and validates the fixed manifest key.
- It stages the update beside the live extension directory, validates resulting hashes/version/key, swaps the directory, and keeps rollback copies under `%LOCALAPPDATA%\\OSMINOG\\DevHub`.
- The one-time installer attempts the 3.10.6 → 3.10.7 bootstrap itself. The owner should then press Chrome `Reload` once. From 3.10.7 onward, development updates are intended to be one-click from inside OSMINOG.

## Verified local artifact
`OSMINOG-Chrome-3.10.7-UPDATE-BRIDGE-ROOT.zip`

- Size: **313664 bytes**
- SHA-256: `fff22fb96aa3fe3959a832e44a11794c84a1238742015813a8878293ee8ec300`
- Files: 52
- Manifest version: 3.10.7
- Fixed manifest key preserved.
- Applying the public 3.10.6 → 3.10.7 fileset reproduces the exact 52-file tree byte-for-byte.

## Dev Hub installer CI
GitHub Actions run `33175649379` completed successfully.

- Artifact: `OSMINOG-Dev-Hub-Setup`
- Artifact ID: `9687487683`
- Installer EXE size: **24031246 bytes**
- Installer EXE SHA-256: `84b56099bd7222d4d786fbe0af7eac00ac271cb6eb2912c48d219e5794dfec8e`

Runtime verification on the owner's Windows/Chrome installation is still required before either the bootstrap or the one-click button updater is called proven.
