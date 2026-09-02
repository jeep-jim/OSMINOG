# OSMINOG Chrome 3.13.0 — APPLICATION WORKSPACE

- Replaces the fragmented primitive rail with eight permanent applications: OSMINOG AI, Graphics, Text, Browser, Files, Modules, Team and Development.
- Uses one colorful macOS-like bottom dock outside the zoomable world. Core apps stay fixed-size; installed extensions keep the same icon language and running indicator.
- Every managed window is movable, resizable, restored above older windows and minimized back to its dock icon.
- Window controls now live in the actual header. Node/focus is omitted from system-only windows such as Module Store, Team, Access Center and Extension Studio.
- Adds a full Graphics application that drives the canonical canvas engine for selection, hand, pencil, vector pen, shapes, text and connections.
- Pencil strokes immediately switch to selection after drawing, so the new line can be moved, resized and edited without manually choosing the arrow.
- Connection compose is a two-click interaction. Hover exposes valid object targets; grouped objects act as one connection endpoint and the finished connection is editable in the inspector.
- Text creation uses the canvas text object and the right inspector; Markdown remains available as a full document application.
- Chat is branded OSMINOG AI rather than the current provider and is pinned to the latest message through initial load, hydration and media loading.
- Replaces separate, confusing Access/Poseidon surfaces with one Access & Permissions center covering canvas rights, source/GitHub rights and human sharing.
- Module Store keeps one master/detail interaction, adds a draggable middle splitter and lays the widened module area out in two or three colored columns.
- System modules cannot be deleted. User modules expose edit, dock removal and deletion as distinct actions.
- Extension Studio adds PNG/WebP/SVG/JPEG logo upload, transparent preview, a repaired grid and a non-overlapping footer.
- Widget runtime removes the redundant opaque outer body so transparent utilities remain transparent.
- `asset_create` is explicitly exposed in the live AI context, accepted as a completed canvas mutation only when it returns a real object ID, and preserves PNG/WebP/SVG transparency.
- Browser is a managed application with a consistent window shell and a direct “File to canvas” action.
