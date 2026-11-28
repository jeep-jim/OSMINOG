# Mouse — рабочая сводка

28.11.2026, KRAT (UTC+7). **Mac 6.0.44 опубликован; publisher и публичная загрузка подтверждены.** Windows/Linux — 6.0.42; до новой команды владельца не разрабатывать, не собирать, не публиковать. Сводка ≤8000 UTF-8 байт; подробности читать только по текущей задаче.

## Постоянные решения

- Исходники: [OSMINOG](https://github.com/jeep-jim/OSMINOG), канал: [OSMINOG-Releases](https://github.com/jeep-jim/OSMINOG-Releases). АвтоЦена и её доступы/workflows изолированы.
- Продукт — **Mouse**; под иконкой только это имя. Приоритет: несколько окон/столов, локальное сохранение, плавность и сохранение живых страниц.
- Tile Search отменён в 636, Agent Mouse удалён в 637, включая Local MCP/терминал/модельные подключения. Wallet/Web3 удалены; старые данные сохраняются. Обычные сайты ИИ-панели остаются. Старые ТЗ не возвращают удалённые функции.
- Сохранять профиль, App ID, Chromium partition, cookies, вкладки, столы и совместимость обновления. Старые пакеты/адреса, frozen 629/640 и принятые ветки не переписывать. Маскот, очки и Dock без новой просьбы не менять.
- Код: `desktop/mouse-main.cjs`, `desktop/mouse/`, preload/update/build рядом. [Правила desktop](desktop/AGENTS.md). Рабочие инструкции сокращены; [полная история](docs/context/2026-11-28-root-instructions-history.md) архивирована и читается только по необходимости.

## Mac 6.0.44: опубликован и проверен

[Задание, точные пакеты и доказательства](docs/desktop/2026-11-28-mouse644-filter-updates-page-themes.md). [PR 226](https://github.com/jeep-jim/OSMINOG/pull/226) объединён:

- Source `ad9b8c217da8917f95a2d672e62790f474daef4b`; merge `161f2ebda378c48c1ae714c671c2d91830c4558f`.
- [Mac CI 46106499427](https://github.com/jeep-jim/OSMINOG/actions/runs/46106499427), attempt 1, job `140860337521` — SUCCESS. DMG/ZIP получены из этой попытки; размеры/SHA256 закреплены в записи задачи.
- Native: установленное и обновлённое имя **Mouse**, 56 локалей; темы/подписки/private/restart, performance, реальное 643→644 и сохранение профиля приняты. Это проверки установленного приложения на CI Mac, не устройства владельца.
- Cloud Mouse: 1819 случаев — 1802 PASS / 17 SKIP / 0 FAIL. Базовый `npm test`: 182/182 PASS отдельно; счётчики не складывать.

Темы: `prefers-color-scheme` и включённый по умолчанию `syncWebsiteTheme`. GitHub Primer; общие корневые атрибуты/классы — только при подтверждённой CSS-поддержке светлой и тёмной темы. Выключение возвращает оформление сайта. Нестандартные JS-переключатели и произвольные сайты не объявлены поддержанными; аккаунт/cookies/storage не переписываются.

Фильтры: подписки в настройках, проверка каждые 12 часов, ETag/304, локальная рабочая копия и полные резервные EasyList/RU AdList, до 8 собственных HTTPS-списков. Matcher только разрешает/отменяет запросы; не меняет ответы, медиапотоки или DRM/Premium.

Нативная проверка FileManager/Bundle подтверждает имя **Mouse**; в Mac-меню/About также задано Mouse. Физические `Mouse Browser.app`, executable, App ID и профиль `Trader OS` сохранены для updater 643. Mac — ad-hoc preview без Developer ID/notarization; защиту ОС не отключать.

[Publisher PR 106](https://github.com/jeep-jim/OSMINOG-Releases/pull/106), merge `1e85e195bcee576ce15f86f4e5a1289e4209e190`; [неизменяемый pin](https://github.com/jeep-jim/OSMINOG-Releases/blob/1e85e195bcee576ce15f86f4e5a1289e4209e190/staging/mouse/6.0.44-arm64/pin.json). [Run 46108907151](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/46108907151), attempt 1, native job `140868484487` — **SUCCESS**, завершён 28.11 в 12:14:39 KRAT. [Fresh native/643/629 upgrade](docs/desktop/evidence/mouse644-publisher-acceptance.json) приняты; DMG/ZIP импортированы без пересборки.

[Release 644](https://github.com/jeep-jim/OSMINOG-Releases/releases/tag/quadro-macos-v6.0.44-arm64), ID `461318997`, опубликован в 12:14:08 KRAT; Mac-канал продвинут после проверки assets. [Public receipt](docs/desktop/evidence/mouse644-public-macos.json): **PASS, 28.11.2026 12:17:27 KRAT**. Его SHA256 и точные artifacts — в записи задачи.

## История по необходимости

[Mac 643: приёмка и публикация](docs/desktop/2026-11-27-mouse643-mac-polish.md#завершённая-публикация); [642: три платформы и pins](docs/desktop/2026-11-27-mouse642-navigation-grid.md). Историю попыток 644 смотреть в PR/CI; старые журналы в рабочий контекст не загружать.

## Автоматический сайт

[mouse.black](https://mouse.black/) — собственный webroot/HTTPS под osminog, 72 языка. [Инфраструктура](docs/website/2026-11-22-mouse-black-launch.md). Официальные каналы проверяются через 60 секунд после окончания предыдущей проверки; платформы обновляются независимо. Проверяются release asset/SHA256, запрещены откат и замена неизменяемых файлов; каталог обновляется перед скачиванием. Источник — официально принятые пакеты.

Public 644 подтвердил feed/каталог, страницы `/`, `/en/`, `/ru/`, полный DMG size/SHA256, HEAD 200/Range 206. Windows/Linux 642 в каталоге не изменились. Проверка относится к опубликованным байтам и CI, не к устройству владельца. Контроль 28.11 12:25: три feeds совпали с receipt 644, release asset сверён; прямой повторный GET недоступен (DNS), redirect отдельно не подтверждён. Подробности в журнале сайта.

Оплаты/лимиты пока не включены. Монетизация — отдельная задача по последнему решению владельца; старые тарифные ТЗ не считать текущими.
