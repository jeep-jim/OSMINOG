## 2026-08-29 · OSMINOG 3.11.22 TEAM EXECUTION & Z-LAYER FIX

Owner runtime on 3.11.20 exposed two concrete production-blocking regressions inside Team mode:

1. A simple direct canvas-edit mission (for example recolor a shape and convert it to a circle) could run multiple Team discussion rounds but finish without changing the canvas. Code review confirmed the Team path did not reuse the focused-chat forced-patch retry path: a prose-only executor response was accepted as the end of execution and only produced `Исполнитель не вернул patch`.
2. Desktop provider shortcuts were rendered in a higher stacking context than the Team workspace, so ChatGPT/Gemini/DeepSeek/Claude/Nano Banana shortcuts could visually sit on top of the Team window. Generic chat-group CSS also touched Team messages and, together with accumulated overrides, could collapse transcript bubbles into unreadable horizontal strips.

3.11.22 changes:

- `background.js`: assistant protocol parser now accepts valid raw JSON machine objects in addition to fenced JSON for both `briefcraft.request/v1` and `briefcraft.patch/v1`. Raw protocol blocks are removed from user-visible answer text after parsing.
- `gpt-presence.js`: Team execute calls now set an explicit execution contract. Missing patch triggers up to two mandatory patch retries. Spatial language (`topmost`, `bottom`, `left`, `right`) must be resolved from actual object bounds in `projectMap`; only real IDs may be used. A true-circle request is explicitly defined as ellipse geometry with equal width/height while preserving center. Tool requests are drained for each retry before deciding execution failed.
- `osminog-team.js`: the main selected agent remains lead executor; if no patch survives after required retries, another selected agent becomes reserve executor. If a returned patch is rejected by OSMINOG validation, the actual validator error is sent back to the executor for one corrected-patch attempt. Team never claims canvas success without a staged/applied validated patch.
- `osminog-chat-ux-lite.js`: Team transcript removed from generic cross-chat grouping. GPT and Google chat grouping remains unchanged.
- `editor.css`: Team workspace stacking raised above desktop provider shortcuts while staying below topbar/Inspector. Team message rows/body/content are explicitly auto-height, visible and non-collapsing.
- 3.11.21 UI cleanup / provider-brand / Ocean chat polish is included because owner runtime screenshot was still 3.11.20; 3.11.22 can be installed directly over that runtime.

Artifact: `OSMINOG-Chrome-3.11.22-TEAM-EXECUTION-Z-LAYER-FIX-ROOT.zip`  
Files: 56  
Size: 341171 bytes  
SHA-256: `093a4b4faa53b19d6df000208a61481752d9d5768ba4df1ff32f637b75c89412`

Static verification: 21 JavaScript files syntax PASS; 8 JSON files parse PASS; 0 real duplicate static HTML IDs; ZIP integrity PASS. Raw/fenced protocol parser smoke-test PASS. Owner runtime pending.
