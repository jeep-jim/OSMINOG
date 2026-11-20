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
