# OSMINOG Chrome 4.0.10 — Canvas and Chat

- Images retain square source edges, including existing boards; the delete cross is removed from image objects. Keyboard Delete, confirmation and Undo remain available.
- Agent tabs use a symmetric vector octopus instead of overlapping animated CSS tentacles.
- Chrome toolbar icons, editor/home mark, favicon, popup and brand assets use the exact Windows eye geometry.
- Layers is the first control in the editor header.
- Adding an AI creates a visible independent tab. Loading a project preserves the selected tab and main provider instead of forcing GPT. Connection captions name the selected provider.

Verification: extension-ui-410 browser regression (add provider tabs via UI, isolated stored histories, real page reload, Delete/Undo, image edges, header order); existing agent runtime browser, session isolation and shared-board tests passed locally with Chromium headless shell. Provider replies are controlled fixtures, not real authenticated AI sessions. Format, extension key, permissions and updater are unchanged.

Install: back up the existing extension folder, replace program files in that same folder with this package, then reload OSMINOG at chrome://extensions/. Do not remove the extension or delete its project storage folder.
