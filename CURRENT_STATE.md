# BriefCraft — CURRENT STATE

Date: 2026-08-26

- Current tested live line before next click: **3.8.39**.
- Next online update in GitHub: **3.8.40** — autosave-first navigation, project-card live thumbnails, compact file/image objects, selection chrome with AI/close controls and 8 connection ports, useful collapsed Layers rail, Modules puzzle polish, `Live AI` → `Chat AI`.
- OWNER online updater is working and reopens `editor.html` after reload.
- Proven transports: GPT direct authenticated session; DeepSeek direct authenticated hidden web-session. Visible provider chats are not polluted by BriefCraft service prompts.
- Canvas remains source of truth; agents can read/edit through Tool Bus + `briefcraft.patch/v1`.
- Fixed manifest `key` from 3.8.17 must never change.
- Projects/data folder and OWNER application-source folder are separate concepts.
- Current work phase: **design/UI cleanup and consistency**.
- Payment research memory lives in `docs/PRODAMUS.md`; reverify provider terms before implementation.
- Owner microfix workflow: update `extension/update-manifest.json` in GitHub → user presses **Обновить** → patch applies → extension reloads/reopens.
