# Mouse Browser6.0.30 — объединение исправлений и завершение обратной связи

## Прямое поручение и версия

Владелец требует сохранить прежние прожилки между окнами, убрать только обводку Норы, открывать Нору перед страницами, переключать внутренние столы двумя пальцами или колесом. Ранее добавлены требования настоящей активности загрузок, визуального затвора/подтверждения снимка и аккуратной пилюли непосредственно под адресной строкой каждой панели. Лендинг отменён: владелец рисует его самостоятельно. Публикация всех этих изменений прямо разрешена. АвтоЦена, DNS, доступы и системные настройки macOS вне этого объёма.

Во время source10 нашего PR169 основной репозиторий принял независимый [PR170](https://github.com/jeep-jim/OSMINOG/pull/170), merge`a5a773c16c2b342f9c7dfaf5334649e1da1f3eca`, exact source`72679ee907dda6e7ac134b1f01addee858c4e59a`. Его [run44498720435](https://github.com/jeep-jim/OSMINOG/actions/runs/44498720435), attempt1/job135472522776, прошёл все8 checks и полный Mac gate. Отдельный [release PR51](https://github.com/jeep-jim/OSMINOG-Releases/pull/51) объединён32babb2e2dc9ed3c6eec6ec7f9f862b42eb2be37; publisher44501476513 повторно проверяет установленный пакет. Его6.0.29 пакеты не заменяются. Наше дополнение переносится на эту принятую основу как6.0.30. Это не разрешает считать6.0.30 опубликованной по исходному PR или частичной проверке.

## Сохранённая принятая основа

В6.0.30 сохраняются actual getVisible reconciliation в browser.cjs, native Nora barrier, preview capturePage с stayHidden:true/stayAwake:false, точное независимое округление endpoints, цвета#c7cfdf/#43536b и scrollbar-only user-origin injection. Принятые Nora wheel thresholds/KEY mouseDesktopWheelHintV2/private learning и629 native UI/scrollbar/tutorial проверки сохраняются. Runtime version в исторических629 fixtures становится6.0.30.

Первая версия630 взяла burrow-motion.js из принятого main; прежнее изменение одного willChange из старой ветки не переносилось. После двух подтверждённых отказов закрытия ниже описано отдельное исправление жизненного цикла анимации. GPU flags не меняются. Длительность300ms, минимальные intermediate frame gates и алгоритм mouse628-motion-trace-evidence-v2 сохранены.

## Дополнение6.0.30

- Header row28px/pill24px у панели-владельца. Нижние углы native page и frozen snapshot остаются скруглёнными; цвет native cutout совпадает с прежними прожилками.
- DownloadItem lifecycle с фактическими байтами/известным процентом или indeterminate состоянием; пауза, отмена, ошибка, повтор, normal/private isolation и перенос владельца между столами.
- Capture feedback после настоящего capture/save/copy, отдельный reduced-motion путь, отсутствие эффекта в экспортируемом PNG и отсутствие ложного успеха при отмене/ошибке.
- Дополнительный trusted page/closed-shell wheel route с отдельным112px/two-event recognizer,64px вертикальным колесом только над управляющими элементами, сохранением вертикальной/вложенной горизонтальной прокрутки, редакторов и prevented events. Новый маршрут не заменяет принятый Nora wheel path.

Новые native reports имеют prefix630, а принятые629 UI/tutorial и628 Local/progress/motion сохраняют исторические имена. Shell и isolated preload получают один wheel helper; wrapping scrollbar(pageActivity(source)) сохранён. AppID, partition/profile/cookies, маскот, updater и полномочия Local MCP не изменяются.

## Отклонённый source10 и подтверждённое исправление

[Run44500891371](https://github.com/jeep-jim/OSMINOG/actions/runs/44500891371), head`e41e7469caaf85ae9d924c7fec939c35c17e109b`, attempt1/job135480048406, 09:55:58–10:03:46UTC. Artifact14517218131 создан10:03:42UTC:16680386байт/191файл, SHA-256`0d9d8ad532b774ed285c093267387c1228d7c4ac02d4343da633c98ce07ddca6`. Проверены API digest/size/provenance, CRC и все извлечённые байты.

Независимые completed scopes: header92532pixels/2owner swaps; feedback6items/53events/7584changed pixels и новые plateau/export/private assertions; Nora757visibility samples/21OSpixels/2root repairs; fractional7PNG/3endpoint cases; wheel10cases/3dispatches/4ordinary scroll routes. Неизменённый trace validator принял151921events/18clock anchors, spread0.125ms.

Прогон остановился на mouse-616-smoke.cjs «one shared footer button style»: #downloads-button.mouse-download-activity имел radius12px при общем5px, остальные computed style поля совпадали. Причина — конкретный CSS override в activity-feedback.css. Для6.0.30 удалена только border-radius декларация этого footer selector. Header pill999px и native616 gate не меняются. Full629 checker правильно отклонил архив из-за отсутствующего fresh restart после ранней остановки; source10 не принят для публикации.

Фактическое plateau copy observation source10:12barrier samples, beforecurrentTime266.022ms и after433.050ms, opacity1, общий startTime2313.778 и renderer origin; native readback157.585ms. PNG, changed region/count и чистый экспорт независимо пересчитаны. В новом630 fixture изменён только namespace, сама проверка сохранена.

## Текущая проверка

Локально выполнены43 focused feedback/header/page tests и93 focused gesture/Nora tests, syntax/diff checks и независимая сверка root build/dispatcher/workflow/update контракта. Source native gate находится на шагах17–20 (verify,bind,candidate,verification). Строгий upgrade helper закрепляет ранее принятый6.0.29 DMG137744712байт/SHA-256`665fca86eb86f1bd98bca4c72652fb5b0a981fc4f4c6467a66d0683874c6d57c` и требует настоящую6.0.30 startup/READY, удалениеreceipt, сохранениеsentinels иcodesign старого/нового приложения. Первые два полных630 прогона отклонены по описанной ниже причине; publisher630 ещё не запускался.

Физический трекпад и установка на Mac владельца не заявляются. Предварительная ad-hoc подпись без Developer ID/нотариализации сохраняется. Точные принятые source/artifact/package/channel факты будут дописаны после их реального получения.

Локальный запуск полного первого workflow test-list через имеющийся Node24.22.3 дал581PASS и7ошибок загрузки зависимостей: ws, @modelcontextprotocol/sdk, @xmldom/xmldom и macOS mouse-mcp-fs.node отсутствуют в этом checkout. Это не полный PASS; npm/runtime/native подготовка и тот же test-list остаются обязательными в Mac CI с Node22. Новых логических assertion failures этот локальный журнал не содержит.

## Подтверждённая публикация629 и два отклонённых прогона630

Публичный629 release опубликован2026-11-19T10:24:42Z. [Publisher44501476513](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44501476513), attempt2/job135489533542, завершён SUCCESS10:28:52Z, включая обнаружение и полное скачивание настоящим старым обновлятором628 без авторизации. Статический канал указывает629 с теми же размером и SHA DMG. Пакет629 не заменяется байтами нашего630 кандидата.

[Source run44503698602](https://github.com/jeep-jim/OSMINOG/actions/runs/44503698602), head`f833cde3794b00e992021a082267d46575e89d92`, отклонён в обоих полных попытках:

| Попытка | Job | Verification artifact | SHA-256 |
|---|---|---|---|
|1|135489691953|14518573011|`e891ec99c7b6d4ebcd2483edca627e33eef0d0affe52520fabc262fbc8f3350a`|
|2|135494943723|14518838549|`07536359fd4b76e4f48b34058c6079154eed97badd34a77cca8c76faaa391b49`|

В обеих попытках завершённые scopes header, реальные DownloadItem/capture/private, Nora foreground/fractional7 и accepted629 UI прошли независимые вычисления. Оба прогона остановились на неизменном `light closing paints at least three intermediate frames`: наблюдались два промежуточных RAF вместо минимум трёх. Во второй попытке native subscription сохранила настоящий промежуточный PNG; это не заменяет отсутствующие RAF или итоговую полную приёмку. Полный630 checker и исторический628 trace checker правильно отклонили неполные архивы. Candidate artifact не создавался; pin и публикация630 не выполнялись.

Во второй трассе300ms окно закрытия52282.263–52582.263ms содержало RAF на+100.537 и+200.537ms. Сохранено57755 событий без потери данных; renderer longTasks и geometry mutations отсутствуют, максимальные задачи renderer2.711ms/browser6.298ms. GPU IOSurface/Dawn ожидания сопровождают SwapBuffers; это доказывает место задержки, но само по себе не доказывает её единственную причину. Один повтор того же head уже выполнен; дальнейший неизменный повтор не назначается.

## Первая проверка сохранённой пары анимации

После обычного завершённого открытия пара WAAPI-игроков сохраняется на открытом endpoint с paused состоянием и will-change. Перед парковкой устанавливается обратное направление и явно сбрасывается кеш effect timing через `setKeyframes` с теми же keyframes: простое изменение playbackRate при неизменном300ms endpoint в Chromium может оставить cached after/non-current. Временная шкала, easing, контур и длительность не меняются; epsilon seek и искусственные кадры не используются. Следующее закрытие использует подготовленную пару, а закрытый/reduced-motion/immediate/release пути освобождают её. Состояние покоя отделено от существования игроков, чтобы не блокировать двухпальцевый/колёсный переход в открытой Норе.

Это отдельное изменение жизненного цикла, эффективность которого должна быть подтверждена полным новым Mac run, исходными PNG/trace и отдельной проверкой установленного пакета. Критерии и валидаторы не ослабляются. Локальная попытка дополнительного Chromium156 smoke не стартовала из-за запрета ProcessSingleton socket в среде; она не является PASS и не подменяет macOS Chromium152 проверку.

Проверенные первичные описания API: [Blink AnimationEffect](https://chromium.googlesource.com/chromium/src/+/HEAD/third_party/blink/renderer/core/animation/animation_effect.cc), blob`a522ce6f1b12e5911b5293e5310e4d39936b42c7`; [Blink KeyframeEffect::SetKeyframes](https://chromium.googlesource.com/chromium/src/+/HEAD/third_party/blink/renderer/core/animation/keyframe_effect.cc), blob`13a9c1472857c1b27a166d553bea0bd8aa09171b`; [W3C Web Animations, phases and states](https://www.w3.org/TR/web-animations-1/#animation-effect-phases-and-states). Прочитан текущий официальный source, не точный binary tag152. `setKeyframes` явно вызывает очистку sampled effect и invalidation; это может перезапустить внутренний compositor effect. Поэтому сохранение объекта WAAPI и layer hint не описывается как доказанная непрерывность внутреннего cc-эффекта.

После изменения113 focused burrow/gesture/floating/621 тестов прошли, включая сохранение двух игроков, точную границу300ms без перемотки при pending-close→open, разворот, cleanup и прежний fresh-player fallback. Это локальная логическая проверка, не измерение нативной плавности. В restart fixture добавлено сохранение bounded диагностики до finally-close: исходный629 publisher attempt1 терял состояние причины после cleanup. Условия успеха, исходные таймауты, прежние JSON/PNG/markers и cleanup сохранены; диагностическая ошибка не заменяет исходную ошибку проверки.

## Нативный PASS и независимый отказ варианта3a9

[Run44508489627](https://github.com/jeep-jim/OSMINOG/actions/runs/44508489627), source`3a9a93020d75ebbfc0f456aebdc0b5999d654010`, attempt1/job135506229500, завершился SUCCESS2026-11-19T10:57:19Z. Все8 source checks прошли; native write занял474590ms, свежий restart9923ms. Реальная замена629→630 завершилась10:56:54Z. Verification artifact14522700344 создан10:57:12Z внутри шага20:22236167байт,281файл, SHA-256`42d114974e2c071e42093e37e46b4776557f4c36b889b511deabdfffbbf79bd5`. Candidate14523515015:275880886байт, SHA-256`7390757b41db00819e801d1ed8cd3d432d2c855038538ad9b83725a35e65431a`. Происхождение, API digest/size, CRC и извлечённые байты проверены независимо.

Полный630 evidence checker принял все17 markers и PNG/JSON. Нативные закрытия дали5 промежуточных кадров в светлой теме и4 в тёмной при прежних300ms; foreground760 samples без нарушения видимости, before/after страницы совпали. Это не полная приёмка: неизменяемый628 trace checker отклонил архив с`Fresh close scenario incomplete/ambiguous: expected 3, found 0`. Его прежний контракт требует настоящие новые игроки после request с null/null, pause-ready и2RAF. Сохранённая пара переиспользовалась, поэтому этих стадий фактически не было. Дополнительное read-only исследование обнаружило ещё и неоднозначность cc models: у закрытий54/58/64 по три starts с properties[4,0,4], повторный opacity model в той же группе. Полная advanced trace проверка не достигнута и PASS ей не приписывается. Этот source не объединён, pin не создан, пакеты не опубликованы.

## Совместимое закрытие новой парой

Следующее исправление сохраняет current paused пару всё время открытой Норы, но при обычном закрытии действительно отменяет её без снятия layer hints, инвалидирует старые callbacks и лишь затем записывает правдивый request с null/null. Дальше создаётся новая обратная пара с прежними pause.ready и двумя реальными RAF. Inline открытый endpoint не меняется; live reversal, immediate, reduced motion и release сохраняют свои отдельные пути. В отличие от source10, игроки не отменяются в момент завершения открытия: они остаются подготовленными до самого действия закрытия.

Это продуктовая правка для сохранения прежнего строгого trace-контракта. Неизменяемый`mouse628-motion-trace.py`, его алгоритм и все native критерии остаются прежними. Устранение неоднозначности cc models и сохранение нативных кадров требуют нового полного прогона; по логике или unit tests они не объявляются доказанными.

После правки113/113 focused burrow/floating-overlay/gesture/621 тестов прошли; отдельный reviewer повторил22/22 burrow tests, syntax и diff checks. Проверены реальные null/null в request,10 прежних стадий, сохранение300ms после500ms ожидания подготовки, оба пути initial open, отменённое/повторное закрытие, live reversal, pending endpoint, reduced motion, immediate и release. Изменены только контроллер анимации и его unit tests; producer smoke и validators не менялись.

## Подтверждение закрытия и точная причина отказа после перезапуска

[Run44512047028](https://github.com/jeep-jim/OSMINOG/actions/runs/44512047028), source`f9a4211ddd197cf320bb4c2fb38f67052a013844`, attempt1/job135518479448, завершён FAILURE2026-11-19T11:18:45Z. Native WRITE прошёл полностью; READ остановился с`Mouse628 motion timeout: restarted Nora opens`. Bind18 и candidate19 пропущены, нового candidate artifact нет. Verification14524018002:21646061байт/267файлов, SHA-256`9c4d01c410379d96fb8077b5f84cfcc8d0fc7a448cdecd9ea3473b958299e141`; digest, размер, CRC и все извлечённые байты сверены. Artifact created11:18:38Z на1секунду позже указанного конца upload20, но внутри точного job; оба исходных timestamp сохранены без нормализации.

Неизменённый`mouse628-motion-trace.py` принял145203events/18clock anchors/spread0.141ms и три fresh close generations54/58/64. Пары cc groups586/654/706 однозначны, Blink targets1691/1990 постоянны, active-phase rejections0. Дополнительные opacity models585/653/705 старый алгоритм самостоятельно отделил по действительным impl origins доplay. Для light closing использованы прежние условия ненаблюдаемого terminal и последующей frame coverage; непрерывность compositor execution этим не утверждается. Полный630 checker правильно отклонил незавершённый restart lifecycle:16/17markers, отсутствует только`MOUSE_629_TWO_FINGER_WHEEL_TUTORIAL_NATIVE_PASS`.

Новая pre-cleanup диагностика точно локализовала отказ READ. До`motion.open()` дело не дошло: очередь`DesktopSurfaces.capture` для4видимых страниц исчерпала общий2500ms бюджет через2502.719ms. Первые две native capture заняли1753.408/2263.842ms; следующие начали только через1807.244/2274.719ms и закончились уже примерно2657/2660ms после начала batch. CompletedIds содержат только2из4, reason`deadline`; backdrop получил complete:false/token:false, сообщил отказ подготовки и закрыл запрос. LastPaint:null, native hold:false, motion history содержит толькоrelease. Окно видно и сфокусировано, navigation epoch и page identities стабильны. Это подтверждённый отказ очереди подготовки после холодного запуска, а не отказ закрывающей анимации. Полная публикация остаётся заблокированной до продуктового исправления и нового полного installed прогона.

## Ограниченная параллельная подготовка после холодного запуска

В`DesktopSurfaces` число одновременно обрабатываемых native readbacks увеличено с2 до4. Снимки страниц и shell`present()` используют общий резерв текущего экземпляра: максимум4запроса и16×1024² outputpixels. Резерв вычисляется до native вызова по размерам viewport и максимальному действительному display scale, полученному из Electron`screen.getAllDisplays()`. При неизвестном масштабе дополнительная работа не запускается; фактические размер и scale ответа проверяются до PNG/bitmap. После deadline, отмены или invalidation резерв остаётся занятым до настоящего завершения native promise и освобождается вfinally. Ожидающие capacity запросы используют тот же прежний общий deadline и снимаются при отмене.

Capture2500ms, paint1500ms, paint8attempts, cumulative16MiPixels и32MiBPNG, точные page/URL/epoch/geometry проверки, all-or-none result и отбрасывание поздних ответов сохранены. Отдельный`DesktopPreviews` остаётся с прежними2workers. Обычный и приватный экземпляры хранят отдельные RAM-данные; предел конкретного`DesktopSurfaces` не описывается как общий process RSS cap. В normal/private install добавлена только передача существующего Electron`screen`.

Для записанных f9 native длительностей сумма1753.407875+2263.842291+849.720708+385.139333=5252.110207ms превышает доступные2×2500=5000worker-ms даже без кодирования. Это расчёт по сохранённым задержкам, не прогноз времени GPU при иной параллельности. Четыре viewport имеют503×864+561×518+2×364×415=1027310DIP², или4109240outputpixels при2x; они укладываются в общий резерв16777216pixels. Эффект на настоящем Mac должен подтвердить новый полный прогон.

34/34 surface unit tests прошли, включая replay записанных f9 native задержек, общий count/pixel pool, Retina/mixed/fractional/unknown scale, oversized image до кодирования, общие guest/shell лимиты, late settlement, отмену waiters и отсутствие скрытого дополнительного native вызова. Replay завершился за2269.417916ms в синтетическом scheduler; не измеренные в нём затраты явно заданы нулевыми и не выдаются за нативную проверку. Дополнительная единственная строка диагностического smoke сохраняет snapshot уже открытой Норы после прежних успешных asserts/PNG; она bounded/best-effort, не добавляет повторного open или readback и не меняет success markers, timeout илиfinally. Удаление этой строки побайтно восстанавливает прежний producer.

Первичные API-описания для resource accounting: [Electron Display.scaleFactor](https://www.electronjs.org/docs/latest/api/structures/display), [screen.getAllDisplays](https://www.electronjs.org/docs/latest/api/screen), [NativeImage representations](https://www.electronjs.org/docs/latest/api/native-image) и [webContents.capturePage](https://www.electronjs.org/docs/latest/api/web-contents#contentscapturepagerect-opts). Используются прежние`stayHidden:true/stayAwake:false`; дополнительные permissions и screen-capture обходы не вводятся.

Итоговая локальная интеграция:96/96 tests PASS в шести наборах`mouse-surfaces`, `mouse-desktops`, `mouse-private`, `mouse-floating-overlay`, `mouse-desktop-slide`, `mouse-desktop-previews`; syntax и diff checks PASS. Независимый reviewer проверил frozen diff и shared reservation/cancellation контракты. Native результат нового исходника пока не получен; ни unit replay, ни review не заменяют полную установленную проверку и проверку выпуска.
