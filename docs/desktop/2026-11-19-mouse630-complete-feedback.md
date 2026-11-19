# Mouse Browser6.0.30 — объединение исправлений и завершение обратной связи

## Прямое поручение и версия

Владелец требует сохранить прежние прожилки между окнами, убрать только обводку Норы, открывать Нору перед страницами, переключать внутренние столы двумя пальцами или колесом. Ранее добавлены требования настоящей активности загрузок, визуального затвора/подтверждения снимка и аккуратной пилюли непосредственно под адресной строкой каждой панели. Лендинг отменён: владелец рисует его самостоятельно. Публикация всех этих изменений прямо разрешена. АвтоЦена, DNS, доступы и системные настройки macOS вне этого объёма.

Во время source10 нашего PR169 основной репозиторий принял независимый [PR170](https://github.com/jeep-jim/OSMINOG/pull/170), merge`a5a773c16c2b342f9c7dfaf5334649e1da1f3eca`, exact source`72679ee907dda6e7ac134b1f01addee858c4e59a`. Его [run44498720435](https://github.com/jeep-jim/OSMINOG/actions/runs/44498720435), attempt1/job135472522776, прошёл все8 checks и полный Mac gate. Отдельный [release PR51](https://github.com/jeep-jim/OSMINOG-Releases/pull/51) объединён32babb2e2dc9ed3c6eec6ec7f9f862b42eb2be37; publisher44501476513 повторно проверяет установленный пакет. Его6.0.29 пакеты не заменяются. Наше дополнение переносится на эту принятую основу как6.0.30. Это не разрешает считать6.0.30 опубликованной по исходному PR или частичной проверке.

## Сохранённая принятая основа

В6.0.30 сохраняются actual getVisible reconciliation в browser.cjs, native Nora barrier, preview capturePage с stayHidden:true/stayAwake:false, точное независимое округление endpoints, цвета#c7cfdf/#43536b и scrollbar-only user-origin injection. Принятые Nora wheel thresholds/KEY mouseDesktopWheelHintV2/private learning и629 native UI/scrollbar/tutorial проверки сохраняются. Runtime version в исторических629 fixtures становится6.0.30.

Недоказанное изменение willChange из нашей старой ветки не переносится: burrow-motion.js берётся из принятого main. GPU flags не меняются. Длительность300ms, минимальные intermediate frame gates и алгоритм mouse628-motion-trace-evidence-v2 сохранены.

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

Локально выполнены43 focused feedback/header/page tests и93 focused gesture/Nora tests, syntax/diff checks и независимая сверка root build/dispatcher/workflow/update контракта. Source native gate находится на шагах17–20 (verify,bind,candidate,verification). Строгий upgrade helper закрепляет ранее принятый6.0.29 DMG137744712байт/SHA-256`665fca86eb86f1bd98bca4c72652fb5b0a981fc4f4c6467a66d0683874c6d57c` и требует настоящую6.0.30 startup/READY, удалениеreceipt, сохранениеsentinels иcodesign старого/нового приложения. Полный6.0.30 native source и отдельный installed publisher ещё не выполнялись.

Физический трекпад и установка на Mac владельца не заявляются. Предварительная ad-hoc подпись без Developer ID/нотариализации сохраняется. Точные принятые source/artifact/package/channel факты будут дописаны после их реального получения.

Локальный запуск полного первого workflow test-list через имеющийся Node24.22.3 дал581PASS и7ошибок загрузки зависимостей: ws, @modelcontextprotocol/sdk, @xmldom/xmldom и macOS mouse-mcp-fs.node отсутствуют в этом checkout. Это не полный PASS; npm/runtime/native подготовка и тот же test-list остаются обязательными в Mac CI с Node22. Новых логических assertion failures этот локальный журнал не содержит.
