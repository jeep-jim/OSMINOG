# Mouse website — restore the grid and stack the two windows

## Owner correction

On 25 November 2026 the owner rejected the stretched features/footer and the separate mouse below the city from PR #206. The new direction is: return the mouse to its former position, restore the lower content widths, and show the manifesto window first, the browser window underneath, then the remaining sections. This supersedes the layout/width decisions in [the earlier task](2026-11-25-layout-trial-downloads.md).

## Implemented

- The two existing windows now use the already-established single-column layout at every screen width, separated by 14px. Their shared container is centered and capped at the existing 1280px hero width.
- The preview retains its explicit height because its contents are absolutely positioned: `clamp(390px, 65svh, 600px)`, with the existing 430px phone height. The fullscreen dialog still uses its own layout.
- The original mouse/burrow is back inside the city scene, aligned to its bottom in the foreground: 185px wide normally and 156px on phones; the city is 230px / 200px high. The original 28px / 22px gap below the scene is restored.
- Features return to `min(1200px, 100%)`, with the existing three-column desktop grid and `34ch` paragraph limit. Footer/About return to `min(1120px, calc(100% - 96px))`. Existing mobile rules remain. The manifesto paragraph again uses the original `52ch` limit.
- The intermediate-screen rule that hid the manifesto caption for the old two-column layout is removed.
- The new slogan positions, trap illustration, seven-day Free copy and actual per-platform version labels remain. No JavaScript, native/browser release, installer, counter or server configuration changes are part of this correction. [Metrics activation remains a separate unresolved administrator step](2026-11-25-download-metrics.md).

## Verification

- The renderer built 73 pages; SEO validation passed for all 72 sitemap locales against the freshly read public 6.0.38 catalog.
- Browser inspection in light/dark themes, a 2048px desktop frame and 390px/320px phone frames, plus Arabic RTL. No page-level horizontal overflow was observed.
- Measured desktop widths: manifesto/browser 1280px, features 1200px, footer/About 1120px. The browser follows the manifesto by 14px and features follow the browser. The mouse is again contained within the city scene, with their bottom edges aligned.
- The browser demonstration's fullscreen open and close both worked after stacking. Whitespace checks passed. No new tests duplicating CSS declarations were added; existing CI remains the publication gate.

## Publication status

**Published and verified on 25 November 2026.**

- [PR #208](https://github.com/jeep-jim/OSMINOG/pull/208), prepared from main `db7c65b4c735575e943139fcef0e93e63ff0b61b`; reviewed head `cb474a557e0a741aef53858afeeffb2f58aff7e8`, exact tested tree `63670218eebf82396b4fd4d2ce7cf6ac8d5c0e9d`.
- [PR website validation run 45559689332](https://github.com/jeep-jim/OSMINOG/actions/runs/45559689332) passed before merge. Published squash/main source: `5ffbf6e9db77c1713297802ad3828bf2722d4925`.
- [Production run 45559832527](https://github.com/jeep-jim/OSMINOG/actions/runs/45559832527) completed successfully at `2026-11-25T06:22:52Z` (13:22:52 Krasnoyarsk). Validation job `139020615136` and website job `139020726189` both passed.
- Deployment identity: `df7d503311e0ca82f26f643f11c5a65c0f8f3851`. Own-user release timer observed at `06:21:52.631233Z`; independent public HTTPS, RU/EN/AR HTML, 72-language sitemap and all three full installer SHA256/HEAD/Range checks passed at `06:22:48Z`. All current installers remain 6.0.38.
- Direct browser inspection of [the public Russian page](https://mouse.black/ru/) confirmed the vertical windows, original mouse/city composition and 1280/1200/1120px bounded widths.
- Counter status remains `MOUSE_DOWNLOAD_STATS_UNAVAILABLE since=None checkedAt=2026-11-25T06:20:52.212020+00:00`; this layout correction did not activate logging.

## Owner follow-up: ordinary tabs versus visible grid windows

While PR #208 was publishing, the owner asked where to explain that the familiar browser mode has tabs across the top and one active page, without a tab quota. The clarification belongs next to the pricing limits: one common sentence above both plans, with explicit labels on the 4/12 and 2/5 values.

The native implementation at `5ffbf6e9db77c1713297802ad3828bf2722d4925` was read before making the claim:

- `desktop/browser.cjs` creates, saves and restores the complete set of web tabs without a count gate; `desktop/mouse-start.cjs` likewise creates start tabs without one.
- `desktop/mouse/browser.js` renders all main tabs and reuses the active viewing area when selecting a hidden tab. Choosing one viewing area does not close the other tabs.
- `desktop/mouse/layout.js` limits the layout to 12 visible areas; `desktop/mouse-desktops.cjs` supplies five desktops. These are distinct from the number of open tabs.
- Metadata limits on saved ordering/membership are not an opening quota. The website's tab statement describes the absence of a fixed tab-count limit, not a guarantee of infinite resource capacity or performance.

The added shared line is “Обычный режим — вкладки без ограничений в обоих тарифах.” The plan labels are “Окон одновременно в сетке” and “Рабочих столов”. RU/EN plan descriptions also qualify the four windows as side-by-side. The future-plan/current-features-free disclaimer remains; no native limits or billing are implemented by this wording change.

The three new strings are required in every locale by the static renderer. The pricing title/description were also aligned with Free/Cheese in the remaining 70 locales after Arabic QA exposed the old single-plan copy beside the new “both plans” sentence. This resolves the earlier task's recorded pricing-translation gap; it is not a claim of native-speaker review.

Follow-up validation: 73 pages / 72 sitemap locales build and verify against the current 6.0.38 catalog. Desktop and 390px/320px phone browser checks, including RTL, confirmed that the shared line and explicit plan labels fit without horizontal overflow. Publication evidence follows after the website gate.
