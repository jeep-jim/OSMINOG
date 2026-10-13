# Windows candidate — NOT a production release

This branch ports the existing board into an isolated Electron host. It is a compatibility candidate, not the completed desktop product. Do not replace the Chrome installation with it.

## Included
- Existing board/editor assets, light/dark themes and existing version/update button.
- Isolated application profile; serialized local storage writes with a previous-state backup. Existing Chrome data is not read or overwritten.
- Sandboxed renderer, no Node in documents, main-frame IPC validation, external HTTP(S) links only.
- Separate Windows NSIS update adapter: no automatic download/install; explicit button action saves the board first. The Chrome updater source and release feed are unchanged.
- Windows CI launch/reload persistence test and NSIS candidate build.
- Preview 0.2.0: native WebContentsView tabs, HTTP(S) navigation/history, resizable 1/2/4 panes, canvas switching without page reload, screenshots into the current project and four provider websites in a right pane.
- Browser cookies/login sessions remain in the local `persist:osminog-browser` profile. Browser tabs are in memory, not restored after quitting. Boards remain in the local workspace store. No OSMINOG relay/storage server is introduced.
- Explicit page-context preview/copy; this does not automatically send context or execute AI replies. The provider website pane is not a verified assistant connection.

## Release blockers
- Publish/verify Windows update channel and N -> N+1 installed upgrade with board preservation. No live Windows channel currently published.
- Code signing/provenance and clean-machine installation test.
- Browser-dependent tools need explicit native adapters. Their calls currently return unsupported errors; do not advertise AI connectivity.
- User sign-in to provider websites and a real provider response round trip. Cross-device synchronization is outside this local-browser task.
- Signed board-to-AI protocol and actual external ChatGPT read/write verification.
- Full document/media, drag/drop, clipboard and capture regression on Windows.
- Import Chrome project backup and validate files before offering migration.

## Product decision
Windows first; extension later as a capture companion. One board format, multiple clients. GitHub stores source and software releases, not a public bucket of private user materials. Authentication does not implement synchronization. Public guest access needs a viewer and reachable shared data; offline-only boards are not remotely available.

Install dependencies and run `npm start` for the candidate. `npm run build:win` builds NSIS. No publication occurs automatically. Production installer channel must be configured and verified before release.

## Verification, 2026-10-13

Source branch: `codex/local-browser-20261013`, PR #23. Windows Actions run 38420534940 passed the real host storage/reload test, native browser test, NSIS build and packaged application test. Run 38421239724 additionally checks view visibility/bounds and captures the composed native window (a renderer-only screenshot omits the native child views).

The browser fixture sets both `Content-Security-Policy: frame-ancestors 'none'` and `X-Frame-Options: DENY`. It verifies all four independent pages, navigation history, a PNG capture, unchanged page state across canvas switching, blocked file URLs, project isolation and tab closure. This is controlled-fixture evidence, not universal website compatibility or authenticated AI testing. Public pages may impose their own login, DRM or supported-browser requirements.

Download the candidate only from this branch's successful Windows Actions artifacts. It is unsigned and the update feed has not been advanced. Chrome 4.0.9 remains unchanged; a Chrome extension cannot itself supply native Chromium child views.

