# Mouse Browser 6.0.35 — выбранный поисковик и собственная лента

## Последнее прямое решение владельца

21 ноября 2026 владелец поручил использовать выбранный пользователем поисковик и менять только представление его выдачи: реальные результаты становятся плитками Mouse. Это заменяет предыдущие варианты публичных API, SearXNG/YaCy и перевода через MyMemory. Общая настройка `mouseSearch.engine` уже содержит Google, Bing, DuckDuckGo и Яндекс; второй независимый выбор не создаётся.

Сначала выпускается только macOS Apple Silicon. Windows/Linux6.0.35 не публикуются; текущие каналы6.0.34 сохраняются. Все ранее согласованные правки Agent Chat, иконки, кнопок, меню «Окна», закрепления и списков файлов остаются в выпуске. Публикация разрешена владельцем; готовность подтверждается только установленной проверкой и обратной загрузкой пакетов.

## Реализуемое поведение

Обычный запрос открывает настоящую страницу выбранного движка в изолированном `WebContentsView`, используя действующую Chromium-сессию обычного браузера. Фиксированный код извлекает title, URL и snippet органических результатов; они отображаются в плиточной ленте. Поиск не получает независимые engine/endpoint/URL от renderer. Смена общего поисковика отменяет прежнюю выдачу и повторяет введённый запрос через новый выбор. Следующая страница следует реальной ссылке того же поисковика.

Страница источника остаётся вне пользовательских вкладок и раскладки до явного действия. Если поисковик требует ручной проверки или разметка не распознана, пользователь может открыть **ту же** страницу в обычной вкладке: передаётся исходный `WebContents`, без повторного `loadURL`. Не добавляются обход CAPTCHA, новый proxy, подмена user-agent или скрытые альтернативные провайдеры. Форма обычного поиска доступна в прежнем обычном режиме; приватная поддержка этим изменением не расширяется.

Main проверяет requestId, revision, query/filter/page, общий engine, текущие project/desk и срок жизни источника. Отмена, новый запрос, закрытие и смена контекста делают прежнее ручное действие недействительным. Передача странице вкладке отделяет её от сервиса поиска, чтобы закрытие ленты не уничтожило уже открытую страницу.

## Дополнительное подтверждение владельца

В следующем сообщении владелец ещё раз уточнил: показывать ту же выдачу выбранного поисковика в интерфейсе Mouse, сразу плитками сайтов. Поэтому сохраняются порядок извлечённых результатов и реальные страницы в native preview tiles; отдельное ранжирование, генерация сайтов или подмена источника не добавляются. Согласованные фильтры ленты применяются только по выбору пользователя.

## Текущий проверенный checkpoint

В `desktop/browser.cjs` добавлена доверенная передача существующего source view через обычные hooks создания вкладки. Эти hooks сохраняют назначение стола, историю, масштаб, клавиши и управление перекрытиями. В `desktop/mouse-tile-search.cjs` добавлены жизненный цикл native source, привязка контекста и `open-engine` без URL от renderer.

Локально `node --test browser-state.test.cjs mouse-tile-search.test.cjs` завершился **34/34 PASS**, включая сохранение настоящего объекта страницы без навигации, отказ для чужой сессии/приватного режима, отмену устаревшего действия, защиту после смены поисковика и освобождение страницы при ошибке передачи. Это контрактные тесты: они ещё не доказывают доступность внешней выдачи на macOS.

Backend DOM-адаптер, общий selector UI и независимая установленная приёмка разрабатываются параллельно. Живой gate должен связать выбранный engine, точный русский запрос «новости про антропик», actual source DOM, нормализованные URL/title/snippet, DOM плиток и OS-снимки той же страницы и ленты. Корректно обработанная CAPTCHA или сетевой отказ не обозначаются успешным живым поиском.

Исходники: [PR187](https://github.com/jeep-jim/OSMINOG/pull/187). Выпуск: [PR63](https://github.com/jeep-jim/OSMINOG-Releases/pull/63). На этом checkpoint нового опубликованного пакета нет. Точная история предшествующих native отказов остаётся в [журнале installed regressions](2026-11-21-mouse635-installed-regressions.md).


## Проверка объединённой реализации перед Mac candidate

Объединённый локальный набор native source/DOM, service/transport, общего выбора поисковика, ручной передачи страницы, main controller и package inclusion прошёл **104/104 tests PASS**, без skipped/cancelled, за2.177s. Лог `mouse635-selected-engine-integration.log`, SHA-256 `f5f561d2ab15fdf435297b0cd72b9c899db7fdc66cf3a694e9d8e967c30506d8`. Проверки сохраняют порядок результатов и действующую сессию, а source/DOM модули включены в явный список устанавливаемых файлов.

Во время независимого review исправлена гонка открытия: уведомление общей настройки во время её чтения могло оставить скрытую панель. Теперь текущий read перечитывает состояние после уведомления, а закрытие отменяет поздний read. Backend больше не содержит прежнюю production цепочку поисковых API; отдельный HTTP transport сохраняет только прежний собственный ИИ gateway. Живой внешний результат и установленная Mac-проверка на этом шаге ещё не подтверждены.


## Полный локальный source gate

На замороженном runtime полный Mouse-набор завершён: **1194tests /1188PASS /0FAIL /6 Windows-only SKIP**,10.857s. Лог `mouse635-final-unit-10.log`, SHA-256 `1260573f1b1724fc40ca95eeccba2aada54e9dba0c91a0f33633120e2fb98773`. Python acceptance18/18 и upgrade4/4 прошли, SHA-256 объединённого лога `5c3ed8fa717980876c02ee18b23d0884f594493ec56d04d666ba3170666506f2`; syntax/diff checks прошли.

Отдельный общий desktop `npm test` локально:173/178PASS; пять socket integration tests остановились на системном `listen EPERM` для временного Unix socket в этом окружении. Это не обозначается PASS и не обходится сменой защиты. Полный прежний `npm test` остаётся обязательным шагом нативного Mac CI. SHA-256 лога `dc58c87d885388cf99ac4c16d3e585880949781875a78c079dae614cc7638a1d`.

Два независимых review не выявили блокеров в передаче живой страницы и preference lifecycle. Source acceptance подготовлен для настоящего native select, точного русского запроса, исходного DOM, порядка результатов и двух дополнительных OS-кадров. Новый Mac candidate ещё должен пройти установленную приёмку; Release gate требует реальной тематической выдачи и точных проверенных пакетов.

## Проверенный Mac candidate 3c056: исправление проверки реального меню

[Mac run44888975126, attempt1](https://github.com/jeep-jim/OSMINOG/actions/runs/44888975126) на source `3c056a92e7569095c8807c62e2d5dd114c8df64a` собрал arm64 DMG/ZIP. Общий `npm test`, Mouse unit tests и сборка прошли. Job `136800400969` остановился на installed acceptance: `Mouse631 owner635 timeout: 635 actual native engine choice`. Retained634 report имеет `stage=complete, ok=true`; новые Agent Chat, library и panes дошли до следующего этапа public-search. Сам живой запрос ещё не был отправлен, поэтому доступность внешней выдачи этим запуском не подтверждена.

Verification artifact `14701103194` скачан и проверен:16,532,891 bytes, SHA-256 `07233697fca2689f2468939061aca81ad2c3949ae1d24b8caad9ce5ecfdb5c81`. Raw report сохранил настоящий trusted click по select, последующий trusted click по кнопке и штатный `change.trusted=false`. Это согласуется с существующим `desktop/mouse/overlays.js`: браузер перехватывает select и открывает `dialog#choice-dialog`; реальная кнопка меню меняет значение и отправляет программный change. Предыдущее предположение acceptance о системном popup было неверным. Исправляется только путь проверки: OS-click по selector, ожидание открытого меню/barrier, OS-click по точной кнопке выбора, затем чтение общей настройки и готового UI. Программное событие change не обозначается trusted; production chooser не подменяется ради проверки.

Дополнительно исправлена проверка домена в плитке: существующий UI скрывает только префикс `www.` в подписи, сохраняя полный исходный URL. Smoke и независимый Release checker сравнивают подпись с этой реальной формой; полный URL и порядок остаются точными. Отдельный тест использует `https://www.anthropic.com/news`.

При review ручной передачи страницы исправлен самостоятельный крайний случай: служебный `q`/`text` на provider verification path не принимается за изменённый пользовательский запрос. Сверка исходного запроса сохраняется на обычном `/search`, а request/engine/project/desk и владение страницей проверяются как прежде. Проверка передаётся пользователю на том же WebContents без повторной навигации и действий с CAPTCHA. Это проверенный контрактный сценарий, а не наблюдённая внешняя CAPTCHA в указанном Mac run. Узкий backend набор:13/13 PASS,0FAIL/skip.

Кандидат3c056 не готов к публикации. Следующий source head должен повторно пройти установленный Mac gate с реальным выбранным поисковиком и независимой проверкой исходного DOM.

### Замороженные исправления после 3c056

Проверка chooser теперь сохраняет оба настоящих trusted OS-клика, точные четыре пункта и текущую отметку, их видимость/геометрию, блокировку native surfaces до/после снимка и освобождение модального окна после выбора. Добавлен фактический кадр `mouse-635-public-search-engine-menu.png`; общий owner ledger содержит17 кадров: library8, Agent4, panes2 и search3. Путь `deferReceipt` больше не нужен и удалён. Значение select из теста не присваивается.

Полный локальный Mouse gate после исправлений: **1198tests /1192PASS /0FAIL /6 Windows-only SKIP**,10.976s. Лог `mouse635-final-unit-12.log`, SHA-256 `af5924008bb972f625d0b59f8dc2940f0f311946b02ce98ec174464d49203b07`. Отдельный focused проход chooser/public-search, retained capture и hit-target:53/53 PASS. Эти проверки подтверждают контракт и регрессии; следующий реальный Mac run остаётся обязательным.

## Mac4d95: настоящая выдача получена, визуальный допуск пока не пройден

[Run44889848120, attempt1](https://github.com/jeep-jim/OSMINOG/actions/runs/44889848120), source `4d95ec86b3c88cb07fa61963767eea0a1a6be72f`, job `136803106043`, собрал DMG/ZIP. Retained634 и новый owner635 завершились `ok=true, stage=complete`; Agent Chat, library, panes и public-search выдали свои PASS markers. Выбор Bing через фактическое меню подтвердился. По точному запросу «новости про антропик» получены10 органических результатов за2912ms; по «Python documentation» —10 за2122ms. Это длительность получения исходной выдачи, не время готовности всех сайтов в плитках.

Verification artifact `14702070281`:25,982,625 bytes, SHA-256 `1ba22ee1f04255938931fec5d7778de8fe64beec417322323f8d5bc6ba8b1a3d`. Архив скачан, длина/хеш проверены; все254 распакованных файла сверены с ZIP. Независимый current635 checker принял DOM, порядок,17 кадров и их byte/crop binding. Однако ручной просмотр обнаружил недостаточную проверку визуального содержимого: файл `mouse-635-public-search-source.png` показывает оболочку Mouse вместо Bing, а `mouse-635-public-search-tiles.png` содержит ещё загружающиеся области сайтов. Поэтому программный PASS не является допуском к публикации.

У public smoke отсутствовало ожидание отрисовки source/guest: перед кадрами проверялись видимость view и готовность карточек, затем лишь двойной rAF оболочки. Между ответом первого запроса и очисткой прошло1718.769ms, включая1050ms между наблюдениями DOM вокруг source capture. В renderer нет обязательного ручного клика для загрузки плиток: видимые slots автоматически передаются native pool. По имеющимся данным изменение production lifecycle не обосновано. Следующая проверка должна связать реальные пиксели того же source/guest WebContents с OS capture, сохранить rejected attempts и точную идентичность страниц; пустая область не считается работающим предпросмотром.

Общий installed gate остановился позднее в `--mouse-smoke-write`: `Timed out native layout menu applies and closes` (`mouse-start-smoke.cjs`). Raw failure показывает один main pane и уже закрытое меню. Старая последовательность ожидала только создания объекта меню, затем отправляла HOME/DOWN/ENTER без наблюдения `menu-will-show`. Точная причина потерянного выбора прежним отчётом не доказывается. Узкое исправление использует настоящий OS-click и ждёт фактические show/close события, после чего по-прежнему требует два окна по горизонтали, соответствующее значение скрытого compatibility select и закрытое меню. Диагностика сохраняется в `mouse-635-start-layout.json`; проверки не допускают pass по одному закрытию меню. Focused18/18 tests PASS, включая delayed-show и close-without-apply.

Release commit `c70aba83da2153f860e91dea4b7f071e229399a7` прошёл470/470 локальных контрактов и все три CI contract jobs; publishers SKIPPED, все pins false. На настоящем4d95 archive retained635 search checker отдельно выявил устаревшее имя retry selector (`.mouse-search-error button` вместо `.mouse-search-retry`). Исправляется только текущий635 слой; frozen634 алгоритмы остаются неизменными. Этот кандидат не опубликован и не готов к pin до устранения указанных actual acceptance gaps.

Краткая заглушка до создания native preview теперь пишет «Открываем сайт…»: прежнее «Выберите сайт, чтобы открыть его» неверно описывало уже запланированную автоматическую загрузку. Условий открытия, выбора результата, выдачи разрешений и порядка сайтов эта текстовая правка не меняет.

### Промежуточный legacy checkpoint

Для параллельного выявления оставшихся installed regressions исправление реального layout-menu выделено в следующий промежуточный кандидат, пока отдельно готовится усиленная проверка source/guest paint. Полный локальный Mouse gate:1201tests /1195PASS /0FAIL /6 Windows-only SKIP,11.447s; лог `mouse635-final-unit-13.log`, SHA-256 `40dfce45a7fb61716e1b1139f7e9b5494dd7e36317ee1e0f18c0a878b0be3f49`. Независимый review не выявил блокера в observer/show/close/cleanup последовательности. Этот checkpoint не устраняет визуальный blocker поиска сам по себе и не даёт разрешения на pin или публикацию.

## Mac fa1c: положение окна при настоящем OS click

[Run44891638884, attempt1](https://github.com/jeep-jim/OSMINOG/actions/runs/44891638884), source `fa1c11e84dfed23df4fa6d5283c18f77c25e2593`, job `136808516150`, вновь собрал пакеты и прошёл предшествующие retained634/owner635 проверки. Общий installed gate остановился в `--mouse-smoke-write`: `Timed out native layout menu actually shown`. Verification artifact `14702641653` скачан и проверен:24,855,587 bytes, SHA-256 `5fb790ee23e5d479c589bc02dade2d813e971b9fffd7753e1cc0f9633159f25d`.

Raw `mouse-630-basics-input.json` фиксирует content bounds `{x:-416,y:-192,width:1440,height:960}` при дисплее1024×768. Receipt `mouse-635-start-layout.json` содержит OS point `(-214,754)`, `menu:null`, пустые keys; фокус остался на language-select. Это клиентская точка `(202,946)` в большом renderer, но физический x находится за левым краем экрана. Предшествующие проверки специально используют1440×960; DOM hit-test не проверяет положение окна на дисплее. `mouse-failure.png` снят через window capture и потому не доказывает физическую доступность кнопки.

Исправлен только test helper: на время настоящего OS click он условно вписывает окно в actual workArea существующим `fixtureWindowBounds`, ждёт согласованные window/content/renderer bounds, повторно вычисляет hit и требует точку внутри дисплея. Исходные bounds восстанавливаются в finally при успехе и отказе; diagnosis сохраняет before/fitted/restored geometry. Production layout handler не меняется. Три новые регрессии проверяют исходную геометрию этого отказа, stale viewport без отправки OS input и восстановление при неоткрывшемся меню. Независимый review не выявил блокера; окончательное подтверждение требует следующего установленного Mac run.

## Обязательный actual paint gate

Source public-search smoke теперь сравнивает OS pixels с двумя PNG того же native WebContents, снятыми до и после экрана. Сохраняются исходные reference PNG и все rejected OS frames. Принимается первый кадр, прошедший проверку стабильных информативных точек: пустой совпадающий фон недостаточен. Идентичность request, query, source/guest WebContents, навигации, документа, bounds и окна проверяется до и после. Серия ограничена4500ms и20 попытками; время не сбрасывается между кадрами.

Для сайтов закреплены первые `min(2,actualResultCount)` видимые результаты в исходном порядке. Они должны получить настоящий содержательный документ в пределах15000ms; незавершённые фоновые ресурсы не подменяются фиктивным loading=false. Исходный result URL остаётся привязан к выдаче, а фактическое перенаправление подтверждается событиями реальной навигации. Очистка поиска начинается после доказанного кадра.

Независимый Python Release checker декодирует PNG и сам пересчитывает те же метрики; actual4d95 без нового paint evidence отвергнут. Canonical owner ledger содержит17 кадров, а с сохранёнными rejected attempts допустимо17–55 фактических OS frames. Замороженный Release union:22 скрипта,491/491 PASS, schema SHA привязки и required templates PASS; все три publisher plan остаются false. Summary SHA-256 `3650229f4712ccb8371466beb596c0b06f406b4172cb0c225dff05d635525e5e`.

Полный локальный Mouse набор после paint и geometry исправлений:1212tests /1206PASS /0FAIL /6 Windows-only SKIP,8.741s. Лог `mouse635-final-unit-15.log`, SHA-256 `1a39fc36104f31516791e05ce5ed9f5f37662c9b0ab5b52cdc12d01082d7c87c`. Это контрактная проверка; новый actual Mac paint PASS и выпуск ещё не подтверждены.

### Уточнение подписи отзыва прав

Финальный UI review нашёл устаревшее название «Стоп» в подсказке локальных прав. Текст теперь указывает существующую кнопку «Отключить доступы» в разделе «Работа с браузером» и отдельно объясняет остановку текущего ответа. Поведение разрешений и обеих команд не меняется; syntax и diff checks PASS. На момент этой правки Mac8e027 run44892693561 ещё выполняет installed gate. Следующий точный source с исправленной подписью проходит собственный полный CI; промежуточный пакет8e027 не предназначен для публикации.

## Actual8e027: source/tiles paint подтверждён; поздний restart gate остановлен

[Run44892693561, attempt1](https://github.com/jeep-jim/OSMINOG/actions/runs/44892693561), source `8e0274a4d963b94a03daa42141f24f4b5dd1f6ba`, job `136811724836`, прошёл новый owner635 с настоящим source/tiles paint и исправленный legacy OS layout menu. Verification artifact `14702268888`:51,573,203 bytes,584 файла, SHA-256 `7afc5a7f8b49b1cebca6a78aa3ad490a7c94f5a06237b0a47aa26378343d43ab`. ZIP скачан и проверен. Независимые current owner635 и retained634 validators из Release f4db PASS на фактических ZIP bytes.

Ручной просмотр PNG и full-display кадров подтвердил настоящий Bing с точным запросом «новости про антропик», затем реальные страницы Meduza и AI Wave в первых двух плитках. Это те же первые два URL из organic DOM receipt. У обеих страниц loading=false/error пуст. Bing capture показывает верхний AI Overview; органический список расположен ниже, поэтому его порядок проверен DOM receipt, а не сравнением видимой части source PNG. В первой плитке видны собственные реклама и cookie banner Meduza; её статья ниже. Контент внешних страниц здесь служит свидетельством отображения, а не проверкой правдивости публикаций.

Source paint принят на14-й попытке за4096.18ms, с13 сохранёнными rejected frames; tiles — на1-й за489.27ms. Owner ledger:30 actual/17 canonical OS frames. Actual replies для двух запросов заняли2225.49ms и918.13ms (`completedAt − startedAt`); каждый вернул10 тематических результатов. Эти значения не включают последующую визуальную приёмку.

Partial audit SHA-256 `ca082c20a7db3e3ca8b30dd65206a8f9c66dbf15ac47ddbda5ec206ed9b2cf4a`; owner635 SHA `1a4cf69836d0c286498bda166934b5bb2cd5b6b194e0a9a6ab0890e917bd2b5a`; retained634 SHA `32d557136f538314955a707aa8cfc06a197bf5960fc689f79cada6f516d83f90`.

Общий job завершился позднее ошибкой `Mouse628 motion timeout: restarted Nora opens` в `--mouse-smoke-read`. Перед ним library/start/profile-cookie restart markers PASS. Диагностика `mouse-630-nora-restart-diagnostics.json` показывает: open() вызван напрямую, подготовка backdrop началась и отказала по существующему2500ms deadline; все4 native capturePage завершились лишь через2789.7–2838.4ms, completedIds пуст. Сохранились error WebContents старых завершённых loopback серверов и окно `{x:0,y:-31,width:1440,height:960}` на дисплее1024×768. Данные подтверждают позднее завершение capture, но не доказывают, что его причиной был именно выход окна за экран. К перенесённым кнопкам этот отказ не относится.

Кандидат8e027 не пригоден для публикации: общий run failed, candidate artifact отсутствует. Параллельный9feabe с последним уточнением текста продолжает свой installed gate; после любого следующего source amendment необходим новый точный Mac run.

## Финальный source9feabe: полный installed и независимый audit PASS

[Mac run44893434036, attempt1](https://github.com/jeep-jim/OSMINOG/actions/runs/44893434036), job `136813950935`, source `9feabe59aaad4ebbfd01733a0e59c3127f7b3842`, завершён SUCCESS. Весь installed gate, перезапуск Nora и фактическое обновление634→635 прошли. Прежний8e027 capture timeout в этом запуске не повторился; причина различия не объявляется доказанной. Подготовленный отдельно test-only Nora fit proposal (36/36 focused PASS) не включён в source9feabe и проверенные пакеты.

Candidate artifact `14703078902`:279,179,273 bytes, SHA-256 `fe704e36850eeb6688cb979603ca4e3ed76c99281a9767dc0321f880fe2a5d8b`. Verification artifact `14703063968`:53,208,217 bytes,620 файлов, SHA-256 `b96bd832a64a51d039dfa2227525940490aa90016a2aed3b37f612918dfb90d6`. Оба архива скачаны и сверены с API metadata, source/run/attempt/job и временем создания artifacts.

Полный независимый audit текущими Release validators: source-evidence, task-stress, feedback, motion-trace и owner635 — все PASS. Summary SHA-256 `2c54c087b9ba2b84e73dea52e4beaf0035f1fcce5e877bff7519af0b099643b7`; candidate audit SHA `694c265612527641b4ec8247b2e565c53061a763374100ca8eef1f71a2e5db8f`. Финальные реальные PNG отдельно просмотрены: Bing, первые Meduza→AI Wave tiles, Agent dark400/light400/dark300, settings, layout и pin. Визуальных блокеров не выявлено. Порядок organic выдачи подтверждает raw DOM; видимый source capture находится на AI Overview. Внешний model server пользователя не проверялся: Agent acceptance использует явно обозначенный HTTP/SSE fixture.

Точные готовые пакеты:

| Файл | Байты | SHA-256 |
|---|---:|---|
| Mouse-Browser-6.0.35-mac-arm64.dmg | 139418049 | 573ccf17e87e7bbcc872e31c96c07e3b0534e68bad903a36d2d1adab9a067a39 |
| Mouse-Browser-6.0.35-mac-arm64.zip | 141786985 | a8dc39b92264334fa611672a9254fcc6468e09d280fc82437033d7a9cac41909 |

[Source PR187](https://github.com/jeep-jim/OSMINOG/pull/187) объединён merge `17ba263c6b34c0ba83b422ddda743af95a7ff159`. GitHub API и git ancestry подтвердили сохранение проверенного head; дерево source/merge одинаково `339edfbed00b3ee48c80bc94701510699a9e388c`.

Mac pin заполнен механически из actual audit; previous6.0.29 оставлен неизменным. Только Mac PUBLISH_OWNER создан. Ready-state Release union491/491 PASS, plans Mac/Windows/Linux =true/false/false. Все5 CI workflows exact Release head `27905032e0410237408bc0b0f2b4863019cdb583` SUCCESS; три contract jobs PASS, все publisher jobs на PR SKIPPED.

[Release PR63](https://github.com/jeep-jim/OSMINOG-Releases/pull/63) объединён merge `dcae0cfb16d6c1423201ce8d19d4c340bd14f8fc`. [Mac publisher44895271630](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44895271630) запущен для обязательного fresh installed gate на тех же байтах. В этой записи публикация и канал ещё ожидаются; окончательный результат добавляется ниже после фактической проверки.

## Fresh publisher9feabe: системная тень на краю проверочного окна

[Publisher44895271630, attempt1](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44895271630), job `136819981106`, импортировал точные проверенные пакеты, но остановился в свежем installed owner635 на public-search paint. Publish, channel и anonymous updater steps SKIPPED; этот запуск не опубликовал6.0.35. Verification artifact `14704320550`:20,958,100 bytes,173 файла, SHA-256 `4d19c99dc989e96d2bb772170a89456b1a17db68483032228fac44f9fcaea9ea`; архив скачан и проверен.

Actual source Bing уже присутствует на OS frame. На11 complete comparisons rejected только437 background samples из39,606 stable: `(39606−437)/39606 = 98.89663%`, ниже неизменного99%. Все2,189 informative pixels совпали. Отличия расположены только в двух нижних sample rows y652/656: белый reference255 становится OS gray248–251. На полном кадре Dock и его верхняя тень примыкают к этой полосе. Content bounds `{x:4,y:29,width:1016,height:676}` заканчиваются на705 при workArea bottom709; source identity, navigation epoch, foreground и geometry неизменны. Связь полосы с отдельным WindowServer layer не записана, поэтому фактический pixel mismatch отделён от визуального объяснения его источника.

Последняя12-я попытка исчерпала общий4500ms на after-reference capture после11 одинаковых отказов. Это не доказательство медленного поиска или отсутствия отображённой страницы. Плиточная фаза в этом свежем запуске ещё не достигнута. Предыдущий source9feabe полный PASS сохранён в истории, но не заменяет свежую приёмку издателя. Diagnosis JSON SHA-256 `b1e77750ad8bbe680a857dd963f84a3a40130087dc41487d0c93870eb54d2ad7`.

Подготовлено узкое test-only размещение окна public-search выше системного Dock существующим `focusedProbeBounds` с32DIP clearance. Проверка требует реальные native/content/renderer размеры и восстановление исходных bounds в finally. Production search, pixel matcher,99%/95% thresholds,4500ms/15000ms budgets и сохранение всех rejected кадров остаются прежними. Изменённый исходник должен пройти новый полный Mac CI и fresh publisher; повтор старого failed job не используется как исправление.

Focused regression suite для нового размещения и прежнего focused chrome:40/40 PASS. Для исходной геометрии window `{x:4,y:29,width:1016,height:676}` меняется только height до648; lower edge677 равен workArea.bottom709−32. Сохраняются before/requested/fitted/restored geometry и фактический renderer viewport. Проверены точное восстановление, отказ при stale viewport, обработка ошибки fit и неизменная геометрия других платформ. Новый установленный прогон ещё требуется. После failed publisher отдельно подтверждены404 для release/tag635 и побайтно неизменные три feed6.0.34; audit SHA-256 `9be11175f75d0508c5c88dd4996aca507c6a96a90885730855db3cf0feb0de66`.
