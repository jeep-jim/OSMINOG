# OSMINOG Chrome 3.11.39

## Purpose

Restore a stable single messenger after the 3.11.35–3.11.38 Team/Chat integration introduced a recursive UI feedback loop and duplicate hidden rendering.

## Confirmed code-level cause

- `osminog-team.js` observed every `body.class` change, then called `load()` and reopened the unified chat.
- `gpt-presence.js` independently observed the same class changes and recalculated the three-pane layout.
- Entering Team mode therefore caused repeated load/open/layout work.
- The hidden legacy Team transcript was still rebuilt for every message while the central messenger rendered the same message again.
- Agent tether geometry continued refreshing while the chat bubble alone was visible.

## Fix

- Team mode now reacts only to the explicit `osminog:mode-change` event.
- Team initialization is lazy, cached and idempotent.
- Reopening Team mode cannot recursively click Team mode again.
- Hidden legacy transcript rendering is skipped.
- Storage writes are coalesced.
- Window resize layout is animation-frame debounced.
- Agent tether redraw runs only while the messenger panel is open.
- Visible layout remains: Team chats left, active conversation center, settings right.
- Ocean topbar controls use the same background/transparency treatment as Layers.

## Checks

- JavaScript syntax: PASS
- JSON parse: PASS
- DOM layout smoke: PASS
- 1600×1000 Team columns: 260 / 551 px
- 1600×1000 Team + Settings columns: 260 / 544 / 360 px
- 30 consecutive Brief/Team mode switches: no page errors or layout collapse

Owner Chrome runtime confirmation is still pending.
