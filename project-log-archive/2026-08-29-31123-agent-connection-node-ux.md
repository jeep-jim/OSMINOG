## 2026-08-29 — OSMINOG 3.11.23 AGENT CONNECTION & NODE UX

Owner feedback after the Team/runtime pass: Agent Settings still duplicated/oversized provider grids, only a small fixed set of services acted as agent brains, `+` silently cloned the current AI, service connection/auth UX still implied external tabs, persistent agent capsules polluted the canvas, and node editing needed to remain directly accessible.

Implemented candidate 3.11.23 over 3.11.22:
- Agent Settings use responsive container queries and reflow into 2–3 columns as the window grows.
- One brain picker is generated from the full Provider Registry. Registry providers can be selected as agent brains; dedicated transports remain preferred, while other sites use an experimental generic internal web-session bridge when their prompt/response UI can be discovered.
- AI-chat `+` now opens a centered provider chooser. The owner explicitly chooses another agent of the same provider or a different provider; no silent duplicate agent is created.
- Connection is internal-first: `OSMINOGSessionManager` creates/reuses one managed service session in the background and connects the exact managed tab. Interactive third-party login cannot be completed silently; `Авторизовать` reveals/focuses that same managed service session instead of creating a random external Chrome tab.
- Provider availability/status is dynamic instead of hard-coded to six brain IDs.
- Persistent canvas agent pills are disabled. Agents remain as chat/team chips; worker octopuses are the only task-time canvas representation. Explicit pinned/node links can retain tethers without a desktop capsule.
- Selecting an existing node opens Inspector and exposes connection preset controls (color, width, dashed, arrow); all eight ports remain available.
- 3.11.22 Team patch enforcement, validator repair, fallback executor, Team z-layer and transcript auto-height fixes remain included.

Candidate artifact: `OSMINOG-Chrome-3.11.23-AGENT-CONNECTION-NODE-UX-ROOT.zip` — 56 files · 338860 bytes · SHA-256 `e18c2bee579078a40501c70be2b079509f40a66f6dbd072c00ba495773949296`.

Static verification: 21 JS syntax PASS; 8 JSON parse PASS; 0 duplicate HTML IDs per document; ZIP integrity PASS. Owner runtime pending.
