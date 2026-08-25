# BriefCraft AI — project state

## READ THIS FIRST IN A NEW CHAT
If the user opens a new chat and writes **«начни»**, read this file completely first and continue from **Current build / next test**. Do not ask the user to retell the project. Do not restart Cloudflare/Codespaces/MCP/old service-tab experiments unless explicitly requested.

## Product goal
BriefCraft is a persistent shared visual workspace where project memory lives on the canvas. Human and AI work on the same board containing briefs, notes, files, images, audio/video, code, browser/DOM captures, nodes, links and revisions.

Non-negotiable flow: **Install BriefCraft → Connect AI → Allow → work.** GPT/ChatGPT first, then Gemini, DeepSeek, Claude later.

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

## Proven UX / execution layers
- 3.8.11: direct multimodal image upload worked; GPT recognized attached screenshots/images.
- 3.8.12: drag/drop + clipboard image paste + inline previews + exact object focus worked; GPT could read text inside an image and understand a tethered object.
- Chat history is local/per-project in `chrome.storage.local`, not ChatGPT history.
- Explicit save/exit dialog and autosave are present.
- 3.8.13 introduced main + temporary agent chats, separate hidden GPT thread IDs, colors and canvas tethers.
- 3.8.14 live test confirmed real patch execution for supported canvas edits: GPT changed color and geometry/type of tethered shapes and Undo remained available.
- 3.8.14 also demonstrated a much larger workflow: GPT can build a full interface from a brief by creating/editing code and live-preview objects on the canvas.
- A later 3.8.14 live test with an imported MP3 exposed one missing bridge: the audio file existed on canvas and was playable there, but generated code had no stable way to reference its bytes, leaving a placeholder `AUDIO_SRC`.

## 3.8.15 — vector editor layer (built, skipped for direct live test)
`BriefCraft-AI-3.8.15-Vector-Pen-Masks-Agent-Wisps.zip`

The user chose to skip straight to 3.8.16, so do not claim 3.8.15 runtime verification. It added:
- separate Vector Pen on `B`; Pencil remains on `P`
- anchor nodes, Bézier handles, add/remove/move points
- primitive/ink → editable vector conversion
- vector `pathNodes/pathClosed`
- image `maskNodes/maskClosed` and path→mask workflow
- restrained colored wisp identity shared between canvas agents and chat micro-icons
- compact composer

## Current build / next test
### BriefCraft AI 3.8.16 — Agent Work Modes + Live Assets
Build created 2026-08-26:
`BriefCraft-AI-3.8.16-Agent-Work-Modes-Live-Assets.zip`

Built directly on 3.8.15, preserving all vector/mask/editor functionality and the proven direct GPT transport.

### Agent activity states
Agents now visually distinguish **research** from **work/build**:
- read/search/capture/focus Tool Bus activity uses `inspect` mode: the colored wisp appears immediately beside the target and slowly orbits it
- explicit edit/build prompts switch the active agent into `work` mode after context gathering
- patch execution uses work mode and stays next to the object being edited
- work/build wisp shows subtle non-emoji hammer/wrench silhouettes plus restrained sparks; no cartoon emoji tools
- code patches label the activity as code assembly; create patches label it as object assembly; ordinary set patches label it as an edit
- active agent header/tab receives the same tiny work-state indicator, preserving one visual language
- after completion, work state returns to the normal wisp identity

### Live asset URI bridge
Canvas image/file objects now expose a stable in-project runtime reference:
`briefcraft://asset/OBJECT_ID`

Behavior:
- Tool Bus object summaries include `asset.liveUri` for image/file objects
- GPT receives explicit instructions that this URI is the supported way to reference an existing canvas asset from a BriefCraft code object
- live code preview resolves `briefcraft://asset/ID` to the actual locally stored Data URL only at runtime
- source code remains readable and portable inside the project instead of embedding huge base64 payloads into the editor text
- intended MP3 workflow: import MP3 as a file object → tether file/code/player context → ask GPT to connect it → GPT may generate `<audio src="briefcraft://asset/FILE_ID">` → BriefCraft resolves it in the preview
- this live-asset runtime is new in 3.8.16 and requires live Chrome verification before claiming the MP3 scenario fully solved

### 3.8.16 static verification completed
- manifest version = 3.8.16
- all extension JavaScript passes `node --check`
- manifest JSON parses
- checked editor/popup/screenshot HTML has no duplicate IDs
- ZIP integrity passes
- no service ChatGPT tab/window transport reintroduced

### Runtime verification requested
1. Load 3.8.16 and first confirm the 3.8.15 Vector Pen/mask layer still loads normally.
2. Tether a normal object and ask a read-only visual question: wisp should appear beside it in inspect mode and move slowly nearby.
3. Ask for a real edit: after inspection the same agent should switch to work mode with subtle tools while the patch is being assembled/applied.
4. Create/build something new and observe the work/build state around the relevant canvas area.
5. Import an MP3 file, tether the MP3 + a code/player object, and ask GPT to connect playback using the canvas asset. Inspect generated code for `briefcraft://asset/<file-id>` and verify the preview can play after a user click.
6. Verify Undo still works after AI edits and the direct GPT transport still creates no browser ChatGPT tabs/windows/chats.

Do not claim these new 3.8.16 runtime behaviors are proven until the user tests them live.

## Important future direction — self-editing BriefCraft
User wants an eventual mode where an agent inside BriefCraft can edit BriefCraft’s own source/repository through an explicitly authorized GitHub tool/connector, including code/design changes and diff/commit/PR review. Current in-app GPT does not automatically inherit ChatGPT product connectors. Build this as a separate external-tools permission layer after canvas editing is sufficiently stable.

## Workflow rule
Keep the proven direct text/multimodal transport stable. Fix runtime issues by layer. Never regress to browser-page automation and never claim live behavior is solved before user verification.