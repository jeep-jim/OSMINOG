# Mouse Browser — рабочая сводка

25.11.2026. **6.0.38 опубликована.** Порядок выпуска: **Mac → Linux → Windows**. Обновлять эту сводку, не накапливать историю; доказательства — в документах задач и Git.

## Проект и решения владельца

- Исходники: [OSMINOG](https://github.com/jeep-jim/OSMINOG); публикация: [OSMINOG-Releases](https://github.com/jeep-jim/OSMINOG-Releases). АвтоЦена — отдельный проект; её доступы/workflows не использовать.
- Фокус Антона: много окон/столов, локальное автосохранение, плавность и сохранение страниц. Плиточный поиск отменён в 636.
- **Agent Mouse удалён в 637:** чат агента, режим «Агенты», Local MCP, терминал и модельные подключения. Не возвращать по старым заданиям. Обычные сайты боковой ИИ-панели остаются.
- Сохранять профиль, App ID, Chromium partition, cookies, вкладки, столы и совместимость обновляторов. Не перезаписывать опубликованные пакеты/адреса. Маскот, очки и Dock без новой просьбы не менять.
- Продукт: `desktop/mouse-main.cjs`, `desktop/mouse/`; preload/update/build рядом. Правила: [desktop/AGENTS.md](desktop/AGENTS.md).

## В работе — 639

AdBlock: off по умолчанию, EasyList/RU AdList локально, все сессии и инкогнито. [PR215](https://github.com/jeep-jim/OSMINOG/pull/215): CI; не опубликован. [Задача](docs/desktop/2026-11-25-mouse639-adblock.md).

## Что входит в 638

- **Графика:** целочисленные границы; исправлены надписи/иконки новой вкладки и разрывы фона. Прямоугольная сетка: разделитель 1 px, без радиусов; обычный режим: промежутки 6 px, скругления 12 px. Обе темы, resize/drag, плавность множества страниц обязательны.
- **Тон белого:** интерфейс и нейтральный светлый текст тёмных веб-страниц; цветные элементы и светлые поверхности сохраняются. Применение сразу и после перезапуска, без потери состояния страниц.
- **Chrome Web Store:** страница расширения → меню расширений → «Установить в Mouse». CRX3/ID/подписи, нативное согласие, привязка к текущей странице/столу и отмена незавершённой установки при смене контекста. Проверены работа, перезапуск, переключение и удаление. Не все Chrome API поддерживаются.
- **Mac:** восстановлен native export `paneCorners`, сборка проверяет экспорты.
- **Linux:** зависимости deb и Ubuntu 24.04 проверены. Mint владельца не проверен; sandbox/user namespaces не отключать.

Документы: [графика/Store/приёмка](docs/desktop/2026-11-23-mouse638-rendering-webstore.md), [установка Linux](docs/desktop/2026-11-23-mouse638-linux-install.md).

## Принятый source и границы Git

- Source: `b9d243dd7507da3c5b5397c62391315c09794db8`.
- [PR #203](https://github.com/jeep-jim/OSMINOG/pull/203) merged: `4d3953456f09448c5b2c2bd463496f27fe6c8a9e`; дерево совпадает с принятым source.
- Source native + независимая приёмка **PASS**: Mac, Linux/Ubuntu 24.04, Windows main/modern; пиксели/ввод, Store/подписи, профиль и обновление **637 → 638**. Устройство владельца этим не проверено.
- **Не двигать `fix/mouse638-ordered-release` после merge:** publisher проверяет исходный head PR203. Любая новая работа и документация — в новой ветке от `main`; принятые source/pins не переписывать.
- Native проверки и независимые читатели не ослаблять. Source PASS и merge сами по себе не означают публикацию.

## Выпуск 638 — PUBLIC PASS, 23.11.2026

- **Mac PUBLIC PASS:** [run 45193897169](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/45193897169), [release](https://github.com/jeep-jim/OSMINOG-Releases/releases/tag/quadro-macos-v6.0.38-arm64), [точный pin](https://github.com/jeep-jim/OSMINOG-Releases/blob/41a67ead28dda6bdff7c19b8ae4946f9fad91c59/staging/mouse/6.0.38-arm64/pin.json). Все 5 assets проверены по байтам; обновляторы 637/629 — PASS.
- **Linux PUBLIC PASS:** [run 45202332513, attempt 2](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/45202332513/attempts/2), [release](https://github.com/jeep-jim/OSMINOG-Releases/releases/tag/mouse-linux-v6.0.38-x64), [точный pin](https://github.com/jeep-jim/OSMINOG-Releases/blob/f50204b9c4533ea3bb8623c80919acb9a7b4ed46/staging/mouse/6.0.38-linux-x64/pin.json). Все 5 assets, оба feed и настоящий updater637 для AppImage/deb — PASS.
- **Windows PUBLIC PASS:** [run 45208368038](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/45208368038), [release](https://github.com/jeep-jim/OSMINOG-Releases/releases/tag/mouse-windows-v6.0.38-x64), [точный pin](https://github.com/jeep-jim/OSMINOG-Releases/blob/c33b7b5cd53edcb54c35a450dd83d0d19d2d965d/staging/mouse/6.0.38-windows-x64/pin.json). Все 4 assets, оба feed и обновляторы 629/637 — PASS.

Размеры/SHA256 пакетов брать из pins. Далее: разбирать конкретные отзывы владельца об установке и работе этих пакетов. Mac — Apple Silicon, ad-hoc preview без Developer ID/notarization; Windows — unsigned preview.

## Сайт и автообновление

[mouse.black](https://mouse.black/) — свой webroot/HTTPS под osminog, 72 языка. [Инфраструктура](docs/website/2026-11-22-mouse-black-launch.md). Каналы проверяются через 60 секунд после завершения проверки; платформы обновляются независимо, SHA256/Range обязательны.

Free/Cheese: Free 2 стола/4 окна; Cheese 5/12 за $3. Подписка и 7-дневный trial — будущая модель; сейчас все функции бесплатны, оплаты/ограничений нет.

25.11: PR213 опубликован: 10 браузеров + Mouse, цветные лого, режимы и 5 независимых столов. 72 языка, прежние ширины; 71 Python/25 Node, public run 45578500314 — PASS. [Задача](docs/website/2026-11-25-browser-comparison.md). Счётчик UNAVAILABLE: нужен администратор Mouse vhost. [Процедура](docs/website/2026-11-25-download-metrics.md).

Сохранять свежие загрузки, параллельные изменения сайта, профиль и совместимость обновляторов.
