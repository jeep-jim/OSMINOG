# OSMINOG Chrome 3.10.4 — RECOVERY PERFORMANCE

Base: 3.10.3.

## Why 3.10.3 froze

The page loaded two complete folder engines simultaneously. Both wrapped core render functions and installed global listeners. The Windows folder engine also watched and rewrote the same Layers DOM, rewrote an observed `hidden` attribute and polled folder status. This caused a self-sustaining render/mutation loop, severe CPU load and a startup black screen.

Additional startup failures were caused by a missing `makePreview` attachment helper and unsafe project/groups/connections/DOM assumptions during partial initialization.

## Recovery changes

- Only one Windows-style folder runtime is loaded.
- Legacy folder and old desktop-folder polling runtimes were removed from the page and package.
- Folder polling and self-triggering folder MutationObservers were removed.
- Folder UI updates are coalesced with `requestAnimationFrame`; project-folder status is cached/event-driven.
- Added `osminog-chat-ux-lite.js` for grouped bubbles and universal Ctrl+V without a second folder engine.
- Added `makePreview` for GPT image/file attachments.
- Added defensive startup guards for project, groups, connections, stale connection previews and missing DOM nodes.
- Reduced idle agent tether refresh work and paused it in hidden tabs.
- Preserved Windows folders, Media Crew, Team, DeepSeek authenticated transport and the Google bridge.

## Artifact

`OSMINOG-Chrome-3.10.4-RECOVERY-PERFORMANCE-ROOT.zip`

- Size: `298208` bytes
- SHA-256: `c30b62c5df8616589af9275e8c084ecc3c4199a50ade3a5e8df6210441cc4d55`
- Files: `52`
- JavaScript files: `19`
- JSON files: `9`
- Root `manifest.json`: yes
- Fixed Chrome key: preserved

The full ZIP is not claimed as stored in GitHub. The ChatGPT artifact is the verified package until a remote copy is checked byte-for-byte.

## Controlled smoke test

With mocked extension APIs and local assets inlined:

- 3.10.3 did not reach `DOMContentLoaded` within 30 seconds.
- 3.10.4 reached `DOMContentLoaded` in approximately 0.128 seconds.
- 3.10.4 produced 2 idle DOM mutations over 1.2 seconds.

This is not a substitute for the owner Windows/Chrome runtime test.

## Runtime checks

1. Open without a black screen.
2. Check Chrome/Windows CPU usage at idle.
3. Open Team and the project folder and check CPU again.
4. Verify the existing project, folder metadata, connections and chats load.
5. Test Ctrl+V image attachment.
