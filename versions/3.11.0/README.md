# OSMINOG Chrome 3.11.0 — OCEAN SHELL ALPHA

Base: **3.10.7 UPDATE BRIDGE**.

This is the first interface-generation rewrite. It deliberately preserves the existing canvas/project engine, provider transports, Team, Browser Hub, Media Crew, Markdown/Code, folders, Presence, module IDs, storage keys, fixed Chrome key and patch semantics.

## New shell
- Ocean becomes the primary interface theme.
- Dark and Light remain available and use the same interaction grammar.
- Figma Ocean gradient is translated into the desktop shell: deep blue depth, light shafts, translucent plankton, submerged glass surfaces and bioluminescent active states.
- `prefers-reduced-motion` disables non-essential ambient motion.
- Existing panels/modules are restyled rather than removed.

## Octopus eye
A new eye control sits at the bottom of the workspace. Click it, drag upward, press `/`, or use `Ctrl/Cmd+K` to open the first universal search/command surface.

The alpha can already:
- search current canvas objects;
- reveal/focus an object;
- open Team;
- open Google AI;
- open Live Presence / AI access;
- open Media Crew;
- open Browser Hub;
- open Markdown Studio;
- open modules/connections;
- open local project folder entry point;
- open settings/history;
- hand a free-text web query to OSMINOG's internal-browser route.

Full indexing of project files, chats, history and provider/session state continues in the next pass.

## Theme migration
Existing users are migrated to Ocean once through `ui.oceanShellMigrated`. After that their chosen Ocean/Dark/Light theme persists normally.

## Artifact
- `OSMINOG-Chrome-3.11.0-OCEAN-SHELL-ALPHA-ROOT.zip`
- Size: **317919 bytes**
- SHA-256: `f9bad38e1cbca7ad7c8bd3cea739c16deb918bf4241753862e9ac2a7908c2bfd`
- Files: **54**
- Manifest: **3.11.0**
- Fixed manifest key preserved.

## Static verification
- 20 JavaScript files pass `node --check`.
- 9 JSON files parse.
- No duplicate real HTML IDs.
- ZIP integrity passes.

## Runtime checklist
1. Install over the current 3.10.7 unpacked folder and Reload the same Chrome extension card.
2. Confirm version 3.11.0 and Ocean theme on first launch.
3. Verify the project and existing objects are unchanged.
4. Cycle Ocean → Dark → Light → Ocean with the existing theme control.
5. Open the octopus eye and verify search/command surface.
6. Search an existing object and confirm reveal/focus works.
7. Open Team, Google AI, Live Presence, Media Crew, Browser Hub, Markdown, modules and folders through their existing controls and via the eye layer.
8. Verify DeepSeek remains unchanged.
9. Verify existing local project persistence, nodes/connections and drag/resize still work.
10. Check CPU/GPU behavior with Ocean motion and `prefers-reduced-motion`.

This build is an **alpha shell candidate**, not yet a stable production build.
