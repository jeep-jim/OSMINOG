# Mouse Flash и профиль — архитектура и проверка

28.11.2026, KRAT (UTC+7). Ветка `mouse/flash-direct-transfer` от main `dc839e63eea82e5584fee551c5dca224dcf311ab`. **Flash real RTC и profile UI native PASS на Mac.** Это проверенный прототип; main/version/release прежние: Mac 6.0.44, Windows/Linux 6.0.42. Новые пакеты/серверы, сайт и оплата не опубликованы.

## Решения владельца и реализация

| Продуктовая опора | Фактическое состояние |
|---|---|
| До 12 окон плюс AI-окно бесплатно | [LIMIT=12](../../desktop/mouse/layout.js); [AI](../../desktop/mouse/browser.js) отдельно как `lane:'side'`. Обычные сайты, без Agent Mouse; их тарифы не меняются. |
| 5 столов бесплатно, 18 платно | [MAX_DESKS=5](../../desktop/mouse-desktops.cjs) для всех. Paid entitlement/18 столов отсутствуют. |
| Автосохранение скриншотов/текста бесплатно | [Capture](../../desktop/mouse-local-captures.cjs): opt-in/default off, private/lock пауза. [Технические пределы](../../desktop/mouse-capture-archive.cjs): 1000 копий/512 MiB, текст 1 MiB, изображение 24 MiB; не тариф. |
| Управление сетевыми фильтрами бесплатно | [Settings](../../desktop/mouse-settings.cjs), [subscriptions](../../desktop/mouse-adblock-subscriptions-ipc.cjs) без paid-ветки. Permanent settings из private запрещены. |
| Flash: приватная разовая P2P-передача без TURN/relay, free 100 GB, paid без продуктового cap | Mac-прототип проверен на реальном RTC. Есть device identity и локальный профиль; account registry — отдельный прототип без endpoint/actual owner enrollment/billing. |

**100 GB = 100000000000 B на логическую передачу — рабочий default; период владельцем ещё не подтверждён.** Cap проверяется main на обеих сторонах по manifest; retransmit/resume не увеличивает его размер. Это не утверждённая месячная квота. `maxTransferBytes=null` снимает только коммерческую границу; production paid-флага/entitlement нет, RAM/диск/сеть конечны. Учёт по аккаунту/защита тарифа от переустановки не реализованы.

18 столов требуют отдельной миграции: нынешний DesktopBank сворачивает overflow в пятый с recovery. Будущее хранение отделить от entitlement; downgrade не удаляет/сливает столы 6–18 и вкладки. Профиль/App ID/cookies/update paths сохранять; Windows/Linux, landing/цены и АвтоЦену не менять ради этой работы.

## Реализованные компоненты

| Код | Граница ответственности |
|---|---|
| [Service](../../desktop/mouse-flash.cjs), [preload](../../desktop/mouse-flash-preload.cjs) | Отдельная local BrowserWindow: sandbox, context isolation, без Node/webview/renderer HTTP/navigation. Trusted main-frame IPC, случайный channel, ≤12 concurrent calls. Main picker выдаёт opaque file grants; сайты API не получают. |
| [UI/controller](../../desktop/mouse/flash/flash.js), [protocol](../../desktop/mouse/flash/transfer.js) | Приглашение/код/согласие, manifest → blocks/ACK → verify/commit, pause/resume. Ordered reliable RTC, I/O ≤1 MiB, frame ≤16 KiB, ≤4 unacked blocks, send buffer ≤4 MiB. Manifest ≤64 MiB, по 250000 files/directories; metadata в памяти, payload потоковый. |
| [File store](../../desktop/mouse-flash-files.cjs) | Grants, journal/hashes/resume, portable NFC paths/safe integers, traversal/symlink/case/ancestor collision/overwrite guards. Source fingerprint и receive root/partial dev/ino/canonical path перепроверяются. |
| [Identity](../../desktop/mouse-flash-identity.cjs), [crypto](../../desktop/mouse-flash-crypto.js) | Persistent Ed25519, deviceId = первые 128 bit SHA256 SPKI. Main требует доступный safeStorage, без plaintext fallback. AES-GCM/HKDF и transcript-bound proof описаны ниже. |
| [Native proxy](../../desktop/mouse-flash-signaling.cjs) | Настроенный HTTPS origin; HTTP loopback только explicit test. No redirects, response ≤320 KiB, deadline 10 s; host/peer bearer остаётся в main. |
| [Dev broker](../../tools/mouse-flash-broker.cjs) | Encrypted signaling в RAM; нет file endpoint/payload logging. TTL 30 min, 64 rooms, body 160 KiB, queues 1 MiB/room и 8 MiB/process, ≤128 messages/room; 600 requests/20 creates на IP за 60 s. Single-use join → peer capability. CLI loopback:8787, deploy отсутствует. |

[Main](../../desktop/mouse-main.cjs): только Darwin с `MOUSE_FLASH_PREVIEW=1`, меню «Файл → Флэш»; новый профиль добавляет вход из настроек. Production broker/STUN не настроены. В private Flash недоступен; переход туда/закрытие окна приостанавливает сессию. Версия и updater прежние.

## Direct-only, ключи и файлы

WebRTC policy — `all`/`relay`, не `direct` ([W3C](https://www.w3.org/TR/webrtc/#rtcicetransportpolicy-enum)). Настройки только STUN; TURN/relay SDP отклоняются. Перед auth-ready controller ждёт selected succeeded pair и оба candidate records host/srflx/prflx, иначе отказывает. Файлового TURN/HTTP/cloud fallback нет. STUN не решает любой NAT/firewall ([RFC8489](https://www.rfc-editor.org/rfc/rfc8489.html#section-1)); оба устройства online, peer видит сетевой адрес другого, инфраструктура — метаданные.

HTTPS не исключает MITM broker ([RFC8827 §9.1](https://www.rfc-editor.org/rfc/rfc8827.html#section-9.1)). 256-bit secret — во fragment приглашения, 128-bit room ID отдельно. Packaged UI разбирает invite как данные, secret не отправляется API/логам. AES-256-GCM/HKDF связывают signaling с room/attempt/role/direction/sequence; transcript — полные SDP offer/answer, manifest hash, device IDs. Ed25519 proof и взаимный auth-ready предшествуют передаче; пользователи сравнивают 64-bit код. Polling завершается после аутентификации; Mac gate подтвердил payload после отключения broker/STUN. Invite не публиковать; device key не удостоверяет человека.

Read/hash разрешены после bindPeer; один active/inflight source resume и один final source hash. Pause/finish/close отменяют и дожидаются pending source I/O. ACK — после sync данных и journal. Resume повторно проверяет peer/manifest и hashes committed blocks; неполная строка journal/неподтверждённый хвост partial обрезаются, целая повреждённая запись отклоняется. Commit — hard link без overwrite после size/hash; crash между link и completion record покрыт тестом. Автозапуска полученного нет.

Pause сохраняет partial/journal, resume требует новое приглашение/согласие; finish удаляет служебные checkpoints, сохраняет файлы. Final commit требует hard-link support; exFAT не проверен. При потере финального finish ACK ещё нет persistent completion receipt/tombstone для идемпотентного повтора. TTL локальных partial/UI удаления незавершённого отсутствуют; отключение питания всей файловой системы отдельно не проверено.

## Профиль и Mouse ID 1

Поручение: имя/фото в боковой карточке настроек, ID 1 владельцу. [MouseProfile](../../desktop/mouse-profile.cjs), [controller](../../desktop/mouse/settings-panel.js), [CSS](../../desktop/mouse/settings-glass.css) реализованы; **native profile gate PASS**. Имя trim/NFC ≤80 codepoints; input image ≤4 MiB, nativeImage → PNG ≤256×256/512 KiB, локально без исходного пути. Private скрывает профиль и отзывает результат picker, не закрывая OS-диалог программно. Flush ждёт начатое file I/O, не диалог.

ID по умолчанию `null`. [Verifier](../../desktop/mouse-account-proof.cjs) требует pinned issuer certificate, совпадающие device ID, имя и SHA256 сохранённых PNG bytes. Изменение имени/фото снимает ID до подходящего certificate. Редактируемый JSON/IPC не присваивает 1; локальное фото не удостоверяет человека.

[Registry](../../tools/mouse-account-registry.cjs): **16 tests PASS** ([tests](../../tools/test-mouse-account-registry.cjs)), single-writer signed atomic state. ID 1 и capacity для него reserved; normal IDs с 2, idempotent по device key. Owner claim: ещё не зарегистрированный ключ + Ed25519 proof + одноразовый 256-bit bootstrap, расходуемый в том же commit. Challenge 5 min, certificate 30 дней; signer/bootstrap вне Git.

**Живого endpoint и фактической привязки устройства владельца нет.** Recovery, device linking, issuer rotation, stale-lock recovery и billing — будущая работа. Test owner certificate не означает actual owner enrollment.

## Последняя приёмка Mac-прототипа

Source [d816467caa43f5d5f14df58dd140e27c7d6fb282](https://github.com/jeep-jim/OSMINOG/commit/d816467caa43f5d5f14df58dd140e27c7d6fb282), tree `a09236c15905aaa94933f172c5dbf922873c366c`; [run 46120692177](https://github.com/jeep-jim/OSMINOG/actions/runs/46120692177), job `140904325618`: **SUCCESS**, darwin arm64 / Electron **44.5.0**. **175 tests PASS, 0 fail/skip/cancel**: 115 Flash + 16 registry + 10 profile + 20 settings + 5 retained settings + 9 private/release. Отдельно прошли [real RTC](../../tools/mouse-flash-rtc-smoke.cjs) и [native profile](../../tools/mouse-profile-ui-smoke.cjs).

| Подтверждённая величина | Байт |
|---|---:|
| Payload: 48 MiB + 173 B, текст, пустой файл/папка | 50 331 884 |
| Durable до разрыва | 9 437 184 |
| Payload после пересоздания обоих stores | 40 894 700 |
| Максимальный RTC message | 16 384 |
| Peak bufferedAmount первого / resumed соединения | 3 951 766 / 3 790 724 |

`9 437 184 + 40 894 700 = 50 331 884`: после resume отправлен только недостающий payload; wire traffic/headers — отдельная величина. Независимые final SHA256 совпали. No bytes до receiver consent, matching code/device proofs, selected srflx→srflx non-relay, закрытие/cleanup — PASS. **Broker и локальный тестовый STUN выключены до resumed payload**, передача закончилась без них.

Profile receipt подтвердил draft без ID, normal ID 2 и test owner ID 1 после proof/bootstrap, real nativeImage PNG 256×256, имя/фото, cancel/remove/replace, persistence после reopen, запуск настоящего FlashService, private hiding и native IPC denial. Карточка над версией, light/dark, фактические panel widths **744/380 px**; 8 profile PNG, renderer errors отсутствуют. Тестовые profiles/issuer не являются реальным владельцем.

[Компактный evidence index](evidence/mouse-flash-profile-prototype.json) связывает source/run и результаты. Artifact `15254101012`, `mouse-flash-direct-transfer-evidence`, **1176679 B**, SHA256 `186a053fe9baad95a3180432b4c89a5ed9466658001b1925293792749fff602d`: unit/RTC/profile logs, 2 JSON, 8 profile PNG и 2 Flash PNG.

Сохранённые реальные кадры теста: [профиль, светлая тема](evidence/mouse-profile-owner-light.png), [узкая панель, тёмная тема](evidence/mouse-profile-owner-dark-narrow.png), [завершение Flash](evidence/mouse-flash-complete.png). Имя, фото, устройства и ID на них — синтетические данные приёмки.

| Receipt | SHA256 |
|---|---|
| `mouse-flash-rtc.json` | `3863a11b366375abbd76c3101a29913ec58df69b5aa8b2570af202f1e7c0c700` |
| `mouse-profile-ui.json` | `ef8f8fd849d41c9678c3d6ee38fde2a66ac48ca67b1bf57a9e09cc38e20a53e4` |

История попыток — в CI, не в больших рабочих журналах. Визуально просмотрены light-wide/dark-narrow профиля и Flash completion; это не ручная проверка каждого состояния.

Граница: production окна/раздельные stores **на одном Mac runner в одном Electron-процессе каждого harness**, без mock RTC. Stores/окна действительно пересозданы; process restart не проверялся. Profile использует production settings assets в owned shell; issuer, picker paths и protector тестовые. Это не две машины/WAN/все NAT, Keychain/ручной picker, actual owner Mac enrollment или installed новый DMG. Измерен RTC buffer, не peak RAM процесса. 100 GB boundary — metadata/малые cap fixtures; sparse seek за 4 GiB — offsets. **100 GB/TB не передавались.**

## Далее

1. Закрыть final-ACK recovery через persistent completion receipt и определить поддержку файловых систем/hard links; exFAT пока не проверен.
2. OS safeStorage/picker, две машины/LAN/WAN/NAT; большие объёмы с hashes и измерениями RAM/времени.
3. Отдельный account/broker rollout, безопасный actual owner enrollment/recovery/linking; ID 1 в тесте его не подменяет.
4. Review ветки, затем новые installed/update/publisher gates перед публичным Mac release; paid/18 столов/landing отдельно. Публичные 644/642, main, сайт и АвтоЦена прежние.
