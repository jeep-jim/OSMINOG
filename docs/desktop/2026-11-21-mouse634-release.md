# Mouse Browser 6.0.34 — восстановленная приёмка перед публикацией

Дата записи: **21.11.2026**, часовой пояс **Asia/Krasnoyarsk**. Это контрольная точка продолжения предыдущего чата, а не объявление готового релиза. Итог macOS, объединение PR, запуск издателей и проверка публичных каналов должны быть дописаны по фактическим результатам.

## Точные версии и восстановленный контекст

- Исходники проверенного checkpoint: [`c865fe56d81f74a71f63bcf88a2849cf315dbe70`](https://github.com/jeep-jim/OSMINOG/commit/c865fe56d81f74a71f63bcf88a2849cf315dbe70), ветка `fix/mouse634-download-widget`, [PR №185](https://github.com/jeep-jim/OSMINOG/pull/185).
- Подготовка выпуска: [PR №62 в OSMINOG-Releases](https://github.com/jeep-jim/OSMINOG-Releases/pull/62), ветка `release/mouse634-desktop`. Проверяющий код, использованный для текущей независимой приёмки: [`7090a5c5a899ec3fc430a36b752ec5de3c567fb9`](https://github.com/jeep-jim/OSMINOG-Releases/commit/7090a5c5a899ec3fc430a36b752ec5de3c567fb9). На этом checkpoint записи 6.0.34 имели `ready:false`; успешные проверки draft не означали публикацию.
- Предыдущее обсуждение продолжалось после опубликованной 6.0.33. Пользователь прямо подтвердил, что почти завершённую 6.0.34 нужно закончить с уже приложенными ТЗ и скриншотами. Восстановлены оба документа: `searsh_deepseek_markdown_20261120_75d84f.md` и `1_2_deepseek_markdown_20261120_948a3f.md`, а также скриншот места остановки чата.
- Вторая спецификация обрывается на JSON-примере. Отсутствующее продолжение не достраивалось предположениями. Прямое требование владельца о действительно открытых сайтах уточняет первоначальную идею статичных превью.
- Подробная прежняя история сохранена в [записи о поиске](https://github.com/jeep-jim/OSMINOG/blob/c865fe56d81f74a71f63bcf88a2849cf315dbe70/docs/desktop/2026-11-20-mouse634-search.md) и [записи о загрузках, предпросмотре и Норе](https://github.com/jeep-jim/OSMINOG/blob/c865fe56d81f74a71f63bcf88a2849cf315dbe70/docs/desktop/2026-11-20-mouse634-pane-feedback.md). Эти документы и прежние roadmaps не заменяются новой краткой записью.

## Состав этой версии

1. **Собственный визуальный поиск Mouse.** Лупа непосредственно слева от смайлика. Справа — маскот над поисковой строкой и собственный ИИ-диалог; слева — прокручиваемая плиточная выдача с живыми сайтами. Сохранены фильтры «Все», «Видео», «Товары», «Статьи», подгрузка следующих страниц, Open Graph-метаданные и явное открытие результата обычной вкладкой.
2. **Сохранение рабочего пространства.** Поиск временно скрывает обычные страницы, не записывает результаты в сохранённые столы и возвращает исходный рабочий стол после закрытия. Одновременно существуют не более восьми живых поисковых страниц в отдельной временной Chromium-сессии; невидимые страницы освобождаются.
3. **«Показать экран».** Пользователь явно включает наблюдение за выбранным видимым сайтом. Передаются структурированные элементы и доверенные клики; значения полей, сырой клавиатурный ввод, пароли, cookies и снимки не входят в этот контекст. Навигация, закрытие, смена поиска, приватность и модальная блокировка отзывают наблюдение. Контекст отправляется модели вместе с явным вопросом.
4. **Загрузки под своей страницей.** Нижний зелёный индикатор относится к окну, из которого начата загрузка, сохраняет несколько параллельных загрузок и освобождает место после их завершения. Чат и нижний предпросмотр имеют независимых владельцев загрузок. Обновление количества байтов само по себе не меняет геометрию страницы; счётчик непрочитанных загрузок зелёный.
5. **Ссылки из правого веб-чата ИИ.** Внешняя ссылка открывает переиспользуемый нижний предпросмотр в той же колонке; исходный чат остаётся сверху. Закрытие предпросмотра возвращает чату высоту. Перемещение чата переносит связанную страницу; явно перемещённый отдельно предпросмотр становится обычной вкладкой.
6. **Нора и оформление.** Непрошенная шестерёнка удалена из заголовка Норы; действующие настройки в нижней панели сохранены. Затемнение за Норой доведено до opacity 0.24 в обеих темах, при сохранении прежнего появления и нативного барьера. Проверяются одинаковое оформление верхней и нижней панелей, скругления составных снимков, примыкание развёрнутых окон к нижней панели и доступность кнопок при минимальной ширине 800 px.

**Прежний режим документов остаётся строго «Только просмотр».** PDF, DOCX, XLSX и текстовые форматы не получают редактирование или сохранение изменённых исходников в этом выпуске. Сохранены профиль, идентификатор приложения, обычная Chromium-сессия, cookies, столы, приватный режим, Агент и действующие адреса обновлений. Поисковый сервис является метапоиском через собственный SearXNG; выпуск не заявляет создание нового самостоятельного веб-индекса.

Проверенные участки кода: [интерфейс](https://github.com/jeep-jim/OSMINOG/blob/c865fe56d81f74a71f63bcf88a2849cf315dbe70/desktop/mouse/search.js), [контроллер поиска](https://github.com/jeep-jim/OSMINOG/blob/c865fe56d81f74a71f63bcf88a2849cf315dbe70/desktop/mouse-tile-search.cjs), [временные нативные страницы](https://github.com/jeep-jim/OSMINOG/blob/c865fe56d81f74a71f63bcf88a2849cf315dbe70/desktop/mouse-search-views.cjs), [индикаторы загрузок](https://github.com/jeep-jim/OSMINOG/blob/c865fe56d81f74a71f63bcf88a2849cf315dbe70/desktop/mouse/progress-pill.js), [документы](https://github.com/jeep-jim/OSMINOG/blob/c865fe56d81f74a71f63bcf88a2849cf315dbe70/desktop/mouse/documents.js). Read-only review перечисленных изменений не выявил конкретного блокирующего дефекта; `git diff --check` относительно опубликованной базы прошёл. Обзор кода не заменяет проверки установленных пакетов.

## Установочные сборки текущего исходного кода

| Платформа | Проверенный запуск | Состояние этой контрольной точки |
| --- | --- | --- |
| Windows x64 | [44795541070, attempt 1](https://github.com/jeep-jim/OSMINOG/actions/runs/44795541070); [основная задача 136494001806](https://github.com/jeep-jim/OSMINOG/actions/runs/44795541070/job/136494001806); [modern 136504119709](https://github.com/jeep-jim/OSMINOG/actions/runs/44795541070/job/136504119709) | Обе задачи `success`; основной установщик и его доказательства дополнительно приняты независимой проверкой. |
| Linux x64 | [44795541171, attempt 1](https://github.com/jeep-jim/OSMINOG/actions/runs/44795541171); [задача 136494002050](https://github.com/jeep-jim/OSMINOG/actions/runs/44795541171/job/136494002050) | Исходный pipeline `success`; полный независимый проверяющий скрипт также принял AppImage/deb, установочные доказательства и оба перехода 6.0.33 → 6.0.34. |
| macOS arm64 | [44795541096, attempt 2](https://github.com/jeep-jim/OSMINOG/actions/runs/44795541096/attempts/2) | Повторная попытка завершилась ошибкой installed-проверки visual-search по общему лимиту 240000 ms; кандидат не опубликован. Подробности и исправление наблюдаемости ниже. Первая попытка [136494001401](https://github.com/jeep-jim/OSMINOG/actions/runs/44795541096/job/136494001401) закончилась без шагов исполнителя, а не ошибкой теста приложения. |

В `windows-independent-evidence.json` подтверждены `ok:true`, `packageBytesVerified:true` и `manifestBoundToEvidence:true`. Независимая проверка принимает реальные исходные JSON, нативные receipts и декодированные PNG: поиск — 9 стадий, 36 пиксельных проб, максимум 8 живых сайтов и возврат 4 исходных страниц; обе темы; отзыв наблюдения; основные и ИИ-загрузки; предпросмотр; углы снимков; развёрнутые окна и Нора. Сохранён настоящий переход **6.0.33 → 6.0.34** с прежним профилем и отдельными процессами старого/нового приложения. Проверка документов подтверждает 9 неизменённых исходных файлов и 18 отказов записи. Нагрузочная проверка охватывает 20 и 50 живых вкладок на пяти столах; это данные CI, не измерение на устройстве владельца.

Нативная проверка поиска приложения использует собственные HTTP/model fixtures: 4 поисковых запроса, 12 сайтов метаданных, 10 нативных сайтов, 7 модельных запросов. Она не выдаётся за публичный поиск или реальный ответ REG: внешнее соединение принято отдельным запуском ниже. Исходные признаки `physicalUserDeviceVerified:false`, `livePublicSearchVerified:false`, `livePublicModelVerified:false` в этом installed-отчёте сохранены.

В `linux-independent-evidence.json` также получены `ok:true`, `packageBytesVerified:true` и `manifestBoundToEvidence:true`. Проверяющий код той же версии 7090 принял фактические байты обоих Linux-пакетов, sandbox, нативные сценарии, профиль, задачи/нагрузку, медиа, документы и текущий owner634. Отдельно приняты реальные обновления 6.0.33 → 6.0.34 для AppImage и deb. Повторная независимая сверка modern Windows также завершилась успешно; проверен тот же установщик. SHA-256 итогового `windows-modern-independent-evidence.json`: `de362f14942fee055ad0ad921d08539c8a718619114bc1c6467c3edabc5a9e76`.

## Точные пакеты и архивы доказательств

Источник значений: `verified-artifact-inventory.json`; SHA-256 относятся к фактическим скачанным байтам. Пакеты ещё не обозначаются опубликованными ссылками на скачивание.

| Пакет | Размер, байт | SHA-256 |
| --- | ---: | --- |
| `Mouse-Browser-6.0.34-Windows-x64.exe` | 126564744 | `cbca37ebe448747a73da3d4a79c184f5bae8f102e1d07e3aa7a1278f33f2fe4b` |
| `Mouse-Browser-6.0.34-Linux-x64.AppImage` | 137043214 | `dce4eabd4e5bd651359908af7eac7133bceb1f4be5a22d56459163b8dbbe0102` |
| `Mouse-Browser-6.0.34-Linux-x64.deb` | 106620248 | `a526a01cbcec7bbc75c66d1a64fd1eea7961bfa983ab81c5b53e2a9df56bbc4a` |

| Архив | Artifact ID | SHA-256 ZIP |
| --- | --- | --- |
| Windows candidate | [14660550600](https://github.com/jeep-jim/OSMINOG/actions/runs/44795541070/artifacts/14660550600) | `67e29acaee16aac2b328132810d72d422cedb96b5a75c70446579b097069b941` |
| Windows verification | [14659497748](https://github.com/jeep-jim/OSMINOG/actions/runs/44795541070/artifacts/14659497748) | `21fe592ba0784780c28226cab07f0a8fb57147a04059008c0fcb34a37bbe1e19` |
| Windows modern verification | [14660667746](https://github.com/jeep-jim/OSMINOG/actions/runs/44795541070/artifacts/14660667746) | `095cb60379c96a65a940fe7a7feaa59c0a2eca77d149b1174bdc75aaabc9b1c5` |
| Linux candidate | [14658493595](https://github.com/jeep-jim/OSMINOG/actions/runs/44795541171/artifacts/14658493595) | `1107e6ea32c6e991d90758c09233c96b766cee5ba0199983274f09b482c4edb5` |
| Linux verification | [14659017729](https://github.com/jeep-jim/OSMINOG/actions/runs/44795541171/artifacts/14659017729) | `7f8b519ddb6049edf3351e22b06750241dac08966b2a5e525c0f0eb3dc4c611e` |

## Настоящий внешний поиск и ИИ

Последняя сохранённая проверка прошлого чата [44797452740](https://github.com/jeep-jim/OSMINOG/actions/runs/44797452740), [задача 136500658948](https://github.com/jeep-jim/OSMINOG/actions/runs/44797452740/job/136500658948), завершилась `success` **21.11.2026 в 01:57:52 Asia/Krasnoyarsk**. Проверяющий source: `8d959bfbdabfb4d4684bb6d580bbb64b956be440`. Deploy и configure были пропущены: этот запуск проверял работающий сервис и не заменял серверное приложение.

| Реальный сценарий | Результат |
| --- | --- |
| Первая страница | 10 пригодных URL, 1.910 с |
| Вторая страница | 6 пригодных URL, из них 5 новых относительно первой, 1.107 с |
| Видео | 79 пригодных URL, 2.571 с |
| Ответ модели | Переданы 5 реальных ранжированных поисковых фрагментов; получены 177 символов за 2.062 с, включая точный предоставленный адрес `https://www.python.org/` |

Также приняты обычная TLS-проверка, отказ для неверного формата и полные тела ответов Node/curl. В модельном отчёте сохранены `fixture:false`, `visionUsed:false`, `sourceUrlPresent:true`; SHA-256 ответа — `d7f8faa751c61718fec83662dbac7c8e358805609f81cbbae24995f76c3fc74f`.

Независимо скачан [artifact 14658439482](https://github.com/jeep-jim/OSMINOG/actions/runs/44797452740/artifacts/14658439482): **7606 байт**, SHA-256 `e4ef7503bca35a9d9e061d2d05346a4feb5a67b786ce0cd059946f90264c00db`, ZIP CRC корректен. Повторная проверка `validated_reply()` по сохранённым источникам/ответу и проверка хеша, длины и идентичностей source/runtime прошли. Подробный локальный протокол: `mouse634-ai-audit/evidence-note.md`.

Действующая конфигурация поиска — `ceab81766e2c40dd685e72eb2ba71625f1007873`, source facade/engine — `792ff9a458bb0bf98ee442c7cbe7d4483c591b9d`, upstream — `1ebea4a073ec6011bae25c042d97308278184c83`. Подтверждены прежние пределы 512 MiB, 25% одного CPU и 64 задачи. Эти идентификаторы не подменяются SHA диагностического проверяющего кода.

## Известные пределы и оставшееся завершение

**Прежние кратковременные HTTP 502 и зависания получения тела ответа не повторились в итоговой внешней проверке; их первопричина и её устранение не доказаны.** Диагностическая ветка меняла отчётность об ошибках и тесты, а tracked production `services/character/server.py` остался неизменным. Предшествующий diagnostic run остановился на собственном unit-тесте до живой проверки; точный код настоящего отказа 502 им не получен. Поэтому формулировка «502 исправлена» недопустима по имеющимся данным.

DNS `osminog.red` в сохранённом доказательстве не разрешался; десктоп использует уже предусмотренную IP-точку с обычной проверкой CA и IP в сертификате. CAPTCHA/ограничения отдельных поисковых провайдеров видны в отчётах; результаты в принятом запуске поступили от других источников. Нет заявления, что все внешние провайдеры доступны всегда.

По обзору клиентского кода ответ не-2xx отклоняется, ошибка 502 отображается как недоступность ИИ, а выдуманный ответ не создаётся. При поисковой ошибке есть «Повторить». При ошибке ИИ форма вопроса остаётся доступной, но отдельной кнопки повторной отправки нет: вопрос нужно повторно ввести или скопировать из разговора. Это обзор обработки ошибок, а не новый installed-тест 502.

Для завершения остаются принятые установленные сборки нового исходного кода после ограниченной правки диагностики, независимая проверка их точных пакетов и доказательств, затем актуальные pins, необходимые объединения PR и отдельные успешные издатели всех платформ. После публикации требуется обратное чтение публичных пакетов и каналов с проверкой версии, размера и SHA-256. До этих результатов **6.0.34 не объявляется опубликованной**; прежние пакеты 6.0.33 и их доказательства остаются неизменными. macOS сохраняет статус предварительной сборки без Developer ID и нотариализации; защиту системы эта работа не отключает.


## Mac attempt 2: точный сбой и ограниченная правка диагностики

[Задача 136667505787](https://github.com/jeep-jim/OSMINOG/actions/runs/44795541096/job/136667505787) на исходнике `c865fe56d81f74a71f63bcf88a2849cf315dbe70` завершилась ошибкой после успешной сборки DMG/ZIP и установки приложения. Проверки индикаторов загрузки, нижнего предпросмотра ИИ-ссылок, углов снимков и focused chrome прошли. Owner634 остановился на стадии `visual-search` с сообщением `Mouse634 fixed 240000 ms native budget exceeded`; вложенный поиск сохранил стадию `native-wheel-and-page-two`.

[Архив доказательств 14682844000](https://github.com/jeep-jim/OSMINOG/actions/runs/44795541096/artifacts/14682844000) имеет 6499377 байт, SHA-256 `9e03dfe94a0576b5bcc597066e55c9f4cc802ebc78e6c1a90a5e1f17380ae0b9`. Фактические скачанные байты, размер и ZIP CRC сверены. Обе начальные нативные поисковые картинки прошли с первой попытки. Первые два wheel имеют доверенный HTTP receipt и совпадающий preload/main IPC, а scrollTop изменился 0 → 650 → 1300.

Последний сохранённый третий wheel имеет `status:prepared`, корректные identity/focus/pointer/geometry и target WebContents 12, высоту видимой части 89 px. Сохранение происходило до отправки; отсутствие `sentAt` в этом старом JSON **не доказывает**, что событие не было отправлено. При watchdog target 12 уже отсутствовал среди живых WebContents. Точный последующий этап по этому архиву установить нельзя. Кадра состояния после сбоя не сохранилось; начальные успешные PNG им не подменяются.

В `mouse-634-search-smoke.cjs` обнаружены неограниченные ожидания renderer в сборе диагностики и удалении тестового pointer-listener. Когда карточка уходит за экран, её WebContents закрывается; прежняя проверка `isDestroyed()` до вызова JS не исключала закрытие во время ожидания. Это подтверждённый недостаток обработки lifecycle в тесте, но историческая точка зависания данного запуска не объявляется установленной.

Правка ограничивает диагностические ожидания, сохраняет исходную ошибку до них, записывает фактические границы dispatch и завершения wheel до очистки, а очистку завершает только после ответа удаления observer либо подтверждённого уничтожения целевого WebContents. Живая неответившая цель остаётся ошибкой. Сохраняются прежние 10 s для подготовки/доставки wheel, общий watchdog 240 s, доверенные receipts, точное владение страницей, IPC, увеличение scrollTop и все последующие проверки. Product input, paging и интерфейс не меняются. Успешные пакеты Windows/Linux для `c865fe5` не переносятся на изменённый исходный код: требуются свежие полные platform runs.

Локально после окончательной правки прошли 55/55 адресных search/helper/gesture тестов и синтаксическая проверка трёх изменённых файлов. Независимый reviewer отдельно выполнил 17/17 search-smoke тестов и сопоставил протокол с неизменным release parser: 10 s ограничивают `completedAt − startedAt`, а cleanup заканчивается до следующего wheel. Полный базовый `npm test` в этом окружении дал 173/178: пять существующих MCP-host тестов остановились на Unix socket `EPERM`; полный локальный suite не объявляется успешным. Новый искусственный timeout для `libraryService.flush()` не вводится. Нативные CI-прогоны должны подтвердить итоговый исходник.


## Source 5854: новые пакеты, повторный внешний proof и Mac motion checkpoint

Исходник [`5854b271a42fa9d00e77efd19e1ce3137dabff29`](https://github.com/jeep-jim/OSMINOG/commit/5854b271a42fa9d00e77efd19e1ce3137dabff29) содержит только описанную ограниченную правку smoke и сохранённый предыдущий checkpoint. Механизм ввода и продуктовая анимация не менялись.

**Linux принят целиком.** [Run44848160942](https://github.com/jeep-jim/OSMINOG/actions/runs/44848160942), attempt1, job136672903704: source pipeline и независимый frozen7090 replay завершились успешно. Все145 файлов frozen checker сверены с Git blob IDs. Candidate artifact14683474294:243137266bytes,SHA256 `d0b9baaaf9d5175e0877c28aca7f0f3fa541503510635144f6566127f8d5c423`; verification14684207433:17895625bytes,SHA256 `2a42af5dd3f3ab83cafaffa5fc7347bf59ea6f2b3c893a6864d58fd4d3551d5f`. AppImage137047374bytes,SHA256 `5b15e6cb99d2d4b6db1b09470d6718d1947687981d9bd95517c09a5a88af88d0`; deb106622012bytes,SHA256 `9e554105886ab79d31439bb591a07851efa360484b83551376dbcad382f43c76`. ArchiveCRC, manifest/report/package binding, sandbox, task/stress/media/documents/footer/owner634/search и реальные633→634 обновления обоих форматов прошли. CI baseline178/178PASS; дополнительный набор1009PASS,0FAIL,6SKIP. Новый search9549ms,ok/preserved:true; оба wheel завершены с подтверждённым уничтожением targets.

**Свежий внешний поиск и ИИ также приняты.** [Run44797452740 attempt2](https://github.com/jeep-jim/OSMINOG/actions/runs/44797452740/attempts/2), job136673626057, verifier8d959, без deploy/configure. Первая страница16 пригодных URL/1.882s, вторая6URL/0.997s,5новых, видео80URL/2.864s. Реальный AI:5переданных источников,310символов/2.501s, точный supplied URL `https://www.python.org/`, replySHA256 `76e72b9383f569b0bc5296b3c529c2c69749848286476a55c394c923eea848dd`. Artifact14683837296:7648bytes,SHA256 `5342a280ca42908c0219c711fb9d873d09c636f91452c59cea7934a6bcdae43c`. Raw ZIP/CRC, reply hash/citation и полные Node/curl тела сверены отдельно. Configurationceab/engine-facade792/upstream1ebea4 не изменились. Это ещё один успешный образец, не доказательство устранения причины прежних502.

**Mac attempt1 прошёл новый search, но whole run остаётся failure.** [Run44848160977/job136672903124](https://github.com/jeep-jim/OSMINOG/actions/runs/44848160977/job/136672903124). Owner634:ok/restored:true,52447ms; search:ok/preserved:true,16040ms. Все3wheel имеют completed, dispatchReturned, trusted receipt/matchingIPC, scroll0→650→1300→1697 и реальные destroyed receipts без cleanupError. Эта попытка не воспроизвела прежний search watchdog.

Позже retained `--mouse-smoke-write` остановился на `dark closing paints at least three intermediate frames`: записаны2промежуточных rendererRAF/WAAPI кадра вместо≥3. Actual presented intermediate PNG существует; geometry стабильна. Trace complete/dataLossOccurred:false; в CrGpuMain `IOSurfaceImageBacking::WaitForCommandsToBeScheduled::Dawn` интервалы70.595/87.676/79.760ms совпадают с редкими кадрами. Это подтверждает GPU scheduling waits в данном измерении, но общая первопричина этих ожиданий не установлена. Сохранённые diagnostic controls на том же приложении дали7closingframes без subscription и4с subscription, обе пары проходят исходный continuous predicate, вторая также имеет реальный intermediate pixel capture. Исходный failure не заменён этими controls.

[Failure artifact14684821198](https://github.com/jeep-jim/OSMINOG/actions/runs/44848160977/artifacts/14684821198):29513395bytes,SHA256 `1f4c5456aa9519ffbebb797177a34942f9f4852bbc83857d81855f365ececf46`, ZIPCRC336entriesPASS. После независимого разбора запущен **один неизменённый полный Mac повтор**: attempt2/job136677035324. Порог≥3кадра,300ms animation, проверки timeline/nativepixels и все прочие gates сохранены. Успех будущего повторного прогона не будет называться исправлением либо доказательством ложности этой ошибки. На момент checkpoint Windows ещё проходит native acceptance; source/release PR не объединены, публичная634 не объявляется выпущенной.


## Windows 5854 завершён; повторный Mac failure и проверяемая GPU-гипотеза

[Windows run44848160945](https://github.com/jeep-jim/OSMINOG/actions/runs/44848160945), attempt1, source5854: основной job136672903813 завершился SUCCESS в01:23:47UTC, modern136678596380 — SUCCESS в01:37:58UTC. Оба архива независимо пропущены через frozen release7090 проверки, включая native process report, сохранённые и новые UI/task/stress witnesses и реальное633→634 обновление. Fresh GitHub API и frozen verify_source_run подтвердили source/attempt/jobs/timestamps. EXE126567076bytes, SHA256 `1828c01382242c64205f3392ccea305b89eee9a868586d5903a7b12ce9be8d87` одинаков у main и modern. Candidate14685160662:126278480bytes,SHA256 `f110ee04a0b3ebc6b21dc5a69694ba3d54deacc9001f5f2ee423197ba9cace1f`; main verification14684289019:32820847bytes,SHA256 `0658bfa9f6bde32433bb7fba727b98f6eb67a41992c302046ee098ff9edf66a6`; modern14685436489:33456167bytes,SHA256 `49b4e003be6751df7e44acbe8cbe4523aa794374279a7559c9b6abd63cc2bb5e`. Все ZIP CRC проверены. Полный локальный inventory сохранён в `mouse634-audit/source-5854/windows-artifact-inventory.json`.

**Mac attempt2 не принят.** [Job136677035324](https://github.com/jeep-jim/OSMINOG/actions/runs/44848160977/job/136677035324) на том же5854 прошёл owner634:ok/restored:true,59000ms и search:ok/preserved:true,17288ms; все3wheel завершены с matching receipts/IPC и без cleanupError. Затем retained motion завершился ошибкой `light closing paints at least three intermediate frames`. [Artifact14685226072](https://github.com/jeep-jim/OSMINOG/actions/runs/44848160977/artifacts/14685226072):29022489bytes,SHA256 `433c4475d89ef2fbed9c885945c81543b4620d8c053a0bd64c4918227f2eec94`, CRC341entriesPASS. Original failure и diagnostic controls сохранены отдельно.

В original generation54 записаны request43141.0ms, preparation RAF43241.9/43375.4ms, play-request43375.5ms, play-ready-resolved43653.3ms, complete43908.8ms, release43909.3ms. Промежуточных renderer samples два:43653.9ms (translate8.9821px/progress0.96913) и43769.2ms (92.8659px/0.68087). Main timeOrigin1795224331161.3 и renderer timeOrigin1795224485786.6 дают смещение−154625.300049ms. Выбранный capture callback sequence9:main198945.623583ms → renderer44320.323534ms, то есть411.524ms послеcomplete; selector занимает1.288ms, а PNG кодируется после него. Привязку часов отдельно подтверждают пары native/renderer arm/click marks (около2.2ms handoff), enclosing native callback task44318.393–44347.493ms и capture mark44350.3ms. Это исключает selected-PNG encoding как причину предшествующей sparse-RAF ошибки именно этой попытки. Продолжительность enclosing task29.1ms не выдаётся за точную длительность энкодера.

GPU CrGpuMain в окне ошибки ждёт внутри SwapBuffers→ScheduleOverlays→IOSurfaceImageBacking::WaitForCommandsToBeScheduled::Dawn. Например142.221ms@43092.129,147.204ms@43382.610,84.564ms@43561.835,100.689ms@43664.438 и94.410ms@43806.846. Доcomplete большие main/renderer JS tasks не обнаружены (наблюдаемые максимумы12.847/7.861ms в разобранном окне); это локализует измеренный stall в GPU scheduling, но не устанавливает его аппаратную/драйверную первопричину. [Primary Chromium152.0.7977.130 implementation](https://github.com/chromium/chromium/blob/152.0.7977.130/gpu/command_buffer/service/shared_image/iosurface_image_backing.mm) в соответствующем trace scope вызывает WaitAny(future,UINT64_MAX) перед передачей IOSurface CoreAnimation. Actual GPU status:skia_graphite=enabled_on.

Данные не подтверждают, что единственная причина — frame subscription: до её включения baseline уже содержит12Dawn waits (449.033ms из924ms,48.60%), а no-subscription closing control —5waits (258.160ms из464.5ms,55.58%) без Capture/CopyOutput events. No-subscription control закрытия имеет3intermediate frames и проходит исходный predicate. Control с subscription прошёл opening с4frames, но closing capture получил timeout4000ms/11frames; вся пара не объявляется успешной. Исходный failure не заменяется control results.

Отдельная подготовленная правка отложенного PNG сохраняет тот же NativeImage и масштаб, прекращает подписку при исходном выборе и кодирует его после остановки recorder. [Electron44.5.0 FrameSubscriber](https://github.com/electron/electron/blob/v44.5.0/shell/browser/api/frame_subscriber.cc) действительно делает независимую allocPixels/writePixels copy перед callback, поэтому такое хранение технически допустимо. 75/75 адресных тестов и независимый36/36 helper review прошли; пороги и frozen parsers не меняются. Однако поздний callback во второй ошибке не даёт считать эту правку её исправлением. Патч оставлен в отдельном worktree, в release source не включён.

Для проверки GPU-гипотезы готовится отдельный диагностический A/B/A запуск одного installed5854 binary: default / `--disable-features=SkiaGraphite` / default. Каждый trial имеет новый профиль и каталог raw evidence; сохраняются исходные600s whole-smoke/30s exit budgets, все native inputs,300ms motion,≥3frames и реальные intermediate pixels. Проверяется фактический GPU feature status, а не только наличие CLI flag. Это ограниченный эксперимент; его успешность не заменит новый полный source run и отдельную release-приёмку, если понадобится продуктовая правка. На этом checkpoint новая гипотеза ещё не проверена нативно, публикации нет.


## Следующий кандидат: сокращение backdrop layers в непрозрачном chrome

Проверка точных upstream sources изменила выбор эксперимента. [Electron44.5.0 DEPS](https://github.com/electron/electron/blob/v44.5.0/DEPS) закрепляет Chromium152.0.7977.130; в [InitializeGpuModes этой версии](https://chromium.googlesource.com/chromium/src/+/refs/tags/152.0.7977.130/content/browser/gpu/gpu_data_manager_impl_private.cc) HARDWARE_GL исключён для macOS ARM64. Все224 активных Chromium patches Electron44.5.0 просмотрены: изменений соответствующих Graphite/GpuMode функций не обнаружено. Поэтому `--disable-features=SkiaGraphite` не даёт оснований обещать аппаратный Ganesh; возможен SOFTWARE_GL/DISPLAY_COMPOSITOR. Подготовленный A/B/A workflow **не запущен**, а выключение Graphite/GPU не внесено в продукт.

Более узкое наблюдение из обоих original/control trace: renderer имеет47 backdrop-filter surfaces,7 backdrop scopes и обычно67 surfaces всего. Одиннадцать последовательных DrawFrame до closing capture имеют по34 DrawRenderPass; no-subscription closing имеет35/35/34/34/34. Это реальные rendered passes, но bounds и DOM owners всех passes отсутствуют, поэтому они не называются full-window и нельзя приписать каждый wait конкретной кнопке. Длинный147.204ms Dawn span имеет thread CPU0.038ms: это ожидание GPU scheduling, а не147ms работы JS. Сводка сохранена в `mouse634-audit/source-5854/mac-attempt2/mac-visual-load-evidence.json`.

Структурная сверка fixture/source:4main panes ×5headerbuttons=20, AI3buttons+1select=4, footer16исходных controls+desktops/global-zoom=18, Mactraffic3buttons, toolbar/footer2собственных filters;20+4+18+3+2=47. Глобальный генератор этих filters находится в mac-polish.css. Tab titles/close/new-tab и Nora controls уже исключены прежними правилами. Это совпадение счётчиков и структуры, не прямой runtime effect-to-node map.

Уточнение предыдущего baseline: окно до новой closing subscription всё же содержит3CopyOutput; входящий максимальный wait начался до завершения прошлой opening subscription. Оно не является полностью чистым no-readback экспериментом. Отдельный no-subscription closing имеет0Capture/0CopyOutput и всё равно сохраняет Dawn waits; этот вывод остаётся подтверждённым.

Изменение кандидата ограничено одним CSS-файлом: собственные filters выключены у `.toolbar`, `#statusbar` (включая существующий selector открытой Nora), `.pane-head`, `:is(#ai-panel,#ai-chat-pane)>.ai-controls` и их button/select descendants. Верх/низ имеют opaque --bg base, pane/AI headers — непрозрачные градиенты между panel/bg. Backgrounds, gradients, colors, geometry, borders и остальные properties не менялись. Dialog/start-page/library/settings glass не входит в эти селекторы. Новый CSS не меняет private mode, profiles, native inputs, WebContents, GPU flags,300ms/easing,≥3intermediateframes, pixel predicates или frozen release checkers. Независимый review завершён без блокирующих замечаний: проверены specificity в обеих темах/Nora, исключение glass dialogs и собственные position/isolation/z-index у затронутых positioned controls.

Потенциальный визуальный предел оговорён: blur/saturate прозрачной кнопки мог немного менять лежащий под ней градиент или соседние foreground pixels. Полная идентичность всех внутренних пикселей каждой кнопки заранее не доказана. Существующие native gates проверяют exposed chrome colors, theme contrast, footer seam, stationary footer, настоящие промежуточные Nora pixels и .24 scrim; дополнительно требуется просмотр новых native screenshot artifacts. Следующий trace должен показать фактические counters и движение, иначе эта правка не считается устранением native blocker.

После минимального diff прошли114/114 существующих тестов focused chrome/download widget/workspace geometry/desktop motion/controls. CSS syntax проверен esbuild0.28.2 без предупреждений; git diff --checkPASS. Первый локальный запуск без NODE_PATH не нашёл Electron в двух suites; повтор использовал уже установленные dependencies с byte-identical lockfile. Ни первый запуск, ни локальные tests не выдаются за native proof. Helper deferredPNG и диагностический GPU workflow не входят в этот candidate. Публикация и source/release merge ожидают новые полные установленные проверки.


## Source602b: measured Mac improvement, retained623 modal-reference correction

The exact source is `602b9025e5e39cc06983813b676ea3c463cfaa3c`. [Mac run44853206661 attempt1/job136689186392](https://github.com/jeep-jim/OSMINOG/actions/runs/44853206661/job/136689186392) failed later in retained623, after owner634/search and the complete retained628 motion/borderless/content-fit/open-Nora-desktop-slide checks passed. The failure verification ZIP artifact14687110670 is35936689bytes, SHA256`71c001ea8113957e7a0b4a12bf23efde3a8749806244d7a7efd7b3857a4584f0`; CRC446entriesPASS. The original failure screenshot and stack remain archived.

Motion records: light opening18/closing17 intermediate frames, dark opening17/closing18. The unchanged minimum is3, with the same300ms animation and native input/capture predicates. In all measured opening/closing windows, backdrop-filter surface reasons are absent; total surface values are3–4 and DrawRenderPass counts2–4. The prior5854 trace had47 backdrop-filter reasons, usually67 surfaces and34–35passes. New light closing has max Dawn scheduling wait0.710ms and clipped occupancy0.591%; dark closing max2.925ms/2.209%. Previous failed light closing had147.204ms/80.043%. Graphite remains enabled. These are observations from separate runs, not an isolated same-run A/B causal proof or a guarantee for every user device. The bounded sanitized trace reports complete=true, dataLossOccurred=false, limitedEvents=0; droppedEvents755 records sanitizer omissions and is not described as an unfiltered/lossless trace.

The later assert is `Every footer depth has an exposed toolbar reference`, with actual references=[] versus[.25,1.25,2.25], at mouse-634-chrome-reference.cjs:30 → mouse-623-smoke.cjs:26 → mouse-622-smoke.cjs:71. The last native click is #desktops-button in a1008×668 focused window. The actual failure PNG shows fully-open Nora, the toolbar under the scrim and the footer outside it. The fixture measured exposed toolbar hits after showModal made it inert; the earlier628 fixture already handles this by taking a real pre-modal reference.

The minimal correction brings623 to that same guarded mechanism. Per theme, the caller waits its existing painted() helper and captures before the native open click. prepareReference requires the actual expected theme and closed/hidden/closed-phase Nora, checks all original reference depths, samples one NativeImage and archives its actual PNG with size/SHA256 in mouse-623-footer-references.json. Each of six modal captures requires the same theme and viewport, exact deep-equal current header/footer geometry and CSS, fully-open Nora, and records the reference filename. The original12footer probes per state at[.25,1.25,2.25],±3RGB, shapes, fixed curves, content-fit/no scroll, controls accessibility, stationary footer and tab/agent lifecycle checks are unchanged. No modal state, inert property, product behavior, GPU flag, animation/input deadline or frozen release parser is altered. Independent reviews found the additive report fields compatible with frozen7090; native proof still requires a new full run.

[Linux run44853206663/job136689186738](https://github.com/jeep-jim/OSMINOG/actions/runs/44853206663/job/136689186738) is fully successful and independently replayed with frozen7090, whose145tool Git blobs were checked. Candidate artifact14686906200:243136899bytes,SHA256`8b395c0fa2824ba858d6c0b1b7ef3742c02d385f48eeb161e9693a6a654f6873`; verification14686975915:18133377bytes,SHA256`31272444b48941a00bcafe2a7bcb866a677559bf8b9fa62843aedd2d7423752c`. AppImage137047371bytes/SHA256`fa971c1d1867b555e5e9124924693c04bbf38157a22a9c79d4b31af01c73c15c`; deb106621580bytes/SHA256`bfd569c3e2514e9754292e09c95c759af4e652a9f445020e8d885dc270b297bf`. Both actual public633→634 upgrades preserve the closed profile and launch independent old/new processes. Baseline178/178; extended1009PASS/0FAIL/6SKIP; native sandbox4renderers.

Eight Linux focused screenshots in both themes were viewed. All16measured stages preserve header/footer geometry, base colors, gradients and opacity; backdropFilter is now none. Pixel probes pass at capture attempt1. A462pixel dark-Nora difference is confined to the download arrow atx939–966/y795–816, outside it max channel delta7. The final completed activity expired182ms before the native Nora-open click; capture follows opening, so the new normal arrow matches existing expiry behavior while unread badge4 remains. The precise capture timestamp is not recorded, and pixel identity is not claimed.

The seven other602b compatibility/graphics/workspace workflows succeeded. Windows602b remains in native acceptance at this checkpoint. None of these artifacts authorizes publication of a different source head. Both PRs remain unmerged, pins ready:false and no PUBLISH_OWNER files are added. Public search/AI attempt2 evidence recorded above remains separate and unchanged; the earlier502 cause is still unproven.

Local correction validation:43/43targeted testsPASS,0fail/0skip; all three changed JavaScript files pass node --check and git diff --check. Two independent reviews confirmed retained acceptance and frozen7090 compatibility. The exact modal hit-test element was not saved before the failed623 assertion; no specific element identity is claimed. Native acceptance of the corrected source remains pending.


## Source d6f65e: retained623 independently accepted;624 native transition boundary

[Mac run44854934410/job136694793849](https://github.com/jeep-jim/OSMINOG/actions/runs/44854934410/job/136694793849), attempt1, exact head`d6f65ecee75528966af64597881ab9ae2760138e`, passed the complete628 motion and the corrected623 six-state capture, tab lifecycle and ordinary Agent entry. The later failure is `Mouse622 timeout: Agent service restores focus and opens` in mouse-624-smoke.cjs:95. Artifact14687312172 is37076929bytes/SHA256`1876d0a50620f33782cf49981ab7ee22bf88007d0d08a6c0739dd59b9f30bc48`, CRC460entriesPASS. One download transport delivered only36671078bytes and a different hash; it was rejected before extraction and the archive was downloaded again with exact checks. CI was not retried.

Independent623 replay decoded2actual pre-modal PNGs,6reference pixels and72actual footer probes across6states; original±3RGB held. Light baseline92071bytes/SHA256`c61980d8a20a25f7268d584f5d0c6794910cc3217f65b215c4592abde8de2252`; dark104087bytes/SHA256`1f30eb27de7894ef7b234a55ab4a0660308de9b7bced772e8f949f760eff2d82`; both1008×668. Every frame names its correct theme reference. The full623 report SHA256 is`ed5b1d5b17e82fa917c8b128ab851dc15d20aec983b9e29acd0c4675fcdf57b2`. The corrected reference measurement is therefore native-verified, while the whole Mac run remains failed.

The624 pre-finally failure snapshot records actual/native-normal/baseline bounds{x:8,y:33,width:1008,height:668}, focused=true, fullscreen=false, enteredFullscreen=true, leftFullscreen=true, renderer focusPane='',focusAI=false,agentOpen=false. Last posted native assistant point is screen{x:589,y:426}. The622 failure screenshot was taken only after624finally, including internal-fixture cleanup and bounds restoration: its displayed assistant button row cannot be treated as the exact dispatch-time DOM rectangle. No624 native report had been finalized. The historical event recipient and exact dispatch-time transition state are unknown.

Code review identifies a concrete missing precondition in the updated route. Browser action(settings) calls restorePane and awaits pane-restore before showing its nonmodal sidebar. mouse:window pane-restore calls PaneFocus.leave and immediately returns true; AppKit's leave-full-screen event and the saved-frame setImmediate restoration occur later. The624 fixture checked only settings-dialog.open before scrolling/clicking assistant, and waited for the actual native leave event and exact bounds only after that click. The ordinary623 settings→Agent path already passed; this624 path explicitly starts in owned fullscreen. No broad product lifecycle or global input-helper change is justified by these observations.

The correction is restricted to the624 fixture: after opening footer settings, require the real native leave event, non-fullscreen state, cleared renderer focus, visible settings and original bounds stable for the same six consecutive observations used by its initial bounds fixture, within its existing until budget. Only then measure and click assistant. Passive target/window snapshots and a trusted matching click receipt make the next result attributable to the actual input recipient. Retain all post-Agent original-window, exact layout/page identity, disabled-agent, reload and history assertions. No synthetic click, action retry, widened timeout, relaxed pixel/motion predicate or frozen release-parser modification is allowed. This repairs a missing test precondition; the precise historical OS race remains an inference until a native corrected run supplies the new receipt.

[Linux run44854934436/job136694794224](https://github.com/jeep-jim/OSMINOG/actions/runs/44854934436/job/136694794224), attempt1, succeeded and passed independent frozen7090 replay with145Git blobs verified. Candidate14687650808:243138499bytes/SHA256`79cdb95d727acbde9817fdc59f2a2e98245500a5ebe76bcf77ef84f25baf2b59`; verification14687486247:18123594bytes/SHA256`d7ce72132af61f9cf87d8eadc7a80abd60174a24176a3213ab8472dca0059827`. AppImage137047275bytes/SHA256`19452f528affd96790e7c982abdfe7a23e10262827cd53b7793b1f784962a750`; deb106621868bytes/SHA256`c51f39327e50bb0ee8902f50ea0c356f3346432f6f5c60824e60f2e3f7fdfff7`. Both actual633 upgrades passed, sandbox4renderers, owner63430381ms/restored=true, search11070ms. Baseline178/178; extended1012PASS/0FAIL/6SKIP.

All16Linux focused chrome geometry/CSS states match602b, and8native captures pass their first pixel sample. The different completed-download arrow state was checked against its actual activity expiry; no claim of pixel identity is made. The seven other d6f65e compatibility/workspace workflows succeeded. Windows is still in installed acceptance at this checkpoint; subsequent source revisions cannot reuse these bytes as their own proof. Source/release PRs and publication remain pending, with ready:false pins and no PUBLISH_OWNER.

Final624 fixture validation:29/29targeted testsPASS,0fail/0skip, including actual rejection and hanging-Promise diagnostics. Syntax and git diff --check pass. Existing bounded() limits each new diagnostic read/write/dispose to1500ms; failure-path diagnostic errors are recorded without replacing the original input error, while required successful evidence writes still fail strictly. Original input/readiness/painted budgets and all retained product/layout/pixel/motion criteria are unchanged. Final smoke SHA256`f02d335454eeb63f6cd77677cdb79c2078eae3edc57f389d06ba6430b14f4aba`; test SHA256`b91841dcc4a63538508bc05c584b8f90cc8f4ee04176107d39dd7a29f6dcc589`. Corrected native acceptance remains pending.

## 21.11.2026 — 6.0.34, точная причина отказа диагностического снимка 624

Исходный checkpoint [6a7835e38910ca583d9c5892c0249c61ea95b456](https://github.com/jeep-jim/OSMINOG/commit/6a7835e38910ca583d9c5892c0249c61ea95b456) не принят для публикации. В [первой Mac-попытке44857061466](https://github.com/jeep-jim/OSMINOG/actions/runs/44857061466/attempts/1) не пришёл trusted receipt первого клика по Download A; сохранённый кадр показывал открытые ссылки, но dispatch-time координаты не попали в отчёт, поэтому причина этого отдельного отказа не установлена. После проверки неизменности owner634/native-input кода выполнен один диагностический повтор без изменения кликов, лимитов или условий приёмки.

[Mac attempt2/job136703451841](https://github.com/jeep-jim/OSMINOG/actions/runs/44857061466/job/136703451841) прошёл весь owner634 (43512ms, restored:true), visual search (14952ms), прежние проверки628 и623. Затем новый снимок624 упал **до** клика по нижней кнопке настроек: в сериализованном renderer expression свойство `target:{selector,...}` ссылалось на переменную основного процесса, которая не была передана в renderer. Независимое исполнение точной строки в отдельном VM воспроизвело `ReferenceError: selector is not defined`; это подтверждённый дефект добавленной диагностики, а не доказательство отказа пользовательской команды.

Исправление передаёт selector явным сериализованным значением через общий helper, который используется и настоящим smoke, и VM-регрессией. Ввод остаётся одним нативным кликом на каждую команду; шесть последовательных наблюдений завершённого выхода из fullscreen, прежние бюджеты, проверки layout/page identity, отключённого Agent и frozen release validators сохранены.

Адресный набор: **52/52 PASS**, включая исполнение настоящей renderer-строки без внешнего selector, обе кнопки, отсутствующую/скрытую цель, исходные bounds/receipt/error-budget contracts. До исправления все четыре новые VM-проверки воспроизводили именно ReferenceError; независимый review повторил **4/4 PASS** и сравнил старую/новую строки: единственное содержательное изменение — явное значение target.selector. Код поиска, загрузок, настроек, Agent, CSS, GPU-флаги и release validators этим шагом не меняются.

Для6a Linux [44857061369](https://github.com/jeep-jim/OSMINOG/actions/runs/44857061369) принят вместе с точными AppImage/deb, полным frozen7090 replay и обоими фактическими633→634; основной Windows [136701665120](https://github.com/jeep-jim/OSMINOG/actions/runs/44857061566/job/136701665120) также прошёл полную независимую проверку EXE. Это исторические результаты прежнего HEAD: они не подменяют приёмку пакетов следующего исходного кода. SourcePR185 и releasePR62 остаются открыты; публикации6.0.34 нет. Следующий шаг — полный свежий source gate после узкого selectorfix, затем точные pins, merge, свежие publisher gates и обратная проверка публичных пакетов/каналов.

### Сохранённое доказательство отказа Mac6a attempt2

Verification artifact14688329391: **37273543bytes**, SHA-256 `4ecde6cc7df99b26401ff336b9edf9d83a07f597c1f790a7c58cf8b85e34ffc1`, CRC **463entries PASS**; создан2026-11-21T02:57:13Z в пределах job136703451841. Первое raw artifact14688137632 (165638bytes, SHA-256 `387cdde2241ccb0ba41152afddec07f8f06aa191e0f70b1ff2b34d948bd09ab9`) сохранено отдельно. В624 JSON нативная запись содержит только selector/label, `before` отсутствует, `restoreSamples=[]`, `failureEvents=[]`; failure-before-cleanup snapshot повторяет ту же renderer-ошибку. Значит, новая stable restoration barrier ещё не была пройдена, а проверки обновления633/629 этим неуспешным Mac-прогоном не достигнуты.

Полный owner634 и search634 прошли. В retained628 промежуточные RAF18/18/17/18, surfaces3–4 без backdrop surfaces, DrawRenderPass2–4; максимум closing Dawn1.387ms/.943ms. Независимая проверка623 приняла два baseline PNG, шесть состояний,72 footer probes и шесть reference pixels. Эти измерения описывают конкретный CI-прогон и не являются утверждением о производительности устройства владельца или доказательством причины первого пропущенного native receipt.


## 21.11.2026 — принятое дерево bc4cafb и запуск финальных publishers

[PR185](https://github.com/jeep-jim/OSMINOG/pull/185) объединён 03:46:40 UTC. Source `bc4cafb5c2db9cfc80165a7c470c813f0235cd04`, merge `b1b87fb29f74e4917758f27c93ffc775311df32e`, parents `a1fd731555c0f12ecc9e6bad3c7af7e2d9920ee2` и bc4cafb. Merge tree `780b359da490e891ff668ba293a3698c0a762e14` совпадает с протестированным деревом. Все десять workflows завершены SUCCESS.

| Платформа | Принятый run / attempt / job | Независимая проверка |
|---|---|---|
| macOS arm64 | [44859182971](https://github.com/jeep-jim/OSMINOG/actions/runs/44859182971/attempts/2) / 2 / 136714375440 | retained UI, tasks, current feedback, motion, 623 pixels, 624 transition |
| Windows x64 | [44859182960](https://github.com/jeep-jim/OSMINOG/actions/runs/44859182960) / 1 / 136708384007 и modern 136712390489 | один и тот же EXE, обе установки, current/retained native evidence, task/stress, real633 upgrade |
| Linux x64 | [44859183010](https://github.com/jeep-jim/OSMINOG/actions/runs/44859183010) / 1 / 136708352488 | deb и AppImage, sandbox, native evidence, оба real633 upgrade |

Все исходные candidate/verification ZIP сверены по SHA-256, размеру, CRC и привязке к времени точного успешного job. Replay выполнен неизменёнными production validators из `7090a5c5a899ec3fc430a36b752ec5de3c567fb9`.

### Принятые байты

| Пакет | Размер, bytes | SHA-256 |
|---|---:|---|
| Mouse-Browser-6.0.34-mac-arm64.dmg | 139344967 | `fd7bd882aaf948e623b8cb6affec0f9890be959add178cb88250b0a24f45dfab` |
| Mouse-Browser-6.0.34-mac-arm64.zip | 141704355 | `8f3d2e5868c74d759191201ee244df51c06987ee290d2772bc19fe0f93738721` |
| Mouse-Browser-6.0.34-Windows-x64.exe | 126570020 | `ab0762924e28151b66728cf79a024c5fa7956e11b724d7fbe015491d15fb11a0` |
| Mouse-Browser-6.0.34-Linux-x64.AppImage | 137051426 | `6aebb0925d83a5fb505f20dceee969ded130070df96dd2f991eab347466e0f77` |
| Mouse-Browser-6.0.34-Linux-x64.deb | 106622916 | `f18f38d137f8d6a20e3a810abcfb38b34adbb68b55c040f0614fb58e3d0169ae` |

Точные archive IDs/digests сохранены в опубликованном Git-изменении ready pins: [Mac](https://github.com/jeep-jim/OSMINOG-Releases/blob/0ef0ba1bf324701a9f8dfb940457b9f6030f1706/staging/mouse/6.0.34-arm64/pin.json), [Windows](https://github.com/jeep-jim/OSMINOG-Releases/blob/0ef0ba1bf324701a9f8dfb940457b9f6030f1706/staging/mouse/6.0.34-windows-x64/pin.json), [Linux](https://github.com/jeep-jim/OSMINOG-Releases/blob/0ef0ba1bf324701a9f8dfb940457b9f6030f1706/staging/mouse/6.0.34-linux-x64/pin.json). Это сохранение данных выпуска в Git, ещё не утверждение о доступности установщиков.

### Сохранённый отказ первой трассы bc4cafb

Mac attempt1/job136708351787 завершил native CI успешно, но независимый frozen motion gate отклонил lightClosing generation54/group637: `intervening/ambiguous compositor boundary`. State property4 и BEGIN property0 имели одинаковое `ts=519828684`. Collector сохранял полученные числа без округления; исходный JSON не позволял восстановить порядок этих событий. Candidate14689027491 и verification14689487036 остались отклонёнными и не включены в pins.

После двух независимых проверок выполнена одна новая полная запись на неизменённом bc4cafb. Attempt2/job136714375440 и candidate14690027874/verification14690027890 приняты. Все три closing фазы прошли оригинальный parser; 130122 events и 18 clock anchors. Ограничения исходного анализатора сохранены: temporal correlation не является доказательством общей DOM/model identity или непрерывной compositor lifetime и не заменяет native visual gates. Отдельно прошли native visual checks, 72 footer probes с шестью reference pixels и реальная 624 restoration barrier с шестью последовательными стабильными наблюдениями.

Просмотрены 11 свежих принятых Mac PNG: восемь focused chrome, обе темы поиска и Agent restored. Для light Nora штатный capture predicate принял второй кадр; первый кадр сохранён как отклонённый. Проверки Windows выполнены и на Windows Server 2025; Linux принят в обоих форматах. Эти результаты относятся к CI-системам и тестовым профилям, а не к личному устройству владельца.

### Ready pins и узкое исправление release unit fixtures

Commit `1617ca9d891fd0eb36be181fdd7de57614a33fd8` изменил ровно девять файлов: три pin, три release notes, три PUBLISH_OWNER. Их дерево `7cc807535ca45b8b502a46086101cc45352621a4` независимо пересчитано до push. Все offline pin validators прошли; previous baselines оставлены Mac/Windows629, Linux633.

Три release contract jobs затем обнаружили два тестовых дефекта в `test_mouse634_reuse.py`: тесты читали реальные staging pins и всегда ожидали ready:false. До исправления воспроизведены ровно 2 failures из 8. Commit `0ef0ba1bf324701a9f8dfb940457b9f6030f1706` меняет только этот unit test: временные unready/ready fixtures вызывают реальные offline validators, обязательные шесть provenance keys и все остальные исходные invariants сохранены, corrupt-ready/source/archive/native-evidence/owner cases отклоняются.

После исправления: reuse 11/11 без skip; Linux release 15/15; Windows release 60/60; release-bytes 10 PASS и один ранее существовавший frozen draft-only skip. Независимый review повторил 11/11 и подтвердил неизменность всех 13 staged файлов. SHA изменённого теста `fde6d57b27e85bc6b6d56542a50747fe669170119af49872019490f74f5496aa`. Это единственное tools-отличие от frozen7090; production validators, adapters, workflows и исходные пакеты не менялись. Повторная native source сборка не требуется для изменения unit fixture.

Все пять PR contracts на 0ef0ba1 прошли: Mac44863613922, Windows44863613837, Linux44863613834 и registry44863613839/44863613848. [Release PR62](https://github.com/jeep-jim/OSMINOG-Releases/pull/62) объединён 03:58:54 UTC merge `f0cdcc4051e257b56b1710176592007d255349ad`; tree `6dff5f639f282d5b8588846a1dfafd6dec508295` совпадает с принятым release tree.

### Финальный выпуск ещё выполняется

Запущены [Mac44863799449](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44863799449), [Windows44863799470](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44863799470), [Linux44863799473](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44863799473), push/attempt1 на release merge f0cdcc4. Следующие обязательные доказательства: свежая установка именно закреплённых bytes, независимый replay свежего raw, фактические public assets, latest/versioned feeds и receipts настоящих старых updater-модулей. Этот checkpoint не объявляет их выполненными.

Отдельный внешний search/AI run44797452740 attempt2 ранее подтвердил реальные pagination/video и grounded model reply. Причина прежних HTTP502 по-прежнему не установлена и не объявляется исправленной. Mac остаётся Apple Silicon preview без Developer ID/notarization, Windows — unsigned preview. История отказов и разделение проектов сохраняются. Проверки совместимости профиля и идентичности приложения относятся к описанным CI-прогонам; инфраструктура АвтоЦены не затрагивалась.

## 21.11.2026 — итоговая публикация 6.0.34 завершена

**Статус: PUBLISHED / VERIFIED_DOWNLOAD для macOS arm64, Windows x64 и Linux x64.** Предыдущие записи «публикация ожидается», отказанные кандидаты и причины их отклонения выше сохранены как история. Независимая итоговая сверка завершена 2026-11-21T04:23:58.902979+00:00; время ниже — UTC.

Принятый source `bc4cafb5c2db9cfc80165a7c470c813f0235cd04`, source merge `b1b87fb29f74e4917758f27c93ffc775311df32e`, release merge `f0cdcc4051e257b56b1710176592007d255349ad`. Публикуются те же байты, которые закреплены в ready pins и прошли source native CI; новые publisher jobs повторно устанавливают именно эти пакеты. Все три запуска — push/attempt1.

### Фактические publishers и публичные releases

| Платформа | Publisher run / attempt / job | Release ID / tag | Опубликован, UTC |
|---|---|---|---|
| macOS arm64 | [44863799449](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44863799449) / 1 / 136723355962 — SUCCESS | [453431903 / quadro-macos-v6.0.34-arm64](https://github.com/jeep-jim/OSMINOG-Releases/releases/tag/quadro-macos-v6.0.34-arm64) | 2026-11-21T04:15:08Z |
| Windows x64 | [44863799470](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44863799470) / 1 / 136723243899 — SUCCESS | [453433788 / mouse-windows-v6.0.34-x64](https://github.com/jeep-jim/OSMINOG-Releases/releases/tag/mouse-windows-v6.0.34-x64) | 2026-11-21T04:19:05Z |
| Linux x64 | [44863799473](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44863799473) / 1 / 136723235708 — SUCCESS | [453431132 / mouse-linux-v6.0.34-x64](https://github.com/jeep-jim/OSMINOG-Releases/releases/tag/mouse-linux-v6.0.34-x64) | 2026-11-21T04:13:12Z |

### Свежие verification archives и независимый replay

| Платформа | Artifact ID | Размер, bytes | SHA-256 ZIP | CRC entries |
|---|---:|---:|---|---:|
| macOS arm64 | 14690849368 | 38104955 | `e89f5091b21e27686ee6cae762ab22a4e606cc4e8d81e7757333d8b6553bd81e` | 506 — PASS |
| Windows x64 | 14692000338 | 33153132 | `08e1fd81392cf31151fdbf54ba67fe0e189d530691a567afa2524602f491b790` | 506 — PASS |
| Linux x64 | 14691188440 | 18154266 | `fe6b7bfa39cd11bfda33611922af4960358d3c21d0c3b51f16ec3d2a71a6c83a` | 257 — PASS |

Все три архива фактически скачаны, сверены с API digest/размером и проверены по CRC. Независимый полный replay свежего native evidence выполнен исходными production algorithms [frozen7090](https://github.com/jeep-jim/OSMINOG-Releases/tree/7090a5c5a899ec3fc430a36b752ec5de3c567fb9/tools) и прошёл. Свежие reports привязаны к publisher run, а импортированные source reports — к своим исходным run; эти доказательства не подменяют друг друга.

- **Mac:** retained UI, tasks/stress, current feedback и motion — PASS. Отдельно повторно проверены 623: 72 footer probes + 6 reference pixels; 624: шесть последовательных стабильных наблюдений и два доверенных native clicks. Фактические 629 replacement/relaunch и 633→634 checks сохраняют тестовый профиль. Просмотрены пять свежих кадров поиска, Норы и восстановленного Agent. Motion остаётся в исходной области `unique-compositor-starts-and-dom-completion`, `temporal-correlation`, `directIdentityLink:false`, `continuousCompositorLifetimeProven:false`; missing compositor terminals не выдаются за доказанное непрерывное выполнение.
- **Windows:** retained/current feedback, task/stress и фактический 633→634 upgrade — PASS. Task/feedback результат независимого replay совпал с сохранённым результатом publisher. Fresh installed report SHA-256 `b91d0a0c8f48acb1f9dd19b277c195e1a5aa20b221542a0cb13d9e32218ea81f` отличается от source report; именно он опубликован в public verification asset.
- **Linux:** полный frozen replay — PASS; Git blobs всех 145 файлов проверяющего зеркала сверены с frozen7090, результат совпал с publisher evidence, исходный импортированный report сохранился побайтно. Fresh `verificationRun=44863799473/1`, source run `44859183010/1`. Реальные 633→634 процессы: deb PID 3428→3657, AppImage 3774→3900, профили сохранены.

Единственное согласованное tools-отличие от frozen7090 — unit-fixture repair `test_mouse634_reuse.py`, SHA-256 `fde6d57b27e85bc6b6d56542a50747fe669170119af49872019490f74f5496aa`. Уточнение к прежнему checkpoint: отрицательные cases этого теста повреждают metadata claims `verificationArtifact`/`verificationSHA256` в pin, а не native raw. Полные native evidence проверены отдельно неизменёнными production validators.

### Настоящие старые обновляторы

Это отдельная проверка discovery/download, а не обозначение версии всех установленных upgrade-профилей. Receipt получен фактическим publisher; независимый public audit повторно обновлятор не запускал.

| Платформа | Реальный старый модуль | Проверка загрузки и текущей 6.0.34 | SHA-256 receipt |
|---|---|---|---|
| macOS arm64 | 6.0.29 | Анонимное обнаружение/скачивание, точные bytes/SHA и current-version check — PASS | `da619ec302a0ff681f2fca98712eac7cdb02726cd612f3a1e4a2e2b2a5916a92` |
| Windows x64 | 6.0.29 | Анонимное обнаружение/скачивание, точные bytes/SHA и current-version check — PASS | `71ff29a02dfe17e2937850edbc93b4adce2376dfbc699f3b5ece25da377d0efa` |
| Linux x64 | 6.0.33 | Анонимное обнаружение/скачивание, точные bytes/SHA и current-version check — PASS | `5af37b738a1db2a38c899bb75dd9151ade562b57830d1a2e2678380ad81fe38c` |

### Публичные файлы: полное анонимное скачивание

Все 14 assets действительно скачаны; ссылки ниже относятся к существующим releases. Размеры и SHA-256 пакетов совпали с source-ready pins. Mac Quadro DMG alias совпадает с Mouse DMG. Публичные Windows/Linux manifest, verification report и checksum file побайтно совпали с raw именно соответствующего publisher.

| Платформа | Файл | Размер, bytes | SHA-256 |
|---|---|---:|---|
| macOS arm64 | [Mouse-Browser-6.0.34-mac-arm64.dmg](https://github.com/jeep-jim/OSMINOG-Releases/releases/download/quadro-macos-v6.0.34-arm64/Mouse-Browser-6.0.34-mac-arm64.dmg) | 139344967 | `fd7bd882aaf948e623b8cb6affec0f9890be959add178cb88250b0a24f45dfab` |
| macOS arm64 | [Mouse-Browser-6.0.34-mac-arm64.zip](https://github.com/jeep-jim/OSMINOG-Releases/releases/download/quadro-macos-v6.0.34-arm64/Mouse-Browser-6.0.34-mac-arm64.zip) | 141704355 | `8f3d2e5868c74d759191201ee244df51c06987ee290d2772bc19fe0f93738721` |
| macOS arm64 | [Quadro-Browser-6.0.34-mac-arm64.dmg](https://github.com/jeep-jim/OSMINOG-Releases/releases/download/quadro-macos-v6.0.34-arm64/Quadro-Browser-6.0.34-mac-arm64.dmg) | 139344967 | `fd7bd882aaf948e623b8cb6affec0f9890be959add178cb88250b0a24f45dfab` |
| macOS arm64 | [SHA256SUMS.txt](https://github.com/jeep-jim/OSMINOG-Releases/releases/download/quadro-macos-v6.0.34-arm64/SHA256SUMS.txt) | 304 | `8ed7d0d49ae557c2fd780ab11f9b879a12d6ed809f9c0f785d81dd84f981a997` |
| macOS arm64 | [mouse-build.json](https://github.com/jeep-jim/OSMINOG-Releases/releases/download/quadro-macos-v6.0.34-arm64/mouse-build.json) | 6579 | `d2ec589c84aa7134fbad01f05e6b1fce0239f15241546075f4e9a88081ae2f6f` |
| Windows x64 | [Mouse-Browser-6.0.34-Windows-x64.exe](https://github.com/jeep-jim/OSMINOG-Releases/releases/download/mouse-windows-v6.0.34-x64/Mouse-Browser-6.0.34-Windows-x64.exe) | 126570020 | `ab0762924e28151b66728cf79a024c5fa7956e11b724d7fbe015491d15fb11a0` |
| Windows x64 | [SHA256SUMS.txt](https://github.com/jeep-jim/OSMINOG-Releases/releases/download/mouse-windows-v6.0.34-x64/SHA256SUMS.txt) | 103 | `4418fd52e63b6b680eb2a8c7bff2e53c8000560e90c9af8ccfa8a6398d2fa721` |
| Windows x64 | [mouse-windows-build.json](https://github.com/jeep-jim/OSMINOG-Releases/releases/download/mouse-windows-v6.0.34-x64/mouse-windows-build.json) | 12949 | `96d5a060649e066f53e294ac65047004088beafb2898d738d8f78c5d6b2ed1ed` |
| Windows x64 | [mouse-windows-verification.json](https://github.com/jeep-jim/OSMINOG-Releases/releases/download/mouse-windows-v6.0.34-x64/mouse-windows-verification.json) | 10750 | `b91d0a0c8f48acb1f9dd19b277c195e1a5aa20b221542a0cb13d9e32218ea81f` |
| Linux x64 | [Mouse-Browser-6.0.34-Linux-x64.AppImage](https://github.com/jeep-jim/OSMINOG-Releases/releases/download/mouse-linux-v6.0.34-x64/Mouse-Browser-6.0.34-Linux-x64.AppImage) | 137051426 | `6aebb0925d83a5fb505f20dceee969ded130070df96dd2f991eab347466e0f77` |
| Linux x64 | [Mouse-Browser-6.0.34-Linux-x64.deb](https://github.com/jeep-jim/OSMINOG-Releases/releases/download/mouse-linux-v6.0.34-x64/Mouse-Browser-6.0.34-Linux-x64.deb) | 106622916 | `f18f38d137f8d6a20e3a810abcfb38b34adbb68b55c040f0614fb58e3d0169ae` |
| Linux x64 | [SHA256SUMS.txt](https://github.com/jeep-jim/OSMINOG-Releases/releases/download/mouse-linux-v6.0.34-x64/SHA256SUMS.txt) | 207 | `1c3d37c330ec990d89f30e91b6912cb0f6e5e1b17ca55b5ac59c559290a36c7a` |
| Linux x64 | [mouse-linux-build.json](https://github.com/jeep-jim/OSMINOG-Releases/releases/download/mouse-linux-v6.0.34-x64/mouse-linux-build.json) | 14197 | `8b94874193ca71034f89522cc53c29395a82b9a8c917c05b1cd96bd894001614` |
| Linux x64 | [mouse-linux-verification.json](https://github.com/jeep-jim/OSMINOG-Releases/releases/download/mouse-linux-v6.0.34-x64/mouse-linux-verification.json) | 12303 | `c443ad7de3eb0ea1b4f1e3f813ea777693c6222ea2745d6c212e453275431d0c` |

### Каналы обновлений

Mac использует один channel. У Windows и Linux latest и versioned feeds проверены отдельно; внутри каждой платформы они побайтно равны и соответствуют ожидаемым данным фактического publisher.

| Платформа | Проверенный feed | SHA-256 файла |
|---|---|---|
| macOS arm64 | [https://raw.githubusercontent.com/jeep-jim/OSMINOG-Releases/main/channels/mouse/macos-arm64.json](https://raw.githubusercontent.com/jeep-jim/OSMINOG-Releases/main/channels/mouse/macos-arm64.json) | `fbab7910127e0a55c8499d2bd4626978fa7455d28ece726fb44f94130e246e71` |
| Windows x64 | [https://raw.githubusercontent.com/jeep-jim/OSMINOG-Releases/main/platforms/windows/mouse-x64/latest.json](https://raw.githubusercontent.com/jeep-jim/OSMINOG-Releases/main/platforms/windows/mouse-x64/latest.json) | `56457ebef3df74ffb660ad4d5e09203045151905aec4909ed0546d4e8d95f8ec` |
| Windows x64 | [https://raw.githubusercontent.com/jeep-jim/OSMINOG-Releases/main/platforms/windows/mouse-x64/releases/6.0.34.json](https://raw.githubusercontent.com/jeep-jim/OSMINOG-Releases/main/platforms/windows/mouse-x64/releases/6.0.34.json) | `56457ebef3df74ffb660ad4d5e09203045151905aec4909ed0546d4e8d95f8ec` |
| Linux x64 | [https://raw.githubusercontent.com/jeep-jim/OSMINOG-Releases/main/platforms/linux/mouse-x64/latest.json](https://raw.githubusercontent.com/jeep-jim/OSMINOG-Releases/main/platforms/linux/mouse-x64/latest.json) | `d47fd6b5a783d1608f4ca17112c9090d3a81db64da5818ca6c29603ba9655da8` |
| Linux x64 | [https://raw.githubusercontent.com/jeep-jim/OSMINOG-Releases/main/platforms/linux/mouse-x64/releases/6.0.34.json](https://raw.githubusercontent.com/jeep-jim/OSMINOG-Releases/main/platforms/linux/mouse-x64/releases/6.0.34.json) | `d47fd6b5a783d1608f4ca17112c9090d3a81db64da5818ca6c29603ba9655da8` |

### Контрольные суммы независимых итоговых отчётов

Итоговые отчёты рассчитаны из указанных выше raw archives. Проверяемый код доступен по frozen commit, сами CI-архивы — в соответствующих успешных runs.

| Платформа | Fresh replay JSON SHA-256 | Public GET JSON SHA-256 | Итоговый summary SHA-256 |
|---|---|---|---|
| macOS arm64 | `0df4590b876c1ee4b9e855cece2201bcd9d5bb39b64fa3fa7daba3ae1f82e348` | `b973730485652e9f2437f9fadc80aac22a66812078efa3d047e4ab1d2a4bf06e` | `9ed2a6932178e795d6e1e55105e52c5dc8d1c7e96e295fa152373a3b75947b06` |
| Windows x64 | `255c55af5055bd50591a2980f6746cdcdd313e6d0eb292cb3ae768fd45eb9786` | `698396ff1d3d661cec0ddf96ff53479aaf28a71d2d99ad45ed9848fbfe06ed52` | `3bb3c0dd19b2ac98ea3d88a546ab3cc5045bc96c3cc7d7540491fbd6689b23a6` |
| Linux x64 | `38ea42682b32bac45949b9c0f454b1d40a1979a761dce40cb42482f3ec5b379e` | `d4aa1b593424be40ca4bd29670848382f38197ab97d9ad096f7fd294d309a540` | `47308f0b0e4f062fed90f4ca457bf309af91a94390f542f1bdc2ad281c89aa91` |

### Границы итогового результата

Mac — Apple Silicon ad-hoc preview без Developer ID/notarization; Windows — unsigned preview. Проверки выполнялись на CI runners и тестовых профилях. Личный Mac/ПК владельца, физический трекпад и внешние аккаунты этим выпуском не объявляются проверенными. Прежняя причина HTTP502 не установлена: отдельный успешный внешний search/AI run44797452740 attempt2 подтверждает только свой датированный результат. CAPTCHA/429 не обходились. Продуктовые ограничения и незакрытые прежние задачи не переписываются как выполненные.

Обновлены четыре общих журнала и данный журнал, с сохранением предыдущих checkpoint. В MOUSE_BROWSER_ROADMAP новый актуальный блок 6.0.34 вынесен наверх, сводка 6.0.31 сохранена как история. Изменения этой финальной записи относятся только к документации; принятый код приложения и опубликованные пакеты не меняются.
