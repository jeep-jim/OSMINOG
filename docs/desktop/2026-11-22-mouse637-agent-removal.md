# Mouse 6.0.37 — удаление встроенного агента

## Прямое решение владельца, 22 ноября 2026

Владелец отменил встроенного агента Mouse и поручил полностью удалить его из проекта. Это последнее решение заменяет прежние требования Agent-чата, inline-настроек, режима «Агенты», localhost-заготовки агента, Local MCP, терминала, автономного исполнителя и модельных подключений в Mouse Browser. Ранее выданное разрешение на выпуск следующей версии действует для обновлённого состава.

Удаление ведётся от исходного `554fbd5c1da7dbe385fab1385d8f51dc06595d4f` в [PR193](https://github.com/jeep-jim/OSMINOG/pull/193). Этот старый кандидат содержал агента и больше не предназначен для публикации. Его Mac-прогон [45005647659](https://github.com/jeep-jim/OSMINOG/actions/runs/45005647659) завершился отказом Agent622 после успешной Local628-проверки. Исправление этого сценария остановлено по новому решению владельца. Прежние результаты Linux и Windows не переносятся на изменённый исходный код. Все три pins в [release PR66](https://github.com/jeep-jim/OSMINOG-Releases/pull/66) остаются неготовыми.

## Границы изменения

Удаляются код запуска агента, его IPC и события, интерфейс и настройки, отдельный режим рабочего стола, runtime, MCP/PTY/model-зависимости и соответствующие ресурсы поставки. В старых профилях исключаются действующие Agent-настройки и переход в Agent UI; вкладки, история, cookies, файлы и содержимое страниц сохраняются. Общие нативные операции библиотеки, перетаскивания, скругления страниц и установки обновлений переносятся из агентного каталога в самостоятельный компонент браузера.

Обычная боковая панель веб-сайтов ИИ остаётся браузерным инструментом. Android, Chrome Light, исторический full-workspace OSMINOG и АвтоЦена не входят в удаляемую функцию. Старые опубликованные пакеты, хеши, каналы и журналы не переписываются.

## Проверка и выпуск

Для текущей 6.0.37 агентные проверки заменяются явными отрицательными проверками: в установленном приложении нет Agent runtime, API, настроек, режима и ресурсов. Проверки страниц, библиотеки, загрузок, документов, приватности, геометрии, производительности, профиля и настоящего обновления сохраняются. Проверка опубликованной 6.0.36 остаётся исторической проверкой её фактического состава.

На момент этой записи удаление выполняется. Новый исходный commit, локальные результаты, установленная приёмка трёх платформ и фактическая публикация ещё не подтверждены. Доказательства будут дописаны после выполнения; эта запись не является заявлением о готовом выпуске.

## Реализация и локальная проверка перед source CI

В рабочем дереве удалены встроенный Agent runtime, UI, IPC, модельные/MCP/PTY-зависимости и Agent-only сценарии. Удалённый режим переводится в обычный при чтении current/history/global preferences; страницы, localhost, внутренние start ID, pins и AI previews сохраняются. Обычные web-пресеты теперь четыре: trader, support, design, content. Общие операции перенесены в mouse-native/mouse-platform.node; Mac использует прежние native-menu/screen-capture.

Вместо Agent-сценариев текущая637 получает установленную проверку mouse-637-agent-removal.json: отсутствие host/API/UI/settings/mode/ресурсов, реальные упакованные main/preload/generated-page-preload bytes, обе темы и сохранённые native страницы. Отдельно сохранены полный settings/fullscreen/reload/layout сценарий624, история и page progress,27 фактических запросов четырёх web-пресетов и23 сохранённые страницы. Прежний опубликованный636 baseline и629 Windows write markers не переписывались.

Root выполнил полный текущий Mouse unit enumerator на локальном Node24.22.3:1190 тестов,1186 PASS,0 FAIL,4 SKIP. Пропуски относятся к отсутствующему скомпилированному Linux addon и трём настоящим Windows native archive/updater проверкам; они требуют соответствующих CI систем. Текущие637 Python tools:26/26 PASS. После уточнения package audit его четыре адресных теста также прошли: проверяются только действительно упакованные main, shell preload и generated page-pointer-preload; source-only mouse-page-preload не добавляется в приложение ради проверки.

Независимые cross-reviews UI/model и backend завершены без оставшихся блокеров. Найденный до CI обрыв объявления Windows FileStat устранён полной исходной структурой. Объявления Handle/FileStat,15 Windows read/input functions и четыре перенесённых corners/updater файла сверены с исходным кодом; фактической компиляции Windows на этом локальном Linux ещё не было. UI/model scoped180/180 PASS,14 syntax checks,6 CSS parses и87 ссылок ресурсов прошли; эти пересекающиеся наборы не суммируются с полным1190.

| Локальный журнал | SHA-256 |
|---|---|
| removal-full-mouse-unit.log | `8047b6b60b372518cc912c9d4fa0817e3fb5f10f0eaa758672166ba4b358ca19` |
| removal-current-tools-unit.log | `fc39fed2b4b80d33ba92e6f0e13d8cc94ad7471179cc9d7058a640151946aa60` |
| agent-removal-backend-unit.log | `984013b281e272e7519d9d719356991bb33de2fb0c086587a2ea1d9e33b61500` |
| agent-removal-backend-platform-unit.log | `b6e5e924c85671e32850d2e3494cc47c1d635dfc3cf0907dd9a59cd60f6d61c3` |

Git diff --check прошёл. Новый source commit готовится к единой нативной проверке трёх платформ; публикации на этом шаге нет. Физическое устройство владельца не проверено.

Перед push заново прочитана ветка: параллельное продолжение успело добавить fixture-only50cfd797e08f6e17503f8eff521d7b7e57881887 до восстановления нового решения владельца. Новый commit удаления будет иметь именно50c родителем. Дополненные48 строк старого release journal сохранены полностью; два вновь добавленных Agent-only fixture/test файла не входят в продукт после удаления. Browser production за50c не менялся.

## Последний review перед исходной сборкой

Дополнительная проверка обнаружила два противоречия в новых сценариях: действующий renderer добавляет обычное действие custom для своего ИИ-сайта, а новая отрицательная проверка первоначально считала его внутренним сервисом; Mac workflow ещё ожидал пять выходных файлов удалённого Local MCP. Исправлены source contract и независимый publisher: raw chooser сохраняет ровно одно действие custom, четыре исходных ИИ-сайта и корректные абсолютные HTTP(S) адреса. Проверка исполняет настоящий renderAISites из browser.js вместе с сериализованным readback. Удалены ровно пять obsolete test -s; соседние progress/motion/gesture/native проверки сохранены.

Author и root отдельно подтвердили6/6 адресных source tests, без пропусков. Publisher20/20 synthetic negative tests проверяют raw code hashes, отсутствие ресурсов/API/UI, native ownership/crops, уникальные page/WebContents ID и chooser; они не являются установленной приёмкой. Независимая статическая проверка трёх builder allowlists не нашла старого Agent runtime/UI/SDK/helper в составе; общие новые native компоненты и реальные три исполняемых файла присутствуют. Ожидается запуск платформенной CI на новом точном исходном commit.

## Нативная проверка8a и три адресных исправления сценариев

Исходный8a5b688a9e96ca7276acb894f2c89c2b6c1f2d56 не принят для выпуска. Linux run45009215076/attempt1/job137167552064 завершился отказом второго resize AI preview: rounded/dark,dy+40, после успешного rounded/light,dy−40. Assertion не увидел trusted pointerup в единственном snapshot после двух requestAnimationFrame; matching trusted pointerdown и native calls до него прошли. Неуспешный receipt ранее добавлялся только после assertions и отсутствует в артефакте. Это не устанавливает потерю OS release или production regression.

Mac run45009214966/attempt1/job137167551530 завершился ReferenceError:path is not defined в mouse-622-smoke.cjs:39: сохранённый favicon read использует path.join, а импорт node:path ошибочно удалён вместе с Agent. До этого прошли опубликованный636 baseline, retained636, текущие owner/performance и637WRITE/READ. Это частичные результаты неуспешного Mac run. Windows45009214976/attempt1 primary137167590829 прошёл нативную проверку; modern137171180129 ещё выполнялся на момент этой записи. Даже его успех не устраняет отказ Linux/Mac и нижеописанный дефект доказательства cookie.

| Оригинальное доказательство8a | Размер,bytes | SHA-256 |
|---|---:|---|
| Linux verification artifact14749521561 |27594618|`bba6464c64901c26a23095dd015f9dc8922accd0c876eb863f23cba71cf1bcef`|
| Linux decoded job log |706831|`e3afbf5d627696454db6c4e0d39d73a8021e756656627d653746eb8d22ca805b`|
| Mac verification artifact14749686464 |64992544|`d9f39934dd3a13bc0512f1d9c4ec6329a4956cad033451a1e0593cff05d7da23`|
| Mac decoded job log |1012463|`db0f4914927425042cfb3ea8b00cbdae11adb44eb2f73c114cc4fd16f68610c1`|

Root заново сверил оба archive SHA и оба исходных log SHA. Отдельный независимый reader publisher98a32f90a999c9619f55fe8ffd1d35fc35b86514 правильно отклонил actual Linux removal report: owned fixture state missing. На /201 и /202 cookie был пустым до/после, потому что неизменённый pageHTML выставляет Path=/page/{index}/. Ошибка producer не исправляется ослаблением frozen N.identity. Отчёт именно об этом отдельном отказе SHA256875f5d6fb84ec5a300d81dd4dfd4cb94c8dff43e7dd986532b254e3654dc43ef; это не full acceptance.

Исправлены три конкретные области:

1. Возвращён только node:path import в622. Других оставшихся обращений к удалённым import bindings в35 изменённых smoke-файлах не найдено. Native predicates и действия сохранены.
2. Removal HTTP fixture открывает канонические /page/201/ и /page/202/, остальные routes возвращают404. Source теперь отдельно требует точный ожидаемый cookie, index и URL до/после и сохраняет прежний assertIdentity. Новый тест исполняет настоящий HTTP producer и исходный pageHTML script с объявленным cookie Path; старый8a воспроизводит пустой cookie, исправленный проходит9/9. Независимый current637 publisher использует прежний N.identity(before,after,origin), не меняя frozen cookie guard.
3. AI drag сохраняет попытку до первого native post и ожидает прежние matching trusted down/trusted up через существующий bounded fixture.until до удаления listener. Сохранены один down,12moves с20ms и один finally release, прежние predicates, UI, driver, hit-target, frame и global deadline. Raw events и ошибки сохраняются при отказе; late cleanup event не превращает timeout вPASS. Actual-helper delayed-release regression падает на прежнем one-shot snapshot и проходит после исправления; missing/untrusted/wrongtarget/driver/cleanup failures остаются rejected.19/19 адресных тестов прошли. Причина исторического Linux8a отсутствующего pointerup всё ещё не установлена.

Независимый review всех трёх изменений завершён PASS. Root повторил полный Mouse unit enumerator:1201tests,1197PASS,0FAIL,4native-platform SKIP,10.586685362s; log SHA256d19536554e7d449c7558b75f330e5464491b9e2433821280f7ee62668647d518. Пропуски по-прежнему требуют реальных платформенных native модулей. Cookie RED log8f27a410a8c726438656a4809689bbfbaff325c80081b7bf8c406051e3ef3a9e; GREEN logd76bf6914839c1ad5f14d38ef48523a5d947df9e9ec061c3ac54ab5d7a405c48. Source diff check и syntax прошли. Готовится новый общий source commit и новые native runs; прежняя частичная приёмка8a не переносится, все pins неготовы, публикации нет.


## 2026-11-22 — be86: Linux принят, Mac остановлен на реальном обновлении 636

Общий source `be86c86653783f29951fdfb378aa0259837cd1d2`, tree `71315ce31f948fdc4584d969912893260820cc89`, parent8a. Publisher `ae72af72836b766b9b04ee883e251c93294db3f2`, tree `8026d611ffa7e02ed6589977bb03da28b427aaba`, parent98. Все8 вспомогательных source workflow и все5 publisher contract/registry workflow прошли; native publisher jobs пропущены при unready pins. Root publisher units119/119 PASS,0SKIP. Публичный выпуск этим не подтверждён.

### Linux be86: полная нативная и независимая приёмка

[Run45010898422](https://github.com/jeep-jim/OSMINOG/actions/runs/45010898422), attempt1/job137172777321 завершился SUCCESS10:17:35 UTC. Полный offline independent helper исполнил неизменённый ae72 на настоящих AppImage/DEB и исходных raw: ok=true.423 tracked publisher tools/staging файлов связаны с Git до/после,433 raw verification файлов. Cookie-scoped /page/201/ и /page/202/ содержат точные непустые cookies; все4 AI resize cases имеют trusted down/up без input.error.

Candidate14750495110:228453582 bytes, SHA256 `b5f264a8fb8b045ece43cd12c78bba42444d8a65abb42135a7851958dac2d146`. Verification14749983107:39492551 bytes, SHA256 `f8361ce4809d674a2beaee942e5072bbd17662254f40d860b54c0a4623d3bb79`. AppImage127838280 bytes/SHA256 `0580de679cf2bf04a4c12dd5c703636089dd1c859030e8bfdd636549514434b4`; DEB101114080 bytes/SHA256 `c6004776b23322dd43b348d61f37d4c6d8c75ce58e404d6b6a966a0e13589629`.

Independent report279692 bytes/SHA256 `4755755ab45ea2232d59ff67c06c245578fa8ca3c3af05acbe0ae989e246b4c3`; combined provenance41701 bytes/SHA256 `df24c17522f6ec7069d293add4f9dd0b6e5bebbce9d181e8d874861acac96e88`. Root отдельно пересчитал оба ZIP, actual package bytes, report и raw API files и сверил exact run/attempt/job/source. Приёмка относится только к Linux be86, не к будущему source.

### Mac be86: сохранённый отказ и видимая геометрия

[Run45010898616](https://github.com/jeep-jim/OSMINOG/actions/runs/45010898616), attempt1/job137172777623: installed step17 FAILURE10:22:34 UTC, job завершён10:22:49. Текущие и retained browser checks, general WRITE/READ,622/624, normal/close/private прошли; заключительный actual-published636 update-button остановился на первом `#version-button`: `trusted update click #version-button: undefined`. Profile WRITE прошёл; candidate upload пропущен. Это не полная приёмка Mac.

Verification14750451118:66675347 bytes/SHA256 `f9922e44bda77bfc652ee4bc354a4e891f611d8647f0529214f555ec9823767f`; CRC652 ZIP entries проверены. Полный job log1045926 bytes/SHA256 `dc7e2c18467e698e066bf3107087098d1cd87fd011b496d6764262edb0d0e09a`. Raw native report4276 bytes/SHA256 `0efdd9c00b6d1fdd2f4534d6f6faad1d15998a9a7e1e5150bef5a27deca40620`. Root и два независимых чтения подтвердили исходные байты.

Raw фиксирует один CGEvent click в(1347,915), owned636 PID41177, native window{x:80,y:-31,width:1440,height:960}, foregroundVerified=true, stage=predecessor-startup; captures и fixtureRequests пусты. Девять current geometry reports этого же run фиксируют display1600×900, workArea{x:0,y:25,width:1600,height:802}. Точка y915 ниже записанного дисплея. Helper проверял только point внутри owned window; DOM hit проверял viewport. Live display sample непосредственно при клике не сохранён, поэтому точный механизм OS delivery и физический Mac владельца не объявляются доказанными.

Exact опубликованный636 mouse-main задаёт окно1440×960/min800×600. В CI driver перед первым DOM target отсутствовала подготовка размера окна к рабочей области. Узкое исправление готовится только для owned predecessor Mac window: live workArea fit/readback и свежая видимость native point. Не менять опубликованные636 bytes, updater/installer, настоящий CGEvent, trusted click, число вводов, deadlines или profile preservation. Window geometry не входит в проверяемый профиль; cookies/storage/bookmark/tab/theme/widths проверяются по-прежнему.

### Windows be86 и дальнейшая граница

[Run45010898421](https://github.com/jeep-jim/OSMINOG/actions/runs/45010898421), attempt1: primary137172806187 SUCCESS10:25:10 UTC; modern137177188114 начался10:25:12, installed step10:25:28 и на момент этой записи ещё выполняется. Полной Windows приёмки пока нет.

Publisher ae72 можно сохранить побайтно: его current helper fetch уже проверяет Git blob exact tested source; additive geometry fields не ослабляют существующие проверки raw report hashes/bindings (новые JSON bytes хешируются заново), три обязательных trusted clicks, native process/window/foreground, stock install/relaunch и old/new profile gates. Новый source всё равно требует собственных трёх платформенных запусков и полной независимой проверки actual packages. Pins остаются false/null; merge и публикация не выполнены. Неизменённый Mac rerun не запрошен.

Полный source PR193 body на be86 (63047 characters, updated_at2026-11-22T10:27:22Z) сохранён в [архиве PR193](2026-11-22-mouse637-pr193-history.md), чтобы текущий статус PR можно было сократить без потери истории.


## 2026-11-22 — проверенная подготовка окна Mac; кандидат поверх be86

Исправление ограничено `tools/mouse-637-update-button.cjs` и его unit test. Только для darwin в уже проверенном installed636 main используется `__mouse637Button.win`; снимаются live matching display/workArea, window/content bounds, minimumSize, режимы и zoom. Окно при необходимости выходит из fullscreen/maximized и вписывается в рабочую область без снижения минимальных размеров. Слишком маленькая область — отказ. После setBounds прежний bounded until проверяет actual bounds и два renderer RAF; перед каждым из трёх исходных кликов nativeHitTarget выполняется заново, а live geometry/viewport/point повторно проверяются. Координаты остаются Quartz points; нет умножения на scaleFactor, переноса точки к иной цели или replay native input.

Additive windowPreparations/geometry receipts сохраняют before/normal/requested/after, последнее наблюдение и цель, в том числе при отказе. Исходные transport/injection/ownership, inspector, глобальный300000ms budget, until/native wrapper, один native post и trusted-click predicate на selector, Install disconnect, stock download/install/relaunch/profile tail сохранены побайтно. Девять связанных source файлов, включая production main/updater/installer/native driver/profile probe/hit-target, не изменены. Windows/Linux используют прежнее вычисление native point.

Independent review PASS. Автор и root независимо исполнили28/28 tests PASS,0SKIP на фактическом local Node24.22.3. CI Node22/native acceptance ещё обязательна; локальные OS adapters явно синтетические. Root отдельно подставил exact git-be86 helper24046 bytes/SHA256 `a8fa204ec64047b44dbe1c1ce81daa27820bfe156af4d810c3f38405a4dff1cc` под тот же actual nested-path regression: ожидаемый RED1/1 с `trusted update click #version-button: undefined`, logfile1235 bytes/SHA256 `bc49b7853a1650821ffb1ebe43dbd611bed828e26ca4c344bb9e8b25c3f14864`. Root GREEN log3142 bytes/SHA256 `2567020bc6c4a69e8584de643c672b0d0e4c394a5a644aa2483e737c09111637`. Author GREEN/invariants JSON2491 bytes/SHA256 `d51f14e0d0083641264cb3df11ac78aabe34059c32ba117eafb5c61fc443eb8c`; его отдельный GREEN log SHA256 `2812e7fc9897fc1b64c8b920b67384564e12e7d88583b287af485d52b86225b6`. Syntax и diff checks PASS. Никакого повторного CI/native baseline запуска для unit RED не было.

Замороженные изменения: helper33012 bytes/SHA256 `4ee35c839768182099288556197ba60c3235d6e276c5152b1dc17b62b40b54be`; test23242 bytes/SHA256 `dacf4cb9a6cb42d655a9b1eaca3f0ee829e6c761a1de6995514b7125b36d1fd0`. Полный diff — эти2 tool files,2 append-only журнала и архив PR193. Product/runtime, native driver, сайт и publisher ae72 не меняются.

Перед новой branch update обе Windows be86 native jobs завершились SUCCESS: primary137172806187 в10:25:10 UTC; modern137177188114 в10:41:01 UTC (installed step10:25:28–10:40:52). Root сверил raw attempt1 jobs API. Be86 independent actual-EXE sweep ещё выполняется отдельно. Новый source не отменяет законченный Windows attempt и не наследует его приёмку.

Новый common source должен пройти свои Mac/Linux/Windows gates и actual-package independent ae72. При публикации остаются обязательными exact-source merge/provenance, три готовых pins и свежие native publisher/public updater gates. До этого pins остаются false/null и37 не объявляется опубликованной.


## 2026-11-22 — source 002 принят на трёх платформах и объединён; публикация проверяется отдельно

Проверен один неизменяемый source `0021084ccb9537e657d21e6f0c8e812dee6b461f` (tree `4df6d9bf066ef230fca2fa1c16079e32c393055e`). Все восемь вспомогательных source workflow и три платформенных workflow завершились SUCCESS. Полные независимые проверки настоящих пакетов выполнены неизменённым publisher `ae72af72836b766b9b04ee883e251c93294db3f2`; root дополнительно пересчитал архивы, установщики и отчёты, сверил raw API run/attempt/job и чистоту checkout. Исторические результаты be86/8a не используются вместо приёмки 002.

| Платформа | Source run / attempt / native job | Фактические пакеты, размер и SHA256 |
| --- | --- | --- |
| Mac Apple Silicon | [45013817897](https://github.com/jeep-jim/OSMINOG/actions/runs/45013817897), attempt 2, job 137186893064 | DMG 130545757 bytes, `3c8d727eabcec91c4893f94762b6834080344e35320edaaf1f7555bf407ae1a2`; ZIP 130555936 bytes, `f4c67a7e710060f2e4466d0f47c1bd707edd6841c9d5b50826d133cc66adb393` |
| Windows x64 | [45013817864](https://github.com/jeep-jim/OSMINOG/actions/runs/45013817864), attempt 1, primary 137181713767 и modern 137186174835 | EXE 113416843 bytes, `19487826aa51b2027d5a4d497529be62a5e2180402ea24e5d700da48f4cd0e35` |
| Linux x64 | [45013817844](https://github.com/jeep-jim/OSMINOG/actions/runs/45013817844), attempt 1, job 137181713751 | AppImage 127838276 bytes, `e35d46095d2bf8617fc981ee8f41b5bbe885ed8de4083cee4b890e45ade4bf79`; DEB 101113500 bytes, `4518bad5c606ec5dca98c62c7d624aa3df6f0b906713fb6a40cb317877008c66` |

Полные independent reports: Mac `f8c7d46cc5e0a7f6a59c48fe2bc3e407cb3c14d1aa74acadef3135459856bb92` (266 Git-bound Python verifier blobs, 672 evidence files); Windows `36af4a3fef8d2f653ccd7c41ecc71980813d8231cf5f54eebe6cbab88110a133` (423 bound publisher files, оба native задания); Linux `4326bb94d9fb25336d076016632a5f29e3ea428c81b42af29766d5e400fd1558` (423 bound publisher files, 433 raw members). Объединённый индекс принятого source: SHA256 `b3c25e08c3ffe7ea2d4c34e8572ee06b365a545595764ed5fd2312d03d54cc49`.

### Сохранённый Mac attempt 1 и ограниченный повтор

Тот же Mac source run, attempt 1/job 137181713642, остановился в general READ на `Mouse628 motion timeout: restarted Nora opens`; update-button helper ещё не запускался. Первые четыре capturePage promise завершились через 2974.505–2997.834 ms при неизменённом deadline 2500 ms. Verification artifact 14751595580 сохранён целиком: 66442662 bytes, SHA256 `133f04f1fbea368cb2ee388d3f0dabdc1df32b3f31aeb127ddd380c1ec39e83e`; raw job log SHA256 `950c2b4f3cef5c918a1efb934f8610821bbaa7480ab80f99c40d0e79d96ad2d3`. Причина задержки не установлена; успешный повтор не объявляется её исправлением.

После независимой проверки raw/кода выполнен ровно один контролируемый повтор неизменённого source и workflow. Attempt 2 полностью прошёл: Nora restart 1248.995 ms, первые четыре захвата без backoff; полная нативная и независимая приёмка завершена. Candidate artifact 14752416690: 260569921 bytes, SHA256 `069ae9df93b148e42b60e71c312f04698e3255b1d15913406a5ec5efc9138f10`; verification artifact 14751923174: 67013992 bytes, SHA256 `b6a1468b641ede8e883539fe7ecd94bf71d503244b15d606ac7221fbe7548cca`.

Установленный настоящий 6.0.36 в attempt 2 получил окно (80,25,1440,802) внутри снятого workArea (0,25,1600,802), сохранив minimum 800×600. Последующие две подготовки не требовали команд изменения окна. Ровно три CGEvent/trusted-click пары попали в актуальную видимую геометрию: version (1347,813), download (631,595), install (656,576). Старый PID 68965 сменился новым 69624; завершение штатное, inspector отключён до Install, профиль равен. Отдельный переход настоящего 6.0.29 также прошёл. Проверен runner, а не физический Mac владельца.

### Фактические merge и начало отдельной публикационной приёмки

[Source PR #193](https://github.com/jeep-jim/OSMINOG/pull/193) объединён как `e6e27b26ae719f50beeb5a2244dc6d2c6ddcdab1`, tree `ae5015b493ba74a078b5d13067ddd21ad7ed32b4`. Product/tools и три browser workflow побайтно соответствуют принятому 002; параллельная история main сохранена. Исходная feature-ветка остаётся на 002, чтобы importer мог проверить точный PR head.

[Publisher PR #66](https://github.com/jeep-jim/OSMINOG-Releases/pull/66) получил готовые три pins/owner markers в `edf49fdf8e8c70b62d03c8c8a02a6a00997b7985`; ровно 10 файлов metadata/history изменены, 4123 остальных tracked files, включая алгоритмы/workflow, остались ae72. Локально 119/119 tests, три template checks и три publish plans прошли; все пять exact-edf CI checks прошли. PR объединён 11:42:01 UTC как `a464a5398fa7afca55e1b1116ff8510895ae488f`, actual tree `856121dc303c5a49bd6b3b5bdb0a2792a6859577` совпадает с проверенным. Полный прежний PR66 body сохранён в `docs/mouse/2026-11-22-mouse637-pr66-history.md` publisher repository, SHA256 `f1bb455be81bc0cc089827be2286ae0b21a4d653cc8d3e76eb6b4cec9b1ed50f`.

На merge a464 запущены отдельные свежие publisher native jobs: [Mac 45018600669](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/45018600669), [Windows 45018600697](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/45018600697), [Linux 45018600676](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/45018600676), attempt 1. Все три contract/import gates прошли. Linux job 137196383804 завершился FAILURE 11:47:33 UTC на свежей installed-проверке; publish и channel пропущены. На 11:48 UTC Mac/Windows оставались в свежей native-проверке. Linux raw evidence сохраняется для диагностики; повтор, обход gate или ручной сдвиг feed не выполнен. На этом этапе публичная 6.0.37 ещё не объявляется выпущенной.


## 2026-11-22 — первые publisher отказы сохранены; Linux environment correction и один контрольный Mac repeat

### Linux: подтверждённая недостающая зависимость

В a464 / [run45018600676](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/45018600676), attempt 1/job137196383804, импорт принятого source прошёл, затем свежая проверка остановилась на `FileNotFoundError: [Errno 2] No such file or directory: 'xprop'`. Actual636 update-button report: predecessor-startup, nativeInputs пуст, helper завершился за69 ms. Root независимо подтвердил raw API, архив и логи (15 checks). Исходная source CI устанавливает x11-utils; Linux publisher его пропускал. Это подтверждённая ошибка подготовки runner до первого клика.

Original artifact14752034476:3068715 bytes, SHA256 `adf90ffe4901dd907521aa2bc2969e1ba921387605eca7ef0d3a6a2e6e2d253a`; 94 entries, CRC/safe paths проверены. Job log54175 bytes, SHA256 `98b02c8903f3418b28bd7d459c6166cf222ac17dc22da4569f2067a151d7df18`. Root failure review SHA256 `211c45554b34cc54144b13b6574bd81a968ec7ada04b6409b8b9963785ba23ed`. Publish и channel пропущены.

[Publisher PR67](https://github.com/jeep-jim/OSMINOG-Releases/pull/67) добавляет только x11-utils в прежнюю apt-команду, адресный contract test и append-only Linux staging journal. Старый workflow даёт ожидаемый RED на отсутствии пакета; новый проходит3/3. Полный suite122/122,0SKIP; root отдельно проверил старый RED, новый GREEN, единственное изменение команды и отсутствие правок pins/validators. Все пять PR workflow на `5df1f8828d7efa0c3e0c19c78ce7080a6636e7f8` прошли. Merge11:56:36 UTC: `77e9a865981870803e9a742a6f18cf6883562ec3`, actual tree `5e85ec13216214282bb29a08af3bd77967081e3d`, parents a464+5df; дерево совпало с reviewed tree. Native helper, source002, пакеты, ownership/input проверки и deadlines не изменены.

Новый Linux [run45019759421](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/45019759421), attempt1/job137199943415, запущен на77e9; contract137199821498 прошёл. Mac/Windows workflows этим Linux-only merge не перезапускались. Полная новая native/public/channel приёмка ещё требуется; предыдущий Linux отказ сохранён отдельно.

### Mac: отсутствие trusted guest click, причина не установлена

Mac a464 / [run45018600669](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/45018600669), attempt1/job137196413712, завершился FAILURE11:51:15 UTC; fresh installed step6 отказал11:51:04. Exact package import прошёл. В текущем установленном6.0.37 retained pane-download scenario первый #download-a не получил trusted DOM click: CGEvent post true, point(104,252), затем за исходные10s events=[]; guest focus к отказу стал true. Target/window видимы внутри display/workArea, bounds стабильны. Source002/a2 при тех же recorded geometry/focus/hit/factor получил trusted receipt через46 ms. Клик не относится к ещё не достигнутой сцене обновления636.

Original artifact14752649465:5259071 bytes, SHA256 `151217a8aa06063df577ba13924bbb65c6e3352ae7813c13099eb551008f7af7`; 76 entries, CRC/safe paths проверены. Job log40340 bytes, SHA256 `36ef64d61f95a8b2d01a6cbe29adb000343d922f774321895b01c985f72c2db8`; raw retained receipt SHA256 `160884929402fd9e7acb4e4edbc66da394029e00b69db36e8f583caf7e39b7cd`. Root review24checks SHA256 `83397d4989d4672479b2e67f5b7c4eb3a1db40e831a6d7ee2aa60264f7f9d115`. Независимые comparisons SHA256 `96c1878bf5cc83323e8178651f3531c4f3435649880e96b8b47743cb9cf3c904` и `0ab8f1ff1366800ef1bc295e20cbb85a123f28befab40bc6b83838b5187f72b3`.

OS/image/Node, target и17 сопоставленных click/geometry/focus полей равны успешному source. Прямого installed app.asar/native-module hash receipt в failed artifact нет: установленный bundle связан через exact imported package и завершённые codesign/cmp до mouse-verify; отдельный прямой хеш установленной native .node не выдумывается. Cursor/driver return/final focus не доказывают полный AppKit/Electron/DOM путь доставки; конкретная причина отсутствия события не установлена. Public publish/channel шаги пропущены.

После сохранения raw, root review и двух независимых сравнений заранее разрешён ровно один полный повтор неизменённого Mac native job для проверки воспроизводимости. Decision SHA256 `693b4a5eaf136d48abc4611084882d187ee960800131c39e7bf823b1d51429ac`. Attempt2/job137200371109 стартовал11:58:59 UTC, остаётся наa464 с прежними source/packages/pins/validators/deadlines и одним native post на сценарий. Contract в attempt2 API имеетID137200372240 с исходным временем11:42:06 — прежний успешный contract не объявляется повторно исполненным. Первый отказ не удалён. Успех повтора не будет называться исправлением неизвестной причины; при новом отказе дальнейший неизменённый rerun запрещён, потребуется адресная диагностика.

На11:59 UTC исходный Windows publisher45018600697/attempt1/job137196437321 продолжал fresh native verification. Linux correction и Mac repeat требуют собственные полные terminal gates и публичные updater receipts. Ни один публичный выпуск этим промежуточным разделом не объявляется завершённым.
## 2026-11-22 12:24 UTC — Windows и Linux опубликованы; второй отказ Mac разобран

### Linux: фактическая публикация после исправления среды

[Publisher PR67](https://github.com/jeep-jim/OSMINOG-Releases/pull/67) объединён как `77e9a865981870803e9a742a6f18cf6883562ec3` после пяти успешных exact-head CI checks. Новый [run45019759421](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/45019759421), attempt1, native job137199943415 полностью прошёл в11:57:13–12:07:59 UTC. Импорт, свежий native installed/updater gate, независимое чтение raw, публикация и anonymous channel gate завершились SUCCESS. Исходный source002 и оба установщика не менялись.

[Публичный Linux release](https://github.com/jeep-jim/OSMINOG-Releases/releases/tag/mouse-linux-v6.0.37-x64), id454420474, опубликован12:07:39 UTC. AppImage127838276 bytes/SHA256 `e35d46095d2bf8617fc981ee8f41b5bbe885ed8de4083cee4b890e45ade4bf79`; DEB101113500 bytes/SHA256 `4518bad5c606ec5dca98c62c7d624aa3df6f0b906713fb6a40cb317877008c66`. Все5 release assets и обе static feeds соответствуют принятому источнику. Настоящий модуль обновления6.0.36 анонимно обнаружил и скачал оба формата; verifiedDownload/currentVersionCheck=true. Native update-button:3 trusted XTest clicks, oldPID4844→newPID5016,7234ms. Физическое устройство владельца не проверялось.

Fresh artifact14753886089:39668432 bytes,442 entries, SHA256 `1c1ace271f68626effa595df821f8212e874a9fc9ed443b68334f51a9a878b04`. Независимый fresh-reader прочитал411 raw files, результат побайтно совпал с recorded installed evidence; SHA256 отчёта `7823a69625c38bf72686cf91b48f56c5a7133e14a4e85149165bd84ab3d2e2a8`. Public independent report `3984d1e683b3e8088deb051e1528f1831cb95a0956b282db8d8f7e7703a0a051`; frozen provenance `e8c66634c655a84ff68a8c4088568a86b33f0d75f1a6af0786a2dd2325ecc86c`. Root отдельно проверил41 условие, все411 прочитанных файлов из actual ZIP, public API/feeds и updater receipts; root report SHA256 `fed053cdd13883694cfdc3f5b2d238384f1ce541f6e47030cd92c22abcc204df`.

### Windows: фактическая публикация исходного publisher

[Run45018600697](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/45018600697), attempt1, exact publishera464, native job137196437321 завершился SUCCESS. Fresh native step11:48:04–12:07:36 UTC, публикация12:07:36–12:11:27, channel12:11:27–12:11:37. [Публичный Windows release](https://github.com/jeep-jim/OSMINOG-Releases/releases/tag/mouse-windows-v6.0.37-x64), id454422642, опубликован12:11:26 UTC; unsigned prerelease. EXE113416843 bytes/SHA256 `19487826aa51b2027d5a4d497529be62a5e2180402ea24e5d700da48f4cd0e35` соответствует source002. Сам EXE, остальные3 assets и обе feeds независимо скачаны анонимно сHTTP200 и пересчитаны. Actual629 и636 updater receipts подтвердили static discovery, verifiedDownload и currentVersionCheck. Native636 profile replacement: oldPID7012→newPID5096; отдельный retained629 gate проверяет updater.

Fresh artifact14753691597:76398046 bytes,695 entries, SHA256 `02b0072e1abb0f232b3df59ac8bca157061ce49689d139e7f26891c6059931ac`. Независимое чтение396 unique raw files четырьмя прежними reader entrypoints прошло; fresh report SHA256 `bd19b5ce0fd0c2b4e1fc75d37c7689be8ae0001f9c2ac253e5ac843a45ca17b6`, frozen provenance `b78fdce7126eb07e7ebe13c1d7c3a24d13d8680dde00ad26be8881a8f0648b8f`. Public native report `62f2f01535e46252446a80676b546e2d841345da74e1fcd55225acb2749eeafb` действительно свежий, а не скопированный source report. Root60 checks включили пересчёт396 raw members из actual ZIP,6 скачанных public files, fresh API release/jobs/feeds и bindings. Root report SHA256 `1e08f7abd500ecb57292e131593a82c7a6da173cab600c8083089d2ebe679012`.

### Mac: единственный неизменённый повтор остановился до pin click

[Run45018600669](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/45018600669), attempt2, job137200371109, exact publishera464 прошёл прежнюю retained сцену со всеми7 trusted guest clicks, затем остановился12:06:36 UTC в `native-unpacked-extension`: `Extension action Закрепить`. Publish/channel/anonymous629 steps пропущены. Feature PID8975, enabled=true/pinned=false, последний ввод — успешный trusted click `#mouse-extensions-install`; pin click ещё не вызывался. Backend install добавляет entry перед await save/IPC response, а renderer строит кнопки после awaited response. Одноразовый DOM lookup теста не ждёт эту готовность. Точная DOM snapshot в момент findIndex не снята; отсутствовавшая строка или отсутствовавшая подпись отдельно не различены. Поздний failure screenshot показывает кнопку. Причина исходного attempt1 guest click loss остаётся неизвестной; успешная retained сцена во втором запуске не объявляется её исправлением.

Original attempt2 artifact14753826283 сохранён:28503762 bytes,288 entries, SHA256 `482c10350ac8e0e57e65cde636c8b51e63cfd3cf62a77d4777c3767faf2eeb9d`; job log `1961043427a980d3289d1b9ffda502ff134f18e5b6aa1df837fb2fe1203719c7`, API provenance `e3957afa4e0ba3923a24f9eefda85a35067d5deb1cc258d939126f835791664a`, readiness diagnosis `321ffd97ce70a2d96d6384b6a0a94a33d143a93480e64ce2004bc18bff95836c`. Больше неизменённых повторов не разрешено планом проверки.

Подготовлено отдельное publisher-only исправление CI readiness; на момент записи оно ещё не принято и не запущено. Публичные Linux/Windows6.0.37 packages и source002 остаются неизменными. План: внешний проверяющий адаптер с привязкой к точным hash source002, реальному owned Electron PID/profile и однократной заменой только CI-функции `extensionButton`. Две bounded observations ждут реальную keyed ID+label до прежнего native click и, только для «Закрепить», прежний renderer count1 вместе с «Открепить» после него. Product/runtime, on-disk app bytes/signature, native/trusted actions, persistence checks, общий deadline и все независимые source=False gates сохраняются. Review и actual native/public приёмка исправления ещё обязательны. Сайт и АвтоЦена не затрагиваются.


## 2026-11-22 12:40 UTC — внешний Mac readiness driver принят; начат новый полный publisher

[Publisher PR68](https://github.com/jeep-jim/OSMINOG-Releases/pull/68) реализовал описанную выше CI-only коррекцию: ровно12 файлов — Mac workflow, append-only Mac README,3 новых verifier tools,2 tests и5 побайтно точных source002 fixtures. Исходный `mouse-verify.py` исполняется неизменённым; только два feature process получают асинхронный Inspector bootstrap, реальный Popen/PID возвращается сразу. Однократный loader меняет только `extensionButton` на два bounded renderer observations; original/adapted SHA сохранены. Сервер Inspector закрывается до первого ввода, исходный loader восстанавливается до compile. Atomic receipts публикуются через exclusive hardlink, partial JSON и перезапись результата исключены. До/после проверяются неизменность executable/ASAR/ровно двух native addons и strict codesign; новый additive gate обязателен перед прежним `source=False` publish.

Независимый реальный Node Inspector опыт обнаружил пустой callFrame.url; теперь используется известный scriptId из scriptParsed с точным путём и отклонением конфликтующего прямого URL. Адресный тест использует Unicode/space path как в Mac installer. Отдельный опыт исполнил настоящий исходный `run_logged`: budget80ms завершился через81.071ms при ещё заблокированном sidecar. Это протокольные/синтетические проверки, а не native Mac acceptance. EnableNodeCliInspectArguments подтверждён по фактическому Electron Framework принятого ZIP. Все5 fixtures root сверил с Git002, все12 файлов — с author frozen hashset `c96d993df0b3fe0441935b53ae2c685c65cb7bd05b2892fd8bedd77890051f1b`.

Root полный Python suite130/130PASS,0SKIP, logfile SHA256 `997aa0508f78ae4d7eff0c0f80efda18169aecb5f2b2ae8c317c4b5ecda459e1`; CJS12/12PASS,0SKIP, SHA256 `babdbf4d431be9c1d690845dd0ce1251e5abccf8b9a44638581285b3de0e022b`, localNode24.22.3. Два независимых final review PASS: scope `6c3e6a884feeab60168dc623f13e9432190fa77b27205e3c463667e56bbca997`; bootstrap `5ebae3fac82f7694291a05385ab4967adfd28ecbfe68239467e580b85e390aa6`. Все5 PR workflows на точном head `129c7a3f3cd2e4c3166e25703015912e20aee7e6` прошли: Mac45023246715,Windows45023246717,Linux45023246754,registry45023246734,integrity45023246739. Actual Mac contract log подтверждает Node22.23.5,12CJS и130PythonPASS; SHA256 `b2fa5cd8dae104a9dc624d99b897ef4004dc0fa883584f1acd72a85b194337aa`. PR native jobs штатно skipped.

PR68 объединён12:39:00 UTC как `534f93defd61064ca0cbd8bc40fc670466bf9f42`, actual tree `0c9a23d5e958af833f5a4465275da95c1701657f` совпадает с проверенным. Родители — freshmain `0b30ab3f16ac2abe72c8cc857665bc0afe2447a0` и129c; оба опубликованных Win/Linux feed сохранены. На merge запустились только Mac publisher и две registry checks. [Новый Mac run45023380889](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/45023380889), attempt1, contract137210963288SUCCESS; native job137211122777 начался12:39:43 и на момент записи импортирует неизменные packages. Это новый исправленный verifier run, а не ещё один неизменённый повтор. Все original installed/native/profile/public/anonymous gates остаются обязательными; публикация Mac ещё не подтверждена.


## 2026-11-22 12:46 UTC — Mac 534: отказ нативного клика до адаптера проверки расширений

[Run 45023380889](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/45023380889), attempt 1 / job 137211122777, exact publisher `534f93defd61064ca0cbd8bc40fc670466bf9f42`, завершился FAILURE. Step 5 import прошёл; step 6 installed verification отказал в 12:46:25 UTC; steps 7 publish, 8 channel и 9 anonymous629 пропущены. Step 10 сохранил [artifact 14755395782](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/45023380889/artifacts/14755395782): ZIP 5249434 bytes, 79 записей с проверенной CRC, SHA256 `e2799402acb9a665ac8a1854e4e5e7b5e812a8fbe3705800e3687cc8d43deba7`, совпадающий с API и upload log.

Baseline опубликованной 6.0.36 прошёл. Кандидат 6.0.37 / PID 7809 остановился в `pane-download-widgets`: `Mouse631 owner636-retained timeout: 634 trusted guest link #download-a`. Первый CGEvent post в (104,252) вернул true, но последний poll через 9984 ms содержал events=[]; к отказу guest получил focus. Hit/window/app readiness были true, bounds/visibility/attachment стабильны. Те же подготовленные координаты и focus наблюдались в source 002/a2 и a464/a2 с успешной retained сценой, а также в a464/a1 с отказом. Эти наблюдения не устанавливают причину потери клика.

Wrapper summary сохранил `launches: []`; feature Inspector/bootstrap и трансформация ещё не выполнялись. Контрольные суммы и размеры actual installed executable, app.asar и обоих native addons до/после соответствуют принятым ZIP members source 002; сам ZIP повторно связан с frozen pin. Strict codesign receipts до/после имеют exitCode 0 и привязанные исходные логи. Исходный verifier и критерии не менялись. Отчёт 41 read-only checks: `mac637-publisher-534-attempt1-failure-review.json`, SHA256 `03e52427a448f9308a1172ce5733e7a59199263773b75e0f8d1ea85ef07622a4`; original ZIP/API/job log сохранены отдельно.

Исследование нативного ввода продолжается; AppKit/Electron/DOM down/up trace этим архивом не получен. Следующий неизменённый rerun не выполняется, новой product/harness правки без диагноза нет. Публикация Mac остаётся заблокирована; Windows/Linux 6.0.37, source 002 и все принятые packages/pins сохранены. Исправление зависаний на физическом Mac владельца не утверждается.


## 2026-11-22 13:42 UTC — исходный retained-сценарий прошёл; пассивные записи проверены; performance остановил Mac

### Publisher-only изменение и проверки

[PR69](https://github.com/jeep-jim/OSMINOG-Releases/pull/69): head `e047949560bf49176357bc001a1401bbddefcf4e`, parent `534f93defd61064ca0cbd8bc40fc670466bf9f42`, tree `ac2b785f3aea147f77d1816192f2248759baee86`; merge `42be73f12c7aa4bf02393629ed3f32d6a4471d5f` в13:32:45 UTC имеет тот же проверенный tree. Точный scope11 файлов: Mac workflow, append-only staging journal, одно прежнее workflow assertion, три observer tools, три новых tests и две exact-source fixtures. Root26/26 JavaScript и142/142 Python PASS, без пропусков; actual PR CI Node22.23.5 также12 прежних+14 observer JS и142 Python PASS. Все пять exact-head PR workflows завершились SUCCESS.

Outer wrapper наблюдает только один retained636 процесс исходного verifier002, возвращает настоящий Popen/PID немедленно и вызывает неизменный feature-readiness wrapper. До resume сохранён raw lsof для единственного loopback listener и проверен spawned PID; полный runtime повторно связан в main frame. Единственная in-memory трансформация exact retained module сохраняет исходные native calls/receiver/arguments/return, focus, predicates, waits и240s/270s budgets; loader восстанавливается, Inspector server закрывается до fixture input. В bounded reports записываются owned WebContents/window/DOM события; mutating native state() не вызывается. Source002, pins, shipped packages, старые feature tools и все исходные release gates не изменены. Дополнительный checker обязателен перед publication и не заменяет прежние readers.

### Фактический новый запуск и сохранённый отказ

[Run45028047196](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/45028047196), attempt1, native job137225477564; contract137225270914 SUCCESS. Import step5 SUCCESS; installed step6 FAILURE13:42:46 UTC; publish/channel/anonymous629 steps7–9 SKIPPED; upload10 SUCCESS13:42:49 UTC. Это единственный новый instrumented run после PR69; unchanged rerun не выполнялся.

Original artifact14756708501: ZIP27,585,564 bytes, SHA256 `a334ed4b05bac94b7ae441012391bf1bb732f1383294cb511197342cb113a65b`; все288 файлов CRC-проверены и побайтно сверены с извлечением. Raw API25,910 bytes SHA256 `419b8d0a4453ae22072ebdccb384a808a45edc838d6d771236832d118286b9f8`; полный job log67,124 bytes SHA256 `c68f159085d25407f9cd4b5a06d8e7c9ec527c75372581062b5e303f95309851`. Failure provenance307 checks SHA256 `062c9e913684bcf8e4e70fd575ceb9b11d70d5caa185fa0196eb8ed1a4c00822`; отдельный root ZIP/performance review SHA256 `fa6f7c777ee5330720579cc509d7cf1f6939c205cad4aad26c34f2bae334cb6e`.

Original retained PID8716 завершился PASS, exit0/32025ms, restored:true. Limited independent raw review подтвердил25 исходных native posts, семь original trusted guest clicks,25 соответствующих owned DOM clicks,578 records/7documents/6WebContents; dropped/errors/malformed/foreign/unowned counters0. Для первого #download-a записаны WebContents mouseMove/down/up и отдельные trusted DOM pointerdown/mousedown/pointerup/mouseup/click. Actual controller8720 завершился exit0/setup4574ms; sole OS listener принадлежал8716; loader restored, Inspector closed за3821ms до первого native post, observer disposed. Before/after executable, ASAR и оба native addons совпадают с accepted002; codesign0/0. Retained/observer review SHA256 `c8fe8ff24c40105b3b0520da526a15bce25dc5e657482bb562fdf2a6ad5d6cba`; отдельный transport/lifecycle review SHA256 `cab24c32a1f11bed2e3b5ddb7a42cd15f8638a316b27c50cf1ba875e45840b3d`. Это ограниченные факты данного failed run, не полная native acceptance и не доказательство причины прежней потери кликов.

Первый последующий отказ — owner637 PID11924, stage desktop-performance: `The median desktop switch exceeds the fixed predecessor plus one-frame budget`. Из исходных пяти20-page samples заново получены p50 предыдущей версии63.293458ms и текущей88.836417ms. Предзаданный допуск1000/60=16.666667ms даёт предел79.960125ms, превышение8.876292ms. Это фиксированный критерий, не оценка шума или фактической частоты кадров. Исходные десять50-page samples независимо пересчитываются в p50 baseline71.980792ms/candidate82.374959ms при пределе88.647459ms; p95/max также укладываются в250/600ms. Однако полный compareReports уже остановился на20-page assertion; строки50-page не означают принятую полную проверку. Raw arrays/calculation SHA256 `545562fb0e25c0690a89d35fad703387c7af1cb147b284450fe9794832c413c6`.

Общие feature/observer wrapper summaries честно ok:false; feature launches:[] — исправление renderer-readiness расширений ещё не достигнуто. Полный success-only source=False reader и additive verify на failed artifact не запускались. Причина нового превышения пока не установлена; сравниваются существующие main/renderer/process observations и прежние успешные performance samples тех же packages. Порог не изменён; Mac не опубликован. Windows/Linux остаются принятыми. Физический Mac владельца и причина ранее сообщённых зависаний не проверены. Лендинг развивается отдельно.
