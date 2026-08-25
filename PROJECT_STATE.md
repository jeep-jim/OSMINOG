# BriefCraft AI — project state

## READ THIS FIRST IN A NEW CHAT
If the user opens a new chat and writes **«начни»**, read this file completely first and continue from **Current build / next test**. Do not ask the user to retell the project. Do not restart Cloudflare/Codespaces/MCP/old service-tab experiments unless explicitly requested.

## Product goal
BriefCraft is a persistent shared visual workspace where project memory lives on the canvas. Human and AI work on the same board containing briefs, notes, files, images, code, browser/DOM captures, nodes, links and revisions.

Non-negotiable flow: **Install BriefCraft → Connect AI → Allow → work.** GPT/ChatGPT is first priority, then Gemini, DeepSeek, Claude later.

## Core architecture
AI Presence / Canvas Tool Bus is transport-independent:
- stable object IDs; canvas is source of truth
- compact selection/viewport/revision mirror
- exact get/search/read/capture calls only on demand
- structured `briefcraft.patch/v1`
- local Preview / Apply / Undo
- AI never invents an existing object ID

## Proven direct GPT transport
3.8.0–3.8.7 browser-page/service-window transport is rejected because it created visible ChatGPT surfaces.

3.8.8/3.8.9 live probes proved the extension service worker can use the already-authenticated `chatgpt.com` session directly: session/models/chat-requirements HTTP 200, access token and requirements token found, Proof-of-Work required, Arkose/WebSocket not required on the tested account, and no ChatGPT tab/window/chat created.

### 3.8.10 — proven baseline
`BriefCraft-AI-3.8.10-GPT-Direct-Chat-First-Live-Test.zip`

Live verified on 2026-08-25:
- one-word and long-answer tests succeeded inside BriefCraft
- first long response appeared in roughly 7 seconds
- no visible ChatGPT tab/window
- no new visible ChatGPT conversation in history

Transport uses the authenticated ChatGPT web backend, fresh chat-requirements, SHA3-512 Proof-of-Work and SSE. This is not a stable public API contract; keep it isolated behind Presence Core.

## Canonical brand
Canonical source: `brand/briefcraft-logo.svg`; `brand/brand.json` forbids the old blue mark. Primary `#EEBF26`, accent `#FFE100`.

## Proven UX layers
- 3.8.11: direct multimodal image upload worked; GPT recognized attached screenshots/images.
- 3.8.12: drag/drop + clipboard image paste + inline previews + exact object focus worked; GPT could read text inside an image and understand a tethered object.
- Chat history is local/per-project in `chrome.storage.local`, not ChatGPT history.
- Explicit save/exit dialog and autosave are present.
- Canonical yellow logo/system typography are in use.
- 3.8.13 introduced main + temporary agent chats, separate hidden GPT thread IDs, agent colors and canvas tethers.

## 3.8.14 live result — 2026-08-25
`BriefCraft-AI-3.8.14-Live-Editing-Agent-UX.zip`

User live-tested and confirmed the major execution gap is finally closed for supported properties:
- a tethered/selected shape really changed color on the canvas rather than only receiving a prose promise
- the shape also changed geometry/type in response to GPT edit commands
- patch application/Undo path is visibly functioning for these supported operations
- left/right edge tether routing and agent/chat UI are present enough to continue testing

New limitations became clear in the same live test:
- the editor lacks real vector authoring: pen tool, editable anchor/control points, arbitrary paths and masks
- complex requests such as adding eyes/teeth/custom silhouettes cannot be expressed reliably using only primitive rectangle/ellipse/triangle properties
- agent ghosts still look too childish and can feel visually disconnected from the object being investigated; user wants a restrained visual identity shared with agent micro-icons
- composer still has too much vertical air and the send arrow alignment/position is awkward

Therefore 3.8.14 proves **real canvas execution for supported primitive edits**, but not yet free-form vector editing.

## Current build / next test
### BriefCraft AI 3.8.15 — Vector Pen + Masks + Agent Wisps
Build created 2026-08-25:
`BriefCraft-AI-3.8.15-Vector-Pen-Masks-Agent-Wisps.zip`

Built directly on 3.8.14 while preserving the proven direct GPT transport and working patch path.

### Vector pen and editable geometry
- Existing freehand Pencil remains separate on `P`.
- New **Vector Pen** tool is available on `B`.
- Click to place anchor points; Enter finishes the vector path; Escape cancels the draft.
- Finished vectors are real canvas objects with normalized `pathNodes` and `pathClosed` state.
- Double-click a vector enters/exits node editing.
- Anchor nodes are directly draggable.
- Double-clicking an anchor toggles smooth Bézier handles.
- Bézier handles can be dragged; opposite handle mirrors by default, with Alt allowing independent adjustment.
- Right-click an anchor removes it when the path has enough points.
- Double-clicking the path while editing adds another anchor at the clicked location.
- Vector paths support open/closed state, stroke, solid fill and the existing linear-gradient fill model.

### Convert existing artwork to vectors
- Double-clicking an ordinary primitive shape converts it to an editable vector outline.
- Freehand ink inspector includes a **Convert to editable path** action.
- Inspector for vector objects includes node-edit and open/close-path controls.

### Vector masks
- When one vector path and one image are selected together, the multi-selection inspector exposes **Path → mask**.
- The image stores normalized `maskNodes` / `maskClosed` and applies the path as a CSS clip-path mask.
- Image inspector includes mask removal.
- This mask implementation is present in code but still requires live Chrome verification in 3.8.15; do not claim runtime success before the user tests it.

### AI-editable vector data
Canvas Tool Bus / bridge object details now expose:
- vector `pathNodes`, `pathClosed`
- image `maskNodes`, `maskClosed`

These properties are accepted by `set` patches, and `vector` is accepted as a creatable object type. GPT machine instructions now explicitly tell the model to use vector/path data for arbitrary geometry and mask data for image masks instead of pretending primitive shape fields can express everything.

### Agent ghost / identity redesign
- Replaced the cartoon cloud/face treatment with a quieter translucent **wisp** identity.
- The exact same wisp visual language is used for the active-chat avatar and agent tab micro-icons.
- Each agent retains its distinct color.
- When AI activity starts, the canvas wisp is positioned immediately near the target object instead of visually travelling from a corner/top of the screen.
- While the object is being studied, movement is a slow small orbit around the object rather than large playful motion.

### Composer cleanup
- Composer starts as a compact one-row field.
- Textarea auto-grows only as content needs more height, within a bounded range.
- `+`, emoji and send arrow are vertically centered inside the unified composer frame.
- Send arrow is a compact upward arrow at the right edge.
- After send the field collapses back to its compact height.

### Static verification completed for 3.8.15
- manifest version = 3.8.15
- all extension JavaScript passes `node --check`
- manifest JSON parses
- checked editor/popup/screenshot HTML has no duplicate IDs
- ZIP integrity passes
- no service ChatGPT tab/window transport was reintroduced

### Runtime verification required
Test in this order:
1. Load 3.8.15 and verify Pencil still works on `P`; activate Vector Pen with `B`.
2. Click 4–5 anchors and press Enter; verify a new vector object appears.
3. Double-click the vector; drag an anchor. Double-click an anchor, then drag its Bézier handles.
4. Right-click an anchor to remove it; double-click the path to add another point.
5. Double-click an ordinary rectangle/ellipse to convert it to a vector; also test freehand Ink → Convert to editable path.
6. Select one vector and one image, apply **Path → mask**, and verify the image is clipped; remove the mask afterward.
7. Tether the vector to GPT and ask for a specific node/path geometry change; verify a real `pathNodes` patch changes the canvas and Undo restores it.
8. Trigger an object read and verify the active agent wisp appears immediately beside the object and moves slowly nearby; agent tab/header icon should use the same wisp identity.
9. Type/send one-line and multiline messages; verify the composer stays compact, auto-grows cleanly, and the send arrow remains aligned.

Do not claim these new 3.8.15 runtime behaviors are proven until the user tests them live.

## Important future direction — self-editing BriefCraft
User wants an eventual mode where an agent inside BriefCraft can edit BriefCraft’s own source/repository through an explicitly authorized GitHub tool/connector, including code/design changes and diff/commit/PR review. Current in-app GPT does not automatically inherit ChatGPT product connectors. Build this as a separate external-tools permission layer after canvas editing is sufficiently stable.

## Workflow rule
Keep the proven direct text/multimodal transport stable. Fix runtime issues by layer. Never regress to browser-page automation and never claim live behavior is solved before user verification.
