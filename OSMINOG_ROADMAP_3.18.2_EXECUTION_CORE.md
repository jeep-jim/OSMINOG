# OSMINOG 3.18.2 — Execution Core Recovery

## Product rule
OSMINOG is an execution workspace for AI, not a chat wrapper. For action requests the expected chain is: user intent → active target/context → tools → mutation/result → verification → concise reply.

## Required behavior
- Ordinary questions remain normal conversation.
- Action verbs switch the chat into executor behavior: tools first, no long plan/excuse, no repeated paraphrase.
- “Done” is allowed only after a verified mutation, installed/tested app, real asset/object, repository commit, or release action.
- The selected or tethered canvas object is exposed as `activeTarget`; deictic requests (“this”, “it”, “this object”) resolve to it.
- Owner/Poseidon remains only for changing OSMINOG source/repository/release. Normal project work does not require Owner mode.

## Browser Editor recovery
- Browser Editor exposes the currently selected DOM element to AI context.
- `browser_edit_current` performs real text/HTML/style/class changes on the selected element.
- `browser_extract_current` places an extracted HTML/CSS component on the OSMINOG canvas as editable code.
- Canvas screenshot capture requests `<all_urls>` once so screenshot-driven inspection does not fail with the Chrome `activeTab` permission error.

## Development workspace foundation
A dedicated “Разработка” window is added with creation intents: site, app, game, presentation, document, graphics, extension. It forwards the selected OSMINOG object as the active target and sends an execution-first brief to the main AI chat. Browser Editor and Graphics Studio are available directly from the workspace.

## Mascot
The worker octopus must look like a friendly octopus rather than a spiked loader. Tentacles are rounded and softly animated; work/inspect states differ by animation speed.

## External references
- Sider is useful as a reference for multi-AI access and quick model switching, but OSMINOG’s center remains the canvas and executable objects.
- octos-org/octos (Apache-2.0) is referenced only for architectural ideas such as agentic OS, tool-first agents and persistent execution. No Octos source code is copied into this build.

## Next verification
1. Ordinary question → concise normal answer, no canvas preload.
2. “Change this” with a selected object → uses `activeTarget`, real mutation, concise result.
3. Browser Editor selected element → AI can inspect/edit/extract it.
4. New non-preset app request → generated app, module test passes before “done”.
5. Poseidon source edit → actual file mutation/commit evidence, no prose-only completion.
6. Development window can forward selected object into a site/app/game/document creation request.


> Superseded by OSMINOG_ROADMAP_3.19.0_CORE_RESET.md for product direction.
