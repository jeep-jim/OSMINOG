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
