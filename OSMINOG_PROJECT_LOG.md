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

