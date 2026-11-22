# Mouse637 isolated native input diagnostic — 22 November 2026

This branch is based only on source `5a13d620e66e8b25792b3ba26de907c6b66fc422`.
It is diagnostic-only: do not merge it, pin its packages, or treat its result as
release acceptance. Original source PR193 remains separate.

Mac run45000235119 attempt1/job137139946950 failed the first trusted guest
`#download-a` click. Its preserved artifact14745950267 is5,218,617 bytes,
SHA-256 `bca2a09fd53a2186c90177f27ed31b95e7cb8ad741ae9b40351952f98efa33ad`.
One unchanged complete repeat was performed after two independent reviews.
Attempt2/job137141782888 passed both pane downloads, then failed the AI guest
`#link-blank` click. Artifact14745249889 is6,147,244 bytes,
SHA-256 `ffd5d4faae79c382f07fce6db0f2b50b3dbe1d941956bbcfb42ab06857a7ce3c`.
Both archives were downloaded and rehashed independently. No third unchanged
repeat was requested. Geometry/visibility/hit tests remain valid; the target
became focused but no trusted click was recorded. Cause is unestablished.

The isolated collector records bounded guest/shell pointer, mouse and focus
history, original hit geometry and separate renderer/main monotonic clocks.
It runs only with MOUSE_GUEST_INPUT_DIAGNOSTICS=1 on owned fixture documents.
Native driver, single post, target-click predicate,10-second wait,240-second
fixture and270-second process budgets are unchanged. There is no added await
between post and acceptance polling. Diagnostic readback is bounded and cannot
replace a failure with success. Full-history drop/truncation counts are explicit.

Nine focused tests passed with no skips on local Node24.22.3. Independent review
approved the code, caps, unchanged acceptance path and workflow. Native Node22
validation is pending. Workflow builds the same packaged application and executes
only the original published636 baseline followed by one retained native scene;
no later acceptance suite or public upload is claimed.

Publisher-only manifest declaration correction610ea12feb96b152f2a61d9e84f194ffde75d4a1
is separate; all100 publisher tests passed and native acceptance still blocks
release. Linux5a13 native and independent actual-package gates passed; this does
not accept Mac or the complete source. Public feeds remain6.0.36 at this stage.

## First passive trace and next diagnostic boundary

Diagnostic run [45001732291](https://github.com/jeep-jim/OSMINOG/actions/runs/45001732291)
on `ad97f72f8f0035817d2a53be9f97ae94661ce721` failed at the first
`#download-a` trusted-click predicate. Preserved artifact14746616051 was downloaded
and rehashed as SHA-256
`440d63f0e0a8670cac873609089ef17a9a9b3354abb51a674bce8d192b0da190`.
The guest trace contains only blur/focus; the shell trace contains only
blur/focus/blur. Neither contains pointerdown, pointerup, pointercancel,
mousedown, mouseup or click; both report zero drops, errors and truncation.
The anchor hit remains valid, and the guest focus changes while readback stays
responsive. This does not identify where native mouse input was lost or filtered.
No source fix, snapshot regression, first-mouse cause or driver-timing cause is
established from these records. Clock domains were not aligned to infer a race.

The next isolated diagnostic adds two passive boundaries under the same opt-in:

- An AppKit local monitor records only move/down/up events belonging to the
  installed Mouse NSWindow, using event timestamps and system-uptime seconds.
  It records app-active/key-window/first-responder state, bounded weak object
  identities and the content-view hit chain with explicit superview coordinates.
  Non-owned or nil-window events contribute numeric skipped counts only. Before,
  immediately after and at failure, the original synchronous diagnostic reads
  also capture native window state and the intended hit point. The monitor always
  returns the original NSEvent. Local monitors exclude nested event-tracking
  loops, so absence here alone does not prove CGEventPost failed.
- Owned shell and guest WebContents collect bounded `before-mouse-event`
  records, including mouseLeave, before renderer forwarding. Listeners never
  call preventDefault. This boundary identifies browser-side receipt, not DOM
  delivery. Listener and AppKit monitor cleanup is explicit.

Both histories retain their first16 and last48 events with explicit drop/error
counts. No input, focus, readiness, sleep, retry, post, acceptance predicate or
budget changes are included. The workflow still executes the original published
636 baseline and a single original retained scene, and creates no release assets.
Twelve focused diagnostic tests passed locally with zero skips on Node24.22.3;
the new Objective-C++ code still requires the native Mac build and run.

Primary references for the observation boundaries:
[Apple local monitors](https://developer.apple.com/documentation/appkit/nsevent/addlocalmonitorforevents(matching:handler:)),
[Apple hitTest coordinates](https://developer.apple.com/documentation/appkit/nsview/hittest(_:)),
[Electron44.5.0 mouse forwarding](https://github.com/electron/electron/blob/v44.5.0/shell/browser/api/electron_api_web_contents.cc),
and the pinned [Chromium152.0.7977.130 Cocoa hit guard](https://chromium.googlesource.com/chromium/src/+/152.0.7977.130/content/app_shim_remote_cocoa/render_widget_host_view_cocoa.mm).
