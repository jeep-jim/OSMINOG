# BriefCraft AI — project state

## READ THIS FIRST IN A NEW CHAT
If the user opens a new chat and writes **«начни»**, read this file completely first. Continue from **Current build / next test** below. Do not ask the user to retell the project. Do not restart Cloudflare/Codespaces/MCP/old Bridge experiments unless explicitly requested.

## Product goal
BriefCraft is a persistent shared visual workspace where project memory lives on the canvas, not in chat history. A human and AI should be able to work on the same board containing briefs, notes, files, images, code, browser/DOM captures, nodes, links and revisions.

Target UX examples:
- «Посмотри на цвет этой фигуры и сделай градиент.»
- «Сделай у этой звезды 6 концов вместо 5.»
- «Вот текст — подправь и выровняй шаблон.»
- «Посмотри, что изменилось на холсте, и продолжай работу.»
- A task node connected to an object tells AI what to do with that object.

Non-negotiable end-user flow:
**Install BriefCraft → Connect AI → Allow → work.**

End users must not need API keys, MCP URLs, terminals, Cloudflare, Vercel, Codespaces, deployment scripts or companion EXEs just to use AI Presence.

AI priority: GPT/ChatGPT first, then Gemini, then DeepSeek. Claude later.

## Core architecture that should remain
AI Presence / Canvas Tool Bus:
- stable object IDs
- lightweight canvas index/mirror
- current selection
- recent changes/revisions
- get object/neighbors/connections
- search canvas
- read text/code/DOM only on demand
- capture only a small visual region when needed
- structured canvas patch
- local preview/apply/undo

Canvas is source of truth. AI must never invent an existing object ID.

## Paths already tried
- **Bridge 3.2:** Canvas→ChatGPT worked, but dumped huge canvas/HTML payloads into visible chat and caused hangs. Rejected.
- **Cloudflare/MCP relay 3.4–3.5:** too much setup friction. Rejected for current product UX.
- **Local Gemini 3.6:** technically possible, wrong priority because GPT must be first.
- **Official ChatGPT App/MCP 3.7:** prototype exists in this repo, but the user’s current ChatGPT UI did not expose the unpublished custom-app flow needed to attach it. Paused, not deleted.
- **Browser-page service transport 3.8.0–3.8.7:** proved GPT replies could be mirrored into BriefCraft, but required a real ChatGPT tab/window. Attempts to hide/minimize that page still produced visible Windows taskbar/browser surfaces and separate ChatGPT conversations. Rejected.

## Breakthrough: direct authenticated web-session transport
The previous assumption that a real ChatGPT page had to remain open was disproved by live testing on 2026-08-25.

### 3.8.8 — Direct Session Probe
Build: `BriefCraft-AI-3.8.8-GPT-Direct-Session-Probe.zip`

The extension service worker accessed the user’s already authenticated `chatgpt.com` session directly, without creating any ChatGPT tab/window and without sending a message.

Live result:
- HTTP 200
- accessToken found
- zero ChatGPT tabs/windows created
- zero new ChatGPT conversations created

### 3.8.9 — Direct Prerequisites Probe
Build: `BriefCraft-AI-3.8.9-GPT-Direct-Prerequisites-Probe.zip`

Live result:
- session 200
- models 200 (17 models returned in that test)
- chat-requirements 200
- requirements token found
- Proof-of-Work required
- Arkose not required
- WebSocket not required
- zero windows/tabs/chats created

### 3.8.10 — Direct Chat First Live Test
Build: `BriefCraft-AI-3.8.10-GPT-Direct-Chat-First-Live-Test.zip`

Implementation:
- direct authenticated `chatgpt.com` backend request from extension service worker
- fresh chat-requirements per request
- SHA3-512 Proof-of-Work
- SSE response parsing
- temporary/history-disabled conversation behavior plus cleanup/hide after response
- no `windows.create()` transport and no ChatGPT page automation

Live verification passed:
- Prompt `Ответь одним словом: СВЯЗЬ` returned `СВЯЗЬ` inside BriefCraft.
- A long structured ~700–1000-word prompt was also tested. GPT began responding after roughly 7 seconds and returned the long answer successfully inside BriefCraft.
- No visible ChatGPT tab opened.
- No Chrome/Windows service window opened.
- No new visible ChatGPT chat appeared in history during the test.

Therefore **3.8.10 is the proven baseline for no-window direct GPT text transport** on the user’s live Chrome/session.

Important caveat: this transport uses the authenticated ChatGPT web backend, which is not a stable public API contract and can change. Keep the transport isolated behind Presence Core so it can be replaced without rewriting the canvas architecture.

## Canonical BriefCraft brand — updated 2026-08-25
The owner supplied a new yellow/gold BriefCraft logo and committed it to this repository.

Canonical source:
- `brand/briefcraft-logo.svg`
- `brand/brand.json`

Brand rule from `brand.json`:
- primary `#EEBF26`
- accent `#FFE100`
- all future product icons/header marks/favicons/Chrome icons/desktop icons must derive from `brand/briefcraft-logo.svg`
- the legacy blue `b°` logo must not be used in new builds

## Current build / next test
### BriefCraft AI 3.8.11 — Chat Workspace + Tool Bus + Attachments
Build created 2026-08-25:
`BriefCraft-AI-3.8.11-Chat-Workspace-ToolBus-Attachments.zip`

Built on the proven 3.8.10 direct text transport.

### UI changes in 3.8.11
- Replaced the old blue logo with the canonical yellow/gold logo from `brand/briefcraft-logo.svg` in the extension build/header/icons.
- Moved verbose GPT connection/access/change controls out of the main chat body into a gear/settings popover to free vertical chat space.
- GPT panel is resizable in width and height; geometry is persisted.
- Minimized GPT pill/bubble is draggable and persists its position.
- Composer now has a `+` attachment button and an emoji button before the text field.
- Emoji picker reuses the existing BriefCraft emoji catalog/groups/search instead of maintaining a second emoji set.
- Attachment tray shows pending attachments and allows removal before send.

### Attachments in 3.8.11
- Images supported in the direct GPT path: PNG/JPEG/GIF/WebP.
- Direct image upload uses the current ChatGPT web-session file flow: create multimodal file → upload to returned URL → finalize → send `multimodal_text` with `file-service://` asset pointer.
- Text/code files are read locally and injected into the prompt as delimited text context; oversized text is truncated to a safe cap.
- `Скрин из кэша` can reuse BriefCraft’s cached/pending screenshot state.
- Screenshot/editor flows persist the latest cached screenshot for later GPT attachment.
- Unsupported binary formats are not silently sent as text.

### Canvas Tool Bus integration in 3.8.11
The existing compact on-demand Presence loop remains:
- `canvas_status`
- `list_canvas_objects`
- `get_selection`
- `get_viewport`
- `get_object`
- `get_connections`
- `search_canvas`
- `get_recent_changes`
- `read_object_text`
- `read_code`
- `read_browser_dom`
- `capture_selection_image`
- `capture_viewport_image`

Visual tool results/crops can now be forwarded as real multimodal image attachments to the direct GPT transport instead of requiring a visible ChatGPT page.
Structured `briefcraft.patch/v1` staging remains the intended route for preview/apply/undo edits.

### Verification completed for 3.8.11
Static/build checks passed:
- manifest version is 3.8.11
- ZIP integrity passed
- JavaScript syntax checks passed for modified transport/UI files
- no duplicate HTML IDs found in checked extension pages
- canonical logo included and generated extension icons use it

### Runtime verification still required
Do NOT claim these new 3.8.11 parts are proven until the user tests them live:
1. Install/load 3.8.11 and verify the new yellow/gold logo appears correctly.
2. Resize the GPT panel; reload/open again and verify geometry persistence.
3. Minimize to the pill, drag the pill elsewhere, reopen it.
4. Open the gear and verify GPT connection/access/change controls work.
5. Open the emoji picker and insert an emoji into the prompt.
6. Attach one image from disk and ask GPT what is visible. This is the first live test of direct multimodal upload.
7. Use `Скрин из кэша` and ask GPT what is visible.
8. Create/select one simple canvas object and ask `Что я выделил?` to verify semantic Tool Bus context.
9. Ask a visual question requiring a crop, e.g. `Какого цвета эта фигура?`, to verify on-demand image capture through direct transport.
10. Ask for a simple edit, e.g. `Сделай этот объект градиентом от синего к фиолетовому под 45 градусов`, and verify a structured patch is staged for Preview/Apply/Undo.

If image upload fails, preserve the exact HTTP/error text and fix only that layer; do not regress to browser-page automation.

## Workflow rule
Work in small verified increments. Do not rebuild unrelated features when one bug is reported. Do not claim live/runtime behavior is fixed without a real user test. Keep the proven 3.8.10 text transport stable while testing 3.8.11 UI, multimodal attachments and Canvas Tool Bus.
