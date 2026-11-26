# Mouse website — own workspace example, 26 November 2026

## Owner's revised instruction

The owner withdrew the browser comparison and requested that the live website remove all competing browsers and their promotion. The replacement Russian heading is exactly:

> Визуальный пример работы столов и сетки окон

It uses the site's existing `Mouse Display`/`MouseGrid.ttf` pixel typeface. The heading sits immediately before the retained interactive Mouse demonstration. The previous eleven-choice row, selected-browser explanation and comparison source panel no longer occupy the page.

This task supersedes the public presentation in [the 25 November comparison task](2026-11-25-browser-comparison.md); that document remains historical evidence of the previous publication.

## Changes and boundaries

- Removed all ten competitor marks from `website/browser-logos/`, the comparison JavaScript and stylesheet, the logo selector, competitor captions, product-mode notes and vendor documentation links.
- Replaced the 42-field comparison catalog with a nine-field workspace-demo catalog for all 72 languages. The replacement heading is rendered into every localized HTML page before JavaScript. Existing localized desktop names, accessible labels and the real-capture disclosure remain available.
- Kept the existing Mouse demonstration, including five independently remembered desktops, open tabs, new-tab capture selection, layouts up to 12 visible panes, resizing, rearrangement, playback and fullscreen. The compatible controller now has only the Mouse profile; there is no other browser to select. Removed the retired vendor-specific layouts and sidebar styles.
- Removed the verifier's exception for competitor documentation links. The generator/verifier retain the existing download, same-origin and installation-help requirements and now reject reintroduced comparison controls.

The changes are in a separate worktree based on fresh `main` `85fa6dc6128c24016a97bc96c68022d159914da4`. Native 6.0.41 sources, source acceptance gates, published browser artifacts, release pins, download manifests, deployment scripts, credentials and server configuration are outside this task.

## Local verification

- Python website suite: **72 tests passed**. This includes every locale's static heading, missing competitor assets/controls/catalog fields, and rejection of an injected retired vendor link and selector.
- Node website suites: **25 tests passed**. The desktop-state regression covers all five Mouse desktops, retained tabs beyond 12, saved geometry and active state. A focused rerun of the nine showcase-state cases passed after the final cleanup.
- Strict build: **72 languages, 73 HTML pages, 108 public files**. SEO verifier passed for all pages and all 72 sitemap entries. The unchanged checked-in download fixture is version 6.0.36; publication resolves the current independently verified platform releases.
- JavaScript syntax and `git diff --check` passed. The public source audit found no competitor names, comparison selector/source panel, vendor-logo references or foreign profile registry.

Local browser rendering has not been claimed: the preview directory was built, but a server started in the executor was unreachable from a subsequent executor request. Desktop/mobile visual checks and the live result must be recorded separately after access is available.

## Publication

Pending. These changes are prepared locally; no publication or modification of the live site is claimed by this record. Use the established `mouse-website.yml` validation/publication workflow, then verify the exact localized public heading, absence of competitor controls/assets and retained Mouse interactions on desktop and narrow layouts.
