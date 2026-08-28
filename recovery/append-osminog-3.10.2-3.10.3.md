
---

## 2026-08-28 — OSMINOG 3.10.2 FOLDERS & CHAT UX

### Starting state and requested work
- Base: manually installed OSMINOG 3.10.1.
- The owner requested Windows-like folders on the OSMINOG desktop, nested folders, folder minimization, cleaner collapsed Layers, Telegram-style grouped chat bubbles, long-link wrapping, visible focused agents and universal Ctrl+V screenshot insertion.

### Built changes
- Added the first virtual canvas-folder implementation with right-click creation, inline rename, nesting, object/file drop, unpacking and a bottom restore tray.
- Added grouped Telegram-style bubbles to GPT, Team and Google chats; long links and code wrap inside message bounds.
- Added focused-agent placement near the selected object while preserving study/work animations.
- Added universal Ctrl+V image extraction from clipboard files, HTML image URLs, Clipboard API and the latest OSMINOG screenshot cache.
- Preserved the DeepSeek authenticated web-session transport and Google bridge.

### Static verification and artifact
- Complete ZIP: `OSMINOG-Chrome-3.10.2-FOLDERS-CHAT-UX-ROOT.zip`.
- Files: `52`; root `manifest.json`; version `3.10.2`; fixed Chrome key preserved.
- SHA-256: `fb801c45dccb3365868de8c90a8544210d2902c61aad5c5c7338a389e3830a36`.
- Size: `292832` bytes.
- All JavaScript passed syntax checks; all JSON parsed; no duplicate static HTML IDs; no missing local references; ZIP integrity passed.

### Confirmed runtime result that required the next build
- The first folder model did not match the requested desktop behavior.
- Every virtual folder was minimized into a bottom tray, while the owner wanted only the main project folder plus a `+` control in Layers.
- Closing a virtual folder should store it inside the main project folder, not create a tray chip.
- Virtual folder icons were tied to the canvas world and therefore scaled/moved with canvas zoom and pan.
- Folder windows still lacked complete Windows-style views, per-folder sizing, search and internal moves.

### Exact next action
- Replace the first folder layer with a fixed screen-space desktop folder system and a unified Windows-style explorer.

---

## 2026-08-28 — OSMINOG 3.10.3 WINDOWS FOLDERS

### Requested work
1. Remove the bottom multi-folder tray.
2. Keep only the main project folder restore/open control and the new-folder `+` inside Layers.
3. Closing any virtual folder must store it inside the main project folder.
4. Folder icons must keep fixed desktop positions and sizes independent of canvas zoom and pan.
5. Add Windows-like views, search, sorting, double-click rename, nested folders, moves between folders and per-folder/global size settings.
6. Continue the append-only GitHub roadmap after every build.

### Built changes
- The legacy bottom folder tray, legacy world folder icons and legacy folder windows are disabled.
- Only the main project folder can be minimized. Layers now contains one project-folder control and one `+` button.
- Closing a virtual folder sets it as stored in the root project folder. It disappears from the desktop and appears inside the root explorer.
- Virtual desktop folders render in a viewport overlay using screen coordinates; canvas zoom/pan no longer scales or drifts them.
- Added a unified movable/resizable Windows-style explorer for the real project root and virtual folders.
- Added views: large icons, tiles, list and details.
- Added search, sort by name/type/date, per-folder item size, per-folder desktop icon size and apply-to-all defaults.
- Added double-click rename for virtual folders, canvas objects and real filesystem entries.
- Added nested virtual folder moves and object moves by drag/drop.
- Extended the approved project-folder API with `mkdir`, `rename`, `move` and `remove`. Physical moves use copy-then-delete because the File System Access API has no universal native move operation.
- Archived virtual folders can be restored to the OSMINOG desktop from the root explorer.
- Existing grouped chat bubbles, universal Ctrl+V image paste, DeepSeek transport, Google bridge and Media Crew are preserved.

### Static verification and artifact
- Complete ZIP: `OSMINOG-Chrome-3.10.3-WINDOWS-FOLDERS-ROOT.zip`.
- Files: `53`; JavaScript files: `20`; JSON files: `9`.
- Root `manifest.json`; version `3.10.3`; fixed Chrome key preserved.
- SHA-256: `fe2b668a53671bb91d12293456d6b1a6fc78dca5d7f8565955886606c49c010d`.
- Size: `317306` bytes.
- All JavaScript passed `node --check`; all JSON parsed; no duplicate HTML IDs; no missing local references; CSS braces balanced; ZIP integrity passed; the new `osminog-windows-folders.js` is present in the ZIP.

### Honest runtime status
- Static verification is complete; Windows/Chrome runtime verification is still required.
- Chrome still requires one explicit owner gesture for project-folder permission.
- Virtual canvas folders remain project metadata and are not silently converted into physical Windows folders.
- Automatic development updating remains disabled until OSMINOG Dev Hub is built.

### Exact next action
1. Install 3.10.3 into the actual Desktop extension folder and reload the existing Chrome card.
2. Close a virtual folder and verify it appears inside the main project folder, with no bottom tray item.
3. Minimize the main project folder and restore/open it from Layers.
4. Zoom and pan the canvas and verify folder icons retain the same screen size and position.
5. Test large icons, tiles, list and details; search; sorting; per-folder sizes and apply-to-all.
6. Rename and move virtual folders, canvas objects and real files/folders between directories.
7. Append the real runtime result to this log before the next build.
