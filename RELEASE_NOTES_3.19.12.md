# OSMINOG 3.19.12 — Seamless Shared Vision

- one same-revision `osminog.vision_context/v1` path is used by connected provider turns;
- external ChatGPT manual canvas requests are preflighted against the live OSMINOG editor before the turn is sent;
- `смотри на холст` / `что видишь` can attach the current viewport, selection, tethered object or full overview automatically;
- machine context and tool-result hops stay hidden from the visible conversation;
- previously-authorized external ChatGPT Presence silently reconnects to an existing tab after reload and never creates a new consumer ChatGPT tab;
- 3.19.10 title lift and all 3.19.11 UI fixes remain preserved.

Runtime owner proof is still required in Chrome after updating: type `смотри на холст` in the attached external ChatGPT tab and verify that the answer uses the live canvas without a manual screenshot upload.
