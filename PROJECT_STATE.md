# BriefCraft AI — project state

## READ THIS FIRST IN A NEW CHAT
If the user opens a new chat and writes **«начни»**, read this file completely first and continue from **Current build / next test**. Do not ask the user to retell the project. Do not restart Cloudflare/Codespaces/MCP/old service-tab experiments unless explicitly requested.

## Product goal
BriefCraft is a persistent shared visual workspace where project memory lives on the canvas. Human and AI work on the same board containing briefs, notes, files, images, code, browser/DOM captures, nodes, links and revisions.

Non-negotiable flow: **Install BriefCraft → Connect AI → Allow → work.** GPT/ChatGPT is first priority, then Gemini, DeepSeek, Claude later.

## Core architecture
AI Presence / Canvas Tool Bus is transport-independent:
- stable object IDs; canvas is source of truth
- compact selection/viewport/revision mirror
- exact get/search/read/capture calls only on demand
- structured `briefcraft.patch/v1`
- local Preview / Apply / Undo
- AI never invents an existing object ID

## Proven direct GPT transport
3.8.0–3.8.7 browser-page/service-window transport is rejected because it created visible ChatGPT surfaces.

3.8.8/3.8.9 live probes proved the extension service worker can use the already-authenticated `chatgpt.com` session directly: session/models/chat-requirements HTTP 200, access token and requirements token found, Proof-of-Work required, Arkose/WebSocket not required on the tested account, and no ChatGPT tab/window/chat created.

### 3.8.10 — proven baseline
`BriefCraft-AI-3.8.10-GPT-Direct-Chat-First-Live-Test.zip`

Live verified on 2026-08-25:
- one-word and long-answer tests succeeded inside BriefCraft
- first long response appeared in roughly 7 seconds
- no visible ChatGPT tab/window
- no new visible ChatGPT conversation in history

Transport uses the authenticated ChatGPT web backend, fresh chat-requirements, SHA3-512 Proof-of-Work and SSE. This is not a stable public API contract; keep it isolated behind Presence Core.

## Canonical brand
Canonical source: `brand/briefcraft-logo.svg`; `brand/brand.json` forbids the old blue mark. Primary `#EEBF26`, accent `#FFE100`.

## Proven UX layers before 3.8.14
- 3.8.11: direct multimodal image upload worked; GPT recognized attached screenshots/images.
- 3.8.12: drag/drop + clipboard image paste + inline previews + exact object focus worked; GPT could read text inside an image and understand a tethered object.
- Chat history is local/per-project in `chrome.storage.local`, not ChatGPT history.
- Explicit save/exit dialog and autosave are present.
- Canonical yellow logo/system typography are in use.

## 3.8.13 live result — 2026-08-25
`BriefCraft-AI-3.8.13-Agent-Threads-Canvas-Editing.zip`

User live-tested:
- main chat + temporary agent tabs appeared
- colored agent tethers appeared and persisted enough to test
- save/exit branded dialog worked through the BriefCraft UI
- however canvas execution was still unreliable: GPT often said it changed a selected/tethered object, but the real object did not change
- a visible error appeared: `Patch отклонён: No supported patch actions were produced`
- tethers originated around the top/tab area and crossed over the chat; they visually jumped too much
- active-agent identity near `ИИ на холсте` was not explicit enough
- the chat panel only resized conveniently from the corner
- composer layout needed plus/smiley/send inside one field; send should be an arrow; input itself should be vertically adjustable
- after sending, chat sometimes did not scroll fully to the newest message
- AI ghost could end up effectively offscreen/top-corner instead of visibly studying objects
- user wants ghosts to linger/move slowly near objects during actual AI work
- closing the actual Chrome tab/window should at least be protected from accidental loss; Chrome cannot show the custom branded BriefCraft dialog over a browser-X close, only a native `beforeunload` confirmation

## Current build / next test
### BriefCraft AI 3.8.14 — Live Editing + Agent UX
Build created 2026-08-25:
`BriefCraft-AI-3.8.14-Live-Editing-Agent-UX.zip`

Built directly from 3.8.13 while preserving the proven no-window GPT transport.

### Canvas execution hardening
- GPT machine instructions now include exact `set` patch schema and explicit supported property names.
- Shape patch instructions explicitly support `rectangle`, `ellipse`, and new `triangle`.
- Patch validation now normalizes common model variations instead of rejecting them outright:
  - `action/operation` aliases for `op`
  - `id/objectId` aliases for target
  - `props/changes/values` aliases for properties
  - `update/modify/edit/resize/move/style/recolor/transform` normalize to `set`
  - `width/height` normalize to `w/h`
  - `shape` normalizes to `shapeKind`
  - common color/background aliases normalize to fill/textColor
- Added a bounded local fallback for explicit edit commands on the pinned/selected object when GPT still fails to produce a valid supported patch. Covered fallback cases include common recolors, triangle/ellipse/rectangle shape changes, width/height half/double, visibility, and simple rotation.
- Direct mode applies a validated patch immediately and leaves Undo available.
- Triangle rendering and inspector option were added for shape objects.

### Stable agent tethers
- Tethers now originate from the **left or right edge of the whole chat panel**, choosing the side nearest the target object.
- Thread-specific vertical anchor positions are stable and do not originate from the tabs above the chat.
- Dashed-flow animation was removed to reduce visual jitter.
- Tether geometry still refreshes while panel/canvas geometry changes, but uses deterministic anchors.

### Active-agent identity
- Every temporary agent receives a distinct face string as well as color.
- The avatar next to `ИИ на холсте` changes to the active agent face/color.
- Heading identifies `Главный · ИИ на холсте` or `<agent name> · ИИ на холсте`.
- Thread tabs also show each agent face/color.

### Panel + composer UX
- Native corner-only CSS resize is disabled.
- Added 8 explicit resize hit areas: top/right/bottom/left plus four corners, so the chat can be reshaped from any edge.
- Composer is now one rounded field containing `+`, emoji, textarea, and a compact arrow send button.
- Textarea can be vertically resized within a bounded height.
- After adding/sending/rendering messages, BriefCraft scrolls to the bottom over several frames/timeouts; image-load completion also retriggers bottom scroll.

### Ghost visibility / motion
- Ghost targets are clamped inside the visible canvas/viewport area instead of being allowed to disappear offscreen.
- While GPT is busy, the ghost remains visible and slowly orbits around the object/area being studied.
- Motion is slower/smoother; object highlight still uses the active agent color.
- Ghost fades after the task completes instead of timing out in the middle of a longer response.

### Browser close protection
- Explicit BriefCraft exit continues to use the branded save/exit dialog.
- Actual browser-tab/window X cannot display that branded dialog because Chrome does not allow custom UI to replace the browser close confirmation.
- 3.8.14 flushes persistence and requests native `beforeunload` confirmation whenever an active project exists, so accidental browser-X closes are protected as far as Chrome allows.

### Static verification completed for 3.8.14
- manifest version = 3.8.14
- all extension JavaScript passes `node --check`
- manifest JSON parses
- checked extension HTML pages have no duplicate IDs
- ZIP integrity passes
- no service ChatGPT tab/window transport reintroduced

### Runtime verification required
Test in this order:
1. Load 3.8.14; create/select a rectangle and tether it to the main or an agent chat.
2. Ask `поменяй цвет фигуры на жёлтый`; verify the actual fill changes and Undo restores it.
3. Ask `преврати его в треугольник`; verify the actual shape changes.
4. Verify tether starts from the nearest left/right edge of the chat and does not cross over its top.
5. Switch chats; verify avatar face/color and heading change with the active agent.
6. Resize chat from each edge, not only the corner.
7. Send several messages/images and verify composer stays aligned and the chat always lands on the newest message.
8. Trigger a visual/object read and watch the ghost stay visible and move slowly around the object.
9. Close through BriefCraft UI to verify branded dialog; then separately test browser X and expect Chrome's native close-protection prompt, not a branded BriefCraft modal.

Do not claim 3.8.14 runtime behavior is proven until the user tests it live.

## Important future direction — self-editing BriefCraft
User wants an eventual mode where an agent inside BriefCraft can edit BriefCraft’s own source/repository through an explicitly authorized GitHub tool/connector, including code/design changes and diff/commit/PR review. Current in-app GPT does not automatically inherit ChatGPT product connectors. Build this as a separate external-tools permission layer after canvas execution is stable.

## Workflow rule
Keep the proven direct text/multimodal transport stable. Fix runtime issues by layer. Never regress to browser-page automation and never claim live behavior is solved before user verification.