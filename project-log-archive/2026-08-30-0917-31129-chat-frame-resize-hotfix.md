## 2026-08-30 09:17 — OSMINOG 3.11.29 CHAT FRAME RESIZE HOTFIX

Owner installed 3.11.28 and confirmed the Team default window geometry change, but AI chat still did not resize from left/right/top/bottom edges or corners. This is a runtime regression blocking normal chat use.

Root cause direction: 3.11.28 unified AI chat onto OSMINOGWindowManager, but resize still depended on tiny child resize-handle elements inside a complex chat DOM. Those pointer events were unreliable / swallowed by nested chat surfaces.

3.11.29 keeps the unified WindowManager but adds direct frame-edge capture on the managed window itself. Pointerdown within 12px of any edge/corner starts N/E/S/W/corner resize in capture phase, so nested content cannot steal the resize gesture. Existing child handles remain non-canonical; no second resize engine is reintroduced.

Artifact: OSMINOG-Chrome-3.11.29-CHAT-FRAME-RESIZE-HOTFIX-ROOT.zip
Size: 348148 bytes
SHA-256: 8834fed02b8a248cdd364aa25812c906706e5db3cfa732f7153bf1f573b7164f
Files: 56
Static checks: 21 JS syntax PASS, 9 JSON parse PASS, 0 duplicate real HTML IDs, ZIP integrity PASS.
Runtime status: owner verification pending.
