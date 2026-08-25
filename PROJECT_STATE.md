# BriefCraft AI — project state

## READ THIS FIRST IN A NEW CHAT
If the user opens a new chat and writes **«начни»**, read this file completely first and continue from **Current build / next test**. Do not ask the user to retell the project. Do not restart rejected service-tab / Cloudflare / old MCP experiments unless explicitly requested.

## Product goal
BriefCraft is a persistent shared visual workspace where project memory lives on the canvas. Human and AI work on the same board containing briefs, notes, files, images, audio/video, PDF documents, code, browser/DOM captures, nodes, links, revisions and agent threads.

Non-negotiable flow: **Install BriefCraft → Connect AI → Allow → work.** GPT/ChatGPT first; other providers later.

## Core architecture
- Canvas is source of truth; stable object IDs.
- AI Presence / Canvas Tool Bus is transport-independent.
- Main GPT can receive a compact project-wide semantic map plus on-demand visual captures.
- Exact get/search/read/capture tools are used only when needed.
- Structured `briefcraft.patch/v1` for canvas mutations.
- Local Preview / Apply / Undo.
- AI must never invent an existing object ID.

## Proven direct GPT transport
3.8.0–3.8.7 browser-page/service-window transport is rejected because it created visible ChatGPT surfaces. 3.8.8/3.8.9 probes and 3.8.10 live testing proved the extension service worker can use the already-authenticated `chatgpt.com` session directly: short and long replies return inside BriefCraft with no visible ChatGPT tab/window/new visible conversation. This authenticated web-backend path is not a stable public API contract; keep it isolated behind Presence Core.

## Proven / built layers
- 3.8.11: direct multimodal image upload worked.
- 3.8.12: drag/drop, clipboard images, inline previews and exact object focus worked.
- 3.8.13: main + temporary agent chats, separate hidden GPT thread IDs, colors and tethers.
- 3.8.14 live test: real patch execution worked for supported shape edits; GPT also built full interfaces from briefs using code + live preview objects.
- 3.8.15 added Vector Pen, anchors, Bézier handles, vector paths/masks; user skipped direct live test.
- 3.8.16 added inspect/work ghost modes and `briefcraft://asset/OBJECT_ID`, but regressed build-from-scratch behavior.
- 3.8.17 restored explicit BUILD MODE and introduced durable save + a fixed manifest `key`. Preserve that exact key forever so unpacked dev builds keep one Chrome extension ID.
- 3.8.18 added folder-first dark onboarding, project-wide Main GPT memory/map + whole-canvas overview, PDF canvas objects with non-destructive correction overlays, direct PDF document attachments to GPT, optional Internet Research, and owner-only local-source Jarvis tools.

## Persistence rule
From 3.8.17 onward every dev build MUST preserve the same manifest `key`. Projects should live in the chosen local workspace folder / `.briefcraft.json` backups and not depend only on `chrome.storage.local`. Removing an unpacked extension can remove extension-local storage.

## Current build / next test
### BriefCraft AI 3.8.19 — Pen Repair + Owner Updater UI
Build created 2026-08-26:
`BriefCraft-AI-3.8.19-Pen-Repair-Owner-Updater.zip`

Built directly from 3.8.18 and preserves the fixed manifest key, direct GPT transport, BUILD MODE, durable save, full-project Main context, PDF/Jarvis features and existing agent system.

### Vector Pen repair
Live feedback on 3.8.18 showed the pen felt broken: while drawing it was not represented as a real layer/object until Enter; control-point editing was hard to discover; Bézier construction lines were hidden in CSS; color/settings were therefore effectively inaccessible during the draft.

3.8.19 changes:
- after the second anchor the in-progress vector becomes a real temporary `vector` canvas object immediately;
- it appears in Layers and becomes the selected object, so normal appearance controls (fill/stroke/color/width/opacity) are available while drawing;
- dragging a newly placed anchor creates symmetric Bézier handles and live-updates the real draft object;
- clicking close to the first anchor after 3+ points closes the path; Enter finishes an open path; Escape cancels/removes the draft object;
- selecting an existing vector automatically enters node-edit mode so control points are visible immediately;
- Bézier construction lines are visible again; square anchors and round handles remain independently draggable, with Alt allowing separated handles;
- a transparent thick vector hit-path makes thin/open contours easier to select and drag;
- double-clicking a segment adds another point; double-clicking an anchor toggles handles; right-click removes an anchor when enough remain;
- vector paths use rounded joins/caps.

### Pencil repair / smoothing
Live feedback also showed Pencil strokes could look cut/noisy with an awkward rectangular selection outline.

3.8.19 changes:
- input points are distance-filtered and simplified;
- displayed Pencil strokes use a smoothed quadratic path instead of a raw polyline;
- larger stroke padding prevents ends from being visually clipped by the object bounds;
- ink object content uses the full object height and visible overflow;
- selected Pencil/vector objects no longer show the heavy rectangular outline; resize handles remain;
- Ink → Vector conversion simplifies the point cloud and generates smooth tangent handles instead of producing dozens of raw mouse-sample anchors.

### Browser/interface zoom lock
- While the BriefCraft app is open, Ctrl/Cmd + mouse wheel is intercepted globally so Chrome page/interface zoom cannot accidentally change when the pointer drifts over a panel/object.
- Ctrl/Cmd + wheel only changes BriefCraft canvas zoom when the pointer is actually over the canvas viewport.
- Existing Ctrl/Cmd +/-/0 keyboard handling remains scoped to BriefCraft canvas zoom.

### Version / update UI foundation
User wants GitHub as the owner source of code/releases and a visible version/update button inside BriefCraft.

3.8.19 adds:
- compact `v3.8.19` button beside the BriefCraft brand in the main header;
- click opens an OWNER update popover with current version, update status and GitHub controls;
- `Проверить GitHub` calls the GitHub Releases API; if the repo is private without owner auth it explicitly reports that OWNER GitHub authorization is required;
- `Открыть Releases` opens `jeep-jim/BriefCraft` releases;
- current version is read from `chrome.runtime.getManifest()` rather than hardcoded in runtime logic.

Important limitation: one-click self-install from a **private** GitHub repo is not yet implemented. An unpacked Chrome extension cannot honestly self-update private remote executable code without an explicit owner authorization/source-folder update path. The next owner-updater layer should use GitHub OAuth/permission + the already-selected Jarvis source folder, then write approved source files and reload. Public user builds must update through Chrome Web Store.

### Static verification completed for 3.8.19
- manifest version = 3.8.19
- fixed manifest key preserved
- all extension JavaScript passes `node --check`
- manifest JSON parses
- editor/popup/screenshot HTML have no duplicate IDs
- ZIP integrity passes
- no service ChatGPT tab/window transport reintroduced

### Runtime verification requested
1. Update from 3.8.18 without changing/removing the fixed-ID extension if possible; verify project survives.
2. Press `B`, place 2+ anchors: the draft should immediately appear as a Layer and expose stroke/fill settings.
3. Click-drag an anchor while drawing and verify visible Bézier handles/curve; click near first anchor to close or Enter to finish open.
4. Reselect vector: nodes should show immediately. Drag nodes/handles, add/remove nodes, change stroke/fill colors.
5. Draw with Pencil and verify line is smoother, rounded and not visibly clipped; convert it to vector and verify the node count is much cleaner.
6. Hold Ctrl and wheel over canvas, then over side panels/chat: canvas may zoom only over canvas; browser/interface zoom must not change anywhere.
7. Click `v3.8.19`; verify owner update popover. Private repo check may correctly say GitHub owner authorization is required until OAuth is implemented.

Do not claim these 3.8.19 runtime behaviors are proven until the user tests them live.

## Next owner-updater direction
Implement explicit GitHub OAuth/permission for `jeep-jim/BriefCraft`, connect it to the owner-selected Jarvis source folder, show release changelog/diff, create a backup, write the approved new source files, then `chrome.runtime.reload()`. Do not expose this private updater to ordinary Chrome Web Store users.

## Workflow rule
Keep the proven direct text/multimodal transport stable. Preserve the fixed manifest key forever. Fix runtime issues by layer and never regress to browser-page automation.