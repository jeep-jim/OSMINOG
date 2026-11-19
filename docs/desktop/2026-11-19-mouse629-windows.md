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
