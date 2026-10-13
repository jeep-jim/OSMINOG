# OSMINOG Browser — Windows Preview

Local Windows browser with native Chromium pages and the existing project canvas. Preview releases preserve a separate desktop profile; Chrome projects require an explicit import rather than overwriting the original installation.

## Included
- Existing board/editor assets, light/dark themes and existing version/update button.
- Isolated application profile; serialized local storage writes with a previous-state backup. Existing Chrome data is not read or overwritten.
- Sandboxed renderer, no Node in documents, main-frame IPC validation, external HTTP(S) links only.
- Separate Windows NSIS update adapter: no automatic download/install; explicit button action saves the board first. The Chrome updater source and release feed are unchanged.
- Windows CI launch/reload persistence test and NSIS candidate build.
- Preview 0.2.1: native WebContentsView tabs, HTTP(S) navigation/history, resizable 1/2/4 panes, canvas switching without page reload, screenshots into the current project and four provider websites in a right pane.
- Browser cookies/login sessions remain in the local `persist:osminog-browser` profile. Browser tabs are in memory, not restored after quitting. Boards remain in the local workspace store. No OSMINOG relay/storage server is introduced.
- Existing project chat is embedded beside native pages. Its native DOM transport sends the current canvas context and the last visible browser panes to the selected provider on an explicit chat request. Provider websites stay in separate project/thread conversations; login is available through the right pane. The existing parser returns replies and supported canvas tool/patch requests to the same project.
- A clear-history epoch starts a new provider conversation. Pending drafts in provider pages are preserved, not overwritten. Unsupported Chrome-only tools report errors.

## Release blockers
- Windows update channel is active as of 0.2.1; installed N -> N+1 preservation passed release run 38431251299. Keep this gate for subsequent releases.
- Code signing/provenance and clean-machine installation test.
- Some browser-dependent tools still need native adapters. Unsupported calls return errors; do not claim the complete Chrome tool set is available.
- User sign-in to provider websites and a real provider response round trip. Cross-device synchronization is outside this local-browser task.
- Actual authenticated provider read/write and attachment verification; fixture tests do not certify provider login or future DOM changes.
- Full document/media, drag/drop, clipboard and capture regression on Windows.
- Import Chrome project backup and validate files before offering migration.

## Product decision
Windows first, then other desktop systems and mobile. Extension work is paused; it does not constrain the native browser. One board format, multiple clients. GitHub stores source and software releases, not a public bucket of private user materials. Authentication does not implement synchronization. Public guest access needs a viewer and reachable shared data; offline-only boards are not remotely available.

Install dependencies and run `npm start` for the candidate. `npm run build:win` builds NSIS. No publication occurs automatically. Production installer channel must be configured and verified before release.

## Verification, 2026-10-13

Source branch: `codex/local-browser-20261013`, PR #23. Windows Actions run 38420534940 passed the real host storage/reload test, native browser test, NSIS build and packaged application test. Run 38421239724 additionally checks view visibility/bounds and captures the composed native window (a renderer-only screenshot omits the native child views).

The browser fixture sets both `Content-Security-Policy: frame-ancestors 'none'` and `X-Frame-Options: DENY`. It verifies all four independent pages, navigation history, a PNG capture, unchanged page state across canvas switching, blocked file URLs, project isolation and tab closure. This is controlled-fixture evidence, not universal website compatibility or authenticated AI testing. Public pages may impose their own login, DRM or supported-browser requirements.

Download Windows 0.2.1 from the `windows-v0.2.1` release in OSMINOG-Releases. The `windows-preview/latest.yml` channel is active. A broken 0.2.0 needs one manual repair install without deleting its profile; later releases use the update button. Chrome 4.0.9 remains unchanged. This remains an unsigned preview.


## Installed verification, 0.2.1

Run 38428383806 passed real NSIS installation into a path with Cyrillic and spaces, durable native store IPC, native panes and the internal chat form → IPC → controlled provider page → displayed reply. All four provider adapters were tested with local fixtures. Authenticated provider accounts were not tested. See `../OSMINOG_BROWSER_ROADMAP.md` for the daily incident and delivery log.

Release run 38431251299 passed a real button-driven installed upgrade from 0.2.1 to a disposable 0.2.2 test build, then verified the new version, project text and browser cookie. Only 0.2.1 was published.
