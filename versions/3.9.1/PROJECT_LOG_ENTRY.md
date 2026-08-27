
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
