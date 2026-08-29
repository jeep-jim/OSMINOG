## 2026-08-29 — 3.11.11 SHELL POSITION FIX

Owner installed 3.11.10 and supplied a real Chrome screenshot. The intended Ocean Desktop Shell controls loaded, but the top-right utilities and newly detached shell controls visually accumulated in the upper-left. Root cause: they remained descendants of the legacy glass `topbar`; browser containing-block behavior for filtered/glass ancestors made the fixed descendants position relative to the old header instead of the viewport.

3.11.11 fixes this structurally rather than by adding more offsets. While Ocean is active, `top-left`, `layersToggle`, `modeSwitch`, and `top-actions` are physically portaled into the root `#app`. The top-right Access / Chat AI / Export utilities therefore remain top-right; identity/language/theme stay upper-left; Layers is independent; Brief/Code/Browser/Design/Team stay on the right as a separate workspace-mode rail; the existing inspector/right rail is not moved. Switching to Space restores the original DOM positions inside the classic topbar.

Artifact: `OSMINOG-Chrome-3.11.11-SHELL-POSITION-FIX-ROOT.zip` · 55 files · 363750 bytes · SHA-256 `cfbd35bdd7297c129e90067d944b20061ded39def29a2c4c3631dc639f2cd674`.

Static verification: 21 JS syntax PASS, 9 JSON parse PASS, 0 real duplicate HTML IDs, ZIP integrity PASS. Owner runtime pending.
