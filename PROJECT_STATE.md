# BriefCraft AI — project state

Current target: make BriefCraft a persistent shared workspace where a human and AI work on the same canvas. The project memory lives on the canvas, not in chat history.

## What the product must do
- Keep full project context locally: briefs, notes, files, images, code, browser/DOM captures, nodes, links and revisions.
- Let AI inspect only the canvas fragments it needs instead of pasting the whole canvas into chat.
- Let the user ask in an external AI chat or the internal BriefCraft chat things like “look at this shape”, “change it to a 6-point star”, “fix this text”, or “apply the task connected by this node”.
- AI can propose canvas patches; BriefCraft applies them locally with preview/undo and user-controlled permissions.
- End-user UX must be one-click: install BriefCraft → connect AI → allow access → work. End users must never see MCP URLs, API keys, terminals, Cloudflare, Codespaces or deployment steps.

## AI providers
MVP priority: GPT first, then Gemini and DeepSeek. Claude can be added later.

## Architecture decision
Do NOT return to the old DOM bridge that pasted huge canvas/HTML payloads into ChatGPT. It worked, but flooded chat with tens/hundreds of thousands of characters and caused hangs.

The core concept is AI Presence / Canvas Tool Bus:
- stable object IDs
- canvas index/mirror
- selection
- recent changes/revisions
- get object / neighbors / connections
- read text/code/DOM only on demand
- capture a small visual region only on demand
- propose structured canvas patch
- local apply/preview/undo

For external ChatGPT, OpenAI currently requires a remote MCP/App endpoint; local MCP cannot be connected directly. The small ChatGPT App backend must never store the user canvas. It only exposes the BriefCraft app/widget/tools. Local canvas data stays in the browser and is shared with the ChatGPT widget as compact context.

## Current extension test
Current GPT-focused test build: BriefCraft AI 3.7.0 GPT Presence Test.
The UI still needs cleanup/localization later; first prove GPT ↔ canvas presence works.

## Current GitHub test infrastructure
Private repository: jeep-jim/BriefCraft
Purpose: temporary zero-extra-service development test for the BriefCraft ChatGPT App. It is NOT the final user deployment model.

Repository contains:
- package.json
- server.mjs
- api/mcp.js
- ChatGPT Presence widget/resource
- .devcontainer/devcontainer.json
- README.md

GitHub Codespaces is used only to obtain a temporary public HTTPS MCP endpoint for development. The Codespace auto-starts the Node server on port 3000.

## Exact next test
1. In GitHub repo jeep-jim/BriefCraft click Code → Codespaces → Create codespace on main.
2. Wait for Codespace to open.
3. Open Ports panel. Port 3000 should appear as “BriefCraft MCP”.
4. Set port 3000 visibility to Public for this temporary test.
5. Copy the forwarded HTTPS URL and append /mcp.
6. Add that endpoint as a custom BriefCraft app in ChatGPT Developer Mode.
7. Open BriefCraft extension 3.7.0 and connect GPT.
8. Test without pasting canvas into chat: select/draw something and ask GPT what is selected; then request a canvas edit and verify patch/preview/apply.

## Important product constraint
The final released product must hide all infrastructure. Normal users must never create repositories/Codespaces or deploy anything. This GitHub path is only a temporary proof-of-architecture environment.
