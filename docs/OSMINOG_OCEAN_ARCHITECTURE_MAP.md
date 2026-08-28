# OSMINOG — Ocean Shell architecture map

This document maps every major existing OSMINOG capability into the new Ocean Shell without removing the underlying engine.

## Principle

**Engine stays; shell changes.**

Persistent engine layers:
- project/canvas state and stable object IDs;
- groups, nodes, connections and patch semantics;
- local project persistence and project-folder access;
- provider transports and authenticated sessions;
- Team orchestration;
- Browser Hub/service tabs;
- Code/Markdown;
- Media Crew/Provider Registry;
- Browser Presence and external AI access;
- Store/module manifests and permissions.

Ocean Shell replaces navigation, surface hierarchy, theme system, motion and presentation.

## 1. Calm workspace — the sea

The default state is the canvas/project graph with as little permanent chrome as possible.

Persistent anchors only:
- OSMINOG/project identity;
- compact mode/workspace navigation;
- status/active-task indicators;
- object tool dock when editing;
- octopus-eye search/command trigger;
- optional Layers/Inspector rails.

The user must be able to return to this calm state after every task.

## 2. Octopus eye — universal search and command layer

The eye is the primary retrieval/action entry point. It rises from the bottom rather than opening another floating application window.

Indexes and actions are progressively connected to:
- Projects/workspaces;
- canvas objects/groups/connections;
- local project files;
- AI providers and agents;
- Team configurations/tasks;
- Browser sessions and web search;
- Code/Markdown documents;
- Media providers/generated assets;
- activity/history;
- modules/plugins/store.

Natural-language intent is supported, but familiar visible actions remain available.

## 3. Workspaces / desktops — currents

A project may have several saved visual workspaces over the same underlying project state, for example:
- Canvas / planning;
- Research;
- Team;
- Design;
- Code;
- Media.

They are views/layout states, not duplicated project data. Switching workspace changes what surfaces are visible/focused, while objects, files and memory remain shared.

Future UI may expose live mini-previews inspired by the original Yokkey concept, but the first implementation can use a compact workspace switcher.

## 4. Layers, objects and editing — the working reef

Existing object editing remains direct on the canvas.

- Layers is a collapsible rail/sheet, not a permanent large window.
- Inspector is contextual: it appears when an object/connection/canvas needs editing.
- Color controls become contextual editing controls rather than permanent global clutter.
- Multi-selection/groups continue to use the existing transform engine.
- Connections normally live behind application surfaces and rise for hover/selection/edit.
- Code/live-layout editing remains a first-class object capability.

## 5. Agents — the crew of octopuses

Agents remain represented by compact chips in chat/Team UI when idle.

A visible octopus appears on the canvas only when:
- the agent is actively working on one or more objects; or
- the owner explicitly pins the agent as a node.

Work-state vocabulary:
- observe/study;
- think;
- browse/research;
- build/design;
- code;
- review;
- transfer/handoff;
- waiting/error/success.

The tether indicates current work/context, not permanent decorative duplication.

## 6. Team — expedition focus surface

Team keeps its existing council/review/execute engine and shared transcript.

Ocean Shell presentation:
- compact Team chip/status while idle;
- participant chips and active octopus indicators;
- focused Team workspace when discussion/execution needs room;
- mission composer anchored consistently with the rest of the shell;
- patch preview/execution remains governed by the existing validated patch layer.

Future hardening: object leases, per-agent patch preview, conflict/merge/rebase.

## 7. Providers and connections — one Provider Reef

There must be one canonical Provider Registry for ChatGPT, DeepSeek, Google AI, Gemini, Claude, Custom AI and media providers.

Each provider owns one identity/capability record:
- icon/name/color;
- categories/capabilities;
- autonomous vs browser-assisted transport;
- connection/auth state;
- multimodal input/output support;
- active session ID;
- health/error state;
- permissions.

Agent settings, Team, Media Crew, Browser and Store consume this same registry.

Connection UI uses one system status: green dot + `On` instead of duplicated provider-name labels.

## 8. Browser / Google / web — internal dive sessions

All modules request pages/sessions from one Session Manager.

Default rule: **open inside OSMINOG's managed session system whenever technically possible.**

- Existing managed Chrome service tabs/windows remain the transport where sites block embedding.
- Google AI must reuse one persistent service session unless the owner explicitly requests a new one.
- A request ID must map to one send and one returned answer.
- Image attachments must be physically transferred into the provider composer before Send.
- Regular links and web search enter through the same internal session route.

The Browser becomes a focus surface with tabs/address/navigation/context attachment rather than a separate competing window system.

## 9. Media Crew — the media trench

Provider cards become selectable items from the shared Provider Registry.

- select one or many providers;
- common contextual actions appear once: add to Team / place on workspace / open;
- capabilities use compact icon + label markers;
- generated files/results can flow directly to project folder and canvas;
- unsupported providers remain clearly browser-assisted rather than pretending to be autonomous tools.

## 10. Code / Markdown / layout editing — workshop focus surface

Existing code objects and Markdown Studio remain intact.

Ocean Shell provides:
- lightweight entry via eye/search or Code workspace;
- near-full focus surface for serious editing;
- source/preview split when useful;
- object/file provenance so a Markdown/code artifact can be related to its project file and canvas object rather than silently duplicated.

## 11. Local project folder — Owner Vault

The project folder is the owner's durable file layer.

Ocean Shell presentation may call the UI surface simply `Файлы`/project folder; the architectural role is Owner Vault:
- owner-granted local folder access;
- assets and exports;
- project manifests/backups;
- agent read/write tools under explicit permissions;
- generated media and downloads.

It remains local-first. Remote collaboration never silently turns the owner's entire folder into shared cloud storage.

## 12. Presence / access for any AI — shared sight

This is a core product feature, not a plugin window.

One Presence / Context Bus publishes an authoritative project snapshot contract containing, as permitted:
- project ID/revision;
- viewport/selection;
- object/project map;
- connections;
- active workspace/mode;
- open managed surfaces;
- current chat/agent/Team task;
- provider/session state;
- current attachments;
- local-folder connection state;
- recent project/runtime changes.

External AI partners read this shared contract and request exact bodies/screenshots/DOM only when necessary. They never invent existing IDs.

All mutations, regardless of AI provider, go through the same validated execution/patch layer.

The owner controls view/comment/edit scope. The project/canvas remains source of truth.

## 13. Plugin Store — the ecosystem reef

The current developer rules become the foundation of OSMINOG Store.

Store entities:
- modules/surfaces;
- agents/roles;
- connectors;
- templates/workspaces/automations.

Every package declares capabilities and permissions. Store plugins consume the shell APIs rather than creating their own incompatible navigation/window systems.

The Store itself opens as a focus/search surface and is also searchable from the eye.

## 14. System settings — pressure chamber

System settings become one coherent settings surface with sections such as:
- Appearance: Ocean / Dark / Light, accent, motion, text size;
- Canvas defaults;
- Providers/sessions;
- AI access/Presence permissions;
- Local files/project folder;
- Poseidon/native-device permissions;
- Browser/session behavior;
- Store/plugins;
- Updates/build channel;
- accessibility/privacy.

Settings are not buried inside individual agent chats.

## 15. Themes

Ocean is the primary OSMINOG identity.

Dark and Light remain full alternatives. They share:
- the same component hierarchy;
- the same sheet/focus/command behavior;
- the same positions and controls;
- the same accessibility and keyboard/touch model.

Only visual tokens/ambience change. A user must never need to relearn OSMINOG after switching theme.

## 16. Migration order

1. Ocean shell/theme tokens + eye + surface styling.
2. Universal search indexing and direct actions.
3. Provider Registry + Session Manager + connection/settings redesign + Google repair.
4. Layers/Inspector/context editing cleanup.
5. Agent octopus work-state system + connection z-order.
6. Team/Media/Code/Browser migration to focus workspaces.
7. Owner Vault/provenance unification.
8. Presence expansion to full UI/runtime state.
9. Store/plugin shell APIs.
10. Poseidon/native device layer and multi-agent conflict hardening.

At every step old functional entry points stay available until the replacement surface passes runtime regression checks.
