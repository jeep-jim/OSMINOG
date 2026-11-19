# Mouse Browser 6.0.29 — restore owner-approved pane colours and input

## Current owner requirements

The owner rejected the 6.0.28 visual/input regressions. Preserve the separator
colours from the published 6.0.27, remove only the Nora outline/rim, keep Nora
above all hosted website panes, remove square corner fragments at pane junctions,
and switch Mouse desktops using two-finger trackpad scrolling or a mouse wheel
inside Nora. Do not use the macOS three-finger Spaces gesture.

The previous 6.0.28 journal entry describing a three-finger gesture as requested
is superseded by this explicit correction. History remains intact; it is not an
instruction to restore that recognizer.

The latest supplied screenshot points to browser scrollbars, including white
horizontal and vertical bars in VK. Normalize native web scrollbars to a thin
browser theme without changing website content or form colours. The screenshot
contains personal content and is not included in the repository or evidence.

## Verified baseline and implementation

- Published 6.0.27 source: `acbcf36beff4ec504b018402227e5b553e4f0fdc`.
  Its existing `--line` tokens are dark `#43536b`, light `#c7cfdf`.
  The 6.0.28 stylesheet overrode pane/divider fill with `--bg`. The correction
  uses `--line` for the stage/branches/panes/dividers and the native corner mask.
  Existing borderless padding and removal of decorative resize grips remain.
- `OverlayGate.hide()` now enforces actual native guest/clip visibility even
  while an owned Nora surface hold preserves the parent hierarchy. The workspace
  also reconciles native visibility with the desired value when the cached
  logical flag is unchanged. Thumbnail captures use `stayHidden:true` and
  `stayAwake:false`, including captures finishing after Nora opens.
- The BrowserWindow `swipe` listener is removed. Trusted wheel input is scoped
  to open Nora: horizontal two-finger scrolling within the panel, vertical or
  horizontal mouse wheel over desktop thumbnails/tutorial. History, tab lists,
  editable controls and modifier gestures retain their own input. Momentum is
  latched until the input stream is idle. Tutorial completion requires a real
  adjacent desktop change; normal/private completion remain isolated.
- The sandbox preload installs scrollbar-only CSS using
  `webFrame.insertCSS(...,{cssOrigin:'user'})`. It overrides author scrollbar
  styles for HTTP(S) documents, follows the browser theme, and does not modify
  `color-scheme`, content backgrounds, form controls, overflow or stored state.
  Custom DOM/canvas scrollbars and unavailable iframe/shadow content are outside
  this normalization guarantee. A cause specific to VK on the owner's machine
  has not been independently reproduced.

## Verification contract

The existing installed Mac suite remains required, including documents,
palette, Local MCP, per-pane progress, Nora motion/trace, desktop transitions,
privacy, restart and the profile-preserving updater. Only the revoked
three-finger contract is replaced with trusted native wheel input; physical
trackpad testing is explicitly recorded as unperformed in CI evidence.

New `mouse-629-ui-smoke.cjs` creates seven uneven, vivid native website panes
in the isolated CI profile. For each theme it verifies the exact 6.0.27 colours
and actual cutout/interior/divider pixels before and after resizing. Display
framebuffers and lossless window crops are archived. Nora acceptance requires
actual fill pixels at several positions overlapping guest viewports, all seven
native guests hidden, seven decoded snapshots, and unchanged page identity,
fields, viewport, scroll and native bounds through open/close.

New `mouse-629-scrollbars-smoke.cjs` loads an owned loopback guest with author
white `!important` scrollbar styles and an explicit light colour scheme. Both
browser themes must override root/nested scrollbar colour/width while preserving
site/input styles and geometry. Trusted Electron native mouse-wheel input must
scroll each real container without changing the Mouse desktop. Its screenshots
are identified as guest captures, not display-composition proof.

## Local results before the first Mac candidate

- Changed-behaviour suite: **72 PASS / 0 FAIL** (overlay visibility, previews,
  themes/native mask, sandbox preload, scrollbars, gestures, identity/version).
- Attempting the complete source workflow suite in this Linux checkout yielded
  **546 PASS / 5 FAIL**. The five failures were unavailable pinned Agent SDK/ws
  dependencies or the macOS-built `mouse-mcp-fs.node`, not assertion failures in
  the changed behaviour. The unmodified complete suite is required on macOS CI.
- New/changed JavaScript syntax and `git diff --check`: PASS.
- Local Chromium launch is unavailable (`socket() failed: Operation not
  permitted`). No local native visual success is claimed.

Installed macOS acceptance, exact artifact hashes and public publication remain
pending at this checkpoint. Results are appended below after execution.


## First installed candidate — failed motion gate, no publication

Source `25ba4f754ddea5d8d1c0d1acf7dfe8dc6bff2c29`,
[PR170](https://github.com/jeep-jim/OSMINOG/pull/170),
[run44482527827 attempt1](https://github.com/jeep-jim/OSMINOG/actions/runs/44482527827),
job135417949950: suites176/176,586/586,521/521 PASS; DMG/ZIP built. Installed
Local MCP and per-pane progress gates passed. The light Nora closing gate then
recorded only two intermediate RAF samples instead of the required three and
failed. This attempt is not accepted or published.

Verification artifact14508799186:6269554 bytes, SHA-256
`7ebf9a05c1914ff961ea10f76deaba6182107e512442f75608c12e0880294d16`.
The preserved trace contains58948 events with no reported data loss. Closing
intermediate samples were at renderer times8418.3ms(progress0.9788) and
8545.4ms(progress0.6754); renderer long-task list was empty. GPU trace showed
Dawn/IOSurface command waits of approximately79–119ms across that interval.
This does not establish whether capture overhead, runner load or application
behaviour caused the delay, and does not establish smoothness on the owner's Mac.

The following candidate moves the new seven-pane/Nora/scrollbar regression scenes
before the retained628 motion gate so a later motion failure cannot hide their
results. No frame threshold, animation timing, pixel tolerance or release gate
is weakened. Cleanup now additionally asserts exact desktop bank/preferences,
and scrollbar failures retain their partial native evidence.


## Second candidate — dense layout exposed a fractional-boundary defect

Source `8c64a10373fa20f56c17289c6e35876677a9562c`,
[run44483684227](https://github.com/jeep-jim/OSMINOG/actions/runs/44483684227),
job135421801079:176/586/521 test batches and native package build PASS. The
seven-pane light-theme initial/resized scenes passed all90 pixel probes each.
Nora then failed to open, so the full candidate remained FAILURE/unpublished.
Verification artifact14508928742:4891719 bytes, SHA-256
`c98689163cf37c3b9c8b152d5674ce732783b2cf069582cacdfc931334a28323`.

The saved divider centres are514.4375 and703.921875 with6px gutters. Thus the
real DOM pane spans x517.4375→700.921875, width183.484375. The workspace correctly
rounds shared endpoints to517→701, width184. `mouseFloatingBackdrop.buildImages`
incorrectly compared raw width differences with `<0.5`:0.515625 rejected this
valid native capture before image decoding/readback. All seven native captures
had completed in99.64ms. The corrected backdrop compares the same independently
rounded endpoints as `BrowserWorkspace.layout`, retaining exact rejection of a
stale surface or a real boundary change. This is a product correction for dense
fractional layouts, not a widened test tolerance.

Native629 failure reporting now retains renderer/backdrop state before cleanup
and a display screenshot. Pixel sampling reuses one bitmap per native frame
instead of allocating a full bitmap for each probe. A new installed run must
confirm the backdrop correction and all remaining themes/gesture/motion gates.

Fractional-boundary regression tests reproduce the old failure through the real
`BrowserWorkspace.layout` with mocked native views, including the exact captured
183.484375→184 case. They also reject independently rounded/stale widths and a
subpixel move crossing a native endpoint, and cover replacement behind open Nora.
59 focused backdrop/slide/theme/gesture tests PASS after the correction; the new
cases failed before it. No animation duration or frame acceptance threshold changed.


## Third candidate — dense-pane correction verified, wheel test sampled early

Source `9a7def0988c09b7566ebdcd59cf4891c8d4cd67c`,
[run44485195422](https://github.com/jeep-jim/OSMINOG/actions/runs/44485195422),
job135426787407:176/594/529 test batches and native packages PASS. Independent
re-decoding of the archived display/crop PNGs confirms all four seven-pane
separator scenes:360 total probes (72 divider,256 corner-cutout,32 page-interior).
Both light/dark Nora scenes pass16 actual overlap-fill probes, all seven native
guests hidden, seven snapshots, preserved page identity/bounds, and restored
desktop bank/preferences. The fractional-boundary opening failure is resolved in
this installed run.

Verification artifact14510896060:5609273 bytes, SHA-256
`548021c49089c25990d54b67000ef905fc40b0a2b8cdc2743094491adf656dfc`.
The run still fails before final acceptance: the scrollbar test sampled the root
at458 after its first160px wheel, then saw460 while testing the nested container.
Recorded trusted native wheel inputs occurred at604.2ms(root) and765.3ms(nested);
final positions were root460 and nested240. Dark root/nested width `thin`, colours
`rgb(104,104,104) rgb(23,23,23)`, corners `rgb(23,23,23)` and site-owned light form
styles were observed as intended. A fixed120ms wait does not establish completed
scrolling. The next fixture waits for actual trusted `scrollend` before sending
the next input, retains exact equality of the untouched container, and records
the completion evidence. No product scrollbar CSS or input-routing rule changes.

This partial native/UI proof does not replace the missing complete scrollbar,
gesture, motion, restart and real-upgrade gates. Publication remains pending.

## Fourth candidate — complete629 UI evidence, retained motion failure

Source `87f2b68941e534881778c5d61ac5f6a47a26ab49`,
[run44487095970](https://github.com/jeep-jim/OSMINOG/actions/runs/44487095970),
attempt1/job135433158784:176/594/529 test batches and native packages PASS.
`MOUSE_629_UI_REGRESSIONS_NATIVE_PASS` is present. Independent verification with
Releases validator blob `04ad715ccb7b2397e7306516c28455c7577d2d83` accepts all four
separator scenes/360 probes, two Nora scenes/16 overlap probes, two scrollbar
guest PNGs and all four actual wheel inputs. Each input has its own trusted
`scrollend`, matching event index and unchanged positions after two RAFs; the
other scroll container and active desktop remain unchanged. Fixture restoration
passes. The exact UI JSON SHA-256 is
`629ced4aa8aac9f3b7dc20bac91a9472b5c41e29fa23b4c1d26a88fa004e14c9`.

Verification artifact14511990271:8610963 bytes, SHA-256
`bed31b6c36e24bf5293231feb34e58b118215ceb51eac3c361a0216931c977b2`.
The complete job still FAILS: retained628 light closing capture times out after
4000ms/11 frames. Archived PNGs1–6 show the fully open panel, PNG7 shows an11px
translation, and PNGs8–11 show no panel. The renderer recorded only two genuine
intermediate translations,12.9789px and290.016px. The first-exterior-edge
comparator agrees with independent pixel scanning; accepting internal white
card edges would incorrectly treat a static panel as moving.

The complete lossless Chromium trace records324.214ms of GPU IOSurface waits
inside the411ms play-request→complete interval; renderer longTasks is empty.
The test frame capturer is active throughout. This establishes scarce observed
frames under GPU waits, but does not establish whether capture or host load is
the cause. Native visibility diagnostics contain no hide/layout/attach operations
during closing: the hold is released once after animation completion. Prior628
source and publisher history also records frame failures followed by successful
same-source runs. One bounded same-source retry was therefore requested as
attempt2, without changing product code, animation duration, capture range,
frame thresholds, timeout or trace requirements. Its outcome is recorded below.

All seven companion workflows on87f2 are SUCCESS. Gesture, restart, private and
real628→629 replacement acceptance must still pass before publication.

## Same-source retry — Nora and wheel switching pass, ordinary transition stops

Run44487095970 attempt2/job135437220042 uses the unchanged87f2 source. It passes
the complete629 UI gate, retained628 Nora motion/content-fit/borderless gates,
open-Nora desktop transitions and `MOUSE_629_TWO_FINGER_WHEEL_TUTORIAL_WRITE_PASS`.
The prior Nora closing failure does not recur. The archived tutorial includes
four normal successful native wheel switches, non-switch rejection, reopened
hint suppression, private completion and fresh-private isolation. Restart is
still false because the separate read process has not run.

Verification artifact14512351654:16957565 bytes, SHA-256
`be9336732337e687278fc60ceb7a025c7691d7f078c71e0c7ea0795a96a444c5`.
Source test batches remain176/594/529 PASS. This is not a successful release
candidate: the later621 scenario calls627 ordinary desktop-transition proof,
whose first forward painted-band capture times out after4000ms/16 frames.
Nora is closed. The627 helper writes its pending transition only after awaiting
capture success, so the failed archive contains no per-frame band counts,
pending transition, or captured rejected PNGs. The available evidence cannot
distinguish missing fixture paint, stale sampling geometry, delayed preparation
and sparse intermediate presentation. A narrow failure-diagnostics correction
will retain those observations before cleanup; no gate or timing is relaxed.

Independent checks of this exact archive accept the full629 UI block and the
retained628 Local/progress/borderless/open-Nora-slide block. The frozen two-input
motion-trace gate passes179774 events and19 clock anchors, spread0.069ms. Full
gesture validation correctly rejects missing fresh-read evidence. A confirmed
new-publisher version-dispatch error was corrected: Local/progress record the
runtime version6.0.29, while borderless/motion/open-Nora-slide retain schema6.0.28.
All38 publisher contract tests pass; frozen627/628 validators remain unchanged.

The627 diagnostics now preserve actual rejected band counts, original scan
geometry, phase/capture timestamps, renderer observations and native state before
fixture cleanup. Failed frames retain the first and latest callbacks within
12 frames/32 MiB; encoding and writes occur after subscription cancellation.
Source-surface band samples reuse the existing bitmap and preserve captured PNGs
on failure. Selection RGB/tolerance/minimum, timeout4000ms, maxFrames120 and all
original animation assertions remain unchanged. This improves failure evidence;
it does not establish the cause or claim a fix for the timed-out transition.

## Fifth candidate — repeated dark closing cadence failure

Source `4678e374062fb8a05da28675ee2b9de7f5373ecc`,
[run44491411916](https://github.com/jeep-jim/OSMINOG/actions/runs/44491411916),
attempt1/job135447678636 and attempt2/job135451182381 both stop on the retained
assertion `dark closing paints at least three intermediate frames`. Both pass
176/594/529 source tests, native packaging and the complete629 UI gate. All seven
companion workflows pass. Neither attempt reaches the ordinary627 transition
whose failure diagnostics were added in this candidate.

Attempt1 verification artifact14513441931:9177567 bytes, SHA-256
`df54ad9e65a99786275c1f514c9925288197758ed9f022d53bd95ea24ff27ed3`.
The dark closing recorder contains only two intermediate translations:2.26055px
and34.5066px; longTasks is empty. All four opening/closing painted-frame captures
have a qualifying actual bitmap, including dark closing progress0.8866. The
assertion therefore concerns the separate three-frame cadence requirement, not
failure to identify the painted moving edge.

Attempt2 verification artifact14513602730:9230472 bytes, SHA-256
`62e3d05f0ba467c9f7e4b58bc70704cb79f216cb6f46136a3ccb7f82822bbfb8`.
Its log confirms the same assertion and a complete108483-event trace without
data loss or collection errors. This failed evidence is not a release candidate.

The next diagnostic records two fresh, equally prepared native open/close pairs
on the same Mac: without frame subscription, then with the existing subscription.
Both use unchanged recorder/geometry/cadence checks and one separate trace.
Original failure evidence and accepted PNGs are retained unchanged; diagnostic
results cannot turn the original failure into PASS. A no-subscription trial is
explicitly not a presented-pixel proof. This comparison can identify evidence
consistent with capture overhead under tracing, but cannot alone remove order,
host-load or tracing confounds. No further blind rerun was requested.

## Sixth candidate — transition fixture was never painted before it was hidden

Source `8a7acf464e575d09b887b9079ccc2e7f9abeef95`,
[run44495617866](https://github.com/jeep-jim/OSMINOG/actions/runs/44495617866),
attempt1/job135461908576:176/594/529 source tests and native packaging PASS.
The source Nora motion assertions, complete629 UI block, retained borderless,
content-fit and open-Nora desktop-slide blocks, and629 gesture WRITE all pass.
The diagnostic A/B is not invoked: its original Nora-failure trigger is absent.
This is still a failed run, with no candidate upload or release publication.

Verification artifact14514718435:17400295 bytes, SHA-256
`907fd225f6ed54cd129cd58203c6bcf1eeb056cc49695f0cbd3f2e0b26bbb966`.
The downloaded ZIP matches the GitHub artifact digest. The full job log is
626586 bytes, SHA-256
`8a867701fad2c1ef5f6816395eff5f1f4386c79e27bccc93905306d11e569bf7`.

The ordinary627 selector times out after4000ms/19 callbacks. Its new diagnostics
make the missing precondition observable: the incoming native PNG247x572 has
zero red-marker pixels anywhere, despite DOM reporting a236x8 red marker and
scrollY137. The PNG still shows the pre-scroll input at the top. The outgoing
PNG contains its blue marker. All19 shell callbacks therefore have red count0;
blue counts during the actual transition include765,217,151,103. The selector
correctly rejects them. There are11 intermediate renderer frames, both decoded
surfaces, and a372.7ms completed animation. Increasing the capture timeout would
not repair a marker absent from its source image.

The test currently adds both markers and scrolls after the first page is already
hidden. The correction prepares each fixture while its native page is visible,
before its first departure, and confirms the marker in bounded native readback.
The measured transitions retain their existing RGB, minimum-pixel, frame-count,
identity, scroll, duration and layout-count assertions. This changes fixture
readiness only; it does not alter product motion or infer freshness for arbitrary
background-page DOM updates.

Independent release validation accepts this archive's360 separator and16 Nora
overlap probes, four trusted scroll completions, and retained628 UI evidence.
The frozen two-input trace gate separately rejects `laterClosing:
compositor/Blink completions disagree` in the otherwise complete157049-event
trace. This is a distinct unresolved evidence failure, not a trace PASS. Fresh
process gesture-read and628-to629 profile upgrade have not been reached.
The rejected later-close generation34 has raw Chromium Blink END timestamps
371097509/371097528 microseconds and compositor END371123900/371123928:
26.372–26.419ms exceeds the unchanged20ms correlation bound. A29.395ms
BeginMainFrame spans these events. This establishes delayed lifecycle evidence,
not whether product behavior, tracing, or runner load caused a visible defect.
The earlier light/dark opening/closing RAF counts are11/6/10/5 respectively.

The fixture correction now prepares page A after its final viewport is visible
and before the existing first switch; page B is prepared after native visibility
is confirmed. It adds no desktop round trip. At most8 native readbacks within4s
must show both the fixed band and a separate scrolled-content pixel, after two
guest RAFs. Identity, visibility, URL, epoch and bounds remain pinned. Original
style/scroll state and actual preparation PNGs are retained for cleanup/evidence.
Each measured source PNG must also contain its expected band. The old transition
selector and all timing/animation assertions are unchanged. Local
`node --test mouse-621.test.cjs mouse-smoke-frames.test.cjs mouse-desktop-slide.test.cjs`
passes82/82, including stale-band, stale-scroll and hidden/changed-viewport
rejections. Syntax and diff checks pass; native acceptance remains pending.

## Seventh candidate — complete source acceptance; publication pending

Status at this checkpoint: **SOURCE_VERIFIED / PUBLICATION_PENDING**. Earlier
failure and pending entries above remain the history of their specific attempts.
This successful source run does not by itself establish public availability.

Tested source `72679ee907dda6e7ac134b1f01addee858c4e59a`,
[run 44498720435 attempt 1](https://github.com/jeep-jim/OSMINOG/actions/runs/44498720435),
[job 135472522776](https://github.com/jeep-jim/OSMINOG/actions/runs/44498720435/job/135472522776):
the complete installed macOS arm64 workflow is **SUCCESS**. Test batches
176/176, 598/598 and 533/533 pass with zero failures; all eight source checks are
green. [PR 170](https://github.com/jeep-jim/OSMINOG/pull/170) was merged as
`a5a773c16c2b342f9c7dfaf5334649e1da1f3eca`. Package provenance remains the tested
72679 source and this run, separately from the merge commit.

### Exact artifacts and packages

Both downloaded artifact ZIPs were checked against their recorded SHA-256;
the extracted DMG/ZIP were independently rehashed against `SHA256SUMS.txt`.

| Source artifact | Artifact ID | ZIP bytes | SHA-256 |
| --- | --- | ---: | --- |
| Candidate packages | 14515834581 | 275833808 | `ed08aeac0820362bfadb37c3d9b5487b5c6c321317d080e28e3e2b4e19bbcbe9` |
| Native verification | 14515839614 | 19186676 | `a009d5448f699e40abe4930301c4be1e0c90370fa5c566043bc1e012a667b9e9` |

| Candidate package | Bytes | SHA-256 |
| --- | ---: | --- |
| `Mouse-Browser-6.0.29-mac-arm64.dmg` | 137744712 | `665fca86eb86f1bd98bca4c72652fb5b0a981fc4f4c6467a66d0683874c6d57c` |
| `Mouse-Browser-6.0.29-mac-arm64.zip` | 140110868 | `954894c4a3b9c9484a6c3c8295a17eb7da007bf35938eaa8f066a3f7ecc93e16` |

`mouse-build.json` records version 6.0.29, source 72679, run 44498720435,
darwin/arm64, ad-hoc signing and `notarized:false`; its 5608 bytes hash to
`b26c891de9878fea40dc7d9cbb3588ab0f13656fa34d9e29b57ac062a6c2a1e6`.
The full source job log is 672148 bytes, SHA-256
`08ef7c65e5830decedd84d7505b2b6be9685287dd2aef44b0e729ba09c9d7ae6`.
These are verified source-candidate bytes, not a claim that release assets or
the public update channel have already changed.

### Restored UI, input and retained motion

The installed 629 UI gate passes all four seven-pane separator scenes: 360 probes
cover the 6.0.27 divider colours, corner cutouts and preserved page interiors.
Both Nora scenes pass 16 overlap-fill probes with native guests hidden, decoded
snapshots and preserved page identity/bounds. The complete UI evidence is
`mouse-629-ui-regressions.json`, 261429 bytes, SHA-256
`515a023df993957884e017754469960d60fcb07c4554af96fc721a5ac2bf27c8`.

Root and nested guest scrollbars pass in both browser themes despite author
white `!important` styles. Site-owned light colour scheme, form styles,
geometry and scroll positions survive theme changes. All four native wheel
inputs have matching trusted `scrollend` evidence, stable positions after two
RAFs, exact preservation of the other container and no Mouse desktop change.
The two scrollbar images remain guest WebContents captures, not native display
composition evidence.

The 629 tutorial passes WRITE and a separate fresh-process READ: genuine adjacent
desktop changes hide the hint, non-switch input retains it, reopening/restart
keep completion, and private completion remains isolated. The evidence records
`syntheticNativeEvent:true` and `physicalTrackpadVerified:false`: CI uses Electron
native mouse-wheel injection and does not prove a physical two-finger gesture on
the owner's Mac. `mouse-629-swipe-tutorial.json` is 18598 bytes, SHA-256
`296d9b6b7e9e4e5fa81eb620ebc50bc567a36145f91d080bb7e961913a9fd709`.

Retained 628 Local MCP, page progress, borderless/content-fit Nora and open-Nora
desktop-slide acceptance pass. The unchanged frozen two-input motion-trace gate
also passes: 161375 events, 18 clock anchors, 0.147 ms anchor spread. Trace metadata
records `complete:true`, `dataLossOccurred:false`, `limitedEvents:0` and no
collection errors. The archived trace is 29158827 bytes, SHA-256
`391bd80b8050a9fd42ef5ca3965b249d6a2328eae9017290f8326aef2fc4d92f`.
The earlier failures remain recorded; this run does not establish their cause
or identical animation cadence on every Mac.

### Ordinary 627 transition readiness and independent PNG checks

Both fixtures now paint before their first hide. Each succeeds on its first
readback: page A in 380.083 ms, page B in 199.983 ms. Independent decoding of
`mouse-627-desktop-transition-prepared-0.png` and `-prepared-1.png` confirms
236 red and 997 blue pixels on the measured row. Both separate scrolled-content
probes equal `[207,229,208,255]`, with DOM scrollY 137. Native visibility, desktop,
WebContents, URL, epoch and bounds are identical before/after preparation.

| Measured transition | Moving RAF samples | Native layouts | Animation ms | Injected ack delay ms |
| --- | ---: | ---: | ---: | ---: |
| Light forward | 13 | 6 | 356.3 | 0 |
| Light back | 15 | 6 | 330.6 | 0 |
| Dark forward | 17 | 6 | 352.7 | 0 |
| Dark back | 19 | 7 | 333.0 | 250 |

Independent assertions accept all four transitions: both layers move and remain
adjacent; each captured source retains its expected band; pageBefore/pageAfter
are exactly equal, including WebContents, URL, epoch, random marker, viewport
and scrollY 137. Native layout and animation-duration bounds are unchanged;
the fixture reports restored state.

There are **two** archived simultaneous-composite PNGs, one forward transition
per theme, both from `beginFrameSubscription`. Re-decoding the measured row
reproduces light `[235,305]` and dark `[206,790]` red/blue counts. Both exceed the
unchanged 16-pixel minimum. The reverse trials have source-PNG measurements and
renderer motion records; the inherited test does not save separate reverse
composite PNGs. Four transition trials must not be described as four such PNGs.

### Persistence, real upgrade and publication boundary

`mouse-smoke-write.log`, `mouse-smoke-read.log`, private smoke and private-close
logs all record actual process return code 0. Restart checks retain cookies,
workspace preferences, library/start-page data and legacy profile fixtures.
Private tests confirm in-memory isolation, cleanup, fresh-session reset and the
unchanged ordinary page identity/storage. Retained native PNG drag, document
editing/tabs, fullscreen restore, layout history and Agent/PTY stop gates pass.

`mouse-update-roundtrip.log` records
`MOUSE_629_REAL_628_TO_629_REPLACE_RELAUNCH_PROFILE_PASS`. The real installer
replaces the checksum-pinned published 6.0.28 app with this 6.0.29 candidate,
relaunches it and acknowledges exact `READY=6.0.29`. Assertions verify both
application versions/signatures, retained profile sentinel/file values, the
new startup record and removal of the update receipt. This is a synthetic CI
profile-preservation proof, not inspection of the owner's existing profile.

Public release publication is still **PENDING** here. The next step is the
separate Releases publisher's installed verification, publication and readback
of the exact assets/update channel. Append that result only after it completes.

## Publisher attempt 1 — READ opening timeout; no publication

[Releases run 44501476513](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44501476513),
release commit `32babb2e2dc9ed3c6eec6ec7f9f862b42eb2be37`,
[native job 135482236470](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44501476513/job/135482236470)
ends in **FAILURE**. Import of the exact source-candidate bytes passes. Fresh
installed WRITE passes the full UI, gesture WRITE and ordinary 627 transition
checks. Its frozen two-input trace also passes: 153304 events, 18 clock anchors,
0.143 ms spread.

Fresh READ passes library, start-page and cookie/profile restart assertions,
then fails with `Mouse628 motion timeout: restarted Nora opens`. The internal
opening-stage reason was not retained and native diagnostics were disabled, so
the cause is **unknown**. The successful source READ also logged the same nine
loopback `ERR_CONNECTION_REFUSED` load warnings; their presence alone does not
explain this failure. No correction or successful repeat is established here.

Verification artifact 14517653063 was downloaded and its ZIP verified:
18458204 bytes, SHA-256
`c983cdf46633162499a4d82653fe80a7dca1fb4f62bd2dfb8530d4864f29ce6d`.
Publication, channel update and live-updater verification steps are **SKIPPED**.
One retry of the same native job, imported bytes and acceptance criteria has
been requested; its result is **PENDING**. Source acceptance remains verified,
but public publication remains **PENDING**.

## Publisher attempt 2 — release and channel confirmed; final updater gate pending

[Run 44501476513, attempt 2](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44501476513/attempts/2)
reuses the same imported packages and acceptance criteria. Steps 5, 6 and 7 are
**SUCCESS**: installed-DMG/previous-version replacement verification, independent
recomputation and publication of the exact packages, then static-channel update.

Direct public readback confirms
[release 6.0.29](https://github.com/jeep-jim/OSMINOG-Releases/releases/tag/quadro-macos-v6.0.29-arm64),
ID 451181980, tag `quadro-macos-v6.0.29-arm64`, `draft:false`, `prerelease:true`,
published at **2026-11-19T10:24:42Z**. All five public assets match the pinned
sizes and SHA-256 values. The published DMG is 137744712 bytes with SHA-256
`665fca86eb86f1bd98bca4c72652fb5b0a981fc4f4c6467a66d0683874c6d57c`;
the published ZIP is 140110868 bytes with SHA-256
`954894c4a3b9c9484a6c3c8295a17eb7da007bf35938eaa8f066a3f7ecc93e16`.

Raw-channel readback also reports version 6.0.29, the same public DMG, byte count,
digest and publication timestamp. The current checkpoint is therefore
**PUBLICATION_CONFIRMED / LIVE_UPDATER_PENDING**. Step 8, anonymous discovery and
download through the shipped 6.0.28 updater, is still **IN_PROGRESS**. Full final
acceptance is not claimed until that gate and the final archived proof are
confirmed. Earlier pending/failed checkpoints above remain unchanged as history.

## Final result — 6.0.29 PUBLISHED and independently accepted

Final status: **PUBLISHED**. Publisher attempt 2 completed with
[native job 135489533542](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44501476513/job/135489533542)
and [contract job 135489534139](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44501476513/job/135489534139)
both **SUCCESS**; steps 5–9 pass. Fresh proof is tied to run 44501476513,
attempt 2 and release commit `32babb2e2dc9ed3c6eec6ec7f9f862b42eb2be37`.
The first READ opening timeout did not recur in the single retry with unchanged
packages and criteria. Its original cause remains unestablished.

Independent recomputation exactly reproduces the archived fresh installed
reports: 24 borderless states, four desktop slides, four Local and four progress
scenes; 360 separator probes, 16 Nora overlap probes and four native wheel inputs
with four trusted scroll completions. Gesture proof includes four actual desktop
switches and a fresh READ process, PID 11710 after WRITE PID 2278, with restart
completion and restored state. Real 6.0.28→6.0.29 replacement, profile retention
and ordinary/private process checks also pass.

The unchanged frozen two-input trace gate passes 157290 events and 18 clock
anchors, with 0.131 ms spread and closing generations 24/28/34. Its existing
correlation/provenance limits remain: `directIdentityLink:false` and
`continuousCompositorLifetimeProven:false`. This does not establish continuous
compositor lifetime or explain the earlier failed attempts.

`RELEASE_RESULT.json` agrees with the public release and five assets recorded
above. `channel-verification.json` confirms that the actual shipped 6.0.28
updater anonymously discovers 6.0.29 and downloads the exact 137744712-byte DMG;
`anonymousDiscovery`, `verifiedDownload` and `currentVersionCheck` are all true.
Discovery reported `available` on attempt 47 after 46 `current` observations;
the evidence does not establish the reason for that delay. The public
[update channel](https://raw.githubusercontent.com/jeep-jim/OSMINOG-Releases/main/channels/mouse/macos-arm64.json)
and [release](https://github.com/jeep-jim/OSMINOG-Releases/releases/tag/quadro-macos-v6.0.29-arm64)
retain the confirmed version, publication time and pinned package hashes.

Final verification artifact **14519761881** contains 241 entries. Its downloaded
ZIP and the native job log were independently rehashed:

| Final proof | Bytes | SHA-256 |
| --- | ---: | --- |
| Verification artifact ZIP | 19267377 | `1191390754661cc26e62555da332c55a36b059bca567da83c667c4c73cbca904` |
| Native job 135489533542 log | 110555 | `2135501267c8089a908084b8fd15dadbe0cfb2ec4e81b1db4a540efe1fd6ba1e` |
| `mouse-629-ui-regressions.json` | 261351 | `beae3a4de1a45e4795762f2e8c038f86dbb70ee4277c6d370aa41cf929203748` |
| `mouse-629-swipe-tutorial.json` | 18587 | `935973c29ff3a52274ee648391a9228f420c68948d9ba6121f70e4caee063649` |
| `mouse-628-motion-trace.json` | 28714050 | `f2346ffd4c7658e01fe57f99862deb9a7f17fdc5da208e28db8c832b4b8415d0` |
| `mouse-628-motion.json` | 2288389 | `b47b6286c7d9200b6e42dcedeca97126172411328b1462d6ed9bb7405d1c007a` |

The released build remains an ad-hoc-signed, non-notarized prerelease. Native
wheel injection was tested; a physical trackpad was not. Uniform scrollbar
behaviour was verified with the hostile local Chromium fixture, not an
authenticated VK session. All earlier pending/failed checkpoints remain history;
no required publisher gate remains pending at this final checkpoint.
