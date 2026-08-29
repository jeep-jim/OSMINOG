## 2026-08-29 — OSMINOG 3.11.25 CHAT TABS RESTORE

Owner runtime on 3.11.24 confirmed Settings close works, but chat tabs became confusing/broken after the 3.11.23 add-agent/provider rewrite. Product decision: restore the proven persistent project-thread behavior and keep only one improvement on `+` — explicit provider choice.

Changes in 3.11.25:
- Creating a new chat tab no longer depends on provider connection/auth state. The tab is created immediately and can be connected afterwards.
- `+` opens a provider chooser instead of silently cloning the current AI. First action is `Ещё <current provider>`, followed by other Provider Registry services.
- Picker has a built-in core fallback for ChatGPT, DeepSeek, Google AI, Gemini, Claude and Custom AI, so late Provider Registry initialization cannot produce an empty chooser.
- Picker is portaled to `document.body` and positioned under the `+` button to avoid clipping by chat/settings overflow.
- Legacy thread storage/switching/history behavior is preserved; no replacement thread engine was introduced.
- UI wording no longer calls normal project tabs `temporary agents`; closing a tab removes that project agent/history only after confirmation.
- Empty-state copy is provider-aware instead of always saying `Главный GPT`.
- 3.11.24 Settings close hotfix and 3.11.22 Team execution/z-layer fixes remain included.

Candidate artifact: `OSMINOG-Chrome-3.11.25-CHAT-TABS-RESTORE-ROOT.zip` · 56 files · 345011 bytes · SHA-256 `2257feee3e03f0d013b6133ca0745f67e1d8497bdaf40a82d1fa2cb2941c197b`.

Static checks: 21 JS syntax PASS, 8 JSON parse PASS, 0 real duplicate HTML IDs per document, ZIP integrity PASS. Owner runtime pending.
