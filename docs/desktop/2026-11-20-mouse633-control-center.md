# Mouse Browser 6.0.33 — control center, Agent Mouse and Linux

## Owner decision and scope

The owner explicitly corrects 6.0.32: Agent Mouse must remain available as before, including restoration of its panel; hiding every normal entry and forcing the panel closed was too broad. Restore a visible Agent Mouse entry and add optional, explicit Ollama installation/model guidance. Showing a panel must not itself enable its automation or change its existing approval/file/terminal controls.

Replace the far-right footer Quit button with Settings on macOS, Windows and Linux. Settings is a right sidebar like History and centralizes actual appearance, layout, agent, privacy, screenshot/archive, download, import and update controls. Preserve the existing top window controls and native quit commands. Keep generous group spacing and consistent icons; the accepted Nora/seams/task-only progress and view-only documents remain.

The T+ zoom chooser must show live page changes behind it instead of a frozen pre-zoom screenshot. Download activity belongs to the existing download arrow: measured byte progress while transferring, one completion bounce and an unread-completion count until Downloads is opened. No fabricated percentage for unknown totals.

Add user-selected bookmark-export import and password CSV import with OS-encrypted local storage, explicit copy/remove controls and no automatic access to other browsers' profiles. Do not describe manual credential storage as automatic form filling.

The owner authorizes immediate publication of completed updates for macOS arm64 and Windows x64, plus a first Linux x64 release for testing. Existing profiles, cookies, channels and immutable prior assets must survive. Linux is a new platform; no previous Linux update is claimed.

## Current execution status

Implementation in progress from source main `5f9befc8cd075557fc747bb734531d0f6c415260` and releases main `f0b6c970a31c84f12b51fb287b9aca87ef1bca64`. No 6.0.33 package or publication is yet claimed. Native installed acceptance, real upgrade checks, hashes, public downloads and channel readback will be appended after they complete.

Owner hardware media keys/live VK and unsupported Linux desktops are not silently treated as tested by CI. Signing limitations remain until actual signing/notarization is supplied.

## Implementation checkpoint — before native CI

Implemented the right Settings sidebar, restored Agent Mouse/home/provider entries and remembered panel, optional Ollama setup, live native-page zoom, download byte progress/completion animation/unread acknowledgement, and explicit bookmark/password export import. Passwords require OS encryption; Linux basic_text is rejected, and saved credentials have manual copy rather than autofill. Imports preserve originals and existing conflicting credentials. Read-only document viewers remain unchanged.

Reviewed normal/private IPC routing: private startup can read presentation settings but cannot write the normal settings or import credentials. Cancellation of app quit clears owned clipboard/pending import without permanently disposing a still-open app. Large bookmark imports use one batch to avoid repeated array scans.

Portable checks: the root 108-test focused run passed; the subsequent import/settings/Ollama/native-helper group passed 23/23, the retained corner-paint suite passed 9/9 after its new settings fixture was supplied, and private/settings/download feedback passed 26/26. Linux focused build/update contracts and Python verifiers passed their recorded groups. The broad local runner is **not** reported as green: two MCP-backed cases require the native addon, which is not present in this scratch checkout; local compilation cannot find Node headers. The native CI workflows build it before installed acceptance. No installed result or released 6.0.33 is claimed at this checkpoint.

The new installed owner-feedback process is bounded at 240 seconds and records actual native clicks, live page zoom pixels, real owned downloads, settings restoration, agent entries, imports and privacy. Mac/Windows also retain the older updater acceptance and add an actual installed 6.0.32-to-6.0.33 profile/package replacement check. Linux starts with an honest fresh-install baseline.

## First native evidence and additional owner requests

First source head `4301f08318b6293ea0a1097d10351da94caa6efe`, PR183:
- Mac run44694937392 passed portable/build gates and launched installed633, then the owner process stopped at the existing CI native-click allowlist. Added only the new633 smoke flag while retaining CI/absolute-profile restrictions.
- Linux run44694937975 passed825 Mouse tests (6 skips) and17+3 Python checks, then electron-builder rejected the exported APP_RUN helper. Removed that export and reproduced/verified the fix through the complete config loader.
- Windows run44694937561 passed its installed legacy629 and actual632 profile-replacement gates. The new owner process passed Settings and both live zoom checks, then stopped at a malformed quoted renderer selector in the test. The generated script error was reproduced with vm.Script and corrected. All43 static633 renderer snippets were then syntax checked. Raw verification ZIP14609864244:10734025bytes, SHA25631fede55aff99f313d398dcb66d1c7981ce9336a694c53a618115106c6da81e4. Root inspected actual light/dark Settings screenshots and corrected inherited column styling so labels and switches align as rows. These partial passes are not complete633 acceptance.

The owner additionally requested a right-click menu with favorites, split/grid icons on every desktop OS, and explicitly removed the footer X shown in the supplied screenshot. Implemented a Mouse-only native context menu retaining existing link/image/edit commands, with captured-page/frame/desktop validity checks and small premultiplied-alpha icons. Shell/home/document targets use trusted IPC; layout actions activate the clicked pane and preserve its tab. Favorite storage follows the actual normal or private library. The footer X is removed; current six-case footer evidence must record footerClosePane=0.

A new installed context-menu process section requires real OS right-click/menu keys, actual menu/show/close events, before/open display pixels, correct-pane splits and grids, preserved pages and separate private favorites. Its raw report is SHA-bound into the owner report. Root routing/layout contracts passed19 focused checks, followed by4 production-layout checks including preserving the clicked tab in stacked halves. Context/native input focused checks passed their separate groups. New native acceptance is pending; no633 release/channel changes yet.

## Second native run and publication contract checkpoint

Source head `a2a32060d5a02f4c8b558a5c11ae371b729df337`: Linux run44697336566 built both packages, then stopped before installation because electron-builder expanded `${arch}` as `x86_64`/`amd64` instead of the agreed channel filename `x64`. The fixed-x64 target now uses a literal artifact architecture; its focused check exercises the real builder macro expansion for both formats. The same run exposed an overbroad redaction-test regexp matching `777` inside a legitimate fractional timing value. The assertion now targets the rejected JSON group field, while exact event/diagnostic assertions remain. The two focused checks passed. These facts do not claim a Linux native launch.

Mac run44697336608 passed the new Settings stage, then the owner check did not receive a trusted native click on the live T+ chooser. Actual failure pixels and input geometry are being inspected; its context-menu stage was not reached. Windows native acceptance is still pending.

Release contract PR60 (`fac18e752ef258ab76b8645941f1c4a2b1687f19`) passed all9 workflow runs, including all3 current633 contracts and retained registry/631/632 contracts. Its local12 synthetic suites passed288 checks. Pins remain unready and no publication trigger exists; these contract checks are not native application acceptance.

The downloaded Mac evidence ZIP14611248312 is818546bytes with SHA25629aff43d52c06c2497fce3b18891ed2615099120efb4be6d525b8837412e1c4e. Root inspected its actual Settings and T+ OS frames. Settings rows and footer gear render correctly and the footer X is absent. The T+ frame confirms native occlusion: a580px WebContentsView paints below its462px parent. T+ now reserves actual native viewport height only while the chooser is open; the same pages stay live, and closing restores their slot bounds. A production-renderer/native-layout regression reproduces that exact geometry and restoration;32 focused floating-overlay/corner tests passed. This changes page height on opening/closing, not page identity or navigation. Actual installed confirmation remains pending.

Windows evidence ZIP14611243611 is9915269bytes with SHA256dece6f3006c3ce8a39568465fb20476ab5d87bcee980b7535f0676d1dde280c2. The new candidate completed the actual629 profile-read assertions and native Quit, but its process remained after app quit and was stopped at the existing35s teardown bound. Review found a new context-menu cleanup reading BrowserWindow.webContents after window destruction, before the original guest cleanup. The context service now retains its live shell reference and avoids that destroyed-window getter. Its focused25-case group passed, including a destroyed getter and the real BrowserWorkspace disposer closing all guests. Timeouts are unchanged; actual native exit confirmation is pending. The smoke exit diagnostic allowlist also now includes633/631/Linux behind the existing CI and absolute-owned-profile guards; its3 focused tests passed. No successful owner/context native stage is claimed from this Windows run.

Source head `8d5958586a4a38adc9e149d9000a635e4ac9d623`, Mac run44698845260, stopped before packaging: two retained progress-pane tests extracted layoutNow with a one-line-only regexp, which no longer matched the formatted production function. The extraction now reads the entire production function up to the next named function. All existing geometry/ownership assertions remain, and all20 tests in that suite passed. This is a test-fixture correction; production is unchanged from the preceding fixes. No native result is claimed from this early run.

## Fourth-head installed results

Head `d1de29cfc140fb9b56aa28e77b15cb65c5b00e3f`: Mac run44699263220/job136163384148 passed Settings, both live native zoom checks, Agent restoration and all7 actual context-menu actions. Root viewed the original T+ and light/dark menu frames; controls are visible and page content scales, and the footer X is absent. Independent frozen context verification passed on the real report/PNG bytes. Raw ZIP14612455811:2667555bytes,SHA256cf05eca07a53641067157ef61fc80d9e7759b5fbab167d6718452cfd2473985b. The full owner gate then failed because its passive input observer was lost when the context test genuinely entered/exited private mode and navigated the shell. Reattach that observer to the returned normal document before downloads; no production behavior or acceptance predicate changes. The app now exited itself with code1 instead of hanging at the outer timeout.

Windows run44699263244 passed both actual629 and632 profile-upgrade checks and reached the same successful native context marker, then stopped at the same following renderer-observer boundary. The next head retains both real upgrade gates. Linux run44699263391 built correct AppImage/deb files and installed the deb, then its first launch failed because the image-drag service selected the Mac addon on Linux. The loader now uses the packaged Linux MCP addon; its native primaryDown export queries XQueryPointer/Button1Mask, returning false without a display. X11 build/runtime dependencies are explicit. The existing gesture/ownership guards remain, with an installed XTest released/held/released check and an independent release predicate. Four focused loader/gesture/build checks passed; native Linux compilation and launch require the next CI. Other startup Mac-addon imports were inspected and are platform guarded.

All fourth-head results are partial. No633 candidate, ready pin, public package or channel is accepted from these failed runs.
