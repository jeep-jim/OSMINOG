# OSMINOG 3.19.3 — Stability / Native Drop

- Graphics Studio tools are physically moved to a compact bottom dock.
- Layers are physically moved to the left; properties remain on the right.
- Both side panels have draggable splitters.
- ResizeObserver/render loop is guarded and debounced to stop action freezes.
- Native drag and drop of arbitrary PC files to the main canvas is restored through importFiles.
- The main canvas shows a drop target overlay while external files are dragged over it.
