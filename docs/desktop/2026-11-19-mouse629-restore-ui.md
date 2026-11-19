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
