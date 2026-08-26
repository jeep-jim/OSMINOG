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
- 3.8.17 restored BUILD MODE and introduced durable save plus a fixed manifest `key`. Preserve that exact key forever.
- 3.8.18 added folder-first dark onboarding, whole-project Main GPT context, PDF overlay editing, direct PDF attachments, optional Internet Research and local-folder OWNER Jarvis.
- 3.8.19 repaired Vector Pen/Pencil editing and added version/update UI foundation.
- 3.8.20 added external normal-ChatGPT Live Presence, Figma-like sharing-role model, agent pills, per-agent GPT/Gemini/DeepSeek provider selection, browser interaction lock and code preview-only/split controls.

## Persistence rule
From 3.8.17 onward every build MUST preserve the same manifest `key`. Projects should live in the selected workspace folder / `.briefcraft.json` backups and not rely only on extension-local storage.

## Current build / next test
### BriefCraft AI 3.8.21 — Multi-AI Team + Roles + Parallel Tasks + Modules
Build created 2026-08-26:
`BriefCraft-AI-3.8.21-Multi-AI-Team-Modules.zip`

Built directly from 3.8.20; fixed manifest key preserved.

### Per-agent AI roles
Every thread/agent now stores both a provider and a role. Available roles:
- Универсал
- Верстальщик / DOM-CSS
- Копирайтер / ТЗ-тексты
- Исследователь / web research
- Дизайнер
- Кодер

Role instructions are injected into that agent's prompt/context. Provider and role are visible on agent pills/settings. Roles are advisory specialization; they do not bypass canvas permissions.

### Provider identity / colors
Provider color identity is now explicit:
- GPT — green (`#22c55e`)
- Claude — orange (`#f97316`)
- Gemini — blue-violet (`#6366f1`)
- DeepSeek — cyan (`#06b6d4`)

Switching provider recolors that agent/pill/worker ghost so simultaneous agents are visually distinguishable.

### Claude adapter
3.8.21 adds a real Anthropic Messages API adapter for Claude using an owner/user-supplied API key stored locally. It follows the same BriefCraft request/patch protocol as Gemini/DeepSeek. This adapter is new and requires live testing before claiming runtime parity.

### Parallel agent scheduler
The previous global busy lock is no longer the only execution state. Each thread has its own task state, so the user can:
1. send a task to one agent;
2. switch to another thread;
3. send a second task while the first provider request is still running.

Provider generation/research/tool-read work can therefore proceed concurrently across threads. Canvas patch commits are intentionally serialized through a short commit queue so two agents do not overwrite shared canvas state at the exact same instant. This is real parallel provider work with safe serialized mutations, not unrestricted patch races.

Each running thread exposes its own status and a colored worker wisp near the task. The UI no longer needs one global busy state to prevent switching agents.

### Modules / connectors foundation
Main header now includes a Modules button with a separate connector panel.

Owner-build module states:
- **Figma** — can be connected with a personal access token; token is verified against `api.figma.com/v1/me` and kept local.
- **GitHub** — can be connected with a personal access token; token is verified against `api.github.com/user` and kept local.
- **Google Drive** — explicitly reports that OAuth client configuration is required; no fake cookie-based connection is claimed.
- **Quick Search** — floating no-AI-cost web search panel. Inline results use the existing DuckDuckGo HTML search path and clearly say so; a separate button opens the same query in Google.

Connected module tokens are never inserted into GPT context. AI receives only sanitized connection status.

New module Tool Bus calls:
- `module_status`
- `figma_fetch_file` — reads a Figma file by file key/depth when Figma is connected.
- `github_fetch_file` — reads a repository file by `owner/repo`, path and ref when GitHub is connected.

These tools are available to BriefCraft agents through the existing `briefcraft.request/v1` loop. Google Drive data access is not enabled until a real OAuth client is configured.

### Existing 3.8.20 layers retained
- external normal ChatGPT Live Presence with view/comment/edit roles;
- project-local sharing/invite/link-role model (remote human realtime still requires Relay/Cloud);
- draggable agent pills and tethers;
- browser iframe canvas-lock / explicit Interact mode;
- code/preview splitter and preview-only mode;
- full-project Main GPT memory/map;
- PDF/Jarvis/vector/BUILD MODE/durable save.

### Static verification completed for 3.8.21
- manifest version = 3.8.21;
- fixed manifest key preserved;
- all extension JavaScript passes `node --check`;
- manifest JSON parses;
- editor/popup/screenshot HTML have no duplicate IDs;
- ZIP integrity passes and root manifest is present;
- no service ChatGPT tab/window transport was reintroduced.

### Runtime verification required
1. Update from 3.8.20 and verify project persistence.
2. Create three temporary agents. Configure e.g. Claude + Верстальщик, GPT + Копирайтер, Gemini + Исследователь. Verify provider colors/role labels on pills.
3. Add Claude/Gemini API keys and test each separately first.
4. Start a longer task in Claude, switch to GPT and start another before Claude finishes, then start Gemini. Verify each thread shows its own busy/status and answers land in the correct local history.
5. Test two simultaneous canvas-edit tasks on different objects in Direct mode. Provider work should overlap; actual canvas patch application should serialize safely.
6. Open Modules. Connect Figma/GitHub tokens and verify status. Test `module_status`, then a simple Figma/GitHub file read through an agent.
7. Open Quick Search, search a query, verify inline web results and Google external-search button.
8. Confirm Google Drive honestly remains unconnected until OAuth is configured.

Do not claim Claude/Gemini/DeepSeek parity, real parallel runtime, module API reads or external Live Presence are proven until the user tests them live.

## Next architecture layers
1. BriefCraft Relay/Cloud for real multi-human accounts, avatars, invite links and realtime synchronization.
2. OAuth-based Google Drive module and production-grade Figma/GitHub OAuth instead of owner PATs.
3. Multi-agent conflict UI: per-agent patch previews, object locks/leases, merge/rebase when agents edit the same object.
4. OWNER GitHub updater/OAuth: release check → changelog/diff → backup → write approved update → reload.
5. GitHub Jarvis commit/push/PR after explicit owner authorization.

## Workflow rule
Keep the proven direct GPT transport stable. Preserve the fixed manifest key forever. Be explicit about runtime-tested vs newly built behavior. Never claim remote human collaboration or provider parity before live verification.