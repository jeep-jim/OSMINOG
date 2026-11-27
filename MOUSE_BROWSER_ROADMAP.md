# Mouse Browser — рабочая сводка

27.11.2026, KRAT (UTC+7). **6.0.41 PUBLIC VERIFIED на Mac, Linux и Windows.** **6.0.42 готовится к публикации** по подтверждённому поручению владельца, в порядке **Mac → Linux → Windows**. Сводка ≤8000 UTF-8 байт; доказательства — в документах задач, PR и pins.

## Проект и решения владельца

- Исходники: [OSMINOG](https://github.com/jeep-jim/OSMINOG); публикация: [OSMINOG-Releases](https://github.com/jeep-jim/OSMINOG-Releases). АвтоЦена — отдельный проект; её доступы/workflows не использовать.
- Фокус Антона: много окон/столов, локальное автосохранение, плавность и сохранение страниц. Плиточный поиск отменён в 636.
- **Agent Mouse удалён в 637:** чат агента, режим «Агенты», Local MCP, терминал и модельные подключения. Не возвращать по старым заданиям. Обычные сайты боковой ИИ-панели остаются.
- Сохранять профиль, App ID, Chromium partition, cookies, вкладки, столы, совместимость обновляторов. Опубликованные пакеты/адреса неизменяемы. Маскот, очки и Dock без новой просьбы не менять.
- Продукт: `desktop/mouse-main.cjs`, `desktop/mouse/`; preload/update/build рядом. Правила: [desktop/AGENTS.md](desktop/AGENTS.md).

## Текущая задача — 642

[PR222](https://github.com/jeep-jim/OSMINOG/pull/222): внутри сайта сохраняется вкладка; внешние ссылки создают новую. «−» в классическом виде возвращает сетку. Перед выпуском владелец добавил градусник с оттенками белого/чёрного, presets/ползунки и их копию в Настройках; RU — реальная раскладка и предложение исправить ошибочный ввод по согласию. Язык интерфейса — только Настройки, стрелка с отступом. Immutable642, обновление641→642, прежние профиль/каналы. [Требования и доказательства](docs/desktop/2026-11-27-mouse642-navigation-grid.md). До native/publisher/public gates642 не завершён.

## Опубликованный предшественник — 640

**640 PUBLIC VERIFIED на трёх платформах.** Настройки, source/publisher receipts и размеры/SHA256 — в [задаче 640](docs/desktop/2026-11-26-mouse640-settings-glass.md).

## Принятый source — 641

[PR218](https://github.com/jeep-jim/OSMINOG/pull/218) принят обычным merge `ceaef4d7`: проверенный head `3a32e02a`, одинаковое дерево `bf4b60b7`. Все 11 source workflows SUCCESS, включая [Mac](https://github.com/jeep-jim/OSMINOG/actions/runs/45830569948), [Linux + Noble](https://github.com/jeep-jim/OSMINOG/actions/runs/45830569937) и [Windows + modern](https://github.com/jeep-jim/OSMINOG/actions/runs/45830569936). Полные идентификаторы, границы и доказательства — в [задаче 641](docs/desktop/2026-11-26-mouse641-flexible-workspaces.md).

Publisher641: [Releases PR93](https://github.com/jeep-jim/OSMINOG-Releases/pull/93), полный offline-reader принят; frozen629/640 и source-пакеты сохранены.

**Публикация 641:** **Mac/Linux/Windows PUBLIC VERIFIED:** [Mac](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/45844915958), [Linux](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/45852450598), [Windows](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/45858493199). Fresh native, upgrades и полные публичные пакеты приняты.

Принятую source-ветку не двигать. Финальные документы — отдельная ветка от свежего main; сохранить последующую docs-only историю, включая `0a2347bd`.

## Сохранённые возможности и ограничения

- Графика638: целочисленные границы, правильные надписи/иконки новой вкладки. Прямоугольная сетка: разделитель 1 px без радиусов; обычная: промежутки 6 px, радиусы 12 px. Обе темы, resize/drag и множество живых страниц обязательны.
- Тон белого: нейтральный светлый текст тёмных страниц и интерфейса, сразу и после перезапуска; цветные элементы/светлые поверхности сохраняются.
- Chrome Web Store: страница расширения → меню расширений → «Установить в Mouse». CRX3/ID/подписи, нативное согласие, привязка к странице/столу и отмена при смене контекста. Не все Chrome API поддерживаются.
- Mac Apple Silicon: ad-hoc preview без Developer ID/notarization. Windows: unsigned preview. Linux: AppImage/deb, Ubuntu 24.04 gate; Mint владельца не проверен. Sandbox не отключать.
- [Графика/Store/приёмка 638](docs/desktop/2026-11-23-mouse638-rendering-webstore.md), [Linux 638](docs/desktop/2026-11-23-mouse638-linux-install.md). 638 была опубликована на всех платформах; размеры/SHA брать из точных pins, а не из памяти.

## Сайт и автообновление

[mouse.black](https://mouse.black/) — собственный webroot/HTTPS osminog, 72 языка. [Инфраструктура](docs/website/2026-11-22-mouse-black-launch.md). Каналы проверяются через 60 секунд после завершения проверки; платформы обновляются независимо, SHA256/Range обязательны.

Free/Cheese: Free 2 стола/4 окна, Cheese 5/12 за $3 — будущая модель. Сейчас все функции бесплатны; оплаты/ограничений нет.

26.11 [PR219](https://github.com/jeep-jim/OSMINOG/pull/219) опубликован: конкуренты удалены, оставлены5 столов/12 окон и пиксельный заголовок. [Публикация и live QA](docs/website/2026-11-26-own-workspace-demo.md). Счётчик UNAVAILABLE: нужен администратор Mouse vhost. [Процедура](docs/website/2026-11-25-download-metrics.md).

26.11 15:58:03 KRAT: [website gate 45787306736](https://github.com/jeep-jim/OSMINOG/actions/runs/45787306736) — 640 x3, direct HTTPS/full SHA256 PASS; 22:09 DNS недоступен.

27.11 00:44:55 KRAT, **сайт 6.0.41 PASS:** [45870017081/job140082692796](https://github.com/jeep-jim/OSMINOG/actions/runs/45870017081/job/140082692796), 72 языка, полные DMG/AppImage/EXE с size/SHA256, HEAD 200/Range 206, direct HTTPS без redirect. Ручная web-QA; mobile не проверен. 01:42: три feeds/release assets неизменны, прямой DNS из среды наблюдения недоступен. [Доказательства и хеши](docs/website/2026-11-22-mouse-black-launch.md).
