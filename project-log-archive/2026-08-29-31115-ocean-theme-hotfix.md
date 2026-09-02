## 2026-08-29 — OSMINOG 3.11.15 OCEAN THEME HOTFIX

Owner installed 3.11.14 THREE THEME RESET and verified a runtime regression: Light/Dark workspace existed, but switching to Ocean produced a blank blue screen with the working UI missing.

Decision remains unchanged: OSMINOG has one familiar workspace layout and three visual themes — Light, Dark, Ocean. Ocean must not own a separate navigation/shell DOM.

3.11.15 hotfix:
- Ocean is now CSS-only over the standard workspace DOM/layout.
- Removed runtime creation of the full-screen `oceanAmbience` DOM layer.
- Removed any dependence on separate Ocean shell/navigation surfaces.
- Ocean changes only theme variables, underwater gradients, glass/material styling and lightweight FX preferences.
- `applyTheme()` preserves an already-open `#app` when cycling themes.
- Stale abandoned Ocean nodes are removed on init if an unpacked-extension live tab survived reload.
- No Ocean animation-frame loop, collision timer, bubble grouping or alternate interaction engine is reintroduced.

Candidate artifact: `OSMINOG-Chrome-3.11.15-OCEAN-THEME-HOTFIX-ROOT.zip`
- 55 files
- 323297 bytes
- SHA-256 `d2130d19f25a15577e7bfbf3b7bec654cd7a1d3bbe4dd6480a5fe49f3bf70ace`
- JS syntax PASS (21 files)
- JSON parse PASS (9 files)
- duplicate real HTML IDs: 0
- ZIP integrity PASS

Owner runtime pending.
