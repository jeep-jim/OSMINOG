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
