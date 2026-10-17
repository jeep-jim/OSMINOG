# 4.0.22 — Code controls and first-run layout

PR: https://github.com/jeep-jim/OSMINOG/pull/63

- The language label, full-width select and help text occupy separate rows.
- Code title, project select and commands share a center line. Fixed right-hand controls minimize and close; command overflow scrolls independently.
- A visible central splitter supports pointer capture, keyboard arrows/Home/End and double-click 50/50. Ratio is persisted locally.
- Minimize hides the workspace without resetting its iframe; reopen retains the preview. Close unloads the preview, retaining source drafts.
- 148 local tests passed. Windows smoke adds real mouse drag, header geometry, preview-preserving minimize, persisted ratio, first-run geometry and screenshots. Final release checks are recorded below.

First Windows run 39012481472 passed CODE_CENTER_DRAG_ALIGNED_HEADER_MINIMIZE_RESTORE_PASS, then stopped on an invalid top-level await in the smoke-test eval (shell-smoke.cjs:271). The test expression was corrected to return the store promise; the full rerun passed as recorded below. This failed run is not reported as complete acceptance.

Final Windows run 39012731885 (job 117338503138) and agent run 39012731958 succeeded. PR63 merged as 3380fbc1dda36c4fcd8281620dc6833281a07278. Runtime source 659f4f4f52003d26ea4afe49b589a47115bce423 has identical recursive blob paths/hashes to the merge commit (neither tree truncated).

Candidate artifact 12093652325 SHA256: 02521d1ed3408b0bb4645556a732a5baf728f3fee5260cccbbecefa75f2ce3d1.
Runtime ZIP: 4,860,375 bytes, SHA256 00f78832bf96b538423b80a60bd53a7999180ec96ebd34492b9150fd020f9f7a.

Evidence: code-controls.png, welcome-field.png, shell-smoke.log. Existing fixture checks also passed; no new claim of live-provider/Figma certification.

Release run 39013256789 / job 117340049223 succeeded. UPDATE_INSTALL_STARTED and INSTALLED_UPDATE_SMOKE_PASS 4.0.22 confirm upgrade from 4.0.21 with retained local data. channels/dev/windows.json advertises 4.0.22.
Installer: https://github.com/jeep-jim/OSMINOG-Releases/releases/download/windows-v4.0.22/OSMINOG-Preview-4.0.22-x64.exe
Size 115,240,821 bytes; SHA256 a421924f6ccd29662ed1ba52316306014bc417bd20780166eaab5d679f523178.
