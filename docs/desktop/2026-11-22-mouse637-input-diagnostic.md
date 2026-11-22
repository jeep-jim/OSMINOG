# Mouse 6.0.37 — isolated native input diagnostic

## Scope

One release-source parent: 5a13d620e66e8b25792b3ba26de907c6b66fc422,
tree abe7d244841c6bcbc5af982d150d605f5e8c0fd2.
Branch: diagnostic/mouse-637-input-5a13d620.
This experiment is never merged, pinned or accepted as release evidence.
The release branch and its packages remain separate.

The owner is waiting for 6.0.37, including the circular updater and previously
combined desktop changes. His reported missing drawing, freezing and jerks in
6.0.36 on his physical Mac remain unverified in 6.0.37.

## Two preserved native failures

Both belong to [Mac run 45000235119](https://github.com/jeep-jim/OSMINOG/actions/runs/45000235119)
on exact source 5a13. Unit contracts, native build and the actual published 636
baseline passed. Neither attempt reached current 637 features or uploaded
accepted candidate packages.

| Attempt | Job | First failed retained guest action | Verification artifact |
|---|---|---|---|
| 1 | 137139946950 | First pane download link #download-a | 14745950267 |
| 2 | 137141782888 | AI preview link #link-blank, after pane downloads passed | 14745249889 |

Attempt 1 archive: 5,218,617 bytes; SHA-256
bca2a09fd53a2186c90177f27ed31b95e7cb8ad741ae9b40351952f98efa33ad.
Its 71 raw files and 987,630-byte original job log remain separate.
Log SHA-256: 3974c1d717312e45a7382e2acac8dd8bd094b95fa6f15aadfdff5d164e8d5e39.

Attempt 2 archive: 6,147,244 bytes; SHA-256
ffd5d4faae79c382f07fce6db0f2b50b3dbe1d941956bbcfb42ab06857a7ce3c.
Its 81 raw files and 987,910-byte original job log remain separate.
Log SHA-256: 05631e366bc71773ac502d63daadea01cdee25a56dc10e8187ab21b01bdc23bb.
Attempt 2 was observed as already requested by another active continuation.
This diagnostic does not request a third full rerun.

Attempt 1: DOM hit (100,149), zoom1, content origin (4,29), guest origin (0,74),
giving native point (4+0+100,29+74+149)=(104,252).
Attempt 2: DOM hit (100,229), zoom1, AI guest origin (820,74), giving
(4+820+100,29+74+229)=(924,332).
Recorded actual/cached bounds, visibility, attachment and URLs remained valid.
The target guest was focused at failure, but the target-click receipt was empty.
The samples do not show whether down and up reached the same link.

Successful earlier 0a95, d39 attempt 2 and 2b runs recorded the same first-link
point and sampled focus/geometry as failed 5a attempt 1. Their target clicks
arrived 10, 7 and 16 milliseconds after post; failed 5a still had none after
10,020 milliseconds. This does not establish equality of all continuous
runtime conditions or a cause. Eight relevant helper/driver/browser files are
byte-identical 2b→5a. No connection to the snapshot-order correction is established.
The earlier Design population failure is a separate event with an unestablished
original cause.

## One diagnostic invocation

The workflow builds an isolated app directory, verifies arm64 architecture and
ad-hoc signature, copies it into a runner-owned installation, and launches the
original --mouse-636-retained-smoke workload exactly once. Original assertions,
click sequence, 240,000 ms workload budget and 270-second host timeout remain.
No target is clicked through DOM APIs and no click is retried. A native driver's
successful return is never substituted for a trusted target receipt.

The preceding published 636 baseline process is not replayed. This is a retained
workload experiment, not an identical replay of the entire failed job. Passive
initial button/modifier state may reveal retained input state; it cannot prove
that an omitted process caused it.

Recording requires MOUSE_637_INPUT_DIAGNOSTIC=1, native macOS CI, the original
retained flag and an isolated absolute profile. The Python host additionally
requires the exact diagnostic branch. Ordinary execution installs no diagnostic
monitor or input recording through these hooks.

- Native app-local observations return the original NSEvent, including on
  diagnostic exceptions. Data includes posting receipts, hit-view ancestry,
  first responder, window identity and button/modifier state. Nested native
  tracking loops may bypass a local observer; missing records are not proof
  of missing OS events.
- Native events/posts each retain at most 512 records: first 64 and latest 448.
  Absolute sequence and dropped counts preserve retained-range identity.
  Strings are bounded to 128 UTF-16 units and ancestry to 8 views.
- Passive DOM listeners record down/up/click/focus targets and coordinates,
  without text or page contents. Each collector has at most 128 records,
  first 32 and up to 96 latest records, a 4,096-byte record bound and 256 KiB collection bound.
  Oversize records and evictions remain explicit.
- At most 16 guest attempts are retained. Each attempt is captured before
  original cleanup. Native observation stops before cleanup; the final
  disposition is sealed from original facts without rereading events.
- Host wall time, each document's monotonic clock/time origin, AppKit uptime
  and raw CGEvent nanoseconds remain distinct fields. No ordering is inferred
  by subtracting unrelated clock origins.

The host binds executable/app.asar/Info.plist hashes, PID/profile, the original
retained report, attempt identities, and original failure crop/display PNG bytes,
dimensions and hashes. The isolated diagnostic receipt cap is 32 MiB; the original
report cap is 16 MiB. Only the newly created child process group may be terminated
on host timeout. Existing evidence/profile directories are not overwritten.

## Validation and interpretation

Host tests cover one actual child, fresh profile/output isolation, token removal,
no overwrite, owned-group timeout cleanup, identity/bounds mutations, original
failure preservation, PNG byte binding and cleanup-only failure without an
invented screenshot. Synthetic records are unit inputs, never native evidence.
Actual AppKit compilation/runtime are verified by the macOS workflow; Linux
source-contract tests do not establish native compilation.

Original workload failure stays a failed diagnostic job even if recording
succeeds. A pass means only that one invocation passed under observation.
Neither outcome alone explains earlier failures, eliminates intermittent-input
risk, accepts release packages or verifies the owner's physical Mac.

Final independent review of all eight diagnostic files passed on 22 November
2026 at approximately 08:22 UTC. Final helper tests passed 10/10 with no skips;
the independent helper plus existing observer test selection passed 14/14 with
no skips. Final Python host tests passed 10/10 independently and at root.
The earlier broader JS selection passed 44/44 before the final persistent-error
counter regression was added; that count is not represented as a final full run.
Native source contracts passed 35/35 before absolute sequence metadata was added;
actual final native compilation and runtime still require the isolated Mac job.
git diff --check passed. No original input predicate or workload assertion changed.

Final implementation SHA-256 values:

| File | SHA-256 |
|---|---|
| desktop/mouse-native-menu.mm | bc500ba496c21a2a64df21b458c4db65cbc516925825c42c9c71bea5d892d1d1 |
| desktop/mouse-637-input-diagnostic.cjs | c80b52eff33b2e1d3fe2ff466ce8af315ea0d7c38afdc3771916d751ac34320b |
| desktop/mouse-637-input-diagnostic.test.cjs | 7137b0dfa5c8118fb4a8d86454587a42105b7082a894d4cefe4a1071a712fae4 |
| desktop/mouse-636-retained-smoke.cjs | 59f49a161895cbb6ac7c18165c36887f9025940bf2fdf3bb26258bbedadababb |

Root final JS log SHA-256:
45eaf8295a552caebeddccaf593c0d29c6ca8febc3bb57927d46a6b1072aa553.
Root final Python log SHA-256:
0ba2a0136a2889683e3e24e45069f801049227867211ef8c63dd3413c7ff84ed.

## Other release state at preparation

Linux source 5a13 run 45000235012 / attempt 1 / job 137139946706 passed native and full
independent actual-package acceptance in 139.372984 seconds. All 264 verifier
files were Git-bound to publisher 3b4febdf and unchanged during verification.
Root additionally rehashed the actual AppImage and DEB.

Publisher advanced externally to 610ea12feb96b152f2a61d9e84f194ffde75d4a1,
tree e9816f09a3a01ad26845b8ecce44df500fd370c1, sole parent 3b4febdf.
Its three-file change corrects only the current Mac manifest's predecessor
declaration to real-636-to-637-profile-preserving-replacement, with regression
tests and a source fixture. Root matched 171 ordered tokens and the workflow
SHA to source 5a13; 100/100 tests, 3 templates and 3 publish=false plans passed.
Peer review established unchanged reachable Linux/Windows verifier code.
Their full results remain bound to the actually executed 3b4 verifier revision,
with the 610 delta proof separate. No execution is relabelled.

Windows primary native and full actual-EXE independent validation passed;
dependent modern validation is still running at this
preparation point. All three publication pins remain unready. Source acceptance
and actual public release remain separate gates.
