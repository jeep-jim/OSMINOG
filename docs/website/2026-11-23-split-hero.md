# Mouse landing — split hero and readable monthly price

## Owner request and implementation

On 2026-11-23 the owner requested a first screen that demonstrates split browsing itself: text in the left window, the existing site presentation in the right window, and the lower sections retained. The owner also requested an ordinary-text repeat of the USD 3 price beneath the large price.

- Two equal-width, equal-height windows use the existing monochrome theme, thin borders and browser-style title bars. The mascot, burrow floor, one-line headline, introduction and existing download controls are in the left window.
- The original captured-site showcase occupies the right window. Its animation, scene picker, colour response, fullscreen dialog and pane controls are preserved. Preview-only chrome styles are scoped to the dock, so fullscreen keeps its full layout.
- At viewport widths up to 960 px, the windows stack. RTL copy retains its direction while the physical desktop pane order stays text-left/presentation-right.
- Three feature burrows, the pricing section, SEO text and expanded language links retain their existing content and order. The monthly price label now repeats the number and currency in ordinary text in all 72 locales: Russian “3 доллара США в месяц”, English “3 US dollars per month”. No other locale fields change.
- Payment remains labelled coming soon. This change does not introduce checkout, a subscription entitlement, a browser release or hosting changes.

## Verification

- Existing Python website suite: 51 passed. Existing Node download suite: 4 passed. `git diff --check` and deploy/bootstrap shell syntax checks passed.
- Static build and SEO checks passed: 73 HTML pages, 72 locales and 72 sitemap URLs. The local build uses the existing 6.0.36 fixture; publication resolves the actual official download channels.
- Browser review at 1348 px content width: both windows 645 × 782 px, a one-line Russian headline, working dark/light themes, no horizontal overflow.
- Fullscreen opened at 1327 px frame width with its description visible; keyboard pane reordering/resizing and pane zoom/restore worked. Closing restored the experience to the right dock and normal body scrolling. The installation popover remained visible and within the viewport.
- Constrained browser review: Russian at a 375 px iframe and Finnish price at 320 px (360/305 px document widths after scrollbars) without horizontal overflow. Arabic at a 980 px iframe (965 px document width) retained text-left/presentation-right and correctly directed text. These are browser viewport checks, not physical-device tests.
- Independent read-only diff review found the showcase subtree, original mascot, download/install controls and lower feature content preserved. All 72 changed translation values were checked for nonempty USD monthly pricing; independent native-speaker review of every translation has not been performed.

## Publication receipt

Pending the existing OSMINOG own-user website workflow and independent live verification. Record the published source, run and live screenshot here after success.
