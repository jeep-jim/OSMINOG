# OSMINOG 3.19.3 — Stability / Native Drop

- Graphics Studio tools are physically moved to a compact bottom dock.
- Layers are physically moved to the left; properties remain on the right.
- Both side panels have draggable splitters.
- ResizeObserver/render loop is guarded and debounced to stop action freezes.
- Native drag and drop of arbitrary PC files to the main canvas was reintroduced through a document-level capture handler. This path is superseded by 3.19.4 because it duplicated the original viewport drop pipeline and could freeze the workspace.
