# BriefCraft AI — project state

## READ THIS FIRST IN A NEW CHAT
If the user opens a new chat and writes **«начни»**, first read this file completely, then continue from **Current test / next step** below. Do not ask the user to retell the project and do not restart old Cloudflare/Codespaces/MCP experiments unless the user explicitly asks.

## Product we are building
BriefCraft is a persistent shared workspace where a human and AI work on the same visual canvas. The project memory lives on the canvas, not in chat history.

The user keeps a long-running project on one board with briefs, notes, files, images, code, browser/DOM captures, nodes, links and revisions. AI can be invited at any time, inspect only what it needs, answer inside BriefCraft, and propose/perform requested canvas edits.

Examples:
- «Посмотри на цвет этой фигуры и сделай градиент.»
- «Сделай у этой звезды 6 концов вместо 5.»
- «Вот текст — подправь и выровняй шаблон.»
- «Посмотри, что изменилось на холсте, и продолжай работу.»
- A task node connected to an object can explain what AI should do with that object.

## Non-negotiable UX
For end users it must feel like:
**Install BriefCraft → Connect AI → Allow → work.**

End users must never need API keys, MCP URLs, terminals, Cloudflare, Vercel, Codespaces, deployment scripts or companion EXEs just to use AI Presence.

## AI providers
MVP priority:
1. GPT / ChatGPT
2. Gemini
3. DeepSeek
Claude can be added later.

GPT is the current development priority because the user works almost exclusively with ChatGPT.

## Core architecture that must remain
The core is **AI Presence / Canvas Tool Bus**:
- stable object IDs
- lightweight canvas index/mirror
- current selection
- recent changes / revisions
- get object / neighbors / connections
- search canvas
- read text/code/DOM only when needed
- capture a small visual region only when needed
- propose a structured canvas patch
- local apply / preview / undo

The canvas is the source of truth. AI must never invent an existing object ID.

## Rejected / paused paths
### Old Bridge 3.2
It proved Canvas → ChatGPT could work, but pasted huge payloads into the visible chat. Browser DOM/code could add 100k+ characters and caused hangs. Never return to full-canvas chat dumps.

### Cloudflare / standalone MCP relay 3.4–3.5
Too much deployment friction and unacceptable UX. Do not resume Wrangler/Cloudflare FIX scripts.

### Local Gemini-first 3.6
Wrong priority for current development because GPT must be first.

### ChatGPT App / Codespaces 3.7
Official App/MCP prototype exists in this repo and Codespaces exposed it successfully, but the user’s current ChatGPT Pro UI does not expose the custom-app/Developer-Mode creation flow needed for that test. This path is paused, not deleted.

## Current transport: GPT Browser Presence Lite
Temporary GPT-first transport for the current ChatGPT Pro session. It does not use OpenAI API, Cloudflare, Vercel, Codespaces or MCP.

BriefCraft requests optional access to `chatgpt.com` only after explicit **Подключить GPT**. It uses the user’s normal authenticated ChatGPT web session.

The transport must never dump the full canvas. It uses compact/on-demand context:
- project/canvas status and revision
- current selection with real properties
- recent changes
- lightweight object index
- current viewport summary when relevant
- browser/code objects only as summaries unless requested
- a small selection/viewport image only for visual requests

### Pseudo-tool loop without MCP/API
1. GPT receives the user request plus compact BriefCraft context.
2. If more data is needed, GPT can return one machine-only `briefcraft.request/v1` block with up to 4 tool calls.
3. BriefCraft executes only those local Canvas Tool Bus calls.
4. Only requested results are returned.
5. If the user asks to edit the canvas, GPT can return `briefcraft.patch/v1`.
6. BriefCraft stages the patch locally; Preview/Apply/Undo remain under BriefCraft control.

## What 3.8.2 proved
The internal BriefCraft message successfully reached ChatGPT and GPT’s natural answer successfully mirrored back into the BriefCraft panel.

However, 3.8.2 still wrote the internal BriefCraft turn into the user’s currently visible ChatGPT conversation. The user explicitly rejected this duplication. Internal BriefCraft chat must feel self-contained and must not pollute the user’s current working ChatGPT thread.

## Current build: BriefCraft AI 3.8.3 — GPT Internal Presence
Build created on 2026-08-25:
`BriefCraft-AI-3.8.3-GPT-Internal-Presence-Test.zip`

### Architectural change in 3.8.3
Internal BriefCraft chat now uses a **dedicated inactive ChatGPT service tab/thread** instead of the user’s current visible conversation.

On explicit **Подключить GPT**:
- BriefCraft requests `chatgpt.com` permission.
- It creates/reuses one inactive service ChatGPT tab in the same Chrome profile/account.
- Internal BriefCraft messages go only to that service thread.
- GPT’s natural answer is mirrored back into BriefCraft.
- The user’s current visible ChatGPT conversation receives no duplicate internal messages.
- The service tab ID is kept in `chrome.storage.session`; if the tab is closed, reconnect creates another service tab.

The dedicated service thread is an implementation detail for the temporary browser transport. The end-user-facing experience remains the internal BriefCraft chat.

### Better canvas visibility in 3.8.3
Each internal turn builds fresh context from the canvas at send time. Context now includes small workspace/canvas/view metadata and, for whole/visual questions, a current viewport summary.

Visual intent detection was expanded. If the prompt asks to look/see/draw/check form/color etc.:
- with selection → attach only a crop of the selection;
- without selection → attach only a current viewport image.

The full project is still never dumped. Broad questions use object index + viewport summary, and GPT can request specific objects/code/DOM/images through `briefcraft.request/v1`.

### Performance change in 3.8.3
Removed the 2.5-second periodic context push. Fresh context is generated when the user actually sends an internal turn, and additional data is fetched only through the tool loop. This reduces unnecessary background traffic/work.

### UI wording in 3.8.3
The panel explicitly says the user should chat inside BriefCraft and that the current ChatGPT conversation stays clean. The movable/minimizable panel from 3.8.1/3.8.2 remains.

### Verification completed for 3.8.3
- JavaScript syntax checks passed for all build JS files.
- `manifest.json` parses and version is `3.8.3`.
- Locale JSON parses.
- No duplicate HTML IDs in editor/popup/screenshot pages.
- ZIP integrity verified; root `manifest.json` is present.

### Verification limitation
A live authenticated ChatGPT runtime test cannot be executed from the build environment. The user must manually verify that the inactive service thread works and that the visible current ChatGPT thread remains untouched.

## Current test / next step
1. Disable/remove older 3.8.1/3.8.2 unpacked copies to avoid multiple injected bridges.
2. Reload any currently open ChatGPT pages once, so old injected scripts are gone.
3. Extract `BriefCraft-AI-3.8.3-GPT-Internal-Presence-Test.zip` and load the extracted folder in `chrome://extensions`.
4. Open BriefCraft and **ИИ на холсте**.
5. Press **Подключить GPT** and grant `chatgpt.com` access.
6. Expected: BriefCraft reports that the **internal GPT channel** is connected. The current visible ChatGPT conversation should NOT receive any new turn.
7. Inside BriefCraft send: **«Ответь одним словом: вижу»**.
8. Verify:
   - `вижу` returns into the BriefCraft panel;
   - the current visible ChatGPT conversation remains unchanged;
   - one background ChatGPT service tab may exist as the temporary transport implementation.
9. Add/select one simple canvas object and ask inside BriefCraft: **«Что я сейчас выделил?»**.
10. For visual proof, draw/select something and ask: **«Что ты видишь на холсте?»**. GPT should get only selection/viewport crop plus compact context, not a full-canvas dump.
11. Then test edit staging: **«Сделай этот объект градиентом от синего к фиолетовому под 45 градусов.»**.
12. Report actual behavior/screenshots before changing unrelated product features.

## Target behavior after this test
- Internal BriefCraft chat is the default conversation surface.
- No duplicate internal turns in the user’s current ChatGPT conversation.
- GPT can understand the board through compact semantic context and on-demand visual crops/tool requests.
- Canvas edits arrive as structured patches for local preview/apply/undo.
- Later, external ChatGPT participation can be an optional separate mode, not something that pollutes the internal workflow.

## Known limitation of browser transport
This is still a temporary browser automation transport and depends on current ChatGPT web DOM. The dedicated service thread may appear as an inactive/background ChatGPT tab. Final official integration should move to the paused ChatGPT App/MCP route when account/publishing capabilities allow it.

## Chrome Web Store constraint
Do not add remote executable code. Keep Manifest V3. Access to `chatgpt.com` must remain optional and requested by explicit user action. Any Store release must clearly disclose why BriefCraft needs access to the ChatGPT page and what data is shared.

## Important workflow rule
Work in small verified increments. Do not rebuild unrelated features when the user reports one bug. Do not claim a live/runtime bug is fixed until the user tests it, or clearly state the verification limitation.
