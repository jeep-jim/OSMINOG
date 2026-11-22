# Mouse637 preset diagnostic — isolated, never a release candidate

## Why this diagnostic is needed

The common release source is
`2b73ad7b7924bf8e87fa0932eea672fe2bb89f52`, tree
`2a3917f6419342c7d22eb18dab945a992a53e2a2`. Mac run44995533011,
attempt1/job137125629651 failed in the installed native feature WRITE process42073
at `mouse-637-presets-helpers.cjs:56`: `Every preset pane is populated`.

Support and Trader completed. The next Design mode made all five owned loopback
service requests and received the original trusted native click/close inputs.
Its returned tree matched the Design tree, but one renderer slot lacked a matching
entry in the actual page snapshot. The specific failed pane/slot/map were not
saved before the assertion. The later failure PNG was captured after the preset
finally cleanup and shows the restored original desk, not the failing Design
arrangement. The root cause is therefore unestablished.

Published636 baseline, strict637 performance and owner636 passed first. Strict
20-page medians were85.246833→60.609333ms;50-page117.741458→56.351833ms, with all
original limits unchanged. These component passes do not accept the failed
feature sequence. The new retained Settings assertion was not reached in this
native run. Package binding/upload was skipped.

Verification artifact14743896823 is33,695,149 bytes, SHA-256
`dec1cf9ca49f2e964e4cbbc5aa089d2c2c01fc409b3e8be3969348adad5afc43`.
Its316 raw files, terminal job log, API provenance and comparison of eight relevant
source files against the preceding d39 attempt are preserved. Those eight files
are unchanged from d39, where the preset sequence passed. This does not identify
the cause or make the new failure harmless.

## Hypothesis and its precise limit

A conditional unit probe executed the actual release renderer `receiveState`,
`reconcile` and `prefs` functions with the real Layout/TabOrder helpers. A normal
metadata update preserved the five Design slots. Injecting an older same-desktop
snapshot without the five newly opened pages cleared all five slots; delivering
the fresh snapshot afterward did not restore them. Two save calls followed.

That proves the conditional code path. It does **not** prove that an older
snapshot arrived after preset acceptance in the failed native run. IPC order,
the failing slot and the authoritative native layout need direct observation.
No production fix is justified solely by this constructed input order.

## Isolation and evidence plan

Use only branch `diagnostic/mouse-637-preset-2b73ad7b`, based on exact2b73 above.
The separate worktree leaves the release source and publisher untouched. Never
merge this diagnostic branch, pin its packages or substitute its result for
complete native release acceptance. There is no version bump or public feed edit.

The diagnostic requires explicit opt-in, CI, a packaged app and a dedicated
absolute isolated profile. Its bounded immutable main/renderer trace associates
the actual state snapshots by sequence identity; process-local clock domains
remain separate. Record queued/run/returned mode and preferences, accepted and
received state identities, and renderer slot reconciliation. Each process retains
the first32 events plus an ordered rolling tail, within512 events and1MiB total.
The fixed32KiB per-record cap, bounded tab-ID lists and explicit truncation/error
and eviction counters prevent unbounded recording. The recent tail preserves
adjacent build/send and receive/reconcile pairs even after the buffer fills.

The sequence is kept in a diagnostic WeakMap rather than added to the ordinary
state object. Only the existing `browser:state` push carries it as an additional
diagnostic payload argument. The existing preload listener forwards that argument
to the diagnostic renderer hook; no new IPC channel or state field is introduced.
An apply-mode invoke return is correlated by its exact mode, tab IDs and slots
with the main return record; that return record holds its main snapshot sequence.
This distinction must remain explicit when interpreting the trace.

Successful-path hooks record already computed values. They must not add state
requests, native reads, waits or geometry changes: `state()` and `rawLiveState()`
already perform reconciliation and cannot be treated as passive extra reads.
At the original failing population assertion, preserve its exact used preferences,
page list, pane and ID, fresh renderer/native snapshots, and native PNG **before**
the existing preset cleanup; then rethrow the original error. The assertion is
neither removed nor relaxed.

The Mac-only workflow performs one original packaged feature WRITE replay,
including its preceding language/interface/extension/media/AI stages, original
native inputs and240s/270s deadlines. It does not run the full release verifier,
does not retry internally, and uploads diagnostic evidence even on failure.
The checkout asserts the exact workflow commit and its single parent2b73. The
host binds the original reports to the child PID/profile and, if the population
assertion fails, requires the original unmatched selection, both pre-cleanup
snapshots, and both PNG files with matching hashes, sizes and native PID. Native
failure remains a failed job even if collection succeeds. A non-reproducing
diagnostic run is not causal proof and is not release acceptance.

## Preflight review

The frozen JavaScript change passed44/44 focused tests on exact Node22.23.5,
with zero skips, in both the author's and root's executions. The independent
reviewer also ran all12 new diagnostic tests successfully. These tests execute
the actual main/preload/renderer hooks and failing preset assertion, verify no
additional authoritative state reads or changed ordinary return objects, retain
the original exception, and exercise event and byte caps independently.

The host runner passed9/9 unit tests independently in root and peer executions.
Those tests cover one fresh child/profile, credential removal, owned process-group
timeout termination, native CI/branch guards, report/capture binding, missing or
mutated evidence rejection, and preserving native failure after successful
collection. Synthetic inputs in these unit tests are not native UI evidence.
JavaScript syntax checks and `git diff --check` passed. The branch is exclusively
diagnostic; none of this instrumentation is approved for a release merge.

## Release status while preparing this experiment

Linux exact2b73 run44995533015/attempt1/job137125629841 completed successfully and
passed the full independent actual-AppImage/DEB gate in131.522733432s, with all264
publisher Python files bound to unchanged3b4febdf Git bytes. This accepts only
those Linux bytes. Windows exact2b73 primary job137125662637 in run44995532966
completed at07:12:12UTC and its full independent actual-EXE gate passed in213.629s,
with all264 publisher verifier files Git-bound and409 consumed raw files unchanged.
The additional modern Windows job137130532190 is still being checked. Mac remains
failed, all three publication pins remain unready, and no complete637 release is
claimed.
