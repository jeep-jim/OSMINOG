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
