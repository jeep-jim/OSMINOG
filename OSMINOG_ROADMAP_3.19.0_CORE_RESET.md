# OSMINOG 3.19.0 — CORE RESET

## Product definition
OSMINOG is a universal canvas between a person and any AI. The primary loop is:

**Drop → Open → Connect → Explain → Send to AI → Get a real result back on the canvas.**

## Four visible pillars
1. **Canvas** — files, images, notes, sites, code, apps and results.
2. **AI chat** — one command surface for any connected model. Workspace tools are available automatically.
3. **Browser** — inspect/edit live layout, capture/extract DOM/CSS/assets and bring them onto the canvas.
4. **Modules** — connect AI providers, Drive/GitHub/Figma/services, install/create widgets and developer APIs.

Everything else is contextual or internal. The separate Development window introduced in 3.18.2 is removed. Poseidon is owner-only and exists only to change OSMINOG itself.

## AI access rule
A connected AI always receives OSMINOG workspace tools. It must not require a separate canvas permission switch. Full canvas contents are not preloaded; the selected/tethered object is exposed as `activeTarget`, and the model requests only the context it needs.

## Connections / nodes
Connections are first-class editable objects. They can be selected, recolored, labeled, bent directly on canvas, deleted, and their endpoints can be dragged to another object. Connection descriptions are contextual instructions that can travel with a connected graph into AI context.

## Contextual inspector
The right panel belongs to the current selection. Image → image tools. File/PDF → file reader/editor tools. Browser DOM element → layout tools. Connection → flow tools. No generic panel should dominate the workspace when nothing is selected.

## Browser
Browser editing remains a core feature: inspect an element, edit live DOM/CSS, capture/extract a component and reuse it in another site/app/module.

## Mascot
The canvas worker is a friendly floating octopus with short soft tentacles and subtle state animation. It communicates inspect/work/done/error without looking like a spiked loader.

## External references
- Sider: reference for frictionless multi-AI access, not for product structure.
- octos-org/octos (Apache-2.0): architectural reference for tool-first persistent agents. No source code copied.
