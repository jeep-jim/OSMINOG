# Mouse landing — smaller mascot and connected feature burrows

## Owner decision

The owner requested a focused revision of the existing mouse.black landing:

- Use `MOUSE` in the header, without `.BLACK`.
- Reduce the foreground burrow and mouse together to 85% of their previous size.
- In the light theme, make the mouse black and blend the top of the burrow into
  the page background. Preserve the shared floor colour and exact baseline.
- Remove the persistent outlines around the language and theme triggers.
- Remove the `MOUSE BROWSER` eyebrow and change the headline to
  “Your browser — your rules” in every landing locale.
- Add four small feature burrows connected by mouse tunnels below the download
  area, with readable descriptions and code-native monochrome illustrations.
- Keep the bottom language directory expanded and remove its language count.

This revision concerns only the landing and its existing own-user publication
path. The real-site showcase, independent installer synchronizer and existing
SEO structure remain part of the landing. Native browser features, release
feeds, DNS, tariffs and AvtoCena are outside this change.

## Feature claims checked against the released product

The released 6.0.37 source recorded in the desktop release journal is
`0021084ccb9537e657d21e6f0c8e812dee6b461f`, merged as
`e6e27b26ae719f50beeb5a2244dc6d2c6ddcdab1`. The audit compared the relevant
GitHub blobs at that exact source with the fresh main used here; the ten
inspected files were identical. The published copy is deliberately limited
to capabilities evidenced by those implementations.

| Burrow | Published description | Implementation evidence and boundary |
| --- | --- | --- |
| Keep useful things close | Optional collection of copied text and images from a selected screenshot folder, stored locally while Mouse is open | `desktop/mouse-local-captures.cjs`, `desktop/mouse-capture-archive.cjs`. Opt-in and paused in incognito or when the device is locked. This is not visited-page cache extraction or scheduled deletion. |
| See the whole task | Up to 12 panes on one desktop, with a separate AI-chat sidebar; arrange and resize panes | `desktop/mouse/layout.js`, `desktop/mouse/browser.js`, `desktop/mouse/settings-panel.js`. The AI sidebar hosts ordinary chat websites, not the removed built-in agent. |
| Your tools, close at hand | Load compatible extensions from a folder and pin them to the toolbar | `desktop/mouse-extensions.cjs`, `desktop/mouse/extensions.js`. Supported unpacked Manifest V3 subset; no claim of universal extension compatibility or Chrome Web Store installation. |
| Bring your essentials | Import bookmarks and saved passwords from another browser’s exported files | `desktop/mouse-browser-import.cjs`, `desktop/mouse/settings-panel.js`. No claim of history or open-tab migration. |

Automatic scheduled deletion, universal extension support and history/tab
import were in the owner's proposed list but are not confirmed in released
6.0.37. No native feature was silently implemented as part of this website
revision. The owner was informed of the narrower published descriptions.

## Implementation and verification

The new `features-i18n.json` contains all 72 catalog locales and exactly nine
strings per locale (648 values). The builder validates and merges them into
both pre-rendered HTML and the local runtime catalog. The existing language
rows change only `headlineLine1` and its derived title; the dedicated SEO
titles/descriptions remain intact. Independent native-speaker review of every
translation has not been performed.

The feature artwork and tunnels use inline SVG and CSS with no extra runtime
JavaScript or external requests. Four short arches share a branching tunnel
on desktop; narrow layouts use a continuous side tunnel. Text stays at 16 px.
RTL mirrors the tunnel using logical CSS properties. Reduced-motion settings
disable the small illustration hover movement. Keyboard focus indicators are
retained while the persistent trigger borders are removed.

Local checks passed:

- 51 existing Python publication/synchronizer/renderer tests.
- Four existing Node open-page download tests.
- Shell syntax and the unchanged installer manifest validation.
- 73 generated HTML pages, 72 sitemap URLs and localized SEO verification.
- Reviewed source-bundle validation, 39 archive members.
- JavaScript syntax, translation completeness and `git diff --check`.

Managed-browser observations:

- Desktop light theme: burrow width 212.5 px = 250 × 0.85; its bottom and the
  hero floor both measured 608.390625 px. Mouse fill resolved to black and the
  top gradient stop to white, matching the page background.
- Language and theme trigger borders both resolved to 0 px. The header showed
  MOUSE and the hero showed the browser headline without the old eyebrow.
- All four feature descriptions were visible in the light desktop view.
- Russian 375 px responsive frame: foreground width 161.5 px = 190 × 0.85;
  no horizontal overflow. The feature list kept 16 px descriptions and an
  uninterrupted side tunnel. The wider header wordmark fit without collision.
- Arabic 320 px responsive frame: RTL layout and readable system-font text;
  client and scroll widths were both 305 px after the vertical scrollbar.
- Searching English in the borderless language trigger navigated to `/en/`
  and displayed the new English headline and all four translated descriptions.
- All 72 bottom language links remained rendered without a disclosure or
  language-count label.

These are cloud-browser desktop and constrained-width iframe observations,
not physical-device or Safari acceptance. Local preview used the repository's
existing fixture installer manifest; actual publication resolves the current
official per-platform catalog independently.

## Delivery status

Source is ready for the existing own-user publication workflow. Public
deployment is not yet asserted; record its actual result below.
