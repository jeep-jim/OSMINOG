# OSMINOG — восстановление производительности и удаление встроенного браузера

Статус: обязательный план следующей разработки. Зафиксирован 07.11.2026 по прямому требованию владельца. Новая сборка не считается готовой и не публикуется до прохождения всех ворот ниже и проверки владельцем.

## 1. Контрольная точка

Владелец указывает **4.0.20** как последнюю версию, которая на его компьютере работала стабильно и без зависаний. Это пользовательское подтверждение, а не вывод из CI. До начала изменений необходимо найти точный исходный commit и пакет 4.0.20, сверить их манифест, ключ расширения и состав файлов. Если пакет/commit не удаётся достоверно восстановить, не выдавать приблизительную сборку за 4.0.20.

## 2. Запрет на расширение функциональности

Пока стабильность не восстановлена:
- не добавлять новые инструменты, панели, анимации, фоновые сканеры, автопоиск или периодические опросы;
- не выполнять OCR, индексацию, сетевые запросы или анализ файлов без явного действия пользователя;
- не переписывать данные проектов и не менять формат хранения без доказанной необходимости;
- не публиковать промежуточные версии только потому, что CI зелёный.

Обычные действия пользователя должны затрагивать только выбранный объект/проект. Остальная система не должна реагировать на копирование, перемещение, открытие или сохранение посторонних файлов.

## 3. План диагностики

1. Зафиксировать точный исходный срез 4.0.20 и получить его в отдельной чистой ветке для воспроизводимого сравнения.
2. Составить diff от 4.0.20 до текущего main, сгруппировать изменения по подсистемам и определить, какие подписки на события, observers, timers, polling, повторные render и загрузки медиа добавились после контрольной версии.
3. На одинаковом компьютере, профиле Chrome и одинаковых тестовых проектах измерить 4.0.20 и текущую версию.
4. Отключать/возвращать подозреваемые подсистемы по одной только в диагностических ветках; фиксировать доказательство влияния до удаления кода.
5. Исправлять первопричину, а не маскировать её отключением полезных пользовательских функций. Сохранять локальные проекты, ключ расширения, Owner Access, чат и нужные AI-подключения.

## 4. Стандартный профиль нагрузки

Сравнивать одни и те же сценарии:
- холодный запуск и открытие существующего проекта;
- проект с 3, 100, 500 и 1 000 объектами;
- проект с 10, 100 и 500 изображениями;
- открыть/закрыть слои, переключить вкладки «Слои / Файлы / Папки»;
- переместить, выделить, изменить размер, приблизить/отдалить холст;
- сохранить, перезагрузить и повторно открыть проект;
- открыть чат, отправить сообщение и переключить провайдера;
- сделать скриншот и сохранить его;
- оставить проект открытым на 20 минут без действий и наблюдать фоновые процессы.

Записывать: холодный запуск, p50/p95 задержки действий, максимальную длительность long task, CPU в простое и во время действий, память процесса/расширения, JS heap до/после нагрузки, число повторных render, число активных таймеров/observer и объём декодированных изображений. Не собирать текст пользователя, содержимое файлов, URL и токены в диагностические логи.

## 5. Ворота производительности

На одной машине и одном наборе данных:
- p95 базовых интерактивных действий — не хуже 4.0.20 более чем на 20%;
- нет зависаний интерфейса на 1 секунду и дольше при обычных действиях;
- в простое нет регулярных задач, сканирующих весь проект или пересоздающих DOM;
- после 20 минут простоя память/heap не растёт непрерывно; повторные циклы открытия/закрытия не дают монотонной утечки;
- повторные рендеры без изменения данных не пересоздают карточки и не декодируют изображения заново;
- сохранение и повторное открытие не теряют объекты, изображения, связи, папки, историю и параметры проекта.

Числа выше — инженерные критерии приёмки; их нужно подтвердить одинаковыми замерами на контрольной версии и кандидате. CI без замеров и без ручной проверки владельца не закрывает этот gate.

## 6. Полное удаление встроенного браузера

Встроенный универсальный браузер OSMINOG больше не разрабатывать и удалить из продукта, а не просто скрыть:
- окно/приложение браузера, вкладки сайтов и URL-панель;
- web-stage, popup-окна и геометрические синхронизаторы;
- встроенный редактор веб-страниц и извлечение DOM/медиа из произвольных сайтов;
- браузерные команды AI (browser_open/tabs/context/read/act/close);
- связанные панели, кнопки, стили, фоновые listeners, MutationObserver, таймеры и сообщения runtime;
- тесты и сборочные ссылки, которые относятся только к встроенному браузеру.

Перед удалением построить граф зависимостей. **Не удалять вместе с браузером** независимые функции: внутренний чат, AI-провайдеры/их сессии, Owner Access, GitHub-доступ, захват скриншотов, импорт файлов, обычное открытие внешних ссылок средствами ОС/Chrome и рабочие столы. Если общий модуль обслуживает браузер и AI-подключения, сначала отделить эти обязанности, затем удалить только браузерную часть.

Исторический файл OSMINOG_BROWSER_ROADMAP.md оставить как архив решений; явно пометить направление встроенного браузера как отменённое владельцем 07.11.2026. Не удалять историю разработки.

## 7. Приёмка и публикация

- Все обязательные runtime, storage, clipboard, folder, chat, provider, project-trash и owner-auth проверки проходят.
- Новые регрессии проверяют отсутствие браузерных entrypoints и отсутствие фоновой активности при простое.
- Все существующие проекты открываются без миграции/потери данных.
- Контрольные замеры сравниваются с 4.0.20; результаты и методика сохраняются как артефакт CI.
- Владелец проверяет кандидата на своём компьютере. До его подтверждения статус runtimeVerified остаётся false.
- Только после этого разрешены merge и публикация через существующий канал обновления. Ручную установку ZIP не подменять штатной кнопкой.

## 8. Порядок работ

P0: восстановить производительность и удалить встроенный браузер без регрессии остальных функций.

P1: после стабильной приёмки — Free/Pro entitlement по docs/PRODUCT_TIERS_AND_PRO_SUBSCRIPTION.md: Free — 3 активных стола и 100 скриншотов в день; Pro — $6.99/месяц и безлимитные столы.

P2: только после отдельной оценки стоимости — синхронизация, история версий, OCR/расширенный поиск и совместный доступ в составе Pro.

Никакая подписка и новая функциональность не являются основанием выпускать нестабильный продукт.

## 9. Findings from the first source comparison (07.11.2026)

The 4.0.20 source baseline has now been located: PR #61 merged at commit e0e9917451ea0553be0126c8f5e068e599fd8928. The comparison to current main is a source comparison; do not confuse it with proof that a particular Chrome ZIP was installed on the owner's machine.

New after this baseline in the current tree:
- collector.js, osminog-collector-background.js and osminog-library.js — clipboard capture, queue handling and material search/OCR;
- osminog-web-stage.js and the browser app/hub — embedded web workspace and popup control;
- current editor.js is 33,648 bytes larger than at the 4.0.20 source commit; current background.js is 3,668 bytes larger. File size alone is not proof of CPU cost.

A concrete algorithmic regression has been found in osminog-windows-folders.js:
- renderLayers was wrapped so every layer redraw scheduled renderDesktopFolders;
- renderDesktopFolders called folderCount twice for each visible folder;
- folderCount rescanned all project objects and folders each time;
- with F visible folders and N objects, this made ordinary redraws O(F*N).

The current stability branch changes this to one pass over objects and one pass over folders, then reuses the count map for all visible folder badges: O(N+F). A browser regression fixture with 60 visible folders and 2,400 objects verifies that one folder render enumerates project objects once and all 60 counts are correct. This is a confirmed code-level complexity fix, **not yet proof that all user-device freezes are resolved**.

Additional conditional hotspot requiring measurement:
- Chrome 4.0.21 release notes explicitly describe offscreen clipboard polling every 1.5 seconds when auto-capture is enabled and the editor is not holding the clipboard event lease. The editor renews the lease every 2.5 seconds while the relevant permission/focus conditions hold; the library also has a 10-second conditional queue-drain timer.
- This path is conditional on the user's auto-capture configuration. Do not disable the user's requested capture workflow blindly. Measure it enabled and disabled, and optimize only with a regression test that preserves capture correctness.

The 4.0.24 layer fix and 4.0.25 I/O recovery addressed earlier, narrower regressions. Their synthetic tests do not establish that the complete 4.0.20 responsiveness baseline has been restored. Continue with the same-machine comparative measurements and owner acceptance.
