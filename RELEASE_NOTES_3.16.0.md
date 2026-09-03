# OSMINOG Chrome 3.16.0 — SIMPLE ACCESS RUNTIME

This release removes the permission-console architecture and makes the workspace capability model simple.

- Canvas, assets, graphics, browser, files, apps, modules, commands and normal project edits are always available to the connected AI. There is no Poseidon toggle and no separate AI edit-access selector.
- The top-level **Access** window contains only project sharing: who can open the canvas, the link role (view/comment/edit), the share link and link rotation.
- The AI connector is automatic. A normal prompt does **not** preload canvas objects, selection, viewport or project map. Canvas context is attached only after an explicit canvas/project/desktop/selection request, a tethered object, or an explicit attachment.
- The same lazy-context rule is applied to the built-in Google AI chat.
- External ChatGPT Presence receives a minimal connector/capability envelope and requests canvas data through tools only when the user asks for it.
- Product self-modification is no longer a normal setting. Requests to read/write/publish private OSMINOG product source trigger a just-in-time **Owner Unlock**.
- First Owner Unlock verifies the locally stored GitHub credential against both `jeep-jim/OSMINOG` and `jeep-jim/OSMINOG-Releases`, then enrolls a Google Authenticator-compatible TOTP secret. Future source mutations require only the six-digit code; the unlock lives in memory for 15 minutes.
- GitHub credentials and TOTP codes are never inserted into AI chat messages.
- The normal Modules surface no longer exposes GitHub/Owner setup; that credential is requested only by the owner gate when product-source work is actually requested.

Security boundary: Google Authenticator integration is TOTP-based. A true push approval flow would require an external identity/backend service and is not claimed by this release.
