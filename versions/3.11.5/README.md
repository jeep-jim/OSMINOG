# OSMINOG Chrome 3.11.5 — EYE REVEAL

Base: **3.11.4 LIVING EYE DOCK**.

This build is a focused desktop Chrome interaction correction. It preserves the 3.11.4 engine and all provider/session/project behavior while replacing the lower Ocean interaction node to match the owner's latest Figma sequence.

## Owner-approved sequence

1. **Idle:** no persistent lower rail; only one nearly-transparent octopus eye remains at the bottom center.
2. The horizontal pupil follows the desktop pointer even while the eye is asleep.
3. **Hover:** the eye wakes/red-tints and a translucent horizontal Ocean bubble grows outward from that same eye.
4. **Click:** the eye becomes active red and the Search surface lifts vertically from the same horizontal bubble as one composite shape.
5. **Empty canvas:** the bottom canvas tool rail is hidden until an object/connection/edit context is selected.

## Preservation rule

Only the Ocean presentation/runtime adapter plus build metadata changed from 3.11.4:

- `osminog-ocean-shell.css`
- `osminog-ocean-shell.js`
- `manifest.json`
- `OSMINOG_BUILD.json`

Search indexing, Provider/Session Manager, Google/DeepSeek transports, Team, Browser Hub, Media Crew, folders, Presence, stable IDs and patch semantics remain inherited.

## Candidate artifact

`OSMINOG-Chrome-3.11.5-EYE-REVEAL-ROOT.zip`

- Files: **55**
- Size: **344669 bytes**
- SHA-256: `1473094f457ae801b48d2805e9f712523bc1264dd4df9b73909fa0c8a5d4b11f`
- Root `manifest.json`: yes
- Manifest version: **3.11.5**
- Fixed manifest key: preserved

## Verification

Static verification completed:

- 21 JavaScript files pass `node --check`;
- 9 JSON files parse;
- real HTML duplicate IDs: 0;
- ZIP integrity: PASS.

Owner runtime verification is still required before calling the interaction proven.
