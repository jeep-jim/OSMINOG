## 2026-08-29 — OSMINOG 3.11.21 UI CLEANUP · BRAND ICONS · CHAT POLISH

Owner runtime подтвердил загрузку 3.11.20 FIGMA PLANKTON & RAIL ALIGN. Последний визуальный feedback: shared top containers снова мешают; logo должен быть без подложки; Ocean dropdown menus сливаются с фоном; Layers active нужен blue + white icon; GPT chat/settings имеют белые/ломаные поверхности; provider/media icons должны использовать узнаваемые brand marks вместо emoji/инициалов, в частности Nano Banana.

Собран candidate 3.11.21 поверх 3.11.20:

- Ocean top-left / mode-switch / top-actions больше не имеют shared background containers; brand остаётся naked, каждый action/mode — отдельный glass bubble.
- Smart-select menus унифицированы для всех тем и получают плотный blurred Ocean surface; dynamic Ocean FX и GPT Settings selects используют тот же компонент.
- Layers active state = blue bubble + white icon.
- Ocean GPT chat очищен от white/sharp nested surfaces: context/attachment cards, menus, messages и composer приведены к единому deep-blue rounded glass.
- GPT Settings получили provider-logo picker для ChatGPT / DeepSeek / Google AI / Gemini / Claude / Custom и более единые settings cards.
- Provider Registry: Nano Banana emoji заменён локальной vector mark; media providers используют service-owned site icons/favicons с text fallback; Browser Hub переиспользует Registry imagery.
- Performance guardrails не ослаблены: no Ocean RAF loop, no collision timer, no self-triggering render observer.

Artifact: `OSMINOG-Chrome-3.11.21-UI-CLEANUP-BRAND-ICONS-CHAT-POLISH-ROOT.zip`  
Files: 56  
Size: 339311 bytes  
SHA-256: `eb1234c27e9cc9131778dae089735678fe9183687a7b77e92747eeef16b22540`  
Static: 21 JS syntax PASS · 9 JSON parse PASS · 0 real duplicate HTML IDs · ZIP integrity PASS.  
Owner runtime: pending.
