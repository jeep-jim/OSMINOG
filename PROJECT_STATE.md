# BriefCraft AI — project state

## READ THIS FIRST IN A NEW CHAT
If the user opens a new chat and writes **«начни»**, read this file completely first and continue from **Current build / next test** below. Do not ask the user to retell the project. Do not restart Cloudflare/Codespaces/MCP/old service-tab experiments unless explicitly requested.

## Product goal
BriefCraft is a persistent shared visual workspace where project memory lives on the canvas. Human and AI work on the same board containing briefs, notes, files, images, code, browser/DOM captures, nodes, links and revisions.

Non-negotiable end-user flow: **Install BriefCraft → Connect AI → Allow → work.**

AI priority: GPT/ChatGPT first, then Gemini, then DeepSeek. Claude later.

## Core architecture
AI Presence / Canvas Tool Bus remains transport-independent:
- stable object IDs and canvas as source of truth
- compact object index / selection / viewport / recent revisions
- exact get/search/read calls only when needed
- on-demand small visual captures
- structured `briefcraft.patch/v1`
- local Preview / Apply / Undo

AI must never invent an existing object ID.

## Proven direct GPT transport
Old 3.8.0–3.8.7 browser-page/service-window transport is rejected because it opened real ChatGPT surfaces and created separate chats.

### 3.8.8 / 3.8.9 probes
Live tests proved the extension service worker can use the already authenticated `chatgpt.com` session directly:
- session HTTP 200
- access token available
- models and chat-requirements HTTP 200
- requirements token available
- Proof-of-Work required on the tested account
- Arkose not required
- WebSocket not required
- no ChatGPT tab/window/chat created

### 3.8.10 — proven baseline
`BriefCraft-AI-3.8.10-GPT-Direct-Chat-First-Live-Test.zip`

Live verified on 2026-08-25:
- one-word test returned `СВЯЗЬ` inside BriefCraft
- a long structured ~700–1000 word answer completed successfully; first response appeared in roughly 7 seconds
- no visible ChatGPT tab
- no service window
- no new visible ChatGPT conversation in history

Implementation uses direct authenticated ChatGPT web-backend requests, fresh chat-requirements, SHA3-512 Proof-of-Work and SSE. This is not a stable public API contract; keep it isolated behind Presence Core.

## 3.8.11 live result
`BriefCraft-AI-3.8.11-Chat-Workspace-ToolBus-Attachments.zip`

User live-tested the build:
- direct text transport remained clean
- cached screenshot / direct image attachment reached GPT successfully
- GPT correctly recognized the attached image
- resizable GPT workspace and settings UI worked sufficiently to continue

User then requested better attachment/focus UX: drag-and-drop, clipboard paste, arbitrary screenshots, inline image previews, exact object/node-to-chat focus, outside-click settings close, a cleaner system UI font, save/exit UX and a visible AI ghost moving around the canvas.

## Canonical brand
Canonical source is `brand/briefcraft-logo.svg`; `brand/brand.json` declares it canonical and forbids the old blue `b°` mark in new builds.

Colors:
- primary `#EEBF26`
- accent `#FFE100`

All product/header/extension icons in new builds must derive from the canonical SVG.

## Current build / next test
### BriefCraft AI 3.8.12 — Focus + Ghost + Save UX
Build created 2026-08-25:
`BriefCraft-AI-3.8.12-Focus-Ghost-Save-UX.zip`

Built on the proven no-window direct GPT transport.

### Chat and attachment UX
- Drag files/images directly onto the GPT panel.
- Paste screenshots/images from the system clipboard with Ctrl/Cmd+V.
- Accept arbitrary clipboard screenshots, not only BriefCraft’s internal screenshot cache.
- Keep `Скрин из кэша` as an additional shortcut.
- Pending image attachments and sent chat history render inline image previews instead of filename-only chips.
- PNG/JPEG/GIF/WebP continue through the direct multimodal ChatGPT file flow; text/code files are locally read and injected as bounded text context.
- GPT chat history remains local and per-project in `chrome.storage.local`; it is not sourced from ChatGPT conversation history.

### Exact object/node → GPT focus context
- Canvas objects get a small purple AI-eye context handle on hover/selection.
- Clicking the handle pins that exact object to GPT context.
- Dragging the handle into the GPT panel pins the exact object using `application/x-briefcraft-object` data.
- A composer context tray displays pinned objects; each chip can focus the object or be removed.
- `+` also supports pinning the current canvas selection.
- Prompt context explicitly tells GPT that pinned objects are the primary referent and includes exact object IDs/data.
- New Tool Bus call `capture_object_image` crops a specific object without relying on global selection.

### AI ghost on canvas
- Purple cloud/ghost with eyes appears while GPT is investigating the canvas.
- It smoothly moves toward the object/area associated with real Tool Bus activity.
- Tool activity such as `get_object`, text/code/DOM reads, search and visual capture updates the ghost target/label.
- The currently inspected object receives a soft visual highlight.
- Patch actions can move the ghost to objects GPT is about to change.
- The ghost is intentionally tied to real AI activity, not a decorative random animation.

### Settings / workspace behavior
- Settings popover closes when the user clicks/taps outside it.
- GPT panel remains resizable; minimized pill remains draggable.
- Main UI typography now uses the native system UI stack similar to modern ChatGPT (`Segoe UI` / system UI on Windows and platform equivalents); code/technical metadata uses system monospace.
- Bundled legacy DejaVu font files were removed from this build.

### Save and exit UX
- Project changes continue to autosave locally.
- Explicit **Save** control shows save state.
- Explicit exit/home action opens a BriefCraft save/exit dialog with Stay / Save & Exit flow and a saved confirmation.
- If a local project folder is connected, explicit save also syncs there through the existing folder sync path.
- Browser limitation: when the user closes the actual Chrome tab/window with the browser X, an extension page cannot show a custom branded dialog or custom prompt text. 3.8.12 flushes persistence and uses the browser-native `beforeunload` confirmation only when state is dirty/save failed. Do not claim otherwise.

### Static verification completed
- manifest version = 3.8.12
- modified JavaScript syntax checks passed
- manifest JSON parses
- checked extension HTML has no duplicate IDs
- ZIP integrity passes
- no bundled TTF/OTF/WOFF font files remain in the final ZIP
- no service-tab/window transport was intentionally reintroduced

### Runtime verification still required
Do not claim 3.8.12 UX is proven until the user tests it live. Test in this order:
1. Load 3.8.12 and verify canonical yellow logo and new system typography.
2. Open settings, then click canvas outside it; settings should close.
3. Drag an arbitrary PNG/JPG from desktop into GPT; verify inline preview and GPT vision.
4. Copy any screenshot from outside BriefCraft and paste it into GPT with Ctrl+V; verify inline preview and GPT vision.
5. Hover/select an object; click or drag its purple eye handle into GPT; verify a focus chip appears and can be removed.
6. Ask about the pinned object and confirm GPT refers to the exact object rather than searching the whole canvas.
7. Trigger an on-demand object/visual read and confirm the purple AI ghost moves to the inspected target and highlights it.
8. Ask for a simple edit and verify Tool Bus → `briefcraft.patch/v1` → Preview → Apply → Undo.
9. Test explicit Save, then explicit Exit/Save & Exit.
10. Make a dirty change and close the browser tab to verify only the browser-native close protection path; do not expect a custom branded Chrome-X dialog.

## Workflow rule
Keep the proven direct text/multimodal transport stable. Fix 3.8.12 runtime issues by layer and do not regress to browser-page automation. Work in small verified increments and never claim a live behavior is solved before the user tests it.