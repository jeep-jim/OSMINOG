# OSMINOG Chrome 3.11.1 — SEARCH LAYER

Base: **3.11.0 OCEAN SHELL ALPHA**.

This build continues the Ocean Shell rewrite without changing the existing OSMINOG engine/data model.

## What changes

- Rebuilds the universal Ocean search as a **curved bottom drawer** inspired by the original 2011 Yokkey/OSMINOG interaction concept.
- Moves the actual query field to the **bottom retrieval bar** while category navigation stays above the result area.
- Keeps the workspace calm when search is closed; the octopus eye pulls the search surface upward from the bottom.
- Adds a pull-down crest gesture to submerge/close the search surface.
- Adds live indexing for:
  - canvas objects;
  - local project-folder files/directories;
  - OSMINOG virtual folders;
  - Provider Registry services;
  - AI agents;
  - Markdown documents;
  - Browser Hub internal tabs.
- Adds query actions for:
  - internal web search;
  - preparing a Team task without auto-running it;
  - preparing a Google AI prompt without auto-sending it.
- Web search/opening is **internal-first through OSMINOG Browser Hub**; external Chrome is fallback only.
- Adds keyboard navigation: `Ctrl/Cmd+K`, `/`, arrows, Enter and Escape.
- Adds live index counters for objects/files/folders/AI/tabs/documents.
- Ocean remains primary; Dark and Light use the same Search Layer interaction grammar.

## Preservation rule

Only the isolated Ocean Shell presentation files plus manifest/build metadata were changed from 3.11.0:

- `osminog-ocean-shell.css`
- `osminog-ocean-shell.js`
- `manifest.json`
- `OSMINOG_BUILD.json`

Canvas/project state, stable object IDs, Team, provider transports, Browser Hub engine, Markdown engine, folder engine, Browser Presence and patch semantics remain inherited from 3.11.0/3.10.7.

## Candidate artifact

`OSMINOG-Chrome-3.11.1-SEARCH-LAYER-ROOT.zip`

- Files: **54**
- Size: **323960 bytes**
- SHA-256: `b5039cc4d903645f2f423e6235abe6d75509d3a1c485dbbc9ae233e9d92a1c0a`
- Root `manifest.json`: yes
- Manifest version: **3.11.1**
- Fixed manifest key: preserved

## Verification

Static checks completed:

- 20 JavaScript files pass `node --check`;
- 9 JSON files parse;
- real HTML duplicate IDs: 0;
- ZIP integrity: PASS;
- root manifest: PASS.

Runtime verification on the owner's real Windows/Chrome installation is still required before calling this build proven.
