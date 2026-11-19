# Mouse Browser 6.0.29 — Windows x64

The owner explicitly requests a complete Windows x64 installer of the same
6.0.29 Mouse product, including the current Nora, pane-colour and scrolling fixes.
The Mac-only scope in earlier entries is extended by this instruction.

## Starting evidence

The first Windows workflow, source `803b0644c6609f355e04736385e288988b6d3bb1`,
failed in run [44499683302](https://github.com/jeep-jim/OSMINOG/actions/runs/44499683302):
`mouse-native-build.cjs` intentionally rejected Windows. No working installer
was produced by that run. A CI page is not a download deliverable.

The 6.0.29 baseline is PR170 source
`72679ee907dda6e7ac134b1f01addee858c4e59a`, merged as
`a5a773c16c2b342f9c7dfaf5334649e1da1f3eca`. Its Mac run
[44498720435](https://github.com/jeep-jim/OSMINOG/actions/runs/44498720435)
succeeded. That result alone does not verify Windows.

## Implementation contract

Use the same `mouse-main.cjs` application and version 6.0.29; do not package the
legacy Trader OS entrypoint under a new filename. Preserve the existing Mac
profile, native helpers and static update feed. Windows has its own NSIS app ID
`black.mouse.browser.windows`, Mouse Browser shortcuts and approved mouse icon.
Uninstall must not remove profile data.

Port actual runtime services: Windows window controls and keyboard modifiers,
screen capture, native pane clipping, bounded verified NSIS update/relaunch,
ConPTY/PowerShell execution and complete process-tree Stop, and Local MCP access
through handle-relative filesystem operations with reparse/hardlink boundaries.
Keep permission grants and private-session isolation intact.

The immutable distribution target is `mouse-windows-v6.0.29-x64` in
`jeep-jim/OSMINOG-Releases`, asset `Mouse-Browser-6.0.29-Windows-x64.exe`.
The independent Windows feed is `platforms/windows/mouse-x64/latest.json`.
Do not advertise a URL as ready until the public asset is verified.

## Required release evidence

The Windows runner must pass retained unit tests, compile the native module,
build NSIS, install into a path containing spaces and Cyrillic characters, and
verify the installed x64 application. Native UI tests cover current Nora and
scrolling behaviour, both themes, pages/desktops, documents, pane progress,
private mode, Local MCP and terminal lifecycle. Verify persisted profile data
through restart and an actual same-version reinstall. Check ordinary launch
without test flags for a real visible application window. Record explicit
checks and screenshots; generated input is not a physical touchpad test.

Publication imports the exact successful CI installer and checksum, performs
another installed Windows check, verifies the public release bytes, and only
then advances the separate Windows feed. Preserve immutable old releases.

## Current status

Windows port and verification are in progress. Local packaging/icon checks pass;
the Linux executor cannot establish Windows native correctness. No successful
Windows build, installed acceptance, release, owner-device result or Authenticode
signature is claimed at this initial entry. The first Windows release is unsigned.

The initial native-port run
[44501682066](https://github.com/jeep-jim/OSMINOG/actions/runs/44501682066)
passed locked dependency installation and both production audits. It stopped
before C++ compilation: Node 22's bundled node-gyp 11.5 did not recognize the
VS18 installation on `windows-latest`. The source builder is pinned to the
`windows-2022` VS2022 image, and node-gyp is given the configured Python path.
This is a toolchain correction, not a passed native implementation check.

Run [44503108102](https://github.com/jeep-jim/OSMINOG/actions/runs/44503108102)
at `7ebce13a0d2f3c390c8ef715b9acbb8844f3a674` compiled the Windows module and
completed the unit stage: 605 of 620 Mouse tests passed, 15 failed. It did not
build or install an application. Failures exposed Windows directory sharing
rules during atomic replacement and race fixtures, short DOS path aliases in
updater/terminal checks, the lack of Windows `O_NOFOLLOW` semantics, and POSIX
mode assertions that do not describe Windows ACLs. The retained stylesheet
hash difference was reproduced exactly by LF-to-CRLF conversion; the builder
now disables checkout conversion rather than changing the accepted artwork
hash. The native boundary remains based on held handles and reparse/hardlink
rejection. Follow-up Windows execution is required for every correction.


## Windows native and unit gate; first installed application

The native filesystem corrections preserve handle-relative lookup and use the
host libuv descriptor table. NTFS replacement uses NtSetInformationFile with a
held parent; the destination metadata handle is closed before replacement.
Existing-file writes also compare the bounded original bytes through the checked
handle: same-size edits can share a Windows timestamp. This is a precommit
conflict check, not an atomic compare-and-swap guarantee against external editors.
The Windows terminal owns descendant processes through a Job object and closes
the bundled ConPTY pipes and worker on Stop, including Stop before first output.

At source `6073548d39e364958e3f1353012da1d8442d9781`,
[run 44507849036](https://github.com/jeep-jim/OSMINOG/actions/runs/44507849036)
completed native compilation, 176/176 base tests, 624/624 retained/Windows tests
with no skips, four Python verifier checks, and the NSIS build. The installer
actually installed into a directory containing spaces and Cyrillic characters:
exit zero after 27094 ms. The installed executable was AMD64 (0x8664), emitted
MOUSE_READY 6.0.29, and opened native page layouts. Installed acceptance then
failed because the new Windows smoke attempted to use hidden legacy global
Back/Forward/Reload controls. The application exposes those actions in the active
pane. The smoke now targets those real visible controls; no acceptance requirement
was removed. Python stdout/stderr are explicitly UTF-8 so runner ANSI encoding
cannot obscure the original failure while printing a Cyrillic path.

The next candidate merges the already published Mac 6.0.29 journal and retains
both platform histories. Windows installed acceptance and public availability
remain pending at this checkpoint. No owner-device test has been performed.


## Real Windows navigation and visual acceptance

Candidate `44c42aaa34511805c6977d46f111ff1355e2e545` built the NSIS minimum-OS
hook successfully and passed 176/624 unit groups. Its added signature measurement
failed before installed acceptance; stderr had not been retained, so the exact
native cause is not established. The verifier now uses an owned UTF-8 result
file, preserves PowerShell diagnostics, and measures the actual signature after
UI/profile acceptance but before declaring success or emitting a build manifest.
The same 44c runtime passed the full retained Mac installed workflow:
[44510163582 / job 135512003081](https://github.com/jeep-jim/OSMINOG/actions/runs/44510163582/job/135512003081).

The next Windows run used a script-only initial link click. Chromium marked the
unactivated history as skippable, leaving the visible Back control disabled.
The Windows smoke now uses real User32 input for the webpage link and verifies
its coordinate mapping through the native view parents. Production navigation
flags were not changed. The rule is documented by Chromium in
[history manipulation intervention](https://chromium.googlesource.com/chromium/src/+/refs/heads/lkgr/docs/history_manipulation_intervention.md).

At `f81b0b2f3aa9735f1ae5c10fce0b3e9d1ae2fe19`,
[Windows run 44512418438](https://github.com/jeep-jim/OSMINOG/actions/runs/44512418438)
passed native navigation, five live desktop identities, maximize/minimize,
Ctrl+A and Ctrl+Alt+S capture, retained PDF/DOCX/XLSX document cases, normal/private
search, metadata workload and per-pane progress. Real OS screenshots in large
light and small dark windows show the independent progress indicators.

The first real visual defect was isolated by the unchanged 629 pixel gate: all
18 separator probes matched, but bottom corner probes saw webpage colour
(171,43,158) instead of the divider (199,207,223). Full-display evidence confirms
square page bottoms. An ordinary parent View radius does not apply the guest
WebContents compositor's clipping. A Windows bottom-corner chrome implementation
is being added while preserving the exact guest viewport and square top corners.
Later Nora, private, Local/PTY, restart, update and ordinary-launch gates remain
required; this run is not a released or fully accepted Windows package.


## Native Windows visuals, retained Mac evidence and installed profile acceptance

At source `d40783c67be0c6ca8495092eb8f14fab578ef68c`,
[Windows run 44514880676](https://github.com/jeep-jim/OSMINOG/actions/runs/44514880676)
passed the unchanged 629 native visual and scrollbar checks. Full-display
captures and `mouse-629-ui-regressions.json` record four sets of 90 probes
(360 total) across light/dark and initial/resized layouts, including the repaired
bottom corners. Both Nora themes passed nine fill probes, hid the live native
guests, and restored their identities and bounds. Four wheel cases completed.
The fix draws native Windows corner chrome without changing guest viewport
dimensions; these measurements do not establish physical-touchpad behaviour.

The same source passed the complete retained
[Mac run 44514880718 / job 135528176994](https://github.com/jeep-jim/OSMINOG/actions/runs/44514880718/job/135528176994):
WRITE/READ, persisted profile and cookies, native wheel/tutorial checks, ordinary
launch and close/fullscreen/quit, private cleanup, and actual 6.0.28-to-6.0.29
replacement/relaunch. Later Mac runs failed unchanged closing-frame or restarted
Nora assertions. The single unchanged c716 retry passed WRITE and failed the
restarted-Nora READ check. Those failures remain recorded; their cause has not
been established and no motion or interaction criterion was relaxed. The d407
success is evidence for that exact source, not a passed result for later jobs.

Subsequent Windows smoke corrections addressed fixture state: omit empty-MIME
clipboard items while faithfully restoring an initially empty clipboard; prepare
four owned pages with real rounded panes before the retained 628 checks; and run
the private-home asset check before navigating away from that home. These changes
preserved the production behaviour and the retained assertions.

At `4840aa511abf2c4acec4d499eca7e21a5e079ed8`,
[Windows run 44519931043 / job 135545623496](https://github.com/jeep-jim/OSMINOG/actions/runs/44519931043/job/135545623496)
passed full WRITE, native close, same-installer reinstallation with unchanged
profile hash, and READ. Evidence includes the full 628/629 visual and motion
checks, private isolation, official-SDK Local MCP boundaries, real PowerShell
PTY success/exit-7/recovery/Stop, and restored preferences, cookies, localStorage,
bookmarks and wheel tutorial state. These are installed-run results; they do not
claim live external account or owner-device testing.

## Actual update helper failure and bounded correction

That 4840 run failed at the real update buttons. Downloaded installer bytes
matched the candidate SHA256, and preparation succeeded, but the helper did not
acknowledge readiness within the existing 15-second limit. Mouse stayed open.
No replacement/relaunch, ordinary-lifecycle completion or public release is
claimed for this run. The original child exit code and stderr were not retained,
so the specific cause of that launch failure is not directly established.

The correction keeps an independent updater process but launches PowerShell
through the system headless console host, with fixed UTF-16LE EncodedCommand and
paths passed only as JSON data. It records stdout, stderr and execution phases,
and rejects every pre-readiness host exit, including zero. This addresses a
documented matching failure mode of detached PowerShell startup
([PowerShell #28383](https://github.com/PowerShell/PowerShell/issues/28383),
[Node #51018](https://github.com/nodejs/node/issues/51018)); it does not retroactively
prove the missing original child trace. Console-host exit zero is never treated
as installer success ([Terminal #17178](https://github.com/microsoft/terminal/issues/17178)).

A Windows-only regression now launches the exact production helper against owned
checked bytes, requires readiness, then cancels while the original PID remains
alive and verifies that no installer or application bytes were executed or
replaced. The installed acceptance still requires the actual update buttons,
original process exit, successful NSIS replacement, new visible process, matching
READY receipt and post-update profile read. All package/hash, cancellation,
timeout and receipt checks remain enforced. Final exact-run and publication
results must be appended after they are observed.

## Recorded helper execution exposed PowerShell module inheritance

At `39dbb807450a5aa529525bd8d201d85a0f21bc75`,
[Windows run 44524311152 / job 135560736752](https://github.com/jeep-jim/OSMINOG/actions/runs/44524311152/job/135560736752)
again passed full installed WRITE, reinstallation and READ. The new console host
actually started the helper, which recorded `Helper started` and then failed:
Windows PowerShell could not resolve `Get-FileHash`. The real helper regression
failed for the same reason: 625 of 626 retained/Windows tests passed. The
installed update correctly surfaced the diagnostic on the host's pre-readiness
exit zero, instead of waiting for the old generic timeout.

The API's unit-step conclusion was initially read as success. This was incorrect:
that workflow step uses `continue-on-error`; its detailed log and recorded
outcome were failure. The final combined release gate rejected both failed
outcomes. This run does not establish a passed native helper test or updater.

[Microsoft's PSModulePath documentation](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_psmodulepath?view=powershell-5.1)
describes the matching PowerShell 7-to-intermediate-process-to-Windows PowerShell
module inheritance failure. The next helper correction removes PSModulePath
case-insensitively only from its child environment, allowing Windows PowerShell
to construct its defaults while preserving the isolated profile and other
variables. Hashing also now uses a read-only .NET stream and SHA256, retaining
size/reparse checks, both hash-validation points and deterministic disposal.
The related Windows terminal inheritance is being corrected separately; no
successful replacement/relaunch is claimed before the next exact Windows run.

## First complete installed Windows acceptance; terminal unit remains blocked

At source `a6b2adf33c4f4b866454a55c7f90fd79a9d3d9fe`,
[run 44526221203 / job 135567380376](https://github.com/jeep-jim/OSMINOG/actions/runs/44526221203/job/135567380376)
passed the complete installed Windows acceptance. This includes real native
interface and document checks, private isolation, Local MCP, PTY commands and
Get-FileHash, normal restart and exact profile preservation through reinstallation.
The actual Download/Install controls replaced the installed application through
NSIS and relaunched a visible new process (PID 1780 to PID 5452), acknowledged
READY and removed the receipt. The post-update profile read and ordinary launch,
second-instance restore and native close passed. Both installer and installed
executable were measured NotSigned with null signer fields.

Installed evidence archive 14532171289 is 9,950,161 bytes with SHA-256
`6964fe81deb5658637d54a4c4e9fe370ad7e9eade12cec38e3a712d8679f952a`.
Its installation took 35,859 ms, WRITE 155,297 ms, reinstall 33,015 ms, READ
2,469 ms and post-update READ 2,297 ms. These measurements describe this runner.
The updater's 5,593 ms field covers only the original process through exit,
not the entire background NSIS installation.

The overall run remains failed: 176/176 base tests passed and 627/628 Mouse tests
passed. The real terminal background test returned a successful background-launch
reply, but its child's PID file did not appear within the unchanged readiness
limit. The PowerShell job reason was not retained in that run. Python contract
checks were not reached after the Node failure; the installed signature checks
did run and passed. No candidate artifact or public installer was emitted.
The next source adds bounded job-state/error/output diagnostics and a separate
short native terminal workflow, with no production change or weaker assertion.

## Preserve the requested 6.0.29 while main advances independently

While Windows acceptance was running, main advanced from
`ca4f3ce555d31138be15642490a4a063e15c75c0` to
`82b6d317eed274d4c009572581970280bec2fb3e`, introducing Mouse 6.0.30.
PR 172 then conflicted, which prevented its pull-request workflows from running.
The owner explicitly requested Windows 6.0.29. The maintenance branch
`release/mouse-6.0.29` is therefore created from the known 6.0.29 base
`ca4f3ce555d31138be15642490a4a063e15c75c0`, and PR 172 targets that branch.
The newer main runtime is preserved. Publication must still require the exact
successful Windows source head, its merged maintenance PR, immutable artifact
hashes, a fresh full installed verification and anonymous public download.
This changes the version-specific integration branch, not any acceptance gate.

## Complete source acceptance, followed by a fresh-host rendering failure

Source `9b15a122c82edcec853e78a88d921128a58d1bf2` passed
[Windows run 44532782697 / job 135590206217](https://github.com/jeep-jim/OSMINOG/actions/runs/44532782697/job/135590206217)
on Windows Server 2022: 176 base tests, 629 Mouse tests and seven Python checks,
with no failures or skips. Full installed WRITE, reinstallation, READ, actual
NSIS update and visible relaunch, post-update READ, ordinary startup,
second-instance restore and native close passed. The real terminal lifecycle
also passed in [run 44532782658](https://github.com/jeep-jim/OSMINOG/actions/runs/44532782658).
Preserving the runner's `PSModuleAnalysisCachePath` while independently resetting
`PSModulePath` removed the measured first-start delay without extending the
existing readiness or Stop limits. The background process is now a direct,
noninteractive PowerShell child contained by the existing ConPTY and native Job
Object; raw Unicode command data is passed through child-only environment
variables and cleared before execution.

PR 172 was merged into `release/mouse-6.0.29` as
`adc2faee898c8b835f20d0451fe91c9f95b5ed63`. The source candidate installer measured
125,607,419 bytes, SHA-256
`e789302e49469b733cdb735fee41d7a0094fd8d9425a64b72a915e2e578ce88e`.
Its installed executable and native runtime were independently inspected. Both
installer and executable remain unsigned. These results established the source
candidate on that host; they did not establish a public Windows release.

Release PR 52 passed all 22 publisher contract tests and was merged. The fresh
[publisher run 44535145464 / job 135598566630](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44535145464/job/135598566630)
successfully imported the exact pinned source, merged PR and hashed candidate,
but failed installed acceptance on Windows Server 2025. The installer and
installed executable hashes matched the successful source evidence. All 18
divider probes and eight page-interior probes in the first 6.0.29 separator
capture passed, while all 64 bottom-corner cutout probes failed after the existing
15 captures. The full display image shows square guest-page bottom corners.
The native-window cause is not established by that image alone. Public asset
publication and channel updates were skipped; no ready download is claimed.

The follow-up work records bounded native HWND state and runs the same complete
installed verifier against the same candidate on a second Windows 2025 runner.
The original pixel assertions, Windows 2022 acceptance and fresh publisher gate
remain required. A corrected build and successful public download verification
are still needed before delivery.

## Native snapshots isolate the modern Windows presentation defect

Diagnostic source `efd82bc701f631246d2d5729c093f5182e25fa6e` in PR 175 again
passed the complete Windows 2022 build, 176 base tests, 629 Mouse tests, seven
Python checks and installed/update acceptance in
[run 44537909335 / job 135608155139](https://github.com/jeep-jim/OSMINOG/actions/runs/44537909335/job/135608155139).
The new modern job verified that it received the same 125,613,959-byte installer,
SHA-256 `65b82af8124c2796903f249225fb1752628e4faa466d5c0744ec0ce50649bbec`,
and the bound source evidence, then reproduced the corner failure on Windows
Server 2025 build 26100, image `windows-2025-vs2026` version `20261103.298.1`, in
[job 135612502737](https://github.com/jeep-jim/OSMINOG/actions/runs/44537909335/job/135612502737).
The overall source workflow correctly failed; this diagnostic candidate is not
eligible for publication.

The independent before/after native snapshots show valid process, UI thread and
top-level ownership on both systems. Four accepted panes produced eight painted,
visible corner HWNDs at the highest eight child z-order positions, with error
zero and exact requested geometry. Client origin `(8, 8)`, DPI 96 and Electron
content bounds agree. On 2022, all four theme/size captures passed their 90
pixel probes at the first capture. On 2025, the 18 divider and eight page-interior
probes passed, but all 64 corner cutouts remained page pixels after 15 captures.
The parent extended style is `0x100` on the successful host and `0x200100` on
the failing host. Microsoft identifies the additional `0x00200000` bit as
[`WS_EX_NOREDIRECTIONBITMAP`](https://learn.microsoft.com/en-us/windows/win32/winmsg/extended-window-styles).
This establishes successful creation, paint, geometry and sibling ordering;
the missing display pixels require a native presentation correction, not a
change to the pixel expectations or JavaScript layout.

Both evidence archives were downloaded and independently checked. The 2022
archive `14537054456` is 9,903,209 bytes, SHA-256
`a0b98c1e59515cf6624388cc2521a7af18a4bbe36205e27a3b001a3653c2f94b`.
The modern archive `14537791527` is 2,204,307 bytes, SHA-256
`b127b5657bce311c328fcc9c30196e0777c67c3ac6691c1f43bf7a99e4ed4412`.
Release PR 54 now requires the complete source run and the exact modern job,
input-validation, full installed acceptance and evidence-upload steps to pass
at the pinned source attempt. Its 32 contract tests passed in
[release run 44538241110](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44538241110).

## Present the existing corner bitmaps through an owned composition layer

The correction selects a DirectComposition presentation path when the owned
parent has `WS_EX_NOREDIRECTIONBITMAP`. It retains the same tiny premultiplied
corner bitmaps, physical coordinates and noninteractive child HWNDs. Windows
parents without that flag keep the existing child-window presentation. The
parent's renderer flags and the JavaScript page layout are not modified.

The native trim creates its own desktop composition device with
[`DCompositionCreateDevice2`](https://learn.microsoft.com/en-us/windows/win32/api/dcomp/nf-dcomp-dcompositioncreatedevice2),
using the documented null rendering-device option, and binds its own target
above the parent's child windows. It wraps the existing layered HWNDs with
[`CreateSurfaceFromHwnd`](https://learn.microsoft.com/en-us/windows/win32/api/dcomp/nf-dcomp-idcompositiondevice-createsurfacefromhwnd).
The source HWNDs are cloaked through DWM while their bitmaps remain available to
the composition tree. The small visuals use the same physical offsets and a
client-area clip. No second GPU rendering device, popup window or external
runtime is introduced; the additional libraries are the Windows OS components
`Dcomp.dll` and `Dwmapi.dll`.

Creation, positioning and commit failures retain their explicit HRESULT and
stage. A target already occupied by another component is never replaced.
Removing a pane removes its visual; clearing or destroying the trim detaches
its own root, commits the removal, releases its COM references and destroys its
own source HWNDs. The bounded diagnostic now records both the successful cloak
request and the actual DWM cloak state. Independent review found no need to
alter the existing pixel, Nora, page identity or profile criteria. Twelve local
runtime checks passed, and the native build configuration parses cleanly;
Windows compilation and complete acceptance on both hosts are still required
before this correction is certified.

The first compile of this correction, source
`696892894d576d9db4f420427cc3edf387f8154a` in
[run 44541182197 / job 135619624655](https://github.com/jeep-jim/OSMINOG/actions/runs/44541182197/job/135619624655),
stopped at MSVC error C2872: the local diagnostic helper named `boolean`
conflicted with the Windows SDK type brought in by the composition headers.
No installer or installed acceptance was produced by that run. The helper and
its calls are renamed to a unique function name; no drawing behavior or test
criteria change is involved.

## Modern rendering passes; the remaining failure is updater startup

Source `9b5d93fc47382bc027c1f8c05e8e2fc08090c86b` compiled successfully in
[run 44541832593](https://github.com/jeep-jim/OSMINOG/actions/runs/44541832593).
The complete Windows 2022 job `135621903877` passed, including the actual
installed update and restart. The exact same installer was then verified on
Windows Server 2025 build 26100 in job `135627856046`. All four 90-pixel
separator/corner captures and both nine-pixel Nora captures passed at the first
attempt. The native report records the conditional composition path, eight
surfaces and visuals, successful commits and actual cloak state 1. The complete
WRITE workload passed in 152,688 ms, followed by a successful reinstall with an
unchanged profile and a successful READ workload in 2,453 ms. Agent PTY, Local
MCP, native file operations, documents, private isolation and wheel behavior
passed within that installed workload. Physical touchpad and external-account
testing are not claimed.

The later update-button stage failed before the PowerShell helper acknowledged
readiness. The helper wrapper PID 6928 exited with code 0; no result or readiness
file existed, stderr was empty, and the 90 stdout bytes contained only console
control sequences. Cancellation was recorded and the source run correctly
failed. Its installer is 125,615,658 bytes, SHA-256
`9deff57cf96babdf0b5f08240fef141f75e473e844b4a44742281f7c4381aba7`.
This candidate is not eligible for publication despite the successful UI work.

The downloaded 2022 evidence archive `14538709389` has SHA-256
`6bba051caec815a55a8013e9cb127e8c9baa4d1baaf802c340f8af0aa4ba09b9`;
the modern archive `14539198141` has SHA-256
`0f2c24fc592087a96a15d363be9af325e0ca9ea472ccaba5f5095f2e82c757dc`.
Independent inspection of all 22 PE files, including delay imports, found no
external MSVC runtime dependency. The composition addon uses the Windows OS
libraries `Dcomp.dll` and `Dwmapi.dll`.

## Give the update helper its own documented process lifetime

The failing launch used `conhost --headless` with NUL input. Microsoft's console
[change adb04729](https://github.com/microsoft/terminal/commit/adb04729bcce7151f6380eded79e9408df9d1e3b)
makes a successful zero-byte input read terminate its VT input loop. This is a
source-supported explanation consistent with the observed early console exit;
the exact runner console binary has not been disassembled, so the specific
binary-level cause is not claimed as proven. Microsoft also describes direct
[`conhost --headless` use as unsupported](https://github.com/microsoft/terminal/issues/13914).
A pipe owned by Mouse would close when Mouse exits, which would not meet the
updater's required lifetime.

The replacement launches the fixed system Windows PowerShell executable through
documented
[`CreateProcessW`](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-createprocessw),
with `CREATE_NO_WINDOW`, a Unicode environment and an explicit standard-handle
allowlist. Its NUL input and duplicated file-backed log handles do not depend on
a parent-owned pipe. It does not request `DETACHED_PROCESS`, a new console or a
job-policy breakaway. Direct native creation avoids libuv's additional child
job while preserving any enclosing Windows job policy. The fixed PowerShell
script, checked package bytes, JSON path data, readiness, cancellation and
receipt protocol remain unchanged.

A type-tagged native token retains the exact created process handle. Status and
cancellation use that handle, avoiding a later PID lookup; releasing the token
closes only the handle and never terminates a successful updater. The JavaScript
adapter reports the actual PowerShell exit code and keeps the existing bounded
readiness deadline. The proven pane-corner implementation is unchanged.

A separate focused workflow builds the native addon once on Windows 2022 and
runs those identical bytes on Windows 2022 and the current modern Windows
runner. It binds source, run, attempt, Node version and hashes before testing.
Two real-helper tests require readiness and cancellation, then prove survival
after the launching Node process exits. An independent live original-process
guard prevents the synthetic installer from executing; the tests require
cancellation, unchanged fixture files and no installer-start trace. The full
source installation/update gates and fresh publisher gate remain required.
These changes still require actual Windows execution before readiness can be
claimed.

## The native helper passes on both Windows hosts

Exact source `164462db8d81f614cce9c9a8ab5d1fed0e2b7381` passed the complete
[focused helper run 44548393307, attempt 1](https://github.com/jeep-jim/OSMINOG/actions/runs/44548393307).
The Windows 2022 build produced one AMD64 addon, 249,344 bytes, SHA-256
`4febbe21108e64eea6d8e9aca9a3df8f356cf266d22d1b6d29aa12a1070400ee`, using
Node 22.23.4. Both Windows Server 2022 build 20348 and Windows Server 2025
build 26100 ran those identical bytes. Each actual host report and TAP log
records two passed tests, zero failures, cancellations or skips, exit code 0
and both required readiness/cancellation and parent-lifetime markers. The
addon hash remained unchanged after testing. Archive digests, PE identity and
all nine bound source-file hashes were independently checked before accepting
these results. These tests do not replace the complete installed update gate.

The complete Windows 2022 source job `135645115011` also succeeded in
[run 44548393177](https://github.com/jeep-jim/OSMINOG/actions/runs/44548393177),
with 176/176 retained base tests, 632/632 Mouse tests and 7/7 Python verifier
checks. There were no skipped, cancelled or failed Node tests. Native compile,
NSIS build, installed UI/profile/agent workload, reinstall, actual update,
post-update profile and ordinary launch completed successfully; the final
mandatory gate records both `UNIT_OUTCOME` and `INSTALLED_OUTCOME` as success.
The exact same candidate has moved to the complete modern installed job
`135649742474`. That modern result and the fresh publisher remain pending at
this point in the history; a ready public download is not yet claimed.

## Both complete installed hosts pass on the corrected immutable candidate

The entire source run `44548393177`, attempt 1, completed **SUCCESS**; GitHub's
run record was updated at 2026-11-19T15:04:50Z. Modern job `135649742474`
completed at 2026-11-19T15:04:49Z after full installed
acceptance on Windows Server 2025 build 26100, image `20261116.315.1`.
This is a newer image than the separate focused helper run used. All thirteen
WRITE checks, two READ checks, raw-log markers and subsequent update/lifecycle
stages passed. All 378 unchanged pixel probes were independently sampled from
the actual PNGs; every capture passed at its first attempt. Full-display
screenshots confirm rounded lower corners and Nora above the native pages.

The exact installer is 125,623,123 bytes, SHA-256
`18bf6e78eb5519e37d2ceb0e45acd1ea88d8f519e715e1d94d2fbc3c476e2e9d`.
Candidate artifact `14542211662` contains exactly the installer, checksum and
build manifest; ZIP SHA-256
`a1f0492fa0ec71b03c1fe8d4a86c45bd3a312520c5dff659fcb1f90d799b2b77`.
The 2022 verification archive `14540648859` is 9,798,683 bytes, SHA-256
`88158f2e4fab4c9bcd7111827be5927f5ba3aeb269a179e956694c9a90edb20d`;
its report hash `7edfe209345f86f8f7714c39834898b340bb49da52ca7834ce64d8c69b32e026`
and complete parsed report match the candidate's embedded evidence exactly.
Modern archive `14543131734` is 10,217,137 bytes, SHA-256
`983c0237dd6fbd6b2cd3900912f7b91a6bf2688da04db8ef883860e815ce22cd`;
its final report hash is
`90d933325d99d6e81745200727bfb99320c264e65af55a714c135861caeb130d`.

The actual updater reopened visible Mouse windows on both hosts: original
PID 5872 to new PID 1152 on 2022, and PID 7376 to PID 8904 on modern Windows.
Both helpers reported `Installer completed`, the new application acknowledged
its receipt, and independent post-update READ processes preserved the tested
profile. Ordinary launch, second-instance restore and native close passed.
The installed executable hash remained
`2ef311f8bb414d71cf6d5d8da62bfb758ab804c8edb0ba0e0c54d0dcbc6ce2d3`
across installation, reinstallation and update on both hosts. All 22 packaged
PE files, including delay imports, were audited again; there are no external
MSVC runtime imports. The actual new addon is 249,344 bytes, SHA-256
`51fd069ebf66128e39458310911f90968efc908b7617528002bf05398d8c2f45`.
Its documented process/handle APIs add no new DLL dependency.

[PR 175](https://github.com/jeep-jim/OSMINOG/pull/175) was merged into the fixed
6.0.29 branch as `57192416d0ba7e3078dd05667c968ebb40520b7a`, preserving exact
tested head `164462db8d81f614cce9c9a8ab5d1fed0e2b7381`. Other automatic source
workflows, including retained Mac checks, also succeeded. Release PR 54 now
pins these candidate/evidence hashes and this exact merge. Its existing owner
publication marker is explicitly rearmed for the corrected pin without
changing its required text or bypassing any gate. The fresh publisher,
public asset and anonymous feed/download proof are the remaining steps.

## Fresh installed verification passes; draft lookup blocks publication

Release PR 54 passed all four PR workflows and was merged as
`d437dbe6c14e341f259ee99e193cfb22778bc9a2`. Its triggered
[publisher run 44551695669 / job 135657018947](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44551695669/job/135657018947)
successfully imported the immutable source and package, then passed the entire
fresh Windows installed gate. The original update PID 3224 became a new visible
Mouse PID 6816; receipt, post-update profile, ordinary lifecycle and actual
signature measurements passed. Independent review again checked all 378 PNG
probes. The installer and application hashes are unchanged from the accepted
source candidate. This establishes a third complete installed-host acceptance.

The fresh evidence archive `14543956852` is 10,289,146 bytes, SHA-256
`54d1e78ad14c4c72ea9d4ebced471415ecffc983c39c728422e0255f744b92a5`.
Its final installed report hash is
`7006df0982bd6584d3c0382e5c144e573d6055414571d8132d1be8b6b59e89ab`.
It contains no public-release or channel proof.

The following publication step created a draft at 2026-11-19T15:15:56Z, then
failed when it immediately queried the by-tag endpoint. GitHub's
[documented by-tag lookup](https://docs.github.com/en/rest/releases/releases#get-a-release-by-tag-name)
is for published releases. Authenticated list readback confirms draft ID
`451521130`, exact tag `mouse-windows-v6.0.29-x64`, the intended source/checksum
notes, `prerelease: true` and an empty asset list. The failure happened before
asset upload, and the channel step was skipped. The narrow publisher correction
must reuse this existing draft and retain its stable release ID through upload
and publication, while preserving all source, immutable-byte, fresh installed
and anonymous-download gates. The installer and source need no rebuild.

[Release PR 55](https://github.com/jeep-jim/OSMINOG-Releases/pull/55), exact head
`60cff32aa92fa1366070222f629543d11258ef85`, implements that narrow correction.
It scans the authenticated release listing with a complete bounded pagination
budget, rejects duplicate exact tags and mismatched repository/ID/title/source/
run/checksum identity, and reuses the existing draft. All later reads, raw
uploads and publication use the validated numeric ID. Every existing asset is
checked before any upload, and the immutable remote bytes are verified before
the draft becomes public. Only the verified draft's notes are refreshed to
point to the current fresh-install run.

All 46 publisher contract tests passed locally, including fourteen new
draft/reuse/pagination/ambiguity/upload/publication cases. Independent review
confirmed that the pin, source/artifact/merge gates, fresh installed verifier
and channel code are unchanged. The real draft `451521130` passed the new
identity validator against the actual pin. GitHub CLI's primary implementation
was reviewed for the binary upload contract: fixed uploads URL, raw file body,
file-derived Content-Length and GitHub token selection. This confirms the
chosen mechanism; actual upload, public readback and anonymous download still
require the corrected publisher run.

## Final outcome — Windows 6.0.29 published and anonymously downloaded

Release PR 55 passed all four PR workflows and was merged as
`bdaf253b4507fc35a418922b81be984cd9f55031`. The corrected
[publisher 44554901554 / job 135668405294](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44554901554/job/135668405294)
completed **SUCCESS**, including immutable import, fresh installed acceptance,
public asset verification and anonymous full download. The frozen source and
installer were not rebuilt. The fresh update moved from PID 6316 to visible
PID 1436, acknowledged the receipt and preserved the checked profile. All
thirteen WRITE checks, two READ checks, later lifecycle stages and 378 actual
PNG probes passed; measured signatures remain `NotSigned`.

The existing release ID `451521130` was reused and published at
**2026-11-19T15:32:59Z**, with `draft: false` and `prerelease: true`:
[Mouse Browser 6.0.29 — Windows x64](https://github.com/jeep-jim/OSMINOG-Releases/releases/tag/mouse-windows-v6.0.29-x64).
The direct installer is
[Mouse-Browser-6.0.29-Windows-x64.exe](https://github.com/jeep-jim/OSMINOG-Releases/releases/download/mouse-windows-v6.0.29-x64/Mouse-Browser-6.0.29-Windows-x64.exe),
asset `768225354`, exactly **125,623,123 bytes**, SHA-256
`18bf6e78eb5519e37d2ceb0e45acd1ea88d8f519e715e1d94d2fbc3c476e2e9d`.
All four expected assets are unique and uploaded: installer, checksum, build
manifest and the fresh installed report. Their API sizes/digests match the
locally verified bytes. The public notes point to this successful publisher.

Both `platforms/windows/mouse-x64/latest.json` and the versioned `6.0.29.json`
were read back and agree on version, platform, architecture, direct URL, size,
digest and publication time. The production updater observed the static feed
on its first attempt, anonymously downloaded the entire installer, checked its
streamed size/SHA-256, rehashed the saved file and accepted the current-version
check. The comparison version `6.0.28` is explicitly a fixture: no earlier
published Windows Mouse upgrade is claimed.

Final evidence artifact `14545915755`: **10,066,243 bytes**, ZIP SHA-256
`666eb7f3386b4fb01fd659789bb1ba54c1de4e6b4e4514f035f60cc9967209a2`.
The final installed report and public verification asset have SHA-256
`cf5f71720be71db2c466f3cab8a5dc85fdfcce6118be0e9e908c433ea1f9c550`.
Anonymous channel proof SHA-256 is
`110200230d8255ea0b4190e37d958c02223b406fbc6aa41f7d9984fc886e6b58`;
the first-attempt observation file hash is
`5d96d4ff5742921f5191fb50782362d8f939d2eefc7026bf46aad03b76e88fd8`.
Independent artifact, installed/UI and public/channel reviews all passed.

Final status: **PUBLISHED / VERIFIED_DOWNLOAD**. This is the requested ready
6.0.29 Windows x64 installer, distributed as an unsigned prerelease. The
published package supports the documented Windows target and bundles its
runtime; separate Node.js/npm/Python installation is unnecessary. Physical
owner hardware, a physical touchpad and live external accounts were not tested.
The 6.0.29 maintenance source and Windows channel are separate from the newer
main and Mac channel. Earlier failed/pending records above remain as history.
