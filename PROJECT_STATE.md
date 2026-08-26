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
- 3.8.20 added external normal-ChatGPT Live Presence, sharing-role foundation, agent pills, provider architecture, browser lock and code preview-only/split controls.
- 3.8.21 added Claude, agent roles, parallel provider tasks with serialized canvas commits and Figma/GitHub modules.
- 3.8.22 added a collapsible Google AI workspace widget.
- 3.8.23 added browser-tab-first provider connection UX and Custom OpenAI-compatible AI fallback.

## Persistence rule
From 3.8.17 onward every build MUST preserve the same manifest `key`. Projects should live in the selected workspace folder / `.briefcraft.json` backups and not rely only on extension-local storage.

## Current build / next test
### BriefCraft AI 3.8.24 — Provider Bridge + Google AI Mode + UI Polish
Build created 2026-08-26:
`BriefCraft-AI-3.8.24-Provider-Bridge-Google-AI-Polish.zip`

Built from 3.8.23; fixed manifest key preserved.

### Provider tab bridge hardening
User live-tested 3.8.23 and DeepSeek was detected but did not successfully connect. 3.8.24 hardens the consumer-tab bridge:
- bridge injection is retried and the service worker polls for the content-script handshake;
- provider tabs expose a probe with composer detection diagnostics;
- disconnected message ports trigger one automatic bridge reinjection + retry on send;
- linked provider tabs are reinjected after page navigation/reload;
- DeepSeek composer matching now explicitly includes Message/DeepSeek placeholders, textareas, role=textbox and contenteditable editors;
- submit-button matching is broader and Enter-key fallback dispatches keydown/keypress/keyup;
- assistant-answer detection now combines provider-specific selectors with broader visible response/article/prose/markdown candidates;
- the main provider Connect button attempts the detected open tab directly instead of forcing a second settings step.

This remains a consumer-site DOM bridge and is **runtime-beta**. Do not claim DeepSeek/Claude/Gemini web-tab stability until live-tested.

### Google consumer AI Mode bridge
The Google workspace module now prefers the actual open Google Search AI Mode consumer tab instead of treating Gemini developer API as the primary UX.
- provider `googleai` detects `google.com/ai` and Google Search AI Mode (`udm=50`) tabs;
- the Google widget can connect that existing consumer tab and mirror prompts/answers through the same provider-tab bridge;
- if no Google AI Mode tab exists, the widget opens `https://www.google.com/ai`, waits for the tab, then attempts connection after permission is granted;
- connected Google AI Mode is tried first, connected Gemini tab second, Gemini API + Google Search grounding remains fallback;
- the external Google AI conversation is visible in the real Google tab; BriefCraft mirrors the result in the widget.

Important: Google consumer DOM is also not a stable public API. This path requires live testing.

### Google widget / module polish
- fixed a real bug that prevented the collapsed Google `G` button from being dragged: the generic drag guard rejected the button itself;
- drag now distinguishes click vs move so dragging does not reopen the widget;
- Google module icon uses the clean multicolor G without the extra white tile artifact;
- the Google AI widget now uses theme-aware variables and adapts to light and dark BriefCraft themes;
- Google AI Mode is the primary label; Gemini API is presented as fallback.

### Chat pill identity
The minimized main AI chat bubble no longer duplicates the BriefCraft product logo. It uses the same agent wisp/mascot visual language as agent tabs/pills and updates its provider label/color with the active thread.

### Header/layout polish
- module button is now a puzzle-piece SVG with a multicolor gradient outline;
- responsive breakpoints compress mode labels and secondary topbar text before controls can overlap;
- save/share/AI labels collapse to icons on narrower desktop widths;
- project width and mode switch are constrained to keep the header from colliding around 1366px-wide layouts.

### Single update button
The owner update popover no longer exposes GitHub/Releases navigation buttons.
- only one **Обновить** action is shown;
- it uses Chrome's update channel via `chrome.runtime.requestUpdateCheck()` when the extension is installed through an update-capable channel such as Chrome Web Store;
- local unpacked dev builds cannot truthfully self-install remote executable code through this button, so they report that limitation instead of pretending the update happened;
- future desktop builds should reuse the same single-button updater UX with their native updater backend.

### Static verification completed for 3.8.24
- manifest version = 3.8.24;
- fixed manifest key preserved;
- all extension JavaScript passes `node --check`;
- manifest JSON parses;
- editor/popup/screenshot HTML contain no duplicate IDs;
- ZIP integrity passes and root manifest is present.

### Runtime verification required
1. Update from 3.8.23 and verify project persistence.
2. Keep a real DeepSeek chat open, select DeepSeek agent and click the main Connect action. Verify it connects without a second redundant step, then send `ответь одним словом СВЯЗЬ`.
3. Reload/navigate the DeepSeek tab and send again; the bridge should self-reinject.
4. Open Google AI Mode (`google.com/ai`), then open the BriefCraft Google module and connect it. Send a short question and verify the same consumer conversation receives the prompt and the answer mirrors back into BriefCraft.
5. Minimize Google widget to G, drag it, and reopen; it must stay where moved.
6. Switch BriefCraft light/dark theme while Google widget is open; colors should adapt.
7. Minimize the main BriefCraft AI chat and verify the collapsed pill shows the wisp mascot rather than the BriefCraft logo.
8. Inspect the header around 1366px width; controls must not overlap.
9. Open version popover: only `Обновить` should remain. In local unpacked mode it may correctly report that the dev channel is not auto-installable; Chrome Web Store builds use Chrome Update.

## Next architecture layers
1. Provider-specific DOM diagnostics/self-healing after live DeepSeek/Claude/Gemini/Google AI Mode tests.
2. Production OAuth for Google Drive / Figma / GitHub and account-based module connections.
3. BriefCraft Relay/Cloud for real multi-human accounts, avatars, invite links and realtime synchronization.
4. Multi-agent conflict UI: object leases, per-agent patch previews and merge/rebase.
5. Native/desktop updater backend using the same one-button update UI.

## Workflow rule
Keep the proven direct GPT transport stable. Preserve the fixed manifest key forever. Be explicit about runtime-tested vs newly built behavior. Never claim remote human collaboration, provider parity, consumer-tab bridge stability or unpacked self-update before live verification.