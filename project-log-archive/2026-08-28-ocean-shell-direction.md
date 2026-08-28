## 2026-08-28 — OCEAN SHELL direction + Figma source

### Starting state
- The owner manually installed **OSMINOG Chrome 3.10.7 UPDATE BRIDGE** and chose to pause updater work so product development does not keep drifting away from the main UX roadmap.
- Existing OSMINOG functionality is broad but visually fragmented: canvas, AI Presence, Team, Browser Hub, Provider Registry, Media Crew, settings and other surfaces can all compete for space as independent windows.
- The owner showed the historical 2010–2011 Yokkey/OS concept: an internet operating environment built around widgets, workspace switching, search, local/distributed content access, messages/conferences, media, editor and assistant behavior. The OSMINOG name appeared later, around 2016.

### New owner direction
The owner wants to keep the existing functionality but completely redesign the interface as a coherent deep-ocean / deep-space environment.

Core visual/product ideas supplied by the owner:
- Ocean/deep-space background with light and translucent animated plankton.
- The background/plankton already has source artwork in Figma.
- An octopus-eye control near the bottom wakes/raises the universal search layer.
- Proposed intro copy:
  - `Пробуди меня от сна`
  - `просто потянув тачскрин`
  - `я подниму с морского дна`
  - `всё, что скрывает глубина`
- The owner provided direct Figma design access: `https://www.figma.com/design/h1aG9cEdviAPA45gygUsB9/OSMINOG?node-id=0-1`.

### Figma access verification
- Figma access works through the connected Figma tool.
- File key: `h1aG9cEdviAPA45gygUsB9`.
- Page/node: `0:1`.
- The file contains multiple 390×844 mobile concepts, a 1920×1080 desktop frame, OSMINOG intro/conversation variants, weather and image-result concepts, imported historical search references and additional visual assets.
- No Figma content was changed in this step.

### Product decision
Create **Ocean Shell** as the next interface generation.

This is a shell rewrite, not a destructive engine rewrite. Preserve:
- canvas/project state and stable IDs;
- groups/nodes/connections;
- provider transports, especially proven DeepSeek;
- Team, Markdown/Code, local project folder, Browser Presence and patch semantics;
- current data/persistence compatibility until separately migrated.

Change:
- navigation/shell;
- window/surface hierarchy;
- visual language;
- motion/ambient system;
- search/command entry;
- how providers, Team, Browser, Media Crew and settings appear when idle vs. focused.

### Interaction hierarchy
1. Ocean environment / light / plankton.
2. Canvas/project graph.
3. Lightweight persistent UI only.
4. Sheets/drawers/contextual surfaces for search, settings and pickers.
5. Focus surfaces for Browser, Team, Media Crew and Code/Markdown.

The user should not normally see every major subsystem simultaneously.

### Universal search
The octopus eye becomes the wake/search trigger. Initial search modes:
- Всё
- Проект
- Объекты
- Файлы
- AI
- Web
- Код
- Media
- История

Search must also behave as a command layer and expose visible direct actions so the system does not depend on memorized commands.

### Existing eight-point UX pass
The owner's eight previously defined UX requirements remain mandatory and are now migration requirements for Ocean Shell:
1. Layers/project folder cleanup.
2. Provider/widget multi-select and transparent folders.
3. Unified green-dot `On` status.
4. Agent settings/connect redesign and Jarvis → Poseidon.
5. One internal Browser/Service Session Manager.
6. Active working octopuses instead of idle desktop agent pills; connections behind windows except during edit.
7. Browser redesign.
8. Media Crew bulk selection and shared toolbar.

### Planned interface milestones
- **3.11.0 OCEAN SHELL ALPHA** — shell tokens, ocean/plankton ambience, shell anchors, octopus-eye trigger, new surface hierarchy.
- **3.11.1 SEARCH LAYER** — universal search/command layer.
- **3.11.2 PROVIDER / SESSION LAYER** — Provider Registry, unified `On`, Session Manager, settings/connect, Google persistent session/multimodal/dedupe.
- **3.11.3 OCTOPUS WORK STATES** — working-octopus state machine, tethers, connection z-order.
- **3.11.4 FOCUS WORKSPACES** — Browser/Team/Media Crew/Code-Markdown focus surfaces.

### Global usability guardrails
Ocean Shell must be distinctive without becoming cryptic:
- progressive disclosure;
- recognition over recall;
- familiar labels/icons for common actions;
- keyboard/mouse/touch support;
- reduced-motion/static mode;
- readable contrast/scalable typography;
- no animation-dependent essential interaction;
- measurable startup/render performance budgets;
- rollback points throughout migration.

### Canonical specification
Created `docs/OSMINOG_OCEAN_SHELL.md` as the canonical design/implementation direction.

### Exact next action
- Finish reviewing the Figma source before editing production UI.
- Build a concrete Ocean UI Spec / screen hierarchy from the Figma source and the current OSMINOG functionality.
- Then start **3.11.0 OCEAN SHELL ALPHA** as a compatibility shell over 3.10.7 rather than rewriting the product engine from scratch.
- Do not lose the existing eight-point UX pass; fold every one of those requirements into the new shell.