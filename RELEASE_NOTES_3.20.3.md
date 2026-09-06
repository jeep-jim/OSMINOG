# OSMINOG 3.20.3 — Canvas Drop and Presence Recovery

Based on the exact published 3.20.1 package; preserves its interface and assets.

- Stops the graphics inspector MutationObserver feedback loop triggered by selecting images/text.
- Imports each external file drop once and allows intentional repeated drops.
- Lets internal folder/object/agent MIME drags reach their handlers.
- Preserves object identity on folder-to-canvas moves; imports original project files without text-preview truncation.
- Restores Access → Current ChatGPT → role → Connect using the existing external Presence transport.
- Restores usable rich text formatting by fixing the inspector freeze.
- Handles null/undefined Team retry responses without a TypeError.

Verified in Chromium with mocked Chrome transport/storage and file handles: native image drops, internal image moves, full text-file import, bold/italic persistence, connection UI routing and no uncaught page errors. Live provider, Windows Dev Hub and owner-profile checks remain pending; runtimeVerified=false.
