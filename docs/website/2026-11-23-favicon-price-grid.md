# Mouse landing — favicon, price spacing and footer grid

## Scope

Owner request on 2026-11-23: remove the favicon badge/outline, use a large black or white mouse according to the browser theme, separate `$` and `3` by one pixel-font square, and align the two footer captions to the lower content grid.

- `favicon.svg` and `favicon-dark.svg` contain the unchanged original mouse path, black and white respectively, with no background, stroke or transform. The square viewBox `0 -1 19 19` fills the width and centres the 19 × 17 glyph vertically.
- One versioned icon link is selected by `matchMedia('(prefers-color-scheme: dark)')` on initial load and preference changes. It is independent of the landing page theme switch. Static SVG colours avoid relying on an SVG-internal colour-scheme rule. The fallback without JavaScript is black.
- `letter-spacing: 0` restores the font's existing spacing. MouseGrid uses a 1000-unit em and 140-unit square; each glyph advances 840 units with ink bounds 70–770, so the gap is `840 - 770 + 70 = 140` units, exactly one square (29.12 px at the 208 px desktop font size).
- Footer and about/language section share their width and horizontal margins: maximum 1120 px, 48 px outer gutters on desktop and 24 px on narrow screens. Footer horizontal padding no longer moves the captions off this grid.
- Translation strings, downloads, browser release publishing, showcase controls, payment status and the separate AvtoCena project are unchanged.

## Verification before publication

- Existing Python website tests: 51 passed; existing Node download tests: 4 passed. JavaScript syntax and `git diff --check` passed.
- Static build/SEO: 73 HTML pages, 72 locales and 72 sitemap URLs. Local version 6.0.36 is the existing fixture; production resolves official release channels.
- Chromium desktop review, Chinese locale: at 1348 px document width footer and about both span x=114..1234, width 1120. The price visibly has one square of clearance.
- Constrained iframe review: Russian at 375 px frame width (360 px document after scrollbar), footer/about x=24..336; Arabic at 320 px frame width (305 px document), both x=39..296, with RTL scrollbar on the left. Neither has horizontal document overflow.
- Manual browser fixture changed inherited browser preference light → dark → light: the actual site link changed black → white → black. The page theme switch remained independent (light page with dark-preference white icon). Original SVG assets inspected at 16, 32 and 96 px. This verifies Chromium behaviour, not every browser's tab cache or physical-device rendering.
- Independent read-only review approved the six source files. Temporary review HTML was removed before the final SEO gate and is not part of the published site.

## Publication

Published and independently verified on 2026-11-23 at 16:47 Krasnoyarsk time (09:47 UTC).

- Source `17e4efab943a1d224d83cbe130972732371e86ec`, tree `770b825f346fb895089f8411567c3f524d8d0dbf` exactly matched the reviewed tree. Non-force main update used expected parent `c931d5af9cbe93dc1f7719346c5f6f0c1a3f70ec` and was read back.
- [Website run 45149880782](https://github.com/jeep-jim/OSMINOG/actions/runs/45149880782): validation job `137608306113` and publication job `137608445906` both successful.
- Deployment `7cf062eea56e614594010b2800f9baddc020eef6`; release timer checked this source at `2026-11-23T09:47:04.400157+00:00`, followed by `MOUSE_WEBSITE_AUTOMATION_LIVE https://mouse.black`.
- Independent live gate at `2026-11-23T09:47:48Z`: HTTPS/canonical redirects, Russian/English/Arabic HTML, 72 sitemap languages, 73 language graph entries and all three complete installer SHA256 values passed: `MOUSE_PAGES_LIVE_VERIFIED sitemap_languages=72 sampled_languages=3 downloads_sha256=3`. Official public downloads remain 6.0.37 on mouse.black.
- Evidence artifact `14805218381`, 2301 bytes, ZIP SHA256 `33dd08f6900237e35b61f8377a723e3317418f158faabe90051bc1bb87d5f151`.
- Live Chromium review of [the Russian pricing section](https://mouse.black/ru/#pricing) confirmed the new versioned favicon link, native price spacing at 208 px, and footer/about edges x=114..1234 at document width 1348 px. [Live screenshot](evidence/2026-11-23-favicon-price-grid-live.jpg), SHA256 `c92f83917ca857cb38fc72df826e69d390e51b40d7bd23c6fa65c53e4dfcf055`.

No physical-device or Safari-specific favicon cache test was performed. The website's browser theme signal is the reported `prefers-color-scheme` preference. The local preview was stopped after verification.
