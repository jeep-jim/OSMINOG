# OSMINOG — OCEAN SHELL

## Status

Approved product direction as of 2026-08-28. This document defines the new interface shell for OSMINOG while preserving the existing product engine and data model.

Design source: https://www.figma.com/design/h1aG9cEdviAPA45gygUsB9/OSMINOG?node-id=0-1

## Core decision

OSMINOG is not a canvas with many AI windows. It is a spatial, local-first AI operating environment where the canvas is the workspace/memory layer and AI, files, browser sessions, code, media, teams and external services are connected entities of one project.

The next interface generation is called **Ocean Shell**.

Ocean Shell is a shell rewrite, not an engine rewrite:
- preserve canvas/project object IDs and persistence;
- preserve groups, nodes and connection data;
- preserve provider transports that are already proven, especially DeepSeek;
- preserve Team, Markdown/Code, local project folder, Browser Presence and patch execution semantics;
- redesign navigation, window/surface hierarchy, presentation, motion and interaction patterns around one coherent ocean/deep-space metaphor.

## Visual metaphor

The interface should feel like a living deep-ocean workspace rather than a desktop filled with application windows.

Base language:
- deep blue / black ocean-space gradient;
- light shafts / soft volumetric glow;
- translucent plankton/particles drifting in depth;
- bioluminescent accents for active state and attention;
- translucent surfaces with restrained blur;
- soft emergence/submergence instead of abrupt window spawn;
- active AI agents visualized as working octopuses rather than static pills on the canvas.

The ocean metaphor must never hide basic usability. Familiar anchors remain visible and predictable.

## Intro / wake state

Proposed intro text:

> Пробуди меня от сна  
> просто потянув тачскрин  
> я подниму с морского дна  
> всё, что скрывает глубина

The wake gesture/button is the octopus eye. It opens the universal search/command layer from the bottom.

## Main interaction model

### 1. Environment
Background, plankton, depth/light, global ambience. Purely decorative state must be GPU-efficient and removable with reduced-motion/accessibility settings.

### 2. Canvas / project graph
The existing infinite canvas remains the primary spatial memory and object graph.

### 3. Lightweight persistent UI
Only small persistent elements should remain visible when idle: navigation anchors, project status, active task indicators, minimal agent chips, compact widgets.

### 4. Sheets / drawers / contextual surfaces
Search, settings, provider picker, project folder, quick actions and similar tools should emerge as sheets/drawers instead of becoming permanent floating windows.

### 5. Focus surfaces
Browser, Team, Media Crew, Code/Markdown and other heavy work modes can expand into a focused surface or near-full-screen workspace when actively used.

The user should rarely see all major modules open simultaneously.

## Universal search / command layer

The octopus eye opens one system-wide search/command surface.

Initial modes:
- Всё
- Проект
- Объекты
- Файлы
- AI
- Web
- Код
- Media
- История

Search results should support direct actions such as open, reveal on canvas, attach to context, add to Team, send to agent, open internally, save to project folder.

This is both a search interface and a command palette. The user should be able to type natural-language intent, but essential actions must also remain visible/selectable to reduce memory load.

## Mapping of the existing 8-point UX pass into Ocean Shell

### P1 Layers / project folder
Collapsed Layers becomes a minimal shell rail; expanded state exposes project/layer content. Main project folder remains a first-class control. The small plus and folder control follow the approved layout.

### P2 Provider/widget icons
Provider/widgets become movable/selectable shell items. Multi-select and grouped movement are retained. User-created transparent widget folders/containers behave like compact Android-style folders.

### P3 AI connection status
Remove duplicated labels such as `GPT LIVE`. Use one system status component: green dot + `On`, shared across chat, provider settings, Team, Registry and Session Manager.

### P4 Agent settings / Poseidon
Connection is visible immediately. Settings becomes a full surface/sheet rather than an awkward panel inside a chat. One Provider Registry powers provider selection. `Jarvis` is renamed to **Poseidon**. Device capabilities remain permissioned and local-first; native-only capabilities use a native companion.

### P5 Internal Browser / Session Manager
One provider/session manager is shared by AI chat, Team, Media Crew and Browser. Internal sessions are the default. External browser opening is explicit/fallback only. Duplicate provider sessions are not created by individual modules.

### P6 Working octopuses / connections
Static agent pills do not remain on the canvas. Agent chips stay in chat/team UI. A working octopus appears only when an agent is actually operating on objects or when explicitly pinned as a node. Connections normally render behind windows/surfaces and rise to the foreground only on hover/selection/edit.

### P7 Browser redesign
The existing Browser prototype becomes a focus surface using the same Session Manager. It gets tabs, address/search, navigation, attach-to-context and downloads-to-project integration.

### P8 Media Crew
Provider cards become selectable tiles. Actions move to a shared contextual toolbar for one or many selected providers. Capability labels become compact icon + text tokens rather than large repeated chips.

## Phase plan

### 3.11.0 — OCEAN SHELL ALPHA
- new shell/theme tokens;
- ocean background/depth/plankton layer;
- new top and bottom shell anchors;
- octopus-eye search trigger;
- new surface hierarchy (lightweight UI / sheets / focus surfaces);
- compatibility wrappers around existing modules rather than engine rewrites.

### 3.11.1 — SEARCH LAYER
- universal search/command surface;
- project objects/files/providers/history indexes;
- direct result actions.

### 3.11.2 — PROVIDER / SESSION LAYER
- unified `On` status;
- one Provider Registry;
- one Session Manager;
- settings/connect redesign;
- Google persistent session + real multimodal attachment transport + dedupe.

### 3.11.3 — OCTOPUS WORK STATES
- idle agents only as chips;
- task octopus state machine;
- study/thinking/build/design/code states;
- tether behavior;
- connection z-order.

### 3.11.4 — FOCUS WORKSPACES
- Browser focus surface;
- Team focus surface;
- Media Crew bulk-selection surface;
- Code/Markdown focus surface.

## Global usability guardrails

Ocean Shell must be distinctive without becoming cryptic.

Non-negotiable:
- progressive disclosure: advanced power appears when needed;
- recognition over recall: critical actions are visible or easily retrievable;
- common actions keep familiar labels/icons in addition to thematic styling;
- all key actions available without animation-dependent timing;
- keyboard/mouse/touch support;
- `prefers-reduced-motion` support and a static/low-motion mode;
- readable contrast and scalable typography;
- no motion that blocks interaction;
- measurable startup/render budgets;
- themes may differ visually but must share the same interaction grammar.

## Technical strategy

Do not rewrite the entire product in one destructive pass.

Separate engine/state from shell presentation:
- keep current project model and provider transports;
- introduce shell tokens and surface manager first;
- migrate modules one at a time into the new surface system;
- maintain regression tests for canvas persistence, agent transport, folders, connections and startup performance;
- use CSS/compositor-friendly animation for most ambience; reserve Canvas/WebGL for the background/particle layer only where needed;
- enforce a low-motion fallback;
- keep full build rollback points throughout the migration.

## Known platform boundaries

A Chrome extension cannot become a completely independent embedded web browser engine on desktop. The existing managed service-window/tab approach remains the reliable Chrome-extension transport for arbitrary sites/provider sessions. Ocean Shell can make these sessions feel integrated through one Session Manager and internal UI, while the actual page may still live in a managed Chrome tab/window when embedding is technically blocked.

Poseidon-level operating-system control, camera/device automation and other privileged local functions require explicit permissions and, for capabilities outside the extension sandbox, a native companion/native messaging layer.

## Definition of success

Ocean Shell succeeds only if new users can understand the basic workflow without being taught the metaphor:
1. open/wake;
2. search or create/open a project;
3. place or select an object;
4. ask an AI or start a Team task;
5. see the task operate on the same project;
6. enter focus mode only when deeper work is needed;
7. return to a calm, uncluttered workspace when the task is complete.

Distinctive visuals are a competitive advantage only if this basic path remains obvious.