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

Prepared from main `db7c65b4c735575e943139fcef0e93e63ff0b61b` on `fix/mouse-stacked-layout-20261125`. Production publication evidence will be recorded after the existing own-user website workflow completes.
