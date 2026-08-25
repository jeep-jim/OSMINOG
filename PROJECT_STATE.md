# BriefCraft AI — project state

## READ THIS FIRST IN A NEW CHAT
If the user opens a new chat and writes **«начни»**, read this file completely first. Continue from **Current decision / next step** below. Do not ask the user to retell the project. Do not restart Cloudflare/Codespaces/MCP/old Bridge experiments unless explicitly requested.

## Product goal
BriefCraft is a persistent shared visual workspace where the project memory lives on the canvas, not in chat history. A human and AI should be able to work on the same board containing briefs, notes, files, images, code, browser/DOM captures, nodes, links and revisions.

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
- **Bridge 3.2:** Canvas→ChatGPT worked, but it dumped huge canvas/HTML payloads into visible chat and caused hangs. Rejected.
- **Cloudflare/MCP relay 3.4–3.5:** too much setup friction. Rejected for current product UX.
- **Local Gemini 3.6:** technically possible, wrong priority because GPT must be first.
- **Official ChatGPT App/MCP 3.7:** prototype exists in this repo and Codespaces exposed it publicly, but the user’s current ChatGPT Pro UI does not expose the custom-app/Developer-Mode creation flow needed to attach it. Paused, not deleted.
- **Browser Presence 3.8.x:** uses the user’s authenticated chatgpt.com session without API/MCP and passes compact/on-demand context instead of the whole canvas.

## What Browser Presence proved
- 3.8.2: an internal BriefCraft message can reach GPT and GPT answer can mirror back into BriefCraft.
- 3.8.3: internal turns can be separated from the user’s visible working ChatGPT conversation by using a service ChatGPT thread.
- Draggable/minimizable AI panel works.
- 3.8.4/3.8.5 worked on reply streaming/final-answer detection but still need runtime refinement.

## Critical result from 3.8.6 — 2026-08-25
Build: `BriefCraft-AI-3.8.6-GPT-No-New-Tab-On-Connect.zip`

The user tested **Подключить GPT** and Chrome still opened a separate visible ChatGPT page/window. The service ChatGPT page then behaved like a normal independent ChatGPT conversation, and the assistant even began responding/fixing things there.

This reveals a **fundamental limitation of the browser-session transport**, not just another selector bug:
- To use the user’s normal ChatGPT web subscription without API or official App/MCP, BriefCraft must automate a real `chatgpt.com` page.
- A Chrome extension cannot make a remote ChatGPT web page truly nonexistent/invisible while still using that page’s authenticated UI session. It can move/minimize/group it, but a real page still has to exist somewhere.
- Therefore Browser Presence cannot honestly satisfy the final requirement «internal BriefCraft chat only, no extra ChatGPT tab/window at all».

Do NOT ship another fake “no-tab fix” claiming this limitation is solved unless using a genuinely different transport.

## Current decision / next step
Before coding the next build, choose one technically honest path:

1. **Temporary test compromise:** keep exactly one dedicated ChatGPT service page, never recreate it, put it in a collapsed/background tab group and never focus it. This lets us continue testing AI vision + canvas patching today, but it is NOT final UX.

2. **Official ChatGPT App/MCP:** correct final external-ChatGPT architecture. Requires a public remote MCP/App endpoint; local canvas can still stay local and communicate with the ChatGPT widget. Current Pro account cannot attach the unpublished custom app, so testing is blocked until account/publishing capability exists. Some small always-on public endpoint is unavoidable for cloud ChatGPT to call a local workspace.

3. **OpenAI API:** gives a truly internal BriefCraft chat with no ChatGPT tab, but API billing is separate from ChatGPT subscription. Not acceptable as mandatory user setup.

4. **Desktop hidden WebView transport:** Windows/macOS desktop app can host an authenticated ChatGPT webview out of sight and expose Canvas Tool Bus locally. This can hide the real page from the user, but Chrome-extension-only users would need the desktop companion, which conflicts with the desired one-click extension-only UX unless explicitly accepted.

Important truth: **for Chrome-extension-only + cloud GPT + user’s ChatGPT subscription + no API + no remote App/MCP + absolutely no real ChatGPT page, there is no technically honest transport.** One of those constraints must change.

## Recommended product direction
Keep AI Presence / Canvas Tool Bus independent from transport. The canvas, memory, patches and permissions should not care whether the brain is GPT via official App, API, desktop WebView, Gemini or DeepSeek.

For the immediate GPT proof-of-concept, if the user accepts it, use one collapsed dedicated service tab only to finish testing:
1. GPT can identify selected objects and board contents through compact semantic context/on-demand crop.
2. GPT can request additional object/code/DOM data only when needed.
3. GPT can return `briefcraft.patch/v1` and BriefCraft can preview/apply/undo real canvas edits.

Then replace the temporary transport later without rewriting the Presence Core.

## Workflow rule
Work in small verified increments. Do not rebuild unrelated features when one bug is reported. Do not claim a live/runtime behavior is fixed without a real user test. Be explicit when a limitation is architectural rather than a bug.
