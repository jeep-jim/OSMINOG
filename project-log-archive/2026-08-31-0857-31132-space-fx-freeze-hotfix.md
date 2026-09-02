## 2026-08-31 — 3.11.32 SPACE FX FREEZE HOTFIX

Owner runtime on 3.11.31 exposed a P0 freeze: switching to Dark caused the workspace tab to hang and subsequent reloads to remain stuck because the saved Dark theme re-triggered the same loop.

Root cause was introduced in 3.11.31 inspector FX injection. `injectThemeFx()` removed and recreated its own Space/Ocean settings section while a `MutationObserver` watched `#inspectorBody` child-list changes. The function therefore generated the very mutation that scheduled itself again, creating a self-sustaining render loop.

3.11.32 fixes only this regression:
- adds `fxInjecting` reentrancy guard;
- adds `fxInjectQueued` microtask coalescing;
- reuses an already-correct FX section instead of removing/re-adding it;
- only removes the opposite theme section when theme actually changes;
- observer ignores mutations created during the controlled injection pass.

Dark Space FX and colorful Light/Dark/Ocean theme icons from 3.11.31 are preserved. No other UI/runtime behavior is intentionally changed.

Artifact: `OSMINOG-Chrome-3.11.32-SPACE-FX-FREEZE-HOTFIX-ROOT.zip` — 350604 bytes — SHA-256 `b9f4effc5196c301bfe83b2d3cf65ea41e6440202c767e0b0a029e33fa9245c1`.
