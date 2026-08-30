## 2026-08-30 — OSMINOG 3.11.28 UNIFIED CHAT RESIZE + TEAM DEFAULT SIZE

Owner runtime-tested 3.11.27 and confirmed that the Light theme contrast change is visible, but the AI chat still does not resize by dragging the left/right edges. Owner also requested that Team Room open by default at approximately the compact working size shown in the runtime screenshot.

Root cause / design correction:
- AI chat still used its own legacy drag/resize implementation while Team/Browser/Markdown already used `OSMINOGWindowManager`.
- Maintaining two window systems made edge-resize behavior inconsistent and fragile.

3.11.28 changes:
- AI chat is migrated to the shared `OSMINOGWindowManager`; its legacy duplicate drag/resize engine is disabled.
- Managed resize hit targets are moved inside window borders so `overflow:hidden` cannot clip them and pointer capture is easy to hit.
- Left/right/top/bottom and all corner resize targets remain available.
- Team Room first-open default geometry becomes 620x520 px with responsive internal columns; existing saved owner geometry still has priority.
- Light theme baseline `#DEE2E7` from 3.11.27 is preserved.

Artifact: `OSMINOG-Chrome-3.11.28-UNIFIED-CHAT-RESIZE-TEAM-DEFAULT-SIZE-ROOT.zip`
Size: 347665 bytes
SHA-256: `7b3e72036855c7e26e27466246c7329a6c83d0d4fe1ddabb63cac27848f424ac`
Static checks: 21 JS syntax PASS, 9 JSON parse PASS, 0 real duplicate HTML IDs, ZIP integrity PASS.
Owner runtime: pending.
