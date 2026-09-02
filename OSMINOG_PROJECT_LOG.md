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



---

## 2026-09-01 — 3.11.41 UPDATE BUTTON RUNTIME PROOF

### Starting state
- OSMINOG 3.11.40 was installed as the owner's unpacked Chrome extension.
- The signed-envelope development feed and GitHub Release publisher had been repaired, but no real owner-side button transition had yet been recorded.

### Confirmed owner runtime result
- The owner pressed the in-product **Check and update** button.
- OSMINOG displayed real package progress and completed the update from **3.11.40 to 3.11.41**.
- After reload, the product header and update panel both reported **v3.11.41**.
- This is the first owner-confirmed successful OSMINOG button update in the project history.

### Published artifact
- Release: https://github.com/jeep-jim/OSMINOG-Releases/releases/tag/chrome-v3.11.41
- Package: `OSMINOG-Chrome-3.11.41-UNIFIED-CANVAS-TOOLBAR-ROOT.zip`
- Size: `365952` bytes.
- SHA-256: `1360a3a678a4d3e9a12856128285cd50b88e9329ce3554b58217e984ed375eb5`.

---

## 2026-09-01 — 3.11.42 POSEIDON MAX ACCESS

### Owner request
Transform OSMINOG from a growing AI brief builder into a general AI-native workspace. Any connected AI should receive the maximum capability set actually available in the product: canvas, real images, projects, agents, internal commands, browser, files, source code and GitHub. Preserve the now-proven update button path.

### Root cause found
- Internal Team contexts advertised a broad tool surface.
- The external ChatGPT Presence transport used by the owner still advertised only the short canvas inspection subset.
- Consequently, one session could write an OSMINOG module through Poseidon while another connected ChatGPT could not request the actual image bytes, source-folder tools, project tools or command tools.

### Built changes
- Added `osminog.capabilities/v1` as the actual Owner Max capability manifest exposed through Presence.
- External ChatGPT, internal agents and provider sessions now receive the same comprehensive tool contract.
- Raised one tool hop to eight calls and bounded consecutive tool-result hops at eight.
- Added `read_asset` for delivering real image bytes and text assets to the AI; added `asset_create` for placing returned data/URL assets on the canvas.
- Added project list/create/switch/rename tools.
- Added agent create/update/remove/delegate tools.
- Added an owner-confirmed custom command registry with prompt, tool and chained commands; Team Room can execute registered slash commands.
- External read/comment roles cannot call mutating tools. Canvas patches remain validated and undoable. Poseidon source writes still require its toggle and a selected source folder. GitHub writes still require owner confirmation.
- Native shell execution is not claimed: the current Chrome-extension runtime has no native terminal. Generative media execution remains dependent on the connected provider.
- Existing update feed parsing and the 3.11.41 button path were preserved.

### Verification
- 24 JavaScript syntax checks passed.
- 9 JSON parse checks passed.
- Command registry smoke test passed.
- ZIP contains 59 files, root manifest 3.11.42 and the fixed extension key.
- ZIP integrity passed.
- Package size: `372440` bytes.
- SHA-256: `a8651f1467291743378b7ad6a151208368aca51bf9ab85f9f4a63389562d6ca2`.
- GitHub publisher run `33494063169` completed successfully.
- Public feed is active and points to 3.11.42 with the exact size and SHA-256 above.

### Published artifact
- Release: https://github.com/jeep-jim/OSMINOG-Releases/releases/tag/chrome-v3.11.42
- Direct package: https://github.com/jeep-jim/OSMINOG-Releases/releases/download/chrome-v3.11.42/OSMINOG-Chrome-3.11.42-POSEIDON-MAX-ACCESS-ROOT.zip

### Runtime verification required
1. From owner-confirmed 3.11.41, press **Check and update** and verify 3.11.42 loads.
2. Reconnect the current external ChatGPT with role **Edit**.
3. Ask it to call `capabilities` and confirm Owner Max reports project/agent/command/asset/source/GitHub groups.
4. Select an image object and ask ChatGPT to inspect it through `read_asset`; confirm a real image attachment arrives in ChatGPT.
5. Ask ChatGPT to create a test project, a test agent and an owner-approved slash command; verify each appears in OSMINOG.
6. Confirm a read-only Presence role receives an explicit error for mutating tool calls.

### Exact next action
The owner performs the 3.11.41 → 3.11.42 button update and the six runtime checks above. Record only observed results; do not mark Owner Max runtime-verified from static checks alone.


---

## 2026-09-01 — 3.11.43 UNIFIED AI SESSIONS

### Owner request
Remove the mismatch where OSMINOG presented “Internal tabs” but every provider connection still created a minimized background Chrome window. Any provider selected in a project chat should connect through the same in-chat UI, reuse an already-open desktop tab when possible, show a named reconnect action after disconnection, and preserve the proven update button.

### Browser constraint confirmed
- Manifest V3 extension pages cannot embed protected ChatGPT, DeepSeek, Gemini, Claude and similar web apps when their CSP / X-Frame-Options blocks framing.
- Therefore this release does not pretend that an iframe or a hidden window is a true internal browser.
- The OSMINOG project conversation remains inside the OSMINOG chat.
- A provider webpage is attached only when an authenticated normal Chrome tab already exists.
- If login is required, the owner must explicitly press “Open for login”; no provider page is created silently.
- Literal provider WebViews inside one product window require a later native desktop shell or official provider APIs.

### Built changes
- Replaced the connect-first background window path with OSMINOG_SESSION_CONNECT_EXISTING.
- Added a generic provider-origin resolver covering ChatGPT, DeepSeek, Google AI, Gemini, Claude, Alice, Nano Banana and the rest of the provider registry.
- Added transport aliases, including Nano Banana through the Gemini web transport.
- Removed the remaining chrome.windows.create path from the background service worker.
- Added one unified “AI connections” center inside chat settings.
- Redirected the old toolbar tabs icon, provider catalog entries and Google AI connect button to the same session manager.
- Added “Connect open tab” and explicit “Open for login” actions.
- Added live connected-provider chips.
- Added disconnect detection for closed tabs and navigation away from a linked provider.
- Added a provider-named reconnect popup and restored the chat connect button when the selected provider is offline.
- Preserved direct ChatGPT session transport and Custom OpenAI-compatible API transport.
- Preserved manifest key, permissions and the byte-identical working updater.

### Verification and publication
- 24 JavaScript syntax checks passed.
- 9 JSON parse checks passed.
- No chrome.windows.create call remains.
- ZIP integrity passed; root manifest is 3.11.43 and the fixed extension key is preserved.
- Package size: 375069 bytes.
- SHA-256: db29e7bcf99cee27d50c73ed9e571de47b7e10a21eb4996a628783ba4f103306.
- Registry validation, registry integrity and the primary publisher run completed successfully.
- Public release asset matches the exact size and SHA-256.
- Dev feed is active and points to 3.11.43.
- A redundant dispatched publisher attempt raced the already-successful publisher and remained red at its feed-advance step; it did not alter the valid release, asset or active feed.

### Published artifact
- Release: https://github.com/jeep-jim/OSMINOG-Releases/releases/tag/chrome-v3.11.43
- Direct package: https://github.com/jeep-jim/OSMINOG-Releases/releases/download/chrome-v3.11.43/OSMINOG-Chrome-3.11.43-UNIFIED-AI-SESSIONS-ROOT.zip

### Runtime verification required
1. From 3.11.42, press **Check and update** and verify 3.11.43 loads.
2. With DeepSeek already open and signed in, select DeepSeek in an OSMINOG agent and press **Connect open tab**; confirm no new window or tab is created.
3. Close the linked DeepSeek tab; confirm the named reconnect popup appears and the chat connect button returns.
4. Press reconnect while no matching tab exists; confirm OSMINOG opens connection settings without creating anything.
5. Press **Open for login**; confirm one visible normal tab opens only from this explicit action.
6. Repeat attach/disconnect with Google AI or Gemini.
7. Confirm ChatGPT direct transport and the update button still work.

### Exact next action
The owner performs the 3.11.42 → 3.11.43 button update and the seven runtime checks above. Record only observed results; do not mark Unified AI Sessions runtime-verified from static checks alone.

---

## 2026-09-01 — 3.11.44 CONNECTION CENTER UI REPAIR

### Owner report
3.11.43 regressed the established chat UI: the settings column was crushed, the connect actions overlapped, the old Internal tabs window disappeared, the chat sections no longer adapted to the resized window, and the only visible connect action became a small grey button in the thread bar.

### Built changes
- Restored the previous Internal tabs surface as a dedicated unified AI connection center.
- Routed connect actions from chat, agent settings, Modules, provider catalog, desktop provider shortcuts and Google AI into this same center.
- Added separate Active connections and Quick access sections.
- Quick access is generated from core chat providers plus every provider selected in Media Crew or placed on the desktop through Modules.
- Preserved the existing-tab-first connection policy and explicit visible login-tab action.
- Removed the compact grey header connect action.
- Added a large branded Connect button inside an empty disconnected chat.
- Kept the prior agent tabs, chat center, settings, roles, tools, Poseidon and GitHub sections.
- Replaced hard expansion of the messenger window with width-preserving clamping.
- Added container-responsive side panes: below the safe chat width, Team and Settings overlay the chat instead of shrinking it.
- Preserved provider-named disconnect/reconnect notifications.
- Preserved direct ChatGPT, DeepSeek web, Gemini/Google AI, generic provider and Custom API routes.

### Verification and publication
- 24 JavaScript syntax checks passed.
- 9 JSON parse checks passed.
- Connection-center state smoke test passed.
- CSS brace/structure check passed.
- No chrome.windows.create call exists.
- Fixed extension key and permissions match 3.11.43.
- osminog-folder-updater.js is byte-identical to 3.11.43.
- ZIP integrity and root manifest checks passed.
- Package size: 378050 bytes.
- SHA-256: ada1b5e73bd257ca01edbdf449ed2d4e5aecffcf9947638d5c262d8e1a764c6b.
- Primary publisher, registry validation and registry integrity completed successfully.
- Public release asset size and GitHub SHA-256 digest match.
- Active dev feed points to 3.11.44.

### Published artifact
- Release: https://github.com/jeep-jim/OSMINOG-Releases/releases/tag/chrome-v3.11.44
- Direct package: https://github.com/jeep-jim/OSMINOG-Releases/releases/download/chrome-v3.11.44/OSMINOG-Chrome-3.11.44-CONNECTION-CENTER-UI-REPAIR-ROOT.zip

### Runtime verification required
1. Update 3.11.43 to 3.11.44 with the existing button.
2. Open a DeepSeek agent with no active session and confirm the large centered Connect button is visible.
3. Press Connect and confirm the restored connection center opens.
4. Confirm an already-open DeepSeek tab is shown as found and connects without creating another tab.
5. Add Nano Banana or another provider through Modules / desktop quick access and confirm its icon appears in the center.
6. Resize the chat with Settings and Team open; confirm panes overlay at narrow widths instead of crushing text and buttons.
7. Close the linked tab and confirm the named reconnect notification still appears.

### Exact next action
The owner performs the 3.11.43 → 3.11.44 button update and the seven runtime checks above. Record only observed results; runtime remains pending until that proof.

---

## 2026-09-01 — 3.11.45 UNIFIED TEAM ROOM ROUTING

### Owner report
In Team mode, agents were answering into separate personal chats instead of one shared conversation. The owner confirmed that the earlier 3.8-era Team model used a common room.

### Root cause
- The Team engine still maintained a shared transcript and passed previous agent contributions into the next agent prompt.
- The unified messenger bridge appended each `osminog:team-message` through the currently active chat buffer.
- Team mode entry incorrectly called the unified chat with `team:false`.
- Therefore the orchestration context was shared, but visible persistence depended on whichever personal agent tab was active.

### Built changes
- Team mode now enters the unified messenger with `team:true` and selects the main shared feed.
- The main feed is labelled “Общий чат” and “Вся команда · общий поток” in Team mode.
- Every owner, agent and system event from the Team engine targets the main shared feed explicitly.
- Team writes are serialized through one promise queue to preserve order and avoid storage races.
- Author, provider, color, source and attachment metadata are preserved in the shared feed.
- A tab-switch race is handled by refreshing the active main buffer after an off-thread write completes.
- Personal agent tabs remain intact for direct one-to-one conversations and are labelled as personal in the Team composer.
- Team clear removes only team-sourced entries and preserves unrelated main-chat history.
- Connection Center behavior and the updater are unchanged.

### Verification and publication
- 24 JavaScript syntax checks passed.
- Packaged JSON files parse successfully.
- No Team entry point retains `team:false`.
- Static routing checks confirm Team events target the serialized main feed.
- Fixed extension key and permissions match 3.11.44.
- `osminog-folder-updater.js` is byte-identical to 3.11.44.
- ZIP integrity and root manifest checks passed.
- Package size: 378444 bytes.
- SHA-256: dbecb4c641c2f5ef7a501d796ae1771033f323b2cee8c9302f2cf574325d3248.
- The publication workflow archived the immutable package and advanced the active dev feed to 3.11.45.
- Public release metadata and archived package size/hash match the local artifact.

### Published artifact
- Release: https://github.com/jeep-jim/OSMINOG-Releases/releases/tag/chrome-v3.11.45
- Direct package: https://github.com/jeep-jim/OSMINOG-Releases/releases/download/chrome-v3.11.45/OSMINOG-Chrome-3.11.45-UNIFIED-TEAM-ROOM-ROOT.zip

### Runtime verification required
1. Update 3.11.44 to 3.11.45 with the existing button.
2. Enter Team mode while a personal agent tab is active; confirm OSMINOG opens “Общий чат”.
3. Send one mission to at least two selected agents.
4. Confirm the owner mission, every agent answer and the completion message remain in the same common feed in order.
5. Open a personal agent tab and confirm it remains a separate direct chat.
6. Return to “Общий чат” and confirm the full Team transcript is still present.

### Exact next action
The owner performs the 3.11.44 → 3.11.45 button update and the six runtime checks above. Runtime remains pending until these observed results are recorded.


---

## 2026-09-01 — 3.11.46 TEAM CHAT CONTROLS

### Owner report
The shared Team room had no dedicated settings. Clicking the gear in “Общий чат” exposed ordinary agent/provider controls, so the owner could not limit answer length, constrain the run, choose the working pattern or stop an active team cycle.

### Product logic
- “Общий чат” now owns a distinct Team settings surface.
- Personal agent tabs retain their existing provider, connection, role, colors, tools, Poseidon and GitHub settings.
- Team settings are stored per project and frozen for the duration of one run.
- The owner chooses participants, work mode, one-to-six rounds, per-answer word limit, total time limit, optional final summary, patch auto-application and full-project access.
- The settings surface estimates the number of principal responses before launch.
- Empty participant selection is rejected so the common room cannot start without an agent.
- During a cycle, mutable settings are visually and functionally locked.

### Stop and limits
- A large Stop action is shown in the Team settings panel.
- While the Team runs, the composer send control becomes a red Stop button for immediate access.
- Stop prevents every subsequent agent launch.
- If a provider request is already in flight, Chrome cannot cancel that transport safely; its result is discarded when it returns and is never appended or applied.
- The total deadline follows the same safe boundary: no new request starts after expiration, and an in-flight result arriving after the deadline is discarded.
- Each agent prompt receives the selected word budget, and displayed text is hard-clipped to that budget if a provider ignores it.

### Verification and publication
- 24 JavaScript syntax checks passed.
- All packaged JSON files parse successfully.
- Static UI/runtime contracts confirm the separate Team surface, settings synchronization, stop action, deadline and hard word clipping are present.
- Fixed extension key and permission arrays match 3.11.45.
- `osminog-folder-updater.js` is byte-identical to 3.11.45.
- ZIP integrity and root manifest checks passed.
- Package size: 384465 bytes.
- SHA-256: 9a1987f255b000597f5e426c5bef348ca78962878677d0efc49e7e8b3d5a9e25.
- The publication workflow completed successfully.
- GitHub Release asset size and digest match the local artifact.
- Active dev feed points to 3.11.46.

### Published artifact
- Release: https://github.com/jeep-jim/OSMINOG-Releases/releases/tag/chrome-v3.11.46
- Direct package: https://github.com/jeep-jim/OSMINOG-Releases/releases/download/chrome-v3.11.46/OSMINOG-Chrome-3.11.46-TEAM-CHAT-CONTROLS-ROOT.zip

### Runtime verification required
1. Update 3.11.45 to 3.11.46 with the existing button.
2. Enter Team mode, select “Общий чат” and open the gear; confirm the title is “Настройки общего чата”.
3. Open a personal agent tab and confirm the same gear returns to ordinary agent/provider settings.
4. Choose two participants, one round, 80 words and a two-minute limit; run one mission and confirm the shared response count and visible word limits.
5. Start a longer mission, press the red composer Stop control and confirm no subsequent agents launch and the in-flight result is not appended.
6. Reload the project and confirm the Team settings persist.

### Exact next action
The owner performs the 3.11.45 → 3.11.46 button update and the six runtime checks above. Runtime remains pending until these observed results are recorded.


---

## 2026-09-01 — OSMINOG 3.11.47 TEAM LIVE PRESENCE

### Starting state
- OSMINOG 3.11.46 had shared Team controls, but the running state was represented by a thin anonymous bar.
- Shared response cards did not keep a strong visual author identity.
- The left Team list and participant settings did not show which agent was writing or waiting.

### Owner request
1. Show a real progress indicator while an AI is thinking.
2. Keep visible avatars on messages so every response has an obvious author.
3. Show animated writing dots and identify who is writing and where.

### Built changes
- Every response card now keeps an avatar, author, provider badge and timestamp.
- Team responses retain the agent color as a source accent.
- The active Team agent is surfaced in a rich live progress card with its provider avatar, action label, animated dots, percentage, current round and response position.
- The left Team chat list highlights the exact writer and labels selected inactive agents as queued.
- Team settings mirror the same writing/queued state for every participant.
- Personal agent chats use the same live thinking card with elapsed and estimated remaining time.
- Stop behavior, Connection Center, fixed extension key, permissions and updater bytes are unchanged from 3.11.46.

### Verification and publication
- 24 JavaScript files pass `node --check`; all JSON parses; CSS brace validation passes.
- Static contracts confirm avatars, provider identity, typing dots, live progress and writing/queued states.
- ZIP contains 59 files with root `manifest.json`.
- Package: `OSMINOG-Chrome-3.11.47-TEAM-LIVE-PRESENCE-ROOT.zip`.
- Size: `387148` bytes.
- SHA-256: `dabcd956e4f1ad1e9d028c4abd3e6b30a071f3105805976f025e04e60b8e0664`.
- Public release: `chrome-v3.11.47`.
- Active dev feed points to 3.11.47; update-button compatibility is preserved.

### Runtime verification still required
- Update 3.11.46 → 3.11.47 through the in-product button.
- Start a Team task with at least three selected agents.
- Confirm one participant shows “Пишет в «Общий чат»” while the others show queued state.
- Confirm each completed response keeps the correct avatar, provider and timestamp.
- Confirm a personal-agent task shows the same rich progress card.

### Exact next action
The owner runs the checklist above. Record the real visual/runtime result before changing Team presence semantics again.


---

## 2026-09-01 — OSMINOG 3.11.48 LIVE PROVIDER HEALTH

### Starting state
- In 3.11.47 an external provider was shown as connected whenever its saved tab still existed on a matching URL.
- The screenshot confirmed Google AI entered Team Room as an active agent and failed only during the real send with “поле ввода не распознано”.
- This proved the green status described tab presence, not usable transport health.

### Owner request
Fix providers that appear connected but do not work in Team Room.

### Built changes
- External provider status now requires a live composer probe or, for DeepSeek, an authenticated direct-session probe.
- A linked tab that cannot accept a prompt is shown as “Не готов”, not “On”.
- Connection Center exposes the probe error and a “Переподключить” action.
- Team Room preflights every selected external agent before consuming a round and excludes agents that fail the live check.
- A mission with no ready participants stops before any provider request.
- Google AI and generic web-chat composer discovery now covers more textarea/contenteditable/combobox/plaintext patterns.
- Composer and send-button discovery traverses open Shadow DOM.
- Alice uses the broadened generic web-chat path.
- Existing Team presence, fixed extension key, permission arrays and updater bytes are preserved.

### Verification and publication
- 24 JavaScript files pass `node --check`; all JSON parses; CSS brace validation passes.
- Static contracts confirm live health probing, not-ready UI, Team preflight and expanded composer discovery.
- ZIP contains 59 files with root `manifest.json`.
- Package: `OSMINOG-Chrome-3.11.48-LIVE-PROVIDER-HEALTH-ROOT.zip`.
- Size: `388634` bytes.
- SHA-256: `e5623a3f2cf9386f03a1891daafd58008f0b7fbbc0f4ae391527095d6369a035`.
- Public release: `chrome-v3.11.48`.
- Active dev feed points to 3.11.48; update-button compatibility is preserved.

### Runtime verification still required
- Update 3.11.47 → 3.11.48 with the in-product button.
- Open Connection Center and verify Google AI/Alice show On only after a successful live check.
- If either shows “Не готов”, open its actual dialog and press “Переподключить”.
- Run a Team mission and verify every participant marked On produces a response.
- Record provider-specific DOM/probe diagnostics for any remaining failure.

### Exact next action
The owner runs the checklist. Any remaining provider failure must be fixed from its returned live probe, not hidden behind a URL-only On badge.


---

## 2026-09-01 — OSMINOG 3.11.51 AUTONOMOUS SELF-BUILD

### Owner report
- The permanent main chat returned only one answer and stopped instead of continuing through several visible progress messages and real actions.
- Commands to repair OSMINOG or create an extension could be misrouted into a canvas patch instead of editing the selected source folder.
- The owner supplied screenshots from 3.11.33–3.11.34 proving that the older main-chat path displayed consecutive progress replies and wrote real extension source.

### Verified root cause
- The autonomous Poseidon executor existed in 3.11.50 with source, repository and release completion contracts, 12 tool hops and six continuation turns.
- The composer never called that executor. Every ordinary message was routed to the parallel personal-agent runner.
- The parallel runner intentionally completed after one provider response, so the main chat never reached the autonomous source/release path.
- Composer attachments were copied for display and cleared before the selected runner consumed them.
- The source-intent classifier did not recognize natural self-repair wording such as “почини сам себя”.

### Built changes
- The permanent main chat now routes to the autonomous Poseidon executor.
- Personal agent chats retain independent parallel execution.
- Tool-request text and continuation progress remain visible as separate messages while execution continues.
- Main-chat tasks continue until the required canvas, source, repository or release mutation succeeds, or a concrete blocker is returned.
- Attachments are restored to the selected execution route.
- Self-repair, chat-interface repair and extension creation wording routes to source tools.
- Explicit widget/object/canvas requests retain validated osminog.patch/v1 execution.
- The fixed Chrome key, permissions, provider health, Team Room and updater bytes are preserved.

### Verification
- All 24 JavaScript files pass node --check.
- All packaged JSON files parse.
- Routing tests cover self-repair, chat settings repair, Grafix extension creation, canvas widgets, repository publication, release publication and ordinary discussion.
- The updater file is byte-identical to 3.11.50.
- The fixed manifest key and permission arrays match 3.11.50.
- ZIP contains 59 files with root manifest.json.
- Package size: 397477 bytes.
- SHA-256: 9d97f10614d89e585b6949405c49b5fe93b81c7c345a099b93b9f59261fe9861.

### Archived artifact
- Private path: artifacts/chrome/3.11.51/OSMINOG-Chrome-3.11.51-AUTONOMOUS-SELF-BUILD-ROOT.zip.
- Runtime remains pending until the owner updates and runs one real self-repair or module-creation command.

### Exact next action
- Publish chrome-v3.11.51 in jeep-jim/OSMINOG-Releases and advance the signed dev update feed.
- The owner updates through the working button and tests one source mutation from the permanent main chat.


---

## 2026-09-01 — OSMINOG 3.11.52 WORKSPACE APP RUNTIME

### Owner report
- The 3.11.51 permanent main chat entered the autonomous loop but still produced no real application object.
- The exact request asked to create an image-editing extension inside OSMINOG with a desktop icon that opens it.
- The provider returned prose claiming that no active canvas execution channel existed.

### Verified root cause
- Application creation still depended on the connected model returning a valid osminog.patch/v1.
- The exact phrase used the Russian infinitive “сделать”; the classifier recognized imperative “сделай” but not the infinitive.
- A model response containing useful HTML but no patch was discarded as an unverified canvas mutation.

### Built changes
- Added a dedicated app execution mode for applications, editors, players, studios and extensions inside OSMINOG.
- Natural forms such as сделать, создать, написать, реализовать and добавить are recognized.
- Any connected provider supplies standalone HTML; OSMINOG itself creates an editable code window and a linked desktop launcher.
- Explicit app installation is applied immediately and remains undoable.
- The launcher opens its exact code application on one click.
- If provider output has no usable HTML, a built-in working fallback is installed instead of returning another promise.
- The image-editor fallback includes image open and drag/drop, brush, eraser, line, color/size, undo, clear, grayscale, invert and PNG export.
- Canvas patch validation now preserves codeViewMode and codeSplit.

### Verification
- All 24 JavaScript files pass node --check.
- All packaged JSON files parse.
- The exact screenshot request routes to app mode.
- Alternate app, self-source repair, canvas widget, canvas edit and ordinary chat routing tests pass.
- ZIP contains 59 files with root manifest.json.
- Package size: 402198 bytes.
- SHA-256: bd9b87445f0538976740a9e3652b76a192acf4fc0d75d416e8b86c2459dc321e.

### Archived artifact
- Private path: artifacts/chrome/3.11.52/OSMINOG-Chrome-3.11.52-WORKSPACE-APP-RUNTIME-ROOT.zip.
- Runtime remains pending until the owner updates and repeats the image-editor request.

### Exact next action
- Publish chrome-v3.11.52 in jeep-jim/OSMINOG-Releases and advance the signed dev update feed.
- The owner updates through the working button, repeats the image-editor request and taps the generated launcher.


---

## 2026-09-02 — OSMINOG 3.11.53 NATIVE WORKSPACE APPS

### Owner report
- The 3.11.52 application installer created a rectangular canvas button and opened the generic code + preview shell.
- The expected result is a rounded desktop icon that opens a clean internal application window, matching the earlier native Grafix experience.

### Verified root cause
- The 3.11.52 deterministic installer intentionally emitted a 190 × 76 button and a visible code object in preview mode.
- Runtime metadata did not distinguish application launchers or application windows from ordinary canvas button and code objects.

### Built changes
- Added native desktop launchers with rounded icon glyph and label.
- Added clean internal application windows without URL, index.html or source UI.
- Added minimize, reopen, developer-source toggle and return-to-app controls.
- Existing 3.11.52 canvas-app pairs migrate automatically without recreation.
- Generated downloads remain enabled for applications such as PNG image editors.
- Preserved Poseidon self-repair, source publication, release publication and the button updater.

### Verification
- All packaged JavaScript files pass node --check.
- All packaged JSON files parse.
- Static migration and interaction checks pass for open, minimize, reopen, developer mode and return-to-app.
- ZIP contains 59 files with root manifest.json.
- Package size: 403761 bytes.
- SHA-256: 793b06d9e8cbe388c4c6c1e67a781f960362b00d1fe8d7dfd71bf668e43bd3f5.

### Archived artifact
- Private path: artifacts/chrome/3.11.53/OSMINOG-Chrome-3.11.53-NATIVE-WORKSPACE-APPS-ROOT.zip.
- Runtime verification remains pending until the owner updates and reopens the existing Image Studio launcher.

### Exact next action
- Publish chrome-v3.11.53 in jeep-jim/OSMINOG-Releases and advance the signed dev update feed.
- The owner updates through the working button and tests the migrated launcher plus a newly created application.


---

## 2026-09-02 — 3.11.54 OWNER POSEIDON PUBLISH

### Starting state
- Owner runtime baseline: OSMINOG 3.11.53.
- Poseidon could edit a selected local source folder and publish through tools, but the owner settings had no persistent visible publication action.

### Requested work
- Work from any selected local source folder on any owner computer.
- Show an owner-only «Опубликовать» action when local source writes are pending.
- Keep the pending publication marker through refresh/reload/update until publication succeeds or the owner explicitly cancels it.
- Add a compact confirmed cancel control.
- Rename the visible «Poseidon Source» toggle to «Poseidon».
- Keep private source in jeep-jim/OSMINOG and public packages/update feed in jeep-jim/OSMINOG-Releases.

### Built changes
- Persistent owner publication marker `osminogPoseidonPublishPendingV1` is set only after a real changed source file is written.
- The marker is not cleared by connection refresh or extension reload/update.
- Owner settings render «Опубликовать» below «Обновить связь» only while publication is pending.
- Publication calls the existing verified `release_publish` pipeline and clears the marker only after successful private-source archive and public release/feed publication.
- Compact × cancellation requires confirmation and clears only the pending marker; local files are not deleted.
- Visible toggle now reads «Poseidon: вкл./выкл.».
- Ordinary users remain outside Owner Max controls; paid Poseidon entitlements are deferred for separate design.

### Static verification
- All packaged JavaScript files pass `node --check`.
- All packaged JSON files parse.
- ZIP integrity passes with root manifest version 3.11.54.
- Package: `OSMINOG-Chrome-3.11.54-OWNER-POSEIDON-PUBLISH-ROOT.zip`.
- Files: 59.
- Size: 404428 bytes.
- SHA-256: `ab924d0c48b307ba1c357c4b20e5ffa8695c5af94ac1d0b0442aa0582322a450`.

### Runtime verification required
- Owner updates from 3.11.53 using the normal button.
- Select any local source folder, let Poseidon make a real file change, confirm «Опубликовать» appears, refresh/reload once, then publish and confirm the button disappears only after success.


---

## 2026-09-02 — 3.11.55 CUSTOM EXTENSION STUDIO

- Replaced AI-created canvas-app pairs with a first-class custom extension registry.
- Custom widgets/apps now render draggable desktop launchers outside the canvas object model.
- Extensions open in independent interactive, draggable and resizable windows with script/form/download support.
- Added built-in Extension Studio editing, type selection, save/reopen and confirmed deletion.
- Extension packages persist in chrome.storage.local under osminogCustomExtensionsV1.
- Removed duplicate OSMINOG progress/runtime bubbles from the visible transcript; progress stays in the activity strip and one provider completion remains.
- Legacy 3.11.54 canvas apps remain readable for compatibility but new AI builds use Extension Studio.
- Static checks: all JavaScript syntax PASS, all JSON parse PASS, ZIP integrity PASS.
- Package: OSMINOG-Chrome-3.11.55-CUSTOM-EXTENSION-STUDIO-ROOT.zip; 60 files; 407804 bytes; SHA-256 b85aa19eb13f27688e95fcb8543deb9fa3751cac28757d4492c5cec067395275.
- Owner runtime verification required after update from 3.11.54.


---

## 2026-09-02 — 3.11.56 AUTONOMOUS WORKSPACE RUNTIME

- Reframed OSMINOG execution around a persistent task contract: goal, stages, actions, verification and explicit result/blocker.
- Added visible execution monitor and Poseidon step progress.
- Increased autonomous continuation from 6 to 12 cycles while preserving the 12 tool-hop safety limit.
- Removed the standalone Button tool from the bottom rail.
- Removed fake generic extension fallback: no executable HTML means no installation and no false success.
- Completion now requires the existing mutation/result satisfaction contract.
- Static checks: all JavaScript syntax PASS, all JSON parse PASS, ZIP integrity PASS.
- Package: OSMINOG-Chrome-3.11.56-AUTONOMOUS-WORKSPACE-RUNTIME-ROOT.zip; 61 files; 409710 bytes; SHA-256 b4e8c502b343f00d95cfde0fe93aeaff3092b0e388af9a2c21fdc3eab70412a2.
- Owner runtime verification required after update from 3.11.55.
