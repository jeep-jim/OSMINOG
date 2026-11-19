# Mouse Browser 6.0.31 — задачи сайтов и несколько рабочих столов

## Прямое уточнение владельца, 19 ноября 2026

Владелец требует один исправляющий выпуск для Windows x64 и macOS arm64:

- Убрать автоматически появляющееся «Готово · Страница загружена · 100%».
  Пилюля предназначена для фоновой задачи сайта / ожидания ответа ИИ,
  а не для обычной навигации. Любой сайт должен иметь возможность сообщать
  действие, свой процент и своё оставшееся время. Нельзя подменять их временем
  загрузки страницы или выдуманным прогнозом браузера.
- Сохранить согласованное положение под адресной строкой каждой панели,
  реальные состояния скачивания, shutter/подтверждение снимка, цвета прожилок,
  Нору поверх страниц без обводки, внутренние жесты двумя пальцами / колесом,
  скругления и пользовательские сетки. Изменение столов не должно прерывать
  фоновые задачи, уничтожать живые страницы или перезагружать их.
- Исправить зависания, медленное переключение столов и повреждённую отрисовку
  при нескольких столах. Сообщённая владельцем нагрузка — около 20 вкладок;
  проверка должна также охватить 50 живых вкладок и пять столов. Сравнение
  владельца с Chrome — сообщение пользователя, не измеренный benchmark.
- Реализовать «DOOM / Дум» по ранее переданному сценарию DeepSeek. Доступный
  приложенный `deepseek_markdown_20261118_780b6c(1).md` прочитан целиком:
  3471 символ, 62 строки; это только бизнес-модель «Сырная экономика».
  Сценария игры в нём нет. Два адресных поиска предыдущего контекста,
  доступные source/docs/history и GitHub issue/PR search точный сценарий
  не восстановили. **DOOM_SPEC_MISSING**: без исходного текста нельзя
  заявлять реализацию именно согласованной игры или подменять её выдумкой.

## Проверенные исходные состояния

Общая база main: `717839f150b71ae0388433d41dbb71e7f781c898` (Mac 6.0.30,
включая PR174 и итоговый журнал Windows). Полностью принятый Windows-порт
взят из maintenance merge `57192416d0ba7e3078dd05667c968ebb40520b7a`
(exact source `164462db8d81f614cce9c9a8ab5d1fed0e2b7381`).
Локальное объединение выполнено отдельно от прежнего рабочего каталога;
обе истории, Windows native updater / DirectComposition и Mac 6.0.30
сохранены. Конфликты разрешены с сохранением обеих платформенных веток.

На момент начала этого исправления оба публичных канала имеют 6.0.29.
Windows installer и anonymous full-download уже приняты в
[publisher 44554901554](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44554901554).
Mac static channel прочитан напрямую: 6.0.29, опубликован 10:24:42Z,
DMG SHA-256 `665fca86eb86f1bd98bca4c72652fb5b0a981fc4f4c6467a66d0683874c6d57c`.
Mac 6.0.30 — существующая работа в source main; факт её публичной доступности
не следует из merge или прежнего сообщения ассистента. Старые release assets,
теги и каналы не заменяются другими байтами под прежним номером.

## Установленные причины и границы вывода

`mouse-progress-bridge.cjs` создаёт navigation task после 250 мс main-frame
загрузки, а `did-finish-load` завершает её строкой «Страница загружена».
Хранилище держит завершённую задачу ещё 2500 мс, renderer добавляет «Готово»
и 100%. Это напрямую объясняет ошибочную пилюлю на пользовательском снимке;
успешная загрузка документа не доказывает готовность ответа или отсутствие
ошибки внутри ChatGPT.

В пути переключения столов найдены повторное кодирование снимков и чтение
bitmap для проверок, которые обычный desktop-slide не использует. Изменения
метаданных скрытых страниц также доходят до повторного `applySide`/layout,
с обходом всех native pages. Это подтверждённые затраты кода, но пока не
доказательство конкретной причины всех пиксельных дефектов на устройстве
владельца. Реальный Nora pixel barrier, ранее устранивший дефект compositor,
сохраняется; проверка screenshot/motion не отключается ради успешного теста.

## Текущий статус

**IMPLEMENTING / NOT_PUBLISHED.** Версия нового кандидата — 6.0.31 для обеих
платформ. Нужны проверка task lifecycle, нагрузка 20/50 страниц, native UI,
сохранение профиля и настоящее обновление, затем отдельная публикация и
проверка публичного скачивания. Результаты этих проверок ещё не получены.
Физическое устройство владельца и внешние авторизованные аккаунты пока
не проверены. Следующие результаты дописываются ниже без удаления истории.

## Первый завершённый локальный кандидат

Навигационная задача удалена, стандартная progress/aria-busy разметка больше
не принимается за фоновую задачу. Канонический `MouseAgent.updateProgress`,
не перезаписывающий чужой namespace алиас `browser.setProgress`, Agent SDK и
явный `data-mouse-task` принимают процент, этап и оценку времени от сайта.
Остаток отсчитывается от полученной оценки; её истечение не завершает задачу.
Без ETA показывается прошедшее время. Завершение сразу убирает плашку,
ошибка/отмена сохраняют последний известный процент. Новый документ удаляет
старую задачу, а SPA/скрытие/смена стола её сохраняют. Глобальный предел —
64 работающие задачи, суммарно не более четырёх API/DOM-задач одного владельца.

Обновления metadata скрытых столов и текстов title/progress больше не вызывают
повторный native layout. Observer overlays сохраняет настоящие dialog holds,
включая гонку append/show до ACK. Обычный layout посещает выбранные/предыдущие
страницы; Nora сохраняет полный visibility barrier. Из обычного desktop-slide
убрано неиспользуемое полное bitmap-чтение, но Nora proof остаётся обязательным.
Кэш миниатюр ограничен 60 отделёнными bitmap до 400×400 и 16 MiB; JPEG кодируется
только по запросу. Страницы не выгружаются, background throttling не меняется.

На Linux Node24.22.3 общий Mouse unit gate: 757 тестов, **751 PASS, 0 FAIL,
6 platform-specific SKIP**, 5764.565524 ms. Отдельные focused progress/observer
проверки: 137/137 без пропусков. Новый независимый PNG/JSON checker: 12/12 PASS,
2.833 s. Windows outer verifier: 6 PASS, 1 Windows Authenticode SKIP.
Три новые регрессии сначала воспроизвели три отказа на старом progress-коде.
Базовый `npm test` в этом Linux-окружении упёрся в `listen EPERM` при создании
Unix socket прежнего MCP host; этот результат не считается пройденным gate.
Полный базовый набор остаётся обязательным в нативных CI.

Новые task/stress процессы изолированы от профилей retained suite и ограничены
300 s. Они требуют реальные OS PNG, 20/50 живых страниц на пяти столах,
сохранение документов/форм/scroll/cookies и продолжение HTTP-потоков.
Проверяющий код независимо декодирует PNG и проверяет ownership/геометрию,
таймеры, фактические пиксели и контрольные суммы. Его frozen SHA-256:
`0f6a0b0b53ea8c41399adec0e24225c7d869ac68aed612d5a28d4f3437f1003b`.

Windows дополнительно устанавливает настоящий опубликованный 6.0.29,
записывает профиль тем приложением и заменяет его 6.0.31 через NSIS с READ
новым процессом. После этого выполняется отдельная primary installation и
сохранённый фактический updater. Порядок учитывает один зарегистрированный
NSIS AppID. Mac сохраняет реальную проверку замены 6.0.29→6.0.31.
На данном этапе **SOURCE_NATIVE_PENDING / NOT_PUBLISHED**. Миллисекунды
ускорения, исправление всех дефектов устройства и готовая игра не заявляются.

## Первый нативный прогон — пакет отклонён, две ошибки новых fixtures

[PR177](https://github.com/jeep-jim/OSMINOG/pull/177), exact source
`174245ea3a894d6eb80e4ed758af43148f403de0`, tree
`633d6bf7b75ef3ac1e2862fc4597593d37541706` полностью совпадает с локально
проверенным деревом. Это общий head с двумя настоящими родителями main и
принятой Windows maintenance-ветки.

[Windows run44566783626 / job135710616690](https://github.com/jeep-jim/OSMINOG/actions/runs/44566783626/job/135710616690)
прошёл 176/176 base, 757/757 Mouse и 7/7 + 12/12 Python-проверок без пропусков.
Native compile и NSIS build прошли. Настоящий опубликованный629 записал
профиль (PID7064, WRITE146656ms),631 после замены прочитал его новым PID4120
(READ1531ms). Preferences, cookies, localStorage, bookmarks и закрытый файл
профиля сохранились. Новый TASK_ONLY_NATIVE_PASS завершён за11832.9241ms.
Root отдельно декодировал его настоящие PNG:15 task cases,2themes,3captures,
60pixelprobes прошли. Это успех компонента, а не всего кандидата.

После создания20страниц stress остановился на чтении
`MouseDesktopSlide.last.phase`: значение `last` отсутствовало. Code review
подтвердил, что `N.test` включён; ранний reduced-motion путь возвращается до
записи `last`. Исходная media preference в первом отчёте не была записана,
поэтому её конкретное значение не объявляется измеренным. Fixture теперь
явно задаёт no-preference в своём CDP scope, проверяет его, сохраняет исходное
значение и восстанавливает его в finally. Phase/animated/decoded, pixels и
identity gates не ослаблены. Четыре targeted restore/error tests прошли.

Windows artifact14552249183:10520658bytes, ZIP SHA-256
`9536d539efb20e82695d953d278120c9991948a1aaeb78120d184d3aa0f43728`;
скачан один раз, hash и CRC проверены. Candidate не создан, modern installed
job пропущен. Отдельный helper run44566783788 прошёл на2022 и modern:
по2/2 настоящих READY_CANCEL/PARENT_LIFETIME tests без пропусков.

[Mac run44566783860 / job135710618128](https://github.com/jeep-jim/OSMINOG/actions/runs/44566783860/job/135710618128)
прошёл unit/native/build шаги, но installed gate остановился раньше task pages
на эвристическом требовании workArea>=1000×700. Размер workArea в старом
отчёте отсутствует; его нельзя выводить из shell-only PNG1440×960. Новая
геометрия fixture должна исходить из настоящей workArea, минимального размера
окна приложения и видимости контрольных областей всех четырёх страниц.
Состав пиксельных и ownership-проверок сохраняется.

Mac artifact14554795203, SHA-256
`56178d0528b1220e9530f2d1faa8762cba973f59d1c6240e3650dda9feaf7171`.
Ни один первый source-пакет не принят и не опубликован. Следующий общий head
проверяет исправленные fixtures; продуктовые изменения после первого head
на этом этапе не добавляются.

Обе узкие fixture-правки завершены: размеры вычисляются из actual workArea и
`getMinimumSize()` без изменения минимума приложения, actual window/content
обязательно остаются внутри workArea, полная видимость областей определяется
неизменённым CSS78+34=112px и последующей проверкой их DOM/OS-пикселей.
Геометрия сохраняется до проверки и в каждом capture. Вместе с motion restore
новые8/8 tests прошли, syntax/diff-check прошли. Независимый review не нашёл
блокера; прежние pixel/identity/Nora gates и таймауты сохранены.
Точные Mac units первого run:176/176base;751PASS+6platformSKIP Mouse;
12/12Python; retained selected639PASS+2SKIP. Новая нативная проверка обязательна.

## Второй нативный прогон — воспроизведён дефект размеров кадра

Source `306a2ea2c395aef6986c8fd8e25059716690d360`, tree
`889f2787bd883c68f471ee4d2069a1aec129378f`, исправил оба fixture blockers.
В [Mac44571090518/job135726010376](https://github.com/jeep-jim/OSMINOG/actions/runs/44571090518/job/135726010376)
измерены display1024×768, workArea(0,25)1024×684, window/content(4,29)1016×676,
minimum800×600. Task-only прошёл. Из20живых страниц выполнены4animated/decoded
перехода; пятый desk5→desk1 остановлен `png-dimensions` для WC4/page0:
requested505×273, остальные3page captures завершены. Отклонённый PNG dimension
в старом диагностическом row не сохранён; прежний viewport505×245 нельзя
выдавать за размер этого PNG. GPU mailbox сообщения сами по себе не доказывают
причину. Artifact14555290146 SHA-256:
`ce0897a3ab594c26499a21faa50a449c25a995793d661e1499efbb88735530a2`.

[Windows44571090438/job135726011132](https://github.com/jeep-jim/OSMINOG/actions/runs/44571090438/job/135726011132)
прошёл176/176base и765/765Mouse без пропусков, настоящий629→631 profile и
task-only. Независимый task review снова прошёл15cases/2themes/3OS captures/
60pixelprobes. Первые4stress перехода прошли по40OS probes каждый, с временами
559.94/566.88/560.26/563.58ms. Это измерения контрольного сценария, не сравнение
с Chrome. Пятый incoming capture22 отклонён для WC4:requested505×295,
`png-dimensions`; прежний успешный outgoing был505×267, rejected PNG size
неизвестен. Нагрузка50ещё не началась. Motionbefore=true/normal=false/
restored=true; cleanup20pages прошёл. Artifact14554559188:11062414bytes,
SHA-256 `f51d5126aa8c8b8aa1a06e50dce6d38233830fa0e04b2219c16cd1b641644e03`.

На Windows OS-снимке четвёртого перехода root и verifier увидели повторный
заголовок page16 в полосе28px над документом; это отдельное наблюдение, которое
цветовые области ниже в странице не обнаруживали. Проверка видимой task pill
после переключения должна быть добавлена к независимому pixel gate.

Code review установил дополнительное изменение геометрии: slide выставляет
`desktopSliding`, incoming renderTree пересоздаёт pane DOM без task dock,
а обычный progress render откладывается до снятия флага. Поэтому incoming
layout измеряет страницу без28pxплашки, после анимации добавляет её и снова
меняет viewport. Исправление готовит уже известные owning docks до единственного
awaited incoming layout, сохраняя заморозку live updates и Nora hold. Кроме
того, native capture должен отбрасывать кадр другой геометрии и ограниченно
повторять съёмку при неизменных владельце/epoch/desk/viewport. Прежние2500ms,
8попыток, лимиты памяти и запрет масштабирования/подстановки старого кадра
сохраняются. Оба source-пакета306 отклонены; публикация не выполнялась.

Исправления этого дефекта готовы: `prepareLayout()` ставит известный task dock
нового стола перед incoming layout, без дополнительного native layout/таймера;
обычные обновления остаются заморожены до конца перехода. Native capture
ограниченно повторяет чтение валидного кадра прежнего размера. Больший кадр
отбрасывается по metadata до PNG/bitmap и не увеличивает reservation; неверный
scale, повреждённый PNG и абсолютное превышение бюджета не повторяются.
Cancellation/identity/privacy guards проверены для всех трёх причин retry.
Оба продуктовых diff независимо просмотрены.

Новый stress gate проверяет после каждого20-page switch не только цветовые
области страницы, но и все пиксели единственной видимой task pill: main task,
stream owner, DOM/native bounds и shell-reference связаны. На50-page этапе
владельцы пяти потоков скрыты и видимых pills должно быть0. Прежний task-only
gate продолжает требовать2pills. Новые отрицательные tests отвергают native
cover, missing/foreign owner и заменённый PNG даже с новым SHA.
Checker source и Releases побайтно совпадают, новый SHA-256:
`91cb74d4d6597eec9a81c0207ab4921d3e0926d3be6c8017ac4d0e2a68bfa6be`.
17/17Python contracts прошли; предыдущие12cases сохранены. Общий локальный
Mouse gate после объединения:774tests,768PASS,0FAIL,6platformSKIP,
6039.422686ms. Настоящая проверка обоих установленных пакетов ещё требуется.

## Третий native source18ccd680: устойчивый старый hidden viewport

`18ccd680d47256c7a757af1a6e020fb63bad637e` также отклонён. На macOS
run44576189326/job135744203987 task-only прошёл, но первый incoming capture
seq14 вернул8раз NativeImage505×273 вместо требуемого505×245. На Windows
run44576189234/job135744204078 реальная замена629→631 и task-only прошли;
тот же первый incoming capture вернул8раз505×295 вместо505×267. Большие
кадры отброшены до PNG/bitmap, остальные три панели получили правильные
кадры. Ни один stress switch не завершён, этап50 не начат, оба cleanup20
успешны; renderer crash не зарегистрирован. Таймауты/допуски не ослаблялись,
готового candidate нет. Verification archives проверены по size/SHA/ZIP CRC:

- macOS artifact14556237278, SHA-256
  `e8506308ffeed0f822dbf5a547c0389dcebc06b5b75786fe2c364d6aa85f831d`;
- Windows artifact14556214402, SHA-256
  `c666f9d31b4cc764f4ce42374955ab62b2b47b4e7a10e37a89866ac0715c530c`.

Первопричина установлена по pinned Electron44.5.0/Chromium152.0.7977.130:
`NativeViewHost::Layout` при пустом `GetVisibleBounds()` вызывает только
`HideWidget()`, а native bounds обновляет через `ShowWidget()` в видимой
ветке. Поэтому `WebContentsView.getBounds()` уже сообщает новый размер,
но RenderWidgetHostView остаётся прежним и повторный capture не помогает.
Обычный `webContents.invalidate()` перерисовывает owner window и не является
доказанным способом обновить этот hidden layout. Отдельный native probe
проверяет сохранение вкладки при resize скрытого view вне widget и возврате
того же view в исходного parent/index. Продуктовое исправление принимается
только после реальных native кадров; старый кадр не масштабируется и не
подменяется.

Primary sources:
https://github.com/electron/electron/blob/v44.5.0/shell/browser/ui/inspectable_web_contents_view.cc
https://github.com/electron/electron/blob/v44.5.0/shell/browser/api/electron_api_view.cc
https://github.com/chromium/chromium/blob/152.0.7977.130/ui/views/controls/native/native_view_host.cc
https://github.com/chromium/chromium/blob/152.0.7977.130/ui/views/controls/native/native_view_host_aura.cc

Подготовленная product-правка ограничена `BrowserWorkspace.layout`: только
при существующем surface hold, фактически скрытом WCV, изменении ширины или
высоты и подтверждённом исходном родителе view временно отсоединяется до
`setBounds`, затем синхронно возвращается в тот же parent/index. Это тот же
WebContents, без показа, перезагрузки или смены focus. `finally` возвращает
живой view даже при ошибке resize; уничтоженный владелец не восстанавливается,
успешная геометрия при ошибке не кешируется. Позиционные и неизменные layout
этот путь не вызывают. Capture/paint budgets, visibility и privacy guards
остались прежними.

Шесть новых causal tests моделируют именно границу Chromium NativeViewHost:
attached hidden resize оставляет native size старым, detached resize
обновляет его. На прежнем source четыре случая воспроизводят отказ; с
исправлением все шесть проходят. Focused58/58 прошли. Общий локальный Mouse
gate:780tests,774PASS,0FAIL,6platformSKIP,5825.711271ms. Независимое review
product diff завершено; нужны отдельные реальные native probe и полные
установленные acceptance обоих пакетов.

## Source13cd6b21: новые native gates прошли, retained gates остановили выпуск

`13cd6b2187d953b29289ff992a7c77215f07fc4f` впервые прошёл новый независимый
gate на обеих ОС:15task cases,20/50live pages,5desktops,15switches,
20OS captures и740pixel probes. Все120 кадров страниц при slide получены
сразу с правильным размером, без retries и ненужных bitmap readouts.
На каждом switch остаются2native layout и8capturePage независимо от20/50
живых страниц. Документы, формы, cookies, scroll и HTTP-потоки сохранены.
На20-page этапе во всех пяти снимках ровно одна правильная видимая pill;
на50-page этапе stream owners скрыты и видимых pills нет. На Windows
контрольные OS-снимки больше не содержат duplicate heading поверх dock.

Windows run44580306173/job135758843470: медиана switch20=550.1ms,
switch50=547.7ms, max50=582.7ms. macOS run44580306221/job135758842294:
медиана switch20=1006.4ms, switch50=930.6ms, max50=1436.3ms.
Это измерения данного fixture; исторический/Chrome benchmark не проводился.
Архивы size/SHA/CRC проверены, independent checker повторно выполнен:

- macOS14558218936: `223126e809a08c34f16b1d87af1469d08a0f6a4f622cb52990d5af4e6e73679b`;
- Windows14559446127: `61ed8954bf9b5878615e307720dcb06dd2b7c0efd1bf76ff71aea5b1243169e7`.

Оба полных source workflow при этом остаются FAIL, candidate отсутствует.
На macOS последующий retained628 dark closing дал2intermediate frames
при требуемых3. Native capture также зафиксировал лишь2intermediate положения.
Trace полная, без data loss; в том же интервале есть GPU wait spans.
Последовательные диагностические closing controls дали6frames без подписки
и3с подпиской и прошли прежний критерий. Причинность capture/GPU не доказана;
исходная ошибка не заменяется контрольным успехом. Nora code, frame count,
timing и frozen validator не меняются. Отдельный631процесс завершился exit0
до запуска retained WRITE в новом процессе с другим профилем.

На Windows после нового gate и реального629→631 profile upgrade отказал
retained630 gesture fixture: он сравнивал состояние normal profile после
private gesture с baseline, снятым до обычных жестов. Raw evidence показывает
`closedPage.before.learned=false`, `after.learned=true`, `lastResult.completed=true`
ещё до входа в private. Production handler закономерно сохраняет first-use
обучение обычного жеста; private completion использует отдельный WeakSet.
Исправлен только fixture: initial state отдельно записан, успешное обычное
обучение дополнительно подтверждено request ID и completed, immutable clone
normal baseline снимается после store queue непосредственно до private entry.
Далее normal state строго сравнивается при private и после выхода; private
KEY остаётся строго undefined. Product privacy code не меняется. Новый
последовательный handler test подтверждает ровно одну normal запись и отсутствие
дополнительных записей при private completion. Focused35/35 и полный локальный
Mouse gate781tests/775PASS/0FAIL/6platformSKIP прошли (6208.270487ms).
Следующий полный native source прогон повторяет все gates без ослаблений.

## Source5743e26: Windows first-use fixture sequencing

Windows run44583712930/job135770879200 снова прошёл новый631 task/stress
gate и независимую проверку; исправленный630 gesture fixture также дошёл
до обоих markers `MOUSE_630_NATIVE_WHEEL_DESKTOPS_PASS` и
`MOUSE_630_PAGE_SCROLL_PRESERVED_PASS`. Полный WRITE затем отказал в
`mouse-628-ui-smoke.cjs:347`: native click не нашёл видимый
`.desktop-gesture-copy summary` (bounds0×0). Это не успех полного выпуска.

Проверка source показала различие orchestration: Windows запускал630
page-wheel gestures перед628 first-use tutorial; macOS уже использует
обратный порядок. Обычный630 gesture закономерно сохраняет обучение, поэтому
следующий first-use сценарий больше не имеет видимой подсказки. Frozen628
намеренно требует fresh isolated profile, проверяет реально видимую подсказку,
проводит обучение и сохраняет `{completed:true}` для последующего READ/restart;
он не должен сбрасывать этот ключ в cleanup.

Исправляется только порядок Windows WRITE: `pageWheelNavigation` следует
после `noraMotionPaletteAndWheel`, как на macOS. Ключ обучения не удаляется,
профиль пользователя и runtime не меняются. Frozen628 UI/motion/pixel/native
click/restart gates остаются прежними.630 fixture должен принимать уже
завершённое обучение и всё равно проверить новый completed gesture с matching
request ID, immutable normal baseline и отсутствие private-записей.
Mac5743 на момент этой записи ещё выполняет полный installed gate; оба
пакета следующего exact source head требуют нового полного native acceptance.

Verification archive14560383889 (21906433bytes) проверен по SHA/CRC:
`4ef7463f5b17ff6aa660f97d419ec0f30ab6174c86ba40e1089ed4d6b356317d`.
В raw630 facts `normalInitial=null`, `beforePrivate=true`,
`afterPrivate=true`, `privatePersisted=null`; private WebContents/store
уничтожены. Это подтверждает прохождение предыдущего baseline fix.
Handler regression расширен на fresh и already learned normal profile:
первый пишет обучение ровно один раз, второй не переписывает его;
private completion не пишет в normal storage в обоих случаях.
Focused35/35PASS,0SKIP (226.333ms); syntax/diff checks прошли.

## Source22bb7c5: подтверждён Windows overflow, Mac trace не принят

Windows44586269526/job135779925712 прошёл реальный629→631 profile upgrade
и новый631 gate:15task cases,20/50pages,5desktops,15switches,740decoded
pixel probes. Контрольные OS PNG показывают правильных владельцев страниц
и pills без прежнего28px duplicate heading strip. Переставленный628
first-use summary действительно видим и получает native click. Следующий
строгий `preview-help` fit gate выявил642pxcontent при632pxavailable
на viewport1008×712, traywidth996. Полный WRITE отказал, modern job skipped.
Verification14562540681 (22923767bytes), SHA/CRC проверены:
`8c498ee393362b4325936d1233eaff37fd0c47ee7016b32638d57e1ccbdbd8e2`.

Сравнение с настоящим629 на том же runner из upgrade evidence изолирует
причину: compact361, modes543, history595 и preview592 совпадают в обеих
версиях. Только expanded help вырос с613 (actual612.875) до642 после
добавления630 объяснения жестов при закрытой Норе. Предыдущие fixtures
сообщают restored=true; измеренного накопленного geometry leak до раскрытия
нет. Existing compact CSS действует только при viewportheight<=700 и
не покрывает712px окно.

Узкая общая CSS-правка применяется только к раскрытой справке и большому
preview при viewportheight<=740: previewheight80px. Под700 это уже было
существующим поведением. При фактическом712 размер preview128.15625→80
освобождает48.15625px, давая консервативный content<=594 при632available.
Текст, шрифты, кнопки, minimum sizes и остальные секции не меняются.
При измеренном остальном контенте<=513.84375 и доступномH−80 нормальный
18vh preview помещается при H>=(513.84375+80)/0.82=724.1997px;
порог740 покрывает этот промежуток. Это расчёт по текущему fixture,
окончательный fit должен подтвердить новый строгий native gate.

Mac5743 run44583713062/job135770879133 завершил полный native gate:
WRITE429049ms, READ7737ms, close/private/profile и реальная629→631
замена с READY/receipt/profile sentinels прошли. Verification14561458365
(26687773bytes) SHA/CRC и independent631740pixels проверены:
`1e401f5a60a5907db173f4b452334020cb4638d3d77c7c3939a50e3e0a7f3b5f`.
Тот же frozen publisher trace verifier также PASS:149392events,
18clock anchors,3fresh closing generations,0activePhaseRejections.

Mac22bb run44586269722/job135779925247 тоже завершил основной native job
SUCCESS, но отдельный frozen publisher trace gate отклонил его exact archive.
Это не accepted Mac release candidate. Verification size26693224, SHA:
`8426f4252c3cb1dd51bddc30411ca9a3a7a8cee29956df2e573251c68a6dd06c`.
Independent631 gate PASS740pixels. В darkClosing compositor END
489794.379/489794.407ms предшествует paired Blink END
489861.696/489861.746ms на67.289–67.367ms при прежнем лимите20ms.
Clock18anchors spread0.125ms/margin0.273ms этого не объясняет.
Следующий renderer BeginMainFrame приходит489861.385ms, Blink ends
через0.311/0.361ms. Между ними не найден67ms synchronous UI task;
в GPU процессе наблюдается50.722ms Dawn IOSurface scheduling wait внутри
SwapBuffers. CopyOutput также присутствует, но его измеренный span0.131ms.
complete()/nativehold release выполняются после задержки, а не до неё.
Причинность capture subscription или конкретной product операции не
установлена; Nora timing/trace validator и20ms threshold не изменяются.
Source22bb archive остаётся rejected; следующая необходимая CSS-правка
проходит полный новый native и independent publisher-scope gates.

CSS diff ограничен6addedlines в `mouse/mouse-628.css`; SHA256
`9f89f3550829d117d52dd3c189d606ea65a7c9948caa900b6269132069b96661`.
Independent review не нашёл conflicting intrinsic min-height/aspect-ratio.
Syntax/diff check и15existing Local UI contracts прошли; эти contracts не
доказывают новый native fit. Дополнительная локальная DOM-проверка не смогла
загрузить страницу: Chromium остановился на socket EPERM. Обхода ограничений
не было, успешная DOM-проверка не заявляется.
