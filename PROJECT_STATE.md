# BriefCraft AI — project state

## READ THIS FIRST IN A NEW CHAT
If the user opens a new chat and writes **«начни»**, first read this file completely and continue from **Current test / next step**. Do not ask the user to retell the project. Do not restart Cloudflare/Codespaces/MCP experiments unless the user explicitly asks.

## Product we are building
BriefCraft is a persistent shared workspace where a human and AI work on the same visual canvas. Project memory lives on the canvas, not in chat history.

The user keeps briefs, notes, files, images, code, browser/DOM captures, nodes, links and revisions on one long-running board. AI can be invited at any time, inspect only what it needs, answer inside BriefCraft, and propose/perform requested canvas edits.

Examples of intended UX:
- «Посмотри на цвет этой фигуры и сделай градиент.»
- «Сделай у этой звезды 6 концов вместо 5.»
- «Вот текст — подправь и выровняй шаблон.»
- «Посмотри, что изменилось на холсте, и продолжай работу.»
- A task node connected to an object can describe what AI should do with that object.

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

The canvas is source of truth. AI must never invent an existing object ID.

## Rejected / paused paths
- **Old Bridge 3.2:** proved Canvas → ChatGPT worked, but dumped huge canvas/HTML payloads into visible chat and caused hangs. Never return to full-canvas dumps.
- **Cloudflare / standalone MCP relay 3.4–3.5:** too much deployment friction and unacceptable UX.
- **Local Gemini-first 3.6:** wrong priority; GPT must be first.
- **ChatGPT App / Codespaces 3.7:** official App/MCP prototype exists in this repo, but the user’s current ChatGPT Pro UI does not expose the custom-app/Developer-Mode flow required to attach it. Paused, not deleted.

## Current transport: GPT Browser Presence Lite
Temporary GPT-first transport for the current ChatGPT Pro session. It uses the user’s authenticated `chatgpt.com` web session and requires no OpenAI API, Cloudflare, Vercel, Codespaces or MCP.

BriefCraft requests optional `chatgpt.com` permission only after explicit **Подключить GPT**.

It must never dump the full canvas. It uses compact/on-demand context:
- project/canvas status and revision
- current selection with real properties
- recent changes
- lightweight object index
- viewport summary when relevant
- browser/code objects as summaries unless requested
- small selection/viewport image only for visual requests

Pseudo-tool loop:
1. GPT receives the user request plus compact BriefCraft context.
2. If more data is needed, GPT can return one machine-only `briefcraft.request/v1` block with up to 4 tool calls.
3. BriefCraft executes only those local Canvas Tool Bus calls.
4. Only requested results are returned.
5. If the user asks to edit the canvas, GPT can return `briefcraft.patch/v1`.
6. BriefCraft stages the patch locally; Preview/Apply/Undo remain under BriefCraft control.

## What has already been proven
- 3.8.2 proved an internal BriefCraft message can reach GPT and GPT’s natural answer can mirror back into BriefCraft.
- 3.8.3 moved the internal BriefCraft conversation onto a dedicated inactive ChatGPT service tab/thread so the user’s visible working ChatGPT conversation is not polluted by duplicate internal turns.
- The movable/minimizable AI panel works and can collapse to a small `GPT · чат` button.

## Current build: BriefCraft AI 3.8.4 — GPT Streaming Reply Fix
Build created on 2026-08-25:
`BriefCraft-AI-3.8.4-GPT-Streaming-Reply-Fix.zip`

### Bug observed in 3.8.3
Internal BriefCraft chat returned only the first fragment of GPT replies, e.g. `В` or `мы`, instead of the complete answer.

This was NOT GPT intentionally answering with one character. The ChatGPT DOM streams response text incrementally into the same assistant node. The Browser Presence observer treated the first visible fragment as the final assistant message because the current ChatGPT build did not always expose one of our known streaming/Stop-button selectors.

### Fix in 3.8.4
- Added broader streaming-state detection (`stop-button`, Stop/Остановить/Прервать labels, streaming attributes/classes).
- More importantly, response completion no longer depends only on ChatGPT UI selectors.
- BriefCraft now requires the assistant body to remain unchanged for a stability window (~1.4 s) after streaming signals disappear before mirroring it into the internal chat.
- If the assistant text changes during that window, the timer resets.
- Stability state resets for every new internal turn and every tool-result continuation.
- The protocol request/patch parser now waits for the same stable final body, preventing partial protocol JSON from being consumed.
- No unrelated product features were intentionally changed.

### Verification completed for 3.8.4
- JavaScript syntax checks passed for changed Presence/bridge/background files.
- `manifest.json` parses and version is `3.8.4`.
- No duplicate HTML IDs in editor/popup/screenshot pages.
- ZIP integrity verified and root `manifest.json` is present.

### Verification limitation
A live authenticated ChatGPT streaming runtime cannot be reproduced in the build environment. The user must verify the fix manually. Do not claim it is solved until the user confirms full replies return inside BriefCraft.

## Current test / next step
1. Disable/remove older unpacked 3.8.3 (and any older 3.8.x copies) so only one BriefCraft Presence bridge is active.
2. Reload ChatGPT tabs once to remove old injected scripts.
3. Extract and load `BriefCraft-AI-3.8.4-GPT-Streaming-Reply-Fix.zip` in `chrome://extensions`.
4. Open BriefCraft → **ИИ на холсте** → **Подключить GPT**.
5. From the internal BriefCraft chat ask a normal multi-word question, e.g. **«Что за проект мы делаем?»**.
6. Verify the answer returns into BriefCraft as the COMPLETE GPT response, not the first token/word.
7. Verify the user’s current visible ChatGPT working conversation remains unchanged; the temporary service tab may exist in the background.
8. If full reply works, create/select one simple canvas object and ask internally: **«Что я сейчас выделил?»**.
9. Then ask a visual question: **«Что ты видишь на холсте?»**. GPT should receive only compact semantic context plus selection/viewport crop as needed.
10. Then test editing: **«Сделай этот объект градиентом от синего к фиолетовому под 45 градусов.»** and verify a structured patch is staged for preview/apply.
11. Report actual behavior/screenshots before touching unrelated features.

## Target behavior
- Internal BriefCraft chat is the default conversation surface.
- No duplicate internal turns in the user’s visible ChatGPT conversation.
- GPT understands the board through compact semantic context and on-demand visual crops/tool requests.
- Canvas edits arrive as structured patches for local preview/apply/undo.
- External ChatGPT participation can later be an optional separate mode.

## Known limitation of browser transport
This is still temporary browser automation and depends on current ChatGPT web DOM. The dedicated service thread may appear as an inactive/background ChatGPT tab. Final official integration should move to the paused ChatGPT App/MCP route when publishing/account capabilities allow it.

## Chrome Web Store constraint
Do not add remote executable code. Keep Manifest V3. Access to `chatgpt.com` must remain optional and requested by explicit user action. Any Store release must clearly disclose why BriefCraft needs access to the ChatGPT page and what data is shared.

## Important workflow rule
Work in small verified increments. Do not rebuild unrelated features when the user reports one bug. Do not claim a live/runtime bug is fixed until the user tests it, or clearly state the verification limitation.
