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

## Current test: BriefCraft AI 3.8.0 — GPT Browser Presence Lite
Current build created on 2026-08-25:
`BriefCraft-AI-3.8.0-GPT-Browser-Presence-Test.zip`

This is a temporary GPT-first transport for the user’s current ChatGPT Pro session. It does **not** use OpenAI API, Cloudflare, Vercel, Codespaces or MCP.

### How 3.8 works
BriefCraft injects a small local bridge only into `chatgpt.com` after the user explicitly presses **Подключить GPT** and grants the optional host permission.

It does NOT paste the whole canvas.
Instead it builds a compact context chosen for the current request:
- canvas/project status and revision
- current selection with real properties
- recent changes
- a limited lightweight object index
- browser/code objects only as summaries unless more data is requested

For visual requests, BriefCraft can attach a small crop of the selected object instead of the full canvas.

### Pseudo-tool loop without MCP/API
Because the current ChatGPT UI cannot attach our custom MCP app, 3.8 temporarily emulates on-demand tools through very small protocol blocks inside the browser conversation:

1. GPT receives the user request plus compact BriefCraft context.
2. If GPT needs more data, it can return a machine-only `briefcraft.request/v1` JSON block with up to 4 tool calls.
3. The extension executes only those local Canvas Tool Bus calls (get_object, read_code, read_browser_dom, capture_selection_image, etc.).
4. Only those requested results are sent back to GPT.
5. If the user asked to edit the canvas, GPT can return `briefcraft.patch/v1`.
6. BriefCraft stages the patch locally; Preview/Apply/Undo remain under BriefCraft control.

The injected bridge hides these machine protocol code blocks in the ChatGPT page UI when possible, so the visible chat stays clean. The important requirement is still to keep payloads small and targeted.

### Internal + external chat behavior
- The user can write inside the BriefCraft AI panel. BriefCraft sends that turn to the normal open ChatGPT session and mirrors GPT’s natural answer back into the BriefCraft panel.
- While Presence is enabled, a normal message typed directly in the connected ChatGPT tab gets a compact BriefCraft context appended automatically before sending, so the user can also work from the external chat.
- Assistant replies associated with BriefCraft are mirrored back into the internal BriefCraft chat.

### UI changes in 3.8
- GPT-first Russian UI.
- Main button: **Подключить GPT**.
- Access choices are in Russian.
- Change behavior choices are in Russian.
- Dynamic selects are upgraded through the same BriefCraft smart-select system, so dropdowns use the main interface style instead of browser-default select styling.
- No visible MCP/Relay/Cloudflare setup is part of the 3.8 flow.

## Current test / next step
1. Load `BriefCraft-AI-3.8.0-GPT-Browser-Presence-Test.zip` as an unpacked extension (extract it first).
2. Open a BriefCraft project that has a few objects.
3. Open the **ИИ на холсте / Live AI** panel.
4. Press **Подключить GPT** and allow access to `chatgpt.com`.
5. Keep a normal ChatGPT conversation open.
6. First test from inside BriefCraft: select one object and write: **«Что я сейчас выделил?»**
7. Then test an edit: **«Сделай эту фигуру градиентом от синего к фиолетовому под 45 градусов.»**
8. Verify that GPT’s natural answer appears in the BriefCraft panel and that a patch appears for review instead of modifying the canvas invisibly.
9. Then test from the normal ChatGPT page while Presence is connected: ask about the current selection and verify that only compact context is used and the chat does not hang.
10. Report actual behavior/screenshots before changing any other product features.

## Known limitations of 3.8
- It is a temporary browser transport, not the final official ChatGPT App transport.
- It depends on the current ChatGPT web composer/message DOM and therefore may need selector maintenance if ChatGPT changes its UI.
- Machine context still technically travels through the ChatGPT conversation transport, but it is intentionally compact/on-demand and machine blocks are hidden from the page UI when possible. This is fundamentally different from the rejected full-canvas dump.
- Full official silent tool access from external ChatGPT should later use the paused ChatGPT App/MCP path when publishing/account capabilities allow it.

## Chrome Web Store constraint
Do not add remote executable code. Keep Manifest V3. Access to `chatgpt.com` must remain optional and requested by an explicit user action. Any Store release must clearly disclose why BriefCraft needs access to the ChatGPT page and what data is shared.

## Important workflow rule
Work in small verified increments. Do not rebuild unrelated features when the user reports one bug. Do not claim a visual/runtime bug is fixed unless it was actually tested or clearly state the verification limitation.
