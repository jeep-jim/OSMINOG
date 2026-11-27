# Mouse Browser — рабочая сводка

27.11.2026, KRAT (UTC+7). **6.0.43 PUBLIC VERIFIED — Mac Apple Silicon.** Windows/Linux остаются 6.0.42; не разрабатывать, не собирать и не публиковать до новой команды владельца. [Приёмка643](docs/desktop/2026-11-27-mouse643-mac-polish.md#завершённая-публикация); [история642](docs/desktop/2026-11-27-mouse642-navigation-grid.md). Сводка ≤8000 UTF-8 байт.

## Проект и решения владельца

- Исходники: [OSMINOG](https://github.com/jeep-jim/OSMINOG); публикация: [OSMINOG-Releases](https://github.com/jeep-jim/OSMINOG-Releases). АвтоЦена — отдельный проект; её доступы/workflows не использовать.
- Фокус Антона: много окон/столов, локальное автосохранение, плавность и сохранение страниц. Плиточный поиск отменён в 636.
- **Agent Mouse удалён в 637:** чат агента, режим «Агенты», Local MCP, терминал и модельные подключения. Не возвращать по старым заданиям. Обычные сайты боковой ИИ-панели остаются.
- Сохранять профиль, App ID, Chromium partition, cookies, вкладки, столы, совместимость обновляторов. Опубликованные пакеты/адреса неизменяемы. Маскот, очки и Dock без новой просьбы не менять.
- Продукт: `desktop/mouse-main.cjs`, `desktop/mouse/`; preload/update/build рядом. Правила: [desktop/AGENTS.md](desktop/AGENTS.md).

## Опубликовано — 643 (Mac)

[PR224](https://github.com/jeep-jim/OSMINOG/pull/224), source `926ad99ffa36`: поиск, адресный список, геометрия вкладок и реальная тема страниц. [Source/publisher/public receipts, merge и DMG/ZIP SHA256](docs/desktop/2026-11-27-mouse643-mac-polish.md#завершённая-публикация).

## Опубликовано — 642

[PR222](https://github.com/jeep-jim/OSMINOG/pull/222), source `ac51d80d4190bce54d8cc5f7017359dcb8fa838c`, merge `fb8b3d61c53b5f15c450b418cadb0db1cb675cdf`. Внутри сайта сохраняются вкладка/WebContents; внешние ссылки создают новую вкладку. «−» в классическом виде возвращает сохранённую сетку. Градусник и Настройки синхронно меняют оттенки белого/чёрного; RU/EN — действительная раскладка, исправление ошибочного ввода требует согласия. Язык интерфейса — только Настройки. Обновление641→642 и legacy629, профиль и каналы сохранены.

Mac/Linux приняты на attempt1, Windows — на attempt2 того же source после `ERR_NO_BUFFER_SPACE` в modern attempt1. Код и критерии между попытками Windows не менялись; первая попытка не используется для публикации. [История, native/publisher/public gates и точные pins](docs/desktop/2026-11-27-mouse642-navigation-grid.md).

## История 640/641

**640 и 641 PUBLIC VERIFIED на трёх платформах.** [Задача640](docs/desktop/2026-11-26-mouse640-settings-glass.md) и [задача641](docs/desktop/2026-11-26-mouse641-flexible-workspaces.md) сохраняют source/publisher runs, receipts, размеры и SHA256.

641: [PR218](https://github.com/jeep-jim/OSMINOG/pull/218), merge `ceaef4d7`, проверенный head `3a32e02a`, дерево `bf4b60b7`; все11 source workflows SUCCESS. Publisher: [Releases PR93](https://github.com/jeep-jim/OSMINOG-Releases/pull/93). Frozen629/640 и опубликованные source-пакеты неизменны.

Принятые source-ветки не двигать. Финальные документы642 — отдельная ветка от свежего main; сохранить последующую docs-only историю, включая `0a2347bd`.

## Сохранённые возможности и ограничения

- Графика638: целочисленные границы, правильные надписи/иконки новой вкладки. Прямоугольная сетка: разделитель 1 px без радиусов; обычная: промежутки 6 px, радиусы 12 px. Обе темы, resize/drag и множество живых страниц обязательны.
- Тон белого: нейтральный светлый текст тёмных страниц и интерфейса, сразу и после перезапуска; цветные элементы/светлые поверхности сохраняются.
- Chrome Web Store: страница расширения → меню расширений → «Установить в Mouse». CRX3/ID/подписи, нативное согласие, привязка к странице/столу и отмена при смене контекста. Не все Chrome API поддерживаются.
- Mac Apple Silicon: ad-hoc preview без Developer ID/notarization. Windows: unsigned preview. Linux: AppImage/deb, Ubuntu24.04; раскладки — X11, Wayland показывает недоступность. Mint владельца не проверен. Sandbox не отключать.
- [Графика/Store/приёмка 638](docs/desktop/2026-11-23-mouse638-rendering-webstore.md), [Linux 638](docs/desktop/2026-11-23-mouse638-linux-install.md). 638 была опубликована на всех платформах; размеры/SHA брать из точных pins, а не из памяти.

## Сайт и автообновление

[mouse.black](https://mouse.black/) — собственный webroot/HTTPS osminog, 72 языка. [Инфраструктура](docs/website/2026-11-22-mouse-black-launch.md). Каналы проверяются через 60 секунд после завершения проверки; платформы обновляются независимо, SHA256/Range обязательны. Итог642: каталог и EN/RU-ссылки, полные DMG/AppImage/EXE, HEAD200/Range206 и direct HTTPS подтверждены в [публичных receipts](docs/desktop/2026-11-27-mouse642-navigation-grid.md#завершённая-публикация).

Free/Cheese: Free 2 стола/4 окна, Cheese 5/12 за $3 — будущая модель. Сейчас все функции бесплатны; оплаты/ограничений нет.

26.11 [PR219](https://github.com/jeep-jim/OSMINOG/pull/219) опубликован: конкуренты удалены, оставлены5 столов/12 окон и пиксельный заголовок. [Публикация и live QA](docs/website/2026-11-26-own-workspace-demo.md). Счётчик UNAVAILABLE: нужен администратор Mouse vhost. [Процедура](docs/website/2026-11-25-download-metrics.md).

27.11 17:55:23 KRAT: сайт 6.0.42 PASS x3; сверка 18:48 — feeds=receipts, DNS среды недоступен. [Журнал](docs/website/2026-11-22-mouse-black-launch.md).
