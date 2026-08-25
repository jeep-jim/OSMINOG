# BriefCraft AI — project state

## READ THIS FIRST IN A NEW CHAT
If the user opens a new chat and writes **«начни»**, read this file completely first and continue from **Current build / next test**. Do not ask the user to retell the project. Do not restart Cloudflare/Codespaces/MCP/old service-tab experiments unless explicitly requested.

## Product goal
BriefCraft is a persistent shared visual workspace where project memory lives on the canvas. Human and AI work on the same board containing briefs, notes, files, images, code, browser/DOM captures, nodes, links and revisions.

Non-negotiable flow: **Install BriefCraft → Connect AI → Allow → work.** GPT/ChatGPT is first priority, then Gemini, DeepSeek, Claude later.

## Core architecture
AI Presence / Canvas Tool Bus is transport-independent:
- stable object IDs; canvas is source of truth
- compact selection/viewport/revision mirror
- exact get/search/read/capture calls only on demand
- structured `briefcraft.patch/v1`
- local Preview / Apply / Undo
- AI never invents an existing object ID

## Proven direct GPT transport
3.8.0–3.8.7 browser-page/service-window transport is rejected because it created visible ChatGPT surfaces.

3.8.8/3.8.9 live probes proved the extension service worker can use the already-authenticated `chatgpt.com` session directly: session/models/chat-requirements HTTP 200, access token and requirements token found, Proof-of-Work required, Arkose/WebSocket not required on the tested account, and no ChatGPT tab/window/chat created.

### 3.8.10 — proven baseline
`BriefCraft-AI-3.8.10-GPT-Direct-Chat-First-Live-Test.zip`

Live verified on 2026-08-25:
- `СВЯЗЬ` one-word test succeeded inside BriefCraft
- long ~700–1000 word response succeeded; first response in roughly 7 seconds
- no visible ChatGPT tab/window
- no new visible ChatGPT conversation in history

Transport uses the authenticated ChatGPT web backend, fresh chat-requirements, SHA3-512 Proof-of-Work and SSE. This is not a stable public API contract; keep it isolated behind Presence Core.

## Canonical brand
Canonical source: `brand/briefcraft-logo.svg`; `brand/brand.json` forbids the old blue mark.
Primary `#EEBF26`, accent `#FFE100`.

## 3.8.11 live result
Direct text transport stayed clean. Cached screenshot/direct image upload reached GPT successfully and GPT recognized the image. Resizable GPT workspace/settings worked sufficiently to continue.

## 3.8.12 live result — 2026-08-25
`BriefCraft-AI-3.8.12-Focus-Ghost-Save-UX.zip`

User live-tested:
- arbitrary image attachment and inline preview worked
- GPT could read text inside the attached image
- exact object focus context worked: a canvas image object was pinned to the chat and GPT understood its ID/context
- however GPT still sometimes answered edit commands in natural language without actually returning/applying a patch; e.g. user asked to shrink/recolor the pinned image and GPT claimed it would do so but canvas did not change
- therefore 3.8.12 proved focus/vision UX but **not reliable canvas execution**

Existing 3.8.12 UX retained as base:
- drag/drop and Ctrl+V image attachments
- arbitrary screenshots + cached screenshot shortcut
- inline image previews
- purple object eye → exact chat focus
- draggable/resizable GPT panel and pill
- AI ghost tied to Tool Bus activity
- outside-click settings close
- system UI typography
- local per-project chat history in `chrome.storage.local`
- explicit save/exit UX and autosave

## Current build / next test
### BriefCraft AI 3.8.13 — Agent Threads + Canvas Editing
Build created 2026-08-25:
`BriefCraft-AI-3.8.13-Agent-Threads-Canvas-Editing.zip`

Built on the proven no-window direct transport and 3.8.12 focus/attachment UX.

### Reliable canvas-edit execution
- Edit-intent detection now recognizes explicit Russian/English commands such as сделать/изменить/сжать/перекрасить/move/resize/edit/etc.
- Machine instruction is strict: for an explicit canvas change GPT **must** emit `briefcraft.patch/v1`; it must never claim a change happened without a patch.
- If GPT still replies only in prose, BriefCraft automatically sends one corrective follow-up in the same hidden GPT thread demanding a real patch.
- Direct-command mode is the default in this test build; staged supported patches are applied locally and remain undoable through BriefCraft history.
- Patchable object properties expanded beyond geometry/style/text to include code, browser URL/snapshot properties, shape/button properties and image display properties.
- Code objects can be edited through `code` patches.
- Image objects expose `imageFilter`, `imageFit`, and `imageBlendMode`; e.g. `brightness(0) invert(1)` can render opaque image pixels white while preserving transparency.
- Object detail supplied to GPT exposes these editable fields so the model can form supported patches.

### Main chat + temporary agent chats
- One permanent **Главный** chat remains the broad project-aware thread.
- `+` creates temporary focused agent chats; each has independent local history and an independent hidden GPT conversation thread keyed by project + thread ID.
- Focused agents receive compact context centered on their tethered objects and task instead of wandering through unrelated canvas content.
- Agent chats can be renamed by double-click and removed; main chat cannot be removed.
- Main agent uses canonical gold identity; temporary agents cycle through distinct purple/cyan/pink/green/orange/red/blue identities.

### Chat ↔ object tethers
- Existing object-eye → chat pin remains.
- New direction also works: drag the colored ghost/icon of a chat thread onto a canvas object to tether that chat to the object.
- A chat can tether to multiple objects (up to bounded focus count).
- Tethers are rendered as transparent animated dashed Bézier threads from the chat tab to each object.
- Tethers can be detached through the focus-chip × in the active chat.
- Inactive agent threads retain their tether metadata locally so their threads remain visible while switching chats.

### Agent ghosts
- The moving AI ghost inherits the active chat/agent color.
- Main ghost is visually distinct from temporary agents.
- The object being inspected/edited highlights in the active agent color.
- Different chat tabs show different ghost identities/colors so the user can tell which agent is active.

### Chat appearance / light theme
- Settings now include editable colors for chat panel background, user bubbles, GPT bubbles and composer field.
- Values persist per project in local storage.
- **По теме** resets to theme-aware defaults.
- Light-theme defaults are explicitly light instead of the previous gray/dark-looking chat surfaces.
- Theme changes reapply defaults when no custom colors are set.

### Important future direction — self-editing BriefCraft
User wants an eventual mode where an agent inside BriefCraft can edit BriefCraft’s own source/repository through an explicitly authorized GitHub tool/connector, including design and code changes. This is **not yet enabled in 3.8.13**. Current direct web GPT transport does not automatically inherit ChatGPT product connectors. The next architecture step after reliable canvas patches is to add an explicit external-tool permission layer (starting with GitHub) rather than pretending the in-app GPT already has those connector powers.

### Static verification completed for 3.8.13
- manifest version = 3.8.13
- all extension JavaScript passes `node --check`
- manifest JSON parses
- checked HTML pages have no duplicate IDs
- ZIP integrity passes
- no service ChatGPT tab/window transport reintroduced

### Runtime verification required
Test in this order:
1. Load 3.8.13; verify main gold chat tab and `+` agent button.
2. Create two temporary agents; verify distinct colors, rename one by double-click, switch between histories.
3. Drag an agent ghost/tab icon onto an existing canvas object; verify translucent tether appears.
4. Attach two objects to one agent; switch away/back; verify tethers persist; detach with ×.
5. On a tethered image ask `сожми его по ширине в два раза`; verify the actual object width changes, not just a prose reply, and Undo restores it.
6. Ask `перекрась изображение полностью в белый`; verify a supported image display patch is applied.
7. Pin a code object and ask for a small code edit; verify code changes and preview rerenders.
8. In settings change panel/user/GPT/composer colors; reload and verify persistence; reset **По теме** and inspect light theme.
9. Observe that the moving ghost/highlight uses the active agent color.

Do not claim these new 3.8.13 runtime behaviors are proven until the user tests them live.

## Workflow rule
Keep the proven direct text/multimodal transport stable. Fix runtime issues by layer. Never regress to browser-page automation and never claim live behavior is solved before user verification.