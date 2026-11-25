# Mouse website — layout, clearer trap and download metrics

## Owner's direction, 25 November 2026

The annotated screenshots ask for a recognisable pixel mousetrap; “7 days — all features” in Free; the small slogan below the MOUSE wordmark; the sites/chats/AI sentence below the three-features heading; the original mouse/burrow below the city, with the mouse march unobscured; wider lower copy; and discreet real download counts by platform and version, primarily useful to the owner.

This is website work. No native browser build, payments, trial enforcement, installation identifier, update feed or published installer is changed.

## Implemented layout and copy

- The existing translated `introLine1` now sits under the header wordmark; `introLine2` sits under the features heading. There is no duplicate introduction below the hero title.
- The city occupies its own normal-flow row. The original burrow follows it, with an 8px separation; the burrow is smaller and cannot cover the city rows. City animation, pause and reduced-motion behaviour remain.
- The manifesto paragraph, feature columns, About section and footer use their available width with normal page gutters. The two pricing cards retain their balanced width.
- The pixel trap has a wooden base with depth, a tilted steel bail, visible spring/trigger and cheese bait. The screen-like front-facing frame is removed.
- Free shows `7 дней — все функции` / `7 days — all features`. This string, statistics labels and privacy footer are localised for all 72 catalog locales. The future-tier/current-functions-free disclaimer is also present in every locale, so the website does not imply that a seven-day restriction is already enforced by the current browser.
- Existing pricing-title/description translations outside RU/EN are not revised in this task. They still require a separate editorial pass for the Free/Cheese story; this is not a claim of native-speaker review of all translations.

## Discreet version and count display

Each installer button has a 12px pixel version immediately below it. Static HTML and open-page refresh use the actual per-platform verified download catalog, including staggered future releases.

When a valid aggregate is available, a small count beside that version opens the version history. A real zero uses a quiet ellipsis in the public summary and remains an exact zero in its disclosure. Adding `?stats=1` shows that zero directly for the owner's review. This URL flag changes presentation only; aggregate totals are public, not private account data.

Missing, inactive, malformed, unmatched or more-than-ten-minute-old snapshots hide the counter. They never become invented zeros, never reuse a previous version's count, and cannot block an installer download. The site uses only its own origin and the existing CSP; no external analytics or tracking cookie is added.

## What can actually be counted

The current Mouse vhost has `access_log off`. No prior website download history can be reconstructed from it. GitHub release-host download counts are not used as site downloads.

The prepared collector counts qualifying installer request starts separately by platform and version. It excludes HEAD, recognised automated clients, explicit verification probes, failed responses and noninitial byte-range requests. This is not a count of people, active users, successful installations or guaranteed complete transfers; unknown bots and repeated starts can still count.

The aggregate lives outside immutable website releases. Private state and an independent own-user timer retain totals through website publications. The scoped logger/endpoint activation needs a one-time action by the server administrator; the normal `osminog` publisher has no Nginx administration privileges. No credentials or workflows from AvtoCena are used. See [the exact activation procedure and metric definition](2026-11-25-download-metrics.md).

## Verification

Local checks on this candidate:

- Built and verified 73 static pages, 72 sitemap languages, and the current live 6.0.38 catalog independently resolved from `mouse.black/downloads.json`.
- The 16 Node tests pass: existing download refresh/install-help behaviour plus new inactive, zero, version-match, stale/malformed-data, numeric history ordering and disclosure checks.
- Browser inspection in both themes and local 2048px, 390px and 320px frames, including Arabic RTL: the city and burrow do not overlap, the header controls fit, and no page-level horizontal overflow was observed. Narrow-phone headings are allowed two lines for readability.
- All 70 Python tests pass, including collector rotation/deduplication and the existing sync/publication suite. JavaScript syntax, shell syntax, whitespace checks and the 51-file sync bundle validation pass. CI and deployment evidence is recorded below.

## Publication status

**Published and verified on 25 November 2026; download collection remains unavailable pending administrator activation.**

- [PR #206](https://github.com/jeep-jim/OSMINOG/pull/206) was prepared from main `b73ffc69f24c45c467bff28c0aa2b1753d8b8761`; reviewed head `c89b41dc62449523674c3a754e88149c1a4ff12f` has exactly the locally tested tree `c03366e0f6f20e0f4dbf74a436045bc3d081821c`.
- [PR website validation run 45557381303](https://github.com/jeep-jim/OSMINOG/actions/runs/45557381303) passed before merge. Squash/main source: `6fd7d8b2d548ca54a31d67f1758b77fe7617a4aa`, with the same tree.
- [Production run 45557554241](https://github.com/jeep-jim/OSMINOG/actions/runs/45557554241) completed successfully at `2026-11-25T06:03:59Z` (13:03:59 Krasnoyarsk). `validate` job `139013160011` and `website` job `139013293781` both passed.
- Published deployment identity: `a025993f9df34f5ea4b4646a022c2d9960754804`, derived from that renderer source and the actual per-platform 6.0.38 catalog. Publication stayed under the existing `osminog` user.
- The real subsequent release-sync timer tick was observed at `2026-11-25T06:03:06.522387+00:00`. Independent public verification completed at `06:03:54Z`: HTTPS/domain redirects, exact RU/EN/AR pages, 72-language sitemap and all three complete installer SHA256/HEAD/Range checks passed.
- Evidence artifact: `mouse-website-deployment-evidence`, ID `14997100364`, ZIP SHA256 `ad2d1bcdecccd5f154a0ea0bd4dbdfb28768c90ceef1c55026fdf7783d4cd59a` (14-day Actions retention; durable findings are recorded here).
- Direct browser inspection of [the published Russian page](https://mouse.black/ru/) confirmed the relocated slogan and features sentence, separated city/burrow, three `v6.0.38` labels, clearer trap and Free trial line. The three unavailable count disclosures are hidden.

Actual server evidence, not a zero-download claim:

```text
MOUSE_DOWNLOAD_STATS_UNAVAILABLE since=None checkedAt=2026-11-25T06:02:06.043619+00:00
```

The independent metrics timer and collector are installed. No privileged logger activation was attempted, no historical totals were invented, and no other project's credentials were used. The exact remaining administrator action is in [the activation procedure](2026-11-25-download-metrics.md).
