# Mouse — рабочая сводка

28.11.2026, KRAT (UTC+7). **Mac-прототип: Flash RTC и profile UI PASS.** Публично Mac 6.0.44 / Windows, Linux 6.0.42; main/version/release прежние. Windows/Linux не разрабатывать/собирать/публиковать без команды. Сводка ≤8000 UTF-8 байт.

## Постоянные решения

- Исходники: [OSMINOG](https://github.com/jeep-jim/OSMINOG), канал: [OSMINOG-Releases](https://github.com/jeep-jim/OSMINOG-Releases). АвтоЦена и её доступы/workflows изолированы.
- Имя — **Mouse**. Сохранять профиль, App ID, partitions/cookies, вкладки/столы, update paths и прежние пакеты; frozen 629/640 не переписывать. Маскот, очки и Dock без просьбы не менять.
- Tile Search, Agent Mouse/Local MCP/терминал/модельные подключения, Wallet/Web3 удалены; старые ТЗ их не возвращают. Данные сохранять, сайты ИИ-панели остаются.
- [Desktop-правила](desktop/AGENTS.md), [архив root](docs/context/2026-11-28-root-instructions-history.md); история сводок в Git. Большие старые журналы целиком не загружать.

## Пять опор владельца

1. Сетка до 12 окон плюс отдельное AI-окно — бесплатно.
2. Пять рабочих столов бесплатно, 18 платно.
3. Автосохранение скриншотов и текста — бесплатно.
4. Управление сетевыми фильтрами — бесплатно.
5. Flash: приватная разовая P2P-передача без TURN/relay; бесплатно 100 GB, платно без продуктового предела.

Сейчас пять столов для всех; paid entitlement/billing и 18 столов не реализованы. Capture остаётся opt-in/default off с паузой private/lock и техническими ограничениями. Старые тарифы не применять; сайт и цены сейчас не переписывать.

## Текущая работа: Flash и профиль

[Архитектура, код и доказательства](docs/desktop/2026-11-28-mouse-flash-architecture.md), ветка `mouse/flash-direct-transfer`. Sandbox, trusted IPC, file grants/journal/resume, STUN-only RTC, encrypted signaling, Ed25519 proof, взаимное согласие реализованы. Device identity не удостоверяет человека.

**100 GB = 100000000000 B на логическую передачу — рабочий default; период владельцем не подтверждён.** Resume не повторяет квоту manifest. Платный безлимит снимает коммерческий cap, сохраняя пределы памяти/диска/сети. Closed NAT может отказать; relay fallback отсутствует.

Flash включается только на Mac через `MOUSE_FLASH_PREVIEW=1`, меню «Файл → Флэш»; новый профиль добавляет вход из настроек. Production broker/STUN не настроены; dev CLI loopback. В private Flash недоступен, переход туда останавливает сессию.

### Подтверждённый Mac-прототип

Source `d816467caa43f5d5f14df58dd140e27c7d6fb282`; [run 46120692177](https://github.com/jeep-jim/OSMINOG/actions/runs/46120692177), job `140904325618` — **SUCCESS**, darwin arm64 / Electron 44.5.0. **175 tests PASS**, отдельно RTC/profile native gates.

50 331 884 B payload = 9 437 184 B durable + 40 894 700 B после пересоздания stores; SHA256 совпали. Consent/proofs/non-relay/buffers/cleanup PASS, broker/STUN выключены во время resumed payload.

[Компактный receipt](docs/desktop/evidence/mouse-flash-profile-prototype.json), exact artifact/hashes — в задаче. Два production окна на одном runner/process; issuer, picker paths/protector тестовые. Не две машины, WAN/TB, OS Keychain/ручной picker, actual owner enrollment или новый установленный DMG. История попыток — в CI.

### Профиль и Mouse ID 1

**Profile native PASS:** имя/фото, light/dark, panel 744/380, draft без ID / обычный 2 / тестовый owner 1, reopen/private/FlashService; 8 PNG. ID только по pinned certificate для device/name/avatar hash; иначе `null`. Правка JSON не присваивает 1.

[Registry prototype](tools/mouse-account-registry.cjs): **16 PASS**; ID 1 и место для него зарезервированы владельцу. Claim требует одноразовый 256-bit bootstrap + device proof; обычные IDs начинаются с 2. Это single-writer серверный модуль, без живого endpoint, фактической регистрации устройства владельца, recovery/linking и billing. Bootstrap/signing key не помещать в Git.

Далее: hard-link commit (exFAT не проверен), persisted completion receipt при потере finish ACK; OS storage/picker, две машины/WAN/объёмы. Account/broker rollout, DMG/updater/publisher, 18 столов/оплата/landing — отдельно.

## Принятый Mac 6.0.44

[Задача, exact SHA/пакеты/CI](docs/desktop/2026-11-28-mouse644-filter-updates-page-themes.md). Темы: `prefers-color-scheme`, `syncWebsiteTheme`, Primer/root markers при CSS light/dark поддержке; произвольные JS-темы не гарантированы. Фильтры: 12 h, ETag/304/fallback, до 8 HTTPS-списков; allow/cancel без изменения media/DRM.

Native FileManager/Bundle: **Mouse**, 56 локалей. `Mouse Browser.app`, executable, App ID и `Trader OS` сохранены. Ad-hoc preview без Developer ID/notarization; защиту ОС не отключать.

[Fresh/643/629 acceptance](docs/desktop/evidence/mouse644-publisher-acceptance.json) — PASS. [Release 644](https://github.com/jeep-jim/OSMINOG-Releases/releases/tag/quadro-macos-v6.0.44-arm64): исходные DMG/ZIP, канал после upload verification. [Public receipt](docs/desktop/evidence/mouse644-public-macos.json) — PASS, 28.11 в 12:17:27 KRAT.

## Автоматический сайт и история

[mouse.black](https://mouse.black/) — собственный webroot/HTTPS osminog, 72 языка; [инфраструктура](docs/website/2026-11-22-mouse-black-launch.md). Каналы проверяются через 60 s после прошлой проверки; платформы независимо, asset/SHA256, запрет отката/замены immutable файлов, каталог перед скачиванием.

Receipt 644 подтвердил каталог/полный DMG/Range и неизменность Windows/Linux 642. Историю [643](docs/desktop/2026-11-27-mouse643-mac-polish.md#завершённая-публикация), [642](docs/desktop/2026-11-27-mouse642-navigation-grid.md), PR/CI читать адресно.
