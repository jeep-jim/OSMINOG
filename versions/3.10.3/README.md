# OSMINOG Chrome 3.10.3 — WINDOWS FOLDERS

Base: 3.10.2.

## Folder model

- The bottom folder tray is removed.
- Only the main project folder can be minimized. Its restore/open control and the `+` new-folder control live in the Layers panel.
- Closing a virtual folder stores it inside the main project folder; it does not create another tray item.
- Virtual folder icons are rendered in viewport screen space, so they keep a fixed desktop size and position while the canvas zooms and pans.
- Archived virtual folders appear inside the main project root and can be restored to the desktop.

## Windows-style explorer

- Large icons, tiles, list and details views.
- Search and sorting by name/type/date.
- Per-folder content size and desktop icon size, plus apply-to-all defaults.
- Rename by double-clicking the name.
- Nested virtual folders and drag/drop moves for virtual folders and canvas objects.
- Real approved project directories support creating folders, renaming, moving and deleting entries through the File System Access API.

## Artifact

- Name: `OSMINOG-Chrome-3.10.3-WINDOWS-FOLDERS-ROOT.zip`
- Size: `317306` bytes
- SHA-256: `fe2b668a53671bb91d12293456d6b1a6fc78dca5d7f8565955886606c49c010d`
- Files: `53`
- Manifest version: `3.10.3`
- Fixed Chrome key: preserved

## Runtime checks still required

1. Minimize and restore the main project folder from Layers.
2. Close a virtual folder and confirm it appears inside the root folder, not in a bottom tray.
3. Zoom and pan the canvas and confirm folder icons do not scale or drift.
4. Test all view modes, search, sorting, per-folder sizes and apply-to-all.
5. Rename and move virtual and real entries between folders.

The full ZIP is not claimed as stored in GitHub unless remote size and SHA-256 match.
