# Mouse 6.0.38 — rendering and Chrome Web Store

## Owner request and initial state — 23 November 2026, Krasnoyarsk

The owner supplied six screenshots of Mouse Browser 6.0.37 and requested one corrected release for macOS Apple Silicon, Windows x64 and Linux x64. The owner reports the rendering faults on both Mac and Windows; Linux has not been observed by the owner. Publication is authorized after validation. The separately developed mouse.black landing page and AvtoCena are outside this task. Built-in Agent Mouse remains removed.

Read-back before work: source main `31239316aee12d3eb13b7e74934f99e7ba6c3ad4`; the published 6.0.37 source branch remains `0021084ccb9537e657d21e6f0c8e812dee6b461f`. Publisher main is `cbc1ba6b060215060f59612694b437c23b5cdc83`; the three current platform channels and latest releases are 6.0.37. No 6.0.38 release was present in the checked release collection. Published artifacts and historical journals must remain immutable.

## Observations from all six supplied screenshots

- Two full-size new-tab frames lack section headings, bookmark/history labels and differing subsets of icons. The dark upper area ends near image row 742 and changes abruptly to the configured gradient below. The image size is 2048 × 1284. These are observed pixels, not an established GPU or driver diagnosis.
- A grid frame shows a blank white lower-left tile where another frame shows a website and player. Static images do not establish the duration or cause of that blank frame.
- The annotated rounded-grid frame shows inconsistent seam endings and sharp surrounding corners at intersections, including the right edge of the GitHub column and the lower-right edge of the adjacent chat pane. Green arrows belong to the owner's markup.
- In the dark settings frame, rectangular grid is enabled and the white tone displays `#A0A0A0`. Adjacent dark pages visually merge where a dividing line should be visible. A single frame cannot establish how the slider responded over time.
- The light settings frame retains rounded tiles and shows the same class of inconsistent intersections. A website retaining its own dark theme is not itself a rendering defect.
- Drag-related corruption and the same behavior on Windows are owner reports requiring reproduction. None of these screenshots shows Chrome Web Store installation.

## Updated requirements

1. New-tab headings, labels, icons and the full background must render after creation, resize, layout changes and rapid tab switches, including many open pages.
2. Rectangular grid needs visible one-pixel separators, zero corner radius and no wide gutters. Rounded mode keeps its existing spacing and radius but must use consistent clipping and clean seam intersections.
3. The white-tone control must have a visible effect on the interface and light neutral text in web pages in dark mode. This explicitly extends the former shell-only behavior. Preserve colored content, images and the sites' light backgrounds; changes must apply live and after restart without discarding page state.
4. Install compatible extensions directly from their Chrome Web Store page with an explicit browser-controlled permission confirmation, then allow enable/disable, pin, removal and restart restoration. The user must not have to obtain an unpacked folder for the ordinary store workflow. Extension loading is not equivalent to full Chrome API compatibility; prove supported behavior and report concrete limits.
5. Preserve tabs, profile, cookies, workspaces, existing updater paths, ordinary AI websites and the completed Agent Mouse removal. Verify the successor in installed applications on all three operating systems and upgrade from published 6.0.37 before public acceptance.

## Acceptance work planned, not yet completed

Add regression coverage for the observed new-tab and grid cases, actual page-text color changes, resize/drag with many live pages, verified store package installation and extension lifecycle. Existing native/profile/update checks remain required; a DOM-only test or a successful build does not establish visual or public-release acceptance. Preserve failed evidence and distinguish local fixtures from the live store.

Status: diagnosis and implementation started. No 6.0.38 package has been published by this work.

## Candidate implementation and local verification

The renderer now partitions each split into integer CSS-pixel sizes using the remainder for the second child. The saved split ratios stay unchanged. Rectangular mode uses a one-pixel separator, and rounded mode retains six-pixel gutters. The native bottom-corner masks on macOS, Windows and Linux no longer draw the former additional pixel outside the pane. Local compiled Linux corner-geometry coverage includes fractional display scales; actual native OS pixels still require the installed gate.

The local new-tab page no longer fades its entire surface or requests a separate backdrop capture for every control. Its configured gradient remains intact. Unchanged bookmark and recent-item notifications retain the existing DOM and image owners. These changes remove unnecessary repaint work; they do not establish a hardware or driver explanation for the supplied screenshots.

`mouse-page-tone.cjs` applies the saved preference to neutral light text on dark HTTP(S) page surfaces in an isolated world. DOM work is bounded per animation frame and stops on idle pages. Colored links, light surfaces, image/gradient captions and media are excluded. Real navigation, new DOM content, stylesheet changes and returning from a hidden page trigger the relevant refresh. Turning off dark mode removes the browser markers and restores author styling. No page text is returned to the host or persisted by this feature. Review caught and removed an inherited fixed text-fill override that would otherwise recolor nested links; the native gate includes a nested colored link.

The store path uses a pinned compatibility adapter and a Chrome Web Store-only preload. The host downloads a CRX3 package, verifies its developer ID and Google publisher signature, validates and extracts a bounded archive, presents a native permission prompt, and loads it in the existing ordinary persistent session. Store extensions and the existing optional developer-folder mechanism have separate registries. Store tabs, actions, enable/disable, removal and restore are being verified; unsupported Chrome APIs must remain explicit limitations. The compatibility layer and store preload register before restored pages load; extension workers start after the desktop bank is available, so welcome tabs can be assigned correctly.

Local checks completed so far: 24 integration/profile-isolation/Agent-removal tests; renderer and PageTone focused tests reported separately by their test runners; 19 native geometry/runtime tests passed with one compiled-addon runtime test skipped in this environment. No local GUI result is claimed: Chromium could not create its process socket, and the automatic approval review rejected the requested sandbox escalation. Native rendering and store installation must therefore be checked on the permitted OS CI runners.

The new installed acceptance captures real OS frames for both grid modes and both themes, checks native/DOM edges and corner neighbors, performs native resize and tab drag, examines new-tab labels/icons/background, changes the tone on a real owned HTTP document, and repeats state checks in a new process. Direct store installation and extension behavior are separate live checks, not inferred from the successful signed-package download. Published 6.0.37 remains the required upgrade predecessor.

Candidate status: source changes are not yet a published release. The separately maintained website advanced source main to `65d0ecf7f39eeb9e1c038e86d1244eb7a1347fd9` while this work was in progress; preserve those changes when merging the browser candidate.

## Local candidate freeze before native CI

The completed Mouse unit run reports 1,248 tests: 1,244 passed, zero failed and four skipped for unavailable native conditions. This run included the optional DOM semantic tests through a temporary jsdom 27.4.0 installation; jsdom is not a product dependency. The separate retained shared-core run passed 176 tests and could not run five existing Unix-socket cases because this execution environment rejects `listen` with `EPERM`. Those cases remain required on the native CI runners. The production dependency audit reported zero vulnerabilities.

Extension-specific coverage passed 39 tests, including signed-archive negatives, store sender/gesture checks, permission boundaries and transaction rollback. The renderer/PageTone review also verified that excluded light or colored descendants and `currentColor` SVG keep their inherited author colors, without wrapping or moving text nodes. Temporary shield properties restore their prior values and priorities. Main-frame navigation and BFCache reconciliation recheck the current URL before injecting, and the macOS menu inset is rounded up to an integer layout coordinate.

The new independent acceptance checks actual OS glyph pixels and a real signed store package. Test receipts and an original store CRX are bound to the installed process, source and package hashes. These are required checks prepared for CI; this paragraph does not claim that native installation or public publication has passed.
