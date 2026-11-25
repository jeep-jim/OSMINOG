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
- All 70 Python tests pass, including collector rotation/deduplication and the existing sync/publication suite. JavaScript syntax, shell syntax, whitespace checks and the 51-file sync bundle validation pass. Final CI and deployment evidence will be appended below.

## Publication status

Candidate prepared from main `b73ffc69f24c45c467bff28c0aa2b1753d8b8761` on `feature/mouse-site-layout-downloads-20261125`. Publication is not claimed by this candidate note. The initial server statistics status must be recorded from deployment evidence; without administrator logger activation it is **unavailable**, not zero.
