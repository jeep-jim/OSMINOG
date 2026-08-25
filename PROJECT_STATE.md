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
3.8.0–3.8.7 browser-page/service-window transport is rejected because it created visible ChatGPT surfaces.

3.8.8/3.8.9 live probes proved the extension service worker can use the already-authenticated `chatgpt.com` session directly. 3.8.10 live-verified short and long GPT replies inside BriefCraft with no visible ChatGPT tab/window/new visible conversation. This authenticated web-backend path is not a stable public API contract; keep it isolated behind Presence Core.

## Proven UX / execution layers
- 3.8.11: direct multimodal upload worked; GPT recognized screenshots/images.
- 3.8.12: drag/drop, clipboard images, inline previews and exact object focus worked.
- 3.8.13: main + temporary agent chats, separate hidden GPT thread IDs, colors and tethers.
- 3.8.14 live test: real patch execution worked for supported shape edits; GPT also demonstrated building a full interface from a brief by creating/editing code + live-preview objects on canvas.
- 3.8.15 added vector pen, anchors, Bézier handles, vector paths/masks; user skipped direct live test.
- 3.8.16 added inspect/work ghost modes and `briefcraft://asset/OBJECT_ID`, but regressed build-from-scratch behavior and exposed persistence problems across random unpacked extension IDs.
- 3.8.17 restored explicit BUILD MODE for `собери/сверстай/макет/компонент/с нуля/...`, introduced durable save/backups, and — critically — a fixed manifest `key`. Preserve that exact key forever so unpacked dev builds keep one Chrome extension ID.
- User live-tested 3.8.17 and reported it became **significantly better**.

## Current build / next test
### BriefCraft AI 3.8.18 — Full Project Memory + Editable PDF + Owner Jarvis
Build created 2026-08-26:
`BriefCraft-AI-3.8.18-Full-Memory-PDF-Jarvis.zip`

Built from 3.8.17 and preserves the fixed extension key, direct GPT transport, BUILD MODE, durable save, agent chats, vector/mask layer and live asset URI runtime.

### First-run / workspace changes
- Default theme is now **dark** on first install/open when no saved preference exists.
- The welcome CTA is now **Choose workspace folder** instead of Create project.
- Uses File System Access API with a persisted IndexedDB directory handle.
- If the previously selected workspace folder is still authorized, BriefCraft restores `.briefcraft.json` projects from it and opens the app directly.
- If none exist, BriefCraft opens an empty project in that workspace.
- Existing 3.8.17 durable local + external backup behavior remains.

### Vector Pen / Bézier reliability
- Fixed a real node-drag lifecycle bug that left `state.nodeDrag` active because an early return made cleanup unreachable.
- Pen anchors can now be click-dragged while drawing to create symmetric Bézier in/out handles immediately.
- Draft path renders cubic curves and construction handles.
- Node/handle editing finalizes and persists reliably on pointer-up.
- Existing node movement, smooth-handle toggling, adding/removing anchors and vector masks remain.

### PDF documents on canvas
PDF is now a first-class canvas file object instead of a generic glyph:
- original PDF is rendered in an iframe with page navigation;
- the original PDF bytes are preserved unchanged;
- editable correction overlays (`pdfEdits`) can be added on top of individual pages;
- overlay text is contenteditable and can be moved/resized manually;
- GPT object detail exposes `pdfPage` and `pdfEdits`, and these are accepted by `set` patches;
- therefore AI can add/rewrite/reposition visible corrections while preserving the original source document.

Important limitation: 3.8.18 PDF editing is **non-destructive overlay editing**. It does not yet rewrite PDF object streams or export a newly merged binary PDF. Do not claim binary PDF rewrite/export is solved.

### Multiple PDFs → GPT document context
- GPT composer accepts `application/pdf` / `.pdf` attachments.
- Direct ChatGPT file upload uses the same three-step ChatGPT file flow as existing image upload, with non-image `use_case: my_files` and message attachment metadata.
- Up to four PDF canvas objects tethered to the active chat are automatically attached as real PDF documents on send, so the model can compare them without converting them to screenshots.
- This direct-PDF path is new and requires a live test before claiming success.

### Main GPT full-project awareness / canvas memory
The permanent **Главный** chat now receives more than pinned-object context:
- `get_project_map` returns a compact map of up to hundreds of project objects, connections, canvas config and a memory digest derived from briefs/notes/nodes/text;
- `capture_canvas_overview_image` renders a whole-canvas overview without moving the user viewport;
- main chat always receives a project map and automatically refreshes the whole-canvas visual overview when project revision changes;
- GPT is explicitly told that briefs/notes/nodes/connections are durable project memory/instructions.

Goal: the main GPT can answer broad questions such as “what is on this project?”, “what remains according to the brief?” and build large results using the persistent canvas as project memory instead of needing a single tethered object.

### Optional Internet Research
Owner/user can enable **Internet research** in GPT settings.
- Enabling is an explicit user gesture that requests optional `http://*/*` + `https://*/*` host permissions.
- Tool Bus adds `web_search` and `web_fetch`.
- Search/fetch are disabled until the user enables research.
- GPT is instructed to use only returned URLs/text and not invent citations.
- Intended workflow: tether several PDFs + enable research + ask GPT to compare documents, verify external facts, and create correction overlays/other canvas edits based on the task.

### OWNER · JARVIS mode
3.8.18 introduces a developer-only local-source permission path for the project owner. This is **not** exposed as automatic GitHub power and does not inherit ChatGPT product connectors.

In GPT settings:
- choose a local BriefCraft source folder via File System Access API;
- explicitly enable Jarvis;
- source-folder handle is persisted in IndexedDB;
- only the permanent Main chat receives Jarvis instructions/tools.

Jarvis Tool Bus:
- `dev_status`
- `list_dev_files`
- `read_dev_file`
- `write_dev_file`

Security/behavior:
- paths are validated and limited to common source/text extensions;
- writes require Jarvis enabled;
- old file content is backed up under `.briefcraft-backups` before write;
- CSS edits can be live-applied into the running editor session;
- JS/HTML/manifest edits require extension reload;
- this edits only the explicitly selected local source folder;
- no GitHub commit/push/PR is performed automatically. A real GitHub permission/connector layer remains a separate future step.

### New Tool Bus additions in 3.8.18
- `get_project_map`
- `capture_canvas_overview_image`
- `web_search`
- `web_fetch`
- `dev_status`
- `list_dev_files`
- `read_dev_file`
- `write_dev_file`
- existing object/PDF/vector properties extended with `pdfPage` / `pdfEdits`.

### Static verification completed for 3.8.18
- manifest version = 3.8.18
- fixed manifest key from 3.8.17 preserved
- optional all-url host permissions declared rather than granted by default
- all extension JS passes `node --check`
- manifest JSON parses
- checked editor/popup/screenshot HTML has no duplicate IDs
- ZIP integrity passes and root manifest is present
- no service ChatGPT tab/window transport reintroduced

### Runtime verification required
1. Update from 3.8.17 to 3.8.18 and verify the project survives the version change under the fixed extension ID.
2. On a fresh profile/first run verify dark theme and folder-first onboarding.
3. Vector Pen: draw anchors with click-drag handles, Enter, then edit nodes/handles and verify persistence.
4. Drop a PDF; change pages, add/move/resize correction overlays, reload and verify state persists.
5. Tether two PDFs to one chat and ask GPT to compare them; verify direct PDF upload/document context works.
6. Enable Internet research and test web_search/web_fetch only after permission grant.
7. In Main chat with no tether, ask a project-wide question and verify GPT understands the broad canvas/project map and refreshed visual overview.
8. Owner only: select a local BriefCraft source folder, enable Jarvis, ask Main to read a source file and make a small CSS change. Verify backup and live CSS application. Test JS changes only with reload.

Do not claim the new PDF document upload, whole-project overview behavior, Internet Research or Jarvis source editing are runtime-proven until the user tests them live.

## Future direction — GitHub Jarvis
User ultimately wants an owner-only mode where BriefCraft can edit its own GitHub repository from inside BriefCraft with explicit permissions, diff/commit/PR review. Current 3.8.18 Jarvis is intentionally local-folder-only. Build GitHub access as a separate explicit external-tool permission layer; do not pretend the in-app GPT automatically inherits ChatGPT’s GitHub connector.

## Workflow rule
Keep the proven direct text/multimodal transport stable. Preserve the fixed manifest key forever. Fix runtime issues by layer and never regress to browser-page automation.