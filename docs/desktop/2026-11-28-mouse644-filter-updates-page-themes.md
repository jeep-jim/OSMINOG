# Mouse 6.0.44 — Mac: темы, имя и подписки фильтров

## Статус и границы

**Mac 6.0.44 опубликован; source, publisher и публичная загрузка — PASS.** Только macOS arm64. Windows/Linux остаются на 6.0.42; их работа приостановлена. АвтоЦена и её доступы изолированы.

[Source PR 226](https://github.com/jeep-jim/OSMINOG/pull/226) объединён. Source `ad9b8c217da8917f95a2d672e62790f474daef4b`, merge `161f2ebda378c48c1ae714c671c2d91830c4558f`. [CI 46106499427](https://github.com/jeep-jim/OSMINOG/actions/runs/46106499427), attempt 1, job `140860337521` — **SUCCESS**.

Сохраняются профиль, App ID, partition, cookies, столы/вкладки, канал и маскот. Tile Search, Agent Mouse и Wallet/Web3 не возвращаются; старые данные остаются.

## Решения 644

### Тема страницы

`nativeTheme.themeSource` задаёт `prefers-color-scheme`. Новый `mouseControlSettings.syncWebsiteTheme=true` дополнительно синхронизирует явную тему зарегистрированных главных HTTP(S)-документов.

GitHub использует Primer-контракт с сохранением совместимых контрастных вариантов. Generic: корневые `data-theme`, `data-bs-theme`, `data-color-mode`, `data-color-scheme`, `color-mode`, `theme`, классы `light/dark`, только когда CSS подтверждает обе темы. Bootstrap — известный контракт и загруженные CSS-переменные; объём чтения CSS ограничен.

Выключение возвращает оформление сайта, сохраняя посторонние классы. Учтены поздний CSS, навигация, замена корня, BFCache и normal/private ownership. IPC — зарегистрированный WebContents/главный фрейм. Cookies/storage, аккаунт и ответы не меняются; инверсии изображений нет.

**Предел:** нестандартный JS-переключатель или недоступный CSS без известного контракта не поддерживаются универсально. [Реализация и проверки контракта](../../desktop/mouse-page-theme.cjs).

### Имя и профиль

Нативная проверка FileManager/Bundle подтверждает имя **Mouse**; в Mac-меню/About задано Mouse. Локализованные `CFBundleName/CFBundleDisplayName=Mouse`. Базовые имена, физический `Mouse Browser.app`, executable `Mouse Browser`, App ID `com.osminog.desktop.preview` и профиль `Trader OS` сохранены для совместимости updater 643.

[Swift-проверка](../../tools/mouse-644-branding.swift): FileManager/Bundle, версия, App ID, пути. Source 352 подтвердил **Mouse после установки и 643→644, 56 локалей**. Mac — ad-hoc preview без Developer ID/notarization.

### Обновляемые фильтры

Matcher только разрешает/отменяет запросы; ответы, медиапотоки и DRM/Premium не меняются. Проверка каждые 12 часов; ETag/Last-Modified, `304` только с проверенным телом и прежним валидатором. `checkedAt` отдельно от `updatedAt`. Ошибка сохраняет рабочую копию; повторы ограничены. Проверка/компиляция до замены правил, запись атомарна.

UI: источники/лицензии, состояние/даты/число правил, ручная проверка, выключатели, до 8 своих HTTPS-подписок. Все списки выключены → пустой matcher; общий выключатель останавливает обработчики/загрузки/таймер. В private постоянное управление запрещено.

Загрузчик без browser cookies, посещаемого URL и redirects; DNS/URL/размер/формат проверяются. Список не исполняется как JS. Источник видит запрос за списком.

В установщике — неизменённые EasyList/RU AdList `202611280152` с заголовками/атрибуцией, резерв только для включённых источников без кэша. [Manifest с size/SHA256](../../desktop/mouse-filter-lists/manifest.json), [источники и условия](../../desktop/mouse-filter-lists/README.md).

## Принятая source-проверка

Native 352: 644 write/read и reader, темы/подписки/private/restart, retained suites, performance, 643→644 update и профиль — PASS. В `nativeSummary` все перечисленные acceptance flags `true`.

Обе темы, возврат оформления, сохранение страниц/форм/прокрутки/storage, 200/304/503, кэш/резерв/свои списки проверены реальными CGEvent/OS PNG и отдельными процессами. GitHub-origin и HTTP-списки — synthetic fixtures. **Живой личный GitHub, произвольные сайты и физический Mac владельца не проверены.**

Cloud Mouse: **1819 случаев — 1802 PASS / 17 SKIP / 0 FAIL**. Базовый `npm test`: **182/182 PASS** отдельным запуском; эти счётчики не складываются.

## Опубликованные байты и source artifacts

Artifacts, `mouse-build.json` и `SHA256SUMS.txt` связаны с source/run/attempt выше. Publisher импортировал **те же DMG/ZIP без пересборки**; опубликованные байты совпали с pin.

| Пакет | Байты | SHA256 |
|---|---:|---|
| `Mouse-Browser-6.0.44-mac-arm64.dmg` |132744234|`c489a46d5fd32888533e91ccdaa4f069dc7b461a3c41d8b0d4cf2286e31bb375`|
| `Mouse-Browser-6.0.44-mac-arm64.zip` |132788013|`bc389f06274ef7b72ee28bc1255e2265cf1bc9f205e065bae5d1955a0d88e6af`|

| Source artifact | ID | ZIP-байты | SHA256 архива |
|---|---:|---:|---|
| `mouse-arm64-candidate` |15248501921|264991029|`fd26ceefad634291493b143fc6c7e06c23c9a682b2244599da7b9b20c80f704f`|
| `mouse-arm64-verification` |15247979966|117190158|`76f01c8c6b94f320995dbefe2c079e0db059fc2771d4e6b602b69c135ea1eccf`|

## Завершённая публикация

[Publisher PR 106](https://github.com/jeep-jim/OSMINOG-Releases/pull/106), merge `1e85e195bcee576ce15f86f4e5a1289e4209e190`; [неизменяемый pin](https://github.com/jeep-jim/OSMINOG-Releases/blob/1e85e195bcee576ce15f86f4e5a1289e4209e190/staging/mouse/6.0.44-arm64/pin.json).

[Run 46108907151](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/46108907151), attempt 1, native job `140868484487` — **SUCCESS**, завершён 28.11.2026 в 12:14:39 KRAT. [Publisher acceptance](evidence/mouse644-publisher-acceptance.json): fresh native, реальные 643→644/629→644, профиль и имя Mouse — PASS. Reduced motion: **source 2 кадра, fresh publisher 1 кадр**, обе проверки PASS. 52 frozen dependencies сохранены; 644 inventories 5 toggles/20 sections, schema hashes согласованы.

| Итог | Подтверждение |
|---|---|
| [Release](https://github.com/jeep-jim/OSMINOG-Releases/releases/tag/quadro-macos-v6.0.44-arm64) | ID `461318997`, tag `quadro-macos-v6.0.44-arm64`; 28.11.2026 12:14:08 KRAT |
| Publisher verification artifact | ID `15248993797`, 117577119 байт |
| SHA256 artifact | `9678f9bd99e3b8226f273e7237a7e03e38e3955432cee019aefd97c75a962190` |
| SHA256 publisher receipt, 31254 байта | `e8bd02b5f4afd31b163aec5765574b5c5fc966d55f7b731288667f9d034a302e` |
| [Public receipt](evidence/mouse644-public-macos.json) | PASS, 28.11.2026 12:17:27 KRAT |
| SHA256 public receipt | `8c2027053d6e070bcc102b49487146d32f14c9f34e947238f6b099c04071764d` |

[Канал Mac](https://github.com/jeep-jim/OSMINOG-Releases/blob/3c84b8e9ea6e4afd915987b7509a527de10b13ca/channels/mouse/macos-arm64.json) продвинут после проверки assets. Отдельные anonymous updater 629/643 приняли тот же DMG. Public receipt подтвердил версию 644 в feed/каталоге, HTTP 200 и верную ссылку на трёх маршрутах `/`, `/en/`, `/ru/`, полный DMG 132744234 байта с SHA256 из таблицы, HEAD 200/Range 206. Windows/Linux остались 642; их catalog entries не изменились. Public receipt покрывает полный DMG; publisher сверил оба release-пакета.

[mouse.black](https://mouse.black/) обновляется автоматически: официальные каналы проверяются через 60 секунд после окончания предыдущей проверки; платформы независимы, SHA256/неизменяемость/запрет отката обязательны. [Порядок работы](../website/2026-11-22-mouse-black-launch.md).

## Рабочий контекст

Правила root/desktop и roadmap сокращены; полная история сохранена в [архиве](../context/2026-11-28-root-instructions-history.md). Диагностика попыток — в PR/CI/Git; архив читать только по задаче.
