# Mouse manifesto and interactive browser demo

24 November 2026. Website-only work requested by Anton: a playful pixel-mouse
demonstration, an independent-distribution manifesto, installation help alongside
downloads, and a right-hand browser demo that visitors can operate themselves.

## Delivered source

- The left hero retains the original mascot and burrow, with a locally drawn
  pixel city, marching mice, varied clothing and placards behind it. A small
  pause control is available. Canvas work stops offscreen/when hidden and respects
  reduced motion; its frame rate is capped at 20 fps. No remote art or telemetry.
- A compact manifesto summary stays within the first hero. The full text and
  three-step Mac/Windows instructions use native dialogs with keyboard closing,
  focus restoration and separate platform tabs.
- A normal Mac/Windows download opens the matching help immediately, then uses
  the existing catalog refresh and same-origin download path. The displayed
  filename follows the refreshed platform link. The guide's retry button uses
  that same path. Help failures cannot block downloading. Linux remains a direct
  download. No additional installer link, private upstream URL or tracking.
- The right demo has current tabs, a compact bottom bar, grid choices for 1,
  2 side-by-side, 2 stacked, 3, 4, 6, 8, 9 and 12 windows, and inline drag/resize/
  maximize/restore. Full-screen opening and closing preserve manual geometry.
  Manual interaction pauses the automatic scenes until the visitor presses Play.
- The existing real website captures remain local assets. They are explicitly
  labelled as captures, not interactive third-party sessions. The 12-window
  option repeats one capture with an explicit second-tab suffix when needed.
- All 29 manifesto/help fields and five new demo labels cover the existing 72
  locales. RU/EN wording is reviewed; all locales have exact-key/nonempty checks,
  and the safety conditions and platform names were checked across the catalog.
  Native-speaker review of every translation has not been performed.
- The three feature descriptions, $3/month section, release automation, browser
  publishers and other project infrastructure are unchanged.

## Factual installation wording

The manifesto describes the owner's stated choice of independent distribution.
It does not assert that Apple or Microsoft target Mouse for being private or for
competing with their browsers. Absence of signing is not presented as evidence
of safety or privacy, and Windows signing is not called a Windows licence.

The current native release remains an ad-hoc macOS preview without Developer ID
or Apple notarization and an unsigned Windows preview; see the current release
summary and `desktop/mouse-build.cjs`. This website change does not alter those
packages.

Primary references checked on 24 November 2026:

- [Apple: safely open apps on your Mac](https://support.apple.com/en-au/102445).
  The guide limits Open Anyway to a trusted downloaded app and does not treat
  malware/damaged-file alerts as ordinary unidentified-publisher warnings.
- [Apple: Developer ID](https://developer.apple.com/developer-id/).
  Notarization/signing are separate technical distribution safeguards, not a
  privacy assessment or evidence of an anti-competitive motive.
- [Microsoft: SmartScreen reputation](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation).
  More info / Run anyway applies only when that option is available and the
  user trusts the file. File and publisher reputation can affect warnings.
- [Microsoft: Smart App Control FAQ](https://support.microsoft.com/en-us/windows/security/threat-malware-protection/smart-app-control-frequently-asked-questions).
  A policy/Smart App Control block is not bypassed by these instructions. No
  global security-disable command or instruction is provided.

The HTML links to the two OS vendors are user-activated help links only. The
static verifier allows exactly those two URLs inside `#install-guide`, with the
help class, `target=_blank`, `noopener noreferrer` and no download/platform
attributes. External installers, assets, lookalike hosts and links outside that
context still fail the gate; a regression test verifies this boundary.

## Verification before publication

- Python website suite: **52 passed**. Node download suite: **7 passed**. The new
  integration tests execute the real help and download scripts with a small DOM
  model, including fresh-version delivery, help failure, modified clicks and
  timeout/retry. They do not replace OS installation tests.
- Generated site: **73 HTML pages / 72 locales**, all SSR translations, canonicals,
  hreflang, sitemap, structured downloads and same-origin assets verified.
- Browser preview: desktop dark/light; native manifesto → Mac → Windows dialogs;
  closing restores body/root scrolling. Inline 12-window and 2-stacked choices;
  keyboard resize 50→52%, keyboard swap, pointer drag swap, pointer resize to
  43%, pane maximize/restore, and full-screen round trip preserving geometry.
- Responsive browser fixtures: Russian/Chinese content width 360px and Arabic
  RTL content width 375px have no horizontal document overflow. Mac instructions
  remain scrollable inside the viewport; Arabic grid picker and 12-window
  full-screen view were exercised. Fixtures are excluded from publication.
- No page-origin JS warning/error was observed in the exercised desktop path.
  Browser-extension metadata warnings are unrelated to the website.

Local previews use the existing 6.0.36 test manifest. Production resolves the
actual current per-platform catalog through the established own-user workflow;
the preview number is not a statement about the released browser version.

## Publication receipt

Pending the existing `Mouse website — publish site and verified installers`
workflow and its independent public verification. The publication receipt will
record the source, run, current catalog and observed live result here.
