## 2026-08-28 — Dev Hub bootstrap 1.1.1 failed; deterministic managed update architecture adopted

### Runtime result
- Dev Hub 1.1.1 installed successfully.
- The owner explicitly selected the real OSMINOG unpacked folder on the Windows Desktop.
- Bootstrap `3.10.6 → 3.10.7` still did not complete; the installer reported that the working OSMINOG folder could not be retained/resolved.
- Therefore Dev Hub path discovery and mutation of an arbitrary existing `Load unpacked` folder is **not runtime-proven** and is no longer the target architecture.

### Decision
Stop spending development time on smarter scanning of Chrome Preferences/Desktop folders. The underlying contract is wrong: an arbitrary developer-selected unpacked source path should not be inferred by the updater.

A new canonical update architecture is adopted and documented in `docs/OSMINOG_UPDATE_ARCHITECTURE.md`.

### Development channel — Managed Dev Channel v2
- Dev Hub owns one deterministic extension root: `%LOCALAPPDATA%\OSMINOG\Chrome\current`.
- Dev Hub downloads a complete canonical version package from the GitHub development release/feed and verifies byte size, SHA-256, root manifest, version and fixed manifest key before installing it.
- The owner performs one final manual Chrome development action: load that **managed `current` folder** through `Load unpacked`.
- From that point forward the extension source path never changes and Dev Hub never asks which folder contains OSMINOG.
- Normal flow becomes: `OSMINOG update button → Native Messaging → Dev Hub → GitHub package/feed → verification → staging → backup → managed current → chrome.runtime.reload()`.
- Full immutable packages are the default recovery artifact; differential filesets may remain only as an optional optimization.

### Production channel
- Production Chrome users must not need Dev Hub for routine updates.
- Target production flow: `CI build → validation → Chrome Web Store API upload → review/publish → Chrome automatic extension update`.
- Chrome's published extension update mechanism compares versions and automatically updates installed extensions when a newer published version is available.
- Store trusted-testers/beta can be used when useful, but Store publication remains review-bound and is not the rapid local development channel.

### Explicitly retired approaches
- no repeated manual ZIP download/unpack as the intended steady-state development process;
- no repeated Desktop scanning;
- no Chrome Preferences path guessing as the primary update contract;
- no folder selection for every update;
- no more `Dev Hub 1.1.x` iterations whose main purpose is finding an arbitrary source folder.

### Exact next updater milestone
Implement **Managed Dev Channel v2**, then perform one end-to-end `UPDATE PROOF` from the OSMINOG button with:
1. no user-downloaded version ZIP;
2. no folder picker;
3. no manual file replacement;
4. verified download/staging/backup;
5. automatic extension reload;
6. visible version transition confirmed at runtime.

Until this milestone is implemented, manual ZIP replacement remains an acceptable temporary development fallback and must not block the current OSMINOG UX/stability work.
