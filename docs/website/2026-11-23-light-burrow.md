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

Static build/SEO passed again (73 pages / 72 locales). A structural comparison confirmed captureTitle is the only changed field in each locale. Follow-up published and independently verified on 2026-11-23 at 19:14 Krasnoyarsk time (12:14 UTC).

- Source 1eb42a4dc1b5732abe696597a3dedeeaebaba3d3; tree 13dfa13a03fdde404ab1db8eb90ac0c1ae3bf593 matched the reviewed tree. Expected parent a8a21638ef90bc5afb5d4e308f69bf5d8f7c7653, non-force update and read-back verified.
- [Website run 45172026289](https://github.com/jeep-jim/OSMINOG/actions/runs/45172026289) succeeded: validation 137683695285, publication 137683844070. Deployment 9c8c4ecd68a6bb9b989b4438792bf5b2963d1f90 includes both the burrow correction and the 72 renamed headings.
- Timer checked this source at 2026-11-23T12:13:42.488573+00:00. Independent external live gate at 12:14:29 UTC verified exact RU/EN/AR pages with the updated feature names, HTTPS/redirects, the language graph and all three complete installer SHA256 values. Receipt: MOUSE_PAGES_LIVE_VERIFIED sitemap_languages=72 sampled_languages=3 downloads_sha256=3.
- Artifact 14817197238, 2301 bytes; ZIP SHA256 058e30fff1d26d894173267c4051e03e815f06667f33bb438534c8edc83a55c0.
- The feature description and every other locale field are preserved. No browser build, checkout, DNS or AvtoCena changes were made.
