# Mouse Browser — рабочая сводка

23.11.2026. **6.0.38, source принят.** Публикация: **Mac → Linux → Windows**. Обновлять эту сводку, не накапливать историю; доказательства — в документах задач и Git.

## Проект и решения владельца

- Исходники: [OSMINOG](https://github.com/jeep-jim/OSMINOG); публикация: [OSMINOG-Releases](https://github.com/jeep-jim/OSMINOG-Releases). АвтоЦена — отдельный проект; её доступы/workflows не использовать.
- Фокус Антона: много окон/столов, локальное автосохранение, плавность и сохранение страниц. Плиточный поиск отменён в 636.
- **Agent Mouse удалён в 637:** чат агента, режим «Агенты», Local MCP, терминал и модельные подключения. Не возвращать по старым заданиям. Обычные сайты боковой ИИ-панели остаются.
- Сохранять профиль, App ID, Chromium partition, cookies, вкладки, столы и совместимость обновляторов. Не перезаписывать опубликованные пакеты/адреса. Маскот, очки и Dock без новой просьбы не менять.
- Продукт: `desktop/mouse-main.cjs`, `desktop/mouse/`; preload/update/build рядом. Правила: [desktop/AGENTS.md](desktop/AGENTS.md).

## Что входит в 638

- **Графика:** целочисленные границы; исправлены надписи/иконки новой вкладки и разрывы фона. Прямоугольная сетка: разделитель 1 px, без радиусов; обычный режим: промежутки 6 px, скругления 12 px. Обе темы, resize/drag, плавность множества страниц обязательны.
- **Тон белого:** интерфейс и нейтральный светлый текст тёмных веб-страниц; цветные элементы и светлые поверхности сохраняются. Применение сразу и после перезапуска, без потери состояния страниц.
- **Chrome Web Store:** страница расширения → меню расширений → «Установить в Mouse». CRX3/ID/подписи, нативное согласие, привязка к текущей странице/столу и отмена незавершённой установки при смене контекста. Проверены работа, перезапуск, переключение и удаление. Не все Chrome API поддерживаются.
- **Mac:** восстановлен native export `paneCorners`, сборка проверяет экспорты.
- **Linux:** `.deb` существовал; добавлены `libgbm1`, `libasound2t64 | libasound2` и чистая приёмка Ubuntu 24.04. На снимках владельца — Mint 22.3/X11 и выбор программы для AppImage; причина сбоя не доказана. Sandbox и политику user namespaces не отключать.

Документы: [графика/Store/приёмка](docs/desktop/2026-11-23-mouse638-rendering-webstore.md), [установка Linux](docs/desktop/2026-11-23-mouse638-linux-install.md).

## Принятый source и границы Git

- Source: `b9d243dd7507da3c5b5397c62391315c09794db8`.
- [PR #203](https://github.com/jeep-jim/OSMINOG/pull/203) merged: `4d3953456f09448c5b2c2bd463496f27fe6c8a9e`; дерево совпадает с принятым source.
- Source native + независимая приёмка **PASS**: Mac, Linux/Ubuntu 24.04, Windows main/modern; пиксели/ввод, Store/подписи, профиль и обновление **637 → 638**. Устройство владельца этим не проверено.
- **Не двигать `fix/mouse638-ordered-release` после merge:** publisher проверяет исходный head PR203. Любая новая работа и документация — в новой ветке от `main`; принятые source/pins не переписывать.
- Native проверки и независимые читатели не ослаблять. Source PASS и merge сами по себе не означают публикацию.

## Публикация — срез 23.11.2026, 15:43 UTC

- **Mac PUBLIC PASS:** [run 45193897169](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/45193897169), [release](https://github.com/jeep-jim/OSMINOG-Releases/releases/tag/quadro-macos-v6.0.38-arm64), [точный pin](https://github.com/jeep-jim/OSMINOG-Releases/blob/41a67ead28dda6bdff7c19b8ae4946f9fad91c59/staging/mouse/6.0.38-arm64/pin.json). Все 5 assets проверены по байтам; обновляторы 637/629 — PASS.
- **Linux PUBLIC PASS:** [run 45202332513, attempt 2](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/45202332513/attempts/2), [release](https://github.com/jeep-jim/OSMINOG-Releases/releases/tag/mouse-linux-v6.0.38-x64), [точный pin](https://github.com/jeep-jim/OSMINOG-Releases/blob/f50204b9c4533ea3bb8623c80919acb9a7b4ed46/staging/mouse/6.0.38-linux-x64/pin.json). Все 5 assets, оба feed и настоящий updater637 для AppImage/deb — PASS.
- **Windows PUBLIC PENDING:** [run 45208368038](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/45208368038), [точный pin](https://github.com/jeep-jim/OSMINOG-Releases/blob/c33b7b5cd53edcb54c35a450dd83d0d19d2d965d/staging/mouse/6.0.38-windows-x64/pin.json). PR76 объединён; финальный native publisher запущен, публичный PASS ещё не подтверждён.

Размеры/SHA256 пакетов брать из pins. Далее: завершить Windows native/public/feed/updater проверки, сверить сайт и записать фактический итог. Mac — Apple Silicon, ad-hoc preview без Developer ID/notarization; Windows — unsigned preview.

## Сайт и автообновление

[mouse.black](https://mouse.black/) — отдельный webroot/HTTPS под osminog; bootstrap завершён. Mac638: полная публичная загрузка/SHA256 PASS в 15:13:33 UTC. Таймер переносит проверенные официальные загрузки по платформам, проверяя каналы через 60 секунд после предыдущего запуска. Выпуск браузера не требует повторного bootstrap, доступа к АвтоЦене или root. Сохранять параллельные изменения сайта. [Инфраструктура](docs/website/2026-11-22-mouse-black-launch.md) — только для задач сайта.

Лендинг: сплит, 72 языка, $3/месяц; подписка «скоро», checkout/права не внедрены. Автосбор — новый буфер/снимки выбранной папки при открытом Mouse, не страницы из кеша. [Тариф](docs/website/2026-11-23-one-fair-plan.md).

Автообновление: проверять реальные публичные байты по размеру/SHA256 и feed; сохранять профиль и совместимость обновляторов.
