# Mouse website — pixel features and browser controls

## Owner request

On 25 November 2026 the owner supplied annotated screenshots of the already-published stacked layout. The requested changes are:

- Add the existing pixel mouse before the MOUSE wordmark.
- Place the mobile-platform notice, preview version and installation help on one desktop line. Let the manifesto summary use the available width inside its window.
- Make the upper manifesto label open the same manifesto as the lower link.
- Move “Try it yourself” and the real-site-captures note into the browser demonstration's control bar. Add a working new-tab button in its upper tab strip.
- Replace “Three things” with “Essential features”, preserving “for every day”, in every supported language. Remove the subtitle below this heading.
- Replace the connecting curves with mouse footprints. Give the three feature icons a pixel style and an action-specific hover/focus animation.
- Replace the green text accent with the purple used by Mouse's glasses.

These changes retain the preceding correction: manifesto, browser, then the remaining sections; the mouse remains in the city. The existing bounded feature/footer widths remain. [Previous layout and ordinary-tab clarification](2026-11-25-stacked-layout.md).

## Implementation and evidence

- The header reuses the actual favicon mouse path, with `currentColor` for the light/dark themes. It is decorative inside the existing labelled home link.
- Release metadata uses a wrapping flex row. The manifesto summary no longer has the 52-character width limit. Short phone widths can still wrap; no fixed desktop no-wrap rule is imposed on the page.
- The upper manifesto label is a keyboard-operable button using the existing `data-manifest-open` action and dialog focus restoration.
- The purple is `#a855f7`, taken from the current native `desktop/mouse/mouse-635-controls.css` toolbar glasses and the `owner-pixel-glasses` group in `mouse-private.svg` / `mouse-private-light.svg`. The website's manifesto text, link hover states, installation numbers and tinted surfaces share this accent. Native files are read-only evidence.
- `featuresTitle` is updated in all 72 locale records; the remaining fields are preserved. The deleted subtitle no longer has a rendered element.
- Two new showcase strings, `showcaseNewTab` and `showcaseChooseSite`, are supplied in all 72 locales and required by the renderer. Other showcase translations are preserved.
- The browser's invitation and capture disclosure now belong to its existing toolbar. On desktop they sit after the workspace selector and before playback controls respectively; narrow viewports wrap them within that toolbar.
- The new-tab button follows the last tab, with a scrollable tab strip that keeps the button visible. Desktop tabs retain 180px widths; small screens use the existing compact widths.
- New tabs have a localized start view offering the site's existing real captures. Selecting one replaces the active visible grid slot, while tabs are stored separately from those slots. User-created tabs persist across scene/layout changes within the current page. Manual interaction pauses playback. Failed captures, including hidden user tabs, return to the chooser through the existing recovery path.
- Feature SVGs use square pixel elements and a small cheese-colored accent. Footprint pairs replace the connecting curves and follow the stacked cards on mobile, including RTL direction. Hover or keyboard focus starts a single 1.5–1.6-second arrangement, desk-switch or local-save animation. Idle is static; the animations are guarded by `prefers-reduced-motion: no-preference`.

## Local verification

The local header checks confirmed both themes, the top manifesto action and the two requested desktop lines. At a 1348px content viewport the manifesto summary is one 21px line, and the two release metadata groups share the same top coordinate.

Responsive checks used 2048px, 390px and 320px frames, plus Arabic at 390px. No page-level horizontal overflow was observed. Desktop hero/features/footer widths remain 1280/1200/1120px. Both themes and all three feature hover/focus animations were inspected in the browser; keyboard Tab reaches the feature cards and shows the focus outline. Reduced-motion behavior was checked in the guarded CSS, without claiming a browser preference-emulation run.

Browser actions verified new-tab creation, capture selection, switching back to an existing tab, scene/layout changes, Home/End navigation and fullscreen open/close. On the 320px frame, 15 tabs kept four visible grid windows; only the 225px tab strip scrolled over its 1662px content. The plus remained inside the viewport (right edge 283px in the 305px content area), and Google Maps could be selected from the chooser. Arabic new-tab labels and the mobile footprints were inspected.

The renderer and SEO verifier passed for 73 HTML pages / 72 sitemap languages using the last independently verified 6.0.38 installer catalog. Existing Python tests: 70 passed. Node checks: 21 passed, including five new tab-state behavior tests. The new checks cover separate tabs versus grid slots, capture selection, persistence beyond twelve tabs, missing-capture recovery and rejection of unknown tab identities. The tab tests are added to the existing website PR gate. JavaScript syntax and whitespace checks passed. The unchanged production workflow will independently resolve and verify the current installer catalog during publication.

## Publication

- [PR #211](https://github.com/jeep-jim/OSMINOG/pull/211), prepared from main `a426f4a94a8207cf4ed45a3d6ea045aa7c802b62`; reviewed head `9d40f6091208bf4bf038dd8a782cc6a6e053197e`. Local and remote trees match: `bda52a11631a9067806f4ca4cddf57f58079aab9`.
- [Website PR gate 45568410145](https://github.com/jeep-jim/OSMINOG/actions/runs/45568410145) completed successfully for that exact head at `2026-11-25T07:28:56Z` (14:28:56 Krasnoyarsk). Validate job `139048788683` passed; the deployment job was skipped as expected for a PR.
- Published source: `7eda7e8b473662ef4c2baeab69649ec4e245a7e0`. [Production run 45568571334](https://github.com/jeep-jim/OSMINOG/actions/runs/45568571334) completed successfully at `2026-11-25T07:32:10Z` (14:32:10 Krasnoyarsk). Validation job `139049337037` and website job `139049472892` both passed.
- Deployment identity: `da1aa6b952071e204c85ac8b5c649cd2addff0cf`. A real subsequent release-timer check was observed at `07:31:26.606571Z`. Independent public HTTPS, RU/EN/AR HTML, 72-locale sitemap / 73 hreflang and all three complete installer SHA256 / HEAD / Range checks passed at `07:32:07Z`; all installers remain 6.0.38.
- Direct browser inspection of [the public page](https://mouse.black/ru/) and [feature section](https://mouse.black/ru/#features) confirmed the mouse wordmark, purple text, aligned release row, new feature title, removed subtitle, tracks and pixel illustrations. The top manifesto button opened the public dialog. The public + increased three tabs to four while keeping three visible windows; selecting Google Maps worked. Both captions were in the browser toolbar.
- Metrics still report `MOUSE_DOWNLOAD_STATS_UNAVAILABLE since=None checkedAt=2026-11-25T07:30:25.934098+00:00`. This task did not activate the logger. Durable publication evidence is in the task document; the workflow artifact is also available as `15000404544` with the workflow's retention period.

This website task does not change native releases, installers, billing or the inactive download logger. [The existing administrator activation boundary](2026-11-25-download-metrics.md) remains.
