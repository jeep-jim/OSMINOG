# OSMINOG Chrome 3.11.4 — LIVING EYE DOCK

Base: **3.11.3 BUBBLE EYE / ENVIRONMENT**.

This build is a focused desktop Chrome correction of the lower Ocean interaction node. It does not add a new product subsystem.

## Owner runtime feedback that triggered this build

3.11.3 loaded successfully on the owner's real Chrome installation, but the lower Eye/Dock implementation was visually rejected: the eye had separate halo/pedestal artifacts, the search surface still felt detached from the bottom rail, and duplicated visual eye elements remained inside the search UI.

The owner then updated the Figma reference with the intended desktop behavior:

1. asleep eye is nearly transparent and emits small bubbles;
2. hover wakes the eye and the horizontal slit follows the mouse;
3. click turns the eye red;
4. the search surface rises from the same bottom rail instead of appearing as a separate modal.

## 3.11.4 changes

- Rebuilds the bottom Ocean dock as one long rounded seabed rail with one centered eye.
- Removes the 3.11.3 detached halo / semicircle pedestal treatment.
- Eye idle state is low-opacity translucent glass with a dark horizontal slit.
- Eye emits a lightweight sleeping bubble stream.
- Hover/focus wakes the eye; pupil position follows the desktop pointer via CSS variables updated from pointer coordinates.
- Active/open state turns the eye red while keeping it as the single bottom anchor.
- Search surface collapses into the center of the same rail and expands upward from there.
- Removes the duplicate eye mark from the bottom search composer.
- Reduces overlapping blur/glow layers that caused rendering artifacts.
- Keeps existing Search index, Provider/Session Manager, Google/DeepSeek transports, Ocean FX settings, project IDs/storage, folders, Team, Browser Hub and patch semantics unchanged.

## Preservation scope

Only four files differ from the exact 3.11.3 tree:

- `manifest.json`
- `OSMINOG_BUILD.json`
- `osminog-ocean-shell.css`
- `osminog-ocean-shell.js`

## Candidate artifact

`OSMINOG-Chrome-3.11.4-LIVING-EYE-DOCK-ROOT.zip`

- Files: **55**
- Size: **342950 bytes**
- SHA-256: `74a9b7a760954785150de8bcaeeadca43fd4818f3659cd32acaa7f40b99ceec2`
- Root manifest: yes
- Manifest version: **3.11.4**
- Fixed manifest key: preserved from 3.11.3

## Static verification

- 21 JavaScript files: syntax PASS
- 9 JSON files: parse PASS
- real duplicate HTML IDs: 0
- ZIP integrity: PASS
- exact tree diff against 3.11.3: only the four files listed above

## Runtime status

**Owner runtime pending.** Do not call the new eye/dock interaction proven until the owner confirms the real Chrome behavior and visuals.
