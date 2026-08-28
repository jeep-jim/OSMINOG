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
