# Mouse Browser 6.0.18 — опубликовано

16 ноября 2026. Выпуск447204733 опубликован2026-11-16T15:13:00Z. Канал `channels/mouse/macos-arm64.json` прочитан после выпуска и указывает6.0.18, blob `ca390a9a83a55393834a9339074f3629afd8e8ee`. Весь публикационный run43893040347/job133389054983 завершился SUCCESS, включая проверку обновлятором установленной6.0.17.

Выпуск: https://github.com/jeep-jim/OSMINOG-Releases/releases/tag/quadro-macos-v6.0.18-arm64
Установщик: https://github.com/jeep-jim/OSMINOG-Releases/releases/download/quadro-macos-v6.0.18-arm64/Mouse-Browser-6.0.18-mac-arm64.dmg

## Точный объём

По прямому поручению владельца основание норки опущено на1px, а высота УМЕНЬШЕНА на3px:32→29px. Это не увеличение вниз. При низе+1px и высоте−3px верх опускается на4px; ширина остаётся36px. Изменены height/min-height32→29 и margin-bottom−4→−5; в прежнем SVG добавлен только preserveAspectRatio="none" для сжатия вертикали без изменения ширины. Контур и градиент сохранены. Плюс12px, hover/keyboard-focus, морда владельца, footer, другие элементы интерфейса и данные профиля не переделаны.

Внутри настоящего ZIP проверены Info.plist и package.version6.0.18, stylesheet/SVG и сохранённые footer/логотип. Обратная замена только двух CSS-значений даёт точный blob опубликованного617 `49cbbdffd25b56d9b53c6c7df18d8867571b3a17`; удаление только нового SVG-атрибута даёт `0d9059f21f232ac7800f9a6ef6d7cb5c76bd38bc`. Сгенерированная картинка не используется как реализация.

## Исходник и нативная проверка

SourcePR152 merged `f1198920dd52f7a33d773862feeeea8bf36b779c`; точный проверенный исходник `ec8054399238fc38bf7df02b5b4996250d1fd2f5` сохранён в ancestry main. Native run43885263986 attempt3/job133382966624 SUCCESS. Первые две попытки отменились до выполнения шагов; повторный запуск не менял код и не отключал проверки. Все восемь связанных проверок исходника в итоге SUCCESS, включая повторную общую macOS-проверку и Chrome-диагностику. Локальные93 целевых теста также прошли, но не заменяли нативные.

Нативные журналы обеих тем: height−3, bottom+1, top+4, width0, divider0, stable=true. Реальные крупные планы `mouse-618-burrow-light.png` и `mouse-618-burrow-dark.png` просмотрены. Сохранены и пройдены проверки кликов, приватности, cookies после перезапуска и настоящий переход6.0.17→6.0.18 с сохранением профиля.

Candidate artifact14238075926, SHA256 `7feec18f4353f9bdfd7bb04689b89532421a0d4c646d2f34bc83225064745746`.
Native verification artifact14237676133, SHA256 `3f17e2bf58e57dad76912367a4f763b2973bc5c39488f5ae675d05d723645f17`.
Оба архива скачаны; SHA256, provenance, версия, размеры и контрольные суммы пакетов независимо проверены.

## Публикация и контроль обновления

Продолжен существующий releasePR36, merged `fe2d0f066bea9ad554c810de00c292c54971090a`. Добавлены точный pin и PUBLISH_BURROW; готовые проверенные пакеты не пересобирались. Проверки публикационного скрипта, хэшей, merged-source/ancestry и сохранения профиля не ослаблялись.

Release run43893040347 повторно установил DMG, проверил подписи и совпадение app.asar между DMG/ZIP, нативную геометрию/действия/приватность, перезапуск и6.0.17→6.0.18. Затем опубликованы пять assets и обновлён прежний статический канал. GitHub release: draft=false, prerelease=true, immutable=false; старые пакеты не перезаписывались, проверка неизменности реализована скриптом.

DMG `Mouse-Browser-6.0.18-mac-arm64.dmg`:128520335байт; SHA256 `511d06203048526c8ceb4a772ce22ffa899bea20fcb05da949be7e345561b151`.
ZIP `Mouse-Browser-6.0.18-mac-arm64.zip`:128541466байт; SHA256 `b69347a52ef03ebb5870f3b0b5fbf0d89315fdd29d2a8419b0b0ecc7919761c7`.
Публичные размеры/digest совпадают с проверенными байтами и каналом. Совместимый Quadro-DMG-алиас содержит те же байты, остальные assets — SHA256SUMS и mouse-build.json.

Настоящий опубликованный модуль обновления6.0.17 анонимно обнаружил6.0.18 через прежний статический канал без GitHub API, скачал весь DMG128520335байт и проверил SHA256. `channel-verification.json`: anonymousDiscovery=true, verifiedDownload=true, oldValidatedBadgeState=true, currentVersionCheck=true. Для уже установленной6.0.18 возвращается current.

Release verification artifact14238327209 скачан; независимо проверен SHA256 `399d403d60c9321b1bb472936a48f68294159827bd4ee07f64ca2b583691a90c`. Прочитаны RELEASE_RESULT.json, CHANNEL_RESULT.json, channel-verification.json и повторные журналы. Подтверждены `MOUSE_618_BURROW_DOWN1_SHORTER3_BOTH_THEMES_PASS`, `MOUSE_618_REAL_617_TO_618_REPLACE_RELAUNCH_PROFILE_PASS` и `MOUSE_PROFILE_COOKIE_RESTART_PASS`.

## Обновление и границы

В обычном режиме: «Обновить» → «Скачать обновление» → «Установить и перезапустить». Профиль `~/Library/Application Support/Trader OS` не удалять. Сборка macOS Apple Silicon остаётся предварительной/ad-hoc, без Developer ID и нотариализации Apple. Защита macOS не отключалась. Проверки runner не являются проверкой личного Mac владельца; на него ничего автоматически не устанавливалось. АвтоЦена, DNS, хостинг и публикации других платформ не изменялись.
