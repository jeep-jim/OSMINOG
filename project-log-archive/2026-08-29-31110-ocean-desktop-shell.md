## 2026-08-29 — OSMINOG 3.11.10 OCEAN DESKTOP SHELL

Owner confirmed 3.11.9 loads in real Chrome and requested the next structural Ocean pass rather than another isolated visual patch.

Implemented in candidate 3.11.10:
- Ocean one-time desktop defaults migrate to Day depth and `plain` / no-grid; users can re-enable dots/grid manually.
- Ocean canvas inspector no longer exposes board/grid color palettes because Ocean owns its scene palette; Space keeps classic canvas color controls.
- Top-centre shell is cleared. OSMINOG identity, language and Ocean variant control move into a compact upper-left bubble cluster.
- Layers becomes a separate upper-left bubble.
- Brief / Code / Browser / Design / Team move from the top bar to a right vertical bubble rail, keeping their existing neon/icon language.
- Active/hovered workspace mode exposes radial primary sub-tools around it, reusing existing tool/runtime actions instead of duplicating engines.
- Existing top-right Access / Chat AI / Export/system controls stay in place for this pass.
- Round close/minimize bubble controls begin replacing hard square/X presentation in Ocean.
- The one-time Kraken poem remains inside the Kraken Arc and is not part of Search.
- Space remains the classic alternate interface mode.

Candidate artifact: `OSMINOG-Chrome-3.11.10-OCEAN-DESKTOP-SHELL-ROOT.zip` · 55 files · 362800 bytes · SHA-256 `ea2b19e22010f8c7ea37b3f7e7c4e4462a22e7b894fd41927dff504c0926fa23`.

Static gate: 21 JS syntax PASS, 9 JSON parse PASS, 0 real duplicate HTML IDs, ZIP integrity PASS. Owner runtime pending.
