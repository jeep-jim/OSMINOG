# BriefCraft AI — project state

## READ THIS FIRST IN A NEW CHAT
If the user opens a new chat and writes **«начни»**, read this file completely first and continue from **Current build / next test**. Do not ask the user to retell the project. Do not restart rejected service-tab / Cloudflare / old MCP experiments unless explicitly requested.

## Product goal
BriefCraft is a persistent visual workspace where project memory lives on the canvas. Humans and AI work around the same objects: briefs, notes, files, images, audio/video, PDFs, code/live previews, browser references, nodes, links, revisions, modules and agent threads.

Core rule: canvas is source of truth; object IDs are stable; AI reads only needed data through Canvas Tool Bus and edits through `briefcraft.patch/v1` with Preview/Apply/Undo.

## Proven transport / execution
- 3.8.8–3.8.10 proved direct authenticated ChatGPT web-session transport with no visible service tab/window/new visible ChatGPT conversation.
- 3.8.11 direct multimodal image upload worked.
- 3.8.12 object focus + clipboard/drop attachments worked.
- 3.8.13 introduced main + temporary agent chats and tethers.
- 3.8.14 live-tested real canvas patches and complex build-from-brief workflows using code + live preview.
- 3.8.17 restored BUILD MODE and introduced durable save plus a fixed manifest `key`. Preserve that exact key forever.
- 3.8.18 added folder-first dark onboarding, whole-project Main GPT context, PDF overlay editing, direct PDF attachments, optional Internet Research and local-folder OWNER Jarvis.
- 3.8.19 repaired Vector Pen/Pencil editing and added version/update UI foundation.
- 3.8.20 added external normal-ChatGPT Live Presence, Figma-like sharing-role model, agent pills, per-agent provider architecture, browser interaction lock and code preview-only/split controls.
- 3.8.21 added Claude, explicit agent roles, parallel provider tasks with serialized canvas commits, Figma/GitHub modules and Quick Search.
- 3.8.22 replaced Quick Search with a collapsible Google AI widget powered by Gemini API + Google Search grounding when a key is available.

## Persistence rule
From 3.8.17 onward every build MUST preserve the same manifest `key`. Projects should live in the selected workspace folder / `.briefcraft.json` backups and not rely only on extension-local storage.

## Current build / next test
### BriefCraft AI 3.8.23 — Provider Connect UX + Custom AI
Build created 2026-08-26:
`BriefCraft-AI-3.8.23-Provider-Connect-Custom-AI.zip`

Built directly from 3.8.22; fixed manifest key preserved.

### Provider connection UX — browser tab first, API fallback
The normal-user goal is now: **open the AI website → BriefCraft detects the tab → user clicks Connect → no API key is required when the tab bridge works**.

For Claude / Gemini / DeepSeek:
- BriefCraft detects already-open tabs for `claude.ai`, `gemini.google.com` and `chat.deepseek.com`;
- when such a tab appears, BriefCraft sends an in-app suggestion that it can be connected;
- agent settings show `Подключить открытую вкладку` as the preferred path;
- connection requests the minimum host permission for that provider and injects `provider-tab-bridge.js` into the existing tab;
- the bridge uses provider-specific + generic DOM heuristics to locate the composer, submit a prompt and detect the latest assistant answer;
- the connected tab is reused for subsequent agent turns and Tool Bus follow-ups;
- no new provider tab is created by BriefCraft;
- API key remains available under an explicit **API / local server — fallback** section.

Important truth: the Claude/Gemini/DeepSeek consumer-site DOM is not a stable public API. This tab bridge is intentionally marked beta and must be live-tested; if a provider changes its DOM, BriefCraft should fall back to the provider API rather than pretending the web bridge is stable.

### DeepSeek API correction
The fallback adapter now uses the supplied/standard OpenAI-compatible DeepSeek shape:
- endpoint: `https://api.deepseek.com/v1/chat/completions`;
- model: `deepseek-chat`;
- Bearer API key;
- BriefCraft system/context messages + normal chat-completions message array.

### Custom AI / OpenAI-compatible provider
3.8.23 adds a real **Custom AI** provider for the integration pattern suggested during testing.

Agent settings can store locally:
- display name;
- Base URL;
- model name;
- optional API key;
- optional custom system prompt.

BriefCraft calls an OpenAI-compatible `/v1/chat/completions` endpoint and preserves the same BriefCraft request/patch protocol. Intended targets include OpenRouter, Together-style compatible gateways, LM Studio, Ollama-compatible gateways and other OpenAI-compatible servers. Local endpoints may omit API key when the server allows it.

The Custom AI module is also visible under Modules and opens the same agent provider configuration.

### Google AI widget connection improvement
The Google AI workspace widget can now use a connected open Gemini tab before requiring a Gemini API key. If no tab bridge is connected, the existing Gemini API + Google Search grounding path remains the stable fallback. Google account/profile identity is still separate from Gemini developer API credentials.

### Module icons / launch-screen redesign
- Figma, Google Drive, GitHub and Google AI module cards now use branded SVG icon assets instead of placeholder letters.
- Provider icon assets were added for GPT, Claude, Gemini, DeepSeek and Custom AI.
- The empty-canvas center was redesigned from the old generic `Build the shared context` block into a clearer launch surface: **С чего начнём?** with primary actions to Connect AI, Create brief, Add reference, plus quick provider launch buttons.

### Existing 3.8.22 layers retained
- Google AI collapsible widget;
- multi-agent roles / colors / parallel provider work + serialized canvas commits;
- external normal ChatGPT Live Presence;
- agent pills/tethers;
- Figma/GitHub modules;
- browser canvas-lock / Interact mode;
- code/preview splitter + preview-only;
- full-project Main GPT memory/map;
- PDF/Jarvis/vector/BUILD MODE/durable save.

### Static verification completed for 3.8.23
- manifest version = 3.8.23;
- fixed manifest key preserved;
- all extension JavaScript including `provider-tab-bridge.js` passes `node --check`;
- manifest JSON parses;
- editor/popup/screenshot HTML have no duplicate IDs;
- ZIP integrity passes and root manifest is present.

### Runtime verification required
1. Update from 3.8.22 and verify project persistence.
2. Open DeepSeek in a normal browser tab, then select DeepSeek for an agent. BriefCraft should report that the tab is found; click `Подключить открытую вкладку`.
3. Send a simple text task through the DeepSeek agent. Confirm the prompt is submitted in the connected DeepSeek tab and the answer returns to the correct BriefCraft thread. This is a beta DOM bridge test.
4. Repeat separately with Claude and Gemini.
5. If a tab bridge fails, open the fallback section and test the corresponding API adapter; for DeepSeek verify `deepseek-chat` works.
6. Test Google AI widget with an open connected Gemini tab and no Gemini API key; then test API-key fallback separately.
7. Configure a Custom AI endpoint (for example a local OpenAI-compatible server) and test text + one simple canvas patch.
8. Open Modules and verify branded icons render; open Custom AI from Modules.
9. Start with an empty canvas and verify the new centered launch design / provider quick-launch buttons.

Do not claim consumer-tab provider bridges are production-stable before live verification. The tab connection is a convenience layer; official/provider API adapters remain the reliable fallback.

## Next architecture layers
1. Harden per-provider tab bridges after live DOM tests and add selector diagnostics/self-healing.
2. Production OAuth for Google Drive / Figma / GitHub and account-based module connections instead of owner PATs.
3. BriefCraft Relay/Cloud for real multi-human accounts, avatars, invite links and realtime synchronization.
4. Multi-agent conflict UI: object leases, per-agent patch previews and merge/rebase when agents touch the same object.
5. OWNER GitHub updater/OAuth + GitHub Jarvis commit/push/PR after explicit authorization.

## Workflow rule
Keep the proven direct GPT transport stable. Preserve the fixed manifest key forever. Be explicit about runtime-tested vs newly built behavior. Never claim remote human collaboration, provider parity or consumer-tab bridge stability before live verification.