# Mouse landing — light-theme burrow and capture heading

Owner request, 2026-11-23: invert the light-theme burrow lighting so the top is grey and the bottom white.

## Change and local verification

- Only website/site.css changes runtime behaviour. Light gradient stops are #b8b8b8 → #f2f2f2 → #ffffff; the mouse remains black.
- Both floor divider pseudo-elements use --line independently of the gradient floor, so the 1 px divider remains visible. SVG geometry, blink/sniff animations, sizing, text and translations are unchanged.
- Focused Chromium review confirmed the computed light stops, black mouse and #b8b8b8 divider. The 645 × 782 px left pane was visually reviewed. Switching to dark restored the original #030303 → #0b0b0b → #505050 stops, #d8d8d8 mouse and #505050 divider.
- Static build/SEO passed: 73 HTML pages, 72 locales, 72 sitemap URLs. Local 6.0.36 remains the existing fixture; production resolves official download channels. git diff --check passed. No extra tests were added for this CSS-only change.

## Burrow publication

Published and independently verified on 2026-11-23 at 19:09 Krasnoyarsk time (12:09 UTC).

- Source a8a21638ef90bc5afb5d4e308f69bf5d8f7c7653; tree 31ef0c9531c4a1a4f01e3a3d1f363a4fed0458f4 matched the reviewed tree. Main was updated non-force against d4185b02a08ae689bfca449774c69663e105a35a and read back.
- [Website run 45171244835](https://github.com/jeep-jim/OSMINOG/actions/runs/45171244835) succeeded: validation 137681041807, publication 137681188825. Deployment 450f17dc8125b976013c2d964a8ecdffea67a897.
- Release timer verified this source at 2026-11-23T12:08:48.441311+00:00. Independent live gate at 12:09:31 UTC passed HTTPS/canonical redirects, exact RU/EN/AR HTML, 72 sitemap languages, 73 language-graph entries and SHA256 checks of all three complete installers. Public downloads remain 6.0.37.
- Artifact 14817146439, 2303 bytes; ZIP SHA256 51c0641e93ee453486b4493bfa2f5d46a80198123dd9c2400617527af5d9675d.
- Public Chromium review of https://mouse.black/ru/ confirmed the light stops #b8b8b8 / #f2f2f2 / #ffffff, black mouse and #b8b8b8 separator. [Live screenshot](evidence/2026-11-23-light-burrow-live.jpg), SHA256 ab5e3172c83d4bc57d6191ad1abb3876f2a50531fc957f136889070c41c0b930. Local preview stopped.

## Follow-up: explicit capture heading

While publication was completing, the owner requested “Скриншоты и текст” instead of “Полезное рядом”. Updated the Russian fallback and captureTitle in all 72 locale entries (English: “Screenshots and text”), preserving every other translation field and the feature description. Translation wording follows the existing capture descriptions; independent native-speaker review of every language has not been performed.

Static build/SEO passed again (73 pages / 72 locales). A structural comparison confirmed captureTitle is the only changed field in each locale. Follow-up publication pending.
