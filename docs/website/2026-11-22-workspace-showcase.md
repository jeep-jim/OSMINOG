# Mouse landing — workspace showcase, 2026-11-22

## Status and owner decisions

The existing `mouse.black` landing is published. Publication of this showcase
change is **pending**; local previews and tests do not establish a production
deployment.

The owner's latest reference replaces the standalone preview card with a wide
workspace backdrop behind the foreground mouse and burrow. The backdrop fills
the hero width and fades into the page; the mouse and matching floor line sit
lower in the composition. Preserve the established monochrome themes, mouse
animation, single-line headline and download section.

The preview opens into a full-screen dialog by clicking/tapping it, using the
explicit expand control, scrolling upward over it or swiping upward over it.
The dialog provides scene selection, previous/next controls, pause/play and
close. Escape closes it and restores focus and the page's previous scroll
position. Reduced-motion preference starts playback paused; background or
offscreen previews pause their timer.

## Scenes and language

Six local scenes cycle through different pane arrangements:

| Scene | Demonstrated workspace |
| --- | --- |
| Support | Messengers, Google Maps and mail |
| Trading | Chart, calendar, reporting, watchlist and research notes |
| AI | ChatGPT, Claude and a document |
| Development | VS Code for the Web, an assistant and documentation |
| Content | Figma, YouTube, Instagram and a content plan |
| Design | Figma, an assistant and references |

Content inside the service panes is English. Scene names, captions and controls
follow the selected landing language: `website/showcase-i18n.json` supplies
22 fields for each of the existing 72 locales. `build-site.py` validates and
merges those fields into the compiled catalog, including the catalog exported
for the Python-only server runtime. The source translation JSON is not a
runtime network dependency. The existing language switch refreshes the active
showcase; English panes retain their own language metadata.

## Capture provenance

All four captures are served as local assets. They depict public pages or
self-authored demonstration content and are still images, not live services.
Crop coordinates below are pixels in the captured viewport, before output
encoding.

| Local asset | Source and capture scope |
| --- | --- |
| `website/showcase/maps.jpg` | [Google Maps, London, English](https://www.google.com/maps/place/London,+UK/@51.5285257,-0.2667458,11z/data=!3m1!4b1!4m6!3m5!1s0x47d8a00baf21de75:0x52963a5addd52a99!8m2!3d51.5072178!4d-0.1275862!16zL20vMDRqcGw?hl=en&entry=ttu&g_ep=EgoyMDI2MTExOC4xIKXMDSoASAFQAw%3D%3D). Public London page; crop `x=496, y=80, width=867, height=856`. Account header excluded; map attribution retained. |
| `website/showcase/tradingview.jpg` | [TradingView AAPL chart](https://www.tradingview.com/chart/?symbol=NASDAQ%3AAAPL). Public chart, full captured viewport. Values are captured examples, not current market data. |
| `website/showcase/youtube.jpg` | [Figma's official YouTube videos page](https://www.youtube.com/@Figma/videos). Public channel without sign-in; crop `x=237, y=231, width=1096, height=705`. |
| `website/showcase/vscode.jpg` | [VS Code for the Web](https://vscode.dev/). Crop `x=348, y=27, width=1015, height=909`; the editor contains a benign, self-authored TypeScript demonstration, not product source. |

Mail, messengers, AI conversations, documents, Figma, Instagram and other
uncaptured panes use explicitly demonstrative English HTML. They contain no
private account data. Preserve the visible demo labeling and do not describe
the HTML examples as captured customer sessions or functioning embedded apps.

## Delivery boundaries

- Continue through the existing Mouse deployment on REG under its established
  project access. No new VM, tariff, DNS, root access or AvtoCena changes.
- Use local JavaScript, CSS and captures. Preserve the current same-origin CSP;
  no external iframes, trackers or runtime calls to the depicted services.
- Keep screenshot provenance in this document, outside the public asset tree.
- Preserve the Google verification tag, 72 canonical sitemap entries and the
  existing download catalog and automatic installer synchronization. This task
  does not alter native browser builds or release channels.
- The sync source bundle is limited to 100 entries, 25 MiB total and 10 MiB per
  file. The installer allowlist now includes `.jpg`, `.jpeg` and `.webp`.
- The showcase is integrated into the existing main template; no extra public
  HTML page is introduced.

## Verification recorded so far

The bounded source audit passed:

- `python3 -m unittest discover -s infra/website -p 'test_sync_runtime.py'` —
  19 tests.
- `python3 -m unittest discover -s infra/website -p 'test_renderer.py'` —
  4 tests.
- `node --test infra/website/test-site-downloads.cjs` — 4 tests.
- `node --check website/showcase.js` — syntax check passed.
- Catalog inspection — all 22 showcase fields present and nonempty in all
  72 locales.

Root completed successful managed-preview checks on desktop, 375-pixel Russian
and 320-pixel Arabic RTL layouts with no horizontal overflow; live switching
from Russian to English; opening the modal by tap; Escape with focus/scroll
restoration; all six manual scene selections and pause. These are preview
observations. Upward wheel motion opened the viewer, while downward motion
left it closed and scrolled the page to the downloads. The final Russian
portrait dialog measured 812 px high with 812 px scroll height and no horizontal
overflow. Touch gestures and reduced-motion behavior were reviewed in source;
no physical touch-device or native-speaker translation review was performed.

One preview sequence involving modal close, scroll and theme change exposed an
SVG paint glitch. The burrow now uses calculated horizontal positioning rather
than a transformed wrapper. Repeating that sequence retained the visible mouse
and the intended centered composition; the underlying browser paint cause was
not independently established.

The final integrated build produced 73 HTML pages, 72 sitemap URLs and 93
public files. The SEO validator passed. A separate read-only delivery audit
confirmed all 30 source-bundle members decode with the updated installer,
with 1,422,804 bytes unpacked. Public source contains no repository URLs or
external service requests. The four JPEGs contain no EXIF or comment metadata.

A full run initially had 45 passes and 6 failures/errors out of 51 tests because
the environment's `/tmp` tmpfs had only 182 MiB free, below the existing 500 MiB
installer reserve. The workspace filesystem had 22 GiB free. Repeating the
unchanged suite with a task-specific temporary directory on that filesystem
passed all 51 tests; all 4 Node download-refresh tests also passed. No files
were deleted and the production reserve check was not weakened.

The final mobile viewer uses dedicated portrait geometry for each scene.
Expanding, closing or changing orientation updates only panel rectangles;
it does not recreate captured images or restart the playback timer. Ordinary
downward wheel scrolling reaches the download section; upward wheel motion
over the preview, upward touch gestures and the explicit button expand it.

Before reporting publication complete, run the existing deployment/live gates
and verify the public showcase JS, CSS and each capture resolve successfully
from `mouse.black`. The existing live gate alone does not individually fetch
all newly added showcase assets. Record the actual production source and
verification outcome after deployment.
