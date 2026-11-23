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

Pending the website deployment workflow and independent live verification.
