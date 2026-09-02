# OSMINOG Chrome 3.14.2 — CHAT OWNER RUNTIME RECOVERY

Status: repair candidate / RC1 until owner runtime verification is complete.

## What this repairs

- Restores the complete Owner Max tool contract in the direct ChatGPT transport: project revisions/checkpoints, module create/update/test, workspace/icon actions and the existing source/GitHub tools.
- Fixes the application creation path. Requests such as “create a stopwatch”, “timer”, “calculator”, “clock”, “converter” or similar utilities are treated as real applications instead of loose canvas shapes and buttons.
- Preserves the direct-session HTML application path, but installs the returned document through `module_create`; success requires a persisted module and a passing launch test.
- Restores concise sequential execution updates inside the chat while keeping internal chain-of-thought out of the conversation/model context.
- Restores the actual “Подключить в фоне” action. Session Manager no longer replaces the working connect/authorize handlers with a button that only opens Access Center.
- Restores the canonical `OSMINOG_PROJECT_LOG.md`, `OSMINOG_ROADMAP.md`, project log archive and update architecture document on top of the current 3.14.x codebase.

## Verified before RC1 packaging

- Repair workflow completed successfully.
- `node --check` passed for `background.js`, `gpt-presence.js`, `osminog-session-manager.js`, `bridge.js`, and `chatgpt-lite-bridge.js`.
- `git diff --check` passed.
- Static runtime assertions verified the direct tool contract, utility-to-app classification, module installation fallback, visible progress path, provider-connect routing, and restored project documentation.

## Runtime checks still required before final public release

1. Direct ChatGPT session and attached-tab fallback.
2. Create a stopwatch as a real module/launcher and operate Start/Pause/Reset.
3. Create a non-template sandbox application and reopen it from the desktop/module store.
4. `web_search` → `asset_create` to place a real internet image/file on the workspace.
5. Owner source/GitHub read-edit-commit path from the OSMINOG chat.
6. DeepSeek, Claude, Gemini and Google AI background sessions, including reconnect after extension/service-worker restart.
7. Confirm concise progress cards/messages remain sequential and the chat no longer stalls in an autonomous app loop.
