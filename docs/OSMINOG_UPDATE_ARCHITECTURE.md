# OSMINOG — update architecture

## Decision

Stop trying to discover and mutate an arbitrary `Load unpacked` folder chosen by the developer. That path is not a stable product contract and the 1.1.0 / 1.1.1 bootstrap tests proved it is too fragile.

OSMINOG uses two separate update channels:

1. **Development channel — OSMINOG Dev Hub**
2. **Production channel — Chrome Web Store**

---

## Development channel

### One deterministic install root

Dev Hub owns a fixed location:

`%LOCALAPPDATA%\OSMINOG\Chrome\current`

Related state:

- `%LOCALAPPDATA%\OSMINOG\Chrome\versions\`
- `%LOCALAPPDATA%\OSMINOG\Chrome\staging\`
- `%LOCALAPPDATA%\OSMINOG\DevHub\`

The developer must not keep changing the Chrome extension source path between versions.

### One-time migration/bootstrap

The only manual development setup allowed after this architecture is introduced:

1. Dev Hub downloads the selected canonical OSMINOG Chrome baseline from the GitHub development release feed.
2. It verifies byte size, SHA-256, root `manifest.json`, manifest version and the fixed manifest key.
3. It installs that baseline to `%LOCALAPPDATA%\OSMINOG\Chrome\current`.
4. The developer loads **that exact folder** once through Chrome `Load unpacked`.
5. The old arbitrary Desktop copy may remain only as a backup/source archive; Chrome must no longer run from it.

After the managed folder is loaded once, Dev Hub never scans Desktop or Chrome Preferences to discover the application directory again.

### Normal dev update flow

`OSMINOG button → Native Messaging → Dev Hub → GitHub release/feed → verify → stage → backup → apply to managed current → response → chrome.runtime.reload()`

Detailed requirements:

1. OSMINOG sends its current version and channel to Dev Hub.
2. Dev Hub reads the dev feed and compares versions.
3. Dev Hub downloads a **complete immutable version package** by default. Differential filesets are optional optimization, not the recovery source of truth.
4. Dev Hub verifies SHA-256 and declared byte size before changing the live folder.
5. Package is extracted to staging and validated completely.
6. Current managed folder is backed up.
7. The verified staged build is applied to the fixed managed folder.
8. Dev Hub returns `updated` only after the live `manifest.json` reports the expected version and fixed key.
9. OSMINOG calls `chrome.runtime.reload()`.
10. On failure, the current build remains usable or is restored from backup.

### Why the fixed folder matters

The updater no longer has to guess where Chrome loaded the extension from. The path is an OSMINOG-owned invariant, not inferred user state.

### Package policy

OSMINOG Chrome is currently small enough that full packages are preferable for development reliability. Each version must have:

- unique versioned artifact name;
- SHA-256;
- byte size;
- manifest version;
- fixed-key verification;
- static checks;
- runtime state;
- rollback metadata.

GitHub keeps the immutable build history; the rolling development release points to the latest candidate.

---

## Production channel — Chrome Web Store

Production users must **not** install Dev Hub to receive normal Chrome-extension updates.

The production flow is:

`CI build → validation → Chrome Web Store API upload → review/publish → Chrome automatic extension update`

Chrome's extension update system compares the installed extension version with the published version and automatically updates when a newer published version is available.

OSMINOG CI should eventually automate package upload/submission through the Chrome Web Store API. Store submission/review remains part of the platform publishing process.

The in-product production update UI should therefore communicate Store state rather than replacing Chrome's updater. It may show current version / available version / release notes and, where appropriate, request or encourage a Chrome update check, but the production binary delivery belongs to Chrome Web Store.

---

## Beta/testing channel

Chrome Web Store trusted testers can be used for slower beta validation, but every Store publish is still a review-bound publication path. It is not a replacement for minute-to-minute local development.

Therefore:

- rapid internal development → Dev Hub managed folder;
- beta/test population → Store testing channel when useful;
- production → Store stable publication.

---

## Failed approaches that must not be reintroduced

- repeatedly asking the owner to download and unzip every version;
- scanning arbitrary Desktop folders on every update;
- guessing the current unpacked path from Chrome Preferences as the primary architecture;
- requiring the owner to choose the extension folder for every version;
- treating micro-patch filesets as the only recoverable build artifact;
- claiming an update succeeded before the live manifest/version/hash is verified.

---

## Migration milestone

The next updater implementation is not `Dev Hub 1.1.2 path detection`.

It is **Managed Dev Channel v2**:

- create deterministic `%LOCALAPPDATA%\OSMINOG\Chrome\current`;
- install/download canonical baseline there;
- one-time user `Load unpacked` from that folder;
- prove `current version → UPDATE PROOF` using the OSMINOG button with no archive download, no folder selection and no manual file replacement.

Only after that proof is the Dev Hub update path considered runtime-proven.


## Implementation correction — 2026-11-07 / Chrome 4.0.37 candidate

The Dev Hub text above records the intended historical architecture. It does **not** describe the currently executing Chrome 4.0.36 code: `editor.js` calls `OSMINOGFolderUpdater.update()` in the extension page, and the native host constant is unused. There is no active Native Messaging fallback in that code path.

The 4.0.37 candidate retains the current explicitly authorized native directory handle and fixed key, but replaces recursive whole-directory memory snapshots with a bounded package-path transaction. Only program files named by the verified package are read or written. Backup records are durable per file; the journal tracks interrupted work; the manifest is committed last. The replacement updater is version 2.0.0.

A verified disk install is followed by a version-bound reload handoff and a temporary normal tab. The new editor, running the target manifest version, acknowledges readiness before that untouched temporary tab is removed. No browser restart or blanket window/tab closure is part of this path.

Because the old updater executes before installing a new ZIP, a new ZIP alone cannot repair its first transition. The generated self-contained recovery page explicitly asks for the installed OSMINOG folder and uses the new updater directly. It changes no browser profile, extension ID or user-project storage. The next fresh toolbar popup detects the installed version on disk and offers Finish update. The native-folder update and fresh-popup bootstrap are separate required Chromium tests. If that bootstrap fails, do not instruct the owner to retry and do not promote the candidate as delivered.

After that one-time repair, subsequent updates use the existing in-product button and remembered handle. The dev feed requires updater 2.0.0 to refuse unsafe legacy installations before folder backup. Cached old preflight data and old editor save code are outside that remote fence; this is not a claim that updating the feed remotely patches a running installation.
