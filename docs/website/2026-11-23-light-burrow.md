# Mouse landing — light-theme burrow lighting

Owner request, 2026-11-23: invert the light-theme burrow lighting so the top is grey and the bottom white.

## Change and local verification

- Only website/site.css changes runtime behaviour. Light gradient stops are #b8b8b8 → #f2f2f2 → #ffffff; the mouse remains black.
- Both floor divider pseudo-elements use --line independently of the gradient floor, so the 1 px divider remains visible. SVG geometry, blink/sniff animations, sizing, text and translations are unchanged.
- Focused Chromium review confirmed the computed light stops, black mouse and #b8b8b8 divider. The 645 × 782 px left pane was visually reviewed. Switching to dark restored the original #030303 → #0b0b0b → #505050 stops, #d8d8d8 mouse and #505050 divider.
- Static build/SEO passed: 73 HTML pages, 72 locales, 72 sitemap URLs. Local 6.0.36 remains the existing fixture; production resolves official download channels. git diff --check passed. No extra tests were added for this CSS-only change.

## Publication

Pending website workflow and independent live gate.
