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
