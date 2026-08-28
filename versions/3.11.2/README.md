# OSMINOG Chrome 3.11.2 — PROVIDER / SESSION LAYER

Base: **3.11.1 SEARCH LAYER**.

This build keeps the Ocean Shell and existing OSMINOG engine, fixes the rejected 3.11.1 bottom-search emergence geometry, and begins the planned unified Provider / Session layer.

## Owner runtime feedback carried into this build

3.11.1 loaded successfully and the Search Layer was visible, but the owner explicitly rejected its opening geometry: it looked like a large panel/dome moving upward instead of being pushed out of the persistent bottom strip like the original 2011 Yokkey/OSMINOG concept.

3.11.2 replaces that geometry rather than defending it.

## Search emergence redesign

- Keeps a persistent Ocean bottom strip.
- The octopus eye stays in that strip while search opens.
- Search starts compressed in the center slot and expands upward from the strip.
- The surface has deeper rounded lower shoulders and a central rounded stem/connection to the strip.
- The useful 3.11.1 live search/index behavior is preserved.
- Ocean remains primary; Dark and Light keep the same interaction grammar.

## Provider / Session foundation

- Adds `osminog-session-manager.js` as the single session entry point for AI/provider consumers.
- One provider maps to one reusable internal Browser Hub/service session by default.
- Session identity is persisted and stale tabs are cleaned from the map.
- Provider Registry launch actions prefer the shared Session Manager.
- Chat settings get an icon-based AI brain picker and access to the existing full Provider Registry.
- Agent brain options now include ChatGPT, DeepSeek, Google AI, Gemini, Claude and Custom.
- Header connection status is reduced to unified `On` / `Off` semantics with a status dot instead of duplicated labels such as `GPT LIVE`.
- Unconnected AI chat exposes a visible `Подключить` action without requiring the user to discover it inside settings.
- AI settings occupy the chat workspace as a full settings surface rather than dropping awkwardly below the chat.
- Visible `Jarvis` naming is changed to **Poseidon** while legacy internal keys/aliases are preserved for compatibility.

## Google AI correctness work

- Google AI can be selected as an agent brain through the existing Google service transport.
- Existing request/freshness/dedupe logic is preserved.
- Multimodal upload now requires visible attachment evidence before sending.
- If OSMINOG cannot confirm that Google actually accepted the image, the request fails explicitly instead of silently sending text without the screenshot.
- DeepSeek direct authenticated transport is intentionally not rewritten.

## Candidate artifact

`OSMINOG-Chrome-3.11.2-PROVIDER-SESSION-LAYER-ROOT.zip`

- Files: **55**
- Size: **335371 bytes**
- SHA-256: `0efec9227915c14178064e17527a0755fc5e42c147871f80ae27b2a0cc1ce1bd`
- Root `manifest.json`: yes
- Manifest version: **3.11.2**
- Fixed manifest key: preserved

## Static verification

- 21 JavaScript files pass `node --check`;
- 8 JSON files parse;
- real HTML duplicate IDs: 0;
- ZIP integrity: PASS.

## Runtime status

**Not runtime-proven yet.** The owner must install this candidate over 3.11.1 and verify the bottom emergence, shared provider sessions, `On/Off` connection UI and Google multimodal behavior before any of those paths are marked proven.

## Next planned product pass

After blocking 3.11.2 regressions are fixed, continue with **3.11.3 OCTOPUS WORK STATES**: remove idle agent pills from the canvas, show working octopuses only during active tasks or explicit node pinning, add role/task animation states, tethers and connection z-order behavior.