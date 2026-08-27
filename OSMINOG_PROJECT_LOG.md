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
