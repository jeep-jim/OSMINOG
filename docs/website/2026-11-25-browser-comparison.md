# Browser comparison and five Mouse desktops — 25 November 2026

> Superseded by the owner's decision of 26.11.2026: remove every competitor from the public website and retain the Mouse workspace/grid example. This document records the previous publication; it is not the current presentation requirement. See [the replacement task](2026-11-26-own-workspace-demo.md).

## Scope and requested result

Anton requested a comparison between the manifesto window and the existing interactive website-capture demo: original full-color browser logos, Mouse centered, clicking a logo changes the demonstrated browsing model. His follow-ups requested short captions such as “2 окна. Скучно” and “12 окон. Свобода”, and an explicit working switcher for Mouse desktops.

This change is confined to `website/`, its static renderer/verifier/tests, and task documentation. The native browser, published installers, billing, release channels, server administration and download-statistics activation are outside this change. Website publication uses the established OSMINOG own-user workflow; no AvtoCena resources or root access.

## Evidence and comparison boundaries

The examples are **interactive models of documented desktop modes**, using the existing local captures of real websites. They are not embedded installations of the named browsers, pixel-perfect replicas, or live third-party pages. A persistent localized label and an expandable evidence panel make that boundary visible. The evidence panel carries the check date, 25.11.2026, and exact official documentation links.

The caption count means pages visible at the same time in the displayed kind of layout. It does not limit ordinary open tabs. “Скучно”, “Свобода” and similar short lines are the owner's requested editorial captions, not measured product scores.

| Browser | Modes offered in the model | Evidence / boundary |
| --- | --- | --- |
| Chrome | One active page; two pages side by side or stacked | [Google's current Split View help](https://support.google.com/chrome/answer/16971124) explicitly describes two sites and both orientations. |
| Safari | One active page; two separate windows using macOS | [Safari tabs](https://support.apple.com/guide/safari/use-tabs-for-webpages-sfri11576/mac), [macOS Split View](https://support.apple.com/guide/mac-help/mchl4fbe2921/mac). The latter is labeled as an OS window arrangement. No assertion that all current desktop Safari internal split capabilities were exhaustively disproved. |
| Firefox | One active page; two pages side by side | [Mozilla Split View help](https://support.mozilla.org/en-US/kb/split-view-firefox), available from Firefox 149. Vertical stacking was not confirmed in that documentation and is not offered. |
| Edge | One active page; two pages side by side or stacked; sample workspace switching | [Split Screen](https://www.microsoft.com/en-us/edge/features/split-screen), [Workspaces](https://support.microsoft.com/en-us/edge/getting-started-with-microsoft-edge-workspaces). Current Workspaces require Edge 144+, a supported desktop OS and MSA/AAD sign-in. Same-window workspace opening is a rollout for some users; the model is not a promise of identical availability on every installation. |
| Brave | One active page; two pages side by side or stacked | [Split View help](https://support.brave.app/hc/en-us/articles/35087087593997-How-do-I-use-Split-view-in-Brave), [stable release notes](https://brave.com/latest/) for 1.100.58 on 18.11.2026 explicitly mention stacked mode. Unmerged Workspaces Phase 2 is not presented as a stable feature. |
| Mouse | One active page; layouts up to 12 visible panes; five independent demo desktops | Native code on base `72a9587bebf6b69fbd1892d755100556886c5728`: `desktop/mouse/layout.js` has `LIMIT=12`; `desktop/mouse-desktops.cjs` has `MAX_DESKS=5`. Ordinary tabs and visible panes remain separate. Public source panel points to the site's own feature section; no upstream installer/repository URL is introduced into published assets. |
| Opera | One active page; 2–4 pages side by side, stacked, or in a grid; sample Workspaces | [Split Screen](https://www.opera.com/features/splitscreen), [Opera 128 Stable](https://blogs.opera.com/desktop/2026/02/opera-128-stable/), [Workspaces](https://www.opera.com/features/workspaces). This is ordinary Opera, not an inference about Opera GX's Early Bird availability. |
| Yandex | One active page; website with a pinned web app on the left | [Official web-app help](https://yandex.ru/support/browser/ru/personalization/web-app) documents the pinned arrangement and PWA eligibility. The example fixes YouTube on the left; ordinary tab selection affects the main page on the right. YouTube's [actual current manifest](https://www.youtube.com/manifest.webmanifest) was fetched on 25.11.2026: name `YouTube`, display `minimal-ui`, start URL `/?feature=ytca`, eight icons. This is not a universal split of arbitrary pairs of tabs and does not pretend to run Alice. |
| Vivaldi | One active page; 2–12 tiles as examples; resize/reorder; sample Workspaces | [Tab Tiling](https://help.vivaldi.com/desktop/tabs/tab-tiling/) explicitly says there is no fixed tile-count limit, and documents vertical, horizontal, grid, custom layouts, resizing and reordering. [Workspaces](https://vivaldi.com/features/workspaces/). The caption says no limit and the note explicitly identifies 12 as the demonstration's sample size, not Vivaldi's ceiling. |
| Arc | One active page; a two-page Split View example in both orientations; sample Spaces | [Official multitasking guide](https://start.arc.net/master-multitasking), [macOS release notes](https://start.arc.net/release-notes), [Windows release notes](https://resources.arc.net/hc/en-us/articles/22513842649623-Arc-for-Windows-2023-2026-Release-Notes). Two is not claimed as its maximum. The visible note and [status source](https://resources.arc.net/hc/en-us/articles/44412972248471-Arc-Sunset-Key-Dates-and-What-to-Expect) state desktop shutdown on 22.12.2026 and closed new-account registration. |
| Zen | One active page; up to four pages in horizontal, vertical or grid layouts; sample Workspaces | [Split View](https://docs.zen-browser.app/user-manual/split-view), [Workspaces](https://docs.zen-browser.app/user-manual/workspaces). The dedicated Split View documentation explicitly allows four and drag placement. |

No claim is made that Mouse uniquely has split screen, a flexible grid or workspaces. Other documented capabilities remain visible. Generic scene examples are labeled as examples rather than fabricated native groups. Desktop Arc/Zen show their tab rail at the left on wide layouts; the narrow presentation is simplified.

## Assets and implementation

- Original vendor marks: Chrome, Safari, Firefox, Edge, Brave, Opera, Yandex, Vivaldi, Arc and Zen. Original colors and intrinsic shapes are retained; no new circles, plates or outlines around the logos. Mouse uses the existing pixel vector in purple.
- Exact URLs, byte counts, SHA256, preservation details and validation for all ten third-party marks are recorded in [browser-logo-sources.json](browser-logo-sources.json). Six source SVGs are byte-identical; four unmodified vendor PNGs are embedded in self-contained SVG wrappers. Total logo payload: 66,543 bytes.
- `browser-comparison.js` holds the bounded capability profiles and selection UI. All artwork is local and works under the existing same-origin CSP; vendor source links load only after a user follows them.
- `comparison-i18n.json` adds 42 fields to all 72 existing locales. The build checks the exact locale/key sets and placeholders. The title's accent supports natural placement of the localized Mouse name, including RTL, and is rendered before JavaScript.
- Five Mouse desktops use Content, Trading, Development, Design and Support examples. Each stores its own tabs, layout, active pane, sizes and positions for the lifetime of the page. A sixth former sample scene is not exposed as a sixth Mouse desktop. Manual switching pauses playback.
- Browser and desktop switches save separate state. Reducing a layout to one pane preserves the remaining open tabs, and expanding it restores the appropriate slots. Added tabs do not increase the allowed visible-pane count. Yandex's web-app mode keeps the pinned app separate.
- Unsupported controls are disabled in handlers as well as hidden in menus. Ordinary competitor pages use one address row; native-style Mouse move/expand controls are not shown indiscriminately. Source/current-mode text follows browser and layout changes.
- The existing single-column page widths, manifesto layout, feature section, pricing, theme behavior and independently refreshed installer catalog are preserved.
- The verifier allows only the exact official comparison links, inside the evidence panel and with safe external-link attributes. The existing upstream-URL prohibition and download/asset same-origin checks remain in place.

## Local acceptance

- Python infrastructure suite: **71 tests PASS**. Node suites: **25 tests PASS**, including nine tab/profile/desktop state cases. JavaScript syntax checks and `git diff --check`: PASS.
- Strict 72-locale build: **73 HTML pages, 120 files**. SEO verifier: **73 pages / 72 languages / 72 sitemap URLs**, installer version 6.0.38. All 3,024 comparison strings are supplied explicitly; no provisional English fallback catalog is used.
- Browser interaction: all eleven logo choices switch the model and expose only supported layouts. Checked Chrome's one-page/new-tab behavior, Safari's two separate macOS windows, Yandex's fixed left web app, Arc's sidebar and fullscreen, and Mouse's five desktops.
- State restoration: on Mouse desktop 1, selected 12 panes, added a thirteenth tab, resized the first column from 25% to 27%, switched to desktop 2 and back. The 13 tabs, 12 visible panes, active added tab and 27% geometry returned. Switching to Chrome and back also preserved that state. Ordinary one-pane mode retains the other tabs.
- Visual checks: light and dark themes, 1,348 px viewport and a 2,048 px wide frame, 390/320 px narrow frames. No page horizontal overflow in the narrow frames; manifesto/browser width remains 1,280 px and features 1,200 px on the wide layout. The narrow 320 px frame has 305 px document client width and five desktop buttons of about 49.8 px each.
- Completed Arabic RTL rendering and desktop 3 selection: translated title, captions and accessible desktop names; no horizontal overflow. Keyboard logo navigation also checked. Persistent “interactive model / real site captures” disclosure is present on narrow and fullscreen views.
- Original logo XML, MIME/dimensions, hashes, self-contained references and rendered colors checked. Existing screenshots are used for the interactive model; this acceptance does not claim native installations of all compared browsers were tested.

## Publication

**PUBLIC PASS on 25.11.2026.** [PR #213](https://github.com/jeep-jim/OSMINOG/pull/213) merged as `fb262be650e487c7a81e7c3bc73c95b97985b928`. The uploaded PR head `0dd195a2904850c8652888ee12ee763677cc0398` and locally tested source `74c0d4900f8f81aaea486f18052fe3512e98e07c` have the identical tree `affe90c300170e5e18c6c38eef2d693e454c7063`.

- [PR website CI 45578272231](https://github.com/jeep-jim/OSMINOG/actions/runs/45578272231): PASS, 71 Python and 25 Node tests, strict build/SEO and source bundle. CI's checked-in catalog fixture is 6.0.36; publication independently resolved the current 6.0.38 packages below.
- [Production run 45578500314](https://github.com/jeep-jim/OSMINOG/actions/runs/45578500314): **success**, completed at 08:44:20 UTC / 15:44:20 Asia/Krasnoyarsk. Both `validate` and `website` passed. Deployment identity: `6f44f2b9a0689a7876a44b9f3d0d36448a6fa91b`.
- Own-user publication verified a real subsequent timer check at `2026-11-25T08:43:25.510619+00:00`. HTTPS and canonical redirects passed; 72-language sitemap/hreflang passed; exact live Russian, English and Arabic HTML samples passed.
- All three full installer SHA256, HEAD and Range checks passed. Current packages remain 6.0.38: macOS `a6b88d66f4e240fad5f9be6fe166d08a22231d84e81fcd81ac545fae797c78bb`, Windows `7647487decd235b493dfe0c03107ca3adc44360a20bc1d31aae8ca2a07379eb7`, Linux `ad8192a991b6485e447e6e33acd899567df885095bf3f7581c0a6d1457bbad90`.
- Direct UI inspection of [the published comparison](https://mouse.black/ru/#browser-comparison): all eleven choices and ten logo images present; five desktop buttons; Content has four panes/tabs, Trading two, and returning restores Content. Selecting Chrome shows two panes and hides Mouse's desktop strip; returning to Mouse restores desktop 1. Persistent model disclosure is visible; no page horizontal overflow.
- Download statistics remain **UNAVAILABLE** as before; this task does not activate the separate server component. No invented counters are shown.

Key production evidence:

```text
MOUSE_RELEASE_SYNC_PUBLISHED deployment=6f44f2b9a0689a7876a44b9f3d0d36448a6fa91b
MOUSE_RELEASE_TIMER_VERIFIED source=fb262be650e487c7a81e7c3bc73c95b97985b928 checkedAt=2026-11-25T08:43:25.510619+00:00
MOUSE_WEBSITE_AUTOMATION_LIVE https://mouse.black
MOUSE_SEO_VERIFIED pages=73 languages=72 sitemap_urls=72 version=6.0.38
MOUSE_PAGES_LIVE_VERIFIED sitemap_languages=72 sampled_languages=3 downloads_sha256=3
```
