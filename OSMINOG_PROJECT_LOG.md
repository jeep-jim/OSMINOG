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
