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


### Artifact storage correction for 3.9.0
- The owner-confirmed installation and 3.9.0 runtime baseline remain valid.
- A GitHub connector attempt produced a truncated 15,008-byte binary, so that invalid file was removed and is **not** treated as the release package.
- The verified package remains `OSMINOG-Chrome-3.9.0-TEAM-OS-ROOT.zip`, expected size `255229` bytes and SHA-256 `d0a8fa70ce1929688ec738a0dcfba2c1436a3c4ca403b4cd2228a6ae3f93db97`.
- Project state, build metadata and continuation memory are stored in GitHub; a proper full binary upload remains pending and must not be claimed complete until its remote size and checksum match.

---

## 2026-08-28 — OSMINOG 3.9.1 Google return bridge + movable windows

### Confirmed runtime state from 3.9.0
- The owner confirmed that the manually installed 3.9.0 build opens and works.
- DeepSeek is connected and returns answers correctly. Preserve this proven direct authenticated web-session transport.
- Google AI receives prompts and produces a real answer in its Google AI Mode service tab, but 3.9.0 does not reliably return that answer to the OSMINOG widget.
- The first concrete UI failure was `lastGoogleAnswer is not defined`. A later request was sent to Google, but the provider bridge failed to recognize the fresh answer.
- The service tab also received oversized OSMINOG Browser Presence text and could receive repeated equivalent submissions.
- New Browser Hub, Markdown Studio, Modules and Team surfaces were not all movable/resizable. Team transcript used initials rather than provider icons.

### Requested work
1. Preserve working DeepSeek behavior.
2. Make Google AI return exactly one real answer to OSMINOG for one user submission.
3. Block duplicate equivalent Google submissions in the widget, service worker and provider tab.
4. Stop sending the full Browser Presence block into the visible Google service conversation; send only the user query, concise linked-project context and a request marker.
5. Make all newly added windows movable and resizable from eight directions with persistent geometry.
6. Add provider icons to the Team participant list and shared transcript.

### Built changes in 3.9.1
- `manifest.json`: version raised to 3.9.1; fixed Chrome key preserved.
- `modules.js`: initialized `lastGoogleAnswer`, kept the UI busy lock, used response request IDs and rejected a repeated old answer without crashing.
- `background.js`: added same-query coalescing, a dedicated Google service-tab path, concise Google context formatting and strict one-request transport. The widget no longer sends the full `bcDecoratePrompt` Browser Presence payload to Google AI Mode.
- `provider-tab-bridge.js`: upgraded to bridge V4. It anchors on the unique request marker, watches DOM mutations, accepts only fresh stable content after the prompt, strips prompt echoes, rejects static greetings and reuses the same in-flight promise for duplicate request IDs or equivalent prompts.
- `osminog-window-manager.js`: added a shared movable/resizable window system with eight resize directions and persisted geometry.
- Team, Browser Hub, Markdown Studio and Modules surfaces use the shared window manager. Google AI and GPT retain their existing dedicated drag/resize systems.
- `osminog-team.js`: participant cards and shared transcript now display real provider icons; system and owner turns have distinct visual identities.
- DeepSeek transport code was not replaced or altered.

### Static verification
- Complete ZIP contains 48 files with root `manifest.json`.
- Manifest version is 3.9.1 and the fixed Chrome key is unchanged.
- Every JavaScript file passes `node --check`.
- Every JSON file parses.
- No duplicate HTML IDs.
- ZIP integrity passes.
- Artifact SHA-256: `f614a6d6d9e9e6c32664d01db9302a6fb920ac88b6bb2513b4d6eb6d27e7d832`.
- Artifact size: 260226 bytes.

### Runtime verification required
1. Replace the files in the actual desktop folder used by Chrome with 3.9.1 and reload the same extension card.
2. Ask Google AI one short question. Confirm one prompt appears in the dedicated service tab and one answer returns to the OSMINOG widget.
3. Repeat the exact same question immediately. Confirm OSMINOG does not send a second equivalent prompt during the dedupe window.
4. Verify the Google service prompt no longer contains the full Browser Presence block.
5. Verify DeepSeek still answers normally.
6. Drag and resize Team, Browser Hub, Markdown Studio and Modules windows; reload and confirm geometry persists.
7. Verify Team participant cards and transcript show provider icons.

### Exact next action
- Install and runtime-test 3.9.1.
- If Google still produces an answer that is not returned, inspect only the Google service-tab DOM and V4 probe output. Do not modify DeepSeek.
- Continue from 3.9.1 and build OSMINOG Dev Hub before attempting automatic development updates again.

---

## 2026-08-28 — OSMINOG 3.10.0 MEDIA CREW

### Starting state and owner request
- Base: manually installed OSMINOG 3.9.1.
- DeepSeek works through the authenticated web-session transport and must remain unchanged.
- Google AI sends prompts but answer return/deduplication still needs live verification.
- Add Nano Banana, Alice and a broad image/video/music/voice provider catalog; add media attachments and Team tray; connect a normal Desktop project folder; preserve an append-only continuation note.

### Built
- Version **3.10.0**, codename **MEDIA CREW**; fixed Chrome manifest key preserved.
- Added Provider Registry with 23 chat/image/video/music/voice services: ChatGPT, DeepSeek, Google AI, Gemini, Claude, Nano Banana, Microsoft Designer, Firefly, Leonardo, Ideogram, Krea, Stability, Pixlr, Canva, Runway, HeyGen, Luma, Pika, Suno, Udio, ElevenLabs, Alice and Yandex Cloud AI Studio.
- Registry supports category filters, Browser Hub launch and selection into Media Crew. Web-only entries are not claimed as autonomous bridges.
- Team accepts files, drag/drop, clipboard images and the latest cached OSMINOG screenshot. Agent image URLs/data URLs render as chat previews.
- Added tools `provider_list`, `provider_open`, `media_crew` and Team minimize-to-tray.
- Google requests use bridge V4 with duplicate service-tab cleanup, no old keypress fallback and a root-text DOM fallback.
- DeepSeek transport preserved.
- Added Desktop-first local project root: one owner-approved directory-picker action creates/reuses an ordinary `OSMINOG` folder and persists its handle. It contains `.osminog/project-manifest.json`, `README-OSMINOG.txt`, `assets`, `exports` and the `.briefcraft.json` project file.
- Added agent tools `project_folder_status`, `project_folder_list`, `project_folder_read`, `project_folder_write` with safe relative paths.

### Verification and artifact
- 50 files; root `manifest.json`; version 3.10.0; fixed key unchanged.
- All JS passes `node --check`; all JSON parses; no duplicate static HTML IDs; ZIP integrity passes.
- ZIP: `OSMINOG-Chrome-3.10.0-MEDIA-CREW-ROOT.zip`.
- Size: `272180` bytes.
- SHA-256: `38b330e788b2cbfe95d5ea8cdfadd3d9cb62a1aa967442a44abda6da302409b4`.
- The full binary is the ChatGPT artifact; do not claim it is stored in GitHub until remote size and checksum match.

### Honest limitations
- Most new creative services currently open in Browser Hub; only existing supported transports are autonomous.
- Chrome requires one explicit owner gesture for Desktop permission.
- Google answer return, provider UIs and quotas require runtime testing.
- Automatic development updates remain disabled until OSMINOG Dev Hub.

### Exact next action
1. Install 3.10.0 into the actual Desktop extension folder and reload the existing Chrome card.
2. Test Media Crew selection, Ctrl+V/file attachments, image previews and Team tray.
3. Press Local Folder, choose Desktop once and test agent folder status/list/read/write.
4. Confirm DeepSeek regression-free.
5. Test Google: one prompt, one returned answer, no duplicate. If it fails, repair only the Google DOM bridge.
6. Build OSMINOG Dev Hub before another automatic-update attempt.

---

## 2026-08-28 — OSMINOG 3.10.1 DESKTOP STABILITY

### Confirmed problem from 3.10.0
- Opening **Команда** made all canvas files and objects disappear until the extension tab was reloaded. The cause was a Team-mode CSS rule that set `#world`, `#marquee` and `#emptyHint` to `visibility:hidden`.
- Agent progress was rendered as a body-fixed floating element near the upper-left/agent anchor instead of the purple activity strip in the chat.
- The default Main agent pill and work mascot could appear near a viewport corner.
- The approved local project folder existed on the computer but did not have a Windows-style yellow draggable representation on the OSMINOG desktop.

### Built changes
- Team mode no longer hides or disables the canvas. The Team workspace is a transparent pointer-pass-through overlay; only the movable Team window intercepts input.
- Thinking progress is rendered inside `#gptPresenceActivity`, with provider colour, elapsed time, estimated remaining time and an inline fill bar. Old floating `.ai-task-progress` elements are disabled and removed.
- Main agent defaults to the center of the current canvas viewport. Additional agents are arranged around it. User-dragged positions remain authoritative.
- Idle/tool mascot and parallel work ghost also default to the viewport center when no object target exists.
- After the owner connects the ordinary local project folder, a yellow draggable **OSMINOG** folder icon appears directly on the OSMINOG desktop. Its position persists per project.
- Double-clicking the icon opens a movable/resizable project-folder explorer backed by the real approved folder. It supports directory navigation, refresh/sync, image/audio/video/text preview and placing supported files onto the canvas.
- Folder ready/sync events keep the visual icon and file window synchronized after connection and project saves.
- Existing MEDIA CREW, Team attachments/tray, Google bridge V4 and DeepSeek authenticated web-session transport were preserved.

### Static verification
- Complete ZIP: `OSMINOG-Chrome-3.10.1-DESKTOP-STABILITY-ROOT.zip`.
- Files: `51`; root `manifest.json`; version `3.10.1`; fixed Chrome key preserved.
- All `18` JavaScript files pass `node --check`; all `9` JSON files parse; no duplicate HTML IDs; no missing local references; CSS parser reports no errors; ZIP integrity passes.
- SHA-256: `1f02ab9b770a4f18c9a14d0cdb7ed83250e82252a6f7eb3bf125bb77db735251`.
- Size: `278536` bytes.

### Honest runtime status
- The build is statically verified but the owner must confirm the Team visibility fix, inline progress position, centered agents/mascot and real folder interaction in Chrome/Windows.
- Chrome still requires one explicit owner action to grant Desktop folder access.
- Automatic dev updates remain disabled until OSMINOG Dev Hub.

### Exact next action
1. Replace the contents of the actual Desktop extension folder with 3.10.1 and reload the same Chrome extension card.
2. Open Team and confirm every canvas object remains visible without reload.
3. Send an agent task and confirm progress appears only in the purple chat strip.
4. Confirm Main and the mascot start in the viewport center, then drag Main and verify the manual position persists.
5. Connect the local folder, confirm the yellow folder icon appears, drag it, open it and place one image/text file onto the canvas.
6. Regression-test DeepSeek and Google AI.
7. Continue appending this file after every build; in a new chat read this log before changing code.

---

## 2026-08-28 — OSMINOG 3.10.2 FOLDERS & CHAT UX

### Starting state and requested work
- Base: manually installed OSMINOG 3.10.1.
- The owner requested Windows-like folders on the OSMINOG desktop, nested folders, folder minimization, cleaner collapsed Layers, Telegram-style grouped chat bubbles, long-link wrapping, visible focused agents and universal Ctrl+V screenshot insertion.

### Built changes
- Added the first virtual canvas-folder implementation with right-click creation, inline rename, nesting, object/file drop, unpacking and a bottom restore tray.
- Added grouped Telegram-style bubbles to GPT, Team and Google chats; long links and code wrap inside message bounds.
- Added focused-agent placement near the selected object while preserving study/work animations.
- Added universal Ctrl+V image extraction from clipboard files, HTML image URLs, Clipboard API and the latest OSMINOG screenshot cache.
- Preserved the DeepSeek authenticated web-session transport and Google bridge.

### Static verification and artifact
- Complete ZIP: `OSMINOG-Chrome-3.10.2-FOLDERS-CHAT-UX-ROOT.zip`.
- Files: `52`; root `manifest.json`; version `3.10.2`; fixed Chrome key preserved.
- SHA-256: `fb801c45dccb3365868de8c90a8544210d2902c61aad5c5c7338a389e3830a36`.
- Size: `292832` bytes.
- All JavaScript passed syntax checks; all JSON parsed; no duplicate static HTML IDs; no missing local references; ZIP integrity passed.

### Confirmed runtime result that required the next build
- The first folder model did not match the requested desktop behavior.
- Every virtual folder was minimized into a bottom tray, while the owner wanted only the main project folder plus a `+` control in Layers.
- Closing a virtual folder should store it inside the main project folder, not create a tray chip.
- Virtual folder icons were tied to the canvas world and therefore scaled/moved with canvas zoom and pan.
- Folder windows still lacked complete Windows-style views, per-folder sizing, search and internal moves.

### Exact next action
- Replace the first folder layer with a fixed screen-space desktop folder system and a unified Windows-style explorer.

---

## 2026-08-28 — OSMINOG 3.10.3 WINDOWS FOLDERS

### Requested work
1. Remove the bottom multi-folder tray.
2. Keep only the main project folder restore/open control and the new-folder `+` inside Layers.
3. Closing any virtual folder must store it inside the main project folder.
4. Folder icons must keep fixed desktop positions and sizes independent of canvas zoom and pan.
5. Add Windows-like views, search, sorting, double-click rename, nested folders, moves between folders and per-folder/global size settings.
6. Continue the append-only GitHub roadmap after every build.

### Built changes
- The legacy bottom folder tray, legacy world folder icons and legacy folder windows are disabled.
- Only the main project folder can be minimized. Layers now contains one project-folder control and one `+` button.
- Closing a virtual folder sets it as stored in the root project folder. It disappears from the desktop and appears inside the root explorer.
- Virtual desktop folders render in a viewport overlay using screen coordinates; canvas zoom/pan no longer scales or drifts them.
- Added a unified movable/resizable Windows-style explorer for the real project root and virtual folders.
- Added views: large icons, tiles, list and details.
- Added search, sort by name/type/date, per-folder item size, per-folder desktop icon size and apply-to-all defaults.
- Added double-click rename for virtual folders, canvas objects and real filesystem entries.
- Added nested virtual folder moves and object moves by drag/drop.
- Extended the approved project-folder API with `mkdir`, `rename`, `move` and `remove`. Physical moves use copy-then-delete because the File System Access API has no universal native move operation.
- Archived virtual folders can be restored to the OSMINOG desktop from the root explorer.
- Existing grouped chat bubbles, universal Ctrl+V image paste, DeepSeek transport, Google bridge and Media Crew are preserved.

### Static verification and artifact
- Complete ZIP: `OSMINOG-Chrome-3.10.3-WINDOWS-FOLDERS-ROOT.zip`.
- Files: `53`; JavaScript files: `20`; JSON files: `9`.
- Root `manifest.json`; version `3.10.3`; fixed Chrome key preserved.
- SHA-256: `fe2b668a53671bb91d12293456d6b1a6fc78dca5d7f8565955886606c49c010d`.
- Size: `317306` bytes.
- All JavaScript passed `node --check`; all JSON parsed; no duplicate HTML IDs; no missing local references; CSS braces balanced; ZIP integrity passed; the new `osminog-windows-folders.js` is present in the ZIP.

### Honest runtime status
- Static verification is complete; Windows/Chrome runtime verification is still required.
- Chrome still requires one explicit owner gesture for project-folder permission.
- Virtual canvas folders remain project metadata and are not silently converted into physical Windows folders.
- Automatic development updating remains disabled until OSMINOG Dev Hub is built.

### Exact next action
1. Install 3.10.3 into the actual Desktop extension folder and reload the existing Chrome card.
2. Close a virtual folder and verify it appears inside the main project folder, with no bottom tray item.
3. Minimize the main project folder and restore/open it from Layers.
4. Zoom and pan the canvas and verify folder icons retain the same screen size and position.
5. Test large icons, tiles, list and details; search; sorting; per-folder sizes and apply-to-all.
6. Rename and move virtual folders, canvas objects and real files/folders between directories.
7. Append the real runtime result to this log before the next build.

---

## 2026-08-28 — OSMINOG 3.10.4 RECOVERY PERFORMANCE

### Confirmed runtime failure in 3.10.3
- After installing 3.10.3, the editor showed a black/loading screen and Chrome became extremely slow.
- Runtime errors included `Cannot read properties of undefined (reading 'groups')`, `makePreview is not defined`, and a null `textContent` write.

### Root cause
- 3.10.3 loaded two complete folder runtimes at once: the legacy `osminog-folders-chat-ux.js` plus the new `osminog-windows-folders.js`. Both wrapped core render functions, installed global pointer listeners and watched/mutated the same DOM.
- The Windows folder runtime had a subtree MutationObserver whose callback rewrote the observed Layers subtree, a hidden-attribute observer that rewrote the observed attribute, and periodic folder polling. This produced a self-sustaining render/mutation loop and severe CPU load.
- GPT image attachments referenced `makePreview` although the helper did not exist.
- Core connection/layer rendering assumed a fully initialized project during startup.

### Built changes
- Product version raised to **3.10.4**, codename **RECOVERY PERFORMANCE**; fixed Chrome key preserved.
- Removed the legacy folder runtime and the old desktop-folder polling runtime from the loaded page and package.
- Kept one Windows-style folder engine. Removed its periodic polling and self-triggering MutationObservers. UI work is coalesced into one animation frame and project-folder connection state is event-driven.
- Added `osminog-chat-ux-lite.js` for grouped chat bubbles and universal Ctrl+V without a second folder engine.
- Added the missing `makePreview` helper for GPT image/file attachments.
- Added defensive guards for missing project, groups, connections, stale connection previews and missing DOM nodes.
- Reduced idle agent-tether refresh work and pause it when the document is hidden.
- Preserved Windows folders, Media Crew, Team, DeepSeek authenticated transport and Google bridge.

### Verification and artifact
- Complete ZIP: `OSMINOG-Chrome-3.10.4-RECOVERY-PERFORMANCE-ROOT.zip`.
- Files: `52`; JavaScript files: `19`; JSON files: `9`.
- Root `manifest.json`; version `3.10.4`; fixed Chrome key preserved.
- SHA-256: `c30b62c5df8616589af9275e8c084ecc3c4199a50ade3a5e8df6210441cc4d55`.
- Size: `298208` bytes.
- All JavaScript passed `node --check`; all JSON parsed; no duplicate HTML IDs; no missing local references; ZIP integrity passed.
- Controlled Chromium smoke test: 3.10.3 failed to reach DOMContentLoaded within 30 seconds; 3.10.4 reached it in 0.128 seconds and produced only 2 idle DOM mutations over 1.2 seconds. This is not a substitute for the owner Windows runtime test.

### Exact next action
1. Replace the files in the actual Desktop extension folder with 3.10.4 and reload the same Chrome card.
2. Confirm the editor opens without a black screen.
3. Check Windows Task Manager/Chrome task manager at idle, then open Team and the project folder.
4. Verify the existing project, folder metadata, connections and chats load.
5. Test Ctrl+V image attachment.
6. If a runtime error remains, record its exact first stack trace before adding new features.

---

## 2026-08-28 — OSMINOG 3.10.5 DESKTOP UX & STORE

### Starting state
- Base: OSMINOG 3.10.4 RECOVERY PERFORMANCE.
- 3.10.4 restored startup speed and removed the duplicate folder engines that caused the black screen and high CPU load.
- The next UI pass was not yet released when the owner added one more required folder rule: after a virtual folder is closed into the main project folder, it must always be possible to return that folder to the OSMINOG desktop.

### Requested work
1. Keep only section icons when Layers is collapsed, with the main project folder and `+` controls at the bottom.
2. Make the main project folder draggable.
3. Let agent desktop pills be hidden, shown, collapsed and renamed; automatically show an agent when a connected node requires it.
4. Make the minimized Team bubble draggable and persist its position.
5. Add provider search, larger provider identity icons, desktop shortcuts and a separate OSMINOG Store developer-rules page.
6. Add global interface text-size presets.
7. Keep exactly 4 px between consecutive bubbles from the same participant while preserving Telegram-style grouped corners.
8. Allow **any virtual folder**—including a previously closed or nested folder—to return to the desktop.

### Built changes
- Version raised to **3.10.5**, codename **DESKTOP UX & STORE**; fixed Chrome manifest key preserved.
- Collapsed Layers shows only section icons. The project-folder control and add button remain at the bottom of the Layers rail.
- Main project folder drag no longer loses pointer events to its own button.
- Agent pills default hidden, can be shown/hidden from chat, renamed by double-click and collapsed to a compact icon. A linked object can auto-show the required agent.
- Minimized Team bubble is movable and stores its position.
- Provider Registry has search, larger service identity marks and draggable desktop shortcuts. OSMINOG Store developer rules are a separate page rather than a fake developer-mode button.
- Interface text size supports compact, normal, large and extra-large presets.
- Same-author consecutive chat bubbles keep a 4 px gap.
- Folder restoration is available in four places:
  - a visible hover button on every virtual folder inside Explorer;
  - the folder right-click menu;
  - the Explorer header action while the folder is open;
  - dragging a virtual folder out of Explorer onto the desktop.
- Restoring a folder detaches it from its parent, makes it desktop-visible, restores/clamps its last screen-space position and immediately renders its desktop icon.
- Added null-safe canvas inspector and folder preference fallbacks so the welcome/empty state does not crash before a project is active.

### Verification and artifact
- ZIP: `OSMINOG-Chrome-3.10.5-DESKTOP-UX-STORE-ROOT.zip`.
- Size: `305426` bytes.
- SHA-256: `871ddcc85ebd4d3679640fdf21a6e1a354271b06c9dbb2b1feb70b82cdb7ce08`.
- Files: `52`; JavaScript files: `19`; JSON files: `9`; root `manifest.json`; version `3.10.5`; fixed key preserved.
- All JavaScript passes `node --check`; all JSON parses; no duplicate HTML IDs; no missing local references; CSS parser reports no errors; ZIP integrity passes.
- Controlled Chromium smoke test reached DOMContentLoaded in approximately 178 ms, produced four idle DOM mutations over one second and verified close → restore through both the API and the Explorer restore button with no page or console errors.

### Honest runtime status
- Static and controlled smoke verification is complete.
- The owner still needs to verify the exact Chrome/Windows runtime, saved project migration and all visual interactions.
- Automatic development updates remain disabled until OSMINOG Dev Hub is built.

### Exact next action
1. Install 3.10.5 into the actual Desktop extension folder and reload the existing Chrome card.
2. Close a virtual folder into the main project folder.
3. Open the main project folder and restore it using the arrow button, right-click menu and drag-out gesture.
4. Verify nested folders can also be detached and restored to the desktop.
5. Verify collapsed Layers, main folder drag, agent show/hide/rename, Team bubble drag, Provider Registry search, Store page, text-size presets and 4 px chat gaps.
6. Append the real runtime result before the next build.
---

## 2026-08-28 — OSMINOG 3.10.6 CANVAS CONTROL

### Starting state
- Base: OSMINOG 3.10.5 DESKTOP UX & STORE.
- Owner confirmed 3.10.5 runs, then requested a control/placement pass.
- Windows and modules must never reopen in the upper-left corner without intent.
- Google AI must receive real canvas context, return images/cards/widgets cleanly, and stop showing the fake letter-G assistant avatar.
- Connections must be directly editable after clicking the line, including colour/width/curve controls and disconnect.
- Folder Explorer must show image previews and support drag both into and out of an open folder.

### Built changes
- Version **3.10.6**, codename **CANVAS CONTROL**; fixed Chrome manifest key preserved.
- Shared window manager tracks the latest owner click and opens unsaved windows around that action point; otherwise it centers them. Saved upper-left legacy positions are treated as bad defaults and migrated.
- Google widget now builds an expanded context containing project map, status, selection, connections and objects linked to `module:google-ai`.
- Visual/canvas questions automatically attach a fresh visible-tab screenshot when the user did not already attach an image.
- Google provider bridge returns detected answer images plus Google rich-card/widget text; the OSMINOG Google chat renders both.
- Removed the fake `G` assistant avatar from Google message bubbles.
- Connection curves now support `curvature` and `curveOffset`; the existing single-click connection selection opens the inspector where colour, width, line form, dash, arrow, curve and disconnect/delete can be edited.
- Folder Explorer renders canvas-image thumbnails immediately and lazy-loads real image-file thumbnails.
- Explorer items can be dragged back to the canvas/desktop; canvas objects can be dropped into an open virtual folder or a nested virtual-folder row.

### Artifact
- ZIP: `OSMINOG-Chrome-3.10.6-CANVAS-CONTROL-ROOT.zip`
- Size: `308710` bytes
- SHA-256: `c25b2ecfe0ab668993ba83d525fb867efc0f6161ad17e0f6c7e6019de9984f4c`
- Files: `52`
- Root manifest version: `3.10.6`
- ZIP integrity: passed

### Runtime verification required
1. Open/close Team, Browser Hub, Markdown, Modules and Provider Registry from different click locations; confirm they reopen near the action point or center and never jump to the upper-left corner.
2. Ask Google “что видишь на холсте?” and confirm the service receives project context plus a fresh screenshot and the OSMINOG widget returns the real answer.
3. Ask Google a search-style query such as weather and confirm detected rich cards/images render inside OSMINOG when present in the Google DOM.
4. Confirm assistant turns have no fake `G` avatar.
5. Click any connection line and edit colour, width, curve strength and offset; use Disconnect to remove it.
6. Open a folder containing image files and confirm thumbnails appear.
7. Drag a canvas object into the open folder and drag it back out to the canvas.

### Exact next action
- Install 3.10.6 into the actual Desktop extension folder and reload the same Chrome card.
- Record the first real Chrome runtime result before adding another large feature.


---

## 2026-08-28 — MASTER ROADMAP + canonical 3.10.6 GitHub baseline

### Starting state
- Current installed build: **OSMINOG 3.10.6 CANVAS CONTROL**.
- The owner supplied the exact currently installed ZIP because prior GitHub records contained build metadata but not the complete binary.
- OSMINOG Browser Presence was connected to the current ChatGPT and delivered a real live compact context for project `Новый мир` (`world-mtayth7j-25lhsc`).
- Product development had accumulated many subsystems; the owner explicitly stopped feature proliferation and requested a coherence/stability pass.

### Owner request
1. Create one permanent full roadmap covering history, current state and remaining work.
2. Keep that roadmap updated in Markdown in GitHub after every completed step.
3. Keep a live duplicate on the OSMINOG canvas so progress is visible in the project itself.
4. Start preserving OSMINOG builds in GitHub in the same practical style as Chernogram Room Alpha: a rolling prerelease with versioned assets.
5. Maintain a single release registry for all six planned platforms while Chrome extension is the only actively built client.
6. Treat the supplied 3.10.6 archive as the exact canonical baseline for further work.

### Verified baseline
- ZIP size: `308710` bytes.
- ZIP SHA-256: `c25b2ecfe0ab668993ba83d525fb867efc0f6161ad17e0f6c7e6019de9984f4c`.
- Files: `52`.
- Root `manifest.json`: present.
- Manifest version: `3.10.6`.
- Visible name: `OSMINOG`.
- Fixed manifest key: present/preserved.
- All 19 JavaScript files pass `node --check`.
- All 9 JSON files parse successfully.

### Project discipline added
- Added living `OSMINOG_ROADMAP.md` as the master current-state/roadmap document.
- `OSMINOG_PROJECT_LOG.md` remains append-only history.
- Added `releases/osminog-registry.json` with six platform lanes: Chrome extension, Windows, macOS, Web/PWA, Android and iOS.
- Chrome is marked `active-development`; unbuilt clients are explicitly `planned`, not falsely presented as existing binaries.
- Added rolling prerelease convention: `latest-osminog-dev` with unique platform/version asset names.
- Added a gated release workflow that will only publish the exact 3.10.6 binary after its repository artifact matches the expected byte size and SHA-256, and then verifies the remote release asset.
- Added a generic append-only project-log queue workflow for future updates.

### Current UX/stability roadmap captured
The master roadmap records the owner's eight current work areas: Layers/folder dock; provider/widget folders; unified `On` state; agent settings + Poseidon; one internal Browser/Service Session Manager; active octopus workers instead of idle desktop agent pills plus connection z-order; browser redesign; and Media Crew bulk-selection UX. Google duplicate sessions and real screenshot attachment transport are immediate technical priorities.

### Honest artifact status
- The exact owner-supplied 3.10.6 binary is verified locally.
- The rolling GitHub release workflow is prepared and gated.
- The binary is **not yet claimed as remotely archived** until the actual GitHub release asset exists and its remote size/digest match.

### Exact next action
- Publish and verify the exact 3.10.6 ZIP in the `latest-osminog-dev` rolling prerelease.
- Keep the canvas roadmap mirror synchronized.
- Then begin the Unified Provider/Session foundation in this order: status component → agent connection/settings → internal session manager → Google persistent session/multimodal/dedupe → Presence UI/runtime state.
- Do not add another large standalone feature before this coherence pass is complete.



---

## 2026-08-28 — OSMINOG 3.10.7 UPDATE BRIDGE + Dev Hub 1.1 candidate

### Starting state
- Owner is running **OSMINOG 3.10.6 CANVAS CONTROL** as the current unpacked Chrome extension.
- The update popover still showed `Dev Hub`, but 3.10.6 `oneClickUpdate()` only displayed that Dev Hub was required; it did not send a Native Messaging request.
- Earlier native updater attempts failed because they depended on a predetermined `%LOCALAPPDATA%\\BriefCraft Dev\\current` directory that did not reliably match the extension folder actually loaded by Chrome.
- The owner explicitly requested another attempt at making future development updates work from the OSMINOG update button.

### Scope rule
This is **not** a feature expansion. 3.10.7 is a dedicated update-transport bridge. Google, DeepSeek, canvas, folders, Team, Media Crew and other product subsystems are intentionally not changed in this pass.

### Built Chrome candidate — 3.10.7 UPDATE BRIDGE
- Base: exact owner-supplied 3.10.6 tree.
- Manifest version raised to **3.10.7**; fixed Chrome manifest key preserved.
- Update UI now says `Проверить и обновить` instead of the disabled/manual-update copy.
- `oneClickUpdate()` now performs the real sequence: Native Messaging `status` → `check` → `update`.
- Real Dev Hub errors are surfaced in the update popover.
- After a successful update response, OSMINOG stores the existing `briefCraftReopenAfterUpdateV1` marker and calls `chrome.runtime.reload()`.
- Existing compatibility host name `com.briefcraft.updater` is preserved so old installs do not require an extension-ID/protocol migration.

### 3.10.7 artifact verification
- ZIP: `OSMINOG-Chrome-3.10.7-UPDATE-BRIDGE-ROOT.zip`.
- Size: **313664 bytes**.
- SHA-256: `fff22fb96aa3fe3959a832e44a11794c84a1238742015813a8878293ee8ec300`.
- Files: **52**.
- Root manifest version: **3.10.7**.
- All JavaScript syntax checks pass; all JSON parses; ZIP integrity passes.
- Applying the public guarded `3.10.6 → 3.10.7` fileset to the exact 3.10.6 tree reproduces the complete 3.10.7 source tree byte-for-byte.

### Public development feed
- Public release/feed source remains `jeep-jim/chernogram_new@briefcraft-releases` so the extension/Dev Hub does not need private-repository credentials.
- New feed path: `osminog/channels/dev/chrome-extension.json`.
- Current feed latest: **3.10.7**.
- Fileset: `osminog/releases/3.10.7/fileset.json`.
- Fileset is SHA/size guarded and each modified target has before/after SHA-256 preconditions.

### OSMINOG Dev Hub 1.1 changes
- Native host upgraded to **1.1.0**.
- Old hard-coded source folder assumption removed.
- Dev Hub now attempts to locate the actual loaded OSMINOG extension by scanning Chrome profile `Preferences` / `Secure Preferences` for the preserved extension ID `hfckimbjiahikihjoceoegilaiolmkgk`, while also checking known compatible locations.
- Candidate folders are validated against the fixed manifest key and current version.
- Update staging happens beside the detected live extension directory; result version/key/hashes are checked before directory swap.
- Rollback copies are stored under `%LOCALAPPDATA%\\OSMINOG\\DevHub\\versions`.
- Routine updates require no folder picker, CMD or PowerShell.
- Native Messaging compatibility registration stays `com.briefcraft.updater` until an explicit backward-compatible migration exists.

### One-time bootstrap installer
- Installer: **OSMINOG Dev Hub 1.1**.
- Installer path target: `%LOCALAPPDATA%\\OSMINOG\\DevHub`.
- After installation it invokes Dev Hub `--update`, intended to automatically detect the currently loaded 3.10.6 directory and apply 3.10.7.
- If bootstrap succeeds, the owner only needs to press **Reload once** on the existing OSMINOG card in `chrome://extensions` so Chrome begins executing 3.10.7.
- From 3.10.7 onward, the in-product update button is wired to Dev Hub.

### Dev Hub CI verification
- GitHub Actions run: `33175649379`.
- Conclusion: **success**.
- Native host compilation: success.
- Host version/static probe: success.
- Inno Setup installer build: success.
- Installer hash step: success.
- Artifact upload: success.
- Artifact ID: `9687487683`.
- Artifact name: `OSMINOG-Dev-Hub-Setup`.
- Installer EXE size: **24031246 bytes**.
- Installer EXE SHA-256: `84b56099bd7222d4d786fbe0af7eac00ac271cb6eb2912c48d219e5794dfec8e`.

### Honest runtime status
- **3.10.7 is not yet runtime-confirmed on the owner's Windows/Chrome installation.**
- Dev Hub 1.1 CI success proves the host and installer build, not that Chrome-path auto-detection works on the owner's actual profile.
- The update button itself cannot be proven from the currently running 3.10.6 because 3.10.6 contains only the disabled placeholder handler.
- The intended proof chain is therefore:
  1. leave current 3.10.6 installed/enabled;
  2. run the one-time Dev Hub 1.1 installer;
  3. installer bootstraps 3.10.6 → 3.10.7;
  4. press Chrome Reload once and confirm OSMINOG reports 3.10.7;
  5. only then publish a minimal **3.10.8 UPDATE PROOF**;
  6. press the OSMINOG update button and prove 3.10.7 → 3.10.8 without replacing files manually.

### Exact next action
- Owner runs **OSMINOG Dev Hub 1.1** while the current 3.10.6 extension remains enabled.
- Do not manually replace extension files before this test.
- If installer reports successful bootstrap, press Reload once on the existing Chrome extension card and report the displayed OSMINOG version.
- If bootstrap fails, capture the exact installer/Dev Hub error; repair only path detection/update transport rather than adding product features.



---

## 2026-08-28 — Dev Hub 1.1.0 Desktop bootstrap failure → 1.1.1 fix

### Real runtime result
- Owner installed OSMINOG Dev Hub 1.1.0 successfully.
- The installer itself correctly installed into the separate service location under `%LOCALAPPDATA%\\OSMINOG\\DevHub`; it is not supposed to live inside the project/extension folder.
- Bootstrap failed with the installer message that the current extension folder could not be determined.
- Owner clarified that the actual unpacked OSMINOG extension folder currently loaded by Chrome is on the Windows Desktop.
- No claim is made that 3.10.6 was updated; the current extension remains 3.10.6 until the next bootstrap test succeeds.

### Root cause
- Dev Hub 1.1.0 searched Chrome Preferences/Secure Preferences and a few deterministic development locations.
- It did not scan the Windows Desktop, so a Desktop-hosted unpacked extension could remain undiscovered when Chrome Preferences did not expose a usable path.

### Fix prepared in Dev Hub 1.1.1
1. Keep normal automatic detection through Chrome Preferences first.
2. If that fails, scan direct child folders of the Windows Desktop and validate candidate `manifest.json` by OSMINOG visible name plus the preserved fixed manifest key.
3. If automatic Desktop scan also fails, show a one-time bootstrap folder picker.
4. The selected folder is validated before any update and stored in Dev Hub `config.json`.
5. Routine future updates do not ask for the folder again.
6. Dev Hub remains installed separately under `%LOCALAPPDATA%\\OSMINOG\\DevHub`; only the extension files are updated at their real loaded path.

### Verification
- First 1.1.1 CI attempt exposed an Inno Setup `String/AnsiString` compile error in `LoadStringFromFile`; no installer was published from that failed run.
- The type error was fixed.
- Final Dev Hub 1.1.1 CI run `33177530597` completed `success`: native host publish, native-host static test, Inno installer build, SHA step and artifact upload all passed.
- Produced installer artifact contains `OSMINOG-Dev-Hub-Setup.exe` plus its SHA file.

### Exact next action
- Run Dev Hub 1.1.1 over the existing installation.
- It should first detect the Desktop OSMINOG folder automatically. If not, select the currently loaded OSMINOG extension folder once when prompted.
- If bootstrap succeeds, open `chrome://extensions` and press Reload once on the same OSMINOG extension card.
- Confirm that OSMINOG reports version 3.10.7. Only after that publish 3.10.8 UPDATE PROOF and test the in-product update button end to end.



---

## 2026-08-28 — Dev Hub bootstrap 1.1.1 failed; deterministic managed update architecture adopted

### Runtime result
- Dev Hub 1.1.1 installed successfully.
- The owner explicitly selected the real OSMINOG unpacked folder on the Windows Desktop.
- Bootstrap `3.10.6 → 3.10.7` still did not complete; the installer reported that the working OSMINOG folder could not be retained/resolved.
- Therefore Dev Hub path discovery and mutation of an arbitrary existing `Load unpacked` folder is **not runtime-proven** and is no longer the target architecture.

### Decision
Stop spending development time on smarter scanning of Chrome Preferences/Desktop folders. The underlying contract is wrong: an arbitrary developer-selected unpacked source path should not be inferred by the updater.

A new canonical update architecture is adopted and documented in `docs/OSMINOG_UPDATE_ARCHITECTURE.md`.

### Development channel — Managed Dev Channel v2
- Dev Hub owns one deterministic extension root: `%LOCALAPPDATA%\OSMINOG\Chrome\current`.
- Dev Hub downloads a complete canonical version package from the GitHub development release/feed and verifies byte size, SHA-256, root manifest, version and fixed manifest key before installing it.
- The owner performs one final manual Chrome development action: load that **managed `current` folder** through `Load unpacked`.
- From that point forward the extension source path never changes and Dev Hub never asks which folder contains OSMINOG.
- Normal flow becomes: `OSMINOG update button → Native Messaging → Dev Hub → GitHub package/feed → verification → staging → backup → managed current → chrome.runtime.reload()`.
- Full immutable packages are the default recovery artifact; differential filesets may remain only as an optional optimization.

### Production channel
- Production Chrome users must not need Dev Hub for routine updates.
- Target production flow: `CI build → validation → Chrome Web Store API upload → review/publish → Chrome automatic extension update`.
- Chrome's published extension update mechanism compares versions and automatically updates installed extensions when a newer published version is available.
- Store trusted-testers/beta can be used when useful, but Store publication remains review-bound and is not the rapid local development channel.

### Explicitly retired approaches
- no repeated manual ZIP download/unpack as the intended steady-state development process;
- no repeated Desktop scanning;
- no Chrome Preferences path guessing as the primary update contract;
- no folder selection for every update;
- no more `Dev Hub 1.1.x` iterations whose main purpose is finding an arbitrary source folder.

### Exact next updater milestone
Implement **Managed Dev Channel v2**, then perform one end-to-end `UPDATE PROOF` from the OSMINOG button with:
1. no user-downloaded version ZIP;
2. no folder picker;
3. no manual file replacement;
4. verified download/staging/backup;
5. automatic extension reload;
6. visible version transition confirmed at runtime.

Until this milestone is implemented, manual ZIP replacement remains an acceptable temporary development fallback and must not block the current OSMINOG UX/stability work.



---

## 2026-08-28 — OCEAN SHELL direction + Figma source

### Starting state
- The owner manually installed **OSMINOG Chrome 3.10.7 UPDATE BRIDGE** and chose to pause updater work so product development does not keep drifting away from the main UX roadmap.
- Existing OSMINOG functionality is broad but visually fragmented: canvas, AI Presence, Team, Browser Hub, Provider Registry, Media Crew, settings and other surfaces can all compete for space as independent windows.
- The owner showed the historical 2010–2011 Yokkey/OS concept: an internet operating environment built around widgets, workspace switching, search, local/distributed content access, messages/conferences, media, editor and assistant behavior. The OSMINOG name appeared later, around 2016.

### New owner direction
The owner wants to keep the existing functionality but completely redesign the interface as a coherent deep-ocean / deep-space environment.

Core visual/product ideas supplied by the owner:
- Ocean/deep-space background with light and translucent animated plankton.
- The background/plankton already has source artwork in Figma.
- An octopus-eye control near the bottom wakes/raises the universal search layer.
- Proposed intro copy:
  - `Пробуди меня от сна`
  - `просто потянув тачскрин`
  - `я подниму с морского дна`
  - `всё, что скрывает глубина`
- The owner provided direct Figma design access: `https://www.figma.com/design/h1aG9cEdviAPA45gygUsB9/OSMINOG?node-id=0-1`.

### Figma access verification
- Figma access works through the connected Figma tool.
- File key: `h1aG9cEdviAPA45gygUsB9`.
- Page/node: `0:1`.
- The file contains multiple 390×844 mobile concepts, a 1920×1080 desktop frame, OSMINOG intro/conversation variants, weather and image-result concepts, imported historical search references and additional visual assets.
- No Figma content was changed in this step.

### Product decision
Create **Ocean Shell** as the next interface generation.

This is a shell rewrite, not a destructive engine rewrite. Preserve:
- canvas/project state and stable IDs;
- groups/nodes/connections;
- provider transports, especially proven DeepSeek;
- Team, Markdown/Code, local project folder, Browser Presence and patch semantics;
- current data/persistence compatibility until separately migrated.

Change:
- navigation/shell;
- window/surface hierarchy;
- visual language;
- motion/ambient system;
- search/command entry;
- how providers, Team, Browser, Media Crew and settings appear when idle vs. focused.

### Interaction hierarchy
1. Ocean environment / light / plankton.
2. Canvas/project graph.
3. Lightweight persistent UI only.
4. Sheets/drawers/contextual surfaces for search, settings and pickers.
5. Focus surfaces for Browser, Team, Media Crew and Code/Markdown.

The user should not normally see every major subsystem simultaneously.

### Universal search
The octopus eye becomes the wake/search trigger. Initial search modes:
- Всё
- Проект
- Объекты
- Файлы
- AI
- Web
- Код
- Media
- История

Search must also behave as a command layer and expose visible direct actions so the system does not depend on memorized commands.

### Existing eight-point UX pass
The owner's eight previously defined UX requirements remain mandatory and are now migration requirements for Ocean Shell:
1. Layers/project folder cleanup.
2. Provider/widget multi-select and transparent folders.
3. Unified green-dot `On` status.
4. Agent settings/connect redesign and Jarvis → Poseidon.
5. One internal Browser/Service Session Manager.
6. Active working octopuses instead of idle desktop agent pills; connections behind windows except during edit.
7. Browser redesign.
8. Media Crew bulk selection and shared toolbar.

### Planned interface milestones
- **3.11.0 OCEAN SHELL ALPHA** — shell tokens, ocean/plankton ambience, shell anchors, octopus-eye trigger, new surface hierarchy.
- **3.11.1 SEARCH LAYER** — universal search/command layer.
- **3.11.2 PROVIDER / SESSION LAYER** — Provider Registry, unified `On`, Session Manager, settings/connect, Google persistent session/multimodal/dedupe.
- **3.11.3 OCTOPUS WORK STATES** — working-octopus state machine, tethers, connection z-order.
- **3.11.4 FOCUS WORKSPACES** — Browser/Team/Media Crew/Code-Markdown focus surfaces.

### Global usability guardrails
Ocean Shell must be distinctive without becoming cryptic:
- progressive disclosure;
- recognition over recall;
- familiar labels/icons for common actions;
- keyboard/mouse/touch support;
- reduced-motion/static mode;
- readable contrast/scalable typography;
- no animation-dependent essential interaction;
- measurable startup/render performance budgets;
- rollback points throughout migration.

### Canonical specification
Created `docs/OSMINOG_OCEAN_SHELL.md` as the canonical design/implementation direction.

### Exact next action
- Finish reviewing the Figma source before editing production UI.
- Build a concrete Ocean UI Spec / screen hierarchy from the Figma source and the current OSMINOG functionality.
- Then start **3.11.0 OCEAN SHELL ALPHA** as a compatibility shell over 3.10.7 rather than rewriting the product engine from scratch.
- Do not lose the existing eight-point UX pass; fold every one of those requirements into the new shell.


---

## 2026-08-28 — OSMINOG 3.11.0 OCEAN SHELL ALPHA candidate

### Starting state
- Owner manually installed OSMINOG Chrome 3.10.7 UPDATE BRIDGE and Chrome confirmed version 3.10.7 on the existing extension card.
- Update work was intentionally paused after Dev Hub path-discovery failures; future development update architecture is the deterministic Managed Dev Channel v2, while production will use Chrome Web Store.
- Existing product already has a serious functional demo: canvas/project graph, groups/nodes/connections, agents, Team, Google AI, proven DeepSeek transport, Browser Hub, Provider Registry/Media Crew, Code/Markdown, local project folder, virtual folders, Store/developer surfaces and Browser Presence.
- Owner approved a generational interface redesign based on the historical Yokkey/OSMINOG operating-environment concept and the current Figma Ocean direction.

### Product decision
Ocean Shell becomes the primary OSMINOG interface generation. It is a **shell rewrite, not an engine rewrite**.

Mandatory preservation targets:
- stable canvas/project IDs and persistence;
- groups/nodes/connections and validated `briefcraft.patch/v1` execution;
- existing provider transports, especially proven DeepSeek;
- Team orchestration;
- Google AI code path for later targeted repair rather than replacement-by-design;
- Browser Hub/service tabs;
- Provider Registry/Media Crew;
- Code/Markdown;
- local project folder and virtual folders;
- Browser Presence/external AI access;
- fixed Chrome manifest key, extension ID, storage keys and compatibility protocol/native-host identifiers.

Ocean is the primary theme. Dark and Light remain supported alternatives with the same interaction grammar.

### Architecture documents
- `docs/OSMINOG_OCEAN_SHELL.md` — product/interface direction.
- `docs/OSMINOG_OCEAN_ARCHITECTURE_MAP.md` — explicit mapping of current subsystems into Ocean Shell: calm workspace, octopus-eye search, workspaces, editing, agents, Team, Provider Registry, Browser/Google sessions, Media Crew, Code/Markdown, Owner Vault, Presence/shared sight, Plugin Store, settings and themes.
- Figma source: `h1aG9cEdviAPA45gygUsB9`, Page 1 / node `0:1`.

### Built candidate 3.11.0
Base: exact 3.10.7 UPDATE BRIDGE tree.

Changes:
- manifest version raised to 3.11.0; fixed key preserved;
- Ocean added as a real third theme and one-time default migration for existing installations;
- existing theme control cycles Ocean → Dark → Light → Ocean;
- added isolated `osminog-ocean-shell.css` with Figma-derived deep-ocean gradient, light/depth/plankton ambience, submerged glass surfaces, bioluminescent active states and reduced-motion fallback;
- added isolated `osminog-ocean-shell.js` compatibility shell rather than rewriting provider/core engine files;
- added bottom octopus-eye control; click, upward drag, `/` and Ctrl/Cmd+K can open the first universal search/command surface;
- initial search modes: Всё / Проект / Объекты / Файлы / AI / Web / Код / Media / История;
- alpha commands reuse existing entry points for Team, Google AI, Live Presence/access, Media Crew/Provider Registry, Browser Hub, Markdown, modules/connections, project folder, settings/history and canvas objects;
- existing canvas object search can reveal/focus a result;
- free-text web intent uses the existing internal-browser routing path;
- current large modes/panels are visually brought into the Ocean surface language but their final migration into sheets/focus workspaces is deliberately staged for later 3.11.x passes.

### Static verification
- Candidate tree: 54 files.
- Root manifest version: 3.11.0.
- Fixed manifest key preserved.
- 20 JavaScript files pass `node --check`.
- 9 JSON files parse successfully.
- Duplicate real HTML IDs: 0.
- ZIP integrity: PASS.
- Artifact: `OSMINOG-Chrome-3.11.0-OCEAN-SHELL-ALPHA-ROOT.zip`.
- Size: 317919 bytes.
- SHA-256: `f9bad38e1cbca7ad7c8bd3cea739c16deb918bf4241753862e9ac2a7908c2bfd`.
- GitHub metadata exists in `versions/3.11.0/` and release registry. The actual binary ZIP is **not claimed as remotely archived in GitHub yet**.

### Runtime status
`runtimeVerified: false`.

A local automated Chromium attempt could not navigate the unpacked extension URL in the test environment (`ERR_BLOCKED_BY_CLIENT`), so no runtime-success claim is permitted. Owner Windows/Chrome regression is required.

### Owner runtime checklist
1. Replace files inside the current 3.10.7 unpacked folder with the 3.11.0 candidate; do not remove/re-add the extension card.
2. Press Reload in `chrome://extensions` and verify version 3.11.0.
3. Confirm the existing project/objects/state are intact.
4. Confirm Ocean appears after the one-time migration, then cycle Ocean/Dark/Light/Ocean.
5. Open the octopus eye by click/drag and keyboard shortcut.
6. Search an existing canvas object and verify reveal/focus.
7. Verify existing Team, Google AI, Live Presence, Media Crew, Browser Hub, Markdown, modules, project folder and editing entry points still open and operate.
8. Verify DeepSeek remains unchanged.
9. Verify groups/nodes/connections, drag/resize and project persistence.
10. Observe startup/CPU/GPU behavior and reduced-motion behavior.

### Exact next action
- Owner installs/tests the 3.11.0 candidate.
- Record every real regression instead of assuming preservation succeeded.
- Repair only regressions found in runtime.
- Then continue the approved Ocean migration: universal search indexing → unified Provider Registry/Session Manager + Google repair → Layers/Inspector cleanup → octopus work states/connection z-order → Team/Media/Code/Browser focus workspaces → Owner Vault/provenance → full UI/runtime Presence → Store shell APIs → Poseidon/native capabilities.
- P1–P8 remain mandatory requirements inside Ocean Shell; they are not discarded by the redesign.



---

## 2026-08-28 — OSMINOG 3.11.0 runtime load confirmed and 3.11.1 SEARCH LAYER candidate

### Starting state
- The owner installed **OSMINOG 3.11.0 OCEAN SHELL ALPHA** on the real Windows/Chrome development extension.
- Owner runtime screenshot confirms the Ocean workspace loads, the existing project opens, the Figma-derived Ocean background is visible, and the octopus-eye shell control renders.
- The owner explicitly approved the visual direction and asked to continue.
- This is a real shell/runtime-load confirmation, **not** a full regression claim for every subsystem.

### Owner request for the next version
- Continue immediately with the next Ocean build.
- Reuse the old 2011 Yokkey/OSMINOG interaction idea where the lower interface rises smoothly from the bottom with a broad rounded/curved form.
- Keep all current OSMINOG functionality intact.

### Built 3.11.1 — SEARCH LAYER
- Base: exact local 3.11.0 candidate tree.
- Manifest raised to **3.11.1**; fixed Chrome manifest key preserved.
- Only four files differ from 3.11.0:
  - `manifest.json`
  - `OSMINOG_BUILD.json`
  - `osminog-ocean-shell.css`
  - `osminog-ocean-shell.js`
- The universal search is rebuilt as a **curved bottom Ocean drawer** inspired by the interaction structure of the 2011 Yokkey/OSMINOG search concepts, without copying the old visual styling literally.
- Search query input is moved to a bottom retrieval/composer bar; category navigation remains above the results.
- Octopus eye still opens the layer; upward pull opens it and a new crest/handle can be pulled downward to submerge/close it.
- Added a subtle scrim and responsive mobile treatment.

### Real search/index coverage added
The Search Layer now indexes available live OSMINOG data through existing APIs rather than maintaining a second data model:
- canvas objects;
- local project-folder files/directories;
- OSMINOG virtual folders;
- Provider Registry services;
- AI agents;
- Markdown documents;
- Browser Hub internal tabs.

The Search Layer also shows live counts for objects/files/folders/AI/tabs/documents.

### Query actions
- Web query / URL: open inside OSMINOG Browser Hub first; external Chrome is fallback only.
- Team: prepare the query in Team Room without auto-running it.
- Google AI: prepare the query in Google AI without auto-sending it.
- Object results focus/select the existing object using its real ID.

### Interaction
- `Ctrl/Cmd+K` opens search.
- `/` opens search outside text inputs.
- Arrow keys move through results.
- Enter opens the selected/first result.
- Escape closes.
- Eye pull-up opens.
- Crest pull-down closes.
- Ocean, Dark and Light use the same Search Layer interaction grammar.
- `prefers-reduced-motion` fallback is retained.

### Static verification
- JavaScript files checked: **20**, syntax errors: **0**.
- JSON files parsed: **9**, errors: **0**.
- Real HTML duplicate IDs: **0**.
- ZIP entries: **54**.
- Root `manifest.json`: present.
- Manifest version: **3.11.1**.
- ZIP integrity: PASS.

### Candidate artifact
- File: `OSMINOG-Chrome-3.11.1-SEARCH-LAYER-ROOT.zip`
- Size: **323960 bytes**
- SHA-256: `b5039cc4d903645f2f423e6235abe6d75509d3a1c485dbbc9ae233e9d92a1c0a`
- Binary is currently supplied directly to the owner for runtime testing; do not claim it is stored as a remote GitHub release asset yet.

### Exact next action
1. Owner replaces the current unpacked 3.11.0 files with the 3.11.1 candidate and presses Reload on the existing Chrome extension card.
2. Confirm version **3.11.1** and project persistence.
3. Pull the eye upward and verify the curved bottom drawer.
4. Test live search for at least one canvas object and one existing subsystem/provider.
5. If a local project folder is connected, verify file/folder results appear.
6. Test an Internet query and confirm it opens through Browser Hub/internal service tabs by default.
7. Report any visual or functional regressions; fix those before beginning 3.11.2 Provider / Session Layer.



---

## 2026-08-28 — OSMINOG 3.11.1 runtime feedback + 3.11.2 PROVIDER SESSION LAYER

### Starting state / owner feedback
- Owner installed **3.11.1 SEARCH LAYER** and supplied a runtime screenshot.
- The Search Layer itself loaded and the live Ocean workspace remained available.
- Owner explicitly rejected the opening geometry: the search surface looked like a large panel/dome moving upward instead of being pushed out of the persistent bottom bar with the lower rounded geometry from the 2011 Yokkey/OSMINOG concept.
- Owner asked to fix only this visual emergence behavior and immediately continue with the already planned Provider / Session Layer.

### Search emergence correction in 3.11.2
- Added a persistent Ocean bottom strip.
- The octopus eye stays in the bottom strip while search opens; it no longer jumps to the top of the opened surface.
- The search surface starts compressed at the bottom-center slot and expands upward from that origin.
- Lower geometry now uses deeper rounded shoulders plus a central rounded stem/connection to the bottom strip.
- The useful 3.11.1 live search/index logic is preserved.
- Ocean remains the primary theme; Dark and Light continue to share the same interaction grammar.

### Unified Provider / Session foundation
- Added `osminog-session-manager.js` and exposed `OSMINOGSessionManager` as the shared session entry point.
- Added reusable provider session identity: by default one provider maps to one live internal Browser Hub/service tab and subsequent opens reuse it.
- Session identity is persisted and stale tab mappings are cleaned when tabs/windows disappear.
- Provider Registry launch actions now prefer the shared Session Manager rather than independently creating tabs.
- Existing Browser Hub remains the underlying Chrome/service-tab engine; this pass unifies ownership rather than introducing a second browser runtime.

### AI chat / settings UX
- Replaced duplicated header labels such as `GPT LIVE` with unified `On` / `Off` status semantics and a status dot.
- Added an immediately visible `Подключить` action for an unconnected AI chat so connection is not hidden inside settings.
- AI settings now occupy the chat workspace as a full settings surface instead of opening downward over/under the chat.
- Added icon-based brain/provider selection while retaining the existing native select as compatibility/source-of-truth for old controller code.
- Brain options now include ChatGPT, DeepSeek, Google AI, Gemini, Claude and Custom.
- Existing Provider Registry services are surfaced from the same settings context rather than maintaining a separate provider list.

### Poseidon rename
- User-facing `Jarvis` naming was changed to **Poseidon**.
- Existing internal `jarvis...` storage keys/variables remain as compatibility aliases so this UI migration does not destroy stored state.
- Provider context now exposes Poseidon while retaining a marked legacy alias where older code still depends on it.

### Google AI correctness work
- Google AI can now be selected as an agent brain and routes through the existing Google AI service transport.
- Existing Google request-id/freshness/dedupe behavior is preserved.
- Multimodal attachment handling was hardened: OSMINOG now waits for visible evidence that Google accepted the image in the composer.
- If attachment acceptance cannot be confirmed, Google send fails explicitly rather than silently sending the text prompt without the screenshot.
- This is intentionally conservative/fail-closed; Google DOM changes may therefore produce an explicit attachment error that must be repaired provider-specifically.
- **DeepSeek direct authenticated transport was intentionally not rewritten.**

### Candidate artifact
- Version: **3.11.2**
- Codename: **PROVIDER SESSION LAYER**
- Base: **3.11.1 SEARCH LAYER**
- ZIP: `OSMINOG-Chrome-3.11.2-PROVIDER-SESSION-LAYER-ROOT.zip`
- Files: **55**
- Size: **335371 bytes**
- SHA-256: `0efec9227915c14178064e17527a0755fc5e42c147871f80ae27b2a0cc1ce1bd`
- Manifest version: **3.11.2**
- Fixed Chrome manifest key: preserved

### Static verification
- 21 JavaScript files pass `node --check`.
- 8 JSON files parse.
- Real duplicate HTML IDs: 0.
- ZIP integrity: PASS.

### Honest runtime status
- **3.11.2 is not runtime-proven yet.**
- The new bottom-strip geometry is a code-level implementation of the owner's feedback and must be judged on the owner's real viewport after installation.
- Provider/session reuse, unified `On/Off`, settings surface and Google multimodal fail-closed behavior also require owner runtime checks.

### Owner runtime checklist
1. Install 3.11.2 over the same unpacked folder currently running 3.11.1 and press Chrome Reload.
2. Open the octopus eye and verify visually that the eye remains in the lower strip and the search surface feels pushed out of that strip rather than appearing as a large dome/window.
3. Verify Ocean, Dark and Light still load.
4. Open an AI chat: verify `On`/`Off` status and visible `Подключить` when disconnected.
5. Open settings: verify it occupies the chat workspace, provider icons/brain picker are visible and the broader Provider Registry is available there.
6. Open the same provider more than once and verify OSMINOG reuses the same internal Browser Hub/service session rather than creating duplicates.
7. Verify DeepSeek still works unchanged.
8. Connect Google AI, attach a screenshot and send: either Google visibly receives the image and returns a fresh answer, or OSMINOG reports an explicit attachment confirmation error; it must not silently send a text-only request when an image was required.

### Exact next action
- Owner installs 3.11.2 and sends a screenshot/notes, with the bottom emergence judged first.
- Fix any blocking 3.11.2 regression before moving on.
- If the geometry and Provider/Session foundation are accepted, continue to **3.11.3 OCTOPUS WORK STATES**: remove idle agent pills from the canvas, show active working octopuses only during tasks or explicit node pinning, add task/role states, tethers and connection z-order behavior.



---

## 2026-08-28 — OSMINOG 3.11.3 BUBBLE EYE / ENVIRONMENT

### Owner runtime state before build
- Owner is running **3.11.2 PROVIDER / SESSION LAYER** on real Windows/Chrome.
- Runtime screenshots show the Ocean workspace loading with version 3.11.2 visible, Search Layer opening, folders/provider shortcuts present and Media Crew opening.
- Full regression of all provider transports and advanced subsystems remains open; do not interpret the screenshots as proof of every subsystem.

### Owner visual feedback
- 3.11.2 still felt too much like conventional rectangular UI painted blue.
- The lower search surface still did not reproduce the intended 2011 behavior closely enough.
- Owner explicitly requested:
  - an octopus eye with a real horizontal slit rather than a generic circular eye;
  - almost transparent idle eye, red hover/active state;
  - soft bubble hover states instead of square hover boxes;
  - bubble-like provider shortcuts and folder interactions;
  - delete pop / burst with small bubbles rising upward;
  - water/turbulence feedback during drag;
  - small bubble/vortex activity around focused objects;
  - configurable plankton/bioluminescence in canvas settings;
  - reuse of selected Figma visual elements while keeping current work focused on desktop Chrome, not mobile layout.

### Figma / biological reference rule
- Figma file remains `h1aG9cEdviAPA45gygUsB9`, Page 1.
- Desktop Ocean gradient node `51:65` was inspected directly and its radial blue/depth language remains the reference.
- Several selected plankton/sea-form nodes were inspected for visual language (including comet/jelly/starburst-like translucent motifs).
- Figma mobile frames are not used as current layout specifications; only visual language/assets may be borrowed.
- The eye interaction is designed separately for desktop; the horizontal slit follows real octopus eye morphology rather than the previous circular launcher.

### 3.11.3 implementation
- Base: exact local 3.11.2 tree used for the prior candidate.
- Manifest version raised to **3.11.3**; fixed key preserved.
- Ocean eye:
  - translucent organic lens;
  - horizontal slit pupil;
  - low-opacity idle;
  - red hover/focus/open state.
- Search dock:
  - permanent bottom seabed strip retained;
  - sheet compresses toward the strip and expands from the bottom anchor instead of behaving like a detached modal;
  - mobile layout intentionally ignored in this pass.
- Bubble interaction grammar:
  - toolbar icon hover softened into bubbles;
  - canvas object selection uses liquid glow and micro-vortex;
  - folder/provider shortcut hovers use organic bubble envelopes;
  - destructive controls become red bubble controls.
- Runtime visual FX:
  - delete pop ring;
  - rising micro-bubbles;
  - drag turbulence trail;
  - small bubble release on drop.
- Ocean environment:
  - translucent plankton bubbles;
  - recreated sea-form silhouettes based on Figma visual language;
  - optional bioluminescent particles.
- Canvas settings gain `Ocean FX` controls:
  - Plankton On/Off;
  - Bubbles On/Off;
  - Sea forms On/Off;
  - Density Low/Medium/High;
  - Bioluminescence Off/Soft/Bright.
- Environmental FX are Ocean-specific; Dark/Light remain calmer alternative themes.
- 3.11.2 Provider/Session behavior and proven transports are intentionally preserved.

### Candidate artifact
- ZIP: `OSMINOG-Chrome-3.11.3-BUBBLE-EYE-ENVIRONMENT-ROOT.zip`
- Files: **55**
- Size: **337047 bytes**
- SHA-256: `797136658d01c5b636f3e79500ddf7c38ad93d9f92c9b7ba2394cbe58ceb2050`
- Manifest version: **3.11.3**
- Root manifest: yes
- Fixed key: preserved

### Static verification
- 21 JavaScript files pass `node --check`.
- 9 JSON files parse successfully.
- Real duplicate HTML IDs: 0.
- ZIP integrity: PASS.

### Honest runtime state
- 3.11.3 is **not yet owner-runtime-proven**.
- Next test must verify the eye/hover/drag/delete/plankton behavior on the owner's real Chrome installation and confirm no regression in 3.11.2 Provider/Session behavior.

### Roadmap shift
- The previously planned `3.11.3 OCTOPUS WORK STATES` moves to **3.11.4** because the owner explicitly prioritized getting the Ocean interaction material correct first.
- Focus Workspaces moves to **3.11.5**.



---

## 2026-08-29 — OSMINOG 3.11.4 LIVING EYE DOCK

### Owner runtime result for 3.11.3
- Owner installed **3.11.3 BUBBLE EYE / ENVIRONMENT** in the real desktop Chrome extension and supplied screenshots.
- The build loads, but the lower eye/dock/search node was visually rejected.
- Concrete defects visible in runtime: detached red eye capsule, separate semicircle/pedestal below the rail, full-width bottom-line artifact, duplicate eye treatment inside Search, and too many overlapping glow/blur layers.
- The useful parts of 3.11.3 remain valid: Ocean FX controls, plankton/environment language, bubble hover/delete/drag/focus direction, and desktop Chrome-first strategy.

### Updated owner Figma direction
The owner updated the Figma desktop reference and explicitly defined the intended behavior:
1. sleeping eye is nearly transparent;
2. sleeping eye emits small bubbles upward;
3. hover wakes the eye;
4. the horizontal slit follows the desktop mouse pointer;
5. click turns the eye red;
6. Search rises from the same bottom rail, not from a detached modal/pedestal.

Mobile Figma frames remain visual-language references only. Current implementation target is the **desktop Chrome extension**. Windows/macOS are expected to reuse the same spatial shell later.

### 3.11.4 implementation
- Rebuilt the bottom Ocean interaction as one long rounded seabed rail plus one centered living eye.
- Removed the 3.11.3 halo/pedestal implementation from the final CSS cascade.
- Eye idle opacity is low; shell is translucent and uses a dark horizontal slit.
- Added five lightweight sleeping bubbles that rise from the eye.
- Added pointer tracking: hover/open updates `--eye-x` and `--eye-y`, moving the iris/slit toward the pointer with clamped desktop movement.
- Hover wakes the eye without forcing the active red state.
- Search-open sets the eye red and keeps it as the single bottom anchor.
- Rebuilt Search emergence so the surface collapses into the center of the same rail and expands upward from it.
- Removed the duplicate eye icon from the bottom Search composer.
- Reduced overlapping blur/glow layers that created visible rendering artifacts.
- Search index, Provider/Session Manager, Google/DeepSeek transports, Ocean FX settings, project IDs/storage, folders, Team, Browser Hub and patch semantics remain inherited unchanged.

### Exact tree scope
Compared byte-for-byte by file path against the owner-tested 3.11.3 tree, only four files differ:
- `manifest.json`
- `OSMINOG_BUILD.json`
- `osminog-ocean-shell.css`
- `osminog-ocean-shell.js`

### Candidate artifact
- File: `OSMINOG-Chrome-3.11.4-LIVING-EYE-DOCK-ROOT.zip`
- Files: **55**
- Size: **342950 bytes**
- SHA-256: `74a9b7a760954785150de8bcaeeadca43fd4818f3659cd32acaa7f40b99ceec2`
- Manifest version: **3.11.4**
- Root manifest: yes
- Fixed manifest key: preserved

### Static verification
- 21 JavaScript files pass syntax checks.
- 9 JSON files parse.
- Real duplicate HTML IDs: 0.
- ZIP integrity: PASS.

### Honest runtime status
**3.11.4 is not yet runtime-proven.** The owner must install it on the real Chrome extension and confirm the sleeping/hover/tracking/active/lift behavior visually before this dock is considered accepted.

### Next product step after acceptance
The previously planned Octopus Work States moves to **3.11.5**. Focus Workspaces moves to **3.11.6**. Do not start those until the lower living-eye interaction is visually accepted.



---

## 2026-08-29 — OSMINOG 3.11.5 EYE REVEAL

Owner installed 3.11.4 LIVING EYE DOCK in the real Chrome extension and supplied runtime screenshots. The build loads, but the owner rejected two remaining behaviors: the permanent bottom rail in idle state and the always-visible bottom canvas tool rail when nothing is selected.

The owner provided a precise desktop Figma sequence and clarified the interaction contract:

1. **Idle:** only one nearly-transparent octopus eye is visible at the bottom center. No persistent rail. The horizontal pupil follows the desktop pointer even while sleeping.
2. **Hover:** the eye wakes/red-tints and a translucent horizontal bubble grows outward from the eye.
3. **Click:** the same eye becomes active red and the Search surface lifts vertically from that same horizontal bubble.
4. The bottom canvas `toolRail` is hidden when there is no selected object/connection/edit context.

3.11.5 was built from 3.11.4 with only the Ocean shell adapter and version metadata changed. Search index, Provider/Session Manager, Google/DeepSeek transports, Team, Browser Hub, Media Crew, folders, Presence, Ocean FX, stable object IDs and patch semantics were preserved.

Candidate artifact:

- `OSMINOG-Chrome-3.11.5-EYE-REVEAL-ROOT.zip`
- 55 files
- 344669 bytes
- SHA-256 `1473094f457ae801b48d2805e9f712523bc1264dd4df9b73909fa0c8a5d4b11f`
- manifest version 3.11.5
- fixed Chrome manifest key preserved

Static verification:

- 21 JavaScript files pass `node --check`;
- 9 JSON files parse;
- 0 real duplicate HTML IDs;
- ZIP integrity PASS.

Runtime status: **owner test pending**. Do not call the eye/hover/Search interaction proven until the owner verifies it in the real extension.



---

## 2026-08-29 — OSMINOG 3.11.6 KRAKEN DRIFT candidate

Owner installed 3.11.5 in real Chrome and confirmed the direction is closer to the latest Figma reference. Remaining visual/runtime requirements were made explicit: when Search opens, the living octopus eye must travel into the single search row and become the red search action; the extra bright/white search-row look and ugly visible scrollbar must disappear; Search and its internal result cards must be wider.

3.11.6 was built directly from the exact 3.11.5 tree, changing only `manifest.json`, `OSMINOG_BUILD.json`, `osminog-ocean-shell.css`, and `osminog-ocean-shell.js`.

Implemented in this candidate:
- living eye keeps the `idle eye → hover bubble → click lift` flow;
- on open, the same eye moves to the right edge of the one integrated search row and acts as the search trigger; the old visible `Найти` button is hidden;
- Search internal scrollbars are visually hidden while wheel/trackpad scrolling remains available;
- Search shell/result proportions are widened;
- provider shortcuts, Windows-like folder icons, root project folder icon and floating module bubble gain gentle water drift; hover pauses drift and drag-release adds damped inertia before returning to ambient movement;
- Light is now the official tropical reef/day scene with turquoise shallows, horizon, island/palms and a brighter water atmosphere;
- Dark is now the official abyss/night scene with deep gradients, bioluminescent particles and deep-sea silhouettes;
- runtime mythos metadata is introduced: Kraken = menu/brain identity, Poseidon = future premium device mode, Sirens = future custom audio-player surface. Poseidon and Sirens are explicitly marked not implemented in this build.

Artifact: `OSMINOG-Chrome-3.11.6-KRAKEN-DRIFT-ROOT.zip`  
Files: 55  
Size: 348750 bytes  
SHA-256: `712ead4d1d5c9643b72fe005247f770634259d25e3cda6519ba37b09628abe21`

Static verification: 21 JavaScript files pass `node --check`; 9 JSON files parse successfully; no real duplicate HTML IDs introduced; ZIP integrity passes. Runtime owner verification is still pending. A local Chromium 144 smoke could not be used as authoritative runtime proof because the production manifest requires Chrome 148.



---

## 2026-08-29 — OSMINOG 3.11.7 OCEAN ARC LAUNCHER

Owner installed 3.11.6 KRAKEN DRIFT in real Chrome. The build loads, but the owner changed the first-level interaction model after comparing it with 2011 Yokkey/OSMINOG references: the Kraken eye should not immediately become a large Search surface. The eye is now treated as the living menu/brain sensor.

New product rule: OSMINOG has two first-class interface modes. **Ocean** is the active living underwater shell being built now. **Space** preserves the earlier/classic OSMINOG shell for users who prefer a conventional spatial interface. Ocean has its own Day/Night variants; Space has its own Light/Dark variants.

3.11.7 candidate changes:
- Empty-canvas welcome is session-only onboarding with a round close button; once dismissed it stays hidden until a new tab/browser session.
- Ocean Kraken eye wakes by cursor proximity (approximately 17% viewport-scale radius) before direct hover.
- First-level navigation is a semicircular radial launcher: Search, Files, Team, AI, Browser, Media, Code, Settings, Store.
- Mouse wheel rotates launcher items along the arc.
- Search is now a second-level bubble selected from Kraken launcher and retains the 3.11.6 eye→search-action morph.
- Existing module/folder/window logic is preserved; Ocean adds bubble-entry motion and round close/minimize controls.
- Ocean Day scene = reef/lagoon/horizon/island. Ocean Night = abyssal bioluminescent depth. Space suppresses Ocean ambience and keeps classic Light/Dark styling.
- Existing Search index, Provider/Session Manager, Google/DeepSeek transports, Team, Browser Hub, Media Crew, folders, Presence, water drift, stable IDs and project data are preserved.

Artifact: `OSMINOG-Chrome-3.11.7-OCEAN-ARC-LAUNCHER-ROOT.zip`  
Files: 55  
Size: 354073 bytes  
SHA-256: `6bc49dddef6fa5cdd654e3ba81a2f76dc5b6306195b407e53ae222f27f608833`

Static checks: 21 JS syntax PASS; 9 JSON parse PASS; zero duplicate real HTML IDs; ZIP integrity PASS. Runtime is not claimed: local Chromium is 144 while production manifest intentionally remains `minimum_chrome_version: 148`; owner runtime test is pending.



---

## 2026-08-29 — OSMINOG 3.11.8 OCTOPUS WORK STATES candidate

Owner installed 3.11.7 in real Chrome. Kraken radial launcher and Ocean/Space mode direction loaded and were accepted, but the Ocean Day reef/lagoon/island scene was rejected; owner requested the earlier bright underwater-depth day look instead.

3.11.8 was built from the exact 3.11.7 candidate tree with a focused next Ocean pass:
- Ocean Day restored to bright underwater depth: top light, blue water column, plankton/bubbles, no reef/island/palms.
- Agent task execution no longer forces persistent canvas pills. Pills remain only for explicit linked/pinned context.
- Active tasks use worker-octopus visuals near the current object/task with inspect/work states and provider/role color.
- Added a live screen-space tether from the corresponding chat agent chip to the active worker octopus.
- Canvas connection SVG is behind objects by default; hover/selected connection raises it for editing.
- Existing Kraken Arc Launcher, Search, Provider/Session Manager, Google/DeepSeek, Team, Browser Hub, Media Crew, folders, Presence, project data and stable IDs were preserved.

Artifact: `OSMINOG-Chrome-3.11.8-OCTOPUS-WORK-STATES-ROOT.zip`  
Size: 356050 bytes  
SHA-256: `1ecfdcbe60f9af341f74ea8e553db56e0235437cecf8d9fe0d6f76880a06345f`  
Files: 55  
Static verification: 21 JS syntax PASS; 9 JSON parse PASS; 0 duplicate real HTML IDs; ZIP integrity PASS.  
Runtime status: owner test pending. Binary is not yet claimed as archived in GitHub.



---

## 2026-08-29 — OSMINOG 3.11.9 TASK ORBIT INTRO

- Owner installed 3.11.8 OCTOPUS WORK STATES in real Chrome and approved the general Ocean direction.
- Owner clarified that the awakening poem must NOT live in Search. It belongs only to the first Kraken Arc awakening/onboarding moment.
- Implemented one-time-per-tab/browser-session Kraken awakening poem using sessionStorage.
- Added localized poem variants for Russian, English, German, Spanish, Japanese and Chinese.
- Search no longer renders the poem; it keeps only the project index/summary/results/composer.
- Added Kraken Arc `Task` action.
- Added real `task` canvas object with a central task core and orbit nodes for ChatGPT, Claude, Gemini, DeepSeek, Chat, Files and Result.
- Provider nodes reuse OSMINOG Provider Registry sessions; Chat reuses Team Room; Files reuses project-folder runtime; no duplicate subsystem was introduced.
- Double-clicking task core opens Team Room and inserts the task title into the team mission field.
- Build artifact: `OSMINOG-Chrome-3.11.9-TASK-ORBIT-INTRO-ROOT.zip` · 55 files · 356012 bytes · SHA-256 `e547ad48a4f8762a03b8e3c98fd772f63a3f64285cc3b85386269b906cf842d9`.
- Static checks: 21 JavaScript syntax PASS, 9 JSON parse PASS, real duplicate HTML IDs 0, ZIP integrity PASS.
- Runtime status: candidate; owner test pending.



---

## 2026-08-29 — OSMINOG 3.11.10 OCEAN DESKTOP SHELL

Owner confirmed 3.11.9 loads in real Chrome and requested the next structural Ocean pass rather than another isolated visual patch.

Implemented in candidate 3.11.10:
- Ocean one-time desktop defaults migrate to Day depth and `plain` / no-grid; users can re-enable dots/grid manually.
- Ocean canvas inspector no longer exposes board/grid color palettes because Ocean owns its scene palette; Space keeps classic canvas color controls.
- Top-centre shell is cleared. OSMINOG identity, language and Ocean variant control move into a compact upper-left bubble cluster.
- Layers becomes a separate upper-left bubble.
- Brief / Code / Browser / Design / Team move from the top bar to a right vertical bubble rail, keeping their existing neon/icon language.
- Active/hovered workspace mode exposes radial primary sub-tools around it, reusing existing tool/runtime actions instead of duplicating engines.
- Existing top-right Access / Chat AI / Export/system controls stay in place for this pass.
- Round close/minimize bubble controls begin replacing hard square/X presentation in Ocean.
- The one-time Kraken poem remains inside the Kraken Arc and is not part of Search.
- Space remains the classic alternate interface mode.

Candidate artifact: `OSMINOG-Chrome-3.11.10-OCEAN-DESKTOP-SHELL-ROOT.zip` · 55 files · 362800 bytes · SHA-256 `ea2b19e22010f8c7ea37b3f7e7c4e4462a22e7b894fd41927dff504c0926fa23`.

Static gate: 21 JS syntax PASS, 9 JSON parse PASS, 0 real duplicate HTML IDs, ZIP integrity PASS. Owner runtime pending.



---

## 2026-08-29 — 3.11.11 SHELL POSITION FIX

Owner installed 3.11.10 and supplied a real Chrome screenshot. The intended Ocean Desktop Shell controls loaded, but the top-right utilities and newly detached shell controls visually accumulated in the upper-left. Root cause: they remained descendants of the legacy glass `topbar`; browser containing-block behavior for filtered/glass ancestors made the fixed descendants position relative to the old header instead of the viewport.

3.11.11 fixes this structurally rather than by adding more offsets. While Ocean is active, `top-left`, `layersToggle`, `modeSwitch`, and `top-actions` are physically portaled into the root `#app`. The top-right Access / Chat AI / Export utilities therefore remain top-right; identity/language/theme stay upper-left; Layers is independent; Brief/Code/Browser/Design/Team stay on the right as a separate workspace-mode rail; the existing inspector/right rail is not moved. Switching to Space restores the original DOM positions inside the classic topbar.

Artifact: `OSMINOG-Chrome-3.11.11-SHELL-POSITION-FIX-ROOT.zip` · 55 files · 363750 bytes · SHA-256 `cfbd35bdd7297c129e90067d944b20061ded39def29a2c4c3631dc639f2cd674`.

Static verification: 21 JS syntax PASS, 9 JSON parse PASS, 0 real duplicate HTML IDs, ZIP integrity PASS. Owner runtime pending.



---

## 2026-08-29 — 3.11.12 OCEAN DOCK & BUBBLE CONTAINERS

- Owner installed 3.11.11 and confirmed the portal positioning fix, but rejected the resulting Ocean shell layout as visually confusing/overloaded: identity top-left, separate mode rail right, Kraken bottom and legacy rail created too many navigation systems at once.
- New owner drawing establishes the shell contract: one bottom dock, left identity block, Kraken eye in the centre, Brief/Code/Browser/Design/Team on the right.
- Hovering a right-side mode must reveal its tools as a compact linear shelf just above the dock. Moving the pointer away or clicking empty canvas hides it. No second radial menu for tool groups.
- Selecting a canvas tool reuses the existing right inspector for that tool's settings.
- Layers remains a dedicated control inside the left dock cluster. Space mode remains unchanged.
- Ocean zoom is reduced to a compact `100%` pill; extra controls expand only on intent.
- Floating provider shortcuts, desktop folders and module bubbles gain collision separation so passive drift does not let them occupy the same space.
- Intentional provider shortcut overlap creates a persistent Ocean bubble group, analogous to an Android desktop folder/container. Folder-on-folder keeps the existing virtual-folder nesting runtime.
- Built candidate `OSMINOG-Chrome-3.11.12-OCEAN-DOCK-BUBBLE-CONTAINERS-ROOT.zip` from 3.11.11.
- ZIP: 55 files, 369631 bytes, SHA-256 `049aa1245c38495946c8a45eb712205d2f4c1c6a218562da09709d7803644487`.
- Static verification: 21 JavaScript syntax PASS, 9 JSON parse PASS, 0 duplicate real HTML IDs, ZIP integrity PASS.
- Runtime verification remains owner-pending.



---

## 2026-08-29 — OSMINOG 3.11.13 OCEAN CLARITY & PERFORMANCE

Owner installed 3.11.12 and reported a full UI freeze/hang. This was treated as P0, above visual polish.

Root-cause review of 3.11.12 found multiple feedback paths running simultaneously:
- water drift updated `style.translate` every animation frame;
- global Ocean MutationObservers watched `style/class` changes across `body`, so drift itself triggered UI/layout sync callbacks continuously;
- bubble-group MutationObserver called collision/group rendering after child mutations while `renderGroupBubbles()` itself removed/created group DOM, creating a self-triggering observer/render loop once a group existed;
- collision separation also ran every 1100ms as a global O(n²) pairwise layout pass with repeated `getBoundingClientRect()` reads/writes.

3.11.13 changes:
- removed the collision interval and self-triggering group-render observer loop;
- collision is event-driven on relevant object additions, pointer release and project open;
- water drift capped to ~25 FPS, stops hidden-tab animation work, no longer scans all drift targets every frame, and only observes relevant added nodes;
- removed global body `style/class` observation from the affected Ocean paths;
- bubble groups are now clear/clickable and open into a focused contents surface with backdrop blur and a break-group action;
- Layers restored as a detached top-left bubble;
- Inspector starts closed on idle Ocean, overlays the canvas when opened, and never shifts the bottom dock;
- heavy black dock/tool surfaces moved back toward light Ocean glass.

Artifact: `OSMINOG-Chrome-3.11.13-OCEAN-CLARITY-PERFORMANCE-ROOT.zip`  
Size: 372219 bytes  
SHA-256: `5d7f279d6b1e63c14bda39031a7b6c969ace7c4d2edc6f8d0db7aba2218073a9`  
Static checks: 21 JS syntax PASS; 9 JSON parse PASS; 0 real duplicate HTML IDs; ZIP integrity PASS. Runtime verification pending owner install.



---

## 2026-08-29 — 3.11.14 THREE THEME RESET: Ocean becomes a theme, not a second UI

Owner decision after real use of 3.11.10–3.11.13: the experimental Ocean interaction shell became visually interesting but operationally confusing. Kraken Arc, Living Eye navigation, Ocean bottom dock, bubble containers, drift/collision physics and multiple competing navigation systems made normal work harder, even for the product creator.

Canonical decision:
- OSMINOG returns to ONE familiar workspace layout for everyday work.
- Light, Dark and Ocean are three visual themes of that same layout.
- Theme control cycles Light → Dark → Ocean; Ocean uses a waves icon.
- Ocean keeps underwater depth, transparency/glass material and optional Ocean FX only.
- Ocean-specific navigation/layout runtime is removed from the active path: no Kraken Arc, no Living Eye Search shell, no Ocean bottom dock/tool shelf, no drift/collision engine, no provider bubble-container UI.
- Existing project data and useful functional objects are preserved; this is a UI/runtime simplification, not a destructive project migration.
- Compatibility `data-ui-mode` remains `space`; Ocean is now represented only by `data-theme="ocean"`.
- The next priority is to finish polish of the familiar interface and then return to core functional work: Google multimodal/session coherence, Team execution, Browser Hub/internal sessions, Media Crew, Presence, Code/Markdown/files.

Build candidate: OSMINOG 3.11.14 THREE THEME RESET
- ZIP: 55 files · 323979 bytes
- SHA-256: `4c0812846e17c0f2d96b795cdf4d22308a68cbe6ac444e2f357e459029661498`
- Static: 21 JS syntax PASS; 9 JSON parse PASS; 0 real duplicate HTML IDs; ZIP integrity PASS.
- Ocean runtime performance: no animation-frame JS loop, no collision timer, no self-triggering render MutationObserver.
- Owner runtime pending.



---

## 2026-08-29 — OSMINOG 3.11.15 OCEAN THEME HOTFIX

Owner installed 3.11.14 THREE THEME RESET and verified a runtime regression: Light/Dark workspace existed, but switching to Ocean produced a blank blue screen with the working UI missing.

Decision remains unchanged: OSMINOG has one familiar workspace layout and three visual themes — Light, Dark, Ocean. Ocean must not own a separate navigation/shell DOM.

3.11.15 hotfix:
- Ocean is now CSS-only over the standard workspace DOM/layout.
- Removed runtime creation of the full-screen `oceanAmbience` DOM layer.
- Removed any dependence on separate Ocean shell/navigation surfaces.
- Ocean changes only theme variables, underwater gradients, glass/material styling and lightweight FX preferences.
- `applyTheme()` preserves an already-open `#app` when cycling themes.
- Stale abandoned Ocean nodes are removed on init if an unpacked-extension live tab survived reload.
- No Ocean animation-frame loop, collision timer, bubble grouping or alternate interaction engine is reintroduced.

Candidate artifact: `OSMINOG-Chrome-3.11.15-OCEAN-THEME-HOTFIX-ROOT.zip`
- 55 files
- 323297 bytes
- SHA-256 `d2130d19f25a15577e7bfbf3b7bec654cd7a1d3bbe4dd6480a5fe49f3bf70ace`
- JS syntax PASS (21 files)
- JSON parse PASS (9 files)
- duplicate real HTML IDs: 0
- ZIP integrity PASS

Owner runtime pending.



---

## 2026-08-29 — 3.11.16 OCEAN UI POLISH

Owner runtime подтвердил, что 3.11.15 восстановила Ocean как третью визуальную тему поверх обычного рабочего layout. Следующий UX-pass выполняется без возврата отдельного Kraken/Ocean shell.

Изменения 3.11.16:
- Layers toggle вынесен из topbar в отдельный floating bubble слева над Layers panel.
- Общий внешний контейнер topbar визуально удалён во всех темах; controls остаются на своих рабочих местах.
- Внешний контейнер нижнего creation tool rail визуально удалён; остаются только сами tool buttons.
- Welcome/empty card получает круглый glass close control внутри верхнего правого угла вместо квадратного `×`.
- Цифры 1–5 удалены из видимых Brief/Code/Browser/Design/Team tabs; shortcut logic не удаляется.
- Лишняя Ocean explanation card из Canvas inspector удалена.
- Ocean glass осветлён, а backdrop blur усилен примерно до 30px.
- Ocean FX переработан в компактные switch rows и selects.
- Планктон, пузыри и морские формы снова визуально живут в Ocean, но реализованы только статическим DOM + CSS keyframes. Запрещённые performance-механизмы из 3.11.12 не возвращаются: нет requestAnimationFrame animation loop, collision timer, self-triggering style observer.
- `prefers-reduced-motion` отключает ambient animation.
- Zoom controls перенесены в нижнюю часть collapsed Inspector mini rail; отдельный bottom zoom dock скрыт.

Candidate artifact: `OSMINOG-Chrome-3.11.16-OCEAN-UI-POLISH-ROOT.zip`
- size: 329105 bytes
- SHA-256: `c3a32fc2eb2da20cbd9c8c93d752e7920963092246f2a6933691dd721c721177`
- static: 21 JS syntax PASS, 9 JSON parse PASS, ZIP integrity PASS
- owner runtime: pending



---

## 2026-08-29 — 3.11.17 OCEAN CONTRAST & LAYOUT FIX

Owner runtime review of 3.11.16 confirmed the common Light/Dark/Ocean workspace layout, but exposed three usability regressions in the Ocean pass: the cyan palette washed out controls/text, the Layers bubble overlapped the Layers panel instead of living in the header corner, and the zoom pill disappeared with expanded Inspector while showing the percentage vertically.

3.11.17 keeps the same single workspace architecture and fixes only readability/layout:

- Ocean uses a deeper blue background and darker translucent glass, still lighter than Dark, with ~32px blur for separation.
- Layers bubble moves to the far-left header corner and topbar is offset to avoid overlap.
- Zoom is detached from `.inspector-mini`, always visible, vertically stacked with horizontal percentage text, and shifts left when Inspector is expanded/resized.
- CSS-only plankton/bubbles/sea forms remain active in Ocean.
- No requestAnimationFrame drift loop, collision timer, or self-triggering render MutationObserver is reintroduced.

Candidate artifact: `OSMINOG-Chrome-3.11.17-OCEAN-CONTRAST-LAYOUT-FIX-ROOT.zip` — 55 files · 324575 bytes · SHA-256 `d8e6b11c692c71e505e5efb2ad16216131477647183f9f0516310279b11f3a32`.

Static verification: 21 JS syntax PASS, 9 JSON parse PASS, 0 real duplicate HTML IDs, ZIP integrity PASS. Owner runtime pending.



---

## 2026-08-29 — 3.11.18 LAYERS & ZOOM POLISH

Owner runtime подтвердил 3.11.17 и уточнил последний UI-pass перед возвратом к функциональным подсистемам.

Что исправлено в candidate 3.11.18:
- collapsed Inspector больше не тянется пустой колонной вниз; quick-actions имеют естественную высоту;
- zoom при collapsed Inspector — отдельная вертикальная pill ниже с gap и той же шириной 56px, `100%` читается горизонтально;
- zoom при expanded Inspector возвращается в горизонтальную classic-пилюлю и остаётся доступным рядом с Inspector;
- collapsed Layers больше не показывает реальные layer/file rows, groups, previews или thumbnails;
- expanded Layers footer переставлен: широкая локальная папка проекта + маленький `+`;
- local folder control использует существующий `OSMINOGProjectFolderAPI`: disconnected → owner directory picker, connected → существующий local project explorer; показывается реальное имя папки;
- Ocean top groups получают одинаковый translucent light substrate без россыпи индивидуальных border/background контейнеров;
- опасные Ocean JS drift/collision loops не возвращались.

Artifact: `OSMINOG-Chrome-3.11.18-LAYERS-ZOOM-POLISH-ROOT.zip` · 330638 bytes · SHA-256 `d4314909eb86ca985167cb616cdc7c788a8dccbe501fe70824f76440c740064a`.

Static verification: 21 JS syntax PASS; 9 JSON parse PASS; 0 real duplicate HTML IDs; ZIP integrity PASS. Owner runtime pending.



---

## 2026-08-29 — OSMINOG 3.11.19 OCEAN READABILITY & PANEL CLEANUP

Owner установил 3.11.18 и прислал runtime-скриншоты. Общая схема одного layout для Light/Dark/Ocean подтверждена как правильная, но обнаружены новые UI-остатки: Ocean top controls снова воспринимаются как длинные контейнеры, collapsed Layers показывает реальный thumbnail, zoom collapsed слишком вытянут, Layers footer имеет лишние separator bars, а ChatGPT/Agent Settings в Ocean плохо читаются (белое/низкоконтрастное поле переписки, прозрачные секции, скрытое нижнее содержимое и грубый scrollbar).

Собрана 3.11.19 поверх 3.11.18:
- top-left / mode-switch / top-actions в Ocean больше не имеют общей длинной плашки; каждая кнопка/вкладка получает собственную blue-glass bubble surface;
- collapsed Layers жёстко скрывает layer/file/observed rows, previews, thumbnails и images, оставляя только navigation controls;
- project-folder dock лишён separator bars и выровнен по 54px ритму нижних tools;
- collapsed zoom-pill укорочена, expanded Inspector продолжает использовать горизонтальный zoom;
- добавлены единые тонкие themed scrollbars для Inspector, Layers, AI chat/settings и длинных рабочих панелей;
- Ocean ChatGPT/AI chat переведён на глубокий blue-glass conversation surface вместо белого;
- Agent Settings сделан full-surface внутри chat body: структурированные секции, более непрозрачный фон, sticky header и полноценный вертикальный scroll;
- исправлена ошибка Ocean FX prefs: 3.11.18 читал `v31118`, но записывал в старый `v31117`; 3.11.19 использует единый `v31119` key с migration fallback из `v31118`;
- performance-dangerous Ocean loops/collision/observer-feedback не возвращались.

Candidate artifact: `OSMINOG-Chrome-3.11.19-OCEAN-READABILITY-PANEL-CLEANUP-ROOT.zip` · 55 files · 332263 bytes · SHA-256 `2b3e46800db9ad8be87dfd73d5c7eda486810b2f2b7a5c402180957f94c634c3`.
Static checks: 21 JS syntax PASS, 9 JSON parse PASS, 0 real duplicate HTML IDs, ZIP integrity PASS. Owner runtime pending.



---

## 2026-08-29 — 3.11.20 FIGMA PLANKTON & RAIL ALIGN

Owner runtime подтвердил 3.11.19 как рабочую базу, но дал финальный визуальный feedback по Ocean: набор планктона/морских форм неполный относительно Figma; формы должны плавно менять направление и вращаться, часть — мягко люминесцировать, пузыри должны всегда идти только вверх. Логотип OSMINOG не должен иметь собственную подложку. Верхние управляющие группы должны использовать тот же glass/material язык, что правый quick rail. Collapsed zoom должен совпадать с rail по ширине/материалу и жить строго внизу. В collapsed Layers обнаружено наложение mini-rail и folder actions, а нижние `+ / folder` визуально не соответствуют верхним rail buttons.

Собран candidate 3.11.20 поверх 3.11.19. Live Figma MCP на Starter plan вернул rate-limit, поэтому набор форм восстановлен строго по уже предоставленным владельцем Figma-скриншотам: ring, oval/cell, burst, jelly, microbe, star, spore, propeller, droplet, crescent, diamond и мелкие plankton points. Motion — CSS-only: плавный drift, смена направления и rotation, selective bioluminescence; bubbles находятся в отдельном слое и движутся вертикально вверх. Опасные requestAnimationFrame/collision/style-observer loops не возвращались.

Ocean logo теперь без background/border/shadow. Workspace prefs, mode switch и top actions получают общий blue-glass material side-rail уровня. Collapsed zoom зафиксирован внизу справа, ширина 56px и material совпадают с inspector mini-rail; expanded Inspector сохраняет horizontal classic zoom. Collapsed Layers заканчивается на той же нижней линии, mini-rail и folder dock разведены flex-layout, нижние `+ / folder` получают тот же rail-button style.

Артефакт: `OSMINOG-Chrome-3.11.20-FIGMA-PLANKTON-RAIL-ALIGN-ROOT.zip` — 55 files, 334869 bytes, SHA-256 `b6a36fff232afa0242fbd3add6833213c71d417884437013dc87a918e6509e95`.

Static checks: 21 JS syntax PASS, 8 JSON parse PASS, 0 real duplicate HTML IDs, ZIP integrity PASS. Owner runtime pending.



---

## 2026-08-29 — OSMINOG 3.11.21 UI CLEANUP · BRAND ICONS · CHAT POLISH

Owner runtime подтвердил загрузку 3.11.20 FIGMA PLANKTON & RAIL ALIGN. Последний визуальный feedback: shared top containers снова мешают; logo должен быть без подложки; Ocean dropdown menus сливаются с фоном; Layers active нужен blue + white icon; GPT chat/settings имеют белые/ломаные поверхности; provider/media icons должны использовать узнаваемые brand marks вместо emoji/инициалов, в частности Nano Banana.

Собран candidate 3.11.21 поверх 3.11.20:

- Ocean top-left / mode-switch / top-actions больше не имеют shared background containers; brand остаётся naked, каждый action/mode — отдельный glass bubble.
- Smart-select menus унифицированы для всех тем и получают плотный blurred Ocean surface; dynamic Ocean FX и GPT Settings selects используют тот же компонент.
- Layers active state = blue bubble + white icon.
- Ocean GPT chat очищен от white/sharp nested surfaces: context/attachment cards, menus, messages и composer приведены к единому deep-blue rounded glass.
- GPT Settings получили provider-logo picker для ChatGPT / DeepSeek / Google AI / Gemini / Claude / Custom и более единые settings cards.
- Provider Registry: Nano Banana emoji заменён локальной vector mark; media providers используют service-owned site icons/favicons с text fallback; Browser Hub переиспользует Registry imagery.
- Performance guardrails не ослаблены: no Ocean RAF loop, no collision timer, no self-triggering render observer.

Artifact: `OSMINOG-Chrome-3.11.21-UI-CLEANUP-BRAND-ICONS-CHAT-POLISH-ROOT.zip`  
Files: 56  
Size: 339311 bytes  
SHA-256: `eb1234c27e9cc9131778dae089735678fe9183687a7b77e92747eeef16b22540`  
Static: 21 JS syntax PASS · 9 JSON parse PASS · 0 real duplicate HTML IDs · ZIP integrity PASS.  
Owner runtime: pending.



---

## 2026-08-29 · OSMINOG 3.11.22 TEAM EXECUTION & Z-LAYER FIX

Owner runtime on 3.11.20 exposed two concrete production-blocking regressions inside Team mode:

1. A simple direct canvas-edit mission (for example recolor a shape and convert it to a circle) could run multiple Team discussion rounds but finish without changing the canvas. Code review confirmed the Team path did not reuse the focused-chat forced-patch retry path: a prose-only executor response was accepted as the end of execution and only produced `Исполнитель не вернул patch`.
2. Desktop provider shortcuts were rendered in a higher stacking context than the Team workspace, so ChatGPT/Gemini/DeepSeek/Claude/Nano Banana shortcuts could visually sit on top of the Team window. Generic chat-group CSS also touched Team messages and, together with accumulated overrides, could collapse transcript bubbles into unreadable horizontal strips.

3.11.22 changes:

- `background.js`: assistant protocol parser now accepts valid raw JSON machine objects in addition to fenced JSON for both `briefcraft.request/v1` and `briefcraft.patch/v1`. Raw protocol blocks are removed from user-visible answer text after parsing.
- `gpt-presence.js`: Team execute calls now set an explicit execution contract. Missing patch triggers up to two mandatory patch retries. Spatial language (`topmost`, `bottom`, `left`, `right`) must be resolved from actual object bounds in `projectMap`; only real IDs may be used. A true-circle request is explicitly defined as ellipse geometry with equal width/height while preserving center. Tool requests are drained for each retry before deciding execution failed.
- `osminog-team.js`: the main selected agent remains lead executor; if no patch survives after required retries, another selected agent becomes reserve executor. If a returned patch is rejected by OSMINOG validation, the actual validator error is sent back to the executor for one corrected-patch attempt. Team never claims canvas success without a staged/applied validated patch.
- `osminog-chat-ux-lite.js`: Team transcript removed from generic cross-chat grouping. GPT and Google chat grouping remains unchanged.
- `editor.css`: Team workspace stacking raised above desktop provider shortcuts while staying below topbar/Inspector. Team message rows/body/content are explicitly auto-height, visible and non-collapsing.
- 3.11.21 UI cleanup / provider-brand / Ocean chat polish is included because owner runtime screenshot was still 3.11.20; 3.11.22 can be installed directly over that runtime.

Artifact: `OSMINOG-Chrome-3.11.22-TEAM-EXECUTION-Z-LAYER-FIX-ROOT.zip`  
Files: 56  
Size: 341171 bytes  
SHA-256: `093a4b4faa53b19d6df000208a61481752d9d5768ba4df1ff32f637b75c89412`

Static verification: 21 JavaScript files syntax PASS; 8 JSON files parse PASS; 0 real duplicate static HTML IDs; ZIP integrity PASS. Raw/fenced protocol parser smoke-test PASS. Owner runtime pending.



---

## 2026-08-29 — OSMINOG 3.11.23 AGENT CONNECTION & NODE UX

Owner feedback after the Team/runtime pass: Agent Settings still duplicated/oversized provider grids, only a small fixed set of services acted as agent brains, `+` silently cloned the current AI, service connection/auth UX still implied external tabs, persistent agent capsules polluted the canvas, and node editing needed to remain directly accessible.

Implemented candidate 3.11.23 over 3.11.22:
- Agent Settings use responsive container queries and reflow into 2–3 columns as the window grows.
- One brain picker is generated from the full Provider Registry. Registry providers can be selected as agent brains; dedicated transports remain preferred, while other sites use an experimental generic internal web-session bridge when their prompt/response UI can be discovered.
- AI-chat `+` now opens a centered provider chooser. The owner explicitly chooses another agent of the same provider or a different provider; no silent duplicate agent is created.
- Connection is internal-first: `OSMINOGSessionManager` creates/reuses one managed service session in the background and connects the exact managed tab. Interactive third-party login cannot be completed silently; `Авторизовать` reveals/focuses that same managed service session instead of creating a random external Chrome tab.
- Provider availability/status is dynamic instead of hard-coded to six brain IDs.
- Persistent canvas agent pills are disabled. Agents remain as chat/team chips; worker octopuses are the only task-time canvas representation. Explicit pinned/node links can retain tethers without a desktop capsule.
- Selecting an existing node opens Inspector and exposes connection preset controls (color, width, dashed, arrow); all eight ports remain available.
- 3.11.22 Team patch enforcement, validator repair, fallback executor, Team z-layer and transcript auto-height fixes remain included.

Candidate artifact: `OSMINOG-Chrome-3.11.23-AGENT-CONNECTION-NODE-UX-ROOT.zip` — 56 files · 338860 bytes · SHA-256 `e18c2bee579078a40501c70be2b079509f40a66f6dbd072c00ba495773949296`.

Static verification: 21 JS syntax PASS; 8 JSON parse PASS; 0 duplicate HTML IDs per document; ZIP integrity PASS. Owner runtime pending.



---

## 2026-08-29 — OSMINOG 3.11.24 SETTINGS CLOSE HOTFIX

Owner installed 3.11.23 and immediately found a blocker: Agent Settings could not be closed by the X button or by the settings toggle. Root cause confirmed in code: the 3.11.23 responsive settings layout added `.gpt-settings-popover { display:grid!important }`, which visually overrode the element `hidden` state. Event handlers were changing `hidden=true`, but CSS forced the surface to remain rendered.

3.11.24 fixes only this blocker without adding new product behavior: `[hidden]` is authoritative again, and Settings now uses a single `setSettingsOpen()` state path. The X button, repeated gear click, click outside Settings, and Escape all close the same surface. The hotfix keeps all 3.11.23 agent/provider/node changes intact.

Artifact: `OSMINOG-Chrome-3.11.24-SETTINGS-CLOSE-HOTFIX-ROOT.zip` · 56 files · 344145 bytes · SHA-256 `31b29ec5179a33536dc418c19ac71b842409a6209cf50f9b73171c0266650d17`.

Static verification: 21 JS syntax PASS, 8 JSON parse PASS, 0 duplicate HTML IDs per document, ZIP integrity PASS. Owner runtime pending.



---

## 2026-08-29 — OSMINOG 3.11.25 CHAT TABS RESTORE

Owner runtime on 3.11.24 confirmed Settings close works, but chat tabs became confusing/broken after the 3.11.23 add-agent/provider rewrite. Product decision: restore the proven persistent project-thread behavior and keep only one improvement on `+` — explicit provider choice.

Changes in 3.11.25:
- Creating a new chat tab no longer depends on provider connection/auth state. The tab is created immediately and can be connected afterwards.
- `+` opens a provider chooser instead of silently cloning the current AI. First action is `Ещё <current provider>`, followed by other Provider Registry services.
- Picker has a built-in core fallback for ChatGPT, DeepSeek, Google AI, Gemini, Claude and Custom AI, so late Provider Registry initialization cannot produce an empty chooser.
- Picker is portaled to `document.body` and positioned under the `+` button to avoid clipping by chat/settings overflow.
- Legacy thread storage/switching/history behavior is preserved; no replacement thread engine was introduced.
- UI wording no longer calls normal project tabs `temporary agents`; closing a tab removes that project agent/history only after confirmation.
- Empty-state copy is provider-aware instead of always saying `Главный GPT`.
- 3.11.24 Settings close hotfix and 3.11.22 Team execution/z-layer fixes remain included.

Candidate artifact: `OSMINOG-Chrome-3.11.25-CHAT-TABS-RESTORE-ROOT.zip` · 56 files · 345011 bytes · SHA-256 `2257feee3e03f0d013b6133ca0745f67e1d8497bdaf40a82d1fa2cb2941c197b`.

Static checks: 21 JS syntax PASS, 8 JSON parse PASS, 0 real duplicate HTML IDs per document, ZIP integrity PASS. Owner runtime pending.



---

## 2026-08-29 — 3.11.26 CHAT CORE REBUILD

Owner runtime on 3.11.25 exposed a fatal chat regression: `ensureTetherLayer is not defined`. The symbol had been removed during the 3.11.23 no-persistent-agent-pill cleanup while `drawAgentTethers()` and thread switching still called it. This single exception cascaded into broken tab switching, add-agent flow and general chat controls.

3.11.26 rebuilds the chat core around the proven persistent project-thread model instead of inventing another thread architecture. `ensureTetherLayer()` is restored; `switchThread()` now contains its own error boundary; tab creation remains connection-independent; close has a direct redundant handler that always hides the panel and restores the launcher bubble.

The add-tab `+` remains a provider-choice step only: first `another <current AI>`, then any other Provider Registry brain/service. It does not gate tab creation on connection/authentication.

Owner requested UI changes included in this pass:
- Undo / Redo / Activity moved from top actions into the main bottom tool rail.
- Messenger-style hover reactions added to normal AI chat messages and Team Room messages; reactions are persisted with local project chat/transcript data.
- Persistent agent pills remain disabled on the canvas; this pass does not reintroduce them.

Artifact: `OSMINOG-Chrome-3.11.26-CHAT-CORE-REBUILD-ROOT.zip` · 56 files · 346810 bytes · SHA-256 `1c9333d51aa609413da99c90ecf28853768cc5eca2de6176f446ca382b55f80c`.
Static checks: 21 JS syntax PASS, 8 JSON parse PASS, 0 duplicate real HTML IDs per document, ZIP integrity PASS. Owner runtime pending.



---

## 2026-08-30 — OSMINOG 3.11.27 LIGHT THEME CONTRAST + CHAT RESIZE

Owner runtime на 3.11.26 подтвердил, что Light theme визуально сливает холст и светлые панели в один белый лист. Owner дал точный целевой базовый цвет Light: RGB 222/226/231 = `#DEE2E7`. Дополнительно подтверждено, что AI chat трудно/невозможно растягивать по ширине за левый/правый край.

Изменения candidate 3.11.27:
- Light default background/board переведён на точный `#DEE2E7`; существующие untouched legacy defaults `#f7f8fb/#f7f9fc/#fff` визуально мигрируют на новый базовый цвет, пользовательские кастомные цвета не переписываются.
- Светлые панели остаются светлыми/белыми, но теперь читаются на контрастном голубовато-сером холсте.
- Custom AI chat resize handles перенесены внутрь рамки окна и увеличены по левому/правому краю, сверху/снизу и углам; horizontal resize должен стабильно ловиться мышью.
- Сохраняется geometry persistence окна и существующая chat/thread логика 3.11.26.
- ZIP: 56 files · 346942 bytes · SHA-256 `e01e02018ac01b855f2398267ea8b1376237c6a297681bfc76ddf212bbe02f03`.
- Static checks: 21 JS syntax PASS, 8 JSON parse PASS, 0 real duplicate HTML IDs, ZIP integrity PASS. Owner runtime pending.



---

## 2026-08-30 — OSMINOG 3.11.28 UNIFIED CHAT RESIZE + TEAM DEFAULT SIZE

Owner runtime-tested 3.11.27 and confirmed that the Light theme contrast change is visible, but the AI chat still does not resize by dragging the left/right edges. Owner also requested that Team Room open by default at approximately the compact working size shown in the runtime screenshot.

Root cause / design correction:
- AI chat still used its own legacy drag/resize implementation while Team/Browser/Markdown already used `OSMINOGWindowManager`.
- Maintaining two window systems made edge-resize behavior inconsistent and fragile.

3.11.28 changes:
- AI chat is migrated to the shared `OSMINOGWindowManager`; its legacy duplicate drag/resize engine is disabled.
- Managed resize hit targets are moved inside window borders so `overflow:hidden` cannot clip them and pointer capture is easy to hit.
- Left/right/top/bottom and all corner resize targets remain available.
- Team Room first-open default geometry becomes 620x520 px with responsive internal columns; existing saved owner geometry still has priority.
- Light theme baseline `#DEE2E7` from 3.11.27 is preserved.

Artifact: `OSMINOG-Chrome-3.11.28-UNIFIED-CHAT-RESIZE-TEAM-DEFAULT-SIZE-ROOT.zip`
Size: 347665 bytes
SHA-256: `7b3e72036855c7e26e27466246c7329a6c83d0d4fe1ddabb63cac27848f424ac`
Static checks: 21 JS syntax PASS, 9 JSON parse PASS, 0 real duplicate HTML IDs, ZIP integrity PASS.
Owner runtime: pending.



---

## 2026-08-30 09:17 — OSMINOG 3.11.29 CHAT FRAME RESIZE HOTFIX

Owner installed 3.11.28 and confirmed the Team default window geometry change, but AI chat still did not resize from left/right/top/bottom edges or corners. This is a runtime regression blocking normal chat use.

Root cause direction: 3.11.28 unified AI chat onto OSMINOGWindowManager, but resize still depended on tiny child resize-handle elements inside a complex chat DOM. Those pointer events were unreliable / swallowed by nested chat surfaces.

3.11.29 keeps the unified WindowManager but adds direct frame-edge capture on the managed window itself. Pointerdown within 12px of any edge/corner starts N/E/S/W/corner resize in capture phase, so nested content cannot steal the resize gesture. Existing child handles remain non-canonical; no second resize engine is reintroduced.

Artifact: OSMINOG-Chrome-3.11.29-CHAT-FRAME-RESIZE-HOTFIX-ROOT.zip
Size: 348148 bytes
SHA-256: 8834fed02b8a248cdd364aa25812c906706e5db3cfa732f7153bf1f573b7164f
Files: 56
Static checks: 21 JS syntax PASS, 9 JSON parse PASS, 0 duplicate real HTML IDs, ZIP integrity PASS.
Runtime status: owner verification pending.



---

## 2026-08-30 — OSMINOG 3.11.30 CHAT RESIZE ROOT FIX

Owner runtime on 3.11.29 confirmed that AI chat still could not resize by dragging any edge or corner.

Root cause was finally isolated: the responsive Agent Settings pass introduced in 3.11.23 set `.gpt-resizable-panel` desktop `width` and `height` with `!important`. Both the legacy resize code and the later unified WindowManager computed new geometry correctly, but the browser refused to apply the new dimensions because stylesheet `!important` won over normal inline width/height assignments.

3.11.30 fixes the actual root cause instead of changing hit targets again:
- desktop AI chat width/height are no longer hard-locked by responsive CSS;
- `OSMINOGWindowManager` writes live width/height as authoritative inline `!important` values during initialize and resize, preventing future theme CSS from silently disabling resize;
- left/right/top/bottom/corner resizing remains available through the current managed-window frame system;
- no chat thread, provider, Team, reaction or connection behavior is changed in this hotfix.

Candidate artifact: `OSMINOG-Chrome-3.11.30-CHAT-RESIZE-ROOT-FIX-ROOT.zip` · 56 files · 348235 bytes · SHA-256 `74e9c0eb251590eab7685a71c45e65cf2dc413eab4ea49aed747b83b4e12e869`.

Static checks: 21 JS syntax PASS · 9 JSON parse PASS · 0 real duplicate HTML IDs · ZIP integrity PASS · explicit assertion that the desktop width/height `!important` lock is absent and WindowManager owns authoritative live dimensions.



---

## 2026-08-31 — 3.11.32 SPACE FX FREEZE HOTFIX

Owner runtime on 3.11.31 exposed a P0 freeze: switching to Dark caused the workspace tab to hang and subsequent reloads to remain stuck because the saved Dark theme re-triggered the same loop.

Root cause was introduced in 3.11.31 inspector FX injection. `injectThemeFx()` removed and recreated its own Space/Ocean settings section while a `MutationObserver` watched `#inspectorBody` child-list changes. The function therefore generated the very mutation that scheduled itself again, creating a self-sustaining render loop.

3.11.32 fixes only this regression:
- adds `fxInjecting` reentrancy guard;
- adds `fxInjectQueued` microtask coalescing;
- reuses an already-correct FX section instead of removing/re-adding it;
- only removes the opposite theme section when theme actually changes;
- observer ignores mutations created during the controlled injection pass.

Dark Space FX and colorful Light/Dark/Ocean theme icons from 3.11.31 are preserved. No other UI/runtime behavior is intentionally changed.

Artifact: `OSMINOG-Chrome-3.11.32-SPACE-FX-FREEZE-HOTFIX-ROOT.zip` — 350604 bytes — SHA-256 `b9f4effc5196c301bfe83b2d3cf65ea41e6440202c767e0b0a029e33fa9245c1`.



## 2026-09-02 — CHAT OWNER RUNTIME RECOVERY · 3.14.2 candidate

- Причина ремонта: в 3.14.1 прямой ChatGPT transport и UI чата разошлись по контрактам. Direct transport для `app` требовал HTML, а `gpt-presence` считал приложение завершённым только после `module_create/module_update`; результат мог уходить в длинный автономный цикл без фактической установки.
- В direct transport восстановлен полный список Owner Max tools: project revisions/checkpoints, module create/update/test, workspace/icon actions.
- Команды вида «сделай секундомер/таймер/калькулятор/виджет» снова классифицируются как приложение, а не как набор примитивов на холсте. HTML-ответ direct transport теперь устанавливается через реальный `module_create`, проходит launch-test и создаёт launcher/module, а не browser-карточку.
- В чат возвращены видимые короткие этапы выполнения. Они сохраняются в UI, но исключаются из контекста модели как `progress/runtime`; скрытые chain-of-thought не выводятся.
- Session Manager больше не заменяет рабочие обработчики «Подключить в фоне» обработчиком открытия Access Center. Центр остаётся отдельным интерфейсом, а подключение снова выполняет реальный `connect()`.
- Восстановлены `OSMINOG_PROJECT_LOG.md`, `OSMINOG_ROADMAP.md`, `project-log-archive/` и `docs/OSMINOG_UPDATE_ARCHITECTURE.md` поверх текущего кода без отката 3.14.x.
- До публичного релиза обязательна проверка: ChatGPT direct + attached fallback; создание секундомера как module/launcher; создание произвольного sandbox app; web_search → asset_create; source/GitHub edit; DeepSeek/Claude/Gemini/Google AI background sessions; восстановление сессии после закрытия/перезапуска.


## 2026-09-03 — 3.14.3 DESKTOP ACTION RECOVERY

Owner test of 3.14.2 confirmed that real module creation returned, but exposed three follow-up regressions: compact stopwatch UI was still wrapped by a desktop application shell; an explicit request to find a web photo and place it on the desktop stopped at prose instead of `asset_create`; and the product-source path needed a stronger fail-closed contract so OSMINOG interface edits go to the canonical GitHub source rather than canvas mockups.

3.14.3 repairs those paths additively over 3.14.2. Compact sandbox widgets are transparent/content-sized and the desktop CSS no longer forces the normal 46px extension header on them. Internet image/file placement is promoted to an execution task and only completes after a real `asset_create` object id. Direct source mode now explicitly requires inspection and mutation of `jeep-jim/OSMINOG` and forbids canvas substitution for product UI changes.

## 2026-09-03 — 3.14.4 CHAT EXECUTION RECOVERY

Live owner testing of 3.14.3 confirmed four regressions: a compact stopwatch could close only its inner UI while the transparent managed parent remained; recreating the widget could fall into repeated autonomous retries; internet image placement could be described by the provider without the real `asset_create`; and OSMINOG progress/runtime messages appeared as a second chat speaker beside the selected provider. The owner also requested the response-progress/elapsed-time and scroll feel preserved by the 3.11.34-era chat, an immediate live version badge, and Normal as the real default interface text size.

3.14.4 keeps the current 3.14 desktop architecture and repairs those execution/UX paths: module close bridges to the managed parent, reinstall closes stale windows, explicit web image placement runs locally through image bytes then `asset_create`, repeated no-tool replies fail fast, progress stays in the single status strip with elapsed seconds, chat bottom-follow is reader-aware, the selected provider is the only message speaker, the version chip reads the manifest immediately, and all four text-size presets apply their variables consistently.

## 2026-09-03 — 3.14.5 LEGACY CHAT POLISH

Owner supplied the 3.11.34-era chat as the visual/behavior reference. Historical project records confirm the intended chat contract: progress belongs in `#gptPresenceActivity`, uses provider colour, live elapsed timing and an inline moving fill, while the conversation itself remains the provider/user transcript. 3.14.5 completes the migration by deleting previously persisted OSMINOG progress/runtime telemetry cards from loaded chat histories and keeping new execution stages solely in the status strip. The strip now reads as the selected provider + stage + live seconds + continuing state, while reader-aware bottom following remains intact.


## 2026-09-03 — 3.15.0 Interactive Capability Runtime
Owner live-test showed a key architectural issue: one widget could be created successfully, then the same provider would claim on the next command that `module_create` was unavailable. 3.15.0 moves common application mutations into the host, renews the tool lease on every prompt, exposes native editable graphics creation, adds file bytes to sandbox apps, enables selected-canvas audio playback, and locks Poseidon to verified private-repository write access.


## 2026-09-03 — 3.15.1 Owner Access Recovery
Owner live test showed 3.15.0 could drop Owner Max whenever GitHub status was temporarily unreachable, and the internal browser incorrectly tried to iframe GitHub. 3.15.1 introduces resilient cached owner verification, direct fine-grained token setup, and protected-site routing through managed real Chrome tabs.
- 2026-09-03: 3.15.2 synchronizes GitHub account/repository/Owner Max status; private-repo 404 is treated as missing fine-grained repository access, not as a mysterious network failure.

## 2026-09-03 — 3.16.0 SIMPLE ACCESS RUNTIME
Удалена permission-console архитектура: рабочие возможности ИИ доступны постоянно, окно «Доступ» оставлено только для ссылки/ролей холста, контекст холста стал intent-driven без preload, а изменение исходников самого OSMINOG переведено на just-in-time Owner Unlock с Google Authenticator-compatible TOTP.

## 2026-09-03 — 3.17.0 GENERATIVE APP RUNTIME
Удалены встроенные HTML-заготовки секундомера, календаря и плеера. Все приложения теперь генерируются ИИ под текущую задачу; OSMINOG отвечает за установку, проверку интерактивности, transactional update/rollback, фокус приложения для последующей доработки, доступ к файлам/скриншотам, пропорциональное масштабирование и binary JS/WASM fetch.

## 2026-09-03 — 3.18.0 PRODUCT CORE RECOVERY
После owner-тестов 3.14–3.17 возвращена простая продуктовая модель ранней 3.11: обычная работа ИИ доступна без матрицы permission-переключателей; «Доступ» отвечает только за шаринг холста; AI и Poseidon разведены в две понятные кнопки; пользовательские GitHub/Drive и web-сервисы возвращены как подключения. Updater переведён на три независимых источника и больше не имеет права показывать `up to date`, если канал не был успешно прочитан. Сохранён 3.17 Generative App Runtime.

## 2026-09-04 — Chrome 3.19.5 / Split Core Hero
- Одобренные human и octopus/AI арты разделены на независимые прозрачные WebP-слои вокруг empty-state карточки.
- Удалены 3.19.4 banana/stars и старый объединённый hero container; старая `assets/core/core-hero.webp` удалена из сборки.
- Hero адаптивный и `pointer-events:none`, поэтому реальные кнопки и provider controls остаются интерактивными.
- Native file-drop recovery 3.19.4 намеренно не менялся.
- Human SHA-256: `2fdf7dd116cc4d7ad655fe8466937fd1eeb53c4e774aba0e6547908b78d6254b`.
- Octopus SHA-256: `c212e02dfd2cc8fb29080da447dedb77cabe5ead63410e8968207cf63cb46260`.
- Автоматическая проверка: целостность WebP, JS syntax, JSON, версия 3.19.5, fixed extension key, hero markers и сохранение native drop guard.
- Живая проверка интерфейса Chrome остаётся ручной проверкой владельца после обновления.

## 2026-09-04 — Chrome 3.19.6 / Cinematic Core Hero
- В заставку установлен финальный owner-approved арт из чата: исходник 1672×941 RGBA PNG.
- Исходник сохранён байт-в-байт без ресайза и без перекодирования, чтобы не терять качество.
- Один и тот же high-res asset используется двумя слоями: полный back-layer под реальной карточкой и clipped foreground-layer слева, поэтому нога человека лежит поверх меню, а осьминог частично скрывается карточкой.
- Кнопка закрытия закреплена справа сверху и поднята над декоративными слоями.
- Кнопки действий и ряд из пяти AI-провайдеров приведены к стилю утвержденного макета.
- Asset path: `assets/core/core-hero-3196.png`. SHA-256: `0f3bfa90a683f9efe4ca81f28889bd2b29543b7e52469815dd36a281c843214c`; размер: 1796453 bytes.

## 2026-09-04 — Chrome 3.19.7 / Docked Core Hero
- Финальный cinematic hero из 3.19.6 сохранён без изменений и без повторного сжатия.
- Арт опущен и статично посажен на верхнюю кромку welcome-card, чтобы убрать пустую полосу между иллюстрацией и прямоугольником.
- Убрана анимация плавания hero.
- Три основные кнопки получили иконки и выровнены по утверждённому референсу.
- Нижний ряд провайдеров выровнен в пять одинаковых pill-кнопок; добавлен Grok, чтобы не оставалось пустой пятой колонки.
- Кнопка закрытия остаётся справа сверху.

## 2026-09-04 — Chrome 3.19.8 / Solid Docked Hero
- Убраны декоративные orb и подпись `OSMINOG · CORE` из приветственной карточки.
- Заголовок зафиксирован в две строки: `Build the project` / `with your AI team`, чтобы нога персонажа не перекрывала текст.
- Верх реальной карточки поднят на 12 px к арту — щель между PNG и прямоугольником закрыта без изменения исходного PNG.
- Для Ocean фон приветственной карточки теперь непрозрачный `#09577c`; скрытый back-layer изображения больше не просвечивает по срезанному контуру.
- Анимация hero остаётся отключённой; тени, удалённые в 3.19.7, не возвращались.
- Сетка трёх action-кнопок с иконками и пяти provider-pill сохранена из 3.19.7.


---

## 2026-09-04 — OSMINOG 3.19.9 language, providers and canvas-color repair

### Runtime issues reported on 3.19.8
- Cinematic welcome composition is approved.
- Welcome title needed to move slightly upward.
- Title no longer changed with the selected language because fixed English CSS pseudo-content covered the translated DOM title.
- All five welcome provider pills opened DeepSeek because the handler read `dataset.provider` while markup uses `data-provider-open`.
- In Light theme, hover could make button labels/icons unreadable.
- Light/Dark canvas background and grid color controls changed stored values but no longer changed the visible viewport because the final CSS did not consume the runtime canvas variables.

### Changes in 3.19.9
- Real DOM title is again driven by `syncEmptyHintLanguage()` and remains intentionally split into two lines for EN/RU/DE/ES/JA/ZH.
- Title moved upward from 50 px to 28 px top margin.
- Provider pill handler now reads `dataset.providerOpen`; ChatGPT, Claude, Gemini, DeepSeek and Grok are mapped separately and open through OSMINOG Browser Hub when available. No catch-all DeepSeek fallback remains.
- Light-theme hover contrast is forced readable for soft/icon/mini/tool/welcome controls; primary buttons remain white-on-accent.
- Final loaded CSS now renders Light/Dark viewport from `--board-bg` and the runtime grid variables, restoring live background/grid color changes.
- Ocean keeps its dedicated visual theme behavior.

### Verification
- `node --check editor.js`.
- `manifest.json` and `OSMINOG_BUILD.json` parse and report 3.19.9.
- Static checks verify all provider routes and the live canvas CSS variables.
- Owner runtime verification in Chrome remains required after update.

---

## 2026-09-04 — 3.19.12 SEAMLESS SHARED VISION

### Requested work
- Make canvas vision seamless for every connected AI.
- In an attached external ChatGPT conversation, the owner must be able to type “смотри на холст” and have ChatGPT receive the live OSMINOG canvas without manually sending a screenshot.

### Built changes
- Added one same-revision `osminog.vision_context/v1` path for provider turns.
- Visual intent chooses overview / tethered object / selection / current viewport and attaches the fresh image to the same request.
- External ChatGPT manual sends now pause for an OSMINOG preflight, receive fresh structured canvas context + matching image, then send once.
- Machine context and tool-result hops are placed in hidden protocol blocks instead of visible chat prose.
- External Presence now carries a real project revision heartbeat and silently reconnects to an existing ChatGPT tab after prior user authorization; OSMINOG never creates a new consumer ChatGPT tab for this.
- Existing object IDs, patch validation, provider routing, hero art and 3.19.11 UI fixes are preserved.

### Verification
- JS syntax and manifest JSON are checked by CI.
- Public package is published through OSMINOG-Releases with SHA/size verification.
- Runtime owner test still required: update, keep/attach this ChatGPT tab, then type `смотри на холст`. Expected: normal answer based on the live canvas with no manual screenshot upload.




## 2026-09-06 — 3.20.3 CANVAS DROP AND PRESENCE RECOVERY

Сообщение владельца: перенос внешних файлов и объектов из папок приводит к зависанию; пропало прежнее подключение текущего ChatGPT из «Доступа»; не работает оформленный текст.

Подтверждённые причины и исправления:
- `installCanvasSidePanel` удалял/добавлял собственный блок в `inspectorBody` из наблюдателя за тем же DOM. При выборе изображения/текста получался цикл микрозадач. Блок теперь переиспользуется, обновления объединяются через requestAnimationFrame. В Chromium на старом пакете защитный тест зафиксировал более 60 вызовов наблюдателя; исправленный полный интерфейс проверен без такой защиты.
- В 3.20.1 было два потребителя native drop. Оставлен один последовательный импорт с отдельной обработкой ошибок. Повторный намеренный перенос того же файла допустим.
- Старый capture-обработчик 3.8.42 останавливал любой drop с пустым FileList, включая внутренние MIME-типы OSMINOG. Внутренние папки, объекты и привязки агентов пропускаются к своим обработчикам.
- Перенос из проводника сохраняет ID существующего объекта. Реальный файл из папки проекта читается как исходный File через уже разрешённый handle; текстовые preview-лимиты не обрезают импорт. Внутренний перенос завершает UI-очистку при ошибке.
- «Доступ» снова использует существующую форму с выбором роли и `connectExternalChatGPT`, как на скриншоте владельца. Новые вкладки для этой операции не создаются; Owner Unlock для исходников не изменён.
- Форматирование текста возвращается после устранения цикла инспектора. Проверены bold, italic, перерисовка и сохранение.
- Закрыт отдельно воспроизведённый TypeError при null/undefined на retry `osminogTeamAsk`.

База: опубликованный ZIP 3.20.1, SHA-256 d173566992a207d6e224d3a89513633b086410f6162fa93d3e79c29f06c74ba0. Релиз 3.20.1 не содержал отдельного null-response fix. Ветка 3.20.2 была отдельным незавершённым кандидатом; этот ремонт получает 3.20.3 и строится от точного 3.20.1. Отличавшиеся от main исходники UI синхронизированы с пакетом, без переоформления интерфейса.

Проверки: `tests/recovery-3203.cjs` — реальный Chromium 149, полный editor.html, реальные DOM/MutationObserver/File/DataTransfer/execCommand, подставные Chrome transport/storage и file handle. Пройдены внешний повторный импорт, внутренний перенос изображения без дубля/смены ID, импорт всех 260001 байт текстового файла, форма external ChatGPT с ролью edit, форматирование и сохранение, отсутствие uncaught page errors. `tests/team-null-response-3203.cjs` — начальный null, повторный null и undefined завершаются контролируемой ошибкой. JS syntax и package integrity проверяются сборщиком.

`runtimeVerified` остаётся false: установка через Windows Dev Hub, живой провайдер и работа в профиле владельца ещё не проверены. Следующая проверка владельца: обновление кнопкой → внешний файл → перенос из папки → оформленный текст → «Доступ / Текущий ChatGPT / Подключить» → запрос о холсте.


## 2026-09-06 — 3.20.4: удаление, контекст, заметки и документы

# OSMINOG 3.20.4 — документы и управление контекстом

База: 3.20.3. Обновление через существующий dev-канал и кнопку OSMINOG.

- У плашки приложения в чате появился крестик. Снятый контекст не возвращается из глобального фокуса; удалённый модуль не выбирается по старому ID.
- Команды к выделенной фотографии больше не классифицируются как правка приложения только из-за слов «фон» или «его». Выделение имеет приоритет над закреплённым объектом. Явные команды изменения приложения сохранены.
- Старые пользовательские модули, ошибочно помеченные системными, доступны для удаления с подтверждением. Название, тип, версия, иконка и разрешения сохраняются при загрузке реестра. Встроенный Telegram-коннектор остаётся встроенным компонентом.
- Удаление объектов холста требует подтверждения; отмена не удаляет выбранное. Доступен Undo.
- «Текст → Новый текст» сразу создаёт редактируемый объект в центре холста. Добавлена «Записка на холсте» и панель оформления рядом с текстом. Текст доступен всем подключённым агентам через общий bridge и read_object_text/document_read.
- Двойной щелчок по PDF открывает редактор: чтение и замена текстовых фрагментов, добавление текста, удаление/перестановка/поворот страниц. «Скачать с правками» формирует реальные PDF-байты. Исходник сохранён отдельно.
- TXT, Markdown, JSON, CSV и другие поддержанные текстовые файлы открываются для текстового редактирования; JSON проверяется перед сохранением.
- Общие инструменты document_read / document_edit / document_export доступны агентам, включая внешний Presence. Правки требуют актуальной ревизии документа; удаление страниц требует подтверждения владельца.

## Точные границы

Это не универсальный редактор любых бинарных форматов. OCR сканов, полноценные DOCX/XLSX и произвольные бинарные редакторы не реализованы. PDF-замена закрывает исходный фрагмент белым фоном; изменённая страница растеризуется при экспорте и получает новый текст. Неправленные страницы сохраняются как PDF-страницы. Извлечение неизменённого текста на растеризованной странице после экспорта ограничено; рабочий документ OSMINOG сохраняет исходник и структуру правок. Сложный фон и длинная замена требуют визуальной проверки. Это не инструмент защищённого удаления конфиденциального текста. Правка PDF с интерактивными формами пока отклоняется без изменения исходника.

## Проверено

Реальный Chromium 149 с подставными Chrome storage/provider API: чтение PDF, русская замена из UI, добавление текста инструментом агента, конфликт ревизии, отмена/подтверждение удаления, страницы, заметка и читаемость ИИ, удаление legacy-модуля после перезагрузки реестра, снятие контекста. Независимый pypdf проверяет текст и поворот экспортированных PDF; результат отрендерен Poppler и просмотрен. Сценарии внешнего/внутреннего drag-and-drop и форматирования 3.20.3 сохранены.

`runtimeVerified: false`: живые провайдеры, Windows Dev Hub и профиль владельца ещё не проверены. Публикация не является доказательством выполнения команд каждым внешним ИИ.

Тесты: tests/routing-3204.cjs, tests/documents-3204.cjs, tests/recovery-3203.cjs, tests/team-null-response-3203.cjs. Сборщик tools/build_3204.py. Продолжать от 3.20.4; следующий шаг — проверка владельцем снятия плашки, удаления старого модуля, заметки, реального PDF и команды живому ИИ. Не маркировать полноценный OCR/office/PDF layout editing завершённым.


### Публикация 3.20.4 подтверждена
- Исходный commit: 0aecf842b11a120eec8d692de05828a7e4d5301b; PR https://github.com/jeep-jim/OSMINOG/pull/7 объединён, merge 61fa0195c277559417197831f65a822a82685060.
- Релиз: https://github.com/jeep-jim/OSMINOG-Releases/releases/tag/chrome-v3.20.4 . Пакет OSMINOG-Chrome-3.20.4-DOCUMENTS-CONTEXT-CONTROL.zip, 4061366 байт, SHA-256 5f7a0e98acff7b982abdbeeed7cff21398422bafb94c22aafd5ab9b1a4047b9b.
- Сверены 104/104 файлов ZIP с деревом исходного коммита. Workflow 34021513923 успешен; опубликованный asset digest и dev feed проверены. Dev latest=3.20.4, runtimeVerified=false.
- Следующая точка: владелец обновляется штатной кнопкой и проверяет свои файлы/модули и живой ИИ. Неподдержанные OCR, сложная PDF-вёрстка без растеризации и офисные/бинарные адаптеры остаются отдельной работой.



## 2026-09-06 — 3.20.5: видимый текст и графический редактор

- В нижнем доке возвращён «Текст» с заметной подписью: обычный текст, записка/ТЗ и Markdown. Пояснения на столе доступны общему инструменту чтения ИИ.
- Панель графических инструментов занимает отдельную строку под холстом. Подписи инструментов видны; панели слоёв и свойств можно скрывать и менять их ширину.
- Новый рисунок прозрачен по умолчанию. Прозрачность обозначена тёмной шахматной сеткой, которая не попадает в PNG.
- Правая панель прокручивается: открытые секции не сжимаются и не обрезают поля.
- Настройки кисти и ластика: размер, сглаживание и непрозрачность. Цвет меняется до рисования. Добавлены клавиши B/E/T/V/R/O/L/P.
- Удаление светлого фона изображения: порог, мягкость края, возврат исходника и Undo. Светлые детали изображения тоже могут удаляться; это инструмент для светлой бумаги, не универсальное выделение любого фона.
- Для текста в графическом редакторе доступны содержание, шрифт, размер, жирность, курсив, выравнивание и интервал.
- Исправлены группировка/разгруппировка Fabric 6 и порядок объектов в Boolean-группах.
- PNG экспортирует весь рисунок независимо от масштаба и сдвига просмотра; доступен масштаб 1×/2×/3×. Для ластика и составных Boolean-групп SVG явно требует выбрать PNG.
- «На холст» создаёт отдельное PNG-изображение, сохраняя внутри объекта редактируемый документ со слоями, текстом и кривыми. Выделите его и нажмите «Из выделенного» для продолжения редактирования. Исходный объект не удаляется. Сам скачанный PNG не содержит редактируемых слоёв: они сохраняются в проекте OSMINOG.
- graphics_status возвращает реальные идентификаторы объектов редактора. graphics_edit ожидает завершения операций и сообщает ошибки выбора/экспорта.

Сборка основана на опубликованном пакете 3.20.4: сверены 104/104 исходных файлов. Проверки UI, пикселей PNG и повторного редактирования выполняются в GitHub Actions; живые провайдеры и Windows Dev Hub владельца не проверяются этим тестом. `runtimeVerified=false` до проверки в установленном профиле владельца.

Исходные изменения: PR #8, fix/graphics-text-3205. Публикация выполняется только после Chromium-регрессии.

### Подтверждённая публикация 3.20.5

- PR #8 объединён: a1859766fdc14a77d24fc261fd408ff3747ad28c. Финальный Chromium/graphics/documents/package workflow 34023839212 прошёл; живой профиль владельца остаётся непроверенным.
- Релиз: https://github.com/jeep-jim/OSMINOG-Releases/releases/tag/chrome-v3.20.5 . Пакет OSMINOG-Chrome-3.20.5-TEXT-GRAPHICS-STUDIO.zip, 4066856 байт, SHA-256 ea9a8320b8a75219cb7323fe3ec43e787c9ec4345aae3fa55b1286acca86cea9.
- Сверены 106/106 файлов ZIP с исходным и merge-деревом. CI и локальная сборка совпали побайтово. Публикация 34024001000 успешна; итоговые release asset digest, размер и dev feed latest=3.20.5 проверены после завершения обоих запусков.
- Автопубликация по ZIP и ACTIVATE-V2 вызвали два последовательных запуска. Дубликат 34024006195 загрузил тот же проверенный архив, затем получил non-fast-forward при повторном обновлении уже обновлённого feed. Итоговый feed и asset корректны. В следующем релизе с полным ZIP использовать только существующий автоматический dispatch без дополнительного ACTIVATE-V2.
- Следующая точка: обновиться штатной кнопкой до 3.20.5 и проверить свои подписи/рисунки и живой ИИ в профиле владельца. runtimeVerified=false сохранён.




## 2026-09-06 — Foundation candidate 3.21.0 / PR 13

Implemented project-scoped local folder memory, removed 140-message retention cutoff, automatic internal project context, user-repository asset tools, Drive text tools, Figma node lookup, browser HTML/manual export. See RELEASE_NOTES_3.21.0.md for bounded behavior. First source CI passed all three workflows at 7b788cad0f831a3a7d27f1229f3e584911487bc7. Added targeted integration tests in follow-up. External Live Presence remains blocked: no configured authenticated relay. No live OAuth/Figma verification. This is not a claim of full product completion.


## 2026-09-06 — 3.21.1 media/reference and chat performance

Fix attachment handoff from composer to parallel agent; capture selected reference for explicit generation; import returned HTTPS images next to reference; no vector retry after successful image import. Mixed search/generate prompts offer local choice buttons. Render 80 recent messages with earlier-message expansion; keep complete storage and expose scoped chat_history_read. Bound outgoing history to 24000 characters and 40 turns, with retrieval for older messages. Search tries original before thumbnail, with request timeouts. No restored external mirroring and no claim of live generation success. See RELEASE_NOTES_3.21.1.md.


## 2026-09-07 — 3.21.2: folder ownership and generated file recovery

Observed on 3.21.1: moving into a virtual folder retained the same object on the desktop; deleting it also removed it from the folder. Rendering, selection, links, layers, viewport context and exports now respect folder ownership. Moves clear desktop selection and normalize legacy membership. Object data remains in the project.

Image responses skipped tool-role images, file pointers and delta frames. A dedicated generation prompt and parser now handle these cases, resolve returned file IDs, exclude input references and retain exact download/import errors. External transcript mirroring stays disabled.

Validation: generated-media, media routing, privacy, local-memory and routing tests pass locally. CI must pass pointer drag, eight object types, folder-to-folder moves, restore, Undo/Redo, deletion isolation and persisted reload before packaging. Live provider generation remains unverified.

## 2026-09-07 — 3.21.3: очистка чата и поток ответа

Запрос владельца: объяснить отказ изображения, устранить медленный чат, добавить удаление переписки в настройках. База — main 9da2f7962d206814c89f9318306a4af5361d174d / 3.21.2.

Подтверждено в коде: очистка была только для командного протокола; direct ChatGPT использовал response.text() и показывал ответ после получения целиком. Введены подтверждаемая очистка текущего чата, сохранённая отметка удаления для объединения резервных копий, новый контекст диалога, остановка direct fetch и отбрасывание позднего результата. Добавлен постепенный показ видимого текста через incremental SSE parser; без сохранения каждого фрагмента и перерисовки истории. Сохранены запрет внешнего зеркалирования и предыдущие исправления папок.

Ошибка генерации на скриншоте — реальный текст провайдера о недоступной генерации в этой сессии. Исправление интерфейса не меняет доступность генератора. Live generation не подтверждена. Детали и границы — RELEASE_NOTES_3.21.3.md. Выпуск разрешён только после успешного CI; runtimeVerified=false.


## 2026-10-13 — OSMINOG становится самостоятельным локальным браузером

Владелец зафиксировал приоритет настольного браузера, затем мобильных версий. Расширение больше не ограничивает продукт и не является обязательным этапом. Создан ежедневный [OSMINOG_BROWSER_ROADMAP.md](OSMINOG_BROWSER_ROADMAP.md): решения, состояние, B01–B06, ссылки на проверки и точка продолжения. Старые записи сохранены.

Preview 0.2.0 прошёл контролируемые тесты WebContentsView и упаковки, но в 22:39 Asia/Krasnoyarsk владелец сообщил: браузер, чат и обновление не работают. Скриншот содержит Untrusted frame. Исправление 0.2.1 добавляет нормализацию локального URL и стабильную проверку фрейма, реальный IPC storage test, тест именно установленного NSIS в кириллическом пути, DOM-транспорт четырёх ИИ и состояния обновления с финальным сохранением. 9 локальных тестов прошли; установленная сборка, живые ИИ и публикация канала ещё не подтверждены. Код — PR #23; это не запись об успешном выпуске.


## 2026-10-13 — Windows 0.2.1: исправление установленного браузера и канал обновления

АвтоЦена на паузе. OSMINOG — локальный браузер, Windows в приоритете. Подробный ежедневный журнал: [OSMINOG_BROWSER_ROADMAP.md](OSMINOG_BROWSER_ROADMAP.md).

Исправлены native IPC, нативные вкладки/области, встроенная форма чата с DOM-транспортом и обновление кнопкой. Source runtime e8f68c2f20b8153cc21f7b9905deb844189c8703; Windows CI 38430246246 проверил реальную NSIS-установку и отправку из формы. Release CI 38431251299 проверил установленное обновление N → N+1 с сохранением текста на доске и cookie, затем опубликовал windows-v0.2.1 и активный windows-preview/latest.yml. Тестовая 0.2.2 не публиковалась. Живые аккаунты провайдеров не проверены; не объявлять fixture-тест универсальной проверкой чатов. Сломанная 0.2.0 требует одной ручной установки исправления без удаления профиля. Расширение и АвтоЦена не опубликованы/не изменены.


## 2026-10-14 — OSMINOG Browser 0.3.0 по новому макету

PR #24 объединён в main. Новый интерфейс: активные вкладки слева, 1/2/4 области и редактируемый холст, минивкладки ИИ/сайтов справа, три темы, сохранение расположения и адресов, встроенное окно обновления. Полный прежний редактор сохранён. Windows CI 38432873971 прошёл установленную проверку; release CI 38435400614 — реальное обновление N→N+1 с сохранением текста и cookie. Опубликован Windows Preview 0.3.0; канал кнопки версии активен. Исправлены гонка готовности тестового HTTP-сервера, чтение YAML ответа и поля реестра Windows. Все детали, контрольная сумма, ссылки и ограничения — в OSMINOG_BROWSER_ROADMAP.md. Совместная работа по ссылке, постоянный внешний AI-доступ и живые аккаунты ещё не подтверждены.


## 2026-11-05 — Chrome extension 4.0.21: clipboard recovery candidate

**Starting state:** main `9543f4c3846a1af3284654939e3c3be88bce7b69`, Chrome 4.0.20. Owner reported an empty capture folder and `loadImage is not defined` during manual image paste. `osminog-library.js` called a helper private to Workdesk; both queue import and manual paste traversed this failing path.

**Change:** local image decoding in the importer, explicit desk/folder destination, retained retry/acknowledgement, per-item error handling, serialized collector configuration/lifecycle and recovery of the existing queue. Fixed extension key and persisted user-data keys remain unchanged.

**Validation:** collector runtime fixtures and existing clipboard regression pass locally. Added full-extension clipboard test as a required CI step; do not infer it passed from this candidate entry. Scope and reproducible commands: `docs/verification/chrome-4.0.21/README.md`. No owner Windows test is claimed.

**Next action:** run the full-extension and existing CI gates, resolve any failure, deliver the verified 4.0.21 ZIP and record the exact source/artifact/publication results. This entry concerns the Chrome extension, not Windows Browser 4.0.21 from October.


## 2026-11-05 — Chrome extension 4.0.21 выпущен: сохранение скриншотов и восстановление проектов

**Результат:** опубликован [OSMINOG Chrome 4.0.21](https://github.com/jeep-jim/OSMINOG-Releases/releases/tag/chrome-v4.0.21) и обновлён dev-канал кнопки версии. Время публикации feed: `2026-11-05T10:05:34Z`. Это выпуск Chrome extension; Windows Browser и АвтоЦена не публиковались.

**Исправлено:** недоступный `loadImage` при импорте очереди и Ctrl+V; чтение `chrome.storage.local.get` больше не завершает Promise пустым объектом раньше callback. Выбранный стол/папка сохраняются при переключении стола, открытая папка обновляет содержимое и счётчик. Временные ошибки сохраняют повторную доставку; постоянный отказ валидации не блокирует следующие копирования. ACK очереди выполняется после сохранения проекта. Прежний ключ расширения, разрешения и ключи пользовательских данных сохранены.

**Проверено:** [полный PR runtime/build 42006617269](https://github.com/jeep-jim/OSMINOG/actions/runs/42006617269) и [Workdesk/document regression 42006617233](https://github.com/jeep-jim/OSMINOG/actions/runs/42006617233) — success. Настоящий Chrome 151.0.7922.34 под Linux/Xvfb подтвердил PNG/текст из системного буфера при скрытой неактивной вкладке редактора, назначение папки/стола, Ctrl+V, размеры/пиксели изображения, счётчик папки, сохранение очереди, reload и полный перезапуск браузера. Исходная 4.0.20 воспроизвела ReferenceError и преждевременный пустой результат storageGet в отдельных регрессиях.

**Происхождение:** [PR #79](https://github.com/jeep-jim/OSMINOG/pull/79), кандидат `fbb2e1416dbf05c407ee83cb31589dae8c71581c`, merge `5aeb71b3a56258d34dbdbc488a042b65360135d2`; одинаковое дерево `93137712502d84ce5417983d37044d53bbc87612`. CI artifact `13405301415`; внутренний ZIP выдан без перепаковки.

**Пакет:** `OSMINOG-Chrome-4.0.21-CLIPBOARD-FIX.zip`, **9400407 байт**, SHA-256 `f0872c6f35f128956f9a55571cd0541cc86195bb152560b6a7b165919e7c2a1a`. Проверены CRC ZIP, корневой manifest 4.0.21, прежний ключ/разрешения и побайтовое соответствие изменённых программных файлов исходникам. [Publisher 42007754782](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/42007754782), проверки registry и dispatch — success. Asset digest и размер dev feed совпадают с этим ZIP; registry upload commit `429ad4f1ad89e96c4713e18c6142d28f72be2f8c`.

**Границы:** запуск на устройстве владельца Windows и одновременное редактирование в нескольких вкладках не подтверждались. Опрос буфера — 1,5 секунды; промежуточное содержимое, заменённое между опросами, не гарантируется. При закрытом редакторе материалы остаются в очереди до открытия. Поддерживаются текст и изображения, назначение — стол/папка OSMINOG.

**Служебная проверка после merge:** main run `42007264543` повторил все девять native-сценариев успешно, затем завершился exit 1 после сообщения PASS. Прежний catch скрыл тип ошибки; точная причина по этому логу не установлена. Исправлена только очистка native fixture: ожидание фактического закрытия Chromium до отключения транспорта, повторное удаление временного профиля и вывод исключения; общий PASS перенесён после cleanup. Продуктовый код и опубликованный ZIP не менялись. Для выпуска использован полностью успешный PR artifact, указанный выше.


**Final verification / 2026-11-05:** [main runtime/build 42009411240](https://github.com/jeep-jim/OSMINOG/actions/runs/42009411240) on `74d77cd9902adc48400ba1fb4d9e42b50fc3666d` completed **success**, including native clipboard scenarios, browser cleanup and verified ZIP packaging. No failed steps remain. The published ZIP remains the immutable artifact from successful PR build 42006617269, with SHA-256 `f0872c6f35f128956f9a55571cd0541cc86195bb152560b6a7b165919e7c2a1a`.




## 2026-11-07 — Chrome 4.0.37: recovery from browser closures during Update (candidate)

**Starting state:** source main `d5b5da4a0dd5ec7f307f2c019736a44a4ec4dfe5`, published Chrome 4.0.36. The owner reported three browser closures after pressing Update and explicitly refused another attempt with the same mechanism. Source inspection confirms the folder updater recursively snapshots all installation-folder descendants into ArrayBuffers, then writes one large IndexedDB value while holding the entire decompressed ZIP. This is a concrete unbounded-memory defect, not proof of the owner's exact crash cause.

**Requested work:** rework the update mechanism and its first migration, preserve the existing extension identity, projects, Owner Authenticator and button workflow. Do not tell the owner to retry the old updater as a test.

**Candidate changes:** bounded package-only per-file backup and durable transaction recovery, exclusive installation, stricter ZIP validation and network limits; normal-tab guard plus target-version acknowledgement for extension reload; no blind reload on failure. A self-contained one-time recovery page uses the new updater for the first transition. A fresh toolbar popup detects the newer disk manifest and finishes the handoff without running the old installer. This fresh-resource bootstrap requires its own real Chromium gate.

**Verification so far:** local handoff/recovery, I/O budget and Owner Authenticator tests pass; owner-guard SHA256 remains `90dc411113966db05adc323c56d5311aa830af8c11c4d6dcf959aa32008dab41`. Local Chromium cannot start in this executor because socket creation is blocked. Required CI includes real native-folder writes, complete package N→N+1, unrelated-tab and persisted-project preservation, last-popup-only reload, and the external-repair popup probe. No CI or publication success is claimed by this candidate entry.

**Delivery:** normal package-only publication cannot repair the code already executing in an old installation. Require updater `2.0.0` in the feed before promoting this candidate. The recovery page must be built from the same reviewed source and verified before distribution. Do not claim remote changes updated the owner's installed extension. CI result is `ciVerified`; `runtimeVerified` remains false until a real owner-device outcome is observed.

**Next action:** complete and review the bounded updater and recovery artifact, pass all old and new gates, update the existing registry importer/feed version contract, publish only the immutable verified candidate, then append exact checks, hashes, release URLs and remaining delivery limits here.


## 2026-11-07 — Chrome 4.0.37 published: bounded updater and one-time recovery

**Result:** [Chrome 4.0.37](https://github.com/jeep-jim/OSMINOG-Releases/releases/tag/chrome-v4.0.37) is published as a dev prerelease. The public Chrome feed was verified at version 4.0.37 with publishedAt `2026-11-07T04:20:07Z`, `minUpdaterVersion: 2.0.0`, `ciVerified: true` and `runtimeVerified: false`. The package and recovery helper were taken unchanged from the same successful CI artifact.

**Source and gates:** [PR98](https://github.com/jeep-jim/OSMINOG/pull/98), tested head `1df53c5f3dc0bf00da6c66577750fa2b03b14b08`, merge `daf4277bb02728808f89a9ecf5b361a33ff24d62`. All five final-head workflows passed: [Chrome runtime/package 42337415903](https://github.com/jeep-jim/OSMINOG/actions/runs/42337415903), [retained documents 42337415912](https://github.com/jeep-jim/OSMINOG/actions/runs/42337415912), [retained compatibility 42337415928](https://github.com/jeep-jim/OSMINOG/actions/runs/42337415928), [complete browser diagnostics 42337415880](https://github.com/jeep-jim/OSMINOG/actions/runs/42337415880) and [trash/inbox 42337415855](https://github.com/jeep-jim/OSMINOG/actions/runs/42337415855). Concurrent Android Vision changes were retained by the merge; the differences from the tested head are confined to android-vision and its own workflow. The published Chrome artifact was not rebuilt from those concurrent changes.

**Observed browser behavior:** Chrome for Testing 151.0.7922.34 under Linux/Xvfb (Ubuntu 26.04.1), real unpacked extension, native directory/file handles, IndexedDB and reload APIs. The final integration report has `ok: true`, eight passed checks and zero unhandled page errors. Two actual Update-button installations advanced fixture versions 4.0.37 → 4.0.37.1 → 4.0.37.2; duplicate clicks produced only one package download per installation. An unrelated tab retained unsaved text and JavaScript state. Updating with only an extension popup remaining kept Chrome alive and restored exactly one editor. Project text, folder membership and persisted state survived. Backups contained only the 196 package paths; the unrelated 256 MiB file was excluded.

**First-transition check:** the real file:// recovery page's Choose folder / Install handlers wrote fixture version 4.0.37.3 using the native filesystem and journal. A failed primary download fell back to the raw mirror. A separate live request from that file origin downloaded a pinned public ZIP and verified its exact size/hash under the helper CSP and browser CORS checks. A freshly opened popup saw newer files while the old runtime still ran; Finish update performed the final reload without another download and preserved the project.

**Immutable delivery:** CI artifact `13559454646`, outer ZIP 13,180,122 bytes, SHA-256 `43c14c091c82383c34c07d16386651bb9ad49bb42f81c21e64036b9b5d6d1551`. Published `OSMINOG-Chrome-4.0.37.zip`: 9,542,602 bytes, SHA-256 `04b8253d019302b36f0877d6325624eeebdf948cc6ae5331871fba472297efd8`, GitHub asset `719582683`. Published [OSMINOG-Update-Recovery.html](https://github.com/jeep-jim/OSMINOG-Releases/releases/download/chrome-v4.0.37/OSMINOG-Update-Recovery.html): 65,468 bytes, SHA-256 `52ae50c12029620e33fa75314bfa85743d7b84df9782e5dbf34e58caf7d1ffad`, asset `719582753`. Remote asset digests/sizes, public feed and archive metadata all match. [Import 42337936353](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/42337936353) and [publisher 42337964754](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/42337964754) passed. Registry feed commit: `55792066001cd9b3fbc2f9e9dbf6f46df9cd5175`.

**Identity:** packaged manifest key SHA-256 remains `1ddb8d87f3a6f6cb38a229bd81ba8076d1d37d3ba6b8a15b2a91129d4904012e`; packaged Owner Authenticator remains `90dc411113966db05adc323c56d5311aa830af8c11c4d6dcf959aa32008dab41`.

**Owner delivery:** do not ask for a fourth attempt with the old Update button. Open the downloaded recovery HTML in the same Chrome, select the installed OSMINOG folder containing manifest.json, choose Install fix, then open the extension icon and choose Finish update. If Chrome still shows the cached old popup, the normal reload arrow on OSMINOG's card in chrome://extensions loads the repaired files. No extension removal or manual ZIP extraction is required.

**Limits retained:** the owner's Windows installation, exact original crash cause and system folder-picker dialog have not been observed. Tests prepared folder consent and returned a real native handle; they did not execute the legacy unsafe updater. This release is verified in the stated CI scenarios, not declared owner-accepted or universally stable. Publication does not mean the already installed extension on the owner's computer has changed.

## 2026-11-07 — Chrome 4.0.38 lightweight core candidate

Owner reports freezing/browser closure on installed4.0.37 and header movement when opening panels. Explicit owner instruction: retain only infinite canvas/desks, right chat, access, automatic background clipboard collection and saved-material search; remove other tools and simplify UI. No owner crash dump or direct Windows measurement is available, so a specific browser-process crash cause is not established.

Implementation boundary: new editor.html/js/css at the same extension URL; preserved manifest key and byte-identical Owner Authenticator. Legacy project keys remain read-only migration sources. Resumable offscreen migration stores item metadata and binary Blobs separately, including legacy unknown fields, folder membership, chat scope, connections, pending captures and soft-deleted desks. Ordinary operations do not run old full-workspace persistence, revisions or connected-folder snapshot sync. Background capture is independent of editor tabs. Viewport renderer caps live cards at160 and thumbnail URLs at48; preview creation is serial in a Worker, edge512. UI search runs in a separate Worker with pages of50. Fixed full-width header is outside all panel layout.

New package uses an explicit runtime allowlist. Retired photo/graphics/document/OCR/module/export/browser-widget tools are absent from the package, while retained provider/presence transport, Owner Authenticator and updater2.0.0 remain. Source history and user data are not deleted. Native update tests are adapted to the new per-item store; removed-feature UI tests are retired by the owner's explicit scope change and replaced by real-extension core/data/clipboard/header checks. Candidate is not yet published or owner-runtime verified at this log entry; publication evidence must be appended after the actual CI result and immutable release.

## 2026-11-07 — Chrome 4.0.38 lightweight core published from exact verified CI bytes

Completed the owner's requested simplification. Final tested head: fa4a9712a199a8757d4239ddff75e644f424abce. PR 101 merged as 4d12efb3daf775fdc4d18ef3e60313879789a5c5, preserving concurrent Android Vision changes. All five checks succeeded: Chrome 42352195235, retained-data 42352195285, package-boundary 42352195221, diagnostics 42352195244, trash/recovery 42352195226. Source: https://github.com/jeep-jim/OSMINOG/pull/101 and https://github.com/jeep-jim/OSMINOG/actions/runs/42352195235 .

Native Chromium acceptance passed 7 core scenarios and 8 updater scenarios: 2400 records, 60 folders, 240 distinct 1024x768 source images, full unknown legacy fields/exact binary bytes, header/button rectangles at 1440 / 1024 px,160 live cards / 48 thumbnail URLs / 512 px maximum edge, one item write for the correctly hit-tested drag, saved view preserved after reload, search, 123 chat messages with three 256 KiB retained attachments, system clipboard text/PNG while editor closed, pause/deduplication, unchanged original Chrome storage, no whole-history reads by editor, no page/worker errors or crashes. In the measured 161 interaction frames, p95 frame interval 16.8 ms and no Long Tasks were recorded. These measurements are Linux CI evidence, not owner Windows results. Chat legacy migration now runs in a dedicated Worker via unique small staging tickets; collector migration supports singleflight retry after storage failure. Native update/recovery kept ordinary unsaved browser work and exact note/folder/Blob data through three disposable version transitions. System directory picker itself was not automated; actual native handles and file operations were used.

Exact successful artifact 13566231029: OSMINOG-Chrome-4.0.38.zip, 165,998 bytes, 49 files, SHA256 cfb7f4fe2928dc31c3707cc6fbf1d390f3e742c7d1f523b0fd703f94f85c7f66. Compared with published 4.0.37 size 9,542,602 bytes, the ZIP is 98.26% smaller. Recovery helper from the same artifact: OSMINOG-Update-Recovery.html, 65,468 bytes, SHA256 16af848d2d849208d1ee8c7dc1fddaadf1087aabd8f01cf806104cf89edbd5df. Downloaded outer artifact digest and every packaged runtime file were compared with reviewed source; fixed manifest key and Owner Authenticator hash 90dc411113966db05adc323c56d5311aa830af8c11c4d6dcf959aa32008dab41 unchanged. Helper pins package 4.0.38 / updater 2.0.0 and has one exact CSP-hashed inline script.

Registry import commit 39c3d6278d00008909db66dc4b5fc9685ef66f23 changed only the 4.0.38 request and IMPORT-CI-READY marker atop fresh main, preserving Android staging. Import 42352568549 and publisher 42352588806 succeeded. Public release https://github.com/jeep-jim/OSMINOG-Releases/releases/tag/chrome-v4.0.38 has ZIP asset 720013313 and helper asset 720013357 with the exact verified sizes/digests. Active channels/dev/chrome-extension.json was independently read back at version 4.0.38, minUpdaterVersion 2.0.0, ciVerified=true, runtimeVerified=false. The release remains marked prerelease because no owner Windows runtime verification exists.

Owner installation path avoids the old editor's heavy pre-update save: close OSMINOG editor tabs, open the published recovery HTML in Chrome, select the existing extension folder, install, then use the extension popup's Finish update action. ZIP download/unpack is automatic. This records publication and verified behavior only; no installation on the owner's computer or guarantee against every possible browser failure is claimed.


## 2026-11-07 — Chrome 4.0.39 candidate: restore the complete 4.0.37 workspace

The owner rejected the 4.0.38 simplification and explicitly required the previous interface and all previous tools back, while retaining performance improvements. This request supersedes the narrowed Lite product scope above. Source starts at 27ff3d5bdf4d85d033fff80c0b59f1e48b65b849. Restore reference is 37a4b0c; Android changes are retained unchanged. Use 4.0.39 so the result can install over 4.0.38 through the existing update flow.

The actual published 4.0.37 CI artifact was downloaded and checked: outer SHA25643c14c091c82383c34c07d16386651bb9ad49bb42f81c21e64036b9b5d6d1551, package SHA25604b8253d019302b36f0877d6325624eeebdf948cc6ae5331871fba472297efd8. Its196files include147Chrome runtime files, all retained in the new allowlist; the49excluded paths are Android sources, historical roadmaps and a development note. No Chrome tool is omitted from that baseline. Pre-4.0.37 removed features are not reintroduced.

Candidate changes restore original editor/popup/background APIs, photo/vector/document/export/OCR/module/source/chat capabilities. Header remains fixed while panels open below it. Viewport culling changes DOM only; the complete model remains available, selected/editing/live-preview objects stay mounted, and simple unchanged nodes survive forced redraws. Connection endpoints are indexed per render; selection-frame work is coalesced. Bulk undo shares immutable media strings and retains folder membership.

Pan/zoom uses small replayable view journals; repeated wheel updates coalesce and flush before reload. Existing per-item move/capture journals remain. Normal save structure is copied without JSON media round-trips, with generation checks preventing old saves from marking newer edits clean. Update waits for in-flight writes and commits dirty primary state without creating a new full backup/revision/folder export merely to reload. Updater2.0.0, handoff, recovery and Owner Authenticator remain byte-identical to4.0.37.

A one-time compatibility bridge merges4.0.38Core and Chat databases into the complete workspace, backs up overwritten legacy values and retains the Core sources. Background clipboard bytes are queued as separate IDB bodies; notifications/listing carry small metadata, and the editor imports one body at a time with acknowledgement after durable item storage. The bridge, failure/retry cases and all old tools require native validation before publication.

Local syntax, persistence/update failure and race tests, canvas/bulk-undo tests, storage loader, owner/updater/session/backend regressions passed in the stated fixtures. Native restored-workspace, clipboard,4.0.38recovery, full old UI and update gates are not yet completed at this candidate entry. Do not publish an artifact from a failed run. Keep runtimeVerified=false; no owner Windows measurement, root-cause proof for the reported process closure, or guarantee that Chrome can never fail is claimed.

Next action: finish migration/capture review, run the complete restored Chrome CI gates, audit the exact successful artifact, merge and publish that immutable package via the existing release registry, then append run IDs, package/helper sizes and hashes, and active-feed confirmation.


## 2026-11-07 — Chrome 4.0.39 published: full workspace restored with verified performance fixes

**Result:** [Chrome 4.0.39](https://github.com/jeep-jim/OSMINOG-Releases/releases/tag/chrome-v4.0.39) is published as a dev prerelease. Public feed advanced at `2026-11-07T10:21:51Z`; `ciVerified=true`, `runtimeVerified=false`, minimum updater `2.0.0`. This supersedes the rejected Lite 4.0.38 product scope: the published 4.0.37 Chrome interface and tools are restored, including all 147 baseline runtime resources. The final package contains 150 runtime files. No previously retained Chrome tool was removed.

**Source:** [PR102](https://github.com/jeep-jim/OSMINOG/pull/102), tested head `bea3ac9ae97bf21252046eb39f896bbf8758987f`, merge `e25039a86ebe0fdc41689f18992f027a4af39895`, identical tree `4fd126c3a10b6927a7e98dc03c5727de8e837a23`. The six exact-head gates passed without a rerun of that head: [main 42362963402](https://github.com/jeep-jim/OSMINOG/actions/runs/42362963402), [independent diagnostics 42362963388](https://github.com/jeep-jim/OSMINOG/actions/runs/42362963388), [graphics/documents 42362963595](https://github.com/jeep-jim/OSMINOG/actions/runs/42362963595), [photo/media 42362963481](https://github.com/jeep-jim/OSMINOG/actions/runs/42362963481), [trash/4.0.38 recovery 42362963414](https://github.com/jeep-jim/OSMINOG/actions/runs/42362963414), [Owner Authenticator 42362963609](https://github.com/jeep-jim/OSMINOG/actions/runs/42362963609). Main Node checks: 74 passed. Independent browser diagnostics: 28/28 passed.

**Final implementation:** original controls and panels, stationary header at full width, viewport culling and unchanged image/text-node reuse, conditional folder DOM writes, smaller structural undo/save copies, durable per-item/view/navigation writes and bounded background clipboard queue. Existing desk selection no longer serializes a full workspace/backup/revision. Navigation intent is captured synchronously with its global snapshot order; replay does not trust per-project tokens imported from newer folder snapshots. Two concrete navigation races were reproduced and fixed: immediate new-project flush before an older journal completes, and late navigation imported inside a newer portable project while primary activeProject is older. All 16 focused persistence tests passed, including actual persist/flushPersist/restoreFolderMemory functions. Pending real content saves remain intact. New text cards from 4.0.38 and clipboard remain readable in dark and light themes; existing object styles remain unchanged.

**Native evidence:** 2,400 objects, 60 folders and 1,200 distinct 512×384 images; 9–36 mounted image cards in measured viewports, complete model/export retained. Main interaction window: 189 frame intervals, p95 16.8 ms, max 133.3 ms, LongTasks 0; independent window: 204 intervals, p95 16.8 ms, max 83.3 ms, LongTasks 0. Main 60 unchanged redraws: 572.8 ms, zero child mutations, same image nodes. Twenty unchanged folder renders: 20 object scans, zero child/attribute mutations, same label/count nodes; changed name/position/size/capture state/counts update correctly. Header rectangles unchanged through five panel transitions at 1440/1024 px. Navigation writes were 234/244 bytes, no full workspace/backup/revision writes, selected desk restored on reload. Real clipboard text/PNG while editor closed, deduplication, pause and exact pixels passed; source 4.0.38 databases remained unchanged. Three native update/recovery cycles retained exact saved content and unrelated unsaved browser work.

**Immutable package:** CI artifact `13569759083`, outer SHA-256 `43657883e8f043ccd2245617d873e6d80bd878f32861221e0a34e698635fe535`. Published ZIP `OSMINOG-Chrome-4.0.39.zip`: **9331638 bytes**, SHA-256 `6011945c18b4b2a7b8c0ea87132b38e3f289cc84cde33e0e3ab50ab256004325`, asset `720350880`. Helper `OSMINOG-Update-Recovery.html`: **65468 bytes**, SHA-256 `a12adc7b2b50fedd21bf43e29febd39aa9e5e6a191dc6773c1ccc271eaebbdda`, asset `720350959`. Every packaged runtime byte was independently compared with the tested source or the pinned OCR digest; only verified CI build metadata differs from source metadata. ZIP allowlist/CRC, fixed manifest identity, unchanged Owner/updater/handoff/recovery bytes, helper embedded updater and CSP were verified. Detailed machine-readable evidence: [docs/release-audits/chrome-4.0.39.json](docs/release-audits/chrome-4.0.39.json).

**Publication evidence:** import commit `20a706876a146c6b423d8a2e99b8b90802d64884`; [import 42363588686](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/42363588686) and [publisher 42363614426](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/42363614426) succeeded. Archive commit `cb1ec908103473480916c89d0ea3a35c45158d52`; feed commit `ae9c8586db9f63707886d8e64548b6a394ef3394`. Independent public GitHub release API readback supplied nonempty SHA-256 digests and exact sizes for both assets; raw public dev feed and versioned release metadata match. Existing Android publication was preserved by the registry CAS update.

**Delivery and limits:** use [the published recovery helper](https://github.com/jeep-jim/OSMINOG-Releases/releases/download/chrome-v4.0.39/OSMINOG-Update-Recovery.html) for an installation whose old Update button closes Chrome: open the HTML in Chrome, select the installed extension folder containing manifest.json, install the fix, then finish through the extension icon; the normal reload arrow in chrome://extensions is the fallback for a cached old popup. Manual ZIP extraction or extension removal is unnecessary. The original 4.0.38 databases and prior values remain recoverable. The owner's Windows installation and original process-closure cause were not observed; native tests prepared a real directory handle rather than automating the system picker dialog. No live provider-account conversation was claimed. Publication is complete; it does not mean the already installed owner-side extension was remotely replaced or universally cannot hang.


## 2026-11-10 — owner authorizes lightweight storage reset

After another browser termination report the owner explicitly supersedes the full-workspace restoration requirement. Chrome and new Windows/macOS packages shall contain only lightweight text/media collection, bounded canvas layout, complete text view/edit, media viewing and GPT/DeepSeek connection. Remove agent execution, embedded browsers, other AI providers and heavy creative tools from shipped runtime. Preserve existing archives; never auto-load a large legacy snapshot. Prepare Free 100 screenshots/month and Pro entitlements/archive export without taking payments. Desktop and extension are selectable future landing-page downloads, not the separate mobile ocean product. Record actual memory/test/build results; do not certify owner-device stability from Linux CI.

Implementation candidate: `light/` contains a new 21-file package (about 46 KiB compressed locally), separate original Blobs/card metadata, indexed bounded viewport, one preview worker, explicit guarded legacy import, simple text edit/media view and two AI endpoints only. Five local tests passed for quota/storage/ZIP/dimension guards. Local Chromium launch is blocked by executor socket permissions, so native/browser/Windows/macOS results must come from dedicated CI. No publication or crash resolution claimed at this step. See `light/README.md` for allocation caps and known migration/signing limits.

## 2026-11-10 — Light 5.0.0 published with exact CI artifacts

PR #117 merged; Chrome 5.0.0 activated in the existing update channel, Windows/macOS unsigned previews published. All four Light native jobs and existing release gates passed on f752dd6fe83c5ee4888b4c91444cdd2cc9caa719. Full evidence, archive hashes, measured memory and migration/signing/billing limitations: [release audit](docs/light/2026-11-10-release.md). Owner hardware verification remains false; no claim of remote installation or guaranteed crash elimination.

## 2026-11-19 — Mouse Browser 6.0.29: уточнение владельца и полный выпуск

Работа над лендингом остановлена по поручению владельца. Следующий выпуск сохраняет Mouse 6.0.28 и переносит аккуратную пилюлю под адресную строку каждой панели, добавляет видимую активность загрузок и подтверждение снимка затвором. Исправляется повторное снятие compositor hints между открытой Норой и закрытием; длительность и native gates сохранены. 6.0.28 уже опубликована и служит проверенным базовым DMG для реального обновления 6.0.28 → 6.0.29. Подробности, exact baseline, изменения и честный текущий статус: [Mouse 6.0.29](docs/desktop/2026-11-19-mouse629-feedback.md). Публикация нового кандидата — только после source и installed native gates, без замены старых assets.

Уточнение того же поручения: вернуть точные цвета межпанельных прожилок6.0.27, Нору показывать поверх всех native pages, снять только её обводку. Трёхпальцевый маршрут отменён владельцем: нужны внутренние два пальца/wheel с сохранением прокрутки страниц. Эти исправления входят в6.0.29 до публикации; новые native foreground и wheel gates заменяют только отменённый gesture contract.


### 19 ноября 2026 — согласование Mouse6.0.30 с принятым исправлением6.0.29

Параллельный PR170 принят в main как `a5a773c16c2b342f9c7dfaf5334649e1da1f3eca` после полного native run44498720435 на exact72679ee907dda6e7ac134b1f01addee858c4e59a. Его отдельные6.0.29 пакеты принадлежат release PR51. Наш PR169 продолжает оставшиеся требования в6.0.30, сохраняя принятые native visibility/preview, дробные границы, цвета, Nora wheel/tutorial и site scrollbar fixes. Поверх них добавляются header progress pill, настоящая активность скачивания, screenshot shutter/success и trusted wheel на странице/при закрытой Норе. Нельзя публиковать второй набор6.0.29 под тем же tag или терять принятые изменения.

Предыдущий наш source10/e41e7469, run44500891371, отклонён: retained616 выявил переопределение radius кнопки скачиваний12px вместо общего5px. Новые headers/feedback/Nora/wheel и неизменённая628 trace независимо прошли, но поздние restart/private/upgrade не выполнены. В6.0.30 удалён только этот CSS override; gate сохранён. Полный новый source и installed publisher обязательны. Подробности и фактический статус — [журнал630](docs/desktop/2026-11-19-mouse630-complete-feedback.md).


## 19 ноября 2026 — Mouse Browser 6.0.29 Windows x64 опубликован

Прямое поручение владельца выполнено: готов самостоятельный установщик именно
**6.0.29 для Windows x64**. Статус **PUBLISHED / VERIFIED_DOWNLOAD**.
[Прямая загрузка](https://github.com/jeep-jim/OSMINOG-Releases/releases/download/mouse-windows-v6.0.29-x64/Mouse-Browser-6.0.29-Windows-x64.exe)
и [страница релиза](https://github.com/jeep-jim/OSMINOG-Releases/releases/tag/mouse-windows-v6.0.29-x64)
проверены; опубликованный файл — 125623123 байта, SHA-256
`18bf6e78eb5519e37d2ceb0e45acd1ea88d8f519e715e1d94d2fbc3c476e2e9d`.

Точный source `164462db8d81f614cce9c9a8ab5d1fed0e2b7381` принят через PR175
в отдельную ветку `release/mouse-6.0.29`. Полный
[source run 44548393177](https://github.com/jeep-jim/OSMINOG/actions/runs/44548393177)
прошёл на Windows Server 2022 и 2025: 176 базовых, 632 Mouse и 7 Python-проверок;
установленный UI/Agent/документы/приватность, переустановка, профиль и фактическая
замена с повторным запуском. Нативный помощник отдельно проверен на обоих хостах.
Исправления современного Windows-композитора и времени жизни обновлятора,
история отказов и точные hashes сохранены в
[полном журнале Windows](docs/desktop/2026-11-19-mouse629-windows.md).

[Publisher 44554901554](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44554901554)
повторно проверил тот же установщик, опубликовал release 451521130 в 15:32:59Z,
проверил четыре публичных assets и анонимно скачал весь EXE с проверкой размера,
SHA-256 и повторным хешированием. Windows-канал 6.0.29 обнаружен с первой попытки,
проверка текущей версии прошла. Сравнительная 6.0.28 — fixture, не прежний реальный
Windows-релиз. Итоговый evidence artifact 14545915755:
SHA-256 `666eb7f3386b4fb01fd659789bb1ba54c1de4e6b4e4514f035f60cc9967209a2`.

Это unsigned prerelease; физический компьютер/тачпад владельца и внешние
авторизованные аккаунты не проверялись. Новая основная ветка и Mac-канал
сохранены отдельно. Исходники Windows и его канал не откатывают работу над 6.0.30.

## 2026-11-19 — Mouse Browser 6.0.29 Windows x64 port

The owner requests a working Windows installer of the current Mouse product,
extending its previous macOS-only scope. The first Windows attempt failed on a
Mac-only build guard; no installer was delivered. Native Windows runtime,
secure Local MCP, PowerShell/ConPTY, update installation and full installed UI
acceptance are being implemented from the verified 6.0.29 source. The Windows
product/profile/feed are separate from legacy Trader OS and the existing Mac
release. Evidence and actual publication status are recorded in the
[Windows 6.0.29 journal](docs/desktop/2026-11-19-mouse629-windows.md).


## 19 ноября 2026 — Mouse 6.0.31: задачи сайтов и производительность столов

По новому прямому поручению владельца готовится общий Windows/macOS выпуск: убрать navigation-пилюлю «Страница загружена», принимать прогресс/ETA самой фоновой задачи сайта и проверить зависания/отрисовку на 20 и 50 живых вкладках в пяти столах. Принятый Windows629 объединён с Mac630 без отката согласованного UI и native gates. Сценарий DOOM в доступном DeepSeek-документе отсутствует; точная реализация этой части требует исходного текста, она не заявляется готовой. Решения, факты и результаты: [журнал631](docs/desktop/2026-11-19-mouse631-task-progress-performance.md). Текущий статус **IMPLEMENTING / NOT_PUBLISHED**; старые пакеты и данные пользователя сохранены.

## 19 ноября 2026 — Mouse 6.0.31: Windows и Mac опубликованы и проверены

**PUBLISHED / VERIFIED_DOWNLOAD — Windows x64 и macOS arm64.** Общий выпуск Mouse Browser 6.0.31 опубликован и проверен на обеих платформах. Приняты все 14 source checks, обе свежие установки, независимые task/stress/UI/trace проверки и итоговые evidence-архивы. Публичные EXE, DMG и ZIP совпадают с закреплёнными пакетами; каналы показывают 6.0.31. Настоящие модули обновления 6.0.29 анонимно обнаружили выпуск, целиком скачали соответствующие пакеты и проверили их hashes; проверка current для версии 6.0.31 также прошла. Сценарий DOOM по-прежнему отсутствует, поэтому эта отдельная часть поручения остаётся открытой (`DOOM_SPEC_MISSING`).

Точный source `85479b34dded864860eab91d72e053e2a047ef60` вошёл через [PR177](https://github.com/jeep-jim/OSMINOG/pull/177) в main `b693121d9e8c8de181807fd1ddea22a55e2292f3`; приняты все 14 checks. Нативные Mac arm64, Windows Server 2022 и Server 2025 проверили задачи без navigation-плашки, сайтами заданный ETA, 20/50 живых тестовых страниц на пяти столах и 15 переходов; независимый PNG checker принял 740 probes на каждом хосте. Оба Windows-хоста установили одинаковый EXE и сохранили настоящий профиль 6.0.29 при замене на 6.0.31; Mac также прошёл реальную замену и повторный запуск.

Скрытая native view получает новый viewport до capture без показа/перезагрузки страницы, incoming task dock учитывается перед layout. Для раскрытой справки Nora добавлено узкое правило размера preview: на Windows 2022 фактически 594/632 px, на 2025 — 594/624 px, при 800×600 — 481/520 px в обеих темах. Текст, кнопки, ограничения времени и frozen gates сохранены. Отдельный строгий Mac trace и весь retained publisher evidence checker прошли; это дополнительные проверки к успешному source job.

[Releases PR57](https://github.com/jeep-jim/OSMINOG-Releases/pull/57), merge `4cad2e4e1e6b5f2cf86e9d0d092499b4dd4c9a9c`, запустил [Windows 44599494290](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44599494290) и [Mac 44599494196](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44599494196). Windows publisher завершился SUCCESS в 19:46:32Z; public release451846714, EXE, Windows-канал и итоговый evidence-аудит проверены. Mac release451869817 опубликован в 20:07:32Z; attempt2 publisher завершён SUCCESS в 20:11:21Z, после инфраструктурной отмены первой попытки без запуска native job. Итоговый Mac evidence-аудит также PASS: 740 task/stress pixel probes, 143304 strict trace events, сохранённые UI/profile/native gates. На обеих платформах подтверждены анонимное обнаружение и полная загрузка пакета настоящим старым обновлятором; размеры и hashes публичных assets совпадают с pins. Полные hashes, exact jobs, независимые результаты и история отказов находятся в [журнале 6.0.31](docs/desktop/2026-11-19-mouse631-task-progress-performance.md).

`DOOM_SPEC_MISSING` остаётся открытым: предоставленный бизнес-документ не содержит согласованного сценария игры. Физический компьютер владельца и внешние аккаунты не проверялись; результаты CI не являются сравнением скорости с Chrome. Старые пакеты, профиль и история сохранены.


## 2026-11-20 — Mouse6.0.32 owner corrections in progress

Electron retained by direct owner decision. Candidate covers media-title pane stability, hidden scrollbars with working scrolling, screenshot footer placement and spacing, website offer from the logo, optional helper, Windows mascot/ICO rendering, and view-only document tabs (later instruction explicitly supersedes editing). Source baseline `a5fc2b3d543d58d5b79f63d039894fc639b8a904`; details and honest gate status: [Mouse632](docs/desktop/2026-11-20-mouse632-owner-fixes.md). Native CI and immutable publication are required; no owner-device reproduction or new published build is claimed at this stage.

## 2026-11-20 — Mouse 6.0.32: принятый source, точные пакеты и старт publisher

**SOURCE_ACCEPTED / PUBLISHERS_STARTED / PUBLICATION_PENDING.** Source `ebe2df44f1fc73fa8fa329c01406a360ebf7eef3` прошёл [Mac run 44683165219](https://github.com/jeep-jim/OSMINOG/actions/runs/44683165219), job 136111128286, и [Windows run 44683165197](https://github.com/jeep-jim/OSMINOG/actions/runs/44683165197), builder 136111172537 и modern 136115846365. Все — attempt 1; modern установил те же неизменённые EXE-байты. [PR181](https://github.com/jeep-jim/OSMINOG/pull/181) объединён в `main` как `7875ad0d3506c12cd2e64c6df298670b8ad9fbaa`.

На скачанных исходных артефактах независимо прошли Mac task/stress, owner feedback, retained source и strict motion trace; Windows installed/task/feedback/hidden-scrollbar acceptance и связь modern report с тем же пакетом также приняты. В итоговом UI показаны правильные порядок панели, 19×17 Windows-логотип и 16/18 px между библиотекой и ИИ; при 800 px норка свободна и переполнения нет. Документы остаются только для просмотра, девять исходных файлов не изменены. Полные хеши, размеры трёх пакетов, artifact ID и ограничения сохранены в [подробной записи](docs/desktop/2026-11-20-mouse632-owner-fixes.md).

В release tool Windows исправлено чтение настоящего uploaded wrapper `mouse-629-ui-regressions.json` вместо временного standalone JSON; 56 publisher tests прошли. Все шесть final release checks приняты на `ea9cab0083e884fb15025c8a95c38fe045e2e68a`. [Releases PR58](https://github.com/jeep-jim/OSMINOG-Releases/pull/58) объединён как `944e83af400bb691ab97c6d94a276c46c0a67405`; обе готовые pin-записи и `PUBLISH_OWNER` запустили [Mac 44686632355](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44686632355) и [Windows 44686632337](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44686632337). Это запись о старте, не о завершённой публикации. Финальные installed evidence, public assets, каналы и анонимная загрузка старым обновлятором должны быть приняты отдельно.

Физические media keys, живой VK-аккаунт и компьютеры владельца не проверены; Windows desktop shortcut не попал в отдельный кадр, хотя значок на панели задач виден целиком. Mac остаётся ad-hoc без Developer ID/нотариализации, Windows — без цифровой подписи. Не объявлять owner-device исправление мигания или `PUBLISHED / VERIFIED_DOWNLOAD` на основании этой промежуточной записи.

Следующая контрольная точка: Mac publisher 44686632355 принял import и выполняет fresh installed DMG verification. Windows publisher 44686632337 завершился отказом первого import: `Accepted Mouse629 evidence validator changed`; fresh install и publication не начинались. Проверяется влияние Windows checkout/переводов строк на frozen validator bytes, но причина ещё не подтверждена воспроизведением. Узкая проверка release workflow не меняет source, пакеты или их pins и не отменяет byte guard. Статус **PUBLICATION_PENDING**; результат исправления и последующей попытки будет добавлен отдельно.


### 20.11.2026 — Mouse632: Mac опубликован, Windows publisher исправлен

Mac [publisher44686632355](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44686632355) завершён SUCCESS: свежая установка,6.0.29→6.0.32, независимые проверки и анонимное скачивание настоящим старым обновлятором. [Публичный Mac-релиз](https://github.com/jeep-jim/OSMINOG-Releases/releases/tag/quadro-macos-v6.0.32-arm64) и канал6.0.32 прочитаны обратно; пакеты соответствуют pins.

Windows [Releases PR59](https://github.com/jeep-jim/OSMINOG-Releases/pull/59), merge091671cf707bd26b23e4c73ba3ab4a5d3cd3c8a0, сохраняет точные байты до checkout; контролируемый Git regression и60контрактов прошли без изменения frozen hashes, source, пакетов или owner-файла. Версионный workflow повторяет публикацию после собственной починки наmain через все прежние gates. [Повтор44687934185](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44687934185) прошёл прежний import-блокер и выполняет свежую установленную проверку. **Windows PUBLICATION_PENDING**, вся задача ещё не завершена. Подробные hashes, evidence и неизменённые пределы проверки — в [журнале632](docs/desktop/2026-11-20-mouse632-owner-fixes.md).

### 20.11.2026 — Mouse 6.0.32: финальная публикация обеих платформ

**PUBLISHED / VERIFIED_DOWNLOAD.** [Windows run 44687934185](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44687934185), job 136126741696, завершён SUCCESS на `091671cf707bd26b23e4c73ba3ab4a5d3cd3c8a0`; [release 452352254](https://github.com/jeep-jim/OSMINOG-Releases/releases/tag/mouse-windows-v6.0.32-x64) опубликован `2026-11-20T06:40:30Z`. EXE — 125728399 байт, SHA-256 `824c5c1eb1bd3a31079d9f8c8109cb37a815f9c4b1d6fa498f79604f8dbde02e`; свежая установка, независимые installed gates, публичные байты и канал приняты. `windows-channel-verification.json` подтверждает реальный anonymous download обновлятором 6.0.29 без подмены comparison version и проверку текущей версии. Publisher artifact 14607254681: 26297609 байт, SHA-256 `a17550ba04d5a36c7bea4945e5216bee7a9fa38296db6688e5abb066b3a5bf8f`.

Вместе с успешным [Mac run 44686632355](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44686632355) и [Mac-релизом](https://github.com/jeep-jim/OSMINOG-Releases/releases/tag/quadro-macos-v6.0.32-arm64) закрыты все финальные release gates обеих платформ. Опубликованы исходные неизменённые пакеты `ebe2df44f1fc73fa8fa329c01406a360ebf7eef3`. Физические media keys, устройства и VK-аккаунт владельца, отдельный Windows desktop-shortcut screenshot остаются непроверенными; ограничения подписей не изменены. Полная история попыток и доказательства сохранены в [журнале Mouse 6.0.32](docs/desktop/2026-11-20-mouse632-owner-fixes.md).


## 2026-11-20 — Mouse 6.0.33: уточнение агента, пульт настроек и Linux

Владелец исправил scope632: Агент Маус должен оставаться доступным и восстанавливать свою панель; принудительное скрытие отменено. Кнопка выхода справа снизу заменяется настройками, которые открываются правой боковой панелью и объединяют реальные настройки, включая импорт экспортированных закладок/паролей. Т+ получает живой предпросмотр страниц. У стрелки загрузок нужны измеренный прогресс, короткий подскок по завершении и счётчик до открытия загрузок. Разрешён немедленный выпуск после проверок для Mac arm64, Windows x64 и впервые Linux x64. Прежние Нора/прожилки/жесты/профили/task-only progress и просмотр документов без редактирования сохраняются.

Реализация начата; новые пакеты ещё не объявлены готовыми. Точные решения, проверки и фактическая публикация: [Mouse633](docs/desktop/2026-11-20-mouse633-control-center.md).

### Mouse 6.0.33 implementation checkpoint before native CI

Implemented Settings as a right sidebar/last footer gear, restored Agent Mouse with optional Ollama onboarding, live T+ preview, actual download progress/bounce/unread count, and user-selected encrypted credential/bookmark import. Existing view-only documents remain. Added Mac/Windows actual632 profile replacement coverage and first Linux x64 packaging/installed gates. Focused portable tests passed; the broad scratch run is not green because the required MCP native addon/Node headers are unavailable here. No native acceptance or633 publication is claimed yet. Details: `docs/desktop/2026-11-20-mouse633-control-center.md`.

### Mouse633 additional owner changes and first native diagnosis

Owner requested native right-click favorites/split/grid controls and removal of the footer X. Both are implemented for the shared desktop UI; clicked tabs remain live. First633 CI found a Mac CI-input flag omission, Linux APP_RUN config export and a Windows owner-test selector quoting error; each has a targeted fix. Windows actual629/632 profile transitions and new Settings/livezoom stages passed before that test error. Native context-menu evidence has been added; complete633 acceptance/publication is still pending. See `docs/desktop/2026-11-20-mouse633-control-center.md` for runs and raw artifact binding.

### 20.11.2026 — Mouse 6.0.33: финальная публикация Mac, Windows и Linux

**PUBLISHED / VERIFIED_DOWNLOAD.** Финальные publishers [Mac44724937504](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44724937504), [Windows44724937479](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44724937479) и [Linux44726437082](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44726437082) завершены SUCCESS. Публичные releases452606377/452606503/452610798 и все три канала6.0.33 прочитаны обратно; проверенные исходные пакеты опубликованы без пересборки. Приняты свежие нативные сценарии, независимые проверки raw evidence, анонимные загрузки и сохранение профиля при переходах Mac/Windows629/632→633. Linux впервые имеет оба формата AppImage/deb и честный null predecessor.

Source PR183: tested `0a3f8aab08356297b3b8982a081debbfa65d826d`, merge `5d92a4b6d340b38ab5f103d75790ccd671530164`. Release PR60 принят как `f96b2355a5cdaf0e166c3ae39e1aaf7330f7c9c2`. После сохранённого первого Linux failure workflow-only PR61 согласовал виртуальный экран с source окружением и принят как `f1ddfd5040d4cbce5d8e9456719ded61e337d1d3`; source, pins, пакеты, геометрия сцен и критерии не менялись.

Агент восстановлен, пульт настроек справа, Т+ с живым результатом, загрузки с прогрессом/подскоком/счётчиком, native context actions и одинаковые6px отступы/12px скругления входят в выпуск. Нижний X убран; документы только для просмотра. Доказательства, точные хеши и пределы — [журнал Mouse633](docs/desktop/2026-11-20-mouse633-control-center.md). Физические устройства/медиаклавиши владельца и Wayland не проверены; ограничения подписей остаются.


### 20.11.2026 — Mouse 6.0.34: узкое продолжение по новым замечаниям

Владелец заказал загрузки отдельной зелёной полосой под исходной вкладкой с временным уменьшением только её страницы, зелёный счётчик на стрелке, сохранение скруглений при снимках и нижний предпросмотр ссылок из правого ИИ-чата. Electron и остальные функции сохраняются. Кандидат реализуется в общей ветке для Mac/Windows/Linux; адресные переносимые проверки пройдены, установленная нативная приёмка и публикация пока не завершены. Настоящие633→634 обновления добавлены для трёх платформ, Linux — оба формата. Подробности и дальнейшие доказательства: [журнал634](docs/desktop/2026-11-20-mouse634-pane-feedback.md). Прежние финальные633 записи остаются историей опубликованной версии.

Дополнение владельца в ходе634: у развёрнутой вкладки убрать нижний зазор/скругления; фон нижней панели совпадает с верхней шапкой в обеих темах. Это входит в тот же кандидат; возврат в сетку должен восстановить обычную геометрию.


### Mouse6.0.34 — первый CI и адресные исправления проверок,2026-11-20

SourcePR185 на`bff1bcc0ebabc7f2962418547e62a8efb1a923bd` не принят:7 прежнихunit fixtures требовали обновления после нового AI wrapper/helper; адресные32 проверки после исправления прошли. Linux подтвердил реальный deb633→634 с сохранением профиля, но переносимыйAppImage probe ошибочно требовал APPIMAGE в исходном/proc environ; новая проверка связывает фактический browserPID, цепочку своего launcher, read-only FUSE executable и неизменные байты образа. Windows подтвердил629→634/633→634 и новые нижние widget, но chat same-window probe неверно считал отменённую попытку навигации перезагрузкой. Счётчик отзыва capabilities не ослабляется; добавляется отдельное свидетельство отменённой попытки при сохранении документа.

ReleasePR62 содержит только новые634 проверки и ready:false pins;5 draft workflows прошли. Публикация634 ещё не разрешена проверками. Подробные run/artifact/SHA и границы доказательств:docs/desktop/2026-11-20-mouse634-pane-feedback.md.


### Mouse6.0.34 — восстановлена точка остановки и исправлены следующие проверки

Повторный source `a36b191` не принят: Windows уже подтвердил обе ссылки/сохранность чата, но остановился на непреднамеренной cross-origin download-ссылке HTTP fixture; Linux — на экранированном пробеле в FUSE subtype старогоAppImage; Mac отменён без выделенного runner. Исправлены только данные/проверки634: собственный origin каждой download fixture и ровно `\040` в subtype, с сохранением document/epoch, native, mount/ownership/hash и pixel gates. Новая полная приёмка/публикация остаётся открытой; точные логи, hashes и границы: [журнал634](docs/desktop/2026-11-20-mouse634-pane-feedback.md).


### Mouse6.0.34 — Нора по новому снимку владельца и исправление нативных pixel probes

Владелец потребовал убрать непрошенную шестерёнку из заголовка Норы и усилить затемнение обеих тем при её выезде. Gear/callback удалены; Settings открывается через нижнюю панель. Scrim12%→24% сохраняет прежнюю300ms анимацию/барьеры и восстановление; footer остаётся вне затемнения. Пять native smoke сохраняют реальные Nora/settings действия.

Source2492add ещё не принят: Linux подтвердил оба настоящих633→634 формата; Windows —629→634/633→634; download/AI gates прошли. Mac остановился на тени tooltip после capture-close (cursor теперь реально отводится с trusted readback, tolerance3 сохранён); Win/Linux — на SVG активной вкладки с pointer-events:none поверх ошибочно выбранной точки header (явное исключение SVG bounds, tolerance6 сохранён). Open-Nora pixel gate использует честно помеченные pre-modal точки при неизменной текущей геометрии и проверяет24% shade по OS PNG. Адресные contracts проходят; новый installed CI/публикация ещё впереди. Полный локальный suite не объявляется успешным из-за отсутствующего native MCP addon. Точные run/artifact/SHA, результаты и границы: [журнал634](docs/desktop/2026-11-20-mouse634-pane-feedback.md).


### Mouse6.0.34 — владелец добавил собственный визуальный поиск в ту же сборку

Лупа непосредственно слева от смайлика открывает поиск: справа собственная строка/мышь/ИИ-диалог, слева masonry из реальных открытых сайтов с фильтрами и бесконечной пагинацией. Два переданных ТЗ задают SearXNG/OG и opt-in структурированное наблюдение выбранной страницы («Показать экран»), без скриншотов/паролей/сырого ввода. Прежние634 исправления остаются.

Backend/native/UI подготовлены; отдельный собственный SearXNG deploy только из OSMINOG под osminog с ресурсными лимитами и без АвтоЦены. Локальныеservice15/infra7/native16 contracts проходят; publicservice и установленный выпуск пока не подтверждены. Промежуточный source checkpoint8fb34017 не является готовым выпуском с поиском. Точное новоеТЗ/границы/статус: [журналпоиска634](docs/desktop/2026-11-20-mouse634-search.md).

### Mouse 6.0.34 — отдельный SearXNG: исправление отсутствующего ensurepip

Первый собственный deploy [run44774936514](https://github.com/jeep-jim/OSMINOG/actions/runs/44774936514), source `cb7c955e9965393efe9d55132da0f92991e84979`, прошёл 7 серверных тестов, SSH-проверку отдельного пользователя и закреплённый TLS-сертификат. Job `136422255323` остановился до запуска сервиса: в Python 3.14 отсутствует `ensurepip`; `python3 -m venv` не смог установить pip. Public search smoke не выполнялся, артефакт живых результатов не создан.

Подготовлено окружение `venv --without-pip` с официальным PyPA get-pip, проверяемым по SHA-256 `356e0d0de21cdc348c3394084d90939b85e4246c4d14c76aee6ca4f46646ea98`, и точным pip 26.3 wheel с SHA-256 `f3b60b20ffaadd4415ed7957212a38ac63fa4c5fa375bd0f4a797777940fad13`. Реальный локальный прогон сначала подтвердил отсутствие pip в новом venv, затем успешную установку только туда; локальный Python 3.12 не заменяет повторную проверку Python 3.14 на хосте. `apt`, `sudo`, системные пакеты и другие проекты не затрагиваются. Сохраняются собственные cgroup-лимиты и rollback.

После успешного публичного поиска workflow выполнит один настоящий текстовый запрос к существующему OSMINOG REG gateway 3081 с первыми пятью реальными результатами. Отдельная проверочная сессия хранится только в `/opt/osminog/mouse-search/state`, повторно используется и не выводится; кадры и личные данные не отправляются. Повторный deploy и этот модельный ответ ещё не подтверждены. Публикация Mouse 6.0.34 остаётся открытой.

### Mouse 6.0.34 — SQLite-кэш SearXNG ограничен собственным каталогом

Повтор bootstrap запущен как [run44776735071](https://github.com/jeep-jim/OSMINOG/actions/runs/44776735071), source `0f4ec12200f8e72cc38813430c7c95c4c4c325f4`; на момент записи deploy ещё выполняется, публичного доказательства нет. Дополнительная сверка закреплённого upstream [`searx/cache.py`](https://github.com/searxng/searxng/blob/1ebea4a073ec6011bae25c042d97308278184c83/searx/cache.py) выявила, что стандартный путь SQLite использует `tempfile.gettempdir()`, независимо от `SEARXNG_DATA_PATH` и `XDG_CACHE_HOME`. Поэтому перед импортом SearXNG явно задаются `TMPDIR` и Python `tempfile.tempdir` в `/opt/osminog/mouse-search/state/tmp`; каталог принадлежит собственному пользователю, имеет режим0700, symlink отклоняется. Чужие каталоги/кэши не читаются и не очищаются. 8 серверных тестов подтверждают собственный temp path и отказ по symlink; предыдущие проверки сохранены. Этот исправленный source и живые HTTP/AI ответы ещё требуют повторного deploy; успешность старой попытки не будет принята как доказательство изоляции нового пути.


### Mouse 6.0.34 — поисковый интерфейс подключён к main/preload и обязательной приёмке

Лупа перед смайликом, отдельная правая панель с существующим маскотом Mouse/строкой/ИИ-диалогом, левая masonry с реальными WebContentsView и фильтрами подключены к main/preload. SearXNG и OG выполняются в main с закреплённым собственным HTTPS endpoint; Cheerio1.2.0 добавлен в production lock. Новые страницы имеют отдельную временную session и не становятся сохранёнными вкладками. Явное «Открыть» переводит результат в обычный стол. Clear/new query/close отменяют прежний запрос и summary, убирают старые native views; late replies не перезаписывают новую выдачу. Скриншот включает фактические поисковые native layers со всеми четырьмя скруглениями.

Уточнение перехода к Норе: кнопка рабочих столов закрывает временный поиск и opt-in Vision, возвращает прежний обычный стол, затем открывает Нору через существующий surface hold. Она не пытается захватить скрытые обычные страницы поверх поиска. Сам поиск можно открыть снова сохранённым текстом запроса. Другие модальные окна над поиском подготавливают весь набор видимых actual PNG: incomplete/stale/navigation/geometry failures не принимаются; частично обрезанный viewport сохраняет свой размер и позицию, не растягивается на всю плитку. Nested modal сохраняет уже подготовленные изображения.

«Показать экран» передаёт совпадающую revision выбранной страницы; контекст остаётся локальным до явного вопроса ИИ. Наблюдение снимается при переходе/навигации/модальном барьере/очистке/закрытии. Отдельный required installed gate `mouse-634-search-smoke.cjs` подключён как owner report `search`: настоящий локальный HTTP/OG/model fixture, native pointer input, обе темы/OS pixels, wheel/pagination/filter, selected-page context, clear/Nora/capture/restore. Fixture-модель не выдаётся за публичный REG ответ; его независимо требует deploy smoke.

Локальные адресные проверки: 84 controller/UI/capture/Nora/overlay tests; 18 service tests с настоящими HTTP соединениями; 22 native-view/vision/gate-helper tests проходят. Бóльший suite выявил отсутствие `searchUI`/`beforeOpen` в двух старых изолированных VM fixtures — зависимости явно добавлены, прежние assertions сохранены. Локальные terminal tests не завершаются после двух ошибок среды, поэтому полный локальный suite не объявляется успешным; обязательные installed Mac/Windows/Linux выполняются в Actions.

Предыдущий source `cb7c955` подтвердил capture corners на всех трёхOS. Windows/Linux остановились на попытке закрыть modal Nora недоступной footer-кнопкой; gate теперь использует настоящий `#desks-close`. Mac focused chrome ещё разбирается по raw OS PNG; это не accepted native build. Новый поиск ещё требует первого полного installed прогона, а ограниченный public service deploy — завершения. Pins634 остаются ready:false, промежуточный выпуск не публикуется.


Завершение preflight: 62/62 объединённых service/views/vision/UI/controller/native-helper теста прошли; после согласования maxlength UI/main/service (запрос512, вопрос3000) отдельный реальный HTTP тест подтвердил передачу полного literal вопроса с `<site>`/переносом и отказ по3001 без скрытого усечения. Из97 локальных файлов (без terminal suite)исходный общий прогон дал930 pass/4 fail/3skip. Причины — отсутствующая searchUI dependency в VM fixture и старый emoji-first assertion, заменённый точным magnifier-before-emoji согласно прямому требованию. После исправления все29 затронутых тестов прошли; весь набор не запускался повторно. Полный hosted unit/installed результат ещё требуется, локальный полный PASS не заявлен.

Mac cb7: artifact14649922069, bytes5019583, SHA256679cbd1850097f9da7ad26b74cc9a59be6746fdf3c02bbad8cee45b950c5841e. Все native corner probes прошли; нижний OS chrome RGB224,225,229 отличался от верхнего244,245,249, тогда как actual composed footer244,246,250 соответствовал верхней панели. Raw display показывает Dock непосредственно под окном и общую тень вдоль footer. Fixture теперь только наdarwin располагает временное окно минимум32px выше нижней workArea границы (архивный height676→648), сохраняет .1/.9 точки/tolerance6/4attempts и строго возвращает original window/native geometry в finally.9 focused tests и остальные22 native search/view/vision tests проходят. Product CSS и лимиты приёмки не менялись.


### Mouse 6.0.34 — устранены audit blocker и зависимость нового поиска от DNS

Первый полный feature source `0411dbbf85a7aa06458868d58833cf16078a84a5` остановлен до native UI: Mac44779581691/job136438380650, Windows44779581810/job136438381633 и Linux44779581910/job136438382032 не прошли production dependency audit. Новый Cheerio1.2.0 разрешил undici7.30.0; официальный audit указал high advisories с исправлением7.30.1. Узкий `overrides.cheerio.undici=7.30.1` и lock заменяют только runtime `node_modules/undici`; dev node-gyp/undici6.29.0, Electron44.5.0 и builder26.15.3 сохранены. Реальные bytes tarball405247 сверены с registry SHA512 `03KrMbjIFDWQR5RNPrSw3bd1r12JpyFQl9/yxjUbJtqkjmllqC5lFjZh6ujeuJCKr8EOQvRW872Oy/az+nLYxg==`; итоговый `npm audit --omit=dev --audit-level=high` exit0, total/high/critical0. Новый hosted build требуется, старые native jobs не выдаются за проверку интерфейса.

Собственный service deployment `792ff9a` run44777291233/job136434476856 успешно установил закреплённый SearXNG на Python3.14, запустил user-unit и подтвердил local TLS/health, ActiveState=active, MemoryMax536870912, CPUQuotaPerSecUSec250ms, TasksMax64. Внешняя проверка остановилась на первом `/health` из-за фактического DNS `Temporary failure in name resolution` для osminog.red; реальных public search/AI результатов ещё не было. Raw log39262bytes SHA25611dea047b0b34e4a1945add896a58260a9346799f286d9ec6e19e3fb5b96e648; artifacts0.

Новые desktop default endpoints используют тот же собственный адрес151.248.113.177:3082/3081. Прежний закреплённый сертификат содержит этот IP SAN; обычная TLS identity verification сохранена, чужой IP отклонён тестом. Android/default других продуктов не менялись, их текущая доступность не проверена. Отдельный marker `[verify-mouse-search]` запускает только proof работающего сервиса: DNS результат отдельно, active runtime SHA/current upstream/cgroup, настоящий public TLS/page1/page2/video и один реальный REG text reply. Proof scripts находятся в own `/proofs/$verifierSHA`; immutable live792 не переустанавливается и не переписывается. Verifier source и runtime source различаются явно. Локальные service19/19, infra11/11, YAML/bash checks проходят; public proof и fresh installed release ещё впереди.

### Mouse 6.0.34 — точный результат первого patched build и диагностика поискового сервиса

Source `94e5f555403c0c51c4112d946cb44ad3e9f50fb1` устранил production audit blocker, но ещё не прошёл установочную приёмку. Mac run44781048878/job136443504133 прошёл audit и178 базовых тестов; retained suite сообщил1000 tests,990 pass,1 fail,9 skip. Единственная ошибка — старый `mouse-615.test.cjs` ожидал прежний aria-label группы без нового поиска. Linux run44781048867/job136443507076 также дошёл до реального установленного приложения и подтвердил633→634 upgrade, затем старый615 native gate потребовал5 кнопок вместо фактических6. Зелёный step conclusion при continue-on-error не считается успешным unit outcome. Новый634 search/две темы ещё не проверены в этих запусках; выпуск остаётся неподтверждённым.

Public verifier run44781035648/job136443528477 получил настоящий TLS/health по закреплённому IP с проверкой CA и подтвердил active runtime792ff9a, upstream1ebea4a, Result=success и прежние ресурсные пределы. Первый настоящий поиск не вернул тело за18 секунд; реальных результатов и модельного ответа пока нет. Собственное имя osminog.red по-прежнему отдельно зафиксировано как DNS failure. Raw evidence artifact14651637847, SHA25626abd46f1d5238b6e5d1003d4f60f0fe1a016d13dacd46204785f1d2be8790c7; live runtime и verifier source не смешиваются.

Следующая проверка добавляет ограниченную диагностику при public failure: один запрос к действующему собственному сервису с параллельным health, только его PID/cgroup/thread waits и четыре фиксированных DNS имени; отдельно — точный установленный upstream/facade в новом own proof state с bounded loopback HTTP и stack locations без locals. Стек отдельного proof worker не считается стеком действующего сервиса. Активный792 не переустанавливается, DNS/чужие сервисы не меняются, public18s и desktop12s не повышаются. YAML/shell/AST,11 infra tests прошли; локальный diagnostic helper действительно загрузил закреплённый движок и вернул HTTP200, но с0 results/engine timeouts — это диагностика, не успешная публичная выдача.

В release candidate bf39d49b1600cf1b075af326f9966792af78325c добавлено описание поиска и Норы для всех трёх платформ, а также явное требование независимой реальной server/AI проверки перед arming. Все три ready:false, PR62 draft; исторические633 пакеты и проверки не менялись. Публикация не состоялась.

Footer correction: установленный615 gate теперь требует ровно6 кнопок в порядке tile-search/emoji/zoom/history/bookmarks/downloads, сохраняет прежние геометрические пределы, widths/themes и настоящие клики остальных команд. Фактический aria-label записывается в cases[].label. Найден и исправлен product locale fallback: emoji.js раньше после init/смены языка восстанавливал старую подпись без поиска; теперь RU/EN учитывают лупу. Существующие unit assertions проверяют обе подписи и уникальность кнопок. Адресные613/615/emoji/634-search-helper tests прошли21/21, syntax/diff-check прошли. Новый installed результат ещё требуется.

### Mouse 6.0.34 — живой Windows search принят; Mac wheel и внешний body остаются открыты

В Windows94e5 run44781048888/job136443506524 порядок installed стадий позволил owner634 завершиться до отказа позднего старого footer615. Независимый release checker принял actual owner634 JSON,28 OS receipts и декодированные PNG: search9 stages/2themes/36pixel probes, максимум8 native websites, radius12, реальные fixture3 search/12metadata/10native-site/7model requests, отзыв Vision и возврат4 исходных owners. Search SHA2569715c83fdcae2ebfc7071c538a133cbe37ad3a6398dc805b2d11e7ded62d37bb, owner SHA25625750bcc2e2e975d09793a931e67ce739ca881a749afd6805a54f73b0ff11387. Root просмотрел обе actual OS темы. Это проверка собственных HTTP/model fixtures; publicSearch/model=false, общий94e5 run всё равно failed и не разрешён к публикации.

Новый sourcec19446fc26f80fa987a9cb970c5a092e8bf89371 устранил footer unit blocker: Mac44782939913/job136450126000 прошёл dependency audit, retained unit contracts и DMG/ZIP build. В установленном634 достигнут поиск с обеими темами, затем timeout `634 trusted guest wheel reaches masonry`: первые два native wheel имеют trusted HTTP receipts, совпадающую preload→main передачу и фактическую прокрутку; третий ещё не подтверждён. Старый gate сохранял intent только после receipt, поэтому raw не доказывает причину третьей потери. Порог времени/число8 вводов/пиксельные пределы не повышаются; требуется точный preflight видимого native владельца, OS pointer/focus и запись intent до dispatch, затем новый native прогон. Это не объявляется установленной product-причиной.

Own-service verifierc194 run44782930209 доказал другое разделение: public runner прошёл TLS/HTTP200/JSON headers, но чтение тела остановилось по18s. На той же VM действующий runtime792 по собственному HTTPS IP вернул35 настоящих результатов за0.860s, параллельный health0.004s; до/после2 threads, зависших HTTP workers не обнаружено. Отдельный capped proof с тем же pinned facade/upstream вернул35 результатов за1.544s после import3.251s. Diagnostic artifact14652349331 SHA256e3292eb2f5ebc1492c1e16a874c257210d7b8a908df4e5ded7dcc7e5c9f35eb2. Действующий сервис не перезапускается без причины. Следующая внешняя диагностика сравнит bounded core Node HTTPS и curl HTTP1.0 по Content-Length/реально полученным chunks/complete JSON, включая короткий400; CA и12s client deadline сохраняются. Прямой executor IP probe не имел сетевого маршрута и не считается результатом проверки сервиса.

Release4f94e971574b8c0dbe9be14d4ee79fd85d79e7cc требует exact footer6/order/actual RU label; AST guard подтверждает неизменность остальных frozen633 footer условий. Все5 CI успешны, publisher jobs skipped;29 feedback/8 reuse/55 owner+search tests подтверждены raw hosted log. Pins всех платформ остаются ready:false, PR62 draft. Полная приёмка окончательных source/artifacts и public search/AI ещё требуются.

Checkpoint preflight: native wheel fixture в двух634 файлах теперь сохраняет intent до send, требует точный текущий WC/epoch/URL/revision/document, actual bounds и live zoom до/после, native+DOM focus и trusted pointermove в целевом guest. Readiness/send/receipt/forwarding/scroll/presentation используют один прежний monotonic10s budget, максимум8 отправок; event source и product код не менялись.44 адресных search/gesture tests прошли, после live-zoom уточнения8 search helper tests повторно прошли. Windowsc194 также потерял третье wheel после двух подтверждённых0/2; точная причина ещё не доказана, для неё сохранены failure snapshots следующего прогона.

Linuxc194 run44782939965/job136450126604 прошёл весь source pipeline, и независимый4f94 checker подтвердил installed sandbox/profile/task/stress/media/docs/footer/retained/current634 и633→634 обновления обоих форматов. Verification ZIP14651109375 SHA256e1c5aebeedef63375385f71fa461673ce4afbd4f3d4237251bc71c24b0b2455b; candidate ZIP14651069557 SHA256a39e91c12995556f32730cd7abb3899c7639e22d674c2cdfc80862a722df99fa, actual package sizes/digests и embedded manifests совпали. Этот PASS относится кc194 до нового wheel protocol; окончательныйsource требует свежих артефактов.

Python proof preflight16/16 и Node transport2/2 прошли. Real provider malformed URL учитывается в raw/rejected counters и отсекается перед usable поисковыми rows и top5 для ИИ, как в desktop boundary; empty/all-invalid/repeated-page2/nonvideo ответы не проходят. Независимый own-host AI proof выполняется и при внешнем body failure, но не отменяет ошибку public job; реальный ответ обязан содержать точный supplied sourceURL, generic fallback не принимается. Общий workflow envelope увеличен5→8min для новых независимых bounded tasks; public18s, transport/client12s, отдельные diagnostic VM60s и AI90s сохранены. Реальные новые network/model/native результаты ещё не получены; pins unarmed.


### Mouse 6.0.34 — настоящий внешний поиск и ИИ подтверждены; проверяется пагинация

Source `d335222057991893be588d8767b53038fe12339a`: Mac run44785594103/job136459481774 завершил owner634 search успешно, 9 стадий за12576ms. Все три wheel имеют trusted HTTP receipt, совпадающую IPC-передачу650 и фактическую прокрутку0→650→1300→1697; строгий release parser принял сохранённый до dispatch intent, точный видимый native/document owner, focus/pointer и прежний10s budget. Search SHA25612a136565f6892971caa051aa3bdf6e211ffb35545ce0bbc905bd1680fa53066, owner SHA256b0cf6ec8c1608445c9c98f2c02444e15c9b3f51da43481f954220d033a72dde8. Проверены36 search pixel probes,78 focused probes и30 canonical OS receipts. Artifact14653399202,14971132bytes,SHA256d71a93f5c58bbdcac15ff265b1f6d99b9d40c603ef5543bf80a0d6a1911c8f37.

Весь Mac run всё ещё failure: поздний `mouse-compact-smoke.cjs` обнаружил пересечение hitrect новой лупы с центральной36px областью Норы при ширине800px; actual failure PNG это подтверждает. Это отдельная реальная адаптивная теснота. Подготовленный narrow CSS сохраняет24px кнопки, gap4 и минимум12px до ИИ: library margin-right12→8 плюс settings margin-left5→0 освобождают4+5=9px. Широкая раскладка, центр Норы и строгий guard не меняются. Для следующего installed прогона сохраняются точные footer rects/overlaps в failure evidence. Linuxd335 run44785594130/job136459483473 SUCCESS; независимая проверка его точных артефактов ещё выполняется. Все будущие изменения требуют нового exact-head installed результата.

Public verifierd335 run44785580699/job136459511824 впервые получил полное тело внешней выдачи: Python page1 raw35/usable16 за2.126s; Node HTTPS с обычной CA/IP verification получил36344 из объявленных36344bytes, те же35/16, за1.832s. Curl HTTP1.0 получил6257 из6257bytes и10 пригодных результатов за1.870s. Прежний18s body timeout в этом запуске не воспроизвёлся; его причина не объявляется доказанной или исправленной. Отдельный настоящий REG AI proof принял5 пригодных найденных источников, вернул261 символ за3.592s и точный `https://docs.python.org/`; sourceUrlPresent=true, visionUsed=false. Artifact14654510836 SHA25641ea92aa257376f1a37d514ae4c28d8ed6e32d26deb884bb37ff7de87c10be99 содержит7 сохранённых raw файлов.

Public job остался failure на page2: raw20/rejected20/usable0. Закреплённый upstream `searx/engines/bing.py` явно не поддерживает paging, поэтому Bing на второй странице не запускался. Brave вернул malformed `http:///go/v1/...`, DuckDuckGo отказал CAPTCHA; такие rows не становятся живыми сайтами или ИИ-источниками. Video public-stage ещё не достигнут. Active runtime остаётся792ff9a, DNS/чужие сервисы не меняются.

Следующий bounded matrix proof проверяет Bing/Brave/Google/Yahoo/Qwant и Bing videos через точный installed facade/upstream с отдельной копией настроек и own state. Единственный60s user-unit ограничен256MiB/25%CPU/64tasks; active settings/runtime не переписываются. После CAPTCHA/access denied/429 у данного источника нет повторной страницы или обхода. Локальный helper прогон исполнился полностью, но не считается VM/public acceptance: Bing videos дал30 пригодных URL, Yahoo page2 дал7, тогда как Yahoo page1 истёк по4s. Ни один general paging source пока не принят. Локальные16 Python и2 Node tests, AST/YAML/bash проверки прошли; решение о смене active engines принимается только после фактического VM matrix.

Release `7090a5c5a899ec3fc430a36b752ec5de3c567fb9` закрепляет strict wheel parser SHA256f828c2ed5d299d440b116a6ac118ca3df02eaeedcba370a90a66be6d92d009f0. Локально прошли29 search,60 required owner и8 reuse tests; Macd335 raw независимо принят этим exact parser, но wholeRunAccepted=false из-за compact failure. Все634 pins по-прежнему ready:false, PR62 draft, публикация ещё не состоялась.

Preflight текущего footer checkpoint:33/33 существующих613/615/616/617/search-helper tests, node syntax и diff-check прошли. Узкий settings selector имеет достаточную специфичность для позднего633 CSS. Exact geometry/отсутствие overlap ещё должен подтвердить новый установленный пакет; прежние assertions не ослаблены.


### Mouse 6.0.34 — подтверждён источник второй страницы и исправлены ожидания retained-проверок

VM matrix на source21f38013f766bf3e6a3bc49d73e9e37ce46cc8e2, run44787920514/job136467688955, проверил exact upstream1ebea4a на установленном Python3.14.4. Yahoo вернул page1:7/7 пригодных URL за2.130s и page2:6/6 за0.606s, все6 новые относительно его первой страницы. Bing videos вернул30/30 за0.565s. Matrix8.665s/68.1MiB. Artifact14653684806,9826bytes,SHA256220e020742ab8c6cb564d4037ac699ee5a14936ab362327540b1a9f736634c76. Старый active792 public gate всё ещё отказал на page2; это не подменяется результатом отдельного matrix. Реальный AI снова дал exact supplied URL,240 символов за1.915s.

Подготовлена только подтверждённая настройка Yahoo: прежние engines,4s/6s deadlines и live512MiB/25%CPU/64tasks сохранены. Отдельный `[configure-mouse-search]` workflow проверяет неизменные792 facade/settings/unit/dependency hashes, точный upstream/venv и current lease; создаёт новую immutable configuration release с явными engine/facade792 provenance и только двумя ограниченными ссылками на прежний source/venv. Новая настройка активируется атомарно с обычной TLS health-проверкой и возвратом previous current при неуспехе, без установки пакетов, изменения DNS или чужих сервисов. Config worker128MiB/10%CPU/16tasks/120s;23 Python и2 Node tests, AST/YAML/bash checks прошли. Полный внешний page1/page2/distinct URLs/video/400 и AI proof ещё должны пройти после реальной активации.

Mac21f380 run44787934552/job136467647058 подтвердил исправленный footer на1440/1100/900/800px: overlaps=[], все controls hit:true. На800 Nora[382,418], search[421.875,445.875], зазор3.875px; фактический gap до ИИ12px. Current owner634/search также независимо принят release7090. Общий Mac run остановился позже в630 capture: отсутствовал terminal-layout barrier после отмены normal background download. В отличие от остальных terminal cases тест ждал лишь main DownloadItem.state, затем сразу начинал guarded capture. Raw не сохранял pin/current значения, поэтому конкретный изменившийся ключ не объявляется доказанным. Узкая fixture правка использует существующий sample(cancelled), который ждёт DOM/native restoration, прежние2RAF и сохраняет truthful pre-capture window/WC/epoch/geometry. Product capture guard, число попыток и deadlines не менялись; существующий negative geometry test прошёл.

Windowsd335 current owner634/search независимо прошёл release7090, но поздний retained628 footer gate пытался получить exposed toolbar через elementFromPoint при открытом modal Nora. Actual PNG подтверждает затемнение toolbar и неизменный footer; showModal делает underlying hit targets inert. Подготовлен точный pre-modal reference: для каждой темы и viewport сохраняются настоящие PNG/SHA, затем footer сравнивается с прежними RGB при строгом совпадении underlying CSS/bounds и fully-open Nora. Сохранены все глубины.5/1.5/2.5, tolerance2 и deepEqual before/after;12 focused helper tests и2 retained fixture tests прошли. Независимый review подтвердил все modal call sites и отсутствие alias/stale geometry fallback. Новый installed результат ещё требуется.

Linux21f380 run44787934332/job136467646459 целиком SUCCESS; verification artifact14655512803,17991491bytes,SHA256be0069e46a4d7cf0654cabe329ec20a9b9554ccd539fff307e51ac7f30851d41. Все5 release7090 contract jobs SUCCESS, publishers SKIPPED. Финальные source/artifact pins остаются ready:false до полной приёмки нового exact head и действующего public search/AI; промежуточная сборка не публикуется.


### Mouse 6.0.34 — retained AI-header selector и отдельная транспортная диагностика

Sourceceab81766e2c40dd685e72eb2ba71625f1007873 Mac run44790072420/job136475093604 прошёл прежние blockers: actual markers MOUSE_630_CAPTURE_FEEDBACK_PASS, MOUSE_628_BORDERLESS_NATIVE_PASS и NORA_CONTENT_FIT_PASS. Current634 owner/search независимо принят release7090 по raw PNG/receipts; whole run остановился позже в старом606 fixture: headCount0 вместо1, потому что строка ИИ теперь находится в #ai-chat-pane. Подготовлен точный selector #ai-panel>#ai-chat-pane>.ai-controls и проверка отсутствия legacy heading внутри всего #ai-panel. Count1,28px geometry, icon/menu/no-reload assertions сохранены, product не меняется. Других старых direct-child AI selectors в runtime smokes не найдено;6 существующих606 tests и diff-check прошли. Verification artifact14656204082,32478095bytes,SHA2560cc9f234cb9700a3cae226bb68578aa4d3ae89fa961b4769832c84e82978700e. Новый exact-head native run ещё требуется.

Own Yahoo configurationceab реально активирована run44790061596/job136475127369 за6.679s: activated=true, rolledBack=false, normal TLS/caps прошли. Engine/facade остаются immutable792, config SHA256417c46134ef009aa329447448f3e59b15b18f6d4b558d0fbf23b66f8a884742e. Однако внешний verify вновь получил HTTP200 headers без тела: Node7335declared/0received и curl7362/0 истекли по прежним12s. Тот же VM запрос вернул7335bytes/10results за1.092s, health0.004s; реальный groundedAI275chars/2.823s PASS. Transport причина не объявляется доказанной. Raw verification artifact14655867378 SHA2560a95ab19951d4dfe273b509905a08c6ef306934040ba3ae578553dea430d8cd6.

Сетевая диагностика вынесена в отдельный worktree/branch fix/mouse-search-transport-proof, чтобы приложение продолжало свой exact-head native прогон. Следующий bounded read-only proof сопоставляет внешний клиент с TCP очередью/подтверждениями только собственных3082 connections, с явной PID attribution; никаких payloads, сетевых/sysctl/firewall изменений или обхода TLS. Публикация634 по-прежнему требует успешную реальную внешнюю выдачу/paging/video/AI и все native платформы; pins не armed.


Windowsceab run44790072536/job136475175587 прошёл current634 search/native и retained628/Nora, затем остановился в agentPTYLocalMCP: после client.clickSelector('#action') немедленно прочитано Ready вместо Windows native click. Current634 независимо принят7090: ownerSHAbd0720a2e3af0c5d56bade15aac0b270517f05c650594b71a01bfc9042561c28, searchSHA79b78103d6b84718a56b53e63f543fd560eaa6fe34f2aeea12802aab85452df4,28 OS receipts. Verification ZIP14656014378,32258780bytes,SHA2563e5678a953ae671a932381b46bb6b59b96aecbbc32b00a367bdd46a14fa12bb0. Failure PNG снят после cleanup и не доказывает координаты/доставку спорного клика; historical root cause неизвестна. Modern Windows не запускался.

Узкая Windows fixture правка сохраняет единственный прежний SDK clickSelector, production Host/SDK и input guards. Прежний15s deadline теперь общий для loading, видимого exact native owner/active slot, viewport/zoom/focus, двух стабильных кадров и фактического результата этого клика. Passive loopback CDP observer сохраняет ровно переданные Input.dispatchMouseEvent; owned fixture отдельно регистрирует trusted pointer receipt с document identity/timeOrigin. Success требует настоящие Windows native click и trusted click по #action; повторных кликов нет. mouse-windows-agent-click.json пишется до внешнего cleanup, включая failure witness.8 адресных existing Agent tests и7 lifecycle tests, syntax/diff-check прошли. В более широком локальном запуске2 старых MCP-child tests получили Connection closed; они не загружают изменённый fixture, unrelated runtime не правится и полный локальный suite не объявляется успешным. Новый установленный прогон обязателен.

Linuxceab run44790072458/job136475094923 полностью SUCCESS и независимо принят7090, включая actual AppImage/deb bytes, installed gates и оба обновления633→634. Candidate ZIP14656537580,243132735bytes. Verification ZIP14655813457 SHA2568eceebab64279ef9de469c3aadfa535fe6e2d8169b0671321e191d4efe6fa690. Candidate ZIP SHA256dc49d59fa2f3c98cb5e52bcc340392a12595910511925512db00db9d6867db35. Этот результат относится кceab; финальный app SHA требует свежую whole-run приёмку.

Backend diagnosticdf91cdf0663f921db6b1cd641b1b632b5d6b37c4/run44794587805/attempt1 сохранил serviceceab без deploy/configure. Весь public search/page2/video/400 gate впервые SUCCESS; Node7335bytes1.489s и curl7362bytes1.392s получили полные тела. Sampler завершил40.060s/82samples без netlink warnings: это baseline успешной передачи, не доказательство причины прежнего stall. Поздний реальный AI gateway запрос получил HTTP502, поэтому whole verifyFAIL. Artifact14658831050,6257bytes,SHA256ddac70f495daa70491ebc264c72612866c4b2e1fb360262dd1ddece059928553. Один повтор только failed verify job запущен для проверки наблюдавшегося502, без увеличения deadlines и без deploy. Release pins остаются ready:false.


### 2026-11-21 — продолжение Mouse 6.0.34, независимая приёмка и Mac lifecycle diagnostics

Восстановлены исходные ТЗ и место остановки предыдущего чата. Подробные ссылки, точные исходники, размеры/SHA-256 артефактов и честные пределы сохранены в [контрольной точке 6.0.34](docs/desktop/2026-11-21-mouse634-release.md). Source `c865fe56d81f74a71f63bcf88a2849cf315dbe70`: Windows run44795541070 (оба native jobs) и Linux run44795541171 независимо приняты неизменным release verifier7090, включая реальные пакеты, raw PNG/receipts и переходы633→634. Последний public search/AI run44797452740 на verifier8d959 также успешен; это не доказательство устранения причины прежнего502.

Mac run44795541096 attempt2/job136667505787 построил и установил приложение, но owner634 достиг общего240s timeout в visual-search. Начальные light/dark pixels и два trusted wheel прошли; третий JSON остановился на prepared до сохранения dispatch. Target WC12 к watchdog был уничтожен. В smoke обнаружены unbounded renderer diagnostics/cleanup; узкая lifecycle-правка сохраняет точные границы и исходную ошибку, ограничивает ожидания, принимает уничтожение цели как завершённую очистку только после фактического подтверждения. Ввод, assertions,10s wheel/240s total budgets не ослабляются. Причина исторического зависания пока не объявляется доказанной. Новый source требует новых полных platform runs. PR185/PR62 ещё не объединены, release pins ready:false, публичные каналы остаются6.0.33.


### 2026-11-21 — Source5854, Linux полный PASS и отдельный Mac motion rerun

[Подробная контрольная точка](docs/desktop/2026-11-21-mouse634-release.md) дополнена свежими точными данными. Source5854b27: Linux run44848160942 целиком принят frozen7090 независимой проверкой, включая оба пакета и реальные633→634 updates. Public search/AI run44797452740 attempt2 также SUCCESS без deploy/configure; прежний502 не объявляется исправленным. Mac run44848160977 attempt1 подтвердил owner634/search и все3wheel с корректным destroyed cleanup, но позже retained628 получил2intermediate dark-closing frames при пороге≥3. Native trace содержит GPU scheduling waits70–88ms; controls на том же приложении дали7/4кадра и проходят прежние критерии. Причина intermittent результата не объявляется установленной. После разбора запущен один unchanged Mac attempt2/job136677035324; ни input, ни animation, ни критерии не ослаблены. Windows ещё проходит native acceptance; публикация пока не состоялась.


## 2026-11-21 — 6.0.34: Windows 5854 принят, Mac GPU stall подтверждён

[Windows run 44848160945](https://github.com/jeep-jim/OSMINOG/actions/runs/44848160945) для source `5854b271a42fa9d00e77efd19e1ce3137dabff29` завершён SUCCESS: основной job136672903813 и modern136678596380. Оба независимых frozen7090 replay, actual633→634 и byte/provenance checks прошли. Linux5854 также принят. Эти доказательства не переносятся на будущий изменённый исходник.

[Mac attempt2/job136677035324](https://github.com/jeep-jim/OSMINOG/actions/runs/44848160977/job/136677035324) вновь прошёл owner634/search, но failed на `light closing paints at least three intermediate frames` (2 вместо≥3). Сверенный raw ZIP14685226072:29022489bytes, SHA256 `433c4475d89ef2fbed9c885945c81543b4620d8c053a0bd64c4918227f2eec94`, CRC341entriesPASS. Выбранный native capture callback пришёл после завершения motion примерно на412ms, поэтому его selected-PNG encoding не мог вызвать предшествующую нехватку RAF. Подготовленная отдельно deferredPNG-правка прошла локальные тесты и review, но **не внесена как исправление этой ошибки**.

В полном trace обнаружены длинные GPU `IOSurfaceImageBacking::WaitForCommandsToBeScheduled::Dawn` ожидания; такие ожидания есть и в diagnostic control без frame subscription. Primary Chromium152 код связывает этот участок с ожиданием scheduling перед CoreAnimation. Источник задержки ниже этого GPU fence пока не установлен. Следующий шаг — отдельное диагностическое сравнение неизменённого installed5854 binary default / Graphite-disabled / default на одном Mac runner, с отдельными профилями, исходным native smoke и прежними порогами. Это не приёмка и не основание публикации. Source/release PR не объединены, каналы остаются6.0.33. Подробности и все ограничения: [release checkpoint](docs/desktop/2026-11-21-mouse634-release.md).


## 2026-11-21 — 6.0.34: ограниченная оптимизация отрисовки chrome

После анализа двух Mac failures подготовлена правка только `desktop/mouse/mouse-634.css`: сняты backdrop-filter и -webkit-backdrop-filter с непрозрачных toolbar/footer/pane-head/AI-controls и их button/select. Сами цвета, градиенты, размеры и размещение не меняются; стеклянные dialog/start-page/library/settings не входят в селекторы. В raw5854 trace измерены47 backdrop-filter surfaces, обычно67 total surfaces и34–35 DrawRenderPass на кадр. Структурный подсчёт controls в fixture также даёт47, но runtime mapping каждого effect к DOM отсутствует; фактическое сокращение должна подтвердить новая native trace. Цвет каждого внутреннего пикселя кнопок заранее не объявляется идентичным.

114/114 существующих адресных tests прошли с установленными зависимостями того же lockfile; CSS разобран закреплённым esbuild0.28.2, diff-checkPASS. GPU/анимация/native inputs/длительность300ms/≥3frames/приёмочные parsers не менялись. DeferredPNG не включён. План Graphite A/B/A оставлен незапущенным: exact Chromium152 на MacARM64 не имеет HARDWARE_GL fallback, поэтому отключение Graphite может выключить аппаратную обработку и не выбрано как исправление. Нужны свежие полные Windows/Linux/Mac runs и независимые package/evidence checks. До них release остаётся незавершённым. [Подробный checkpoint](docs/desktop/2026-11-21-mouse634-release.md).


## 2026-11-21 — 6.0.34: новый Mac motion прошёл, исправлен порядок проверки footer

Source `602b9025e5e39cc06983813b676ea3c463cfaa3c` проверен после сокращения backdrop effects. [Mac run44853206661/job136689186392](https://github.com/jeep-jim/OSMINOG/actions/runs/44853206661/job/136689186392) прошёл owner634/search и полный retained628 motion: light opening/closing18/17 intermediate frames, dark17/18 при прежнем пороге≥3. В соответствующих trace windows нет backdrop-filter surface reasons, total surfaces3–4, DrawRenderPass2–4 вместо прежних47/67/34–35. Это измерение нового прогона, а не формальный эксперимент, доказывающий все причины GPU stalls.

Позже Mac остановился на `Every footer depth has an exposed toolbar reference` в623 capture. Реальная Nora уже открыта модально, а helper искал незакрытый toolbar через hit testing после showModal. Исправление только в smoke: после смены темы и painted() сохранить настоящий pre-modal PNG, его SHA-256 и измеренные reference pixels; в каждом открытом состоянии требовать ту же тему, viewport, bounds/CSS обоих баров и fully-open Nora. Сохраняются6content states,12footer probes на состояние и исходный допуск±3RGB, все shape/geometry/accessibility/lifecycle checks. Product CSS602b, native input, timing, GPU и frozen release parsers не меняются.

[Linux run44853206663/job136689186738](https://github.com/jeep-jim/OSMINOG/actions/runs/44853206663/job/136689186738) полностью принят independent frozen7090: точные package/archive bytes,145Git blobs verifier, реальные633→634 дляdeb/AppImage с профилем,178/178 и1009PASS/0FAIL/6SKIP. Восьмь focused native PNG просмотрены; новая белая download arrow в dark Nora обусловлена истёкшей completed activity до снимка, зелёный unread badge4 остаётся. Windows602b на момент checkpoint ещё проверяется. Новый source с исправленной623fixture требует новых полных платформенных прогонов; source/release PR не объединены и публикации нет. [Доказательства и пределы](docs/desktop/2026-11-21-mouse634-release.md).

Локальная проверка минимального623patch:43/43testsPASS,0fail/0skip; синтаксис всех3файлов иdiff-checkPASS. Независимые reviews подтвердили сохранение условий и совместимость frozen7090. Это не заменяет новый installed run.


## 2026-11-21 — 6.0.34: retained623 принят, следующий624 требует завершённого native transition

Source `d6f65ecee75528966af64597881ab9ae2760138e`: [Mac run44854934410/job136694793849](https://github.com/jeep-jim/OSMINOG/actions/runs/44854934410/job/136694793849) прошёл полный628 motion,623geometry во всех6состояниях, tab lifecycle и обычный Agent entry. Независимая декодировка actual623PNG подтвердила2baseline references сSHA,6reference pixels и72footer probes при прежнем±3. Позднее624 завершился `Mouse622 timeout: Agent service restores focus and opens` после настройки из pane fullscreen.

На failure checkpoint окно уже вернулось к1008×668/x8/y33, actual leave-full-screen произошёл, renderer focus снят, Agent=false. Screenshot снят после624finally и показывает ещё открытые настройки; он не доказывает точную геометрию в момент прошлого клика. В текущем route footer Settings сам вызывает pane-restore, чей IPC возвращает сразу, а624 ждал native leave event/bounds лишь после последующего assistantclick. Этот пробел ожидания исправляется узко в fixture: завершение native transition и устойчивые исходные bounds должны быть подтверждены до вычисления следующей цели. Добавляются пассивные before/after snapshots и trusted click receipt; точная историческая OS-race не объявляется доказанной. Product code и критерии приёмки не ослабляются.

[Linux d6f65e/run44854934436/job136694794224](https://github.com/jeep-jim/OSMINOG/actions/runs/44854934436/job/136694794224) полностью принят frozen7090 independent replay, включая оба actual633→634 upgrades, package/provenance bytes и145verifier blobs. Unit178/178 и1012PASS/0FAIL/6SKIP. Остальные7общих workflowsSUCCESS; Windowsещё вnative acceptance на этой контрольной точке. Это исторические доказательства данного head; новый исправленный source потребует новых platform runs. PR185/PR62 не объединены, публикации нет. [Подробности](docs/desktop/2026-11-21-mouse634-release.md).

Финальный624patch проверен29/29адресными tests,0fail/0skip; синтаксис иdiff-checkPASS. Новые diagnostics/read/write/dispose ограничены1500ms существующим helper; failure diagnostics сохраняют исходную ошибку, а обязательная запись успешного proof остаётся строгой. Старые input/readiness/pixel/motion budgets и продуктовые файлы не менялись.

## 21.11.2026 — 6.0.34, точная причина отказа диагностического снимка 624

Исходный checkpoint [6a7835e38910ca583d9c5892c0249c61ea95b456](https://github.com/jeep-jim/OSMINOG/commit/6a7835e38910ca583d9c5892c0249c61ea95b456) не принят для публикации. В [первой Mac-попытке44857061466](https://github.com/jeep-jim/OSMINOG/actions/runs/44857061466/attempts/1) не пришёл trusted receipt первого клика по Download A; сохранённый кадр показывал открытые ссылки, но dispatch-time координаты не попали в отчёт, поэтому причина этого отдельного отказа не установлена. После проверки неизменности owner634/native-input кода выполнен один диагностический повтор без изменения кликов, лимитов или условий приёмки.

[Mac attempt2/job136703451841](https://github.com/jeep-jim/OSMINOG/actions/runs/44857061466/job/136703451841) прошёл весь owner634 (43512ms, restored:true), visual search (14952ms), прежние проверки628 и623. Затем новый снимок624 упал **до** клика по нижней кнопке настроек: в сериализованном renderer expression свойство `target:{selector,...}` ссылалось на переменную основного процесса, которая не была передана в renderer. Независимое исполнение точной строки в отдельном VM воспроизвело `ReferenceError: selector is not defined`; это подтверждённый дефект добавленной диагностики, а не доказательство отказа пользовательской команды.

Исправление передаёт selector явным сериализованным значением через общий helper, который используется и настоящим smoke, и VM-регрессией. Ввод остаётся одним нативным кликом на каждую команду; шесть последовательных наблюдений завершённого выхода из fullscreen, прежние бюджеты, проверки layout/page identity, отключённого Agent и frozen release validators сохранены.

Адресный набор: **52/52 PASS**, включая исполнение настоящей renderer-строки без внешнего selector, обе кнопки, отсутствующую/скрытую цель, исходные bounds/receipt/error-budget contracts. До исправления все четыре новые VM-проверки воспроизводили именно ReferenceError; независимый review повторил **4/4 PASS** и сравнил старую/новую строки: единственное содержательное изменение — явное значение target.selector. Код поиска, загрузок, настроек, Agent, CSS, GPU-флаги и release validators этим шагом не меняются.

Для6a Linux [44857061369](https://github.com/jeep-jim/OSMINOG/actions/runs/44857061369) принят вместе с точными AppImage/deb, полным frozen7090 replay и обоими фактическими633→634; основной Windows [136701665120](https://github.com/jeep-jim/OSMINOG/actions/runs/44857061566/job/136701665120) также прошёл полную независимую проверку EXE. Это исторические результаты прежнего HEAD: они не подменяют приёмку пакетов следующего исходного кода. SourcePR185 и releasePR62 остаются открыты; публикации6.0.34 нет. Следующий шаг — полный свежий source gate после узкого selectorfix, затем точные pins, merge, свежие publisher gates и обратная проверка публичных пакетов/каналов.


## 21.11.2026 — Mouse 6.0.34: исходники приняты, выпуск запущен

[Source PR185](https://github.com/jeep-jim/OSMINOG/pull/185) объединён в main: проверенный исходник `bc4cafb5c2db9cfc80165a7c470c813f0235cd04`, merge `b1b87fb29f74e4917758f27c93ffc775311df32e`. Дерево merge побайтно совпадает с принятым деревом `780b359da490e891ff668ba293a3698c0a762e14`. Все десять source workflows прошли.

Независимая приёмка frozen7090 завершена для Mac [44859182971, attempt2](https://github.com/jeep-jim/OSMINOG/actions/runs/44859182971/attempts/2), Windows [44859182960](https://github.com/jeep-jim/OSMINOG/actions/runs/44859182960) на двух runner и Linux [44859183010](https://github.com/jeep-jim/OSMINOG/actions/runs/44859183010) в AppImage/deb. Приняты точные package/archive SHA-256, raw native evidence, текущие и прежние функции, сохранение профиля и фактические обновления 6.0.33→6.0.34. Свежие принятые снимки просмотрены вручную.

Первая трасса Mac на этом же исходнике остаётся отклонённой из-за неоднозначных одинаковых микросекундных меток. Вторая полная запись прошла прежний анализатор; код, ввод, временные пороги и критерии между попытками не менялись.

[Release PR62](https://github.com/jeep-jim/OSMINOG-Releases/pull/62) объединён merge `f0cdcc4051e257b56b1710176592007d255349ad` после всех пяти контрактных проверок. Три ready pins содержат принятые пакеты и реальный source merge. Дополнительное изменение `0ef0ba1bf324701a9f8dfb940457b9f6030f1706` исправляет только два теста, ошибочно считавших рабочие pins всегда черновыми: временные fixtures сохраняют отрицательные проверки, готовое состояние проверяется штатными валидаторами. Производственные валидаторы, адаптеры, workflows и байты пакетов сохранены.

Запущены свежие publisher проверки: [Mac 44863799449](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44863799449), [Windows 44863799470](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44863799470), [Linux 44863799473](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44863799473). **Этот checkpoint ещё не подтверждает публикацию:** необходимы свежая установка точных пакетов, публичные файлы, feeds и анонимная проверка настоящих старых обновляторов. Подробности и сохранённая история отказов — в [журнале 6.0.34](docs/desktop/2026-11-21-mouse634-release.md).

## 21.11.2026 — Mouse 6.0.34: опубликован и проверен

**PUBLISHED / VERIFIED_DOWNLOAD: macOS arm64, Windows x64 и Linux x64.** Это итоговая запись, следующая за сохранённым checkpoint «выпуск запущен». Все три publisher workflows завершились SUCCESS: [macOS arm64 / 44863799449](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44863799449), [Windows x64 / 44863799470](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44863799470), [Linux x64 / 44863799473](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44863799473); каждый — attempt1 на release merge `f0cdcc4051e257b56b1710176592007d255349ad`. Исходники `bc4cafb5c2db9cfc80165a7c470c813f0235cd04` объединены [source PR185](https://github.com/jeep-jim/OSMINOG/pull/185), публикация — [release PR62](https://github.com/jeep-jim/OSMINOG-Releases/pull/62).

Свежие установочные отчёты издателей независимо перепроверены production validators frozen7090. Проверены фактические установленные переходы 6.0.33 → 6.0.34 и сохранение тестовых профилей. Отдельные фактические receipts подтвердили анонимные загрузки старыми updater-модулями: Mac/Windows 6.0.29, Linux 6.0.33; установленная 6.0.34 определяется как актуальная. Все 14 публичных файлов полностью скачаны анонимно, размеры и SHA-256 сверены с принятыми данными. Проверены Mac channel и latest/versioned feeds Windows/Linux.

Скачать: [Mac arm64 DMG](https://github.com/jeep-jim/OSMINOG-Releases/releases/download/quadro-macos-v6.0.34-arm64/Mouse-Browser-6.0.34-mac-arm64.dmg), [Mac arm64 ZIP](https://github.com/jeep-jim/OSMINOG-Releases/releases/download/quadro-macos-v6.0.34-arm64/Mouse-Browser-6.0.34-mac-arm64.zip), [Windows x64 EXE](https://github.com/jeep-jim/OSMINOG-Releases/releases/download/mouse-windows-v6.0.34-x64/Mouse-Browser-6.0.34-Windows-x64.exe), [Linux x64 AppImage](https://github.com/jeep-jim/OSMINOG-Releases/releases/download/mouse-linux-v6.0.34-x64/Mouse-Browser-6.0.34-Linux-x64.AppImage), [Linux x64 deb](https://github.com/jeep-jim/OSMINOG-Releases/releases/download/mouse-linux-v6.0.34-x64/Mouse-Browser-6.0.34-Linux-x64.deb). [Подробный журнал, SHA-256, runs/artifacts и границы проверки](docs/desktop/2026-11-21-mouse634-release.md). Mac остаётся Apple Silicon preview без Developer ID/notarization; Windows — unsigned preview. Проверки относятся к указанным CI-системам и тестовым профилям, не к личному устройству владельца. Прежняя причина HTTP502 не установлена и не объявляется исправленной. Инфраструктура АвтоЦены не затрагивалась.
