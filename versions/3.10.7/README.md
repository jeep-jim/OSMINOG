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

## Artifact prepared
`OSMINOG-Chrome-3.10.7-UPDATE-BRIDGE-ROOT.zip`

- Size: 313665 bytes
- SHA-256: `67f249ae34d4167b9ec8cce52b1c2bd9b9bf35e8a7e163dfd31cccd71d0ad85a`
- Files: 52
- Manifest version: 3.10.7

Runtime verification on the owner's Windows/Chrome installation is required before this build is called proven.
