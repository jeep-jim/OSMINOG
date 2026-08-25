# BriefCraft AI — project state

## READ THIS FIRST IN A NEW CHAT
If the user opens a new chat and writes **«начни»**, first read this file completely, then continue from **Current test / next step** below. Do not ask the user to retell the project and do not restart old Cloudflare/Codespaces/MCP experiments unless the user explicitly asks.

## Product we are building
BriefCraft is a persistent shared workspace where a human and AI work on the same visual canvas. The project memory lives on the canvas, not in chat history.

The user must be able to keep a long-running project on one board with briefs, notes, files, images, code, browser/DOM captures, nodes, links and revisions. At any time an AI can be invited into that workspace, inspect what is needed, answer in an internal BriefCraft chat or an external AI chat, and propose/perform requested canvas edits.

Examples of intended UX:
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

## What was rejected
### Old Bridge 3.2
It proved Canvas → ChatGPT could work, but it pasted huge payloads into the visible chat. Browser DOM/code could add 100k+ characters and made the system hang. Do not return to full-canvas chat dumps.

### Cloudflare / standalone MCP relay experiments 3.4–3.5
Too much deployment friction for the developer and unacceptable end-user UX. Do not resume Wrangler/Cloudflare FIX scripts.

### Local Gemini-first 3.6
Technically interesting, but wrong for the current test because the user wants GPT first.

### ChatGPT App / Codespaces 3.7
A small official ChatGPT App/MCP server was built and put in this repo. GitHub Codespaces successfully exposed port 3000 publicly. However, the user’s current ChatGPT Pro UI does not expose the custom-app/Developer-Mode creation flow needed to attach that temporary MCP endpoint. Therefore this path is paused, not deleted. The repo files may be useful later when official app publishing/custom MCP is available to the account.

## Current transport: GPT Browser Presence Lite
This is a temporary GPT-first transport for the user’s current ChatGPT Pro session. It does **not** use OpenAI API, Cloudflare, Vercel, Codespaces or MCP.

BriefCraft injects a small local bridge only into `chatgpt.com` after the user explicitly presses **Подключить GPT** and grants the optional host permission.

It does NOT paste the whole canvas. Instead it builds compact/on-demand context:
- canvas/project status and revision
- current selection with real properties
- recent changes
- a limited lightweight object index
- browser/code objects only as summaries unless more data is requested
- a small visual crop only for visual requests

### Pseudo-tool loop without MCP/API
1. GPT receives the user request plus compact BriefCraft context.
2. If more data is needed, GPT can return a machine-only `briefcraft.request/v1` block with up to 4 tool calls.
3. BriefCraft executes only those local Canvas Tool Bus calls.
4. Only requested results are sent back.
5. If the user asked to edit the canvas, GPT can return `briefcraft.patch/v1`.
6. BriefCraft stages the patch locally; Preview/Apply/Undo remain under BriefCraft control.

## Current build: BriefCraft AI 3.8.2 — GPT Browser Presence Thread Fix
Build created on 2026-08-25:
`BriefCraft-AI-3.8.2-GPT-Browser-Presence-Thread-Fix.zip`

### What happened in 3.8.1
3.8.1 successfully connected GPT and the movable/minimizable AI panel worked. The user sent an internal BriefCraft message («бро, ты видишь меня?»). ChatGPT answered, but the bridge chose a blank/new ChatGPT conversation instead of the intended already-open working conversation, and the natural answer did not reliably mirror back into the internal BriefCraft panel.

### Root cause
The background bridge selected ChatGPT tabs too loosely (`active || first tab`) and could silently fall back to the first/blank `chatgpt.com` tab. When the internal prompt was sent into a blank ChatGPT home page, ChatGPT created a new conversation. This broke the intended feeling that the internal BriefCraft chat is attached to the user’s chosen working GPT thread.

### Fixes in 3.8.2
- Presence now binds to one existing ChatGPT tab/conversation and keeps using that exact tab for internal turns.
- It no longer silently creates a new `chatgpt.com` tab when none is open.
- The bridge remembers the most recently active ChatGPT tab and prefers an already-open real conversation over the blank ChatGPT home page.
- Once bound, later internal prompts and tool results stay in the same ChatGPT tab.
- Connect response now returns the bound ChatGPT title; BriefCraft shows `Привязан чат: …` after connection.
- Assistant reply detection was hardened for current ChatGPT DOM variants: it checks explicit assistant-role nodes and current conversation-turn article wrappers.
- Added an assistant baseline when sending an internal/tool-result turn so an old assistant response cannot be mistaken for the new answer.
- Natural GPT answer is still mirrored back into the internal BriefCraft panel; protocol request/patch blocks remain machine-only when detectable.
- Existing 3.8.1 UX remains: draggable AI panel, saved position, minimize button, floating `GPT · чат` restore button.

### Verification completed for 3.8.2
- JavaScript syntax check passed for changed bridge/background/presence files.
- `manifest.json` parses and version is `3.8.2`.
- No duplicate HTML IDs in editor/popup/screenshot pages.
- ZIP integrity verified; `manifest.json` is at archive root.

### Verification limitation
A full live runtime test against the user’s authenticated current ChatGPT web page cannot be executed from the build environment. Do not claim same-thread binding/mirroring is fixed until the user tests 3.8.2.

## Current test / next step
1. Extract `BriefCraft-AI-3.8.2-GPT-Browser-Presence-Thread-Fix.zip`.
2. Load the extracted folder in `chrome://extensions`, replacing 3.8.1.
3. IMPORTANT: first open/focus the exact ChatGPT conversation that should be paired with BriefCraft (the user’s working chat), then return to BriefCraft.
4. Open **ИИ на холсте** and press **Подключить GPT**.
5. Expected connect message in BriefCraft: `Готово. Привязан чат: <title of chosen ChatGPT conversation>`.
6. From the internal BriefCraft chat send a tiny message such as: **«Ответь одним словом: вижу»**.
7. Verify BOTH:
   - ChatGPT continues in the same already-open working conversation; no new ChatGPT chat is created.
   - the natural GPT answer is mirrored into the internal BriefCraft panel and `Жду ответ GPT…` clears.
8. If step 7 passes, select one simple canvas object and ask internally: **«Что я сейчас выделил?»**.
9. Then test edit staging: **«Сделай этот объект градиентом от синего к фиолетовому под 45 градусов.»**.
10. Report actual behavior/screenshots before changing unrelated product features.

## Internal + external chat behavior target
- The user can write inside the BriefCraft AI panel. BriefCraft sends that turn into the exact bound normal ChatGPT conversation and mirrors GPT’s natural answer back into BriefCraft.
- While Presence is enabled, a normal message typed directly in the bound ChatGPT tab gets only compact BriefCraft context appended automatically.
- Assistant replies associated with BriefCraft are mirrored back into the internal BriefCraft chat.
- BriefCraft must never choose/create another ChatGPT conversation after pairing unless the user explicitly reconnects.

## Known limitations of browser transport
- It is temporary and depends on the current ChatGPT web composer/message DOM.
- Machine context still technically travels through the ChatGPT conversation transport, but it must remain compact and on-demand. Never return to full-canvas dumps.
- Full official silent tool access from external ChatGPT should later use the paused ChatGPT App/MCP path when publishing/account capabilities allow it.

## Chrome Web Store constraint
Do not add remote executable code. Keep Manifest V3. Access to `chatgpt.com` must remain optional and requested by an explicit user action. Any Store release must clearly disclose why BriefCraft needs access to the ChatGPT page and what data is shared.

## Important workflow rule
Work in small verified increments. Do not rebuild unrelated features when the user reports one bug. Do not claim a visual/runtime bug is fixed unless it was actually tested or clearly state the verification limitation.
