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

## Persistence rule
From 3.8.17 onward every build MUST preserve the same manifest `key`. Projects should live in the selected workspace folder / `.briefcraft.json` backups and not rely only on extension-local storage.

## Current build / next test
### BriefCraft AI 3.8.22 — Google AI Widget + Collapsible Module Widget
Build created 2026-08-26:
`BriefCraft-AI-3.8.22-Google-AI-Widget.zip`

Built directly from 3.8.21; fixed manifest key preserved.

### Google AI is now the default search widget
The former Quick Search module is replaced by a Google-AI-first workspace widget.

Behavior:
- opening the Google module starts in **Google AI** mode by default;
- the widget uses a BriefCraft-native interface inspired by the current Google AI chat/search layout rather than trying to iframe `google.com`;
- Google/consumer AI pages are not claimed to be embedded directly because those pages do not provide a supported embeddable contract;
- Google AI mode inside BriefCraft is powered by the configured Gemini API key and Google's Gemini API `google_search` grounding tool;
- grounded source URLs/titles returned by Gemini are displayed under the answer as source chips;
- the conversation state stays inside the widget during the current extension session;
- Enter sends; Shift+Enter adds a line.

### Search-engine selector
The widget has a mode selector:
- Google AI (default, runs inside BriefCraft);
- Google;
- Bing;
- DuckDuckGo.

For normal search engines, BriefCraft opens the selected engine in a normal browser tab rather than pretending their search-result pages are safely iframe-embeddable. The AI mode remains the in-workspace chat experience.

### Gemini credential path
- Google AI widget reuses the same local `briefCraftProviderKeysV1.gemini` key as Gemini agents;
- if Gemini is not configured, the widget opens the module credential UI instead of silently failing;
- the Gemini key can be verified against the Gemini models endpoint and is stored locally;
- the Modules card shows whether Google AI is ready.

Important truth: current Google AI for Developers documentation authenticates Gemini API calls with a Gemini API key / authorization key. A user's ordinary Google account sign-in is not treated as an implicit Gemini API credential. BriefCraft's existing Google profile/OAuth UI remains a separate product-account/Drive identity path.

### Google account integration foundation
- `identity` permission is now present in the extension manifest so the existing `chrome.identity.launchWebAuthFlow` path can work once a real Google OAuth client ID is configured;
- if a BriefCraft Google profile is present, the Google module reflects the signed-in account identity;
- a real production Google OAuth client ID is still required before claiming Google sign-in/Drive sync as runtime-ready.

### Collapsible module widget
The Google AI panel is now a draggable/resizable floating workspace widget.
- clicking minimize collapses it into a draggable Google `G` widget icon;
- clicking the icon restores the same Google AI panel;
- panel and collapsed-icon positions persist locally;
- the implementation is structured as the first module-widget pattern so future modules can use the same panel → branded-icon behavior.

### Existing 3.8.21 layers retained
- GPT / Claude / Gemini / DeepSeek agents with roles;
- parallel per-thread task execution and serialized canvas mutation commits;
- external normal ChatGPT Live Presence;
- agent pills/tethers and colored worker wisps;
- Figma/GitHub modules;
- browser canvas-lock / Interact mode;
- code/preview splitter + preview-only;
- full-project Main GPT memory/map;
- PDF/Jarvis/vector/BUILD MODE/durable save.

### Static verification completed for 3.8.22
- manifest version = 3.8.22;
- fixed manifest key preserved;
- `identity` permission added;
- all extension JavaScript passes `node --check`;
- manifest JSON parses;
- editor/popup/screenshot HTML have no duplicate IDs;
- ZIP integrity passes and root manifest is present.

### Runtime verification required
1. Update from 3.8.21 and verify the project persists.
2. Open Modules → Google AI. Verify the widget opens in Google AI mode, not old DuckDuckGo inline search.
3. If no Gemini key exists, click Connect Gemini, save a valid key, and verify the module status changes to ready.
4. Ask a fresh/current question. Verify an answer returns inside the widget and grounded Google Search source chips appear when available.
5. Minimize the widget. Verify it becomes a draggable `G` icon; move it, reopen it, and verify the conversation remains visible.
6. Change the selector to Google/Bing/DuckDuckGo and verify those ordinary engines open as normal browser tabs.
7. If a Google OAuth client ID is configured in a test build, test BriefCraft Google sign-in separately; do not confuse product-account OAuth with Gemini API authentication.

Do not claim Google OAuth, Gemini keyless consumer-session access, or exact Google consumer UI parity before live verification.

## Next architecture layers
1. Generic module-widget framework for Drive/Figma/GitHub/search tools, all collapsible to branded draggable icons.
2. Production Google OAuth client + Drive module; preserve the distinction between account identity and Gemini API credentials.
3. BriefCraft Relay/Cloud for real multi-human accounts, avatars, invite links and realtime synchronization.
4. Multi-agent conflict UI: per-agent patch previews, object locks/leases, merge/rebase when agents edit the same object.
5. OWNER GitHub updater/OAuth and GitHub Jarvis commit/push/PR after explicit authorization.

## Workflow rule
Keep the proven direct GPT transport stable. Preserve the fixed manifest key forever. Be explicit about runtime-tested vs newly built behavior. Never claim remote human collaboration, provider parity or consumer-session Google AI embedding before live verification.