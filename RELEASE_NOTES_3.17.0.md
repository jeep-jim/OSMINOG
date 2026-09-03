# OSMINOG Chrome 3.17.0 — GENERATIVE APP RUNTIME

- Removed hard-coded stopwatch/calendar/player HTML presets. Every app and widget is generated from the user's current request.
- OSMINOG owns install, update, rollback and verification; the connected AI owns the requested interface and behavior.
- Clicking a generated app focuses it for follow-up work. Requests like «доработай», «почини», «добавь» update the same app with `module_update`.
- Failed updates roll back to the previous working version.
- Sandbox apps can read selected canvas assets, create assets, capture screen/viewport/selection/object, use storage, open browser tabs and perform permission-controlled network fetches.
- Visible controls are audited for handlers; dead controls fail validation instead of being reported as complete.
- Compact widgets auto-size to their natural content. Manual resizing scales them proportionally instead of clipping an iframe/container.
- Binary/base64 fetch is supported for browser-compatible JS/WASM libraries and emulator cores when a compatible core exists.
- Execution replies are concise; intermediate work stays in the progress surface instead of flooding the chat.

Emulator support is a runtime capability. Running a ROM or APK still requires a compatible browser JS/WASM core for that format.
