# OSMINOG 3.12.0 — Capability OS

- Permission-scoped Module SDK available inside every generated application window.
- Explicit per-module grants for storage, session secrets, declared-host network access, notifications, browser, canvas and commands.
- Isolated `postMessage` RPC bridge: module code does not receive the parent OSMINOG DOM.
- Network gateway strips unsafe browser-controlled headers and requires declared plus browser-approved origins.
- New AI tools: `module_list`, `module_open`, `module_permissions_revoke`.
- Generated applications automatically declare external origins found in their code and request access only when used.
- Telegram Bot Connector added to the unified Module Store with `getMe`, `getUpdates` and `sendMessage` flows.

Telegram Bot Connector is intentionally limited to Bot API. Personal Telegram chat access requires a separate MTProto client and is not represented as completed in this release.
