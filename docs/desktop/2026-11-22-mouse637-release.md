# Mouse Browser 6.0.37 — one successor to 6.0.36

## Owner scope and immutable predecessor

The owner requested one release for macOS Apple Silicon, Windows x64 and Linux x64 through the existing **Обновить** control. The owner's primary computer is a **MacBook**. Native CI acceptance does not constitute installation on that physical computer.

Source work continues in [PR #193](https://github.com/jeep-jim/OSMINOG/pull/193), originally checked at `05b57d1b1accf51a67f1fa1944f2476c73fafb85`. Publication uses the existing [OSMINOG-Releases](https://github.com/jeep-jim/OSMINOG-Releases) repository and its unchanged platform channel URLs.

The release audit found no running or queued duplicate build/publication of these changes, no open release PR, and no reserved 6.0.37 tag, release, staging directory or branch. Version **6.0.37** was selected before starting the new build. Published 6.0.36 packages, tags, manifests and historical validators are immutable.

The actual installed predecessor for current upgrade and performance acceptance is **6.0.36** on all three platforms. Historical compatibility probes may additionally exercise their named old versions; they do not substitute for 6.0.36 acceptance.

## Changes carried forward

The release preserves the live desktop switching improvements, inline Agent settings and removal of tile search already published in 6.0.36.

PR #193 contributes the 72-entry language chooser, rounded resize highlight, quieter separators and address styling, a compact pane header revealed by hover/focus, the puzzle control and pinned extension shortcuts with resizable panes, and the media mini-player to the right of Nora on other desktops. Only Russian and English are translated. Other listed interface languages remain explicitly planned.

Extensions are limited to compatible unpacked folders with the existing validation and explicit install consent. Chrome Web Store installation is not supported. No claim is made about the media player's compatibility with VK; native acceptance uses owned HTTP/audio fixtures.

The three refinements requested from the previously local-only work are included:

- Language search recognizes Russian names, including both Simplified and Traditional Chinese, without enabling untranslated locales.
- A failed extension restore has a distinct RU/EN error state and removal/reinstallation guidance. Successfully restored bytes clear a stale error state.
- A real native media-started-playing event received during an outstanding read is coalesced and rediscovered after that read settles. Replacement audio elements are not discarded with the stale element; navigation, privacy, dismissal and disposal revoke queued rediscovery.

## Startup regression found in the draft

The previous macOS run stopped in the old 6.0.35 acceptance before reaching the candidate. Previous Windows and Linux candidate restarts did not reach `MOUSE_READY`; the Linux renderer's basic CDP ready-state evaluation timed out as well.

The draft introduced a renderer observer cycle: translation of body mutations unconditionally assigned the root `lang` attribute; the extension UI observed that assignment, replaced its content, and triggered another body translation. This kept producing microtasks before startup timers could run.

The fix writes `lang` only when the value changes and makes the extension observer react only to an actual language/privacy transition. `mouse-renderer-startup.test.cjs` executes both production scripts with same-value attribute mutation semantics. The original draft scripts fail both RU/EN cases because the mutation queue does not settle; the corrected scripts settle through startup, later body updates and language/privacy transitions.

## Acceptance contract

All three distributable platforms must come from one accepted source commit. Windows also retains the additional modern Windows installed acceptance job. Existing applicable profile, documents, Agent, capture, privacy and removed-search checks remain required.

The new installed feature check runs in two processes with the same isolated profile. It checks the language chooser and Russian search, extension folder loading/pinning/pane behavior, owned media and cross-desktop controls, then preserves a deliberately changed owned extension fixture. After actual restart, it checks the restore failure display and recovery. Native input and operating-system screenshots are recorded where the check asserts visible behavior.

Performance acceptance compares the published 6.0.36 installation and candidate 6.0.37 with the same 20- and 50-page workloads across five desktops. Both retain page identity, live page activity and zero desktop snapshot/native capture calls. The declared median allowance is one 60 Hz frame, **1000 / 60 ms**, for each workload. This is a selected acceptance budget, not a claim about measured runner noise or an additional speed improvement. Both 50-page runs must also meet p95 ≤ 250 ms and maximum ≤ 600 ms. Raw samples are retained and recomputed by the acceptance gate.

Final publication requires successful installed upgrade/profile checks from the exact published 6.0.36 bytes, successful native feature checks, and package/source/digest binding. The published updater module from 6.0.36 must then discover and download the new exact package from each real public channel.

The prepublication button test installs the unchanged published 6.0.36 application, confirms its updater Git blob `91ab363f926774825caf8055b2d3d81bf0d51264`, and supplies only channel/package transport through a CI-owned loopback fixture. The original version selection, SHA-256 verification, native installer and profile lifecycle remain in use. Real operating-system clicks activate the update, download and install controls. The main inspector must actually close before the Install click. The test then requires the production startup acknowledgement, a distinct visible automatically relaunched process, a native quit, and an independent fresh-process profile read. This fixture is explicitly separate from the mandatory real public-channel/download proof after publication.

On macOS this test creates the previously absent default profile so the unchanged LaunchServices relaunch uses the same data even if it does not inherit a test environment variable. Its exclusive ownership sentinel is checked after the complete profile read; only then is this CI-owned profile removed. Failure keeps it for diagnostics.

The added bounded checks account for aggregate job caps of 55 minutes on macOS, 60 on Linux and 65 on Windows. Existing individual startup, capture and profile deadlines are unchanged.

## Local verification before the source build

The combined focused JavaScript run passes **57/57** tests, covering the startup regression, three requested refinements, retained routing, feature fixtures, performance contract and the production updater's selection/checksum/install delegation. The new Python helpers pass **22/22** tests, including native window ownership, PID reuse rejection, exact sentinel requirements and refused out-of-window input. Workflow YAML, syntax and whitespace checks pass.

The broad local suite is not recorded as accepted: this scratch runtime lacks the pinned Node native headers/module and rejects Unix-domain socket creation, so native MCP/PTY cases fail there. These gates remain mandatory, unchanged, in the actual platform CI with its native dependencies.

## Publication status

Preparation and local verification are in progress. This document does not yet attest a successful 6.0.37 build, installation or publication. Final source/run/package/channel evidence will be appended after it exists. The owner must not be told that updating is available until all three actual channels serve the accepted 6.0.37 packages.

## Continuation: two appearance settings in the same release

The owner explicitly added two appearance controls to this same release, after the first 6.0.37 source run. The normal rounded layout remains the default. A switch selects a rectangular grid with zero pane gap, zero workspace inset and zero native corner masks. It changes geometry of existing pages without recreating their views or reloading their documents. The existing split controls keep their keyboard operation and an invisible pointer target in the square layout.

The dark interface's primary text now uses `--text-primary`. The **Тон белого** slider maps 0–100 to grayscale `#A0A0A0`–`#FFFFFF`. The selected default is **55 / #D4D4D4**, following the final sentence of the owner's supplied task (which supersedes the earlier illustrative E0 default). Both settings are validated, saved in `mouseAppearance` localStorage and restored before shell startup. Private-mode changes are session-only and returning to normal reloads the saved normal choice. Light-theme primary text and arbitrary website styles remain governed by their existing themes. Storage errors leave a usable session choice and show that it could not be saved.

The current two-process installed feature gate now exercises the actual switch, both slider endpoints and reset, both themes, exact CSS/native geometry, live page identity and an actual restart with the nondefault square/0 choice. OS screenshots are retained. This is a required gate, not a statement that it has already passed.

## First source failures and concrete fixes

The original source `512ac4e33bf2a9de872bfd2bb7f3436a4c93f862` failed on [macOS 44967550990](https://github.com/jeep-jim/OSMINOG/actions/runs/44967550990), [Windows 44967550940](https://github.com/jeep-jim/OSMINOG/actions/runs/44967550940) and [Linux 44967550966](https://github.com/jeep-jim/OSMINOG/actions/runs/44967550966). These runs remain failed historical evidence.

On macOS and Windows the retained download test reached the real UI. The green track/fill and both live page probes passed. Its dark gap expectation was stale: it expected `#43536B`, while the requested quieter 6.0.37 seam actually rendered `#354357`. The independent accepted palette is now selected by version in `mouse-smoke-seam-palette.cjs`; the same correction is applied to the retained dense-layout and focused-corner tests. Pixel tolerances, probe positions and timing budgets are unchanged. Decoding the archived PNGs reproduces the four incorrect dark-gap expectations; all 130 probes across six final frames match the correct palette. That replay is diagnostic evidence only. The candidate also makes AI/download seam backgrounds consistent with the accepted native mask color.

The Linux update-button failure occurred at **predecessor startup**, before any native click. The prior error text incorrectly called this an automatic relaunch failure. The unchanged 6.0.36 AppImage had already exec'd its mounted executable and did not expose the backing image through the helper's expected ancestry/environment paths. The helper now also binds the visible owned browser process to the exact same-user AppImage runtime through its inherited kernel FUSE keepalive pipe, with executable device/inode, opposite descriptor directions and process-start identity checks. The fixed budget, owned profile sentinel, unique native window and all input bounds requirements remain mandatory. This additional identity path still requires actual installed Linux CI confirmation.

The Linux file-conflict unit failure exposed a real product issue: rapid equal-length edits can have coincident filesystem timestamps. All platforms now carry the bounded original bytes into the native commit check; the POSIX implementation compares those bytes through a held descriptor and rechecks descriptor/directory identity before replacement. The deterministic equal-length/timestamp regression fails the original POSIX implementation and passes the corrected implementation. The check does not claim atomic compare-and-swap against an unrelated writer changing the file after the final comparison.

## Local checks for this continuation

The targeted appearance/core-layout suite passes 69 tests. The retained color/geometry suite passes 41 tests. Native-window helper tests pass 14 tests, including real local kernel pipe observation and rejection of incorrect image/PID ownership. The unchanged published updater transport/checksum/delegation tests pass 7 tests. On an isolated temporary build of the actual POSIX filesystem code against the official Node 22.23.5 headers, 12 file tests pass and the Windows-only case is skipped; X11 integration is excluded only for this local filesystem test because this scratch environment lacks its headers. Repository release addons remain built normally in CI.

The broad source/platform gates and fresh package results will be recorded below after they exist. The public 6.0.36 channels have not been changed by preparation of this continuation.

The final combined focused JavaScript run for this continuation passes **83/83** under Node 22.23.5. General desktop tests pass 173/178; all five failures are the environment rejecting Unix socket creation (`listen EPERM` in unchanged `mcp-host` cases). The broad Mouse driver also hits its existing 300-second deadline after unavailable native/MCP/PTY cases. These local broad runs are explicitly **not accepted** and do not replace the unchanged CI gates. Headless visual QA could not start Chromium because this environment rejects its process-singleton socket; no local visual pass is claimed.


## Native follow-up on 3ca4b8b: observed update success and remaining UI corrections

The next installed runs used source `3ca4b8b25e1a5477bb85cb712e0e5dd48875c478`. The [Linux run 44970714687](https://github.com/jeep-jim/OSMINOG/actions/runs/44970714687) passed its units and package build, the exact published 6.0.36 profile upgrade and the native update-button flow. Independent validators recomputed the archived evidence from artifact `14733169835`: trusted XTest clicks, unchanged published updater, distinct automatically relaunched 6.0.37, production READY/save/quit logs and a separate profile reader all passed. This confirms that the AppImage predecessor identity correction works in that installed run; it does not accept the entire candidate or publish a package.

That Linux run then failed at the dense separator test because its `actualToken` still read the separate control-border token `--line` (`#43536B`) while its independent workspace expectation was correctly `#354357`. Both dense separators and the retained Nora corner readbacks now observe the effective workspace token `--mouse-grid-seam`, falling back to `--line` for unchanged older/light layouts. Independent palette expectations, actual stage/divider color assertions, native PNG probes, coordinates and tolerances remain unchanged. The focused palette/geometry suite passes 33 tests, including distinct border/seam readback in the renderer.

The [Mac run 44970714709](https://github.com/jeep-jim/OSMINOG/actions/runs/44970714709) passed units/build and reached the new feature suite. It exposed an actual chooser issue: the first Escape cleared a nonempty search input but left the language dialog open. The archived failure screenshot confirms that state. The chooser now explicitly closes on one unhandled, non-composing Escape, suppresses the search-input default and stops the event from also closing a lower overlay. A regression exercises the production renderer listener with the native OverlayGate and confirms restoration of the same live page once. The focused language/overlay/features suite passes 48 tests. This failed run did not reach the new appearance screenshots.

The unrelated [Chrome diagnostics run 44970714629](https://github.com/jeep-jim/OSMINOG/actions/runs/44970714629) passed 27 of 28 scripts and hit a 20-second CDP reconnect timeout in unchanged `clipboard-extension-421`. The [canonical Chrome run 44970714661](https://github.com/jeep-jim/OSMINOG/actions/runs/44970714661) passed the same script and real restart on the same source. No Chrome timeout or acceptance was relaxed; the failed diagnostic remains part of the history.

The independent publisher preparation is in [OSMINOG-Releases PR #66](https://github.com/jeep-jim/OSMINOG-Releases/pull/66), commit `c3413a0ce8f3fdcd5adb890f9b54dc6045d06fea`. All 39 local contract tests and the three draft workflow contracts pass. Every platform remains `ready:false` without a publication trigger or candidate provenance claim. The next source run must accept these corrections before exact source/artifact pins can be added.


## 2026-11-22 — lower AI websites, populated presets and quieter side panels

The owner added all of the following to the **same 6.0.37 release**, without replacing the earlier appearance, language, extensions, media or update requirements:

- The website opened below an AI chat must have its own editable address and favicon, a draggable horizontal boundary, and transfer into a regular main pane through a chooser or header drag. Moving it must retain the exact live page, document state, navigation history and the displaced main tab; closing the original AI chat must not close a detached website.
- Selecting a workspace mode must immediately populate its starter sites. Content/social follows the provided six-column, two-row screenshot. Support has four web messengers in a two-by-two block on the left and Google Maps on the right. Trader starts with a large TradingView chart and Investing.com's calendar, Finviz and CoinMarketCap. Agent returns to the mode list with a dedicated localhost pane on the left and the existing Agent UI on the right. The localhost landing follows the selected theme; opening the mode does not enable any Agent/model/file/terminal permission.
- Settings and the library sidebar must draw attention through a darker dark-theme surface and a slight, temporary dim on the main pages. Library file/capture cards should open on click, drag the actual file to browser windows, and expose remaining actions/type/creation time through the context menu, removing repeated visible labels and Preview/Copy/Delete buttons.

### Current implementation and verification

The lower website implementation now stores its height ratio per desktop, keeps ordinary page chrome and preserves live native identity during transfer. Focused production-level tests cover pending navigation/save, undo/redo, pinned destinations, stale preferences, private MemoryStore, independent ratios, address editing and favicon rendering. The new installed feature check uses two owned loopback origins, actual native clicks and drags, four mode/theme resize states, real decoded favicon pixels, both transfer paths and retained document/cookie/form/scroll identities. Its six screenshots and two-process report are required by the new independent 637 gate; installed success is still pending.

Mode planning creates only missing preset pages, records their IDs per desktop, and reuses them after redirects and later mode selection. Previously open main, internal and AI pages remain alive. Dedicated `agentPreviewId` and bounded `presetTabs` are normalized, stored with the desktop/history and pruned after close or cross-desktop transfer. The combined native-bank and two 637 fixture suites pass **40/40** under Node 22.23.5. Sidebar/card work and its real drop evidence are in progress at this entry.

Canonical web-messenger routes were checked against the publishers: [Telegram applications](https://telegram.org/apps) resolves WebK to `https://web.telegram.org/k/`; [WhatsApp Web](https://web.whatsapp.com/mobile/) names `https://web.whatsapp.com/`; [MAX help](https://help.max.ru/help/about/ustanovka_i_registraciya_v_max/na_kakih_ustroistvah_rabotaet_max) names `https://web.max.ru/`. [Meta](https://about.fb.com/news/2025/04/new-features-threads-web-experience/) documents Threads moving to `threads.com`. TradingView `/chart/` returned HTTP 200 and its live-chart title; Investing.com's calendar, Finviz and CoinMarketCap were read from their own sites. The existing official-domain WeChat Web address is retained, but this environment receives HTTP 403, so no successful WeChat account/login or third-party availability claim is made. Native preset tests use owned fixtures; they do not claim third-party sign-in.

### Native follow-up on 589f95a

The installed [Mac 44971491852](https://github.com/jeep-jim/OSMINOG/actions/runs/44971491852), [Windows 44971491861](https://github.com/jeep-jim/OSMINOG/actions/runs/44971491861) and [Linux 44971491867](https://github.com/jeep-jim/OSMINOG/actions/runs/44971491867) runs for `589f95ab1740b0d89d1da35c96dd3cebe60cb372` all failed at `real compact header strip` after passing their unit/build stages. The archived Mac screenshot and trusted drag log show a 103 px first pane, while the production compact threshold is `MouseLayout.minimum(..., 'y') + 2`, currently 102 px. The smoke now drags to the actual 100 px layout minimum instead of 103. Production threshold, expected five-pixel collapsed strip, native hover/focus behavior, pixel tolerances and timing budgets remain unchanged. This correction needs the next actual native run.

All generic workflows for that source, including both Chrome checks and the Windows helper matrix, succeeded. The three Mouse failures remain failures; no 6.0.37 package/channel has been published. The draft release gate's AI extension passes **44/44** independent unit checks and its template contract, with every platform still unready. Frozen 6.0.36 validators, packages and channels remain unchanged. The 637 compatibility layer must explicitly validate the newly requested preset/card behavior where it supersedes an older UI expectation; it must not falsify old evidence fields or bypass retained identity/privacy/worker checks.


## Combined continuation ready for the next installed run

The requested sidebar/card changes are now implemented. Settings and the library temporarily dim main native and browser-owned pages by 14%, keep pointer input available and remove the owned layer on close/navigation. Dark side panels share the toolbar surface. File and capture content opens on click; actual local file bytes are supplied to Electron native drag, and the native context menu contains the remaining actions plus actual type and creation time. Repeated visible Screenshot/title labels and permanent Preview/Copy/Delete buttons have been removed from file cards. Accessible names and selection remain.

The portable installed feature scenario now includes the lower AI website, the complete preset catalog, two localhost theme frames, eight sidebar focus frames and five library frames. Presets use the same shared native-control scenario as the retained Mac test: seven selections, 27 actual service requests across two desktops, 24 retained pages on the main test desktop, no repeated service loads, and localhost navigation within the same dedicated pane. External service URLs are redirected only in the isolated acceptance profile to owned loopback documents; this verifies catalog/routing/state rather than third-party accounts. The library scenario requires three real file drops into two live native pages, validates their exact bytes and keeps the original pages and clipboard. These installed scenarios remain unaccepted until the next platform jobs produce their real evidence.

The combined desktop/preset/AI/metadata run passes **112/112** under Node 22.23.5. The AI/sidebar integration run passes **146/146**, followed by a separate **10/10** lifecycle/helper run after the targeted BFCache fix. Library production and its fixture checks pass **67/67**. These are overlapping focused suites and are not summed into a total. The new independent preset validator passes **9/9** synthetic contract mutation tests; such fixtures do not stand in for native acceptance.

The new 637 release adapter narrowly replaces the frozen622 seven-request predicate with independent validation of the complete newly requested preset evidence and both original localhost PNGs. It also changes the matching feature token to `five-mode-populated-presets-preserve-live-pages`. The actual emitted request count remains 27; every other retained worker, permission, PTY, profile and native marker check stays in place. All 29 frozen636 dependency hashes still match.

The final combined run over all 15 changed/new focused test files passes **134/134** (Node22.23.5). The shared portable preset helper separately passes **91/91** focused checks and is verified to be included, without its unit tests, by all three existing package configurations. The new release preset tests also verify a complete positive legacy622 report and reject changed PNG bytes, not only negative request-count fixtures.

The final integration review reproduced a real persistence defect: the normal `mouse:save` whitelist omitted `aiPreviewRatio`, `agentPreviewId` and `presetTabs`, even though the renderer sent them. The handler now forwards them into the existing validated per-desktop store. A new test executes the actual normal/private registered handlers and actual DesktopService/MemoryStore; it failed before the fix and now verifies restart persistence, per-desktop binding and private isolation. The save/desktop/private focused run passes **33/33**. File drag/menu availability is also invalidated during a privacy transition before the renderer reload. All four source verification uploads include the exact owned TXT drop fixture for independent byte verification.


## 2026-11-22 — recovered release state and circular updater request

The continuation compared all **55** staged files from the previous source workspace with remote candidate `42e6dca301685e0fedfb9a0406b6e5661555393a`: every file matched byte for byte. This confirms that those edits reached the candidate branch, not that a package containing them was published. Source [PR #193](https://github.com/jeep-jim/OSMINOG/pull/193) and publisher [PR #66](https://github.com/jeep-jim/OSMINOG-Releases/pull/66) remained open drafts. The three public Mouse platform feeds still served **6.0.36** when read on 22 November 2026. No 6.0.37 release or successful installed acceptance is claimed by this entry.

The actual failed candidate runs are [macOS 44974488711](https://github.com/jeep-jim/OSMINOG/actions/runs/44974488711), [Windows 44974488678](https://github.com/jeep-jim/OSMINOG/actions/runs/44974488678) and [Linux 44974488764](https://github.com/jeep-jim/OSMINOG/actions/runs/44974488764). Their logs and retained native evidence identify three distinct acceptance mismatches:

- The retained macOS zoom check searched for the original magenta page meter while the newly requested settings sidebar correctly dimmed the page by 14%. Archived settings guest pixels contain RGB **202,34,133**, the rounded result of **235,40,155 × 0.86**. The 637-only expected presentation now requires the settled actual sidebar state and that independently declared color for settings, while popovers and other versions retain the original color. Native geometry, meter density, identity, pixel tolerances and deadlines are unchanged. Guest PNGs are saved before an assertion so a later failure retains its actual pixels. The publisher independently verifies the same scoped contract without modifying the frozen 636 validators.
- Linux reached the media fixture with the widget in its responsive `buttons` room (53 px), although its selected mode was `full`. Its dismiss control was correctly hidden by CSS; the previous fixture checked only the HTML `hidden` property. The fixture now reads actual hit visibility, bounds its temporary native window expansion by the display work area, requires all full-room hit targets, and verifies that a trusted dismiss hides the widget while audio continues. Compact-room behavior remains required. No product visibility rule or timeout was relaxed.
- The Windows 6.0.29 profile comparison differed only by the three newly declared defaults: `agentPreviewId:''`, `aiPreviewRatio:0.5` and `presetTabs:{}`. The acceptance adapter adds these only to the expected side of the exact 6.0.29 → 6.0.37 comparison. Saved values, other fields and same-version restart comparisons remain exact; the observed preferences are never normalized to conceal a missing value. This changes no production profile storage.

The owner additionally supplied a drawing and requested a genuinely circular update window: the existing central mouse logo and status, action segments around the circular rim, round close/minimize controls on the upper right, and a strongly darkened surrounding workspace. This is being included in the still-unpublished **6.0.37** candidate. Publishing a needless 6.0.38 before 6.0.37 exists would not deliver an additional fix to users. If a 6.0.37 package is published independently and lacks required changes, it must not be overwritten; the missing changes then require 6.0.38.

The new update presentation must retain the existing updater actions and truthful phase/status, download progress, Escape/minimize semantics, both themes and keyboard access. It must remain circular in square-grid mode. The installed feature contract adds owned presentation fixtures for current/available/downloading/ready/installing/error states and two actual OS frames, `mouse-637-update-burrow-light.png` and `mouse-637-update-burrow-dark.png`; these fixtures must not perform a real update or substitute for the retained installed-upgrade and public-channel proofs. Implementation review and fresh platform results will be recorded below when available.


### Circular updater implementation and local verification

The new presentation is implemented as a responsive circular dialog, at most 600 px in diameter, with the existing 150–180 px mouse artwork centered on both axes. Native HTML buttons occupy disjoint clipped sectors along the bottom rim; SVG text follows each sector. Round close/minimize controls remain on the upper right. A separate information control exposes the existing platform-specific installation guidance. The backdrop is black at 82% opacity with 6 px blur. Both neutral themes, square-grid mode, accessible labels, focus recovery and reduced motion are retained. Independent review caught and corrected a legacy reduced-motion `transform:none!important` rule that otherwise displaced the artwork.

The real updater's existing download/install/open/check/minimize handlers are unchanged. The added visual hook reads its phase and percentage. The new installed presentation check uses native opening, closing and minimizing, exact state restoration and retained live page identities. Its two OS captures bring the complete feature ledger to **38 frames: 36 in the write process and 2 after restart**. The publisher verifies these actual PNGs with independent ring/core palette expectations; presentation fixtures explicitly do not attest transport or installation.

The final combined focused run passes **45/45 tests, 0 skipped**, using the exact CI Node **22.23.5**, from the required `desktop` working directory. This includes retained609/620 behavior, RU/EN renderer startup, media fixture geometry, legacy profile expectations, settled zoom presentation, ring geometry/progress and presentation-fixture cleanup. The first root invocation used the repository root and produced missing-relative-file errors in the retained tests; correcting the working directory required no source or test change. Syntax and whitespace checks pass. Local Chromium cannot start because ProcessSingleton socket creation is denied (`EPERM`), so no local native/visual pass is claimed. Fresh installed runs are still required.


## Native follow-up on 897fc949 — confirmed repairs and remaining input/display work

Candidate `897fc9496b30ae8c3154add2678afab7d9042f5e` was pushed with the complete circular updater and preserved current main history. The [Mac run 44976432300](https://github.com/jeep-jim/OSMINOG/actions/runs/44976432300), [Windows run 44976432512](https://github.com/jeep-jim/OSMINOG/actions/runs/44976432512) and [Linux run 44976432338](https://github.com/jeep-jim/OSMINOG/actions/runs/44976432338) built their packages, then failed in actual installed 637 feature checks. They remain failed diagnostic evidence; this source is not accepted or published.

The retained 633 live-zoom gate now passes on Mac and Windows. Windows confirms the legacy 629 profile migration, the real636-to637 profile-preserving replacement and the real update-button path; Linux also confirms the actual 636 profile replacement and update-button path. Linux additionally passed the repaired media scenario: its native window expanded from 1200 to 1504 px inside the 1600 px work area, measured widget room increased from 135 to 287 px, every full control had a native hit, and a trusted XTest dismiss hid the widget while the original audio continued. The original window bounds were restored. These successful sub-gates do not accept the failed complete runs.

Mac and Windows then exposed a genuine fixture display constraint. Their actual displays were 1024 px wide; the Mac fixture began at 1016 px with 89 px of footer room and Windows at 1016 px with 97 px. The fixture correctly refused to move outside the real display. Expanding to 1024 cannot provide the 145 px required by the product's full responsive media layout. Their actual failure PNGs show the intended narrow pause/return layout, not the full control set. Verification artifacts are Mac 14736350833, Windows 14736258582 and Linux 14735403680.

The next candidate therefore prepares only the CI desktop's real supported display mode before installed verification, using documented CoreGraphics session configuration on Mac and supported User32 display configuration on Windows. It enumerates actual advertised modes, requires independently observed logical dimensions of at least 1440x900, records before/selected/after geometry, and verifies persistence in another process. Unsupported modes or failed changes must fail explicitly with the actual mode list. This does not add offscreen windows, change production media behavior, lower native requirements, purchase runners or change existing workflow step identities/timeouts. The publisher imports the same helper from the exact pinned source with Git blob verification. Actual availability of suitable modes and native execution remain unverified until the next platform runs.

Linux progressed to the AI website address check. Its failure PNG shows the intended `/page/4/` value focused in the address field while the same preview still displays page3. The old 637 helper sent only raw Electron keyDown/keyUp; retained 625/628 helpers already document the missing Return-character form-submit behavior. The same Linux artifact proves the existing retained 636 OS Return path produced trusted keydown/keypress/submit/keyup. The AI fixture now uses that existing platform-native key path and records the focused editable form, exact chat/preview owner and destination, native key receipt, and ordered trusted events with exactly one submit. The production navigation handler and fixed deadline remain unchanged. The old failed AI step did not record its keyboard trace, so direct confirmation of this correction still requires the next installed run.

A separate integration review caught two details in the circular updater: its dark primary text must follow the existing white-tone variable, and its reduced-motion animation override must have enough CSS specificity to beat the busy-state rule. Both are corrected. The existing two-theme presentation proof now reads the actual status and secondary-action colors, requiring RGB 160,160,160 for the persisted dark whiteTone0 choice. Its frame count, surfaces and phase list are unchanged.

The targeted follow-up JavaScript run passes **31/31 with zero skips on Node 22.23.5**; this overlaps earlier focused suites and is not added to them. The independent publisher follow-up passes **78/78**, and all three unready publication contracts remain valid. The unrelated [Chrome diagnostic run 44976432305](https://github.com/jeep-jim/OSMINOG/actions/runs/44976432305) passed 27 scripts and timed out on clipboard-extension-421's retained CDP reconnect; the canonical Chrome workflow passed on the same source. No Chrome deadline or acceptance was relaxed.

The circular updater's actual OS screenshots were not reached before these failures. No native visual pass for the new dialog is claimed. The next source must include these fixes and pass all required platforms before exact candidate pins or publication triggers can be supplied.


## Native follow-up on 3b9557f — supported displays, real Return and favicon continuity

The fresh main `d95fe778ac369d5baa586532c0cc45368c5a6c9d` had advanced with the owner's website changes. The first follow-up `5ce8a3f1` had no Actions runs because PR193 was conflicted. Both roadmap versions were verified as exact appends to their common base; the incoming suffix was retained alongside the complete candidate history. All other incoming website paths were retained as exact existing Git blobs. The merged candidate `3b9557f71f7a30bf3e62227a170bb924b675fdc2` preserves that main ancestry and identical desktop bytes from `5ce8a3f1`.

### Observed installed results

- [macOS run44978466405](https://github.com/jeep-jim/OSMINOG/actions/runs/44978466405), job137073525280: units and DMG/ZIP build passed. The new native display helper actually compiled and selected an advertised **1600×900** mode at scale1; a different process verified that it persisted. Full native media controls passed. The AI address received trusted CGEvent Enter, including keydown, keypress, exactly one submit and keyup, and the same native preview opened `/page/4/`. The next favicon wait failed: the original cyan20×20 icon had passed, but the navigated page showed the globe. Evidence [artifact14736737831](https://github.com/jeep-jim/OSMINOG/actions/runs/44978466405/artifacts/14736737831), ZIP SHA-256 `7a4674bab83ead48f20dfba9fa8af70b428108bae47e67fc3a2b21a9f8b3e946`.
- [Linux run44978466437](https://github.com/jeep-jim/OSMINOG/actions/runs/44978466437), job137073525760: contracts/build and the real 636 upgrade/update-button sub-gates passed. XTest Return produced the same trusted ordered submit trace and the real page4 in the retained WebContents. It stopped at the same post-navigation favicon wait. Evidence [artifact14737112110](https://github.com/jeep-jim/OSMINOG/actions/runs/44978466437/artifacts/14737112110), ZIP SHA-256 `468d9e49a1bfafda90fb255f95dace56fa7ee6c2a283b44a8761ba4267a2a316`.
- [Windows run44978466414](https://github.com/jeep-jim/OSMINOG/actions/runs/44978466414), job137073525935: units and NSIS build passed. User32 selected an advertised **1440×900** mode, work area1440×860, scale1; a distinct process verified persistence. Later, the immutable published **6.0.29** smoke process failed while preparing the incoming desktop snapshot, before 637 feature acceptance. It exited code1 after141718ms with “Не удалось подготовить изображение выбранного стола.” The old artifact lacks the rejected incoming packet/guard detail; neither a deterministic cause nor causation by the display change is established. Modern job137075784147 was skipped. Evidence [artifact14736907748](https://github.com/jeep-jim/OSMINOG/actions/runs/44978466414/artifacts/14736907748), ZIP SHA-256 `d41eced7768b9649ca4ffe810eaec9aca42adb774f5cfbadf96f013b7629b9d8`.

Both Chrome workflows passed on `3b9557f`, including [diagnostics44978466417](https://github.com/jeep-jim/OSMINOG/actions/runs/44978466417) and [canonical44978466504](https://github.com/jeep-jim/OSMINOG/actions/runs/44978466504). This does not replace the failed desktop acceptance above.

### Confirmed favicon mechanism and correction

The pinned Electron44.5.0 implementation [DidUpdateFaviconURL](https://github.com/electron/electron/blob/v44.5.0/shell/browser/api/electron_api_web_contents.cc#L2681-L2697) keeps the previous favicon URL set in its WebContents and suppresses an identical set. The browser's unconditional `t.favicon=''` in `did-navigate` therefore discarded a still-current value without a guaranteed replacement event. Moving the reset to navigation start would retain the same incompatibility.

The narrow production correction removes that unconditional reset. Actual `page-favicon-updated` events remain authoritative: a changed URL replaces the metadata and an explicit empty set clears it. No page scraping, additional requests, permissions or renderer caches are added. Tests cover unchanged URL sets across same-origin and legitimate shared-icon cross-origin navigations, changed/empty sets before and after commit, and existing failed-navigation behavior. The new tests reproduce two failures with the pre-fix source and pass with the correction. The old failed native runs did not record favicon event ordering; no ordering claim is made for them.

The existing native AI scenario now records navigation/favicon event breadcrumbs and the final renderer/native readback if its favicon wait fails. It keeps the same owned image URL, exact20×20 PNG/pixels, native owner, timeout, capture count and required submit assertions. Diagnostics are detached in finally and do not change production events.

Local combined browser-state, metadata performance, AI proof and AI controls suites: **47/47 PASS**, zero skipped, exact Node22.23.5. The independently run17 browser-state and13 AI helper tests overlap this47 and are not summed. Publisher preparation remains `c27788bc43feaff69962596d8b00e7c90b8e85e7`: all five registry/contract runs passed; publish jobs were skipped, pins stay unready.

A new native candidate is still required. The Windows legacy snapshot gate will run again with the same immutable629 bytes and the same supported-display setup; no speculative relaxation or old-package modification is justified by its current evidence. No native circular-updater PNG has yet been reached. The complete38-frame feature ledger and all real update/profile/performance requirements remain mandatory. None of these failed candidates is a published6.0.37 release; channels remain6.0.36.


## Native follow-up on 059d4834 — observed favicon repair and isolated verification failures

The three native runs on `059d48349dfe7c85798a8aac6eb9b94d8a82275d` all completed with failure. Their successful sub-gates below do not accept the complete candidate or authorize publication. The existing public feeds still identify6.0.36.

### Linux: actual navigation and presets pass; internal start-page fixture corrected

[Linux run44979648144](https://github.com/jeep-jim/OSMINOG/actions/runs/44979648144), job137077126370, confirms the full AI preview scenario: trusted OS Return, navigation to the owned `/page/4/`, the exact20×20 favicon, four resize cases and both chooser/header-drag transfers. The new actual event trace contains `did-start-navigation` and `did-navigate` without a second `page-favicon-updated`; the same icon remains visible. This directly confirms that the retained favicon is needed for Electron's identical-set suppression. Populated presets also pass:7 applications and27 fixture requests, with original tabs/workspace restored.

The next sidebar check failed when it called `browser.get(opened.id)` for `mouse://start`. The production start service owns these internal tabs in a separate Map; they have no native WebContents. The fixture now verifies the real `internal:true` record and absence from native `browser.tabs`, keeps its ID outside native fixture cleanup, and closes only that owned internal ID through the existing renderer command on every outcome. The new regression exercises the actual `mouse-start.install` service and a controlled later failure; it preserves unrelated internal/native owners and the persisted start store. Sidebar/start tests pass8/8 with Node22.23.5. Native input, pixel expectations, timeouts and the38/36/2 frame ledger are unchanged.

Evidence [artifact14737845349](https://github.com/jeep-jim/OSMINOG/actions/runs/44979648144/artifacts/14737845349), ZIP SHA-256 `0b4c8358bc1cce8aaf1f4d5a5bf7269f4c40ba3fc29351cabc74a35bcb14e9ef`, contains17 regular feature frames plus the failure frame. Sidebar/library/appearance/updater acceptance was not reached. Visual inspection of its real `mouse-637-localhost-dark.png` additionally identified nearly invisible Open-button text: the generic dark button background overrode the dedicated landing's accent background. The narrow scoped CSS correction preserves the intended accent Open button and transparent settings link without changing their behavior or theme palette.

### macOS: strict median comparison failed; threshold and workload retained

[Mac run44979648133](https://github.com/jeep-jim/OSMINOG/actions/runs/44979648133), job137077125928, failed the retained performance gate before637 feature acceptance. For50 pages, the published636 median was46.389292ms and the candidate median76.731666ms, above the fixed predecessor-plus-one-frame limit63.055959ms by13.675707ms. Candidate p95=98.588875ms and maximum118.871291ms satisfy their separate limits but do not override the failed median. The20-page comparison passed (baseline61.480000ms, candidate54.761833ms, limit78.146667ms).

The preceding3b9557f Mac run used the same published636 bytes and unchanged workload/comparator, actual1600×900 display, scale1 and1200×794 window. Its50-page baseline/candidate medians were112.453750/40.899583ms. This variation in the unchanged predecessor demonstrates run-to-run timing variation; it does not establish that the new failure is harmless or exclude a regression. No production performance code, timing threshold, workload or warm-up rule is changed. The next necessary candidate repeats the complete existing gate. Evidence [artifact14737154165](https://github.com/jeep-jim/OSMINOG/actions/runs/44979648133/artifacts/14737154165), ZIP SHA-256 `7d56e2c5f81624476f3769528cb25e807da675edf8516278a6f052748a018f45`.

### Windows: controlled ordering experiment for the immutable629 upgrade

[Windows run44979648150](https://github.com/jeep-jim/OSMINOG/actions/runs/44979648150), job137077126223, again passed real display preparation/persistence at1440×900, the636 baseline and the actual636 update-button path. Its immutable published629 write process then failed after125417ms with the same incoming desktop-snapshot error; the modern job137079060360 was skipped. Nine earlier legacy checks passed, but no desktop transition was recorded. The old process exited code1 rather than exhausting its1500-second budget. Evidence [artifact14736683629](https://github.com/jeep-jim/OSMINOG/actions/runs/44979648150/artifacts/14736683629), ZIP SHA-256 `259adc710a71a0843d469565bef7ab5ca9dbe0cc23698fabc1e5e5d39f2794ae`.

The earlier897fc949 run completed all13 legacy629 write checks with the runner's original1024×768 display; both later failures followed supported1440×900 preparation. This is correlation, not a proven internal629 failure predicate. The exact published source `164462db8d81f614cce9c9a8ab5d1fed0e2b7381` has no enabled diagnostics or supported CLI switch that would recover the missing rejected surface packet in this path. The published629 package must remain unchanged.

The next verification sequence therefore finishes the complete unchanged629 write → actual NSIS637 replacement →637 read comparison first, in the runner's incoming display mode. It then invokes the unchanged supported-mode PowerShell helper in two distinct processes, records real process/log/report receipts, and runs the published636 baseline and every current637 workload on that same independently verified expanded display. Both source Windows jobs and the publisher use this single exact-source sequence. Existing workflow step identities, overall budgets, native scenario deadlines and all legacy/profile/update/performance predicates remain intact. This controlled experiment still needs a successful native run; the ordering change alone is not a pass.

Incoming website main `2b7fb649e273c70a07698f444e541fba34f015c7` was merged without conflicts, retaining all of its website and append-only roadmap history. This browser work does not alter the website's recorded administrative activation requirement. No6.0.37 package or circular-updater OS screenshot has yet been accepted or published.

The final source follow-up run passes47/47 sidebar/start/local tests with zero skips on Node22.23.5. The Windows verifier Python suite runs11 tests:10 pass and the existing Windows-only native case is skipped on this Linux host. New cases exercise early failure propagation, the complete legacy-before-display order and two actual-process receipt bindings. Independent source review confirms byte-identical legacy upgrade/native-input functions, unchanged numeric scenario budgets and unchanged13/8 Windows workflow step identities. The six incoming website files match main's exact blobs, and the roadmap is the exact previous candidate text followed by main's appended suffix. These local/static checks do not replace native acceptance.


## Native follow-up on c068062e — library drag controller and passive timing diagnostics

[Linux run44981450805](https://github.com/jeep-jim/OSMINOG/actions/runs/44981450805), job137082618878, passed the corrected internal start-page/sidebar scenario in both themes, native click-through, all four library list/grid frames, and an actual native context-menu Preview action. The recorded menu opened at03:44:57.063UTC and closed at03:44:57.271UTC; the preview action completed before the later file drag. The artifact contains30 feature captures with all recorded pixel probes accepted. The scoped dark Localhost button correction is visible in its actual OS frame.

The following file-drag scenario stalled: the last saved library frame precedes X11 file-transfer atom messages at03:44:59.159UTC, with no further feature report before the existing270-second process limit. The old driver sent mouse-down, native drag activation, movement and mouse-up from the application's own JavaScript loop. Electron's native drag can enter a nested OS tracking loop, so an independent input process is necessary to continue and release the real gesture. The existing627 Mac window-drag fixture already uses this pattern. The failed artifact does not contain a native stack trace; the nested-loop explanation is grounded in the native source path and the observed file-transfer boundary, not a captured stack. Evidence [artifact14738157966](https://github.com/jeep-jim/OSMINOG/actions/runs/44981450805/artifacts/14738157966), ZIP SHA-256 `809e00c3c092278de4dbe5c72a8a96e6bb4dd4ead34c08c016f76a676e5c0065`. The circular updater was not reached.

The pinned source chain is [Electron44.5.0 WebContents::StartDrag](https://github.com/electron/electron/blob/v44.5.0/shell/browser/api/electron_api_web_contents.cc#L4179-L4208), [DragFileItems/StartDragAndDrop](https://github.com/electron/electron/blob/v44.5.0/shell/browser/ui/drag_util_views.cc#L22-L48), and its exact Chromium152.0.7977.130 [X11Window::StartDrag](https://github.com/chromium/chromium/blob/152.0.7977.130/ui/ozone/platform/x11/x11_window.cc#L1630-L1662) entering [X11WholeScreenMoveLoop's nested RunLoop](https://github.com/chromium/chromium/blob/152.0.7977.130/ui/base/x/x11_whole_screen_move_loop.cc#L154-L207).

[Mac run44981450814](https://github.com/jeep-jim/OSMINOG/actions/runs/44981450814), job137082618596, failed the unchanged20-page median gate: published636=49.189833ms, candidate637=71.295666ms, permitted maximum65.856500ms. The50-page median comparison passed at50.055041/55.426375ms, limit66.721708ms. Actual display1600×900, work area1600×802, scale1 and window1200×794 at(4,29) match both preceding Mac runs. The retained predecessor bytes, workload and comparator are also identical. Raw phase timings show a longer candidate layout wait but do not identify CPU self-time or a specific production hotspot. Evidence [artifact14738270829](https://github.com/jeep-jim/OSMINOG/actions/runs/44981450814/artifacts/14738270829), ZIP SHA-256 `2614efc671adac2d4e235ca5eae074a60425e9a22a3cde308c39ef1a74b1957a`.

The next necessary candidate adds optional in-memory timing records only around the already measured desktop switch: synchronous outer layout, native corner updates and existing view visibility/bounds calls. Each span records its parent so nested wall times are not double-counted. It preserves receivers, arguments, return values and thrown errors, and performs no extra file writes or captures inside the measured interval. Existing workload, warm-up, thresholds, deadlines and acceptance remain unchanged. A timing record is diagnostic evidence, not a relaxed performance pass.

During this follow-up state check, both PRs remained unmerged drafts, main had not advanced beyond2b7fb649, and all three public feeds still reported6.0.36. Windows run44981450809 was still executing its installed acceptance; no Windows result is inferred from that in-progress status. Publisher candidate d583fa5a passed all five registry/contract workflows with actual publication jobs skipped. Final native results and implementation validation will be appended before the next source push.

### Windows terminal result: legacy ordering passes; later library timeout

[Windows run44981450809](https://github.com/jeep-jim/OSMINOG/actions/runs/44981450809), primary job137082618676, subsequently failed its installed acceptance; modern job137086908913 was skipped. Completed logs confirm the full unchanged629→637 profile migration passed at03:44:53UTC, followed by actual display preparation/persistence in distinct PowerShell processes956 and3032 at03:44:57/58UTC. The published636 baseline, real636 update-button path, fresh636→637 profile upgrade and strict current performance comparison also passed. This confirms the new sequence actually executed; it does not prove why the earlier immutable629 snapshot had failed.

The later637 feature-write process6520 exceeded its unchanged270-second limit at03:56:21UTC in `native-library-file-actions`. AI, populated presets and sidebar focus all have `ok:true`. As on Linux, the final saved frame is `mouse-637-library-captures-grid-dark.png`, after all four light/dark list/grid samples and a native Preview menu selected with User32 Home/Enter. The menu records both open/close events and `previewSelected:true`. No later text-preview or transfer checkpoint was saved, so the report alone does not identify an exact blocking instruction. The matching saved boundary supports testing the independent native drag controller on both platforms; the next installed run remains decisive.

Evidence [artifact14738163961](https://github.com/jeep-jim/OSMINOG/actions/runs/44981450809/artifacts/14738163961), ZIP size59,771,401bytes, SHA-256 `1c391a23db980fb9d9427e2eb221dfbe43e8dab75c66179a61bb39308b5d88e8`. The independent publisher display checker accepts the completed legacy/hash/PID/PowerShell chronology, then correctly rejects the missing completed637 feature-write receipt. Separate unchanged geometry predicates pass on the actual baseline/current reports and PNGs: display id3598539180, bounds1440×900, work area1440×860, scale1, both physical full-screen images1440×900. The full independent performance validator passes on the actual raw samples. No missing process receipt or successful feature state was synthesized.

### Independent native gesture implementation and final local checks

The new CI-only `mouse-637-native-drag.cjs` launches the same installed Electron executable with `ELECTRON_RUN_AS_NODE=1` and the existing feature-smoke flag in real OS argv, matching the retained627 pattern. It preserves the Mac addon's existing guard and unpacked native module path. Electron44.5.0's [Node initialization](https://github.com/electron/electron/blob/v44.5.0/lib/node/init.ts) supplies ASAR filesystem support for the packaged CJS entry; no fuse, production permission or packaging exclusion is changed. The child uses the unchanged CGEvent/XTest/User32 drivers. Windows coordinates are converted once by the real parent `screen.dipToScreenPoint` before launch.

The entire down/drag/movement/up sequence runs in that child. The existing actual `startDrag` observer atomically writes an owned-profile handshake with a unique nonce, both PIDs and the exact file name/size/SHA-256 before entering the original native call. The child waits for that handoff, then completes13 native phases and attempts mouse-up in `finally`, including timeout and driver-error paths. A successful gesture still must finish within10seconds. The53-second parent fallback covers startup/close stalls and leaves time for an in-flight Linux phase and final release: each can use three unchanged7-second subprocess limits. This fallback is failure cleanup, not a longer accepted gesture or an increase to the270-second feature budget. Failure receipts retain actual exit details and never become successful evidence.

The publisher independently binds every gesture's child, nonce, file, clocks, accepted sequence and logical/physical coordinate samples. Existing trusted dragstart/dragover/drop, received file bytes/MIME/name, unchanged clipboard, live page identity, three actual transfers and38/36/2 frame requirements remain intact. Its only changes are the library validator, its targeted contract tests and that validator's schema dependency hash; frozen predecessors and all unready pins remain untouched.

The final combined source run passes **43/43 tests, zero skipped**, on exact Node22.23.5: passive stress instrumentation, strict637 performance, child input, existing library proof and production file-action contracts. The independent-process regression actually launches a second Node process and blocks the parent event loop until the child completes; its OS driver is explicitly mocked, so it proves process independence, not a native drop. Real-filesystem tests use the host's actual path convention; the mocked Windows coordinate case exercises a non-identity conversion. Root also reran the publisher's **86/86 tests**, all three templates and all three `publish=false` plans. Native success, the actual circular-updater frames and release readiness still require the next complete platform runs.

Immediately before the next push, website main advanced to `fb5d65f5868196493891dbac308b39158e34e20d`. Its13 incoming paths contain website/SEO work only, with no desktop source, release verifier or instruction-file change. The merge completed without conflicts. All12 non-roadmap paths, including the binary social card, match main's exact blobs; the roadmap is the exact previous candidate bytes plus main's verified appended suffix. These unrelated changes are preserved without modifying their implementation or claiming a website deployment.


## Follow-up after 90d27cd9 — three native failures (22 November 2026)

All three installed acceptance jobs on exact source `90d27cd9b17a0e2836f623c8bf8848a0b097ec73` completed with failure. These are **not** acceptable6.0.37 candidates and neither publisher pin nor public channel is ready.

- Mac [run44983577906](https://github.com/jeep-jim/OSMINOG/actions/runs/44983577906), job137089159050: the retained compact-footer smoke failed on three zero-size buttons from the **intentionally hidden** media widget nested under `#statusbar`; all actual visible footer controls had valid positions. Artifact14738793643 ZIP SHA256 `ebc81f052e566e5d809783d2c31c1bc000c803a0d00867db992e0b350e62c789`. The verifier now separately demands exactly three descendant controls in the hidden widget, with zero hit area, and excludes only those from the visible-footer bounds assertion. It preserves every visible-control geometry and click requirement.
- Windows [run44983577908](https://github.com/jeep-jim/OSMINOG/actions/runs/44983577908), primary job137089159437; modern dependent job skipped. The real completed1MiB download had correct bytes, a visible completed item, title/accessible filename and the expected feedback pill, but the retained Mouse630 verifier still expected visible filename *text* on the direct-open tile newly designed to show only the icon. Artifact14738568780 ZIP SHA256 `87a35b1ae521763a602a7c801e3085b3a4550e3e952a37d648d0b03718a2d3d3`. The verifier now requires the exact ID, completed content-only row, direct-open button and matching title/ARIA filename, without reverting product design. The actual download/file-state assertions remain unchanged.
- Linux [run44983577958](https://github.com/jeep-jim/OSMINOG/actions/runs/44983577958), job137089159455: the independent native XTest child really completed13 accepted mouse phases with distinct childPID10909, a matched nonce/file digest and unconditional mouse-up in620ms, but the target WebContents never reported a trusted `drop` before the existing receiver wait expired. The owned receiver was visibly exposed at the recorded native destination; an accepted OS drop is **not** established. Artifact14738817104 ZIP SHA256 `14f84081959868e54738d1ce317686a01d6bb9b28d4311cb03558ea669ef4bd2`. The next diagnostic follow-up gives X11's asynchronous destination negotiation an additional400ms before the same UP phase, still within the unchanged10s gesture limit, with no change to recipient, accepted event predicates, phase count or publisher verification. A future full real native pass is required; this is not evidence of a fixed drag.

The Mac native circular-updater presentation and the full38-frame ledger were not reached on these runs. No merge/publish action is authorized by these failures. Re-run all three platforms on one new exact source after the focused corrections, require Windows modern on that same attempt, and keep the independent publisher evidence gate strict.


### Correction to the parallel checkpoint above

The preceding parallel note incorrectly says the Mac90d circular presentation and38-frame ledger were not reached. The actual raw Mac artifact and independent e318 validator prove they completed; the detailed verified record follows. This correction preserves the earlier note as history rather than silently replacing it. The parallel520ms Linux proposal is superseded by the source-grounded700ms input dwell described below.


## Native follow-up on90d27cd9 — circular UI and actual Mac file transfers accepted

Source candidate `90d27cd9b17a0e2836f623c8bf8848a0b097ec73` contains the exact verified tree `4b7fecf294374f35dd8a35287a0bf86867ce93f4`. Publisher preparation `e318e80ed1840bd860e03b4d4beb5d3373d2dbaf` passed all five contract/registry workflows; its three publication jobs were skipped. The following successful sub-gates do not accept the complete failed source runs or publish6.0.37.

### Mac: all38 feature frames pass; later compact-footer check fails

[Mac run44983577906](https://github.com/jeep-jim/OSMINOG/actions/runs/44983577906), job137089159050, passed both actual637 feature processes: writePID32875 and restartPID33969. The exact `mouse637-features-evidence.py` from publisher e318 independently accepted all38 native captures, raw full-display pixels, AI/presets/sidebar/library/appearance/circular update states and restart preservation. All three library files reached their intended live pages as trusted native Files drops with exact bytes, MIME, name, unchanged clipboard and preserved page identity. The first CGEvent gesture used childPID33712,13 accepted phases and559ms, with four trusted dragovers followed by a trusted drop.

The strict independent performance gate also passed unchanged:20-page baseline/current medians89.429875/62.863959ms, limit106.096542ms;50-page47.102083/55.803834ms, limit63.768750ms. The new passive diagnostics report synchronous main-call wall spans; they do not measure CPU self-time or retrospectively establish the cause of prior failures. No production performance change or threshold relaxation was made.

Both actual circle PNGs were opened and visually reviewed. The original180px mouse logo is centered inside the600px circular dialog; annular actions and curved labels are readable, round close/minimize controls are on the upper right, and the surrounding workspace is strongly dimmed in both themes. Light available-state PNG SHA-256 `26779c12dda16b1d4d8c40fb0da69451f9d5b8aa42812d9d7c9baec9ed4519e9`; dark ready-state PNG SHA-256 `b9e6af56aba2759b9271d8fec945a60940baa9312229ff8770adbbe1c0df895d`. These controlled presentation states are not public-channel or installation evidence.

The later retained `mouse-compact-smoke.cjs` failed “Unified footer remains accessible.” Its report contains17 real visible controls with `hit:true`, no overlaps, and three additional anonymous zero-size buttons. DOM order maps these exactly to the media widget's toggle/return/dismiss descendants. The old readback records only each button's own `hidden` attribute and cannot observe its container's hidden state. The next narrow fixture correction records that ancestor and only excludes the exact inactive trio when hidden/mode/display/zero-area/not-hit predicates are actually satisfied. Ordinary and active controls retain their existing checks; generic zero-size filtering is not permitted.

Evidence [artifact14738793643](https://github.com/jeep-jim/OSMINOG/actions/runs/44983577906/artifacts/14738793643),44,771,239bytes, ZIP SHA-256 `ebc81f052e566e5d809783d2c31c1bc000c803a0d00867db992e0b350e62c789`. The full workflow remains failed, and its final candidate package artifact was not uploaded.

### Linux: independent child completes; target drop still fails

[Linux run44983577958](https://github.com/jeep-jim/OSMINOG/actions/runs/44983577958), job137089159455, now exits with the specific failed predicate “OS file drop reached the intended live page” instead of hanging until270seconds. For the first archive-image transfer, independent XTest child10909 (parent9862) completed all13 accepted phases in620ms, exited0 and released the pointer. Its nonce/native-file handshake matched the actual PNG. The intended target lies inside the actual receiver rectangle. The saved artifact has31 frames including the post-cleanup failure frame; appearance and the circular updater were not reached. The independent raw performance gate passes, but the complete Linux run fails.

The existing receiver records successful drops and target dragovers only after the acceptance wait. This failed artifact therefore cannot distinguish missing drag routing, wrong target, delayed operation negotiation or an asynchronous file-read error. The next fixture records bounded passive source and both-page event diagnostics before cleanup, preserving the original error and actual identities.

The sole in-target movement was followed by mouse-up149ms later. Pinned Chromium152.0.7977.130 [OnDragUpdated](https://github.com/chromium/chromium/blob/152.0.7977.130/content/browser/web_contents/web_contents_view_aura.cc#L1621-L1650) initially returns the previous drag operation while the renderer updates it asynchronously; [X11 position repetition](https://github.com/chromium/chromium/blob/152.0.7977.130/ui/base/x/x11_drag_drop_client.cc#L713-L731) uses350ms, and [release handling](https://github.com/chromium/chromium/blob/152.0.7977.130/ui/base/x/x11_drag_drop_client.cc#L572-L613) cancels an unnegotiated operation. This supports a bounded Linux-only destination settle of two350ms intervals, while Mac/Windows keep120ms. It is a protocol-grounded input correction to test, not an observed proof of the earlier failure's cause. The actual trusted full-file drop remains decisive;13 input phases,10-second accepted gesture and270-second outer deadline remain unchanged.

Evidence [artifact14738817104](https://github.com/jeep-jim/OSMINOG/actions/runs/44983577958/artifacts/14738817104),35,636,813bytes, ZIP SHA-256 `14f84081959868e54738d1ce317686a01d6bb9b28d4311cb03558ea669ef4bd2`. Windows90d acceptance is still running at this point; its eventual result and final next-candidate validation will be appended below.

### Windows terminal result: native feature markers pass; raw report overwritten and retained library predicate fails

[Windows run44983577908](https://github.com/jeep-jim/OSMINOG/actions/runs/44983577908), primary job137089159437, subsequently failed; modern job137093194263 was skipped. The installed log records the feature-write pass at04:22:11UTC and the restarted native feature pass at04:22:18UTC. The original write JSON and all38 expected PNG files exist. However, the outer verifier's `save()` closure used the variable `report`, which the later feature loop reassigned to `mouse-637-features.json`. Its final save overwrote that completed feature JSON with the wrapper report and left the canonical wrapper file incomplete. Independent complete feature/report verification therefore correctly fails; the missing restart JSON must not be reconstructed from logs or screenshots.

The narrow writer correction gives the outer report path its own `wrapper_report` variable. Its regression runs the real verifier main routine with controlled native subprocess results, writes both actual raw feature files, triggers a later retained-smoke failure, and checks that the final wrapper save preserves both files byte-for-byte and both recorded hashes. Root independently ran12 Python cases:11 pass and the existing Windows-only native case is skipped on this Linux host. No native order, numeric budget, acceptance predicate or production interface changes in this correction.

The later retained630 scenario actually downloaded1,048,576bytes; actual and expected SHA-256 both equal `9110073e562ad3c7bba0f03d7ec3881bd05cb4e13bb7fab6a63e704f3c80e08c`. It failed while looking for `.library-name` or the filename in visible row text. The current content-only file action intentionally shows its icon and `BIN`, with the exact filename retained in `aria-label` and `title`. The corrected fixture waits for the actual downloads section, the exact native DownloadItem ID, an enabled `BUTTON.library-file-open`, both exact accessible-name fields and a positive exposed native hit target. It additionally binds the returned ID and name to the actual DownloadItem. The real shipped `browsing.js` DOM test reproduces the old text mismatch, verifies the actual open command and rejects11 wrong/hidden/disabled/covered states. Existing byte/hash checks, report630 structure and360×25ms waiting budget remain unchanged.

Offline checks with the exact publisher e318 snapshot accept the raw performance comparison:20-page candidate/baseline medians60.3810/49.5303ms and50-page59.7085/53.7710ms. The actual preserved wrapper bytes, although saved at the wrong path, show the required complete629→display preparation→independent display verification→636 baseline sequence, with1440×900 display,1440×860 work area and scale1 in both performance reports. This isolated chronology check does not accept the broken canonical report paths.

All three saved write-phase native transfers contain exact received image/text/download bytes (309/116/309), matching names/MIME/hashes and trusted drops. The circular-updater sub-validator and independent OS pixel probes also accept both themes from the write report. A separate full gesture predicate rejects the first transfer because the parent's wall-clock handshake timestamp is3ms later than the child's observed-read timestamp (`1795321309687` versus `1795321309684`), despite matching nonce, PIDs and file. That observed inversion alone does not establish a particular clock implementation or system-clock cause. The next correction must preserve those raw clock observations, use separate per-process monotonic elapsed clocks for input order/dwell/budgets, and bind causal handoff to the exact bytes the child actually read from the atomic parent handshake. It must not fabricate timestamps or allow a longer successful gesture.

Evidence [artifact14738568780](https://github.com/jeep-jim/OSMINOG/actions/runs/44983577908/artifacts/14738568780),69,203,503bytes, ZIP SHA-256 `87a35b1ae521763a602a7c801e3085b3a4550e3e952a37d648d0b03718a2d3d3`. The final candidate package artifact was not uploaded after the failed job. All three complete90d native runs are failed; none is an accepted or published6.0.37 release.

### Verified follow-up before the next native candidate

The retained basic-download scenario, which follows the compact-footer scenario on Mac, contained the same obsolete visible-filename assertion for `mouse-fixture.bin`. It was reproduced against the actual shipped `browsing.js`, then replaced with the same exact-ID/accessibility/hit-target helper used by630. The actual completed native item's ID and expected filename remain required;262,144-byte download, pause/resume and preservation of the file after removing its library entry remain unchanged. A targeted scan of the remaining retained checks found no other concrete content-only filename or inactive-media mismatch.

The native gesture now records separate `process.hrtime.bigint` elapsed timelines for parent and child. Exact decimal nanoseconds avoid rounding; each child's13 accepted phases and observed handshake read are ordered only inside that child's timeline. The parent independently measures preparation plus fork-to-actual-close and requires the same existing maximum10-second successful budget; the child retains its own maximum10-second budget. Platform destination dwell is independently measured between final move and release (Linux700ms, Mac/Windows120ms). Existing raw `Date.now` fields and their wall-derived `elapsedMs` remain unmodified diagnostic observations; neither wall-clock nor monotonic origins are compared across processes.

The atomically written parent handshake includes its actual parent elapsed value. The child reports the exact bytes it read, byte length, SHA-256, base64 and actual child PID. The source parent compares that receipt with its own actual issued Buffer. The publisher independently decodes bounded bytes, rejects duplicate JSON fields and checks exact schema/nonce/both PIDs/parent timestamp/parent elapsed/native file identity. The child observation must fall between drag-threshold motion and the first subsequent path motion. Negative cases reject substituted/malformed/oversized read data, wrong owners/files, bad chronology, incomplete13-phase input and exceeded budgets. The original3ms cross-process inversion and a wall-clock step remain visible in passing clock-model tests; no timestamp clamp or arbitrary tolerance is used.

Root reran the final combined source suite on exact Node22.23.5: **58/58 PASS, zero skipped** (native gesture/library proof, production file actions, compact footer, retained download readiness and actual library UI). The real separate-child regression also completes while the parent JavaScript loop is blocked; its OS driver is explicitly mocked, so this is process/contract proof rather than native acceptance. Root separately reran the Windows verifier's12 tests (11 pass, one existing Windows-only case skipped). The publisher's complete637 suite passes **92/92, zero skipped**; all three platform templates validate and all three publication plans remain `publish=false`. Its library validator SHA-256 is `fcd19b52eae1551569a56506ab1cb7df960d51b2ff97fc1f9e1651f6037a398d`, recorded in the evidence schema. Frozen predecessor dependencies, unready pins and published packages remain unchanged.

Immediately before this candidate, incoming main advanced to `6e5cd31131e900f723e5315928fbabed27ca6620`, containing only two website/roadmap appended notes. The merge completed without conflicts. The website journal matches main byte-for-byte, and the roadmap is exactly the previous candidate's content followed by main's verified appended suffix. No website implementation or deployment action was performed. A fresh read of all three public feeds still returned6.0.36. Complete native platform checks and actual package evidence are still required before accepting or publishing6.0.37.

A final cross-language contract check passed with the unmodified source launcher, a real separate Node child, actual atomic parent-file write, actual child `fs.readFileSync` and real process-local monotonic clocks. The resulting receipt was accepted unchanged by the final Python publisher gesture validator:13 phases,302 actual handshake bytes, parent preparation1.971818ms plus fork-to-close1218.293046ms, child1115.544411ms. The OS input driver was explicitly mocked; this checks the new evidence contract and process/file behavior, not native acceptance or a user's device.


### Concurrent branch reconciliation

A lease-checked push detected concurrent commit `0194f1338e458a921b2b182bc0d33e45e293c7ab` on the source branch. Its four changed files were reviewed and merged, preserving both histories. The reviewed footer ancestor proof and process-local native timing/file-byte proof retain the parallel fixes' intent with stronger measured predicates. The parallel630 `library-content-only` row requirement is retained alongside the exact native ID, enabled accessible action and positive hit test. The existing automation was paused during reconciliation to avoid concurrent branch mutations; monitoring will resume against the final exact head. No force push or released-package rewrite is used.

After reconciliation, root repeated the combined58 source tests: **58/58 PASS, zero skipped**. The existing real library-UI test now rejects12 invalid states, including a missing `library-content-only` class. Publisher head `be7e20eb11cf391daac319d53112b4e906cb22d7` has the exact reviewed tree `edf0e19341151012db57cd79dc24856c42c24422`; all five registry/contract runs passed, with all three native publication jobs explicitly skipped while pins remain unready.


## Exact72c88f22 native results and follow-up — 22 November 2026

Source `72c88f22a41b033cddb5f46c1eafe52a08d8c501` has tree `98b6577bbb2b3a4b9139e2f12eeed2e2eec2b3ea`. All eight auxiliary workflows passed. This source is not accepted for publication: Linux passes, while Mac and Windows retain the concrete blockers below. Public package pins remain unready; no released package is replaced.

### Linux: full source and independent installed acceptance pass

[Run44986387277](https://github.com/jeep-jim/OSMINOG/actions/runs/44986387277), attempt1/job137097777429, completed successfully. The verification artifact14740467233 is40,800,288bytes, ZIP SHA256 `ca2c86eac27a49b6b6b1144c4c6fa4ed8c4f209e805eb3addc3e20b6604fd792`. The candidate artifact14740427350 is241,159,790bytes, ZIP SHA256 `096bf3e14a9606077004eed6d8d112acad6af87b0c643282fb214656c2ba47de`. Actual package bytes match the manifest, SHA256SUMS and installed raw evidence: AppImage135,767,778bytes/SHA256 `a7747afeb83fcbea313cec509582ebb85ba2dec3d2c6b264ae3806ee9d6713fa`; deb105,922,152bytes/SHA256 `2cd087901f83f806a604a3a2d28c57d7fe36ab9af36b67e398a6da97ee0fa40e`.

The first independent publisher check correctly rejected the retained635 library predicate expecting30×30 list thumbnails. Actual637 CSS and all14 captured rows reserve a108px-high content preview in a126px-high row: x=row.x+6, y=row.y+9, width=row.width−37 (12px padding+7px gap+18px selection column). All before/after row/image/checkbox differences and scroll differences are zero. Grid previews retain112px height. The scoped637 adapter changes only that exact size predicate; all original identity/order/delay/decode/stability predicates, actual OS pixels, private-file and collection checks are retained. Frozen635/636 validators and raw reports are untouched.

Publisher `3b4febdfd022fba9d38495e4e6b8d2720afd49a5`, tree `e9ef20556ef5a900d82438106fa35325c714a68a`, contains only the scoped adapter, five focused negative/positive tests and its two schema hash references. Adapter SHA256 `cf6f01542e2381300881018aa17208a9e0220b1138284d7172169fb139942da4`. Independent AST review found every other retained function predicate unchanged. The adapter author and root each ran the complete97/97 publisher tests, zero skipped; the independent peer review checked the unchanged predicates and actual scenes. Templates remain valid and plans remain publish=false.

One complete independent Linux sweep then passed in129.772seconds, binding all264 unchanged Python validator files to that exact publisher tree. It covers retained Linux/sandbox/profile/task/footer/owner/library/performance gates, actual636→637 AppImage/deb upgrade and update-button flows, actual packages and all38 current feature frames. All three real native Files drops passed with exact received bytes and monotonic/atomic-handshake proofs; last in-target MOVE→UP elapsed734.116/735.697/736.711ms. This accepts these exact Linux candidate bytes; it is not a public release or evidence that the owner's computer upgraded.

### Windows: current features pass; resting divider pixel check fails

[Run44986387212](https://github.com/jeep-jim/OSMINOG/actions/runs/44986387212), attempt1/primary job137097812146, failed on retained629 UI; dependent modern-input job137101066343 was skipped. Verification artifact14740626162 is74,358,919bytes, ZIP SHA256 `eb45a8b5447384a94b26a65fefcd50590e911813dd25a71c7f7c34cdd0b1953c`. The corrected wrapper preserves actual full feature READ/WRITE JSON: PID5692→8284,36+2 bound native frames, three trusted native file drops and the complete unchanged current637 feature gate pass independently. Current performance passes:20-page medians53.4150→45.9818ms;50-page51.1281→48.0855ms. The complete scoped library gate and the actual display-setup chronology also pass. No candidate EXE artifact was uploaded, so an expected installer hash is not substituted for actual package bytes.

All three failing dark divider samples are on x1031.3125 and have RGB130,155,193, exactly the production hover-guide colour#829bc1 rather than seam#354357. The prior native AI corner click is recorded at global(1037,793). After restoring the window to content origin(8,8), that point is(1029,785), inside the actual divider rectangle(x1028.3125,y46,width6,height764). The full native screenshot shows that single guide. The saved report lacks an explicit :hover readback, so the cursor explanation is supported by matching colour/geometry rather than represented as a captured hover event.

The narrow next fixture correction moves the actual OS pointer outside the fixture window before resting-pixel samples. It records before/after native cursor positions and all divider hover/focus/drag states, requires the actual cursor to reach the target and all dividers to be at rest, and retains every old pixel/geometry/palette predicate. It does not change product CSS or make the hover colour acceptable as a resting seam. Focused Node22.23.5 checks pass12/12, including wrong driver acknowledgement, stationary cursor, retained hover/focus/drag and fullscreen rejection. An initial broader19-case local invocation had18 passes and one unrelated Linux packaging failure because builder-util is absent in this checkout; the real Linux package gate above passed. Native validation of the pointer correction is still required.

### Mac: two preserved failures, no third blind retry

[Run44986387219](https://github.com/jeep-jim/OSMINOG/actions/runs/44986387219) attempt1/job137097777040 failed at the retained trusted guest download link before current performance/features. The page was loaded, native views were visible and the input driver acknowledged posting, but no trusted target click arrived within the existing10-second wait. Exact attempted coordinates and input dispatch are not recorded, so the failure's cause is not established. Artifact14739932958 is5,213,521bytes, ZIP SHA256 `62974e37bb3274cd745c5555ae8d3bfc339f31b59f1f269ea7191632682055f4`. The relevant source/driver/workflow files matched the earlier90d candidate that passed this scene.

One controlled repeat kept the exact source and every budget/input predicate unchanged. Attempt2/job137100355329 passed the retained link scene,633 owner and current task/stress/media/library/Agent/panes/search gates, then failed the strict20-page performance comparison: actual published636 median58.072166ms; candidate118.954000ms; unchanged one-frame allowance16.666667ms gives limit74.738833ms, exceeded by44.215167ms. Raw predecessor samples are[58.072166,73.186917,54.275959,57.387541,64.039958]; current samples[133.602167,118.954000,121.979083,80.583833,64.523833]. The50-page comparison would pass68.864916→45.871791ms. Artifact14740277460 is29,952,327bytes, ZIP SHA256 `5c43fdd98806146aa37377b7c9641a6944cdb17c4f6f3a2083e1a270d6d44de8`.

Both failures remain evidence. No third blind rerun is scheduled. The first three slow20-page switches spend substantially more time outside the measured synchronous main calls; those diagnostic wall spans do not establish CPU self-time or a production root cause. New38-frame/package acceptance was not reached on attempt2. Further instrumentation must preserve the exact workload, timing criteria and failure records.

### Owner-reported graphics problem in36: verify37 first

The owner reports severe incomplete drawing and screen jerking when returning to the ordinary view in6.0.36, and explicitly asks to test the new37 version first. The supplied still image shows a large empty dark rectangle over the start page while some tabs/icons remain visible; it cannot establish timing, cause or the exact transition. This report is retained separately from the CI divider and performance failures. No claim is made that37 fixes it, and no speculative production graphics patch is based on the screenshot alone. Check the same actual transition after the accepted37 installation before deciding on a38 fix.

The existing release monitor is read-only while the active root owns candidate mutations. It may check actual heads/attempts/jobs/feeds and report results, but must not concurrently commit, rerun, merge, change pins or publish. All native platforms must pass again on any new common source candidate before publication.


### Main preservation before the next common candidate

Fresh main `123b7d765b72f3e92e5b5dd8f674a6856d534728` adds the independently requested website Pages preparation. Its seven incoming paths contain no desktop or instruction-file changes. All six non-roadmap paths match main's exact blobs/deletion; `MOUSE_BROWSER_ROADMAP.md` is exactly the prior candidate bytes followed by main's verified appended suffix. The merge does not perform a website deploy. At05:15UTC all three public update feeds were read again and still identified6.0.36. Publisher3b4febdf passed all five registry/contract workflows; Mac44988078114, Windows44988078062 and Linux44988078017 each have a successful contract and explicitly skipped native publication job while their pins remain unready.


### Next common candidate: passive attribution and input receipts

The Mac investigation does not establish a production regression's cause. For the first three slow20-page switches, actual selection+layout phases total101.0/105.8/105.0ms versus35.6/52.1/42.9ms in636; the final double-rAF presentation tails are only11.0/4.4/7.7ms. The second switch overlaps a50ms renderer long task. Existing frame gaps lack timestamps, and main synchronous spans do not explain all waiting. `desktop-slide.js`, `receiveState` and `requestLayout` remain unchanged between36 and this candidate; new compact-pane observers or AI/media synchronization are not declared responsible without attribution.

The CI-only stress helper now timestamps existing `browser.state` calls, records the actual active desktop/requested panel IDs on existing layout spans, and adds interval start/end times to the existing rAF callback. Optional Long Animation Frames observation records only bounded plain timing/script fields and explicitly reports support/errors/truncation. It uses the renderer's own time origin, separately from main-process wall spans. [Chrome's primary API documentation](https://developer.chrome.com/docs/web-platform/long-animation-frames) explains that long animation frames cover updates beyond50ms and only scripts longer than5ms receive attribution; absence of a script entry is not proof of no renderer work. Original renderer samples, workload20/50, switch counts5/10, metadata/loop intervals, warmup, capture order, all waits and strict performance criteria are unchanged. No ordinary product source is changed.

Root review caught a diagnostic-payload limit risk before push. The final optional collector caps64 frames,8 scripts per frame and64 UTF-16 units per string, preserving the first frames plus the latest and explicit dropped counts. Truncated strings preserve head31+ellipsis+tail32 with the strategy recorded. A real serialized-helper regression covers two stages with4096 intervals each, finite long numeric values, exact64/128-unit NUL/lone-surrogate/CJK/emoji strings, maximum512-unit diagnostic error, actual pretty JSON/newline and2MiB legacy reserve. The largest checked envelope is6,117,541bytes, below the unchanged8,388,608-byte reader limit by2,271,067bytes. Independent in-memory additions to actual Mac/Linux/Windows72 reports are5,562,666/5,530,910/5,554,077bytes; original artifacts are untouched. Stress helper SHA256 `d3b4797b42d63c364462dcb01c6bad4316c91d5b3cbb64065f12b571a5655ebf`; focused test SHA256 `41c95aee884eff7af9a8b9eb5272c595fd797173d7324f6ceedd0f50fa8666fc`. Writer and independent reviewer ran24/24 stress/performance tests, zero skipped.

A separate CI-only retained guest-click helper records `guestClickAttempts` independently of successful `nativeInputs`. Before the sole native click it copies the actual point/hit/factor/count and raw page/native/window geometry, cursor and focus. Driver return and actual existing poll events remain in memory until normal later saves; no save/extra IPC/frame/wait is inserted between driver and the original wait. On failure it saves diagnostics before cleanup and rethrows the same original exception, even if diagnostic reads/save fail. The existing success receipt is produced only after the unchanged trusted-event predicate;10-second wait and240-second outer budget remain. Four focused regressions cover timeout evidence, one-post success, diagnostic failure preserving the original error and nonasserting raw mismatch readback. Packaging already includes the new helper and excludes its test. Helper SHA256 `5c0b59e294cf703ce03479d0453151fbc8b5b07caeffcd3b9e57ada2740b02c1`.

Root's final combined exact Node22.23.5 run passes53/53, zero skipped: pointer fixture, stress diagnostics, strict636/637 performance, guest-input diagnostics, retained routing and Windows driver contracts. These unit/contract results do not accept the next native candidate. Every platform must complete again, Windows modern input included, with independent actual package/artifact acceptance before release.

## 2026-11-22 — source859 native outcomes and next scoped fixture correction

The common source `859052cddf974b43eb614dabcb3bb44d2466ddef`, tree
`0c87eb334a75d1069bb0a8258b52250c89154e9d`, completed all eight auxiliary
workflows. Native outcomes below do not collectively accept this source.
Fresh reads of all three public feeds at05:47UTC still identify6.0.36.
Publisher `3b4febdfd022fba9d38495e4e6b8d2720afd49a5` remains unchanged;
all three pins are unready and no publication marker exists.

### Linux859: full native and independent package acceptance

[44989569360](https://github.com/jeep-jim/OSMINOG/actions/runs/44989569360),
attempt1/job137107463352, succeeded. Verification artifact14741127385 is
40,782,997 bytes, SHA-256
`43713c6e4f88ebc576b6dacb0236b477d0850735945bbb7bce4154f60d002849`.
Candidate artifact14741815583 is241,167,851 bytes, SHA-256
`3ce8ea63fe82fb7c90e43918419d3c5966aaa74d8beaa55282436c00dd72adbf`.
The actual AppImage is135,775,864 bytes/SHA-256
`61f83696dac6856d561467a23ab971c59d67493afdd6ebd354bf78e0db62f1aa`;
the deb is105,924,688 bytes/SHA-256
`bdc5e491e3477a840952f97ec153965719c16a378b91c08a86ccf3ebf1c2280f`.

One full independent `mouse637-linux-evidence.py.verify` sweep accepted those
bytes in162.154984 seconds using exact publisher3b/treee9ef2055. All264 Python
validator files were bound to Git blobs before and after. This includes retained
gates, strict current/predecessor performance, actual update-button/profile
replacements,38 feature frames and three trusted real file drops. New pointer
receipts show actual XTest parking at(2,2), all six dividers at rest in four
theme/size scenes, and seven successful retained guest-click attempts.
The circular-updater PNGs are actual presentation fixtures, not a claim of public
installer discovery or a physical owner-device upgrade.

### Mac859: strict performance failure retained, attribution still incomplete

[44989569356](https://github.com/jeep-jim/OSMINOG/actions/runs/44989569356),
attempt1/job137107463312, passed the previously failed trusted download click
and reached the strict desktop performance comparison. It failed20-page median:
baseline103.963833ms, candidate155.994583ms, unchanged allowance16.666667ms,
limit120.630500ms. The50-page comparison is within its original limits.
Verification artifact14741497388 is29,997,536 bytes, SHA-256
`dc1f5e0e205a54bf395c66a8efdb2ae4a75862d8abf39069f541e5ec90b215bb`.
Current38-frame/package acceptance was not reached.

All captured LoAF script arrays are empty despite successful supported
observation, so these data cannot identify a JavaScript cause or prove no
JavaScript work. The20-page switch2 outer190.604167ms includes an81.9ms slide;
the rest cannot be labelled product layout time. Existing main `browser.state`
calls take at most3.873292ms individually; one switch's `setVisible` total
53.799ms does not explain the other slow samples. No blind rerun or production
graphics/performance patch is inferred from these data.

A separate diagnostic branch, never a release candidate or merge target, is
`diagnostic/mouse-637-macos-performance-859052cd`. Its isolated unprofiled and
profiled installed631 workloads preserve the original scenarios and write
separate CPU profiles, clock brackets and existing-IPC markers. Main PR193 and
publisher pins are unaffected. Diagnostic source2f395619/run44991248791 failed
before app build because its unit test compared macOS temporary-path aliases;
Node23/23 passed, Python3/4 passed, and no CPU evidence was collected. The
canonical-path expectation and an explicit real-child symlink reproduction
passed4/4 locally. Source2a9857a5/run44991415819 has passed the native contracts
and packaged-app build and begun the isolated replay step; CPU evidence is not
yet confirmed. Its results are
diagnostic only and cannot replace original release acceptance.

### Windows859: resting-divider correction proved, private text expectation stale

[44989569319](https://github.com/jeep-jim/OSMINOG/actions/runs/44989569319),
attempt1/primary job137107463445, failed later at retained private isolation;
dependent modern-input job137111636412 was skipped. Verification
artifact14741588776 is81,633,440 bytes, SHA-256
`9d55224e824348428f38012baa395f20469f2998032a01ea92576bfdf2c2a365`.
No candidate EXE artifact exists, so complete package acceptance is not claimed.

The new629 receipt now directly records the previously inferred hover state:
dark initial cursor(1037,793), one hovered divider/active guide; after real User32
parking, cursor(2,2), all six dividers neither hovered, focused nor dragged,
and no guide pseudo-content. All four theme/size scenes passed their original
resting-pixel predicates. The independent current637 feature gate accepted all
38 native frames, three trusted file drops and actual WRITE5468/READ7596
processes. Display chronology and retained task/feedback/owner/library/strict
performance component gates passed independently. They do not waive the failed
private scenario, skipped modern job or absent package bytes.

The failure is precisely `mouse-611-smoke.cjs`: actual `.home-page` computed text
`rgb(212, 212, 212)` versus the old literal `rgb(245, 241, 255)`. The37 appearance
stylesheet intentionally binds dark primary text to the selected white tone;
default55 gives `round(160 + 95 * 55 / 100) = 212 = D4`. All earlier assertions
for mascot body, purple glasses, white glints, SVG/head assets, filter and private
background passed. The later private data/cleanup/normal-profile predicates
were not reached and remain mandatory in the next full native run.

The narrow current-source fixture correction adds actual version, tone and
computed `--text-primary` to the same existing DOM readback. Only exact6.0.37
requires integer tone0–100 and independently computes the expected hex/RGB.
The original light colour, both backgrounds, artwork pixels, tab identities,
light→dark→light sequence, frame waits,350ms delay, capture filenames and final
theme restoration are unchanged. Other versions retain the old expectation.
No production CSS, mascot, privacy storage or frozen publisher dependency changes.

Root's exact Node22.23.5 run passes21/21, zero skipped, including six meaningful
new tests that execute the retained fixture/readback against an owned unit
document: default/endpoints, rejection of old lavender in637, legacy636
expectation, invalid tone/variable/text and unchanged artwork/background guards.
Independent review found no blocker. Fixture SHA-256
`8405946a71648137741974a619a315c7f512901a90a010aa7b79dba75b91c716`;
new test SHA-256
`c6d09ed0c9aa6f06b596049971a72db02e9e7d6937c04dff153d316bf9ad2fcb`.
This is a fixture correction awaiting new native evidence, not a graphics fix.

### Mac CPU replay completed; no causal production patch established

The separate diagnostic [44991415819](https://github.com/jeep-jim/OSMINOG/actions/runs/44991415819),
attempt1/job137113079334 on source2a9857a5, completed. Artifact14741433673 is
10,179,751 bytes/SHA-256
`56a4f3937d7542983d6faf945de75f8e5e31bcb9acc49a90189dca42309cbb75`.
All123 inventoried files matched their size/hash receipts; separate processes
21988/23149 exited0 with all four original task/stress/media markers. The actual
CPU profiles and receipt are complete with no reported errors or marker drops:
main193,988 bytes/SHA-256
`30384847732d4806c0bb2656cf862b1d8992e01285338dcb383dc3871931aabe`,4008 samples;
renderer103,199 bytes/SHA-256
`a94bd8083848965bb3e0c76330fd8f75c677c98dc1b84bc2cb53d20764a7afda`,4081 samples.
There are90 main and60 renderer switch/IPC markers with separate clock domains.

Unprofiled20/50 medians are70.197583/74.869500ms; profiled medians are
80.852458/71.554458ms. Neither profiled stage contains a recorded renderer long
task. The historical859 median155.994583ms and first50-page368.705875ms outer
sample were not reproduced. These are separate diagnostic processes/runner,
with no paired published636 baseline, so none is a strict release-comparison
PASS or proof of the cause of the earlier failure. CPU stacks include icon
classification, whole-shell localization, settings and Agent rendering; many
main samples are classified idle. These observations do not establish the
historical regression's cause or the owner36 graphical problem.

The renderer profile/main-clock command brackets permit an offset interval
12.228125ms wide, not exact clock synchronization. Requested1ms sampling had an
actual median4.595ms and maximum132.215ms between samples. Independent analysis
therefore reports certain/possible sample membership, not exact CPU milliseconds;
global idle proportions are not transferred to measured switch windows. Existing
icon-contrast and tab-flow code is byte-identical between36 and859, which is
another reason not to infer a37-only production defect from those stack names.

The next common candidate therefore contains only the justified private-text
fixture correction and its tests/documentation. No production graphics change,
performance threshold/workload change or diagnostic-branch merge is inferred.
All native platforms must execute the original full gates again on that common
source, followed by independent actual package acceptance. Historical failures
remain recorded and no public package is replaced.

## 22 November, 06:15 UTC — source0a95 native results and retained language selector

The exact private-text correction was pushed as
`0a95c8ab0ab440f662ce8e65288589d592e50157`, tree
`aa12390bdf0c3357f2717fa26771e1e5b0e24922`, parent859052cd. The reviewed local
tree and remote tree matched before the compare-and-swap ref update. All eight
auxiliary source workflows passed. No production graphics/performance changes
or diagnostic-branch files were added.

### Mac0a95: strict performance and current features pass; retained chooser fails

[44991966566](https://github.com/jeep-jim/OSMINOG/actions/runs/44991966566),
attempt1/job137114766705, failed the installed-app step at06:11:17 UTC.
Verification artifact14741429834 contains44,988,938 bytes, SHA-256
`0de5a623587e719b9fa8c6efd709f2176d8e6c019fe6b02ae35ae6940ea066f0`.
Package binding/upload was skipped, so the complete release gate remains failed.

The unchanged strict published636 comparison now passed:20-page median
73.058625ms to74.989458ms (delta+1.930833ms within16.666667ms);50-page median
68.212750ms to59.549750ms (delta-8.663000ms). Candidate20 p95/max are
76.063083/87.958917ms;50 p95/max are83.074875/107.587292ms, within the original
250/600ms ceilings. The prior72/859 failures are retained, not reclassified.
This runner result does not establish the cause of Anton's36 graphics report.

Current637 native feature WRITE46385 and restart READ47811 exited0 with the
required markers and separate reports. Root inspected the actual new Mac circle
PNG: original centered mouse, curved lower actions, round close/minimize and
strong dark backdrop are present. Its ready-to-install text is an intentionally
exercised presentation state, not proof of a public release or owner installation.

The later full WRITE process passed `MOUSE_ALL_FOOTER_MODALS_NATIVE_BARRIER_RACE_PASS`
and then failed in the retained language-choice loop in `mouse-start-smoke.cjs`.
That loop still selects `#choice-dialog button[data-value="en"]` and then `ru`.
Actual `overlays.js` languageOptions creates enabled `button.language-chooser-row`
with `bdi.lang`, while data-value belongs only to the separate generic chooser
branch. The raw failure screenshot shows the open new language picker, search,
and visible Russian/English rows; failure state records the modal barrier.
The existing current637 feature scenario already selects those real rows through
`:has(bdi[lang=...])` successfully. The retained click helper throws on the missing
old selector and Electron exposes the generic script-execution failure.

A narrow fixture correction is being reviewed: use the exact enabled language
button with its actual bdi language, retaining the same real pointer sequence,
modal/native-page barrier, English→Russian order, selection assertion and native
layout-menu scenario. Production chooser attributes/behavior are unchanged.
All smoke/test files were searched for the old chooser pattern: the only other
match is the valid generic AI preview target `data-value="p2"`, which is retained.
The private611 correction was not reached by this Mac WRITE process.

### Linux0a95: source acceptance passed; exact artifacts undergoing independent gate

[44991966576](https://github.com/jeep-jim/OSMINOG/actions/runs/44991966576),
attempt1/job137114767127, completed successfully at06:11:35 UTC. New verification
artifact14742382990 is40,736,403 bytes, SHA-256
`03c3fade1981d6918331d5bbc2f0da7b7071f08e22e56b829f662c97719fca16`.
Candidate artifact14742512455 is241,168,006 bytes, SHA-256
`cb728128432211dfd72814112ac058ffb0f4f880eccfefb17d97d7521142bdf9`.
Both archives passed independent size/hash and safe-extraction checks. Actual
AppImage is135,776,082 bytes/SHA-256
`0c9911ff8e845de7f2cb09b3e217d5e3efad52f3d8f2c7fe84d48c5883497fb8`;
DEB is105,924,504 bytes/SHA-256
`2641ec7c9ccd0bec23822a00e2503cd34349311da76b6e02fa957fbbb75d6e05`.
The full independent publisher3b verification is in progress; no acceptance for
a later source is inferred.

Windows0a95 run44991966591 attempt1/primary137114767190 is still running its
installed step at this observation. All three pins remain unready. The public
feeds were reread at06:06 UTC as6.0.36; all three37 release tag endpoints returned
404. Neither a release nor a38 version bump is warranted by these partial results.

### Exact0a95 Linux acceptance and reviewed language fixture correction

The full independent `mouse637-linux-evidence.py.verify` completed successfully
in129.58381806 seconds against the exact0a95 package and evidence bytes above.
All264 Python verifier files were bound to publisher3b4febdf Git bytes before and
after. Retained gates, published636 comparison, actual profile replacement and
update-button scenarios, all38 frames, restart and trusted Files proofs passed.
Actual feature processes are WRITE9896/READ11213; the three file transfers retain
their309/116/309-byte payloads, all13 phases and730.969/730.439/730.585ms destination
dwell. This acceptance belongs only to0a95 and is not reused for a later commit.

Mac0a95 current637 features also passed the independent publisher validator in
41.043 seconds:38 frames, native input/file receipts, WRITE/restart bindings and
the circular updater. This is a component result; strict performance was a
source-native PASS, not a separately recomputed independent comparison here.
No complete Mac package/upgrade acceptance is possible for this failed run.

The retained language fixture correction is exactly one selector replacement:
`#choice-dialog button.language-chooser-row:enabled:has(bdi[lang="en"])` and the
same expression for `ru`. The pointer move/down/up helper,140ms click wait,
existing polling, modal/native-view barrier, value assertions and subsequent
native menu checks are unchanged. There is no production DOM or UI change.

The regression test executes the actual shipped `overlays.js`, its real language
catalog and the retained loop taken from `mouse-start-smoke.cjs`, using the
existing owned DOM harness and real host OverlayGate. It checks two enabled
language buttons, noninteractive planned languages, English→Russian changes,
four click-dispatch calls and the exact barrier sequence/restored native view.
Root review found that the initial harness getter did not reflect dataset into
data-* attributes; this was corrected before acceptance. A positive control now
executes the actual separate generic chooser branch and proves that its genuine
`button[data-value="p2"]` exists, selects p2 and preserves hidden/disabled choices.
Thus the language selector regression is not an artifact of an incomplete getter.

Author and root focused Node22.23.5 runs pass18/18, zero skipped; independent
reviewer reran only the affected overlay file,8/8. An in-memory substitution of
the original0a95 retained loop produces exactly the expected missing-en-target
failure while the generic chooser and six existing overlay tests pass. Native
OS interaction is still required by the complete installed CI; the unit harness
does not claim that proof. Root's first focused invocation lacked the existing
Electron dependency path and reported six module-resolution setup failures;
its log was retained before rerunning with the already installed desktop
NODE_PATH and correct focused test list. No source change was made for that
environment correction.

Final reviewed SHA-256 values: `mouse-start-smoke.cjs`
`04c4d008512ce98671f39900e580fb457c203d7d4c7f9ec35f29d7ed6664306b`;
`mouse-overlay-metadata.test.cjs`
`cc53d99d4014ed4443f233ebd5994a87f03d23142bc406e77a2d7e5fd4a7bc3b`.
`git diff --check` passed. Publication pins and production code remain unchanged.

### Windows0a95 primary completed; prepare the next common candidate

Windows run44991966591 attempt1/primary137114767190 completed successfully at
06:21:17 UTC, including installed acceptance, package binding and both artifact
uploads. Verification artifact14743055141 is81,767,847 bytes, SHA-256
`1bddd24ea8bdf2a3b9830b2ba823eaae97094c50596fd2848bb545f4026aed52`;
its actual archive was downloaded, hash-checked and safely extracted (701 files).
The complete terminal job log is794,202 bytes, SHA-256
`8fd37b7b24306cb2d97a6fd8064310151b1673b7369553928bc6e685a5d61da4`.
GitHub also records candidate artifact14741759915,125,616,101 bytes, archive
SHA-256 `6e66b1610d18c7466e42736b5d8727dd3af629ca114309a18b400fbedc361e87`.
Those archive metadata are not a separate verification of actual EXE bytes.

Current WRITE process7692 passed private isolation in3392ms, including the actual
`MOUSE_611_PRIVATE_THEME_ASSETS_AND_LIVE_SWITCH_PASS` marker and both private-theme
PNGs. Later private cleanup, native profile write/read and the complete wrapper
also passed. Wrapper raw SHA-256 is
`d3942d1856524c064c40635ec580efa16de2c07933e064c2efb6c4c023a5ecc6`.
Its17 successful checks include reinstall/read, actual update-button replacement,
post-update profile and ordinary launch. The earlier859 private-text failure is
preserved; the narrowly corrected expectation is now exercised by native Windows.

Dependent modern job137118930356 started after primary success but is not accepted
here. Because Mac0a95 already failed the stale language selector, this common
source cannot be published. The next required source push will supersede the
unfinished modern run through the existing cancel-in-progress policy; cancelled
or partial work will not be counted as PASS. The final candidate must pass both
Windows jobs on one attempt and full independent actual-package verification.

A targeted read-only review of the remaining Mac legacy scenarios found no further
deterministic contradiction in the changed library, AI preview and updater areas.
Preserved library semantic controls, main AI IDs, updater close/minimize and the
>=150px centered mascot remain compatible. This source review is not a substitute
for completing those native scenarios. The next candidate contains only the
reviewed retained language selector, its production-DOM regression tests and this
journal; production code, frozen validators and all acceptance budgets are intact.

## d39 native results and retained dark-sidebar expectation — 2026-11-22

The reviewed language fixture was committed as
`d39d910cf8b4219268a57c936833ddba4fde6da1`, exact tree
`6b0a67f1b3f01d1716fad4c5681c534130018a2a`, with parent0a95. All eight auxiliary
source workflows passed. The public platform feeds were read again after06:45 UTC:
all three still identify6.0.36. Source main remains123b7d765b72f3e92e5b5dd8f674a6856d534728;
publisher main remainsccec613e41622b467ed4f8bfee2a3e9cd5a81831. No published
package is changed, and all three637 pins remain unready.

### Linux d39: complete acceptance, valid only for these exact bytes

Run44993563876 attempt1/job137119677026 completed successfully. Verification
artifact14743480683 is40,749,922 bytes, SHA-256
`18e2dd575de0f0e4cf0d9010e9c3ab68de5bbc6c6bea5683f0dbdaeb70657551`.
Candidate artifact14742733799 is241,168,489 bytes, SHA-256
`69f3b1ddbc93db370b8ce80292fda833ac573f98fd9ce7e1d74c727ee8cb4817`.
Actual AppImage is135,776,083 bytes/SHA-256
`7ecd354bb38eb798804e4dcd9e356c9c2f48dda5eda72c3166a2d8f47d6d4af0`;
DEB is105,925,076 bytes/SHA-256
`9f2b3f5724b882bf8ca3888f3d5d773fa6cbef064e4d9adc3e65498dd1305a9d`.

The complete independent publisher3b `mouse637-linux-evidence.py.verify` passed
in129.107533752 seconds, with all264 Python validator files bound to their Git
bytes before and after. Retained gates, strict published636 comparison, actual
profile replacement/update button,38 frames, restart and trusted native Files
proofs passed. WRITE9858 and READ11173 retain180 native input receipts and all13
file phases; the three received payloads are309/116/309 bytes. This result cannot
accept a later source commit. Saved independent-result JSON SHA-256 is
`c62d2ede81df72db87849b91912f45e39a6fe49148fbb516ce72eaef9a44479a`.

### Mac d39 attempt1: preserve the failed published636 baseline

Run44993563942 attempt1/job137119676947 failed before candidate native acceptance.
The actual published636 baseline process25511 completed the20-page scenario and
all ten50-page switches, but its mandatory final page-identity readback timed out
on page4 after12000ms. The final50-page identity proof is incomplete. This is a
preserved failure, not a performance pass, and its cause was not established.

Baseline DMG and installed executable hashes, workflow, verification, baseline,
upgrade, display and stress paths are identical to the preceding successful0a95
baseline. Original artifact14743625319 is5,246,561 bytes, SHA-256
`7b6c81f8556fae20baf0bb0548688b0cd90c01207f6ea622be92f40d5799fe33`;
the complete977,035-byte job log has SHA-256
`6bb75048abcb56148facb7db96f8e4f34dba18255678e564c08dc8639b75c1e2`.
Both were hash-checked and preserved with raw inventory before independently
reviewing and requesting one complete unchanged repeat at06:33:19 UTC. No budget,
timeout, workload, fixture or production code was changed for that repeat.

### Mac d39 attempt2: baseline/performance passed; later stale polish assertion

The sole repeat, attempt2/job137121737863, completed FAILURE at06:41:15 UTC. Its
published636 baseline passed. The original strict637 performance criteria passed:
20-page median58.977083→52.364542ms and50-page57.029959→60.315542ms. New features
passed with38 native frames, WRITE31491 and READ32618. The corrected real-pointer
language chooser passed `MOUSE_FOOTER_CHOOSERS_REAL_CLICK_PASS`; the next library
geometry/resize/no-reload scenario also passed.

The full retained WRITE process32705 then failed at
`desktop/mouse-polish-smoke.cjs:35`. Its first theme is dark, but the old assertion
unconditionally requires Settings `backdropFilter` to contain `blur`. The actual
production `mouse/sidebar-dim.css`, loaded after `mouse-633.css`, deliberately
sets dark Settings and Library to the toolbar surface with both backdrop filters
`none`. This is the combined637 sidebar requirement recorded earlier in this
journal. Production styling does not need a change to satisfy the old test.
Failure state records an open nonmodal Settings panel, `overlayBlocked=false`,
`surfaceHeld=false`, `body.sidebar-dimmed` and a ready renderer with no active
desktop transition. The computed filter itself was not recorded in that failure
JSON; the assertion, stylesheet order and actual screenshot establish the stale
expectation without inventing a raw value.

Attempt2 verification artifact14742694924 is45,754,781 bytes, SHA-256
`0ecdbb8f0b3a879a54ba596d27bfe66465e17d8b32ef957a3e2e3499e299d4fa`.
Its378 raw files were safely extracted separately from attempt1. Complete job
log is1,021,937 bytes, SHA-256
`85c76a959708e3108f49e3f812d23d1cbb994ec827ecb8479f0b08534533f11b`;
the failure analysis/inventory SHA-256 is
`dc15f53ee9c701cb5b4e585bafd7ba7da74e67fedf750125222172979ecae4ea`.
Package binding/upload was skipped. No full Mac acceptance is claimed and no
third repeat is requested. The next source must correct this retained expectation
and pass every platform gate again.

The owner's36 rendering/freezing report remains an unverified physical-Mac
scenario. Passing runner comparisons and the completed circular-updater images
do not establish that this case is fixed or that the user's device has updated.

### Windows d39: primary passed; later common source still required

Run44993563841 attempt1/primary137119703836 completed SUCCESS at06:45:24 UTC.
Installed verification, package binding and both uploads passed. Actual
verification artifact14743642529 is82,004,514 bytes, SHA-256
`6d191a26ffd14d481af6b93e224b4309193ddb91a3e657f66b59171c8d3b527c`;
its701 files were safely extracted after size/digest verification. The complete
795,486-byte job log has SHA-256
`00771b1165975a4320f9dd721a4c2fe55b8eecf9e5f4676efcc6c7f802e5d51c`.
The17-check wrapper is successful, raw SHA-256
`b1f6b71d78bf5745fffa05c49acbdcbd02a7216a54f029c31d2acc1be2742934`.
It includes actual update-button replacement and profile/ordinary launch checks.
Private611 passed in process7428, and all38 feature frames passed across
WRITE9156/READ8428 with raw report/log hashes matching the wrapper. The native
strict comparison passed:20-page median53.9128→56.4770ms and50-page60.1214→63.2947ms.

GitHub records candidate artifact14743612511,125,616,160 bytes, SHA-256
`0f6c274c9ac41899fdc359c42ecb583aab40d3e3697b6fecf1c6d3b567f29d5c`.
Actual EXE bytes and the full independent publisher gate were not processed for
this source already blocked by Mac. Modern job137124497761 started at06:45:27
and was observed in its installed check; no terminal outcome is claimed here.
The next common source must pass both Windows jobs in one attempt and full
independent actual-package acceptance. Existing cancel-in-progress may supersede
unfinished d39 work when that necessary source correction is pushed; cancellation
must not be counted as success. Provenance SHA-256 is
`6b882fa41863ed9f30e432af4863b80032c2d3cd1b3da94969d04ca9e05ed1dc`.

### Reviewed version-scoped polish fixture correction

The retained polish scenario now reads the actual installed `MouseNative.version`,
theme and computed Settings/toolbar surfaces through one renderer call. Only for
exact6.0.37 in dark theme it requires `backdropFilter === 'none'` and identical
nonempty computed background image and base color to the actual toolbar. Light
theme and every other version retain the original blur requirement. The native
pointer sequence,150ms click wait, polling, sidebar geometry, no-reload identity,
button spacing, monochrome icon, fullscreen/native menu assertions and pass
markers are unchanged. Production CSS/code, workflows and publisher validators
are unchanged; this is a fixture correction, not a rendering-performance patch.

The new focused test executes the exported actual renderer readback and assertion.
Its owned DOM/CSS harness reads the real stylesheets in `index.html` order and
resolves only the relevant surface declarations. Positive controls cover actual
dark637, light637 and retained blur. Negative controls reject changed dark blur,
gradient/base color, removed sidebar override, wrong exact version, missing
version and removed light/legacy blur. This limited source/cascade unit test does
not implement Chromium and does not claim native computed-color/pixel acceptance.
That remains mandatory in the installed Mac scenario.

Author and root both ran the new test plus existing `mouse-polish.test.cjs` and
`mouse-621.test.cjs` on Node22.23.5:51/51 PASS, zero skipped. The independent
reviewer reran the affected new test:5/5 PASS, zero skipped. `git diff --check`
passed. Frozen reviewed SHA-256 values are `mouse-polish-smoke.cjs`
`63a02f556d81a83e7899cc845c3f03b6c6a9e34031256025a9a43749b4cb00da`
and `mouse-637-settings-surface-smoke.test.cjs`
`efed464d30d0afe6c1a10c21c7664259dff9f72d19732d9532941d1e9f54fc38`.
The existing unit enumerator automatically includes this new file on all three
platforms, without a workflow modification.

A separate read-only review followed the remaining Mac smoke order and scanned
all36 subsequent/nested scenarios for stale sidebar blur, text-tone, library
label and updater-geometry predicates. Detailed checks covered documents632,
local628, feedback630, mascot609, badge614, library619, archive620, final and
AI612. Preserved semantic controls, content-only download names, actual ≥150px
centered mascot, private-tone adapter and current sidebar bounds remain
compatible. No further concrete contradiction was found. This source review is
not execution evidence for the remaining Mac stages; all must still pass on the
next exact common source. d39 platform successes are preserved as history only.

## Exact2b73 native results and isolated preset diagnosis

Source `2b73ad7b7924bf8e87fa0932eea672fe2bb89f52`, tree
`2a3917f6419342c7d22eb18dab945a992a53e2a2`, retained all production bytes from
d39 and changed only the reviewed Settings assertion, focused test and journal.
All eight auxiliary workflows passed. Public feeds were reread at07:23UTC on
22 November: all three still identify6.0.36 with the existing package hashes.

### Linux actual packages accepted for2b73 only

Run44995533015/attempt1/job137125629841 completed SUCCESS at06:59:27UTC. The full
independent gate against actual AppImage/DEB bytes passed in131.522733432s with
all264 Python verifier files bound before and after execution to unchanged
publisher3b4febdf. All retained gates, strict636 comparison, actual update/profile
checks,38=36+2 native frames and real file transfers passed. There were449 raw
evidence files and four candidate files; archive paths and links were checked.

Verification artifact14743454888:40,645,166 bytes, SHA-256
`1028ed672ccab15091859fa2f1a6ce5f0614bf6eff18b49a5c256ad9eb4f3616`.
Candidate artifact14744050801:241,168,383 bytes, SHA-256
`40462359a51e75e2e524cf6ac64111542d73db7a6fde368fbfeebd00025d268f`.
Actual AppImage135,776,082 bytes/SHA-256
`61d08e096ca127098b9f5ba2502f12c25b85c5240bcaa5e962d4cf95906d9a4d`;
DEB105,925,036 bytes/SHA-256
`c9374eb0f42c2289c8bb373dcf405bb5880c0bc6de495c2a67b07e867aee06d1`.
The compact provenance SHA-256 is
`c310ba0330c39852fc6ed8baf0d747c7498af4dcd9d5ae478393e57b77f9cd69`;
full independent-result SHA-256 is
`36e93983e61fc441d6244cb975e3cce67063a01e4fb10f988f1921364b4fa741`.

### Windows primary accepted; modern independent sweep still pending here

Run44995532966/attempt1/primary137125662637 completed SUCCESS at07:12:12UTC.
Its full independent actual-EXE gate passed in213.629s, including the installed
wrapper, actual636 upgrade/button, all38 frames/native Files/restart, task50,
all retained feedback/owner/library/performance/scrollbar gates and separate629
separator pixels. All264 verifier files remained Git-bound and409 consumed raw
files remained unchanged. Actual EXE125,903,736 bytes/SHA-256
`ba96926b660100a7510a15c21119ebc15da9e84e05754b2bd2f550c2b2dea19c`.
Verification artifact14743878921:82,008,664 bytes/SHA-256
`18f0c310c810c77e6a592c19fa20e0d37a239bca977ce044da6118c980f22a16`.
Primary full-result SHA-256
`06a4f971f9b6b71d641d077a992cbca4c1ce6e8b5dcdbce933cecba63ef5b433`;
compact provenance SHA-256
`0f4919dd507e0654d4468008ce09c56b6b942cca7c3553d3e2803ac5d0e2a8eb`.

Dependent modern job137130532190 also completed SUCCESS in the same attempt.
Its artifact14744527143 is78,171,074 bytes/SHA-256
`c1f50f17595d3d66afb0acb8a3ebeff2458d552cb52d4a1352e8d03cbd379807`,
700 safely extracted entries. Actual input identifies Windows2025Server,
10.0.26100/image win25-vs2026. Source/run/attempt, the same EXE and primary
verification binding passed; the full independent modern sweep was still running
when this entry was written. It must finish before complete Windows acceptance.

### Mac2b73 failure remains preserved and unexplained

Run44995533011/attempt1/job137125629651 passed the actual published636 baseline,
strict637 performance and owner636. Strict20-page medians were
85.246833→60.609333ms and50-page117.741458→56.351833ms under unchanged limits.
The installed feature WRITE child42073 exited1 after27,825ms in
`native-populated-presets`, at `mouse-637-presets-helpers.cjs:56`:
`Every preset pane is populated`.

Support and Trader completed. Design requested all five owned loopback URLs;
its tree matched, but one slot did not match the actual page list. The failed
pane/slot/list was not saved before the assertion. Later failure PNGs were made
after the inner preset finally restored the original desk. They cannot establish
the failing arrangement or its cause. The inner preset cleanup reports restored;
the enclosing WRITE is still failed. The new Settings runtime assertion was not
reached. Package binding and candidate upload were skipped. No rerun of this
release job was requested.

Verification artifact14743896823:33,695,149 bytes/SHA-256
`dec1cf9ca49f2e964e4cbbc5aa089d2c2c01fc409b3e8be3969348adad5afc43`;
316 raw files, complete job log and API provenance are preserved. Eight relevant
production/fixture files are byte-identical to d39, where Design passed; that
comparison does not identify a cause. The complete log contains no matching
render-process-gone, unresponsive or GPU-crash message; absence of those messages
does not exclude a native failure.

### Isolated2424 diagnostic: non-reproduction with an observed delivery inversion

The separate branch `diagnostic/mouse-637-preset-2b73ad7b` contains commit
`2424c69dde0e929271d102afb836a2eb847a163b`, tree
`5944d5b9308bcfad3b591d4300f4dd3c6083410e`, with sole parent2b73. Its11-file
reviewed remote tree exactly matched the staged local tree and every uploaded
Git blob. The release source and publisher were not changed by that experiment.
The branch is never merged, pinned or substituted for release acceptance.

The opt-in collector uses a separate diagnostic WeakMap and extra argument on
the existing state push, leaving ordinary state fields and return objects intact.
The successful path records already-computed values without extra authoritative
state reads. First32 events plus a rolling tail are bounded by512 events/1MiB per
process and32KiB per record; truncation, eviction and errors are explicit. On the
original assertion failure it would save exact inputs and main/renderer/native
PNG before cleanup, while retaining the original exception. One original WRITE,
fresh profile, original240s/270s deadlines and failed-child status are preserved.
Author/root44 focused JavaScript tests and root/peer9 Python tests passed with
zero skips; the independent reviewer also passed all12 new JavaScript tests.

Native push run44997882783/attempt1/job137132752142 completed SUCCESS. Its only
child24925 exited0 after56,516.477875ms; original WRITE reported53,044ms,
writeComplete=true and awaitingRestart=true. All seven preset applications
passed. Design used five actual WebContents18–22, with selected requests9→14;
the ten preceding page snapshots matched before and after. There are36 WRITE
capture pairs. There was no READ, full release verifier, release package or
publication. A successful diagnostic is not a complete release gate.

Artifact14745115225:13,553,069 bytes/SHA-256
`2a87fc1359801f18290dae667dd1ab0bd056555acfdac11b7ef8a855cc71285c`;
82 safely extracted files. All80 files in the runner inventory matched their
size/SHA-256; offline collection validation from the exact diagnostic Git bytes
passed. The complete job log is50,849 bytes/SHA-256
`4a709fa58e334b739eb0d6ecca4e67d0a6ae1f015a4cb53e935f4d1c6d5f725d`.
The raw trace is699,494 bytes/SHA-256
`ce5207ae579774d309ea33d24e5f1f3e10064ae7444374da415d3201dc8c3251`.
Independent analysis SHA-256
`7ef6721b5919b45b87e3f8bedcb907db1632f8a46934467f2d96fddbf053e3f2`.

The original Design failure did not recur. The bounded byte budget evicted
main events33–284 and renderer33–156 after later successful modes, including
the complete Design transition. Main retained235/487 records; renderer124/248.
There were no per-record truncations or collector errors. The retained11
enter→reconcile pairs did not change slots. This incomplete trace cannot prove
the absence of a harmful late state throughout the whole scenario.

It does establish one narrower native ordering fact. The final Agents main
operation built/sent snapshot220 (events482/483), then returned snapshot221
(events484/485). The corresponding renderer received that result(event244),
applied it(event245), finished switching(event246), then received
snapshot220(event247)9.6ms later
in the same renderer clock and applied it as state-unchanged(event248).
The invoke response carries no diagnostic sequence field; correlation uses the
ordered final Agents operation, exact mode, ordered tab metadata and
returned/current slots. Both snapshots contain the same24 tabs and slot map.
No slot loss occurred in this observed pair. Root and both independent readers
confirmed this ordering and its limitation without comparing cross-process clocks.

Separately, the earlier unit probe executes actual release receiveState/reconcile
functions: injecting an older same-desktop10-tab snapshot after a15-tab Design
result clears the five new slots; a subsequent fresh15-tab snapshot does not
restore them. This proves the destructive conditional code path. The new native
trace establishes that a push built before an invoke result can reach the renderer
after that result. It does not prove that this exact10→15 sequence caused the
original Mac Design failure, nor that the owner's physical6.0.36 drawing problem
has the same cause. Those limits remain explicit for any subsequent correction.

### Windows2b73 independent modern completion

The modern full independent sweep subsequently passed in194.2195734429988s.
Both native jobs in run44995532966/attempt1 are successful: primary completed
07:12:12UTC, modern07:26:23UTC. Both complete independent gates passed against
the same125,903,736-byte EXE, whose SHA-256 root independently reread as
`ba96926b660100a7510a15c21119ebc15da9e84e05754b2bd2f550c2b2dea19c`.
All264 publisher verifier files stayed bound to unchanged3b4febdf Git blobs;
409 primary and410 modern consumed raw files were hash-checked again.

Primary WRITE→READ PIDs7216→1956 and modern2164→7684 each have38 frames and
three real native file transfers. All installed wrapper, legacy629 migration,
actual636 upgrade/update-button/profile, display chronology, task50, current637,
retained feedback/owner/library/performance/scrollbar/separator gates passed.
Modern input is bound to primary verification SHA-256
`dcec715609bdd09e67ab3c0744217f2f17f150d1d029980959bb6bd20085d344`;
modern wrapper SHA-256
`1934fed9ba087fc33d3ed7fc6d7677b5994c890fb88b7d203f8d75ec4eb9353b`.
Candidate artifact14744092474 is125,616,135 bytes/SHA-256
`282c0ef929aa34f8c67fcb78a0b02244d23471573f6865a982e2679dcc0e0dc4`.

Combined independent result SHA-256
`562dbf063633abf62ebe174cc9f744d6de9f8424d799a8809e6b737c2c0414ab`;
complete provenance SHA-256
`3ecd31d8227788a6c8242aef029ab2599fc57a1e71188bbb1b3d55db5bcaa4b3`.
This is full Windows acceptance for exact2b73 only. It does not accept Mac or
constitute publication. Any subsequent common source requires all three
platforms afresh; these accepted Linux/Windows2b73 results remain historical.
All three637 release-tag lookups returned404 at07:32UTC; source main remained
123b7d765b72f3e92e5b5dd8f674a6856d534728 and publisher main remained
ccec613e41622b467ed4f8bfee2a3e9cd5a81831. Version637 is still unpublished.

## Correction: preserve the newest accepted workspace snapshot

The native2424 delivery inversion and the real-source destructive regression
justify a narrow ordering correction independently of the unexplained original
Design failure. No diagnostic instrumentation or diagnostic branch is merged.
Only two production files change: `mouse-desktops.cjs` and `mouse/browser.js`.

The existing final DesktopService state builder adds `snapshot:{epoch,revision}`
to its already-computed result. A UUID epoch belongs to that service instance;
the revision increases on each existing snapshot construction. Main emits, init,
browser state reads and coupled desktop-action results share that order. No
additional state read, serialization hash, native request or wait is added.
Normal and private services have separate epochs. Their explicit tab-session
serialization, preferences whitelist and DesktopBank persistence do not include
the transport metadata. Start/document wrappers precede the final builder.

One inline renderer receiver binds its canonical epoch only from init. Before
init it retains at most16 latest epoch/desktop buckets, then clears them and
selects the newest matching initial snapshot. All production state assignments
use the receiver. Older, malformed, foreign-owner or inappropriate-desktop
snapshots are rejected before reconciliation and saving. Ignored switching
pushes do not raise the accepted revision. The receiver also honors the revision
in the current model state, preserving compatibility with existing native
cleanup helpers that directly assign a fresh init/state response.

Coupled desktop results remain strictly accepted with their preferences;
pin/move/close/restore require the current desktop, while explicit switching
accepts its requested target. Read-only refresh has a distinct continuation
rule: an older reply can leave a newer valid current snapshot in place, allowing
the already-successful action to finish only for the same owner/desktop and a
still-live target ID. This preserves page/AI opening, navigation, Agent/document
activation and extension placement without restoring a closed or foreign page.
It corrects a concrete early-return regression found during independent review
before the source was pushed. Fresh title/loading/navigation updates and real
closures still reach their original owners and reconciliation.

A separate one-line native fixture change records `populationFailure` only when
the original population assertion is about to fail. It copies the exact already
read mode, pane, ID, hasSlot, preferences and pages into the existing report.
That report survives the existing cleanup; there is no new state read or wait,
and the original assertion/message remains unchanged. This preserves useful
inputs if a different cause recurs in the subsequent full native gate.

### Validation and limits

The original source first failed the new real-source regression for the intended
reason: an older10-tab push erased all five Design slots after the15-tab invoke
result. The saved RED log is1,876 bytes/SHA-256
`be19e163d25d1c3744ba857ae8fe3442c51f407914572aa6998a5e658c49bffe`.
This controlled unit case is not presented as the missing native Design trace.

Final author and root focused runs each passed95/95 tests with zero skips on
Node22.23.5. They include17 new ordering cases, the actual main DesktopService
sequence/non-persistence test, and existing performance/overlay/media/layout/
AI-close/new-tab/desktop-slide scenarios. The six existing extracted-source
harnesses now initialize the actual receiver and provide transport stamps;
their existing native predicates and budgets were not weakened. Root's final
focused log is25,535 bytes/SHA-256
`5aee76537778b80007bc0d7a55fb741c5abd4c97d33fc101f4c24d0e5eb861c9`.
The independent reviewer passed17/17 new cases and, after the last same-desktop
check, both affected cases again. A second reviewer independently passed17/17
before that final check and audited all successful read-only continuations.
The failure-only helper's six existing tests passed, and its report persistence
was independently traced through preset cleanup and outer feature saves.

One full local `tools/mouse-unit-tests.cjs` preflight produced1261 tests:
1251 passed, five failed and five existing platform/native cases skipped.
All five failures identify absent local build dependencies: `ws` in two test
modules, `mouse-mcp-fs.node` in one, and the official MCP SDK client in two
manager tests. The skips are four Windows-native cases and the unbuilt Linux
corner addon. No skips or fallback predicates were introduced. This is explicitly
not a full local PASS. The raw346,270-byte log has SHA-256
`0119b103dcff66dbc59d12f9c692b6773d7d154533ed7ed1f1fe647aa2787eca`.
The final focused95 were rerun after the last guard refinement. The unchanged
native workflows must prepare their normal dependencies and pass their complete
unit/build/installed acceptance on the new source before any release decision.

Frozen final production SHA-256 values:
`mouse-desktops.cjs`=
`9b9e28ba652f7efe333d11340f3c9b965b34b1661e34bcef6bf4eae3ed5a1120`;
`mouse/browser.js`=
`2131f2ac2ff0898e214c4eb1141f338459a501d095cfb85892f487a20582da39`.
New regression file SHA-256:
`e766496f81026284148f356b4636893ddbd72a270aee319c480351af65b42c96`.
`git diff --check` passed. Publisher bytes, native workloads/deadlines, all
performance/pixel budgets and frozen predecessor verifiers remain unchanged.
The next common source must receive complete fresh Mac, Windows and Linux
acceptance; successful2b73 Linux/Windows packages cannot be pinned for it.

## 2026-11-22 — 5a13 platform evidence and bounded input investigation

The common source5a13d620e66e8b25792b3ba26de907c6b66fc422 has tree
abe7d244841c6bcbc5af982d150d605f5e8c0fd2 and sole parent2b73ad7b.
All eight auxiliary workflows passed. Neither source nor publisher was merged;
the owner still awaits6.0.37. All three public feeds remained6.0.36, and all
three37 release tags were absent at08:30 UTC on22 November2026.

### Linux5a13 complete independent acceptance

[Run45000235012](https://github.com/jeep-jim/OSMINOG/actions/runs/45000235012),
attempt1/job137139946706, passed native and the full independent actual-package
gate in139.3729840019987 seconds. All264 verifier files were bound to the actually
executed publisher3b4febdfd022fba9d38495e4e6b8d2720afd49a5 and unchanged;
426 consumed raw evidence files remained unchanged. Complete38-frame WRITE/read
restoration, original real-file transfers, actual updates and original strict
performance gates passed. Root additionally rehashed both actual packages.

| Object | Artifact | Bytes | SHA-256 |
|---|---|---|---|
| Candidate archive | 14745717748 | 241169494 | 662cdea8e78e1bd030a363cd3ae8b9e35a1fb9005df89a26d20f582c1d019d06 |
| Verification archive | 14745424103 | 40875194 | aa3c4872933fa3e3e62da34da3633228da2ab92b7241c9fca17dc855fbcae723 |
| Actual AppImage | — | 135776013 | 4ceb01735e681b3be4306ddb6440a3f800dea028902691b0727cb5bcde3142af |
| Actual DEB | — | 105925464 | 74cf5eb518c359cbab764cdcd876517cb507333976cea94bae1d24023719d4a7 |

Full independent result SHA-256:
c8b35375b5aa8fe93eebaba9ed26c7a18907c14c2bcfcf5c9940ac2237f046de.
Provenance SHA-256:
d08ea9d1492ccb44994c1d44bddac66de0dc8ecab440d00f6f1c6f1edb5dd7a0.
This acceptance belongs exclusively to5a13; the proposed pin was not applied.

### Windows5a13 complete independent acceptance

[Run45000235140](https://github.com/jeep-jim/OSMINOG/actions/runs/45000235140),
attempt1, completed successfully with primary job137139947400 and modern
job137144827447. Full independent gates passed separately in216.33520775899888
and197.726324638 seconds. All264 immutable3b4 verifier files and819 separately
bound phase evidence reads were rehashed unchanged. Modern input identifies
the same actual primary installer and primary verification wrapper. Its actual
runner was Windows2025 Server10.0.26100, image win25-vs2026/20261116.315.1.

| Object | Artifact | Bytes | SHA-256 |
|---|---|---|---|
| Candidate archive | 14746655402 | 125617060 | f8a214b7b1404bf5adf607007103c0926aecdaca4c69b07b467e76d110e91e91 |
| Primary verification | 14746575666 | 82024546 | b9fd1840fab5db3e9f2d4eb0336a7619298dbd7f633e07a888097177609acfae |
| Modern verification | 14746388978 | 78839433 | a15539d1f3359dfc2360e87f993d0760933d47deb91b8dc409c59285b6c05a40 |
| Actual EXE | — | 125904562 | 88c5a2b341e215ddba9772e6b0de263947cd37fd622fdb293e220f28db669e51 |

Root independently rehashed the actual EXE. Aggregate result SHA-256:
d7cb9d8d8271b827250145400aa9b83dbaa10b9a05970038969264886f44df7e.
Aggregate provenance SHA-256:
060ab07cd7d9b77abb1a4f68c0b562bb94893876fb8e1b3b8cf5ff39190ac36d.
Full Windows acceptance is true for5a13, while sourceMerge is null, the pin is
unapplied and releaseAcceptance remains false. The performance report's raw
environment source b059a7cb is GITHUB_SHA; the checked-out build/source manifest
identifies5a13. These distinct fields are preserved rather than rewritten.

### Both unchanged Mac5a13 attempts remain failed

[Run45000235119](https://github.com/jeep-jim/OSMINOG/actions/runs/45000235119)
passed unit/build/published636 baseline in both attempts. Attempt1,
job137139946950, failed the first retained guest link #download-a at104,252.
Attempt2, job137141782888, was initiated by another continuation at08:01:14 UTC;
pane downloads passed, then AI #link-blank at924,332 failed. Both preserved
the original trusted-click timeout and stable sampled bounds/visibility. Neither
reached current637 strict performance/new features or candidate upload. No third
unchanged full run was requested by this continuation.

| Attempt | Artifact | Archive bytes | SHA-256 |
|---|---|---|---|
| 1 | 14745950267 | 5218617 | bca2a09fd53a2186c90177f27ed31b95e7cb8ad741ae9b40351952f98efa33ad |
| 2 | 14745249889 | 6147244 | ffd5d4faae79c382f07fce6db0f2b50b3dbe1d941956bbcfb42ab06857a7ce3c |

The original job logs are987630 and987910 bytes, SHA-256 respectively
3974c1d717312e45a7382e2acac8dd8bd094b95fa6f15aadfdff5d164e8d5e39
and05631e366bc71773ac502d63daadea01cdee25a56dc10e8187ab21b01bdc23bb.
The initial sampled focus did not identify where a native down/up was lost.
Earlier successful runs used the same point and sampled focus/geometry; this
does not establish identical continuous runtime conditions. The historical
Design population failure and the owner's physical-Mac rendering complaint
retain their separate, unestablished causes.

### Three isolated diagnostic outcomes, none release acceptance

1. External ad97f72f8f0035817d2a53be9f97ae94661ce721, sole parent5a13,
   [run45001732291](https://github.com/jeep-jim/OSMINOG/actions/runs/45001732291),
   attempt1/job137144542093, reproduced #download-a failure. Artifact14746616051
   is5215574 bytes/SHA-256
   440d63f0e0a8670cac873609089ef17a9a9b3354abb51a674bce8d192b0da190.
   Original retained PID26302 exited1 with ok=false and restored=true. Guest and
   shell DOM observers recorded only focus/blur, with zero errors/drops and no
   pointerdown/up, mousedown/up or click. Original crop/display PNG hashes and
   dimensions were checked, and the failure image was inspected. No native or
   Electron boundary observer existed, so the earlier loss cannot be localized.
2. Root's eded84c2cd700f898fb06fc2b8e0acabedb54bde, sole parent5a13,
   tree8b845886af4b908b6beec3f2eb5c28314e4408a3,
   [run45002540189](https://github.com/jeep-jim/OSMINOG/actions/runs/45002540189),
   attempt1/job137147004172, passed one standalone retained invocation without
   the preceding baseline. PID25856 ran34797.29525ms and restored successfully.
   Artifact14746069179 is5785920 bytes/SHA-256
   7498a5a3b52a905cf72b8308b082a5fae4e3a9ad5fa7adb7e8a0331f2747bc78.
   All seven guest clicks had complete trusted target DOM chains. All77 native
   events and75 posts had zero errors/drops. Down/up hit the same guest while
   firstResponder changed shell→guest. Pre-post CG timestamps were all zero;
   they cannot establish post-to-delivery latency. The raw338335-byte receipt
   SHA-256 is70f750f0a38ae1b6e52dcc454a482e403c88b3eda4a701953d08af80e1b20a83.
3. External0364a0890a55b3e49ba321dc1914d14786a7bac3, sole parentad97,
   tree73834262611c3d5404d488793a7adceecf557cc9,
   [run45002766834](https://github.com/jeep-jim/OSMINOG/actions/runs/45002766834),
   attempt1/job137147681397, passed. Artifact14746911759 is11067327 bytes/SHA-256
   6d968240b23b64627da791398779ae92617162b36bef476f78a57672e447d68e.
   Retained PID27827 exited0, ok/restored=true. All seven per-click snapshots
   have complete owned-window AppKit down/up, owned-WebContents Electron
   mouseDown/up and trusted DOM target chains, with zero errors/drops there.
   Later final collectors did evict9 AppKit and49 Electron records; the
   per-click completeness must not be relabelled as whole-run no-drop evidence.

Both external workflows ran the original published636 baseline followed by
one retained invocation. The unchanged5a helper independently validated each
baseline, all59 inventory files/hashes, exact immutable636 DMG identity,
different old/new PIDs and baseline-PASS-before-retained order. Their verifier
and cut-prefix SHA-256 values match actual5a source:
cb15af4ecf9a2edf23ddb630c9bd73bfd904e06106241f380b15ed549313c337
andfb9764377ee96143c0f60008fa261b8bfb11386f50fbaefcb76d5533b16a526d.
The proposed local follow-up restoring that preface was stopped before any
runner/test edit, commit, push or invocation after discovering the existing
external run. Provisional workflow edits were restored. There was no duplicate
context experiment. All diagnostic branches remain isolated and are never
merged, pinned or substituted for full installed package gates.

### Publisher610ea12 is a separately reviewed manifest correction

Another continuation advanced PR66 to610ea12feb96b152f2a61d9e84f194ffde75d4a1,
treee9816f09a3a01ad26845b8ecce44df500fd370c1, sole parent3b4febdf. Its only
three-file change aligns the current Mac manifest requirement with the actual
source token real-636-to-637-profile-preserving-replacement, adds regression
tests and a fixture matching all171 ordered source tokens. The source Mac
workflow SHA-256 is5dcb1fdc70dd14d747c70862cb597a93c9e5198fbd02afd0a6a3c65a01a9b33c.
Root passed100/100 tests, three templates and three publish=false plans; all five
contract/registry workflows passed and native publication remained skipped.

Independent review established unchanged reachable Linux/Windows verifier code;
262 of264 Python files are byte-identical, and the two changed Python files
are the current Mac entry and its test. Linux/Windows results remain bound to
the actually executed3b4 revision, with the610 equivalence review separate.
Its report SHA-256 is
c26b8308a43b5b269f4f432f23e5c7e639bf1c2d9b57552c3f11e2994a44e3a9.
No frozen verifier, workload, assertion, schema, publication workflow, pin,
marker or feed changed. This publisher-only declaration correction does not
require source package rebuilding.

## 2026-11-22 — strengthen the existing native-input focus precondition

This change addresses a verifiable gap in CI preparation, not an established
cause of any historical failure or the owner's physical-Mac rendering problem.
The retained fixture already requests application/window/shell focus once and
waits until win.isFocused(). That value alone does not establish completed
application activation on macOS.

Primary sources were read against the exact installed Electron44.5.0:

- [Browser::Focus and Browser::IsActive](https://github.com/electron/electron/blob/v44.5.0/shell/browser/browser_mac.mm)
  map the existing public APIs to AppKit activation and NSApplication.isActive.
- [NativeWindowMac::Focus and IsFocused](https://github.com/electron/electron/blob/v44.5.0/shell/browser/native_window_mac.mm)
  show that window focus queries only isKeyWindow.
- [Public API binding](https://github.com/electron/electron/blob/v44.5.0/shell/browser/api/electron_api_app.cc)
  exports app.isActive() on macOS; the pinned docs/api/app.md and installed
  electron.d.ts agree. No new native-addon function is necessary.
- [Apple activation documentation](https://developer.apple.com/documentation/appkit/nsapplication/activate(ignoringotherapps:).md)
  explicitly permits activation to finish after the request returns and
  distinguishes making a window key from application activation.

The intended correction keeps the same single app.focus/show/win.focus/shell.focus
sequence and the same existing until call, label, polling and timeout. On macOS
its predicate additionally requires actual app.isActive() and win.isVisible().
Windows/Linux retain the original win.isFocused() predicate and never call the
Mac-only API. The last successful raw readiness snapshot is saved in the
existing guest-attempt record without an additional pre-click read.

This tightens a setup condition: it does not retry a click, delay down/up by a
new dwell, synthesize DOM input, change the real target/trusted-click predicate,
extend any workload budget, alter the native input driver, add a production
focus policy or import diagnostic observers. Readiness of a specific Chromium
guest and actual click delivery remain subject to the original native gate.
All new-source Mac/Windows/Linux packages must be tested on that source; the
successful5a packages above are historical evidence after the source advances.

### Final focus-precondition validation before push

The actual old retained focus function was exercised by the new regression:
with windowFocused=true/appActive=false it finished after the first poll instead
of waiting for activation. Before integration the nine new cases produced
6 PASS/3 FAIL; the other failures showed the absent readiness result/record.
The5030-byte RED log SHA-256 is
b343326f13f9d76bb0abe4bdc8bfc9e016192d461acb1f17d5c2966b42fee127.

After integration, author and root independently passed all13 targeted cases,
with zero skips: nine new cases plus four existing guest-observer cases. They
execute the actual retained focus/guestClick and original until implementation,
including unchanged10000 ms/25 ms polling, the shorter overall deadline,
original error identity, one activation sequence, one native post, no Mac API
reads on Windows/Linux and unchanged rejection of wrong-target/untrusted events.
The author's3913-byte log SHA-256 is
25e8da08dbdcb9b57e2a42fe79514be802f47ed07d4538f22d628ba841fd5e09;
root's3917-byte log SHA-256 is
93660e65095a2e344319ffaf713b0ffe5caf8a4c1bccf855da185e364b5ecc3b.

Two independent read-only reviews passed. Exact loaded Mac/Windows/Linux build
filters include mouse-636-native-input-focus.cjs and exclude its test. The
existing143-file unit enumerator discovers the new test; no build config or
workflow changes were needed.136 production paths, including the complete
desktop/mouse directory, browser.cjs, mouse-desktops.cjs and native .mm, remain
byte-identical to5a13. The .mm SHA-256 remains
a30000b58233b77e5aa8964bc5bef402152505899c6ea10fb4ebd0d7ee846c39.

Frozen changed-code SHA-256 values:

| File | SHA-256 |
|---|---|
| mouse-636-native-input-focus.cjs | f1d9f6c6036348b2fcf537dc86182567bd51952feb73d451f64373a052c63205 |
| mouse-636-native-input-focus.test.cjs | 616e30b1a38bb5d669ca13549b2f2b8176b76fe68c2b5438aa0dbc56c8e2c6c4 |
| mouse-636-retained-smoke.cjs | 229cf2498f7740bdf2c8840e5485e8d825c99c9cd9f396524171f97558d8a723 |

Syntax and git diff --check passed. No native acceptance is assigned to these
changed sources before their own complete installed-package workflows and
independent artifact checks. Original failed runs remain failed, and diagnostic
successes do not substitute for those required gates.

## 2026-11-22 08:59 UTC — source85 native outcome and owned Local fixture cleanup

Common source85d97a101f6d6f24d52bd5cfb8e771eb8269c534, tree
dd2db50b5c7ecdb6943b8df5ad385c4bd73fdae8, was pushed with an expected5a
head lease after all four uploaded blobs and the complete tree matched the
reviewed local bytes. All eight auxiliary workflows passed. Public37 has not
been published and all three publisher610 pins remain unready.

### Mac85: earlier gates passed, strict Local restoration failed

[Mac run45004119570](https://github.com/jeep-jim/OSMINOG/actions/runs/45004119570),
attempt1/job137151801797, failed the installed step at08:53:14 UTC. The source
build and units passed. The same attempt passed its published636 baseline,
retained636 native clicks, strict637 performance and new637 WRITE/READ features
before failing in the later retained `--mouse-smoke-write` Local fixture.

The original verification artifact14747068228 is48,613,694 bytes, SHA-256
24c4f8d5a12fea2f7f50666a4bb33c9f5af76f860a522f787fb487258b005f4a.
It was safely extracted into412 files (61,560,820 expanded bytes); root
independently rehashed the archive and every extracted file. Complete job log:
1,078,855 bytes, SHA-256
c33a795d9eeb3479c92fc3f8ade05fb614af9d3e5fa833db0148f07c886274cd.
The retained Local report is54,816 bytes, SHA-256
8a041272be1ad76a9c0d78c00e8915427875aba52d3a3b54723b743219e6a730.

All seven guest-click records carry the successful exact readiness snapshot
`{windowFocused:true,appActive:true,visible:true}`, one native post and the
required trusted target event. This is a successful observed85 run of that
subgate, not proof of the historical lost-click cause. Strict637 performance
and38 new feature frames passed. Both actual circular updater captures were
visually inspected: centered original mouse, annular controls/curved labels,
round close/minimize and strong dimming. Those declared visual-state fixtures
do not independently establish update transport or installation.

The failing assertion is the original `bank.snapshot()` deep equality in
`mouse-628-local-smoke.cjs:157`. Raw Local has `completed:true`, no workload
error, `restored:false`, and a cleanup error. An extra internal start ID
99226ddd-6115-46af-9484-80c804001e89 appears in final membership/history; it is
different from the actual fixture localhost page
578fdb4b-f297-414e-a9f7-063619b24eda. The raw failure does not record the extra
ID's creation instant, so that instant is not claimed from the archive. The
private transition checks had already passed; this is not evidence of private
data leaking into the normal profile.

Actual source review identifies a deterministic fixture restoration gap:
the fixture explicitly applies the current Agents preset, which creates its
dedicated internal `mouse://start` landing when it has no remembered preview.
`mouse-start.cjs` keeps these identities in its separate `startService.tabs`
map. The old fixture snapshots only native `browser.tabs` and closes only its
new native localhost page. The new internal landing therefore survives its
cleanup and authoritative reconciliation correctly adds it back into the bank.
The existing strict bank assertion exposed that incomplete cleanup.

A minimal correction is being tested in the retained fixture and its caller:
pass the existing startService, snapshot all original internal start IDs,
capture the exact Agents landing ID returned after the existing awaited mode
setup, and record ownership only if it is new to both original maps and is
actually present in startService.tabs. Cleanup closes only that known owned
internal ID, alongside the existing known localhost cleanup. All original
bank/native-page identity, URL and navigation-epoch assertions remain; a new
strict equality also covers every original internal start ID. Unknown extra
tabs must still cause failure. No production mode/page lifecycle, user data,
native input, timeout, workload, pixel or performance acceptance changes.

No unchanged85 retry was requested. No candidate package artifact was uploaded
because source binding/upload were skipped after the failure. Full independent
Mac actual-package acceptance is false. Passing earlier subgates cannot replace
the complete required Mac run.

### Linux85: complete native and independent actual-package acceptance

[Linux run45004119568](https://github.com/jeep-jim/OSMINOG/actions/runs/45004119568),
attempt1/job137151801928, completed SUCCESS at08:53:39 UTC. The full independent
unchanged publisher610 gate ran once in137.807809673 seconds and passed. All264
Python verifier files matched publisher610 Git bytes before and after, and426
consumed evidence files remained unchanged. The full chain includes original
retained gates,38 feature frames/WRITE+restart, actual Files transfers, strict
published636 comparison, replacement and profile preservation.

| Linux85 evidence | Bytes | SHA-256 |
|---|---:|---|
| Candidate artifact14746499410 | 241170243 | fb07a5e842a110e96e49ab656a9f856bbecc8678400315999375b67b028cefb8 |
| Verification artifact14746773836 | 40869676 | 44689d1e1a2f862f4a8569b0301666c4883788af9aed3ff465c1e5e2662991e0 |
| Actual AppImage | 135776054 | fedd81ae33fa5e6af648e7d08612b7078ac4972c1c032e16219656911e11d73d |
| Actual DEB | 105926088 | 7e0a6cab3e31c0cddaa4888ed9279e5a70deb7b9dcbddb182afe2cd97469ceda |
| Full independent result | 331570 | 1011dde85fcc618bb5b0d4c18b9b437ac23358261302cf1dcdb9057b356c0c08 |
| Provenance record | 9862 | f218283ed57ed13f5499818c1683cc8a3100bdd3c082fec7930d017405a6828f |

Root rehashed both archives, both actual packages and the full result. The
proposed pin remains unapplied with ready:false/sourceMerge:null. This result
belongs only to85 and must not transfer to a later common source.

### Windows85 and external historical continuation

At08:59:30 UTC Windows45004119569/attempt1 primary137151802053 was still
executing installed step10; its modern job did not yet exist. No Windows85
acceptance is assigned. Any source change requires newly bound native and
independent results for the final common source on all platforms.

A fresh read of both PR descriptions also discovered an external historical
5a attempt3 report: run45000235119/attempt3/job137151485860 failed in published636
baseline OS pixels before launching candidate637. That is distinct from the
current85 Local failure. The external continuation also reports0364 diagnostic
attempt2 failing in baseline before the retained candidate. This continuation
did not request either repeat; earlier no-third/no-repeat statements record its
own decisions at those times. Both external histories remain in the PR bodies;
no original failed attempt is overwritten or reclassified as success.

The monitor was updated to strict read-only status with this current blocker,
historical distinctions and no independent rerun/merge/publish authority. The
source/publisher PR descriptions preserve prior entries and identify the local
fixture repair under review. The owner's physical Mac still requires testing
after a real public37 update; its rendering complaint is not declared fixed.

### Local fixture correction — completed review and actual-source RED/GREEN

The correction above is implemented. The actual old85 Local fixture was loaded
unchanged from Git for a controlled RED run (outside the repository). Its
original strict bank comparison fails after real Agents setup because the new
internal ID remains in membership, order and history. The historical source is
36,695 bytes, SHA-256
f81454ce38be5c411f7fecf384441eb6b8ac3812f90842f940565ea1f22bb0b9;
root compared it byte-for-byte with `git show85:desktop/mouse-628-local-smoke.cjs`.
The failing one-test RED log is11,020 bytes, SHA-256
d0c21d6a2ad20dee2710119f000a8db052b804ae37674974b8b254196e03a6c8.
This is the original restoration assertion failing, not a missing new helper
or a fixture setup exception.

The new six-case test installs actual mouse-start and DesktopService in their
production order, uses the actual renderer preferences projection/TabOrder and
executes the current fixture's snapshot, Agents setup, catch/finally and strict
assertions. Only Electron surfaces are explicit unit adapters. Coverage includes
preserving active/other-desktop native and internal pages, reusing existing
native/internal Agent landings, refusing to sweep unexpected extra pages,
already-closed owned pages, exact cleanup-error identity and precedence of an
original workload error. These unit results do not claim native GUI acceptance.

Author:6/6 PASS, zero skips;1925-byte log SHA-256
d00374aa3db6f2421f3a04c32abc0c40e62aca8b94e5c88649767ae263a91c25.
Root independently ran those six plus the five existing Local theme/visibility
tests under exactNode22.23.5:11/11 PASS, zero skips;3225-byte log SHA-256
b1056744d33d6bfcbdeb4109672575fa056954832e564198272ce1f696d95d8e.
The new test is automatically selected by the existing Mouse unit enumerator;
no workflow or build configuration changes are needed.

Independent read-only review of both changed fixture files, the new test and
actual Start/Desktop/Modes/private lifecycles passed without blockers. Ownership
is restricted to the recorded new normal start ID; the normal store is not
replaced with the ephemeral private store. Existing native actions, target and
pixel predicates, budgets and all previous restoration assertions are unchanged.
The caller passes the already existing startService; no production lifecycle
change or blanket removal of new tabs is introduced.

| Changed test code | SHA-256 |
|---|---|
| mouse-628-local-smoke.cjs | 3338789efb1471edeb9ca19ede7d809b0ec55ef700e9349ef2cc652b77ee20af |
| mouse-smoke.cjs | 9a3d8de6909401903be6e75a4016356dada5b2231ca2562a1c36a5647f19e883 |
| mouse-628-local-fixture-cleanup.test.cjs | 3367974e090c0faa9143b290001b04b1f90340cedffe31a48eaab0f7816bd5b2 |

The next common source still needs its own full native and independent package
checks on all three platforms, both Windows jobs, accepted source merge and
fresh publisher installation gates. Linux85 acceptance remains historical for
any later source; Mac85 remains failed. No readiness pin is being applied here.


## 2026-11-22 09:23 UTC — source554 Mac retained622 отказ; Linux полная приёмка

Общий source остаётся `554fbd5c1da7dbe385fab1385d8f51dc06595d4f`, tree `341a27fbad5a8ab07a18890d69703c1e25690055`, sole parent85d97a10; publisher610ea12 не изменён. Все8 вспомогательных554 workflow прошли. Повторные неизменённые запуски не создавались.

### Фактический Mac554

[Run45005647659](https://github.com/jeep-jim/OSMINOG/actions/runs/45005647659), attempt1/job137156525168, step17 завершился FAILURE09:17:16 UTC. Published636 baseline, retained636 (все7 guest actions), strict637 performance и637 WRITE/READ (38 кадров) прошли раньше в том же запуске. Исправленная Local628 очистка теперь `status=pass`, `completed=true`, `restored=true`; owned landing `b786db14-6e5b-4699-8268-491a7b64afc5` учтён. Это не полная приёмка Mac.

Новый отказ в `--mouse-smoke-write`, `mouse-622-smoke.cjs:96`: после одобренного Agent ввода полное значение `#draft` ожидалось `agent-622`, фактически `preserved-pagent-622reset-88472ae9-ec77-429e-9f59-2aa93076b6fc`. Исходный sentinel — `preserved-preset-88472ae9-ec77-429e-9f59-2aa93076b6fc`; точное разложение actual = original[:11] + `agent-622` + original[11:]. Значит вставка выполнена; замена всего поля не выполнена. Raw не содержит selectionStart/end или receipt Meta+A, поэтому причину несработавшего выделения не устанавливаем.

Verification artifact14748430320:70405412 bytes, SHA256 `63674fbb9cb826c3eb6e1387582f8379d5075758b8f027d4a1738d033e304d72`;662 файла безопасно извлечены и повторно проверены. Log1111584 bytes/SHA256 `7619fcb4e7562d8a55eeb05ce7be4d1ef2829c80145a51e6c5264550b1252053`. Root отдельно перепроверил архив, log и7 существенных raw-входов. Candidate upload пропущен; DMG/ZIP artifact и full independent Mac acceptance отсутствуют. Immutable610 offline sweep на failed native не запускался.

### Linux554

[Run45005647693](https://github.com/jeep-jim/OSMINOG/actions/runs/45005647693), attempt1/job137156525531: native SUCCESS09:13:19 UTC. Полный independent sweep под неизменённым610ea12 выполнен один раз, PASS138.701562570 s. Все264 файла валидаторов связаны с Git до/после;426 evidence файлов,38 кадров,180 native inputs, restart,7 guest clicks,3 настоящие передачи файлов, update636→637/profile и строгий performance проверены. Root перепроверил actual packages, оба архива и independent result.

Candidate14747509384:241170511 bytes/SHA256 `9525e48d8322d1e080f2b044569f390c70ec92d86378f610b93c00a249f7a79c`. Verification14747294998:40801462 bytes/SHA256 `900eebd42f463b0f80875ce06ac4a5ad569953bf0a54fe6d887150fc077efc86`. AppImage135775865 bytes/SHA256 `2b2452737461f84265509a7913a88d2d34092f263cc7ff4835d94186b91eaba8`; DEB105926792 bytes/SHA256 `88a7073eb63a6fe5a1aba5a94358abda0256816e638e767ccbd5b0c1a19f608b`. Independent result331309 bytes/SHA256 `8711800a5400a2b2e7f748679d004ca72813f5f1128706a4bf3898e90501282f`; provenance10475 bytes/SHA256 `5974eb62676e20879749c94f1c6623e5fc47af1afbc06d633fdcbc225bc31349`. Proposed pin неприменён, ready=false/sourceMerge=null. Приёмка относится только к554.

### Узкая причина конфликта fixture и продолжение

Два независимых чтения actual source подтвердили: исходный636 retained622 вводил через прежний approval/SDK в пустой `#draft`. Новый637 shared preset proof заполняет то же поле sentinel для проверки сохранения формы, а622 добавил synthetic Cmd/Ctrl+A без readback selection. SDK/host по прежнему контракту вставляет текст в выбранное поле, не обещая очистить его. Production-дефект на этих данных не доказан.

Выбрано разделить две owned test fields: оставить preservation sentinel нетронутым, дать retained622 Agent-сценарию отдельное пустое поле, сохранить исходные approved click/type и строгое полное значение, дополнительно проверить сохранность sentinel. Исправление и actual-source regression готовятся локально; native success заранее не объявляется. Никаких production SDK/host, permissions, private boundaries, native workloads, frozen validators или бюджетов менять для этого не разрешено.

Windows45005647664/attempt1/primary137156556757 в09:22:48 UTC ещё выполняет installed step10. Если source сменится до обеих native Windows проверок, сохраняем terminal history, не запускаем полный offline sweep superseded554 и не переносим приёмку. Новому общему source нужны собственные три platform gates.

В09:21:32 UTC все3 public feed по-прежнему6.0.36. Source193/publisher66 draft/open, все pins unready. Круглый updater и combined changes в candidate, но37 не опубликована. Исправление зависаний на физическом Mac владельца не утверждается.


## 2026-11-22 09:31 UTC — изоляция retained622 Agent ввода; actual-source regression

Узкое исправление готово: новый `mouse-637-agent-input-fixture.cjs` используется только622 fixture и добавляет отдельный пустой `#agent-draft` только в корневую localhost-страницу. Для остальных страниц байты общей `ownedPresetPage` сохраняются. Префикс637 включается существующим build glob, build configuration не менялась. `mouse-622-smoke.cjs` сохраняет прежние approved click/type и полное строгое значение `agent-622`; synthetic SelectAll подготовки этой стадии больше нет. Shared `#draft` не выбирается, не очищается и не редактируется.

До ввода проверяются точный sentinel, пустота и доступность нового поля, finite page identity/timeOrigin и actual WebContents ID. После ввода проверяются полный результат и неизменность sentinel, актуального WebContents ID, native URL, href, timeOrigin, identity и navigationEpoch. Каждый readback заново берёт `page.view.webContents`; before/after сохраняются в `facts.agentInput` и существующем failure context. Никаких новых waits, retries или бюджетов. SDK/host, shared preset proof, native input helpers, permissions и private data paths не изменены. Эти дополнительные raw-поля совместимы с неизменённым publisher610 reader; validator не редактировался.

Root отдельно подтвердил baseline provenance: immutable36 Mac pin указывает source `7c09b6cb9885ce72be41e8f16a35d4c55c9ecde3`, merge `94d5c3d1b7fa7652a0f55b73ba3847458b3d053f`, PR190. Его622 source25516 bytes/SHA256 `51a3f4fabadd18ae0941eee7ae26a7fca69c1903b1a896ebfb782671b2a6285e` действительно создаёт пустой #draft и проверяет approved click/type без SelectAll. Это совпадает с прочитанным peer ancestor061bab77 по байтам. Причину исторического Mac shortcut отказа не объявляем установленной.

Независимый новый `mouse-622-agent-input-fixture.test.cjs` исполняет фактические HTTP callback, approve и Agent stage из source622, настоящий shared preset seed, AgentController и AgentHost с их scope/consent checks. Только DOM/CDP окружение — явно unit adapter.8/8 PASS,0 skip подNode22.23.5; peer review и root review PASS. Тест охватывает root-only field, сохранение seed, отсутствие/занятость/disabled/readOnly target, повреждение sentinel до/после, отклонённое согласие без CDP insert, замену актуального WC и строгие output/navigation/timeOrigin/identity assertions.

Неизменённый554 source25579 bytes/SHA256 `35de273010c93eff4c8c392610e87a2188f658d251f887bf0fceed59e8bd7957` побайтно сверен root с Git. Тот же тест даёт RED именно на прежнем strict full value: `preserved-pagent-622reset-owned-agent-page` против `agent-622`. Unit adapter моделирует наблюдённую невыделенную позицию11 и не утверждает причин Mac keyboard behavior. RED log1559 bytes/SHA256 `60ad8d87e80eb16d125c805cbc953dad4a9beaeed956061131beaab3c3afaa06`; GREEN2340 bytes/SHA256 `33263c7f84b63a519270898faab613fc8f2c0a507ff5c1d9e2bc4623b5e46384`.

Root отдельно исполнил все8 новых cases:PASS. В том же необязательном расширенном запуске прежний `mouse-agent.test.cjs` не загрузился из-за отсутствующего локального ws dependency; этот общий запуск имеетexit1, не называется зелёным. Log3768 bytes/SHA256 `5916bea895fd6ca399f44a46d1d8f4ab25736d143cca849023871ffb1521169b`. После подключения уже установленного private runtime через временный node_modules symlink, удалённый после остановки проверки отдельный старый suite не завершился за примерно65s и был остановлен(exit130); full local Agent suite PASS не заявляется, причина незавершения не установлена. Это не меняет обязательный полный CI unit/native gate нового source; новый8-case regression и его independent author run оба прошли. Новых повторов optional тестов не делаем.

Замороженные файлы: helper2699 bytes/SHA256 `b13645768f520b119a45de173ed27244c031a1550c3b36df2e2ede56e8662692`;622smoke25382 bytes/SHA256 `1d49f753d0c561026930a230c9d97cb843542ecee9b2739c72f8fbf2dc86d51a`; новыйtest13139 bytes/SHA256 `40107d2d522ffb7dab2b65ed7acd5b34654afef597b92e7b4e8837f03e113e6b`. Вместе с этим append-only журналом planned source delta — ровно4 файла. Commit ещё не создан на момент записи; перед push required fresh554 lease и проверка полного Git tree. Новый source потребует собственные Mac/Linux/Windows gates; старый Linux554 PASS не переносится.

Windows554 primary137156556757 завершилсяSUCCESS, modern137162028752 выполняется. Первичные candidate14748147808 иverification14748147815 сохранены: ZIP125617142 bytes/SHA256 `f611d1916b8d7cf0ef57c8208f8781f3fc5a3b0a8a18c3ddb6370f93733d4949`; ZIP82012042 bytes/SHA256 `cab6e09a999c5f63ab7c0ed53b6df7935bccceee0a9f4604d7250e1567182ca3`. EXE125904616 bytes/SHA256 `2f54f4fbb84630707e189cb5ada1db44554c67c57d4a6c7796e4af070cec0c02` связан с manifest/raw. Полный independent554 Windows sweep не запускался при подготовке следующегоsource. Publisher610 и все unready pins остаются прежними;37 не опубликована.


## 2026-11-22 — решение владельца удалить встроенного агента

Владелец прямо отменил Agent Mouse целиком. Исправление Agent622 и приёмка прежнего состава554 остановлены; готовится удаление runtime/UI/настроек/режима и поставляемых зависимостей. Предыдущие результаты остаются историей и не принимаются за проверку нового кода. Pins не заполнены, новая версия не объявлена опубликованной. Актуальная граница и последующие результаты: [удаление агента](2026-11-22-mouse637-agent-removal.md).

### Сверка параллельного50c перед удалением агента

Свежая lease перед push обнаружила source50cfd797e08f6e17503f8eff521d7b7e57881887, содержащий только дополнительную Agent622 fixture correction и журнал выше. Его история сохранена; дальнейшее удаление строится поверх50c, а не перезаписывает ветку от554. Новый Agent-only input helper и его test удаляются вместе с отменённой функцией; остальные браузерные изменения не затронуты. PR193 уже фиксирует решение владельца об удалении и отказ от публикации старого состава.

Дополнительная проверка перед push: исправлено сохранение реального custom AI chooser, удалены пять obsolete Mac Local MCP file assertions; root6/6 адресных тестов PASS. Полный состав и проверяемые границы — в журнале удаления агента. Нового native acceptance пока нет.

## 8a native rejection and scoped fixture corrections

Source8a Linux45009215076/a1 failed the second AI preview drag trusted-pointerup observation; Mac45009214966/a1 failed a removed-but-still-used node:path import in622. Independent98 actual removal evidence also rejected empty cookies caused by noncanonical fixture routes. Original archives/logs are preserved and rehashed. Three reviewed fixes preserve all production/native actions, deadlines and cookie/pixel/identity requirements: restore path import, canonical real cookie-scoped pages with mandatory cookie proof, and bounded trusted-release observation with failed-attempt receipts. Root full units1201:1197PASS/0FAIL/4nativeSKIP. Detailed original hashes, RED/GREEN evidence and limits are appended to 2026-11-22-mouse637-agent-removal.md. No8a full acceptance or unchanged rerun; the new common source requires fresh platform acceptance.


## be86 native results and Mac predecessor window preparation

Sourcebe86 passed full Linux native and independent actual AppImage/DEB acceptance under unchanged publisherae72. Mac45010898616/a1 passed general/current/retained browser checks but failed the first actual636 update-button trusted click: posted point(1347,915) was below the recorded1600×900 display, inside an oversized1440×960 predecessor window. Original raw ZIP/log and exact geometry are preserved and root-rehashed; no unchanged rerun or Mac acceptance. Windows45010898421/a1 primary passed; same-attempt modern remained in progress when recorded. A scoped CI-only Mac owned-window fit/live-target correction is being prepared; published636/product/native driver/trusted inputs/profile/deadlines remain unchanged. All details and artifact hashes are appended to the agent-removal journal. The complete current PR193 body is preserved in2026-11-22-mouse637-pr193-history.md before shortening live PR status; no history is removed.


### Scoped Mac window preparation reviewed before new source

The owned installed636 Mac update-button harness now fits its real window into the live matching workArea, waits for actual bounds/renderer layout and remeasures each target before the original single native click. Minimum size, stock updater/installer/profile, native driver, trusted-click predicates and300000ms budget remain unchanged. Root and author each passed28/28 synthetic actual-path tests on local Node24.22.3; root preserved an exact-be86 RED log showing the original trusted-click failure. Code/test hashes and limits are in the agent-removal journal. Publisherae72 is unchanged. Both be86 Windows native jobs finished SUCCESS (modern10:41:01 UTC) before advancing the source; full offline validation remains separate. New source still needs its own three-platform/native/independent acceptance. No publication or physical-Mac fix is claimed.


## 2026-11-22 — единый source 002 принят и объединён, публикационные проверки продолжаются

Source `0021084ccb9537e657d21e6f0c8e812dee6b461f` прошёл свои Mac, Windows (primary + modern) и Linux native gates и полную независимую проверку неизменённым publisher ae72 на настоящих установщиках. Встроенный Agent удалён из текущего продукта и пакетов; сохранение профиля и штатные обновления проверены в native runners. Исторический Mac attempt 1 timeout сохранён; единственный контролируемый attempt 2 прошёл без изменения кода или deadline. Физический Mac владельца этим не проверен.

PR193 объединён как `e6e27b26ae719f50beeb5a2244dc6d2c6ddcdab1`. Три готовых pins относятся к одному принятому source и конкретным artifacts; PR66 объединён как `a464a5398fa7afca55e1b1116ff8510895ae488f`. Свежая native-проверка publisher является отдельным обязательным этапом перед публичными assets/feeds. Linux publisher run45018600676/attempt1 остановился до publish/channel; Mac45018600669 и Windows45018600697 на 11:48 UTC ещё проверяются. Публикация не объявляется завершённой. Точные source hashes, run/attempt/job, первый Mac отказ и фактические merge записаны в [журнале удаления агента](2026-11-22-mouse637-agent-removal.md#2026-11-22--source-002-принят-на-трёх-платформах-и-объединён-публикация-проверяется-отдельно).
## 2026-11-22 12:24 UTC — публичные Windows/Linux; Mac остаётся в проверке

Windows6.0.37 опубликован12:11:26 UTC ([release](https://github.com/jeep-jim/OSMINOG-Releases/releases/tag/mouse-windows-v6.0.37-x64), [publisher run45018600697](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/45018600697)); Linux6.0.37 опубликован12:07:39 UTC после добавления отсутствовавшего x11-utils только в publisher environment ([release](https://github.com/jeep-jim/OSMINOG-Releases/releases/tag/mouse-linux-v6.0.37-x64), [run45019759421](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/45019759421)). Source002, EXE/AppImage/DEB неизменны. Actual assets/feeds, fresh native raw и anonymous shipped-updater downloads приняты независимо и повторно сверены root. Детали, размеры и hash приведены в журнале удаления агента.

Единственный контрольный Mac publisher attempt2 на прежнем a464 завершился отказом12:06:36 UTC до pin click: backend entry уже появился, но one-shot CI renderer query не дождался кнопки «Закрепить». Все исходные raw сохранены; publish/channel не исполнялись. Новый внешний publisher-only readiness adapter ещё пишется и проверяется. Прежняя source приёмка Mac остаётся действительной для неизменных packages, но не заменяет свежие publisher gates. Никакого следующего неизменённого повтора или подмены публичных6.0.37 packages. Физический Mac владельца не проверен. Лендинг разрабатывается отдельно и в эту работу не входит.


## 2026-11-22 12:40 UTC — Mac publisher correction объединена

[PR68](https://github.com/jeep-jim/OSMINOG-Releases/pull/68) принят после root130Python+12CJS, двух независимых обзоров и всех5 exact-head PR workflows. Новый CI-only driver ждёт фактическую кнопку расширения и завершение renderer pin state при прежних deadline/native inputs; executable/ASAR/native addon bytes, signatures, source002, pins и прежние independent gates сохраняются. Merge `534f93defd61064ca0cbd8bc40fc670466bf9f42` соответствует проверенному tree. [Mac publisher45023380889](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/45023380889), attempt1/job137211122777, начал полную свежую приёмку. Исторические отказы сохранены; успешные local/PR tests не заменяют native/public acceptance. Windows/Linux уже опубликованы с неизменными пакетами; Mac пока проверяется. Полные hashes, protocol experiments и scope — в журнале удаления агента.
