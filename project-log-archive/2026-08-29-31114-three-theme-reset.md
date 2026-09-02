## 2026-08-29 — 3.11.14 THREE THEME RESET: Ocean becomes a theme, not a second UI

Owner decision after real use of 3.11.10–3.11.13: the experimental Ocean interaction shell became visually interesting but operationally confusing. Kraken Arc, Living Eye navigation, Ocean bottom dock, bubble containers, drift/collision physics and multiple competing navigation systems made normal work harder, even for the product creator.

Canonical decision:
- OSMINOG returns to ONE familiar workspace layout for everyday work.
- Light, Dark and Ocean are three visual themes of that same layout.
- Theme control cycles Light → Dark → Ocean; Ocean uses a waves icon.
- Ocean keeps underwater depth, transparency/glass material and optional Ocean FX only.
- Ocean-specific navigation/layout runtime is removed from the active path: no Kraken Arc, no Living Eye Search shell, no Ocean bottom dock/tool shelf, no drift/collision engine, no provider bubble-container UI.
- Existing project data and useful functional objects are preserved; this is a UI/runtime simplification, not a destructive project migration.
- Compatibility `data-ui-mode` remains `space`; Ocean is now represented only by `data-theme="ocean"`.
- The next priority is to finish polish of the familiar interface and then return to core functional work: Google multimodal/session coherence, Team execution, Browser Hub/internal sessions, Media Crew, Presence, Code/Markdown/files.

Build candidate: OSMINOG 3.11.14 THREE THEME RESET
- ZIP: 55 files · 323979 bytes
- SHA-256: `4c0812846e17c0f2d96b795cdf4d22308a68cbe6ac444e2f357e459029661498`
- Static: 21 JS syntax PASS; 9 JSON parse PASS; 0 real duplicate HTML IDs; ZIP integrity PASS.
- Ocean runtime performance: no animation-frame JS loop, no collision timer, no self-triggering render MutationObserver.
- Owner runtime pending.
