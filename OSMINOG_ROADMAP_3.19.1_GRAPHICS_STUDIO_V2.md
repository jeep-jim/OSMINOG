# OSMINOG 3.19.1 — Graphics Studio v2

## Goal
Give humans and connected AI the same editable graphics language instead of forcing agents to approximate illustrations with circles, rectangles and raw coordinate patches.

## Product behavior
- Graphics is a first-class app in the bottom dock and opens without AI.
- AI uses `graphics_create` for native editable layers and `graphics_edit` for high-level editing actions.
- Selecting shape/vector/image/text on the main canvas exposes Graphics v2 controls in the right inspector.
- A selection can be opened in Graphics Studio, edited manually, and returned to the OSMINOG canvas as editable objects.

## Tools in this build
- Select, node edit, brush, eraser, pen, line, rectangle, ellipse, star, text, image/SVG import.
- Fill, 2-color linear gradients, stroke, dash, cap, opacity.
- Position/size/rotation/flip, align and distribute.
- Layer order, visibility, lock, grouping.
- Path smooth, simplify, close, reverse, stroke-to-path approximation.
- Non-destructive boolean groups: union/subtract/intersect/exclude.
- Masks/clipping.
- Image filters: grayscale, sepia, brightness, contrast, blur.
- PNG + SVG export.
- Main-canvas round-trip and side inspector quick tools.

## AI API
- `graphics_status`
- `graphics_open`
- `graphics_create`
- `graphics_edit`

`graphics_edit` actions include style, align_left/center/right/top/middle/bottom, group/ungroup, smooth, simplify, close, reverse, front/back and open.

## Open-source references
Inkscape and GIMP were reviewed for tool taxonomy and interaction patterns. Their application code is GPL-covered, so no Inkscape/GIMP source code is copied into this OSMINOG build. The implementation is original OSMINOG code on the existing bundled Fabric.js engine. This avoids unintentionally relicensing the whole OSMINOG distribution under GPL.

## Security
SVG import is sanitized before Fabric parsing: scripts, foreignObject/iframe/object/embed, event handlers and external href/url references are removed.
