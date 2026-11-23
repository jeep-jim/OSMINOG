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

Published and independently verified on 2026-11-23 at 14:34 Krasnoyarsk time (07:34 UTC).

- Source `2e8717d4d7c1dcc1c0ba21dbe631b9e2a7940250`; tree `a49b596f468009cf5e526e448661e102fb92603f` exactly matched the locally reviewed tree. Main was updated non-force against expected parent `023034e8ded27ba23418af2f9f630fe22635281c` and read back.
- Own-user [website run 45131836807](https://github.com/jeep-jim/OSMINOG/actions/runs/45131836807) completed successfully: validation job `137548869918` and publication job `137548984896` both passed.
- Deployment identity `ca76397ec1ed4ee788ee5080eb46ec3a13ab14b5`. The installed release timer completed a new check for this source at `2026-11-23T07:34:02.501479+00:00`; the workflow confirmed `MOUSE_WEBSITE_AUTOMATION_LIVE https://mouse.black`.
- Independent external verification completed at `2026-11-23T07:34:45Z`: HTTPS and canonical redirects, exact Russian/English/Arabic HTML, 72 sitemap languages, 73 language-graph entries and all three complete installer SHA256 values passed. Receipt: `MOUSE_PAGES_LIVE_VERIFIED sitemap_languages=72 sampled_languages=3 downloads_sha256=3`.
- Public macOS, Windows and Linux downloads remain 6.0.37 and are served from mouse.black. This change did not publish a browser release.
- Artifact `14797609657`, `mouse-website-deployment-evidence`, 2298 bytes; ZIP SHA256 `8e423a716dc0e7f29c92d00f20eb02f48a35d6a184362469b90e9c5338a51ab1`.
- Live browser review of [the Russian landing](https://mouse.black/ru/) confirmed both 645 × 782 px windows at 1348 px content width, no horizontal overflow, the ordinary-text monthly price and three same-domain download links. [Live screenshot](evidence/2026-11-23-split-hero-live.jpg), SHA256 `fa90105512c522688a2b9c992f7bc9b82554cda689d57c3039323c9cc220c087`.

The local preview was stopped after verification. Subscription checkout and entitlements remain unimplemented and are labelled coming soon.
