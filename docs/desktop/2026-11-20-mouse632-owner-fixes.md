# Mouse Browser 6.0.32 — owner corrections

## Scope and current status

The owner explicitly retained Electron and requested actual new macOS arm64 and Windows x64 packages. Source baseline: `a5fc2b3d543d58d5b79f63d039894fc639b8a904`, previously published Mouse6.0.31. Issue180 is the recorded feedback. This entry describes the candidate; no package, native CI pass or owner-device success is claimed yet.

The three attached screenshots specify the footer and Windows defects. The target keeps the central Nora control. Left group: Mouse logo/title, theme, purple privacy glasses and camera, then window/layout controls. Right group keeps library controls, AI, version, language and Quit. Footer Settings, Documents and Fullscreen buttons are removed; those commands remain in the appropriate menu. The logo offers a new tab at https://mouse.black. Follow-up requires balanced icon sizes, generous spacing within controls and larger gaps between groups.

The optional helper is removed from the start page and advertised mode/provider presets; it has one explicit Settings entry and a clear close action. Saved legacy mode/layout data remain readable, but launching/restoring a desktop does not automatically open the helper.

A further owner instruction supersedes document editing: every supported document opens as an ordinary pane tab in **view-only** mode. PDF annotation/text replacement, Word formatting/text editing, spreadsheet edits and text writes are unavailable. PDF view navigation/zoom/rotation and text selection remain; Word/table/text viewing remain. Native draft/save methods reject writes for the shipped Mouse service independently of the renderer. Existing source files and documents are not migrated or rewritten by viewing.

## Implementation

- Metadata-only page events update only changed labels. Home/document mounts are keyed; unchanged native chrome/focus and empty progress/hint states no longer request layout. The original VK/device flash has not been reproduced in this executor. An installed local-audio regression checks site Next, automatic ended, MediaSession callback and a metadata burst while another pane retains typing focus.
- Chromium's native hide-scrollbars preference is set before app readiness. A user-origin CSS fallback also hides scrollbar decoration without disabling scrolling. The native test covers wheel/keyboard, nested scroll containers, shadow roots and cross-origin frames. This supersedes the previous forced thin gray bars.
- The approved19×17 mascot keeps its proportions. Windows uses the same source geometry with normal smoothing; ICO generation includes16/20/24/32/40/48/64/96/128/256 sizes and transparent margins. No new mascot design is introduced.
- The footer, menu access, website offer and optional helper follow the owner screenshots and spacing follow-up.
- Document viewers are bounded and remain inside existing panes. Retained parser/ZIP/data-preservation unit tests remain; the retired625/627 editing acceptance is explicitly replaced by632 native view-only acceptance.

## Verification and release gates

Local Chromium cannot start in this executor because socket creation is denied. Local Node/Python tests and native CI are separate evidence. The source workflows must install and test actual macOS/Windows builds, including all unchanged Nora, task-only progress,50-live-tab, privacy/profile/update, pane seam/corner and gesture checks. New native evidence: `mouse-632-media.json`, `mouse-632-documents.json`, `mouse-632-footer.json`, plus hidden-scrollbar facts in the retained629 UI report. The real published6.0.29 →6.0.32 update baseline stays pinned; older assets are immutable.

Publication requires the successful exact source commit and artifacts, immutable size/hash pins, fresh installed release reruns, public package verification and channel readback. The macOS package retains existing ad-hoc signing; Windows signature status is measured. Owner-device media-key and live VK-account outcomes remain unverified until observed on the owner's machines.

## Execution evidence

Pending final local test, source CI and publication results. Append actual run IDs, PRs, hashes and remaining limits after each gate; do not replace this status with a claim based on a merely started run.

### Local pre-CI checks

25 focused package/icon/scrollbar/metadata tests passed;36 document model and host read-only tests passed;17 independent task/stress acceptance tests passed. Base `npm test` completed171 passed and5 blocked by the executor Unix-socket policy (`listen EPERM`), not a passing full gate. Native/macOS/Windows and the complete Mouse suite remain mandatory on CI. A source-code DOM fixture measured30 track-title changes: unrelated-pane writes fell810→0 and home/document remounts120/30→0; native layout requests were0 in both versions. This is a synthetic DOM measurement, not the owner compositor-flash reproduction or a device performance benchmark.

The complete local Mouse runner reached766 passed,8 failed,1 cancelled and4 skipped before its300s limit. The failures are in the helper/native-filesystem/MCP cases (including closed child connections); the full runner timed out in mouse-agent.test.cjs. These are not resolved by skipping CI checks, and no passing complete local suite is claimed. Native CI will run the unfiltered required suite on the supported platforms.

### First native CI passes and test corrections

Source PR181 and release PR58 are open. Release contract runs44678438876 (Mac) and44678438935 (Windows), plus the retained registry/publisher checks, passed for release head3ca6db0ee8d550c93658bd37e7e96982754b24b4 with unready pins. This is not publication.

The first Mac source runs passed the complete required unit suite and the retained task-only/fifty-tab native stages. The new media process initially hit a CI-only pointer allowlist; the native guard now admits the isolated task/media process while retaining CI=true, an absolute test profile and explicit smoke-mode requirements. Run44678506061 then passed the native site-next scenario: the real title changed, unrelated pane DOM/native geometry stayed unchanged and all live identities were retained. Its automatic-end fixture timed out after seeking near the end; the report does not establish the seek failure cause. The fixture now waits for the real eight-second audio to finish naturally and records the browser's trusted ended event plus failure-time media state. The original owner hardware/media-key case remains unverified.

Windows run44677925466 exposed a stale unit contract that still required editing in the current version. Only the current-version contract is updated to require view-only documents, footer, website offer and manual helper; the actual629 baseline retains its original editing markers. All six portable Windows verifier contract tests pass (one Windows-only signature test is skipped on this Linux executor). Native source checks remain pending after these corrections.
