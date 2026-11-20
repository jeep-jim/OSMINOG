# Mouse Browser 6.0.32 — owner corrections

## Scope and current status

**Current status — 2026-11-20: PUBLISHED / VERIFIED_DOWNLOAD on macOS arm64 and Windows x64.** Both publishers completed the final installed, public-package and anonymous old-updater download gates. The final evidence is recorded at the end of this document; earlier pending entries remain historical checkpoints. Owner-device, physical-media-key, live-VK and separate Windows desktop-shortcut visual checks remain unverified.

### Initial scope record, before final acceptance

The owner explicitly retained Electron and requested actual new macOS arm64 and Windows x64 packages. Source baseline: `a5fc2b3d543d58d5b79f63d039894fc639b8a904`, previously published Mouse6.0.31. Issue180 is the recorded feedback. This entry describes the candidate and the checks recorded below; publication and owner-device success remain unverified.

The three attached screenshots specify the footer and Windows defects. The target keeps the central Nora control. Left group: Mouse logo/title, theme, purple privacy glasses and camera, then window/layout controls. Right group keeps library controls, AI, version, language and Quit. Footer Settings, Documents and Fullscreen buttons are removed; those commands remain in the appropriate menu. The logo offers a new tab at https://mouse.black. Follow-up requires balanced icon sizes, generous spacing within controls and larger gaps between groups.

The optional helper is removed from the start page and advertised mode/provider presets; it has one explicit Settings entry and a clear close action. Saved legacy mode/layout data remain readable, but launching/restoring a desktop does not automatically open the helper.

A further owner instruction supersedes document editing: every supported document opens as an ordinary pane tab in **view-only** mode. PDF annotation/text replacement, Word formatting/text editing, spreadsheet edits and text writes are unavailable. PDF view navigation/zoom/rotation and text selection remain; Word/table/text viewing remain. Native draft/save methods reject writes for the shipped Mouse service independently of the renderer. Existing source files and documents are not migrated or rewritten by viewing.

## Implementation

- Metadata-only page events update only changed labels. Home/document mounts are keyed; unchanged native chrome/focus and empty progress/hint states no longer request layout. The original VK/device flash has not been reproduced in this executor. An installed local-audio regression checks site Next, automatic ended, MediaSession callback and a metadata burst while another pane retains typing focus.
- Chromium's native hide-scrollbars preference is set before app readiness. A user-origin CSS fallback also hides scrollbar decoration without disabling scrolling. The native test covers wheel/keyboard, nested scroll containers, shadow roots and cross-origin frames. This supersedes the previous forced thin gray bars.
- The approved19×17 mascot keeps its proportions. Windows uses the same source geometry with normal smoothing; ICO generation includes16/20/24/32/40/48/64/96/128/256 sizes and transparent margins. No new mascot design is introduced.
- The footer, menu access, website offer and optional helper follow the owner screenshots and spacing follow-up.
- Document viewers are bounded and remain inside existing panes. Retained parser/ZIP/data-preservation unit tests remain; the retired625/627 editing acceptance is explicitly replaced by632 native view-only acceptance.

## Verification and release gates

Local Chromium cannot start in this executor because socket creation is denied. Local Node/Python tests and native CI are separate evidence. The source workflows must install and test actual macOS/Windows builds, including all unchanged Nora, task-only progress,50-live-tab, privacy/profile/update, pane seam/corner and gesture checks. New native evidence: `mouse-632-media.json`, `mouse-632-documents.json`, `mouse-632-footer.json`, plus hidden-scrollbar facts in the retained629 UI report. The real published6.0.29 →6.0.32 update baseline stays pinned; older assets are immutable.

Publication requires the successful exact source commit and artifacts, immutable size/hash pins, fresh installed release reruns, public package verification and channel readback. The macOS package retains existing ad-hoc signing; Windows signature status is measured. Owner-device media-key and live VK-account outcomes remain unverified until observed on the owner's machines.

## Execution evidence

Pending final local test, source CI and publication results. Append actual run IDs, PRs, hashes and remaining limits after each gate; do not replace this status with a claim based on a merely started run.

### Local pre-CI checks

25 focused package/icon/scrollbar/metadata tests passed;36 document model and host read-only tests passed;17 independent task/stress acceptance tests passed. Base `npm test` completed171 passed and5 blocked by the executor Unix-socket policy (`listen EPERM`), not a passing full gate. Native/macOS/Windows and the complete Mouse suite remain mandatory on CI. A source-code DOM fixture measured30 track-title changes: unrelated-pane writes fell810→0 and home/document remounts120/30→0; native layout requests were0 in both versions. This is a synthetic DOM measurement, not the owner compositor-flash reproduction or a device performance benchmark.

The complete local Mouse runner reached766 passed,8 failed,1 cancelled and4 skipped before its300s limit. The failures are in the helper/native-filesystem/MCP cases (including closed child connections); the full runner timed out in mouse-agent.test.cjs. These are not resolved by skipping CI checks, and no passing complete local suite is claimed. Native CI will run the unfiltered required suite on the supported platforms.

### First native CI passes and test corrections

Source PR181 and release PR58 are open. Release contract runs44678438876 (Mac) and44678438935 (Windows), plus the retained registry/publisher checks, passed for release head3ca6db0ee8d550c93658bd37e7e96982754b24b4 with unready pins. This is not publication.

The first Mac source runs passed the complete required unit suite and the retained task-only/fifty-tab native stages. The new media process initially hit a CI-only pointer allowlist; the native guard now admits the isolated task/media process while retaining CI=true, an absolute test profile and explicit smoke-mode requirements. Run44678506061 then passed the native site-next scenario: the real title changed, unrelated pane DOM/native geometry stayed unchanged and all live identities were retained. Its automatic-end fixture timed out after seeking near the end; the report does not establish the seek failure cause. The fixture now waits for the real eight-second audio to finish naturally and records the browser's trusted ended event plus failure-time media state. The original owner hardware/media-key case remains unverified.

Windows run44677925466 exposed a stale unit contract that still required editing in the current version. Only the current-version contract is updated to require view-only documents, footer, website offer and manual helper; the actual629 baseline retains its original editing markers. All six portable Windows verifier contract tests pass (one Windows-only signature test is skipped on this Linux executor). Native source checks remain pending after these corrections.

### Native candidate verification and shell-reload correction

Mac run44679958752 passed the complete source workflow at `f525c310fe883ede8097a03d1f271c5e9af50213`, including installed read-only viewers, native media scenarios, update/restart and profile preservation. Its verification archive14604616192 has SHA-256 `66d2539f91ba40c1fc9877cba1359e383d5eb3219458b65fae9b18c4e970dd02`. All four independent release checks passed against those actual files: retained631 task/stress,632 owner feedback,630 source acceptance and628 gesture traces. This proves that candidate, not later changes or publication.

Windows run44679958771 at the same head passed the required unit suite, NSIS build, actual629-to632 upgrade/profile checks, task/stress, all four native media scenarios and the six footer width/theme cases. It failed when the first document chooser was expected to cancel after a shell reload; the dialog handler had not been reached. Its verification archive14603938503 has SHA-256 `ae7b77fa7f6a577ff09a228c9b2218a364749c5a5ed01bbabef050d4a255ab0d`. New Windows scrollbar and final desktop-icon acceptance had not yet run.

A regression test reproduced a product defect matching that sequence: a reloaded shell restarted its overlay message counter, while the persistent native gate rejected the lower sequence numbers. The gate now scopes its counter to the trusted current main-frame process/routing identity, rejects departed or detached frames and preserves independent Nora surface holds. Both new regressions failed before the fix; all70 focused overlay/metadata/privacy/trust/surface tests passed afterwards. Native checks now record the before/after shell frame IDs, the acknowledged modal barrier and actual native page visibility, plus passive trusted-input and existing-handler diagnostics. They retain the OS click and existing document timeout. The next exact-head Windows run must establish whether this fixes the observed native failure.

Visual review of the actual1440px Windows capture also exposed a legacy oversized gap before AI. The library group now has a fixed12px margin, with the native check requiring a modest12–24px actual gap at800/1100/1440px; all11 focused footer/chrome tests passed. These latest source changes still require complete exact-head macOS and Windows checks before immutable package pins or publication are prepared.

Run44682871880 at `fa328abcf1a48c8006363971589e55965a334756` stopped in the unit suite: the legacy617/618 geometry guard intentionally hashes the complete615 stylesheet, so changing its footer rule also invalidated that historical check. The615 stylesheet and its unit test are restored byte-for-byte to `f525c31`; the12px margin is now in the existing current-owner footer rule in `browser.css`, whose specificity also overrides narrow-window legacy margins. The frozen Nora hash/assertion is unchanged. All18 focused615/616/617 tests pass; the same native12–24px gap acceptance remains required.

### 20 ноября 2026 — итоговые исходные пакеты приняты, публикация выполняется

**Контрольная точка: SOURCE_ACCEPTED / PUBLISHERS_STARTED / PUBLICATION_PENDING.** Эта запись дополняет прежнюю историю кандидатов. Успешный source и объединённый release PR ещё не означают доступность нового публичного пакета или переключение канала.

Точный проверенный исходник [`ebe2df44f1fc73fa8fa329c01406a360ebf7eef3`](https://github.com/jeep-jim/OSMINOG/commit/ebe2df44f1fc73fa8fa329c01406a360ebf7eef3) принят через [PR181](https://github.com/jeep-jim/OSMINOG/pull/181) в `main` merge-коммитом [`7875ad0d3506c12cd2e64c6df298670b8ad9fbaa`](https://github.com/jeep-jim/OSMINOG/commit/7875ad0d3506c12cd2e64c6df298670b8ad9fbaa). Публикация использует проверенные пакеты этого исходника без пересборки; merge сохраняет его в истории `main`.

| Платформа | Принятая исходная проверка | Попытка и задания |
|---|---|---|
| macOS arm64 | [44683165219 — SUCCESS](https://github.com/jeep-jim/OSMINOG/actions/runs/44683165219) | attempt 1; `mouse-arm64` [136111128286](https://github.com/jeep-jim/OSMINOG/actions/runs/44683165219/job/136111128286) |
| Windows x64 | [44683165197 — SUCCESS](https://github.com/jeep-jim/OSMINOG/actions/runs/44683165197) | attempt 1; builder на `windows-2022` [136111172537](https://github.com/jeep-jim/OSMINOG/actions/runs/44683165197/job/136111172537), повторная установка того же EXE на `windows-latest` [136115846365](https://github.com/jeep-jim/OSMINOG/actions/runs/44683165197/job/136115846365) |

Полные исходные прогоны включают обязательные unit и installed gates, сохранение профиля, приватность, повторный запуск и реальную замену опубликованной 6.0.29 на 6.0.32. Поздняя ошибка документного диалога после shell reload больше не воспроизводится в этих принятых прогонах. Исторический frozen guard норки сохранён; умеренный отступ панели проверен уже в итоговых пакетах.

**Независимая проверка скачанных source artifacts:** на Mac приняты все четыре проверки — task/stress, owner feedback, retained source acceptance и отдельный strict motion trace. Task/stress включает 20 и 50 живых тестовых страниц на пяти столах, 15 переходов и 740 декодированных пиксельных probes (60 task + 680 stress); trace содержит 148831 событие. Эти числа относятся к зафиксированным CI-сценариям, а не к производительности сайтов владельца. На Windows независимо приняты installed report, task/stress, owner feedback и скрытые полосы прокрутки; modern report дополнительно подтверждает установку того же EXE и связь с исходным verification report. Записи проверки находятся в `independent-release-checks.json`, `independent-source-validation.json` и `independent-modern-validation.json` соответствующих скачанных наборов.

Новый owner-feedback gate на обеих платформах принял четыре медиасценария: настоящий клик Next на локальной странице, естественное завершение аудио, вызов зарегистрированного MediaSession-обработчика и серию обновлений метаданных. Соседние страницы, ввод и нативная геометрия сохраняются в этих сценариях. Просмотр PDF/DOCX/XLSX/TXT/MD/CSV/TSV/JSON подтверждён вместе с неизменностью девяти исходных файлов, 18 отказами draft/save и девятью кадрами документов. Нижняя панель проверена при 800/1100/1440 px в двух темах; предложение сайта и ручной вход в помощника подтверждены реальными UI-действиями. Hidden-scrollbar gate проверяет wheel и клавиатуру, вложенные области, shadow DOM и iframe; физический трекпад не заявляется проверенным.

**Визуальная сверка:** шесть итоговых Windows footer PNG сопоставлены со скриншотом владельца. Фактический промежуток между библиотекой и ИИ — 16 px при ширине 800 и 18 px при 1100/1440; `overflow=0` во всех шести случаях. При 800 px до норки остаётся 38,67 px слева и 39,47 px справа. Малый логотип сохраняет 19×17, иконки и текст не перекрываются. На двух scrollbar-кадрах полосы отсутствуют; в двухпанельном Word/Excel текст, таблица и встроенный рисунок видны. Значок Mouse целиком виден на панели задач в OS capture. Отдельного кадра ярлыка на рабочем столе в этом наборе нет: его внешний вид не считается визуально подтверждённым. Крупный маскот сохраняет согласованную пиксельную геометрию; сглаживание малого Windows-логотипа не является новым дизайном маскота.

#### Закреплённые байты исходных артефактов и пакетов

Готовые [Mac pin](https://github.com/jeep-jim/OSMINOG-Releases/blob/ea9cab0083e884fb15025c8a95c38fe045e2e68a/staging/mouse/6.0.32-arm64/pin.json) и [Windows pin](https://github.com/jeep-jim/OSMINOG-Releases/blob/ea9cab0083e884fb15025c8a95c38fe045e2e68a/staging/mouse/6.0.32-windows-x64/pin.json) связывают source, PR/merge, успешную попытку, задания, artifact ID и хеши. Хеши ниже относятся к неизменённым ZIP-архивам GitHub artifacts, а не к заново упакованным каталогам.

| Артефакт | ID | SHA-256 архива |
|---|---:|---|
| Mac candidate | 14606425355 | `fa272f48bf16acda28c27ac77ddd9cbd947faf0153674cefa42e01ceef3b72c1` |
| Mac verification | 14606545088 | `629f0623ffd1b7d1e7e4588a171bb308f9dd91789bdeba4874b26895ea401596` |
| Windows candidate | 14605697368 | `6bce15d5b9fe091c96ff59b09391e85a543fed68e00cc1baafb64d9dd3dc0172` |
| Windows verification | 14606565019 | `25178a5d8c4f854636640a8cf003ce7692c5441ea0f4d3d519a203025a2ebe5a` |
| Windows modern verification | 14606621519 | `0cdc79ebcb27086413f2124481c8b7056abe472f3c058eca5a9ada6a321744c6` |

| Пакет из принятого source artifact | Размер, байт | SHA-256 |
|---|---:|---|
| `Mouse-Browser-6.0.32-mac-arm64.dmg` | 137839606 | `c6a6d1d6ce6e5ed2fdd1fbd7735c4c3c37e4c80e77781c84cdf9608ca56d7ec2` |
| `Mouse-Browser-6.0.32-mac-arm64.zip` | 140205140 | `55208597bede8dd16f1f25e40aab0d1ab732ca19c13a31a509d5ae0a967e4787` |
| `Mouse-Browser-6.0.32-Windows-x64.exe` | 125728399 | `824c5c1eb1bd3a31079d9f8c8109cb37a815f9c4b1d6fa498f79604f8dbde02e` |

#### Release PR и ещё не завершённая публикация

[Releases PR58](https://github.com/jeep-jim/OSMINOG-Releases/pull/58) принят merge-коммитом [`944e83af400bb691ab97c6d94a276c46c0a67405`](https://github.com/jeep-jim/OSMINOG-Releases/commit/944e83af400bb691ab97c6d94a276c46c0a67405). Все шесть финальных release checks прошли на [`ea9cab0083e884fb15025c8a95c38fe045e2e68a`](https://github.com/jeep-jim/OSMINOG-Releases/commit/ea9cab0083e884fb15025c8a95c38fe045e2e68a). В Windows release tool исправлен путь к фактически загружаемому `mouse-629-ui-regressions.json`: проверяются identity/restoration его wrapper и вложенный scrollbar payload. Временный standalone JSON не выдаётся за загруженный артефакт. После этой поправки приняты 56 Windows publisher tests; исходный пакет не менялся.

Merge с двумя `PUBLISH_OWNER` запустил [Mac publisher 44686632355](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44686632355) и [Windows publisher 44686632337](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44686632337). **На этой контрольной точке подтверждён только запуск обоих publisher, PUBLICATION_PENDING.** Ещё требуется зафиксировать их свежие installed reruns, независимое принятие финальных отчётов, неизменность публичных assets, чтение каналов и анонимную загрузку настоящим обновлятором 6.0.29. Старые пакеты и предыдущие pins не перезаписываются. Публичные ссылки на 6.0.32 и статус `PUBLISHED / VERIFIED_DOWNLOAD` будут добавлены отдельной записью после фактического завершения.

**Сохраняемые пределы:** физические медиаклавиши, личные Mac/Windows владельца и его живой VK-аккаунт не проверены; исправление его исходного мигания не объявляется воспроизведённым и подтверждённым на устройстве. Mac — Apple Silicon arm64, macOS 13+, ad-hoc подпись без Developer ID/нотариализации. Windows — x64, без цифровой подписи; прогоны Server 2022/2025 не заменяют проверку всех драйверов, масштабов экрана и пользовательских систем. Отдельный desktop-shortcut screenshot остаётся отсутствующим. Эти ограничения не снимаются успешным merge или стартом publisher.

#### Следующая контрольная точка — первая попытка Windows остановлена до установки

[Mac publisher 44686632355](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44686632355) прошёл import закреплённых пакетов и выполняет свежую installed DMG verification. Его итоговый успех и переключение публичного канала ещё не подтверждены.

Первая попытка [Windows publisher 44686632337](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44686632337) завершилась отказом **на import**, с диагностикой `Accepted Mouse629 evidence validator changed`. До свежей установки и публикации эта попытка не дошла. Проверяется сохранение точных байтов валидаторов при Windows checkout, включая возможное влияние переводов строк; причина отказа на этой контрольной точке ещё не подтверждена воспроизведением. Рассматривается узкая поправка нового 632 release workflow. Проверенные source, готовые пакеты и их pins не изменяются; frozen validator guard не снимается. Общий статус остаётся **PUBLICATION_PENDING**. Причину, принятый фикс, следующую попытку и публичный результат следует дописать по фактическим доказательствам.


#### Исправление Windows publisher и завершённый Mac-выпуск

[Releases PR59](https://github.com/jeep-jim/OSMINOG-Releases/pull/59) объединён как `091671cf707bd26b23e4c73ba3ab4a5d3cd3c8a0`. Контракты прошли на `cdad06b595d6e4cef9ebdca69af284e14849b157`, включая 60 Windows tests и оба registry checks. Контролируемый настоящий Git checkout воспроизвёл отказ frozen629 validator при `core.autocrlf=true`; неизменённая цепочка валидаторов проходит с `false`. Хеш файла на уже завершившемся первом Windows runner не записан, поэтому локальное воспроизведение не выдаётся за прямое измерение его файла. Исправленный workflow устанавливает `core.autocrlf=false` перед checkout. Его push-trigger ограничен `main` и двумя путями: прежним `PUBLISH_OWNER` и собственным workflow этой версии. Точное разрешение владельца, готовые pins, immutable bytes, полный набор gates, concurrency и запрет downgrade сохранены; owner-файл не переписывался ради запуска.

Автоматический повтор [Windows publisher44687934185](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44687934185), attempt1, job136126741696 прошёл pre-checkout preservation, checkout и прежний блокирующий immutable/frozen-checker import. На этой контрольной точке выполняется свежая установленная проверка; публичный Windows-выпуск ещё не заявляется завершённым.

**Mac PUBLISHED / VERIFIED_DOWNLOAD:** [publisher44686632355](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44686632355), job136122566128 завершён SUCCESS. Свежая установка и настоящая замена6.0.29→6.0.32 прошли, независимые installed evidence/task/feedback/trace gates приняты. [Публичный релиз452345684](https://github.com/jeep-jim/OSMINOG-Releases/releases/tag/quadro-macos-v6.0.32-arm64) опубликован `2026-11-20T06:31:02Z`; размеры и SHA-256 DMG/ZIP совпадают с закреплёнными выше source packages, совместимый Quadro DMG совпадает с Mouse DMG побайтно. Канал `channels/mouse/macos-arm64.json` прочитан обратно с6.0.32 и теми же размером/хешем/URL.

Скачан и проверен publisher artifact14607691654 (`mouse632-release-verification-attempt-1`):27299338bytes, SHA-256 `df31fb4e09851f8a912f4ed169122b8803d664f5d509ad0e524c684e5140cb32`,366entries. Его `channel-verification.json` подтверждает actualOldModuleVersion6.0.29, anonymousDiscovery=true, verifiedDownload=true и currentVersionCheck=true; скачанный DMG137839606bytes имеет SHA-256 `c6a6d1d6ce6e5ed2fdd1fbd7735c4c3c37e4c80e77781c84cdf9608ca56d7ec2`. Это реальная анонимная загрузка опубликованного пакета прежним обновлятором, не только сравнение release metadata. Общая задача остаётся открытой до такого же финального результата Windows; пределы проверки физических устройств остаются прежними.

#### 20 ноября 2026 — обе платформы PUBLISHED / VERIFIED_DOWNLOAD

**Финальный статус выпуска: PUBLISHED / VERIFIED_DOWNLOAD для macOS arm64 и Windows x64.** Эта контрольная точка завершает описанное выше ожидание Windows; прежние неудачные и промежуточные попытки остаются историей. Обе платформы публикуют неизменённые пакеты принятого source `ebe2df44f1fc73fa8fa329c01406a360ebf7eef3`, без пересборки.

Итоговый [Windows publisher 44687934185](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44687934185), attempt 1, [job 136126741696](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44687934185/job/136126741696) завершён **SUCCESS** на release-коммите `091671cf707bd26b23e4c73ba3ab4a5d3cd3c8a0`. Свежая установленная проверка, task/stress, owner feedback и hidden-scrollbar acceptance приняты. [Публичный Windows-релиз 452352254](https://github.com/jeep-jim/OSMINOG-Releases/releases/tag/mouse-windows-v6.0.32-x64) опубликован `2026-11-20T06:40:30Z` как prerelease. [EXE 6.0.32](https://github.com/jeep-jim/OSMINOG-Releases/releases/download/mouse-windows-v6.0.32-x64/Mouse-Browser-6.0.32-Windows-x64.exe) имеет 125728399 байт и SHA-256 `824c5c1eb1bd3a31079d9f8c8109cb37a815f9c4b1d6fa498f79604f8dbde02e`, точно как закреплённый source package.

[Windows-канал](https://raw.githubusercontent.com/jeep-jim/OSMINOG-Releases/main/platforms/windows/mouse-x64/latest.json) прочитан обратно: версия 6.0.32, тот же URL, размер и SHA-256. Фактический `windows-channel-verification.json` подтверждает `ok=true`, `anonymous=true`, `previousVersion=6.0.29`, `comparisonVersionIsFixture=false`, `verifiedDownload=true` и `currentVersionCheck=true`. Это успешная анонимная загрузка реальным прежним обновлятором. Скачанный publisher artifact **14607254681** содержит 369 записей; исходный ZIP — **26297609 байт**, SHA-256 **`a17550ba04d5a36c7bea4945e5216bee7a9fa38296db6688e5abb066b3a5bf8f`**. Публичные метаданные, архив, installed evidence и channel readback согласованы в `public-validation.json`.

[Mac publisher 44686632355](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44686632355) и [Mac-релиз 452345684](https://github.com/jeep-jim/OSMINOG-Releases/releases/tag/quadro-macos-v6.0.32-arm64) уже приняты предыдущей записью вместе с анонимной загрузкой DMG обновлятором 6.0.29. Все финальные release gates обеих платформ завершены; публичные пакеты и каналы доступны. Физические медиаклавиши, компьютеры и живой VK-аккаунт владельца по-прежнему не проверены; отдельного снимка Windows desktop shortcut нет. Mac остаётся ad-hoc без Developer ID/нотариализации, Windows — без цифровой подписи. Публикация не расширяет эти пределы и не подтверждает исходное мигание на личном устройстве владельца.
