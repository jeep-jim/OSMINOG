# BriefCraft AI — project state

## READ THIS FIRST IN A NEW CHAT
If the user opens a new chat and writes **«начни»**, read this file completely first and continue from **Current build / next test**. Do not ask the user to retell the project. Do not restart rejected service-tab / Cloudflare / old MCP experiments unless explicitly requested.

## Product goal
BriefCraft is a persistent shared visual workspace where project memory lives on the canvas. Human and AI work on the same board containing briefs, notes, files, images, audio/video, code, browser/DOM captures, nodes, links, revisions and agent threads.

Non-negotiable flow: **Install BriefCraft → Connect AI → Allow → work.** GPT/ChatGPT first; other providers later.

## Core architecture
- Canvas is source of truth; stable object IDs.
- AI Presence / Canvas Tool Bus is transport-independent.
- Compact selection/viewport/revision context; exact tool reads/captures only on demand.
- Structured `briefcraft.patch/v1` for canvas mutations.
- Local Preview / Apply / Undo.
- AI must never invent an existing object ID.

## Proven direct GPT transport
3.8.0–3.8.7 browser-page/service-window transport is rejected because it created visible ChatGPT surfaces.

3.8.8/3.8.9 live probes proved the extension service worker can use the already-authenticated `chatgpt.com` session directly: session/models/chat-requirements HTTP 200, access token + requirements token found, PoW required, no ChatGPT tab/window/chat created.

### 3.8.10 — proven baseline
`BriefCraft-AI-3.8.10-GPT-Direct-Chat-First-Live-Test.zip`

Live verified:
- short and long answers returned inside BriefCraft
- long response began in roughly 7 seconds
- no visible ChatGPT tab/window
- no new visible ChatGPT conversation

This authenticated web-backend path is not a stable public API contract; keep it isolated behind Presence Core.

## Proven UX / execution layers
- 3.8.11: direct multimodal upload worked; GPT recognized screenshots/images.
- 3.8.12: drag/drop, clipboard images, inline previews and exact object focus worked.
- 3.8.13: main + temporary agent chats, separate hidden GPT thread IDs, colors and tethers.
- 3.8.14 live test: real patch execution worked for supported shape edits; GPT also demonstrated building a full interface from a brief by creating/editing code + live-preview objects on canvas.
- 3.8.15 added vector pen, anchors, Bézier handles, vector paths/masks and restrained wisp agent identity; user skipped direct live test and went to 3.8.16.
- 3.8.16 added inspect/work ghost modes and `briefcraft://asset/OBJECT_ID` runtime references for local image/file assets.

## 3.8.16 live regression — 2026-08-26
User live-tested `BriefCraft-AI-3.8.16-Agent-Work-Modes-Live-Assets.zip` and reported two serious regressions:

1. **Build-from-layout behavior regressed.** In a temporary Agent 1 chat, prompts such as `собери макет` / `собери ... новый макет со слоями` resulted in prose, requests for screenshots, and `Patch отклонён: No supported patch actions were produced`, whereas 3.8.14 had successfully built complex layouts from scratch.
2. **Project persistence appeared lost across version changes** despite pressing Save repeatedly.

### Root cause found for build regression
The focused-agent context intentionally hid unrelated canvas content unless the prompt was classified as whole-project. `собери макет` was not classified as an edit/build intent and `макет/собери/рядом/элементы` did not broaden context. Therefore Agent 1 often received only the tethered rectangle and asked for more visual information instead of creating a layout.

### Root cause found for persistence loss
The unpacked 3.8.14 and 3.8.16 builds had different Chrome extension IDs (visible in the user screenshots). `chrome.storage.local` is scoped to the extension ID, and removing an unpacked extension removes its local storage. Previous update instructions that removed old unpacked builds could therefore destroy saved projects even though the Save button had successfully written to that old extension's storage.

## Current build / next test
### BriefCraft AI 3.8.17 — Build Recovery + Durable Save
Build created 2026-08-26:
`BriefCraft-AI-3.8.17-Build-Recovery-Durable-Save.zip`

Built from 3.8.16 while preserving vector pen/masks, agents, live asset URIs and the proven direct GPT transport.

### Build-from-scratch recovery
- Added explicit `isBuildPrompt` classification for Russian/English build language including `собери`, `сверстай`, `макет`, `интерфейс`, `компонент`, `прототип`, `с нуля`, `из ничего`, `build`, `layout`, `component`, etc.
- Build prompts are now always edit intents and therefore require a real patch.
- Build prompts automatically broaden temporary-agent context to nearby/project objects and viewport instead of trapping the agent on one tethered object.
- Build mode explicitly tells GPT not to ask for a screenshot merely because it is a focused agent; it can request `capture_viewport_image` only if visual data is genuinely needed.
- Machine instructions now include exact `create` schema: `{op:"create",objectType:"TYPE",properties:{x,y,w,h,...}}` and creatable types.
- Build requests explicitly require multiple editable `create` actions when needed rather than a prose description or flattened screenshot.
- Corrective patch retry explicitly tells GPT to use multiple create actions for a layout/component build.

### Durable persistence fix
- Manifest now contains a fixed extension `key`; all future dev builds MUST preserve this exact key so the unpacked extension ID stays stable across build folders/versions.
- `unlimitedStorage` remains enabled.
- Primary local project state now also writes a second local backup snapshot key.
- On startup, if primary project state is missing/empty and the backup is valid, BriefCraft can load the backup snapshot.
- Explicit **Save** without a connected local folder now also downloads a real `.briefcraft.json` project backup outside extension storage.
- **Save & Exit** does the same when no local folder is connected.
- If a local folder is connected, existing folder sync remains the durable external copy.

Important: 3.8.17 is the first fixed-ID build, so storage from older random unpacked IDs cannot be read automatically. If an older extension instance still exists, export its `.briefcraft.json` backup before removing it. From 3.8.17 onward preserve the manifest key in every build and do not deliberately change the extension ID.

### Static verification completed for 3.8.17
- manifest version = 3.8.17
- fixed manifest key present
- all extension JS passes `node --check`
- manifest JSON parses
- checked HTML pages have no duplicate IDs
- ZIP integrity passes
- no service ChatGPT tab/window transport reintroduced

### Runtime verification required
1. Load 3.8.17 and recreate the failing 3.8.16 scenario in a temporary agent: tether one card/rectangle and ask `собери рядом новый макет по этим элементам отдельными слоями`.
2. Verify GPT creates actual editable objects/layers instead of asking for a screenshot or returning prose only.
3. Press Save and confirm a `.briefcraft.json` backup downloads if no local folder is connected.
4. Close/reopen the same 3.8.17 extension and verify the project restores from local storage.
5. For the next build, keep the same manifest key and update without intentionally changing/removing the extension identity; verify the project survives the version update.

Do not claim 3.8.17 runtime behavior is proven until the user tests it live.

## Future direction — self-editing BriefCraft
User wants agents inside BriefCraft to eventually edit BriefCraft's own source/repository through explicitly authorized external tools (starting with GitHub), with diff/commit/PR review. Current in-app GPT does not inherit ChatGPT product connectors automatically. Build this as a separate permission/tool layer after canvas execution and persistence are stable.

## Workflow rule
Keep the proven direct text/multimodal transport stable. Fix runtime issues by layer. Never regress to browser-page automation. Preserve the fixed manifest key introduced in 3.8.17 in every future build.