# BriefCraft AI — project state

## READ THIS FIRST IN A NEW CHAT
If the user opens a new chat and writes **«начни»**, read this file completely first and continue from **Current test / next step**. Do not ask the user to retell the project. Do not restart Cloudflare/Codespaces/MCP experiments unless the user explicitly asks.

## Product we are building
BriefCraft is a persistent shared workspace where a human and AI work on the same visual canvas. Project memory lives on the canvas, not in chat history.

The board can keep briefs, notes, files, images, code, browser/DOM captures, nodes, links and revisions for long-running projects. AI can be invited at any time, inspect only what it needs, answer inside BriefCraft, and propose/perform requested canvas edits.

Intended UX examples:
- «Посмотри на цвет этой фигуры и сделай градиент.»
- «Сделай у этой звезды 6 концов вместо 5.»
- «Вот текст — подправь и выровняй шаблон.»
- «Посмотри, что изменилось на холсте, и продолжай работу.»
- A task node connected to an object can describe what AI should do with that object.

## Non-negotiable UX
End user flow must feel like:
**Install BriefCraft → Connect AI → Allow → work.**

End users must never need API keys, MCP URLs, terminals, Cloudflare, Vercel, Codespaces, deployment scripts or companion EXEs just to use AI Presence.

## AI providers
MVP priority:
1. GPT / ChatGPT
2. Gemini
3. DeepSeek
Claude can be added later.

GPT is current development priority because the user works almost exclusively with ChatGPT.

## Core architecture that must remain
AI Presence / Canvas Tool Bus:
- stable object IDs
- lightweight canvas index/mirror
- current selection
- recent changes / revisions
- get object / neighbors / connections
- search canvas
- read text/code/DOM only when needed
- capture a small visual region only when needed
- propose structured canvas patch
- local apply / preview / undo

Canvas is source of truth. AI must never invent an existing object ID.

## Rejected / paused paths
- Old Bridge 3.2: proved Canvas → ChatGPT worked, but dumped huge payloads into visible chat and caused hangs. Never return to full-canvas dumps.
- Cloudflare / standalone MCP relay 3.4–3.5: too much deployment friction and unacceptable UX.
- Local Gemini-first 3.6: wrong priority; GPT must be first.
- ChatGPT App / Codespaces 3.7: official App/MCP prototype exists in this repo, but current ChatGPT Pro UI does not expose the custom-app/Developer-Mode flow required to attach it. Paused, not deleted.

## Current transport: GPT Browser Presence Lite
Temporary GPT-first transport using the user's authenticated `chatgpt.com` web session. No OpenAI API, Cloudflare, Vercel, Codespaces or MCP is required for this current test.

BriefCraft requests optional access to `chatgpt.com` only after explicit **Подключить GPT**.

It must never dump the full canvas. Context is compact/on-demand: project/revision, selection, recent changes, lightweight object index, viewport summary when relevant, browser/code summaries, and a small selection/viewport image only for visual requests.

Pseudo-tool loop:
1. GPT receives user request + compact BriefCraft context.
2. If more data is needed, GPT can return one machine-only `briefcraft.request/v1` block with up to 4 tool calls.
3. BriefCraft executes only those local Canvas Tool Bus calls.
4. Only requested results are returned.
5. If user asks to edit canvas, GPT can return `briefcraft.patch/v1`.
6. BriefCraft stages patch locally; Preview/Apply/Undo remain under BriefCraft control.

## What has already been proven
- 3.8.2 proved an internal BriefCraft message can reach GPT and GPT's answer can mirror back into BriefCraft.
- 3.8.3 moved internal BriefCraft conversation away from the visible working ChatGPT thread so normal user conversation is not polluted.
- Movable/minimizable AI panel works and can collapse to `GPT · чат`.
- 3.8.4/3.8.5 focused on full final-answer detection because early versions mirrored partial streamed text.

## New UX bug found in 3.8.5
Manual test showed that pressing **Подключить GPT** immediately created a new ChatGPT tab in the user's normal tab strip. The user explicitly rejected this. Connecting AI must not visibly open another browser tab.

## Current build: BriefCraft AI 3.8.6 — GPT No-New-Tab Connect
Build created on 2026-08-25:
`BriefCraft-AI-3.8.6-GPT-No-New-Tab-On-Connect.zip`

### Fix in 3.8.6
- Pressing **Подключить GPT** now only requests permission and enables Presence state. It does NOT create any ChatGPT tab or window.
- If an old service channel already exists, connect can refresh it; otherwise no ChatGPT surface is created during connect.
- The temporary browser transport creates its GPT service channel lazily only when the user actually sends the first internal BriefCraft message.
- That temporary service channel is created in a separate minimized background Chrome window, not in the user's normal visible tab strip.
- The same background service tab/window is reused for later internal messages during the session.
- If the service window/tab is closed, BriefCraft clears its session IDs and recreates it only when another internal message is sent.
- UI wording now says connection itself opens no new tabs.
- No unrelated product features were intentionally changed.

### Why this is still temporary
Chrome cannot run the authenticated ChatGPT web app invisibly inside an extension service worker/offscreen document as a supported official integration. Therefore the browser-transport prototype still needs some authenticated ChatGPT page somewhere when an internal message is actually processed. In 3.8.6 that implementation detail is moved out of the user's normal tab strip. Final official integration should later use the paused ChatGPT App/MCP path when publishing/account capabilities allow it.

### Verification completed for 3.8.6
- JavaScript syntax checks passed for `background.js`, `gpt-presence.js`, `chatgpt-lite-bridge.js` and the build JS files.
- `manifest.json` parses and version is `3.8.6`.
- Locale JSON parses.
- No duplicate HTML IDs in editor/popup/screenshot pages.
- ZIP integrity verified and root `manifest.json` is present.

### Verification limitation
A live authenticated ChatGPT runtime cannot be reproduced in the build environment. Do not claim the new-tab behavior is solved until the user manually verifies 3.8.6.

## Current test / next step
1. Disable/remove older unpacked 3.8.x copies so only one BriefCraft Presence bridge is active.
2. Reload open ChatGPT tabs once to remove old injected scripts.
3. Extract and load `BriefCraft-AI-3.8.6-GPT-No-New-Tab-On-Connect.zip` in `chrome://extensions`.
4. Open BriefCraft → **ИИ на холсте**.
5. Press **Подключить GPT**.
6. FIRST verify only this UX point: **no new ChatGPT tab should appear in the normal browser tab strip when Connect is pressed**.
7. If step 6 passes, send one internal message from BriefCraft, e.g. **«Как ты? Ответь двумя предложениями.»**.
8. On the first actual message a temporary minimized background Chrome service window may be created; it must not appear as a new normal tab beside the user's working tabs.
9. Verify the full GPT answer returns inside BriefCraft and the visible working ChatGPT conversation remains unchanged.
10. If full reply works, select/create one simple canvas object and ask **«Что я сейчас выделил?»**.
11. Then ask **«Что ты видишь на холсте?»** and verify GPT receives compact semantic context plus only needed crop.
12. Then test edit staging: **«Сделай этот объект градиентом от синего к фиолетовому под 45 градусов.»** and verify a structured patch is staged for preview/apply.
13. Report actual behavior/screenshots before touching unrelated features.

## Target behavior
- Internal BriefCraft chat is default conversation surface.
- Pressing Connect does not visibly open browser tabs.
- No duplicate internal turns in user's visible ChatGPT conversation.
- GPT understands board through compact semantic context and on-demand visual crops/tool requests.
- Canvas edits arrive as structured patches for local preview/apply/undo.
- External ChatGPT participation can later be optional separate mode.

## Chrome Web Store constraint
No remote executable code. Keep Manifest V3. `chatgpt.com` access must remain optional and requested by explicit user action. Store release must clearly disclose why BriefCraft needs access to ChatGPT page and what data is shared.

## Important workflow rule
Work in small verified increments. Do not rebuild unrelated features when user reports one bug. Do not claim a live/runtime bug is fixed until user tests it, or clearly state verification limitation.
