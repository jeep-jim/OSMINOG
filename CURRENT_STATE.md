# BriefCraft — CURRENT STATE

Date: 2026-08-26

- Current live line: **3.8.33**, owner online updater is working and reopens `editor.html` after reload.
- Next micro-update in GitHub: **3.8.34** — UI polish only: all header dropdowns/popovers align to one vertical baseline.
- Proven transports: GPT direct authenticated session; DeepSeek direct authenticated hidden web-session. Visible provider chats are not polluted by BriefCraft service prompts.
- Canvas remains source of truth; agents can read/edit through Tool Bus + `briefcraft.patch/v1`.
- Fixed manifest `key` from 3.8.17 must never change.
- Projects/data folder and OWNER application-source folder are separate concepts.
- Current work phase: **design/UI cleanup and consistency**, no large architecture changes unless explicitly requested.
- Update workflow for owner microfixes: change `extension/update-manifest.json` in GitHub → user presses **Обновить** in BriefCraft → patch applies → extension reloads/reopens.
