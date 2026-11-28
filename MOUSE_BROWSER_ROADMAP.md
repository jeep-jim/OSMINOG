# Mouse — рабочая сводка

28.11.2026, KRAT (UTC+7). **Готовится Mac 6.0.45: Mouse ID, Flash и перенос настроек.** [PR 228](https://github.com/jeep-jim/OSMINOG/pull/228), ветка `mouse/645-flash-identity`. Публично Mac 6.0.44 / Windows и Linux 6.0.42. Публичный канал 45 ещё не изменён. Сводка ≤8000 UTF-8 байт.

## Постоянные решения

- Код: `jeep-jim/OSMINOG`, выпуски: `jeep-jim/OSMINOG-Releases`. Только Mac Apple Silicon до проверки владельцем двух Mac; Windows/Linux не разрабатывать, не собирать и не публиковать без команды.
- Имя установленного приложения — **Mouse**. Сохранять App ID, исходный профиль `Trader OS`, update paths и прежние пакеты. Маскот, очки и Dock без просьбы не менять.
- Tile Search, Agent Mouse/Local MCP/терминал/модельные подключения и Wallet/Web3 удалены. Старые ТЗ их не возвращают; сайты ИИ-панели остаются.
- [Desktop-правила](desktop/AGENTS.md). Большие прежние журналы целиком не загружать. История — в Git; [архив корневых правил](docs/context/2026-11-28-root-instructions-history.md).

## Пять опор владельца

1. Сетка до 12 окон плюс отдельное AI-окно — бесплатно.
2. Пять рабочих столов бесплатно, 18 в платном тарифе.
3. Автосохранение скриншотов и текста — бесплатно.
4. Пользовательское управление сетевыми фильтрами — бесплатно.
5. Flash: приватная разовая прямая передача; бесплатно до 100 GB, платно без продуктового предела.

В 45 лимит **100000000000 B на одну передачу**. Повторные чанки/resume не удваивают размер manifest. Оплата/entitlements и 18 столов пока не реализованы; клиент сам себе платный тариф не назначает. Capture opt-in/default off, пауза private/lock. Сайт/цены сейчас не переписывать.

## Текущий релиз 45

[Код, сервер, ограничения и проверка](docs/desktop/2026-11-28-mouse645-identity-sync-flash.md). Старый прототип/PR 227 — только [историческое доказательство](docs/desktop/2026-11-28-mouse-flash-architecture.md).

Mouse ID необязателен для обычного браузера. Пароль + код восстановления; ID 1 зарезервирован владельцу, ещё не зарегистрирован. Сервер подписывает привязку account/device/name/avatar; клиент доверяет закреплённому issuer. Tokens защищены OS storage. Touch ID использует защищённый Keychain, но в текущей ad-hoc сборке недоступен без entitlement; не имитировать биометрию обычным диалогом.

Переносится только лёгкая схема: столы, сетки, обычные URL вкладок, закладки, тема/оформление и разрешённые настройки. Не переносить файлы, снимки, захваченный текст, downloads/history, cookies и пароли сайтов. Отдельные Chromium/profile каталоги аккаунтов, перед открытием окна проверка credentials. Каждый logout выбирает нового чистого гостя; старые локальные данные сохраняются отдельно. Offline edits и конкурентные изменения сливаются; при обычной работе remote state применяется после явного применения/перезапуска, не закрывая живую форму. Опрос revision каждые 30 s, полный state только при изменении, максимум 2 MiB.

Flash — молния у существующих боковых панелей; sandboxed native view. Согласие на устройстве получателя, STUN/direct RTC, encrypted invitation/signaling, bounded chunks, checkpoint/resume и persisted completion receipt. Файлы через сервер не идут. Закрытый NAT может не соединиться без TURN. Приём требует hard links: exFAT отклоняется до передачи; рекомендовать внутренний диск для первого теста.

Постоянная кнопка версии снизу убрана; появляется при доступном обновлении/его загрузке. Версия и проверка обновления остаются внизу настроек. Локализованное имя **Mouse**, внутренние bundle/executable/update identifiers совместимы с 44.

## Доказательства и блокер

- Source `3168cab700e7cdfa5aa93c202b3e4a641f414f0a`: [Mac native 46128119054](https://github.com/jeep-jim/OSMINOG/actions/runs/46128119054) SUCCESS — компиляция native modules, RTC interruption/resume и signed profile UI. Это ещё не установленный финальный DMG 45.
- Серверы source `e274e20419962ce108f59ba0b3638b0635b43fd9`: [deploy 46127013296](https://github.com/jeep-jim/OSMINOG/actions/runs/46127013296) SUCCESS. Отдельный osminog, `/opt/osminog/mouse-services`, systemd user limits: identity 256 MiB/25%, broker 128 MiB/15%, STUN 96 MiB/10%. Приватные ключи/SQLite вне Git, сайт отвечает.
- HTTPS `/v1/accounts/` и `/v1/rooms` ещё не подключены: Mouse vhost root-owned, osminog не может его менять. Скрипт одной административной операции подготовлен; автоматический deploy его не запускает. АвтоЦена/её ключи/root-исключения не использовать.
- Full installed-app gate и последовательные реальные перезапуски A/B/guest/second-device сейчас проходят CI. Физические два Mac, WAN/TB и реальные Touch ID не подтверждены. Публикацию не объявлять до проверки артефактов и public readiness.

## Принятый Mac 44 и сайт

[Релиз 6.0.44](https://github.com/jeep-jim/OSMINOG-Releases/releases/tag/quadro-macos-v6.0.44-arm64), [публичный receipt](docs/desktop/evidence/mouse644-public-macos.json), [задача](docs/desktop/2026-11-28-mouse644-filter-updates-page-themes.md). Ad-hoc без Developer ID/notarization; защиту ОС/sandbox не отключать. Имя Mouse в 56 локалях.

[mouse.black](https://mouse.black/) обновляет каталоги/пакеты платформ независимо, проверяет asset/SHA256 и immutable update paths. [Инфраструктура сайта](docs/website/2026-11-22-mouse-black-launch.md). Каналы Windows/Linux 642 сохраняются.
