## 2026-08-29 — OSMINOG 3.11.24 SETTINGS CLOSE HOTFIX

Owner installed 3.11.23 and immediately found a blocker: Agent Settings could not be closed by the X button or by the settings toggle. Root cause confirmed in code: the 3.11.23 responsive settings layout added `.gpt-settings-popover { display:grid!important }`, which visually overrode the element `hidden` state. Event handlers were changing `hidden=true`, but CSS forced the surface to remain rendered.

3.11.24 fixes only this blocker without adding new product behavior: `[hidden]` is authoritative again, and Settings now uses a single `setSettingsOpen()` state path. The X button, repeated gear click, click outside Settings, and Escape all close the same surface. The hotfix keeps all 3.11.23 agent/provider/node changes intact.

Artifact: `OSMINOG-Chrome-3.11.24-SETTINGS-CLOSE-HOTFIX-ROOT.zip` · 56 files · 344145 bytes · SHA-256 `31b29ec5179a33536dc418c19ac71b842409a6209cf50f9b73171c0266650d17`.

Static verification: 21 JS syntax PASS, 8 JSON parse PASS, 0 duplicate HTML IDs per document, ZIP integrity PASS. Owner runtime pending.
