# OSMINOG Chrome 3.11.34 — SPACE FX PROTOCOL + CANVAS TASKS + LAYERS GAP

Base: 3.11.33.

## Исправлено

- Browser Presence больше не выдаёт старый `oceanFx` как активные настройки в Dark.
- В контексте появляются `activeFx: "space"` и канонический `spaceFx`: `stars`, `satellites`, `meteors`, `galaxies`, `density`, `glow`.
- Полный проектный контекст сохраняет оба профиля в `fxProfiles.space` и `fxProfiles.ocean`.
- Старые ключи `phenomena` и `luminescence` автоматически мигрируют в `galaxies` и `glow`.
- Внешний ИИ может создавать настоящие объекты `task` на холсте через `briefcraft.patch/v1`.
- У task-карточек доступны `title`, `text`, `status`, `agents`, `result`; они читаются в Project Map и открывают командный чат.
- Развёрнутая панель Layers теперь сохраняет тот же нижний отступ 14 px, что и свёрнутая; нижний блок папки больше не прилипает к краю окна.

## Сохранено

- Исправление видимости Space FX из 3.11.33.
- Исправление зависания MutationObserver из 3.11.32.
- Фиксированный Chrome extension key.

## Пакет

- `OSMINOG-Chrome-3.11.34-SPACE-FX-PROTOCOL-CANVAS-TASKS-LAYERS-GAP-ROOT.zip`
- Размер: `351987` байт
- SHA-256: `9bb9c77e1f8ef5a0c566d8e216c93bd3dc8cc95ce1411dff1b3b2184b873eb75`
