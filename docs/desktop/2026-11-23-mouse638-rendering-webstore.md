# Mouse 6.0.38 — rendering and Chrome Web Store

## Current acceptance and shared owned-fixture cleanup

Source `eb948797dd919ade788349efd152728d47614244` passed both
[Linux jobs](https://github.com/jeep-jim/OSMINOG/actions/runs/45179250078)
and all three independent publisher reader groups against the actual package
bytes. The clean Ubuntu 24.04 receipt matches the same deb and ASAR. Its
[Windows main job](https://github.com/jeep-jim/OSMINOG/actions/runs/45179249851/job/137708460222)
also passed, including the real `CreateFileW` sharing-violation fixture and
the full predecessor-profile transition. The only skipped cleanup-suite test
on Windows requires an unprivileged Unix filesystem owner.

The [modern Windows job](https://github.com/jeep-jim/OSMINOG/actions/runs/45179249851/job/137719143112)
then failed at a different plain `TemporaryDirectory` cleanup in
`mouse-637-update-button.py`: deleting the owned `Mouse installed/Mouse Browser.exe`
raised `WinError 32`. Native profile writer PID 3516, updater predecessor PID
6452, automatically relaunched candidate PID 3372, and fresh profile reader
PID 7252 had already exited successfully; Node update driver PID 5844 returned
zero. The relaunch receipt recorded an observed graceful exit without forced
termination. The update/profile results passed, but the final wrapper marker
was withheld and the job failed. The remaining handle owner is unknown.

The follow-up reuses the bounded cleanup for this second owned fixture and
the active predecessor-performance fixture. The latter has the same plain
temporary-directory cleanup and an incorrect `ok:true` report on a subsequent
cleanup exception; no baseline-performance sharing violation was observed in
this run. Each path must independently prove its completed native processes
before retrying Windows error 32. Persistent locks, other errors and incomplete
native work remain failures. Performance measurement and its timing limits
are unchanged; cleanup happens after the measured process has exited.

The shared helper preserves the original two-profile exit predicate by
default. Button cleanup additionally requires the actual updater driver,
predecessor exit, graceful candidate exit without forced termination, and
save/quit receipts. Baseline cleanup requires its validated unchanged workload,
raw inventory and a successful native process receipt. A failed guard cannot
enable retries. A guard exception still detaches the temporary finalizer and
fails the helper; an original body exception remains primary.

Focused local suites: 13 upgrade tests (12 passed, one real-Windows skip),
nine button tests and nine baseline tests passed. Main-entry fixtures verify
actual directory removal before the final marker, persistent error 32 bounded
to ten seconds, immediate failure for other errors/unverified exits, and
truthful reports with the original native error retained. No workflow,
application, publisher or native timing criterion changed.

The Mac run's first attempt ended without a runner, steps or artifacts.
[Attempt 2](https://github.com/jeep-jim/OSMINOG/actions/runs/45179249881/attempts/2)
uses the same source and passed installed native acceptance in job
`137718634736`. Independent Mac artifact readers were not run for this
superseded source after the modern Windows failure. All publisher pins remain
unready; a successor source still requires fresh platform acceptance before
publication.

## Previous acceptance and first Windows cleanup fix

Source `e79f14bcee3355efed9ab3dfd2fc65dde5d0eff6` passed
[Mac CI](https://github.com/jeep-jim/OSMINOG/actions/runs/45172737298) and all seven
independent Mac publisher groups, including unchanged performance limits.
[Linux CI](https://github.com/jeep-jim/OSMINOG/actions/runs/45172737181), its clean
Ubuntu 24.04/native gate and all corresponding independent readers passed.
[Windows main](https://github.com/jeep-jim/OSMINOG/actions/runs/45172737104/job/137686212239)
and its complete independent source reader passed. No 6.0.38 release is public.

The additional [modern Windows job](https://github.com/jeep-jim/OSMINOG/actions/runs/45172737104/job/137695135548)
failed during `TemporaryDirectory` cleanup in `mouse-637-upgrade.py`, when
deleting `Previous Mouse в637/Mouse Browser.exe` raised `WinError 32`.
Before cleanup, predecessor PID 8720 and candidate PID 10216 both recorded
native exit code 0, signal null, application-quit/save markers and successful
profile probes. Their Node probes returned 0, the closed profile was unchanged
by replacement, and the retained profile checks passed. The holder of the
remaining file handle was not recorded. The common upgrade PASS marker was
not printed and the outer verification failed; these facts are not a passing
modern result.

The follow-up is limited to bounded cleanup of the owned temporary fixture
for this Windows sharing violation and truthful failure reporting. Cleanup
must complete before the overall PASS marker; persistent locks and unrelated
errors must still fail. Native/profile/update checks and their process budgets
remain required. The next common source needs fresh native acceptance before
the authorized Mac → Linux → Windows publication.

The implemented cleanup uses the standard temporary-directory cleanup, with
at most ten seconds of retries only for Windows error 32 after both successful
native exits. It records attempts, elapsed time and errors, rejects persistent
locks and preserves the original native failure if cleanup also fails. The
overall report is now `ok:false` for a cleanup error. Independent review found
no publisher-contract change was needed. Local cleanup tests: ten passed;
the eleventh, a real Windows `CreateFileW` sharing-violation fixture, requires
Windows and runs through the existing Windows CI test command. Fresh native
results remain required.

## Earlier native failures and corrections

Source `6c3e52eda0671065a6bcf03084b8a545ee7849d2` includes main `d4185b0` without changing its website files. All installers were built, but native acceptance remains incomplete and no 6.0.38 package is published. Runs: [Mac 45151589578](https://github.com/jeep-jim/OSMINOG/actions/runs/45151589578), [Linux 45151589519](https://github.com/jeep-jim/OSMINOG/actions/runs/45151589519), [Windows 45151589825](https://github.com/jeep-jim/OSMINOG/actions/runs/45151589825).

Linux and Windows stopped at the newly added popup DOM readiness condition, despite both real OS failure screenshots showing a fully drawn Dark Reader interface. The helper incorrectly required the extension's internal loader to be hidden/display:none. Its standard completed state can already be transparent before the separate transitionend marker. The old reports did not retain that loader's exact computed state, so they do not establish its precise phase.

The follow-up removes that internal lifecycle condition from readiness. It retains the real DOM controls, extension ID/version/URL, fonts and the popup's own renderer frames within the same 15-second budget. Final readiness still requires the real native popup to be visible, have stable bounds and satisfy the original 25-point full-screen pixel range of at least 45 within six attempts. Loader class and computed display/visibility/opacity/background are saved diagnostically before a timeout. No CSS, production behavior, pixel threshold, retry count or total 180-second budget is changed. Executing the capture code against archived PNG bytes rejects the blank Mac write frame (range 0) and accepts its drawn restart frame (range 194); the Linux drawn frame also passes (range 143). These are replay checks, not fresh native acceptance.

Mac attempt 1 passed retained native pixels but failed the 20-page median performance criterion: published 637 baseline 49.729833 ms, candidate 66.519125 ms, allowed 66.396499667 ms, excess 0.122625333 ms. Its 50-page median 52.348708 ms, p95 80.823292 ms and maximum 85.422584 ms passed. One unchanged exact-head retry was requested to check reproducibility. The measured switching code matches prior passing 5f/a4 candidates byte-for-byte; pointer parking occurs after the measured interval. Available timings do not establish a particular load source. The failed attempt is not accepted and no performance criterion changed.

The retained corrections remain:

- Record persisted appearance before any fixture UI changes; complete the full restored Store runtime/toggle/native-removal lifecycle; then open a new PageTone document with unchanged exact RGB, SVG/media and OS-pixel requirements. This separates Mouse's colour check from Dark Reader's confirmed blue transformation `[45,145,235]` to `[61,160,237]`.
- Move the real pointer to a verified neutral owned guest location before static shell captures, preventing the observed hover-tooltip overlap. Actual cursor position, page identity and zoom are verified; animation and pixel limits remain intact.
- Require seven integer DOM/native Nora pane rectangles for 638. Preserve the 971-pixel viewport, real owners, snapshots, overlay pixels, visibility, documents, scroll and before/during/after equality. Publisher [PR73](https://github.com/jeep-jim/OSMINOG-Releases/pull/73) is merged; historical 632/637 readers retain their original fractional contract.
- Keep the original signed CRX and every runtime resource. Electron 44.5.0 [LoadUnpacked](https://github.com/electron/electron/blob/v44.5.0/shell/browser/extensions/electron_extension_loader.cc) deletes root `_metadata`; normalization omits only `_metadata/verified_contents.json` and rejects unknown reserved contents. Real Dark Reader 4.9.135 has 89 archive files and 88 runtime files; CRX 858,730 bytes, SHA256 `0b7857ae92fd3aeab4292bb755aa0f108de6b68bc12f18d0c87fe757cdd40a9d`. The native redirect adapter retains same-session transport, omitted credentials, allowlisting before each hop, cancellation, size limits and the 60-second deadline.

Current local freeze: 1,301 Mouse tests, 1,297 passed, zero failed, four native skips. Source Python acceptance remains 16/16. Publisher 132/132 tests and all three template contracts pass; all pins remain unready. The next common source must complete installed acceptance, Ubuntu 24.04 and modern Windows gates before Mac → Linux → Windows publication.

The sections below retain the original request and implementation evidence.

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

## Resumed work and owner clarification — 23 November 2026

The owner explicitly requires publication in this order: **macOS Apple Silicon, then Linux x64, then Windows x64**. Candidate checks may run independently; no later platform is published before the previous platform's public package and update feed are verified. The Linux report is now an installation problem, replacing the earlier statement that the owner had not observed Linux.

The supplied Linux screenshots identify Linux Mint 22.3 Cinnamon 64-bit, Cinnamon 6.6.7, X11 and Intel Iris Xe. Opening `Mouse-Browser-6.0.37-Linux-x64.AppImage` displayed an application chooser offering disk-image tools. This establishes the observed opening path, not a particular missing library, sandbox failure or driver fault. The existing Linux build already produces a `.deb` as well as an AppImage; clean installation and the offered download need separate examination.

Recovered local candidate commits `bd186ee` and `31b7f77` were preserved in a separate worktree and merged with current main `08025fea4d5b993ee97495d4dff9ed5a7015deb3`. No source pull request or 6.0.38 native CI run existed at read-back. Review found twelve macOS native property descriptors but a hard-coded export count of eleven, excluding `paneCorners`. The descriptor count now derives from the array, and the Mac build checks the compiled module's required exports before packaging. This is a concrete candidate correction; native rendering and release acceptance remain pending.

## Final merge review before CI

Merged the current website changes from main `32ce98d268213abf9f1d42fe701f13bdbf7715d1`, retaining both journal additions. Replaced the large Mouse context with a compact current-state summary at the owner’s request. Review found that extension tab URLs were checked before upstream normalization; the adapter now resolves the URL first, rejects non-string inputs, cross-extension targets and local/active schemes, and passes only an own extension URL or HTTP(S) without credentials. The regression covers relative own URLs and the rejected cases. Final local Mouse run: 1,250 tests, 1,246 passed, zero failed, four native skips. Native CI remains required.
