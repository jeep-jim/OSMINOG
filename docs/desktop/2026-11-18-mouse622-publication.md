# Mouse Browser 6.0.22 — опубликован 18 ноября 2026

## Результат

[Выпуск6.0.22](https://github.com/jeep-jim/OSMINOG-Releases/releases/tag/quadro-macos-v6.0.22-arm64), release449372301, опубликован `2026-11-18T00:37:05Z`. Статический канал `channels/mouse/macos-arm64.json` прочитан после публикации:6.0.22,132133485байт,SHA256 `15af3eabd5da82b4051c1979fb897cb962110ac9236bec883045ee5623cae9f9`. Сначала тот же проверенный DMG был предоставлен владельцу отдельно во время задержки GitHub; теперь завершена и обычная публикация через кнопку обновления.

## Что вошло

Большая поднимающаяся норка с плавными нижними сопряжениями и скруглённым верхом; круглые плюс/закрытие; ровно пять столов и зелёное выделение активного. Старые лишние столы мигрируют без потери вкладок. Плюс выбирает свободный существующий стол.

Нажатие миниатюры показывает увеличенный предпросмотр, отдельное «Перейти» переключает стол. Реальные последние видимые кадры страниц хранятся только в RAM; скрытые страницы не захватываются/не загружаются ради превью. Сохраняются native slide621, уменьшение движения и очистка кэша при приватности/блокировке.

Пять режимов: трейдер5, мессенджеры/поддержка7, разработка/дизайн5, контент/соцсети6, агенты3 с правой панелью. Предложения открываются только на полностью пустом столе; обычные, внутренние и ИИ-вкладки получают только сетку без новых предложенных сайтов.

Agent Mouse: внешний Node utility worker для настроенного OpenAI-совместимого API модели, scoped authenticated loopback CDP-коннектор, chrome-remote-interface SDK, реальные события мыши/ввода, DOM/read/screenshot, node-pty/xterm, задача/логи/постоянный Стоп/Localhost и пиксельный индикатор. Пошаговое подтверждение по умолчанию; опция «Автономно в этом сеансе» даёт отдельно согласованное разрешение на текущую сессию. Stop и смена контекста отзывают соединение и завершают процессы. Папка проекта — рабочий каталог, не OS sandbox. Модель, её имя/API и при необходимости ключ задаёт владелец; ключи не включены в пакет и не сохраняются на диск.

## Исходник и нативные проверки

- [SourcePR157](https://github.com/jeep-jim/OSMINOG/pull/157) CLOSED/MERGED, точный head `a94317ce121de73a9a469b55af8eea900a35921d`, merge `71f943b469ac2678a407ca89f2fe69b6e30990c8`, дерево `d3f19f7601e622b0fb79197678981ca561afd4b0`.
- [Native44204108935, попытка2](https://github.com/jeep-jim/OSMINOG/actions/runs/44204108935/attempts/2), job134467781352 SUCCESS. Все семь companions также SUCCESS: diagnostics44204108642, fullworkspace44204109359 попытка2, graphics44204108676, media44204108649, recovery44204108723, Windows44204108897, macOScompat44204108689. Локально181 Mouse-тест PASS.
- Candidate14382349105,263944417байт,SHA256 `b11f7246ece387b478d4c73ece9e6892985086e2c6db64a7a6c74ad710bc2d9d`. Успешный verification14383451808,6560041байт,SHA256 `5eaa39a11efabe7ab664d12e086141b3a2eb9258c4f6eafa9ff95f40a7378780`. Оба архива и их пакеты независимо скачаны и сверены. Verification14382921987 из первой неуспешной попытки исключён.
- Все пять финальных снимков просмотрены: превью/режимы обеих тем и работающий Agent Mouse. Первые transient native HUD и Chrome canvas failures остаются в истории; неизменные повторные попытки прошли. Проверки не отключались. Общий тест обновления расширения получил150секунд вместо90 при сохранении360секунд внешнего лимита, hashes, manifest-last, единственной загрузки, reload/ACK и сохранения данных; production Chrome не менялся.

## Повторная установленная приёмка и публикация

[ReleasePR41](https://github.com/jeep-jim/OSMINOG-Releases/pull/41) merged `d3db155e41f67926a659c88181ee99058e2f41ea`; проверенный publisher head `18602acebfe671bc48d04c0b4ae32188bddb6dae`. Все три PR-проверки прошли. [Publisher44208496425](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44208496425), попытка1, macOS job134480625447: весь run SUCCESS, включая import, установленный DMG/ZIP, публикацию, канал, настоящий старый updater и upload proof.

Повторно проверены ad-hoc подписи DMG/ZIP приложений, их одинаковый app.asar и внешние agent dependencies, реальные клики/две темы/превью/сохранённые функции/приватность/cookies. Реальная замена6.0.21→6.0.22 с перезапуском и сохранением профиля прошла. Native facts:5столов,7empty-only requests,8сохранённых вкладок,0hidden captures,realThumbnails=true,localModelFixtureRequests=3,externalWorker=true,ptyStdout=true,autonomousActions=true,stoppedListener=true,localhostPreview=true.

После публикации исполнялся настоящий updater6.0.21 из неизменяемого исходника `ecf39b1f4d9de5f1e3eb85fb8f2d86c52bab6848`, без GH_TOKEN и обращения к GitHub API: анонимно обнаружил6.0.22 через static channel, полностью скачал DMG и проверил размер/SHA256; availableVersion для зелёного индикатора подтверждён. Updater6.0.22 вернул current. `channel-verification.json`:anonymousDiscovery=true,verifiedDownload=true,oldValidatedBadgeState=true,currentVersionCheck=true.

Итоговый proof artifact14384753390, `mouse622-release-verification`:6629654байт,SHA256 `afcd743552d53573e9a94c9ca897e702753c9acfabaebba71acd57295f8aae46`. Он независимо скачан и сверён; фактические JSON native/channel прочитаны. Пакеты опубликованы без пересборки/перезаписи старых assets; публичные asset metadata и канал соответствуют pin.json.

| Пакет | Asset ID | Байт | SHA256 |
| --- | ---: | ---: | --- |
| [Mouse-Browser-6.0.22-mac-arm64.dmg](https://github.com/jeep-jim/OSMINOG-Releases/releases/download/quadro-macos-v6.0.22-arm64/Mouse-Browser-6.0.22-mac-arm64.dmg) |761238977|132133485|`15af3eabd5da82b4051c1979fb897cb962110ac9236bec883045ee5623cae9f9`|
| [Mouse-Browser-6.0.22-mac-arm64.zip](https://github.com/jeep-jim/OSMINOG-Releases/releases/download/quadro-macos-v6.0.22-arm64/Mouse-Browser-6.0.22-mac-arm64.zip) |761239232|132480940|`adaf667e65eaeac310bed7dc375ecc141e6a57990a30bc2b1f69ce26fce3b05c`|

Совместимый Quadro DMG alias761239512 содержит те же DMG-байты; это прежняя совместимость канала, не переименование Mouse.

## История задержки GitHub и пределы результата

Первый обычный source merge вернул Internal Error: Git-история main уже содержала точный merge, а PR оставался open/merged=false. Официальный async run44207768489 с bypass_rules=false тоже завершился failed:Pull Request is not mergeable. После отдельного append-only документирования наблюдённых фактов в main GitHub обновил штатную запись PR157 до CLOSED/MERGED=true; root перечитал PR, normal merge endpoint, точные parents/tree и source ancestry. Причина внутреннего рассогласования GitHub не установлена. Историю не откатывали/не переписывали, PR вручную не закрывали, publisher guards не ослабляли. Служебный workflow удалён обычным последующим коммитом; результаты его запуска сохранены. Предыдущая запись о блокере остаётся историей, текущий выпуск завершён.

Модель проверялась через явно локальный детерминированный API fixture; работа конкретного пользовательского Qwen/DeepSeek/облачного аккаунта и личного Mac не наблюдалась. В поставку не входят веса модели, API-ключ или подписка. Сборка macOS Apple Silicon остаётся предварительной/ad-hoc без Developer ID/нотариализации Apple. Профиль `~/Library/Application Support/Trader OS` не удалять. Установка владельцу автоматически не выполнялась. АвтоЦена, REG/mobile, DNS, секреты и другие платформы не менялись.
