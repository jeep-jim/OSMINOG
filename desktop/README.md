# Windows candidate — NOT a production release

This branch ports the existing board into an isolated Electron host. It is a compatibility candidate, not the completed desktop product. Do not replace the Chrome installation with it.

## Included
- Existing board/editor assets, light/dark themes and existing version/update button.
- Isolated application profile; serialized local storage writes with a previous-state backup. Existing Chrome data is not read or overwritten.
- Sandboxed renderer, no Node in documents, main-frame IPC validation, external HTTP(S) links only.
- Separate Windows NSIS update adapter: no automatic download/install; explicit button action saves the board first. The Chrome updater source and release feed are unchanged.
- Windows CI launch/reload persistence test and NSIS candidate build.

## Release blockers
- Publish/verify Windows update channel and N -> N+1 installed upgrade with board preservation. No live Windows channel currently published.
- Code signing/provenance and clean-machine installation test.
- Browser-dependent tools need explicit native adapters. Their calls currently return unsupported errors; do not advertise AI connectivity.
- Account registration/configuration (OAuth client registrations and redirects), token vault, per-user authorization and real second-device synchronization.
- Signed board-to-AI protocol and actual external ChatGPT read/write verification.
- Full document/media, drag/drop, clipboard and capture regression on Windows.
- Import Chrome project backup and validate files before offering migration.

## Product decision
Windows first; extension later as a capture companion. One board format, multiple clients. GitHub stores source and software releases, not a public bucket of private user materials. Authentication does not implement synchronization. Public guest access needs a viewer and reachable shared data; offline-only boards are not remotely available.

Install dependencies and run `npm start` for the candidate. `npm run build:win` builds NSIS. No publication occurs automatically. Production installer channel must be configured and verified before release.
