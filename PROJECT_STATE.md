# BriefCraft AI — project state

## READ THIS FIRST IN A NEW CHAT
If the user opens a new chat and writes **«начни»**, read this file completely first and continue from **Current build / next test**. Do not ask the user to retell the project. Do not restart rejected service-tab / Cloudflare / old MCP experiments unless explicitly requested.

## Product goal
BriefCraft is a persistent visual workspace where project memory lives on the canvas. Humans and AI work around the same objects: briefs, notes, files, images, audio/video, PDFs, code/live previews, browser references, nodes, links, revisions and agent threads.

Core rule: canvas is source of truth; object IDs are stable; AI reads only needed data through Canvas Tool Bus and edits through `briefcraft.patch/v1` with Preview/Apply/Undo.

## Proven transport / execution
- 3.8.8–3.8.10 proved direct authenticated ChatGPT web-session transport with no visible service tab/window/new visible ChatGPT conversation.
- 3.8.11 direct multimodal image upload worked.
- 3.8.12 object focus + clipboard/drop attachments worked.
- 3.8.13 introduced main + temporary agent chats and tethers.
- 3.8.14 live-tested real canvas patches and complex build-from-brief workflows using code + live preview.
- 3.8.17 restored BUILD MODE and introduced durable save plus a fixed manifest `key`. Preserve that exact key forever so unpacked dev builds keep one Chrome extension ID.
- 3.8.18 added folder-first dark onboarding, whole-project Main GPT context, PDF overlay editing, direct PDF attachments, optional Internet Research and local-folder OWNER Jarvis.
- 3.8.19 repaired Vector Pen/Pencil editing and added version/update UI foundation.

## Persistence rule
From 3.8.17 onward every build MUST preserve the same manifest `key`. Projects should live in the selected workspace folder / `.briefcraft.json` backups and not rely only on extension-local storage. Do not delete an unpacked build before external project backup when migrating old random-ID builds.

## Current build / next test
### BriefCraft AI 3.8.20 — Live Presence + Collaboration + Agent Providers
Build created 2026-08-26:
`BriefCraft-AI-3.8.20-Live-Presence-Collab-Providers.zip`

Built from 3.8.19 and preserves the fixed manifest key, direct GPT transport, full-project memory, PDF/Jarvis, BUILD MODE, vector editor, durable save and existing agent system.

### Figma-like access model foundation
Main header now has **Доступ** with project-local sharing state:
- visibility: invite-only or anyone-with-link;
- link role: view / comment / edit;
- local invitation list by name/email/nick with per-member roles;
- AI participant section with role view/comment/edit.

Important truth: this build stores the sharing/role model in the project but does **not** yet provide human cross-device realtime collaboration. Real person-to-person invite/link sessions require a BriefCraft Relay/Cloud identity + synchronization layer. Do not claim remote human collaboration works yet.

### External Main ChatGPT Live Presence
The original product goal is restored as a real path:
- **Подключить текущий ChatGPT** finds an already-open `chatgpt.com` / `chat.openai.com` tab; BriefCraft never creates a new tab for this;
- the existing `chatgpt-lite-bridge.js` is injected/configured in that chosen ChatGPT tab;
- manually sent messages in that external ChatGPT receive current compact BriefCraft context;
- context contains project/revision/canvas/object map/selection/recent changes and project-wide memory data available through existing Tool Bus;
- external ChatGPT can return `briefcraft.request/v1`; BriefCraft executes requested local tools and returns results/crops;
- external ChatGPT can return `briefcraft.patch/v1` only when its assigned role is `edit`; view/comment roles cannot mutate the canvas;
- external patches are staged through normal BriefCraft review/apply flow.

This is the first 3.8.x build reconnecting the normal ChatGPT conversation to the modern Canvas Tool Bus. Runtime verification is still required; do not claim it is proven until the user tests it live.

### Temporary agent pills / tether routing
- temporary agent chats have draggable pills directly on the world/canvas;
- Main chat gets a pill when it has tethered objects;
- pill position persists per thread;
- tethers originate from the agent pill instead of stretching to the large chat panel, making temporary agents spatially placeable near their tasks;
- clicking a pill switches to that chat; each pill carries the agent color/wisp and provider badge.

### Per-agent provider architecture
Each chat thread stores its own provider selection:
- **GPT** — existing direct authenticated ChatGPT-session transport, no API key;
- **Gemini** — owner/user supplies a Gemini API key stored locally; adapter targets Gemini 2.5 Flash and preserves BriefCraft request/patch protocol;
- **DeepSeek** — owner/user supplies a DeepSeek API key stored locally; adapter uses the DeepSeek chat-completions path and preserves the same BriefCraft request/patch protocol.

Provider keys are stored in local extension storage and required host permission is requested explicitly when that provider is enabled.

Important limitations:
- Gemini/DeepSeek adapters in 3.8.20 are new and require live testing;
- they are currently text + Canvas Tool Bus adapters; GPT remains the proven multimodal/PDF path;
- agent providers can differ per chat, but **true simultaneous concurrent execution of multiple agent requests is not yet enabled** because the current in-app agent pipeline still has one global busy/execution state. Do not claim parallel autonomous work yet.

### Browser/code object interaction repair
To stop embedded pages from hijacking canvas gestures:
- browser objects are **canvas-locked by default** with an input shield over the iframe;
- mouse wheel/zoom gestures therefore reach BriefCraft canvas rather than the embedded site;
- explicit **Interact** toggles direct iframe interaction when the user actually wants to click/scroll the page;
- switching back returns gesture ownership to the canvas;
- browser/code outer objects retain normal resize handles.

Code objects now also support:
- draggable code/preview splitter;
- persisted split percentage;
- **preview-only** mode that hides source code and leaves the visual result.

### Agent ghost targeting
Patch/working ghost targeting is hardened: prefer the actual edited object, pinned object, selected object, or first create location instead of falling back to a generic screen corner. Existing wisp/work states remain.

### Static verification completed for 3.8.20
- manifest version = 3.8.20;
- fixed manifest key from 3.8.17 preserved;
- `tabs` permission added for choosing the already-open external ChatGPT tab;
- all extension JavaScript passes `node --check`;
- manifest JSON parses;
- editor/popup/screenshot HTML have no duplicate IDs;
- ZIP integrity passes and root manifest is present;
- no service ChatGPT tab/window transport was reintroduced.

### Runtime verification required
1. Load 3.8.20 and verify project survives the fixed-ID update.
2. Open **Доступ** and inspect invite/link roles; remember human remote sync is only a permission-model foundation in this build.
3. Open the exact normal ChatGPT conversation you want to use, then in BriefCraft choose AI participant role **Редактировать** and press **Подключить**. In that normal ChatGPT ask: `Что сейчас находится на полотне?` Verify it answers from live BriefCraft context without a new tab.
4. Ask external ChatGPT for an object/crop it needs and verify request/result loop works. Then ask for a simple edit and verify a staged patch appears only with edit role.
5. Create two temporary agent chats, drag their pills to different canvas regions, tether objects and verify lines originate from the pills and persist.
6. Keep one agent on GPT. Configure another for Gemini with a key and another for DeepSeek with a key; test simple text + canvas read/patch tasks separately. Do not test them simultaneously yet.
7. Put the pointer over a Browser object and wheel/zoom: canvas should keep control while locked. Press **Interact** only when page interaction is needed.
8. Resize Browser/Code objects; drag code/preview splitter; switch a code object to preview-only and back.
9. Trigger inspect/edit work and verify wisp/work ghost starts near the relevant task/object rather than a top corner.

## Next architecture layers
1. **BriefCraft Relay/Cloud** for real multi-human collaboration, durable invite links, accounts/avatars/presence and live synchronization.
2. **Concurrent agent scheduler** so GPT/Gemini/DeepSeek agents can genuinely run tasks in parallel with isolated busy/tool/patch state.
3. **OWNER GitHub updater/OAuth** for private `jeep-jim/BriefCraft`: release check → changelog/diff → backup source folder → write approved update → reload. Ordinary public users must update through Chrome Web Store.
4. **GitHub Jarvis** after explicit owner authorization: read/write/diff/commit/PR from inside BriefCraft. Current Jarvis edits only the explicitly selected local source folder.

## Workflow rule
Keep the proven direct GPT text/multimodal transport stable. Preserve the fixed manifest key forever. Be explicit about runtime-tested vs newly built behavior. Never regress to browser-page service automation and never claim remote human collaboration, non-GPT multimodal parity or parallel agents before they are actually verified.