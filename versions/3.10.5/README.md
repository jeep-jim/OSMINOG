# OSMINOG Chrome 3.10.5 — DESKTOP UX & STORE

Base: 3.10.4 RECOVERY PERFORMANCE.

## Included

- Collapsed Layers shows section icons only; the project folder and `+` controls stay at the bottom.
- Main project folder is draggable.
- Agent desktop pills can be shown, hidden, collapsed and renamed; linked objects can auto-show the required agent.
- Minimized Team bubble is draggable and persists its position.
- Provider Registry has search, larger identity marks, draggable desktop shortcuts and a separate OSMINOG Store developer-rules page.
- Global interface text-size presets: compact, normal, large and extra-large.
- Consecutive bubbles from the same participant retain Telegram-style grouping with exactly 4 px spacing.
- Any virtual folder can return to the OSMINOG desktop after being closed or nested:
  - Explorer hover action;
  - right-click menu;
  - open-folder header action;
  - drag-out from Explorer onto the desktop.
- Welcome/empty-state canvas and folder preferences are null-safe.

## Artifact

`OSMINOG-Chrome-3.10.5-DESKTOP-UX-STORE-ROOT.zip`

- Size: `305426` bytes
- SHA-256: `871ddcc85ebd4d3679640fdf21a6e1a354271b06c9dbb2b1feb70b82cdb7ce08`
- Files: `52`
- Root `manifest.json`: yes
- Fixed Chrome key: preserved

## Verification

- All 19 JavaScript files pass `node --check`.
- All 9 JSON files parse.
- No duplicate HTML IDs.
- No missing local references.
- CSS parser reports no errors.
- ZIP integrity passes.
- Controlled Chromium smoke verified folder close → restore via API and Explorer action, with no page or console errors.

Runtime verification on the owner's Windows/Chrome/project data is still required. Automatic development updates remain disabled until OSMINOG Dev Hub is built.
