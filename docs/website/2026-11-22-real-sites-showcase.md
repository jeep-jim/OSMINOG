# Mouse landing — real website tiles and interactive grid

## Owner decision and scope

On 2026-11-22 the owner rejected the synthetic service interfaces in the first
showcase. The requested revision uses actual website imagery, faster scene
changes, color on hover, demonstrated dragging/resizing/fullscreen, and quieter
integrated controls. The floor line must match the other borders and meet the
burrow without the one-pixel offset. Monetization work is paused.

This record supersedes the scene-content and interaction descriptions of the
first [showcase delivery](2026-11-22-workspace-showcase.md), preserving that
historical record. The approved introduction, one-line headline, mouse
animation, theme switch and platform downloads remain in place.

## Implementation

- Every service pane now uses a captured real page. There are eleven local
  images, including seven new captures. No synthetic mail, chat, document or
  design-editor interface remains in the showcase. See the
  [capture provenance](2026-11-22-real-site-captures.md) and the four original
  captures in the earlier delivery record.
- The six scenes are Support, Trading, AI, Development, Content and Design.
  The initial Content scene shows YouTube, Figma Community, Perplexity and
  Hugging Face Spaces. Names and captions describe the actual pages: the
  Figma capture is its Community gallery, and Discord is its Help Center.
- Scenes cycle every 4.6 seconds. Scripted pointer actions demonstrate changing
  window order, resizing boundaries and opening a tile across the workspace.
  The monochrome preview reveals original color on hover and interaction.
- In the expanded viewer, dragging a window header swaps its position;
  dragging a divider resizes adjacent windows. Each tile has a maximize/restore
  control. Double-click and keyboard alternatives are available. Escape first
  restores a maximized tile, then closes the viewer.
- Manual interaction and keyboard focus inside the canvas pause playback.
  Hidden/offscreen pages and reduced-motion preferences also control playback.
- Mode selection is a compact menu in the browser chrome. Previous, pause,
  next and expand controls sit on the same bar. External floating mode pills
  and caption controls have been removed.
- The viewer still opens from the preview, its expand control or an upward
  gesture. Closing restores focus and the previous page scroll.
- The floor line, final burrow gradient stop and download borders share the
  opaque `--line` token: `#505050` in dark mode and `#b8b8b8` in light mode.
  The SVG viewBox ends at the opening's baseline and its wrapper uses a 7:6
  aspect ratio with bottom zero, removing the fractional offset.
- All 72 languages now contain 25 showcase fields, including Move window,
  Resize windows and Restore grid. Controls inherit the landing language;
  captured pages retain English language metadata. The server-side compiled
  catalog includes the new fields.

The images are recorded website captures, not remotely embedded live services.
The grid itself is interactive HTML/CSS/JavaScript. No external iframe, account
session, analytics or runtime request to a depicted service was introduced.
Market values in captures are examples, not live prices. The public Microsoft
VS Code repository shown in Development is unrelated to the Mouse source.

## Local validation

- Existing Python website suite: 51/51 passed using the workspace temporary
  directory, preserving the unchanged installer free-space reserve.
- Existing Node download-refresh suite: 4/4 passed.
- Both showcase JavaScript files passed Node syntax checks; `git diff --check`
  passed.
- Static build: 72 languages, 73 HTML pages and 100 public files. SEO validator
  passed with 72 sitemap URLs.
- Independent read-only geometry review checked twelve desktop/portrait
  layouts and 1,185 divider moves, with complete coverage and no overlaps or
  out-of-bounds rectangles.
- Eleven images decode correctly; the seven new captures total 888,936 bytes.
  No private signed-in content or EXIF data was included in those new assets.

## Browser validation before publication

The managed local preview was inspected in the actual Cloud Chrome browser.
On desktop, a YouTube window was dragged into Figma's position and their slots
swapped. The upper divider moved from 54% to approximately 62.70%, changing
only the adjacent upper windows. Figma maximized, Escape restored the grid,
and a second Escape returned the experience to the landing with scroll zero.

The measured dark hero floor and opening bottom were both 608.390625 px;
the floor, gradient stop and download border all resolved to RGB 80/80/80.
Light mode resolved all three to RGB 184/184/184 with zero baseline offset.
Neither theme had horizontal overflow in the inspected desktop viewport.

The Russian 375-by-844 viewport produced a 375-by-844 full-screen dialog and
375 px document width without horizontal overflow. It displayed the actual
Figma, Perplexity and YouTube captures with translated controls, and closed
back to the landing. The Arabic RTL preview at a 320 px iframe width also
had equal client and scroll widths (305 px after its vertical scrollbar).

These checks do not claim physical touch-device, Safari or independent
native-speaker translation testing. The VPN routing issue is outside this
revision and remains unresolved.

## Delivery status

Source `8ddde2077ee2b7d74a33246c9e3270df8ec345d2` is published at
<https://mouse.black/>. Its tree `65373c026dd406c684d91b9783485d312370baad`
exactly matches the reviewed local commit. The concurrent documentation
commit `33fb28e6bcb66e2aeda3eaf6c03a0189f5ed9712` is preserved as its parent.
The source was published through the existing GitHub connector with a
non-forced expected-head update; the local CLI had no push credentials.

The existing website [run 45046471600](https://github.com/jeep-jim/OSMINOG/actions/runs/45046471600)
published the site successfully, but its subsequent independent runner-side
verification did not finish within the website job's 30-minute limit.
The overall website job concluded `cancelled`; do not report the entire run
as successful. Validate passed 51 Python tests, 4 Node tests, the 72-language
SEO build and the 37-member source bundle. The existing osminog deployment
path was used. No DNS, tariff, Nginx, root access, AvtoCena, native-browser
release or release feed changes were made.

### Server publication and completed checks

The own-user publication step succeeded. At 2026-11-22 16:55:43 UTC its
server-side verifier confirmed HTTPS and redirects, Russian/English/Arabic
HTML, 72 sitemap entries, 73 hreflang entries, the current catalog, and full
SHA256 plus HEAD/Range checks of all three public installers. It emitted
`MOUSE_PAGES_LIVE_VERIFIED sitemap_languages=72 sampled_languages=3 downloads_sha256=3`.
Deployment identity: `d675c0ef86ee9af61237e115eff1a43dfc4a9115`.

| Platform | Version | Verified SHA256 |
| --- | --- | --- |
| macOS arm64 | 6.0.37 | `3c8d727eabcec91c4893f94762b6834080344e35320edaaf1f7555bf407ae1a2` |
| Windows x64 | 6.0.37 | `19487826aa51b2027d5a4d497529be62a5e2180402ea24e5d700da48f4cd0e35` |
| Linux x64 | 6.0.37 | `e35d46095d2bf8617fc981ee8f41b5bbe885ed8de4083cee4b890e45ade4bf79` |

A subsequent real automatic timer execution was observed at
`2026-11-22T16:56:45.507285+00:00`. The installation emitted both
`MOUSE_RELEASE_TIMER_VERIFIED` for the exact source and
`MOUSE_WEBSITE_AUTOMATION_LIVE https://mouse.black`.

### Independent external check limitation

The Actions runner independently resolved the public catalog and exact
deployment identity at 16:56:47 UTC, then rebuilt and validated the expected
72-language output. Its subsequent `verify-pages-live.py` process had no
flushed progress output before cancellation at 17:25:32 UTC. Consequently,
the exact URL or file where that external pass stopped is not established;
the absence of a checksum error is not a completed external verification.
Do not claim that this second pass confirmed all three complete downloads or
that the reason for its long duration has been diagnosed.

The completed deployment and browser observations remain separately verified.
No rollback, cancellation by the assistant, automatic rerun or weakened gate
was introduced. Deployment evidence artifact: `14764298757`,
`mouse-website-deployment-evidence.zip` (1,874 bytes), ZIP SHA256
`8934f6edacdd947c1ea81cdcb0da76c2a65177f38509c7462b674a238495acd5`.
Any later external verification should be recorded as new evidence rather
than rewriting this cancelled run as success.

## Published browser observations

The live browser at <https://mouse.black/> rendered the new actual captures,
integrated toolbar, translated controls, mouse and one-line headline. All
three download links displayed 6.0.37, including macOS.

Opening the viewer and maximizing Figma loaded its actual Community page;
the control changed to the Russian Restore grid label and tooltip. Escape
restored the grid. A pointer move over YouTube resolved that capture to
`grayscale(0)` while the other three panes remained at `grayscale(0.75)`;
all four images were decoded and loaded. Closing restored the landing.
The public dark floor and burrow bottom both measured 608.390625 px, and
the floor/gradient/download border all resolved to RGB 80/80/80.

Screenshots captured from the published page, stored only as documentation:

- [Published landing](previews/2026-11-22-real-sites-home.jpg)
- [Published interactive grid, YouTube in color](previews/2026-11-22-real-sites-grid.jpg)
