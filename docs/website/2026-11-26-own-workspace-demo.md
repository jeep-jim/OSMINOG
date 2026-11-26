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

Local browser rendering was not verified: the preview directory was built, but a server started in the executor was unreachable from a subsequent executor request. The subsequent publication and live desktop checks are recorded below.

## Publication

**Published.** [Source PR #219](https://github.com/jeep-jim/OSMINOG/pull/219) was validated at head `d336e01f29896a8ee3cd7fea4c211b578966ec9e` and merged as `435369a013cb2f5ff995194015acf1142922c034`. The push-triggered [`mouse-website.yml` run 45787306736, attempt 1](https://github.com/jeep-jim/OSMINOG/actions/runs/45787306736) completed successfully at **15:58:06 Asia/Krasnoyarsk on 26 November 2026** (`2026-11-26T08:58:06Z`). Both `validate` (job `139797229471`) and `website` (job `139797465338`) passed.

The website job records the following publication receipts:

- `MOUSE_SYNC_BUNDLE_VERIFIED`: source `435369a013cb2f5ff995194015acf1142922c034`, 52 files.
- `MOUSE_WEBSITE_PACKAGE_VERIFIED`: 110 files. `MOUSE_WEBSITE_ARCHIVE_VERIFIED` and `MOUSE_RELEASE_SYNC_PUBLISHED` identify deployment `78d5bf42ce3d7f0f496ae50358ba773c5e80d59d`.
- `MOUSE_RELEASE_TIMER_VERIFIED`: the automatic release check ran after publication with the exact source SHA above; `checkedAt=2026-11-26T08:57:25.358144+00:00` (**15:57:25 Asia/Krasnoyarsk**). The job then emitted `MOUSE_WEBSITE_AUTOMATION_LIVE https://mouse.black`.
- The independent public gate passed at **15:58:03 Asia/Krasnoyarsk** (`2026-11-26T08:58:03Z`): HTTPS and the three HTTP/www redirects; Russian, English and Arabic HTML samples; 72 sitemap languages and 73 hreflang entries; and all three direct installer downloads with SHA-256 verification. The generated site contains 73 HTML pages for 72 languages.

The public download catalog remained **6.0.40** for macOS, Linux and Windows. This receipt records the website publication; native 6.0.41 publication remains outside this task.

Deployment evidence is attached to the successful run as [`mouse-website-deployment-evidence`](https://github.com/jeep-jim/OSMINOG/actions/runs/45787306736/artifacts/15101141491), artifact ID `15101141491`, 2,336 bytes, SHA-256 `21b58e3be8e17ee5ac6fc619a7ff819a2826a670fc5a1bf3d4ae2fb65cf0d223`. GitHub records its expiry as `2026-12-10T08:58:03Z`.

## Live desktop verification

The published [Russian workspace demonstration](https://mouse.black/ru/#workspace-demo-heading) was checked in the live browser after deployment:

- The heading is exactly **«Визуальный пример работы столов и сетки окон»**. Its computed `font-family` is `Mouse Display`, the font availability check returned `true`, and its computed size is **32px**.
- Retired comparison selectors returned **zero matches**.
- All **five desktop buttons** were exercised, confirming selected states for desktops **1–5**.
- The **12-pane grid** was selected and **12 panes** were visible. Fullscreen opened and closed successfully.
- The desktop screenshot at **1363 × 936** showed the 12 panes without page overflow.

This live pass covers the interactions listed above. A narrow/mobile viewport was **not checked**. Console observations were limited to the live session and included cloud extension errors; a globally error-free console is not claimed.
