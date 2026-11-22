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
