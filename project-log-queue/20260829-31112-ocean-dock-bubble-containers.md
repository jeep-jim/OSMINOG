## 2026-08-29 — 3.11.12 OCEAN DOCK & BUBBLE CONTAINERS

- Owner installed 3.11.11 and confirmed the portal positioning fix, but rejected the resulting Ocean shell layout as visually confusing/overloaded: identity top-left, separate mode rail right, Kraken bottom and legacy rail created too many navigation systems at once.
- New owner drawing establishes the shell contract: one bottom dock, left identity block, Kraken eye in the centre, Brief/Code/Browser/Design/Team on the right.
- Hovering a right-side mode must reveal its tools as a compact linear shelf just above the dock. Moving the pointer away or clicking empty canvas hides it. No second radial menu for tool groups.
- Selecting a canvas tool reuses the existing right inspector for that tool's settings.
- Layers remains a dedicated control inside the left dock cluster. Space mode remains unchanged.
- Ocean zoom is reduced to a compact `100%` pill; extra controls expand only on intent.
- Floating provider shortcuts, desktop folders and module bubbles gain collision separation so passive drift does not let them occupy the same space.
- Intentional provider shortcut overlap creates a persistent Ocean bubble group, analogous to an Android desktop folder/container. Folder-on-folder keeps the existing virtual-folder nesting runtime.
- Built candidate `OSMINOG-Chrome-3.11.12-OCEAN-DOCK-BUBBLE-CONTAINERS-ROOT.zip` from 3.11.11.
- ZIP: 55 files, 369631 bytes, SHA-256 `049aa1245c38495946c8a45eb712205d2f4c1c6a218562da09709d7803644487`.
- Static verification: 21 JavaScript syntax PASS, 9 JSON parse PASS, 0 duplicate real HTML IDs, ZIP integrity PASS.
- Runtime verification remains owner-pending.
