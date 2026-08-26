# BriefCraft AI — project state

## READ THIS FIRST IN A NEW CHAT
If the user opens a new chat and writes **«начни»**, read this file completely first and continue from **Current build / next test**. Do not ask the user to retell the project. Do not restart rejected service-tab / Cloudflare / old MCP experiments unless explicitly requested.

## Product goal
BriefCraft is a persistent visual workspace where project memory lives on the canvas. Humans and multiple AI agents work around the same briefs, notes, files, images, audio/video, PDFs, code/live previews, browser references, nodes, links, modules and revisions.

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
- 3.8.24 hardened provider bridges and polished Google AI/header/updater UI.
- 3.8.25 replaced visible DeepSeek consumer-chat prompting with direct authenticated DeepSeek Web session transport. Live user test confirmed: DeepSeek answers inside BriefCraft while nothing is written into the visible DeepSeek chat. This is now a proven runtime behavior for the tested account/session.

## Persistence rule
From 3.8.17 onward every build MUST preserve the same manifest `key`. Projects should live in the selected workspace folder / `.briefcraft.json` backups and not rely only on extension-local storage.

## Current build / next test
### BriefCraft AI 3.8.26 — Agent Relay + DeepSeek Brain Polish + Ghost/Clipboard Fix
Build created 2026-08-26:
`BriefCraft-AI-3.8.26-Agent-Relay-Ghost-Clipboard.zip`

Built directly from 3.8.25; fixed manifest key preserved.

### Agent ↔ Agent relay through a shared Note
A new app-level orchestration path detects requests such as `познакомься с другим агентом через записку, по очереди, не больше 5 сообщений`.
- the current pinned/selected Note becomes the shared conversation surface;
- BriefCraft finds another agent, preferring one tethered to the same Note;
- agents alternate short replies through their own configured providers;
- each reply is capped to a short phrase and is written directly into the same Note as `Agent name → reply`;
- the requested maximum turn count is respected (default 5, hard-capped at 10);
- the flow does not rely on a model spontaneously understanding how to call another agent;
- provider ghosts/status follow the agent currently taking the turn.

This new relay requires live verification with at least GPT + DeepSeek.

### DeepSeek reliability / tool discipline
- direct DeepSeek hidden-session transport from 3.8.25 is retained;
- hidden provider history is now compact instead of storing repeated giant decorated BriefCraft contexts, reducing prompt bloat on later turns;
- one automatic direct-session retry is attempted after a transient DeepSeek web failure;
- explicit DeepSeek edit commands receive up to two patch-correction retries instead of one;
- consumer DeepSeek chat remains untouched by BriefCraft traffic.

### Provider color consistency
- thread provider color is re-derived at render time;
- canvas agent pills now set both `--pill-color` and `--agent-color` from the selected provider;
- pill mascot, tether, chat identity and working ghost therefore use one provider color source.

### Ghost visual polish
- removed the sharp triangular ghost “legs”;
- agent mascots now have a smooth rounded/wavy lower edge and more opaque provider-tinted body;
- dark-theme contrast is increased;
- idle worker ghosts float slowly and work-state motion is calmer;
- the same visual language is reused for mini/chat/canvas ghosts.

### Clipboard / cached image attachment repair
- importing any image onto the canvas now refreshes `briefCraftLastCachedImage`;
- the chat attachment menu adds **Изображение из буфера** using Clipboard API;
- **Изображение из кэша** checks the existing capture/cache keys and, as a fallback, the currently selected canvas image;
- Ctrl+V in the chat accepts clipboard image files, `data:image/...` text and data-image HTML;
- a document-level paste fallback handles cases where the chat panel has focus but the textarea does not;
- `clipboardRead` permission is added for the explicit clipboard button.

Important: GPT remains the proven multimodal provider. This build repairs image attachment ingestion/UI; it does not claim DeepSeek/Claude/Gemini multimodal parity.

### Static verification completed for 3.8.26
- manifest version = 3.8.26;
- fixed manifest key preserved;
- all extension JavaScript passes `node --check`;
- manifest JSON parses;
- editor/popup/screenshot HTML contain no duplicate IDs;
- ZIP integrity passes and root manifest is present.

### Runtime verification requested
1. Update from 3.8.25 and verify project persistence.
2. Keep Main on DeepSeek and another agent on GPT; tether both to the same Note.
3. Ask one of them: `познакомься с другим агентом через эту записку, по очереди, не больше 5 сообщений`.
4. Verify they alternate short replies directly inside the Note and stop at the requested limit.
5. Confirm DeepSeek still does not write anything into the visible consumer DeepSeek chat.
6. Compare agent tab/pill/tether/ghost colors for GPT vs DeepSeek; they should match per provider.
7. Observe idle/work ghosts on dark theme; no triangular legs, body should remain visible and motion should be smooth near the task.
8. Import or capture an image, then test chat `+ → Изображение из кэша`, `+ → Изображение из буфера`, and Ctrl+V. Verify a preview chip appears before send.

## Next architecture layers
1. General agent-to-agent messaging tools beyond the shared-Note orchestrator (explicit agent targeting, task delegation and handoff history).
2. Provider-specific multimodal parity where technically supported.
3. Multi-agent conflict UI: object leases, per-agent patch previews and merge/rebase.
4. Production OAuth for Google Drive / Figma / GitHub and account-based modules.
5. BriefCraft Relay/Cloud for real multi-human accounts, avatars, invite links and realtime synchronization.

## Workflow rule
Keep the proven direct GPT and DeepSeek hidden-session transports stable. Preserve the fixed manifest key forever. Be explicit about runtime-tested vs newly built behavior. Never claim remote human collaboration, provider parity or new agent relay behavior before live verification.