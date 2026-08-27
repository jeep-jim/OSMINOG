# OSMINOG — append-only project log

## READ THIS FIRST IN EVERY NEW CHAT
This file is the canonical continuation note for OSMINOG. Read it completely before changing code, publishing a build, or answering where the project stopped.

**Append-only rule:** never rewrite or delete earlier entries. Every completed or attempted update adds a new dated section at the end containing: starting state, requested work, actual changes, verification, published artifacts, unresolved problems, and the exact next action.

## Permanent product rules
- Product name: **OSMINOG**.
- Domain: **osminog.red**.
- Temporary brand mark: a plain red circle. The owner will draw and provide the final logo later.
- Do not show `BriefCraft`, `BriefCraft AI`, `BRIEFCRAFT`, or `RichCraft` in user-facing UI.
- Preserve the fixed Chrome `manifest.key`, extension ID, existing storage keys, native-host compatibility names, and legacy protocol identifiers until an explicit migration is implemented and tested.
- GitHub is the canonical project and release source. Do not ask the owner to preserve arbitrary local archives as project memory.
- Do not use Google Drive or another connected account for release storage without an explicit user request.

---

## 2026-08-27 — baseline and 3.8.62 update test

### Starting state
- The owner manually installs **OSMINOG Chrome 3.8.61** as an unpacked Chrome extension.
- 3.8.61 is the visible rebrand baseline: OSMINOG name is present and the fixed Chrome key is preserved.
- The owner intentionally does not care about local development projects during reinstall testing.
- Goal: prove the next update works through the in-product update button, without replacing folders manually.

### Requested work for 3.8.62
1. Put a **plain red circle immediately beside the OSMINOG name in the header**.
2. Implement the request supplied in the uploaded `Новый-мир.md` from Google AI:
   - add a public request/response chat bridge for canvas widgets and generated interfaces;
   - use the existing authenticated provider transports instead of exposing provider credentials;
   - route `OSMINOG_CHAT_REQUEST` messages through the selected provider;
   - preserve the legacy `BRIEFCRAFT_CHAT_REQUEST` action only as an internal compatibility alias;
   - parse and validate returned `briefcraft.patch/v1` payloads before any canvas mutation;
   - return structured success/error responses to the requesting widget.
3. Publish the result as **3.8.62**, based strictly on **3.8.61**, in the dev update channel.
4. Use the installed 3.8.61 to test `3.8.61 → 3.8.62` by pressing the product update button.

### Built changes
- `manifest.json`: version raised to 3.8.62; fixed key preserved.
- `editor.html`: old logo element beside the header name replaced with a dedicated temporary red-circle mark; OSMINOG name retained.
- `editor.css`: added the temporary red-circle header mark styling.
- `osminog-chat-bridge.js`: added the canvas/widget request-response bridge.
- `background.js`: added the background-side provider routing and compatibility listener.
- `editor.html`: loads the new bridge script.

### Required verification
- Root `manifest.json` exists and reports 3.8.62.
- Fixed manifest key is unchanged.
- Every JavaScript file passes `node --check`.
- Every JSON file parses.
- ZIP integrity passes.
- On the live 3.8.61 installation, the update button must install 3.8.62.
- After reload, the header must show a red circle next to OSMINOG and the version must read 3.8.62.
- The Google AI bridge must be tested from a canvas widget with a simple request and a structured response.

### Current next action
Publish and verify the 3.8.62 dev feed, then have the owner press the update button from the manually installed 3.8.61. Record the real runtime result in a new section below; do not modify this section.

---

## 2026-08-27 — 3.8.62 runtime result and 3.8.63 Google AI build

### Actual runtime result from 3.8.62
- The owner manually installed **OSMINOG Chrome 3.8.62** successfully.
- Chrome shows the same fixed extension ID and version 3.8.62.
- The header shows the temporary plain red circle beside **OSMINOG**.
- The in-product update button still failed before changing the installed version and displayed the obsolete fallback instruction about `INSTALL_BRIEFCRAFT_DEV.cmd`.
- This proves the product build is loadable, but does **not** prove the native updater path is working. Do not describe the button updater as fixed until a real version transition succeeds on the owner's Windows/Chrome installation.

### Requested work for 3.8.63
1. Remove the obsolete `INSTALL_BRIEFCRAFT_DEV.cmd` instruction from the updater error message.
2. Rebuild the Google AI surface using the supplied OSMINOG widget design:
   - dark indigo/black body;
   - purple command accents;
   - compact header, connected status, message bubbles, timestamps, context attachment and send controls.
3. Stop duplicate Google AI messages:
   - one user submission produces one local user turn;
   - one provider response produces one assistant turn;
   - prevent repeat submission while the request is active;
   - identify and deduplicate turns by request ID.
4. Keep Google AI traffic out of the user's visible Google AI conversation by using a dedicated inactive authenticated service tab.
5. Preserve the already working DeepSeek direct authenticated web-session transport. Do not replace it with the supplied API-key example.
6. Make `Ctrl+V` attach an image from the clipboard and, when the paste event has no image payload, fall back to the latest `briefCraftLastCachedImage` screenshot.
7. Publish a verified **3.8.62 → 3.8.63** patch fileset and prepare a complete reserve ZIP.

### Built changes in 3.8.63
- `manifest.json`: version raised to 3.8.63; fixed key preserved.
- `editor.html`: Google AI widget markup replaced with the OSMINOG-native chat surface.
- `editor.css`: isolated OSMINOG Google AI styles added from the supplied visual specification.
- `modules.js`: Google AI UI controller rebuilt with request IDs, busy lock, rendered-turn deduplication, timestamps, attachment tray, service status and connect/open controls.
- `background.js`: Google AI now uses a dedicated inactive `gemini.google.com/app` service tab and a separate connection record; repeat in-flight request IDs are rejected.
- `gpt-presence.js`: existing clipboard-image paste remains; empty-image paste now falls back to the most recent cached screenshot.
- `editor.js`: obsolete installer instruction removed; the remaining error copy only states that automatic updating is unavailable in the current dev installation.
- DeepSeek provider code and its proven hidden authenticated web-session behavior were preserved.

### Static verification
- Complete reserve ZIP contains 44 files and a root `manifest.json`.
- Manifest version is 3.8.63 and the fixed Chrome key is unchanged.
- Every JavaScript file passes `node --check`.
- Every JSON file parses.
- No duplicate HTML IDs were found.
- ZIP integrity passes.
- Applying the 8 patch operations to the 3.8.62 source produces a byte-identical 3.8.63 source tree.

### Published artifacts
- Dev feed latest version: **3.8.63**.
- Base version: **3.8.62**.
- Fileset SHA-256: `f8fc8547e22c0cb04a4e21eb7d859ec95d6af43334d6e0c7c0522b0e3df72858`.
- Fileset size: `58,303` bytes.
- Complete reserve ZIP: `OSMINOG-Chrome-3.8.63-ROOT.zip`.
- Reserve ZIP SHA-256: `3c4fc65a8b77ee0d6de019cfd2034febe58402c76bab41206768912663d2aa53`.
- GitHub Actions publication run `33104291567` completed successfully.
- Google Drive was not used for this release.

### Runtime verification still required
1. On the installed 3.8.62, press the in-product update button and check whether the version becomes 3.8.63.
2. After 3.8.63 loads, send one message through the Google AI widget and confirm:
   - the visible personal Google AI conversation receives no duplicate prompt;
   - OSMINOG displays exactly one user turn and one assistant turn;
   - the connected/service status is accurate.
3. Paste a real clipboard screenshot into the AI chat with `Ctrl+V` and confirm a preview appears.
4. With no image in the clipboard, use `Ctrl+V` after an OSMINOG screenshot/capture and confirm the latest cached screenshot is attached.

### Exact next action
- The owner presses **Update** once from 3.8.62.
- If the button fails before the installed version changes, install the complete 3.8.63 reserve ZIP manually into the same unpacked-extension folder, reload the existing Chrome extension card, and stop spending product-development time on the current Native Messaging updater implementation.
- After that failure, replace the updater architecture rather than issuing another repair script: use a single installed OSMINOG Dev Hub for development builds and platform-native release channels for production.
- In every new chat, read this file first and continue from this exact runtime test; do not ask the owner to retell the history.

---

## 2026-08-27 — 3.8.64 Google AI Mode recovery and module links

### Starting state
- OSMINOG Chrome 3.8.63 was installed manually and loaded successfully.
- The new Google AI panel rendered, but the 3.8.63 transport failed because it created a Gemini service tab while the proven working user flow was Google AI Mode on google.com.
- The Google panel still had a search-engine selector, hard-coded dark styling, weak native CSS resizing, and no module-to-canvas connection ports.
- The old Native Messaging updater remained non-functional; 3.8.64 is therefore distributed as a complete manual dev ZIP. The in-product updater button is disabled until OSMINOG Dev Hub replaces it.

### Requested work
1. Restore Google AI functionality without writing duplicate messages into the user's visible Google AI conversation.
2. Remove the search-engine selector; Google AI is the only mode.
3. Make the panel follow light and dark themes.
4. Make the panel resizable from all eight edges/corners and persist geometry.
5. Replace the selector with a compact **Связи** control that reveals eight connection ports.
6. Allow links from the Google AI module to canvas objects and agent pills; persist links and include linked context in every Google AI request.
7. Preserve the already working DeepSeek direct authenticated web-session transport.

### Built changes in 3.8.64
- `manifest.json`: version 3.8.64; fixed key preserved; explicit valid Google/Gemini host patterns added.
- `background.js`: isolated service transport changed from Gemini to a dedicated inactive Google AI Mode tab at google.com; the visible user conversation is not used for requests. The request is sent exactly once: there is no post-send retry that could duplicate a prompt.
- `provider-tab-bridge.js`: Google AI Mode composer and response selectors broadened.
- `editor.html`: search-engine selector removed; compact **Связи** button, eight module ports, eight resize handles, and link tray added.
- `editor.css`: Google panel rebuilt with light/dark variables, custom eight-direction resize surfaces, node ports, target glow, and persistent tether overlay.
- `modules.js`: full Google module controller rebuilt. Links can target canvas objects and agent pills, persist per project, render as curves, and are included in `googleAiModule.linked` context.
- The old Native Updater button is disabled and explicitly points to the future OSMINOG Dev Hub.
- Existing Ctrl+V clipboard/cached-screenshot behavior from 3.8.63 is preserved.

### Static verification required before release
- Manifest parses and reports 3.8.64.
- Fixed manifest key and extension ID remain unchanged.
- Every JavaScript file passes `node --check`.
- Every JSON file parses.
- No duplicate HTML IDs.
- ZIP integrity passes with root `manifest.json`.

### Runtime verification
1. Install 3.8.64 manually into the existing `current` folder and reload the same extension card.
2. Press **Подключить** in Google AI. OSMINOG should create a pinned inactive Google AI Mode service tab. If Google asks for login or AI Mode activation, complete it in that service tab once and press **Подключить** again.
3. Send one message and verify exactly one user bubble and one assistant bubble appear in OSMINOG, with no prompt added to the user's visible Google AI tab.
4. Switch light/dark theme and resize the panel from all edges/corners.
5. Press **Связи**, drag any of the eight ports to a canvas object and an agent pill, then send a request and verify link chips and context persist.
6. Verify DeepSeek still works unchanged.

### Exact next action
- Complete the runtime checklist above.
- If the dedicated Google AI Mode tab still fails, capture the service tab DOM/probe output and repair only the Google provider bridge; do not touch DeepSeek or reintroduce visible-chat mirroring.
- Build OSMINOG Dev Hub before the next attempt at automatic dev updates.



---

## 2026-08-28 — OSMINOG 3.9.0 TEAM OS

### Starting state
- OSMINOG 3.8.64 was installed manually and loaded successfully.
- Google AI could return a real answer, but the DOM bridge repeatedly selected an old static greeting and displayed it as a new answer.
- Existing agents were separate chats. There was no dedicated shared room in which several agents could see one transcript, respond in sequence, use project commands and hand execution to a final agent.
- Temporary/focused agents did not always receive the full compact project map in their normal chats.
- Code objects existed, but the product did not expose a dedicated Markdown workspace in the Code section.
- AI-provider and reference tabs accumulated in the main Chrome window.
- The legacy Native Messaging updater failed repeatedly; automatic dev updates remain disabled until OSMINOG Dev Hub is built.

### Owner request
1. Add a special team chat where selected AI agents communicate with each other instead of producing isolated monologues.
2. Give every agent full project context and the same read/create/set/delete/connect/browser/code/file/command capabilities.
3. Stop Google AI from repeating a stale greeting.
4. Add a complete Markdown editor under Code.
5. Add an internal browser/tab area where provider tabs can be kept away from the main Chrome window and connected to OSMINOG.
6. Preserve the working DeepSeek transport and clipboard/cached-screenshot attachments.
7. Store the complete version and an append-only continuation note in GitHub.

### Built changes
- Product version raised to **3.9.0**, codename **TEAM OS**; fixed Chrome `manifest.key` preserved.
- Added top-level **Команда / Team** mode and keyboard shortcut `5`.
- Team Room supports selected participants, 1–6 rounds, council/review/execute modes, persistent transcript, stop/clear controls and commands `/plan`, `/do`, `/review`, `/stop`, `/clear`, `/browser`, `/md`.
- Each turn receives the shared team transcript and full project context. Duplicate normalized replies trigger one correction request rather than being accepted as a new contribution.
- Execute mode asks one final agent for a validated `briefcraft.patch/v1`; OSMINOG does not claim edits without a patch. A verified patch can be staged or applied directly according to the Team setting.
- Added `OSMINOGAgentAPI` and tool-bus actions `agent_list` and `agent_message` for explicit agent-to-agent delegation.
- Every normal agent now receives the full compact project map and broad object list. Pinned objects remain the immediate priority, not a boundary.
- Added owner project-control capabilities for every agent: canvas inspection, object text/code, visual capture, browser tabs, Markdown documents, agent delegation and validated canvas patches.
- Added **Markdown Studio** inside Code mode: source editor, live preview, multiple stored documents, copy, download and create-as-code-object on the canvas.
- Added **OSMINOG Browser Hub** backed by a separate minimized Chrome service window. It can open/list/show/hide/close provider and web tabs and connect provider tabs to the existing bridges. Protected links are routed to this hub.
- Rebuilt the provider DOM bridge freshness logic: old candidates, static greetings, prompt echoes and the previously accepted answer are rejected. If a genuinely fresh answer is not found, the bridge returns an explicit error instead of repeating stale text.
- DeepSeek direct authenticated web-session code was not replaced by the supplied API-key example.
- Ctrl+V clipboard and cached-screenshot attachment flow from 3.8.64 is preserved.

### Static verification
- Complete ZIP contains **47 files** and root `manifest.json`.
- Manifest version is **3.9.0**; fixed key is unchanged.
- Every JavaScript file passes `node --check`.
- Every JSON file parses.
- No duplicate HTML IDs.
- ZIP integrity passes.
- Artifact SHA-256: `d0a8fa70ce1929688ec738a0dcfba2c1436a3c4ca403b4cd2228a6ae3f93db97`.

### Runtime verification required
1. Install 3.9.0 manually into the existing `current` folder and reload the same Chrome extension card.
2. Open **Команда**, select at least two connected agents and run one council task, then one execute task.
3. Verify each agent adds a new contribution to the same transcript and the final executor returns/applies a real patch when an edit is requested.
4. Verify a focused agent in its normal chat can inspect an unpinned project object through tools.
5. Ask Google AI three different questions. Each answer must be new; a stale greeting must never be substituted.
6. Open DeepSeek/ChatGPT/Claude/Gemini from Browser Hub, connect the provider tab, hide the service window and verify the main Chrome window remains uncluttered.
7. Open Markdown Studio in Code, save two documents, preview them and place one on the canvas.
8. Verify Ctrl+V from the system clipboard and from the latest cached screenshot.

### Exact next action
- Complete the runtime checklist above and record the real results in a new append-only section.
- Repair only the provider-specific selector if a provider DOM changed; do not replace the proven DeepSeek direct-session transport.
- Build **OSMINOG Dev Hub** before any further attempt at automatic development updates.
- Future architecture after runtime validation: object leases and merge UI for simultaneous agents; reusable team templates; provider-specific multimodal parity; local project folder as canonical workspace; signed desktop shell; Android/iOS clients; account-based collaboration and relay.

### Confirmed runtime result
- The owner manually installed **OSMINOG 3.9.0 TEAM OS** from the complete ZIP into the actual desktop folder used by Chrome and reloaded the existing extension card.
- The owner confirmed: **the build installs, opens and works**.
- This confirmation establishes 3.9.0 as the current working baseline. It does not silently mark every individual new subsystem as separately verified; Team rounds, final patch execution, Google AI freshness, Browser Hub, Markdown Studio and Ctrl+V should still be recorded individually when exercised.

### Canonical GitHub artifact
- Repository path: `artifacts/chrome/3.9.0/OSMINOG-Chrome-3.9.0-TEAM-OS-ROOT.zip`.
- SHA-256: `d0a8fa70ce1929688ec738a0dcfba2c1436a3c4ca403b4cd2228a6ae3f93db97`.
- Size: `255229` bytes.
- Files: `47`; root `manifest.json`; manifest version `3.9.0`; fixed Chrome key preserved.

### Current working rule
- Continue product development from 3.9.0.
- Do not return to the failed Native Messaging updater.
- Before the next automatic dev-update attempt, build OSMINOG Dev Hub.
- In a new chat, read this log and continue from the 3.9.0 runtime checklist.
