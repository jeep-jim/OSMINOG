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
- 3.8.3 moved internal BriefCraft conversation to a dedicated inactive ChatGPT service tab/thread so visible working ChatGPT conversation is not polluted.
- Movable/minimizable AI panel works and can collapse to `GPT · чат`.
- 3.8.4 improved streaming handling, but manual test still showed premature truncation: user waited about 6 seconds and BriefCraft mirrored `Нормально, бро 😎 На` while GPT was still continuing.

## Current build: BriefCraft AI 3.8.5 — GPT Final Reply Detection Fix
Build created on 2026-08-25:
`BriefCraft-AI-3.8.5-GPT-Final-Reply-Detection-Fix.zip`

### Root cause found after 3.8.4
A 1.4-second unchanged-text window is not sufficient. GPT can pause for longer than that in the middle of a streamed sentence, so text stability alone can falsely indicate completion.

### Fix in 3.8.5
- Completion now prefers strong ChatGPT UI signals rather than a short text pause.
- Streaming detection expanded for current Stop-button/data-testid/title/aria-label variants.
- The bridge also detects final assistant turn actions such as the Copy action, which normally appears when a turn is complete.
- If a strong completion signal is observed, BriefCraft mirrors after only a short final stability window (~420 ms), reducing unnecessary post-answer delay.
- If no strong completion signal is available because ChatGPT changes its DOM, BriefCraft uses a much longer text-stability fallback (~3 s) so a mid-sentence pause is not treated as final.
- Completion state resets for each internal turn and each tool-result continuation.
- Protocol request/patch parsing waits for the same final-answer detection, preventing partial JSON consumption.
- No unrelated product features were intentionally changed.

### Verification completed for 3.8.5
- JavaScript syntax checks passed for changed bridge/presence files.
- `manifest.json` parses and version is `3.8.5`.
- ZIP integrity verified; root `manifest.json` is present.

### Verification limitation
A live authenticated ChatGPT streaming runtime cannot be reproduced in the build environment. User must verify manually. Do not claim the live reply-completion issue is solved until user confirms.

## Current test / next step
1. Disable/remove older unpacked 3.8.x copies so only one BriefCraft Presence bridge is active.
2. Reload ChatGPT tabs once to remove old injected scripts.
3. Extract and load `BriefCraft-AI-3.8.5-GPT-Final-Reply-Detection-Fix.zip` in `chrome://extensions`.
4. Open BriefCraft → **ИИ на холсте** → **Подключить GPT**.
5. Ask internally a normal sentence-producing question such as **«Как ты? Ответь двумя предложениями.»**
6. Verify the COMPLETE answer returns into BriefCraft and not a prefix such as `В`, `мы`, or `Нормально, бро 😎 На`.
7. Observe latency: desired behavior is to mirror shortly after GPT actually finishes, not several seconds after completion.
8. If full reply works, select one simple canvas object and ask **«Что я сейчас выделил?»**.
9. Then ask **«Что ты видишь на холсте?»** and verify GPT gets compact semantic context plus only needed crop.
10. Then test editing: **«Сделай этот объект градиентом от синего к фиолетовому под 45 градусов.»** and verify a structured patch is staged for preview/apply.
11. Report actual behavior/screenshots before touching unrelated features.

## Target behavior
- Internal BriefCraft chat is default conversation surface.
- No duplicate internal turns in user's visible ChatGPT conversation.
- GPT understands board through compact semantic context and on-demand visual crops/tool requests.
- Canvas edits arrive as structured patches for local preview/apply/undo.
- External ChatGPT participation can later be optional separate mode.

## Known limitation of browser transport
This is temporary browser automation and depends on current ChatGPT web DOM. The dedicated service thread may appear as an inactive/background ChatGPT tab. Final official integration should move to the paused ChatGPT App/MCP route when publishing/account capabilities allow it.

## Chrome Web Store constraint
No remote executable code. Keep Manifest V3. `chatgpt.com` access must remain optional and requested by explicit user action. Store release must clearly disclose why BriefCraft needs access to ChatGPT page and what data is shared.

## Important workflow rule
Work in small verified increments. Do not rebuild unrelated features when user reports one bug. Do not claim a live/runtime bug is fixed until user tests it, or clearly state verification limitation.
