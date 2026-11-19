# Mouse Browser 6.0.29 — прогресс под шапкой, загрузки и снимки

## Поручение владельца и границы выпуска

19 ноября 2026 владелец остановил работу над предложенным лендингом: дизайн он подготовит в Figma. Текущее поручение — полностью закончить и опубликовать Mouse Browser с уже согласованными возможностями и следующими уточнениями:

- Компактная округлая пилюля прогресса располагается сразу под строкой адреса/шапкой каждой принадлежащей задаче панели. Последнее уточнение отменяет прежнее расположение снизу.
- Скачивание файла должно показывать активность, известный реальный прогресс и результат. Неизвестный размер не превращается в выдуманный процент.
- Успешный снимок/экспорт должен давать заметный визуальный отклик затвора и подтверждение, а не только текст в углу. Отмена или ошибка не показывают успех.
- Публикация включает весь этот набор после обязательных проверок. Существующие данные, профиль, пиксельная мышь, Нора, десктопы и Local MCP сохраняются.

Продукт называется Mouse Browser; домен — mouse.black; исходники — jeep-jim/OSMINOG. Выпуск использует только Mouse workflow и jeep-jim/OSMINOG-Releases.

## Состояние предыдущего выпуска

6.0.28 опубликована 2026-11-19 в 06:54:44 UTC. Публикатор [44473633240, attempt 2](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44473633240/attempts/2) успешно выполнил установку DMG, сохранение профиля при замене 6.0.27, повторные native проверки и анонимное обнаружение/скачивание обновления старым updater. [Публичный релиз](https://github.com/jeep-jim/OSMINOG-Releases/releases/tag/quadro-macos-v6.0.28-arm64) и статический канал прочитаны после публикации.

Базовый DMG для нового реального обновления 6.0.28 → 6.0.29: `Mouse-Browser-6.0.28-mac-arm64.dmg`, 137749805 bytes, SHA-256 `1fdc4dbf48d816e136b4ca08bf6c64a80ed25170a9494307c1b33da068a68241`. Неизменяемый source предыдущей версии — `91ed7fd7e9843b554ef5c00096972c0bd78ff3f4`, updater blob — `c4a9564bc5a7c3cf2c6798b5eade9680ee0e57cf`.

## Изменения 6.0.29

Пилюля занимает строку 28 px непосредственно после `pane-head`, `ai-controls` или заголовка Agent. Видимая пилюля — 24 px с боковыми отступами 8 px и радиусом 999 px, без рамки и тени. Нативная страница начинается под ней; нижние скругления страницы и её замороженного изображения в Норе сохраняются. Задача следует за своей вкладкой. Ручное переключение между задачами не перехватывается загрузкой.

Загрузки получают transient activity из собственной нативной сессии. Индикатор привязан к владельцу и режиму приватности; проценты рассчитаны из полученных байтов и известного общего размера. Загрузка с неизвестным размером остаётся неопределённой. Постоянная нижняя строка не добавляется: основной прогресс находится под адресом, существующая кнопка загрузок получает краткое состояние активности/результата. Приватные метаданные очищаются при закрытии сессии.

Визуальный затвор и подтверждение вызываются после успешного capture/export IPC и находятся вне экспортируемого canvas. Отмена/ошибка не запускают успех. Учитывается reduced motion; звук, новые разрешения и телеметрия не добавляются.

## Задержка прежних native прогонов и правка Норы

В [source run 44467287266 attempt 5](https://github.com/jeep-jim/OSMINOG/actions/runs/44467287266/attempts/5) и [publisher attempt 1](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/44473633240/attempts/1) closing recorder получил только два промежуточных кадра. Обе trace завершены, без потери данных. В source зафиксирован GPU wait `IOSurfaceImageBacking::WaitForCommandsToBeScheduled::Dawn` 181.69 ms; в publisher — `Display::DrawAndSwap` 117.229 ms и `FinishPaintRenderPass` 111.238 ms. Максимальный renderer recorder tick во время движения — соответственно 0.725 и 0.867 ms. Это свидетельство длительных ожиданий presentation; причинную связь с конкретным изменением подтверждает только новый native прогон.

Минимальная правка сохраняет `will-change: transform/opacity` у открытой Норы до закрытия. Завершённые WAAPI players отменяются как раньше; фонового RAF нет. После закрытия, release или reduced motion подсказки освобождаются. Длительность 300 ms, easing и требование минимум трёх промежуточных кадров не изменены.

## Проверка и публикация

Локально выполнены отдельные relevant suites: 76 проверок progress/layout, 77 motion/recorder, 17 package identity/private и 13 renderer activity/shutter проверок. Эти числа описывают отдельные команды и не суммируются в число уникальных тестов. Нативные проверки должны подтвердить реальную установленную сборку 6.0.29, оба оформления, геометрию страницы, сохранение профиля и обновление с опубликованной 6.0.28.

Новый `mouse-629-feedback-smoke.cjs` сохраняет JSON и PNG загрузок/затвора. Retained проверки 6.0.28 запускаются на новом приложении; версии пакета из `app.getVersion()` проверяются как 6.0.29, исторические версии неизменённых fixture-контрактов не подменяются. Публикатор заново проверяет source evidence и installed evidence, хеши точных DMG/ZIP, публичные assets и канал.

На момент этой записи кандидат 6.0.29 ещё не опубликован. Идентификаторы нового native run, точные artifacts и результат публикации дописываются после фактического завершения; старые assets не заменяются.

## Первый Mac CI 6.0.29 — проверка версии исправлена

[Run 44477133738](https://github.com/jeep-jim/OSMINOG/actions/runs/44477133738), source `d976cea3cc65fb2df73b0da6542e9d2dbfafdef4`, прошёл unit/audit/package stages и собрал DMG/ZIP. Установленный smoke остановился сразу после `MOUSE_READY 6.0.29`: в `mouse-smoke.cjs` осталось ожидание версии 6.0.28. Ожидание исправлено на 6.0.29; добавлен локальный контракт соответствия версии упаковки и installed smoke. Все остальные упоминания 6.0.28 проверены: это реальный предыдущий DMG, неизменённые MCP component versions или исторические fixture-контракты, а не ошибочное ожидание версии приложения. Native поведение ещё не проверено этим прогоном; требуется новый полный Mac CI исправленного commit.

## Уточнение владельца: Нора поверх страниц, прожилки и два пальца

Владелец сообщил, что Нора оказывается за вкладками, а удаление цветных межпанельных прожилок слило окна. Он уточнил: снять только обводку Норы, вернуть прежние разделители и использовать два пальца или колесо для внутренних столов Mouse вместо трёхпальцевого системного жеста. Это поручение прямо отменяет прежний three-finger контракт; текущий кандидат до этих исправлений не публикуется.

Базовые CSS из опубликованной 6.0.27 сверены по blob SHA: browser.css `6d6b4d3e09eb6d9a2582e38ac9c153cbbf7cd773`, mouse-616.css `44cf823ee85f493c095f2ffdc600d41037d07ad8`. Возвращены их `--line` backgrounds для divider/stage/branch/split и native roundColor: светлая тема `#c7cfdf`, тёмная `#43536b`; hover/focus/drag сохраняет `--accent`. Только два native corner oracle снова читают этот реальный цвет; border/shadow проверки Норы не отключены.

В OverlayGate устранён появившийся в 6.0.28 early return при surface hold. Он мог оставлять фактический native view или вновь созданный clip root видимым при cached t.visible=false. Возвращён unconditional setVisible(false) для реальных roots, без detach/recreate при hold. Две регрессии воспроизводят старый пропуск; новый native629 foreground proof проверяет реальные View.getVisible(), frame дисплея, root identity, разворот, смену стола, resize и сохранность страниц.

Жесты заменяются на горизонтальный wheel input двухпальцевой прокрутки внутри Mouse и колесо над контролом столов/Норой. Обычная вертикальная прокрутка страницы и потребляемая контентом горизонтальная прокрутка сохраняются. Системный трёхпальцевый BrowserWindow swipe listener удаляется; новая подсказка и V2 learned state соответствуют новому вводу. Проверки используют реальный sendInputEvent mouseWheel и не утверждают физическую проверку пальцев на устройстве владельца.

Во втором CI [44477735249](https://github.com/jeep-jim/OSMINOG/actions/runs/44477735249) приложение прошло запуск/раскладки/drag и остановилось на dark contrast gate. В новом download control была добавлена интерполяция цвета между темами: убрана эта переходная низкая контрастность; порог 4.5 сохранён, диагностика теперь содержит конкретный control/color/background. В feedback producer также устранено смешивание byte/task/DOM observations: они считываются одним renderer turn, actual native layout ожидается до записи; фиксированные bytes hold принадлежат настоящему HTTP fixture.

Принятый полный write-suite 6.0.28 занял 413850 ms в publisher job135391000339. Для добавленных download/capture, foreground и wheel native сценариев общий предел write-process составляет 600 s; существующие per-scenario deadlines, 300 ms motion, минимум кадров и 30 s exit completion не меняются. Новый полный установленный Mac прогон остаётся обязательным.

## Третий source CI: реальные результаты и сетевой fixture

[Run 44481057484](https://github.com/jeep-jim/OSMINOG/actions/runs/44481057484), source `dde180d3d42de6e29bf41425d4c3f8e74482f099`, прошёл unit/audit/build и установленный прогресс в двух темах, но остановился на `broken response terminates`. Artifact14508713445 имеет SHA-256 `19c37141d564ed56eb4e0118b4eca618d6064fbac0ee73429ccdd1167a08f381`. Фактические DownloadItem events содержат несколько автоматических повторов, затем `updated(interrupted)` без terminal done: Chromium оставил resumable item, продукт показывал paused. Native fixture ошибочно ожидал терминальный исход от такого обрыва.

Fixture сохраняет первый настоящий сетевой обрыв и на следующую автоматическую попытку отдаёт настоящий HTTP404, чтобы проверить невозобновляемую ошибку, удаление live item и явный retry с успешными полными байтами. Искусственные события/state, принятие cancelled вместо error и ослабление проверок не применяются. Добавлена запись фактических HTTP requests и focused тест ветвей сервера. Новый installed Mac CI обязателен; source3 не принят для публикации.

## Четвёртый source CI: уменьшение движения и загрузка build tools

[Run44482243441](https://github.com/jeep-jim/OSMINOG/actions/runs/44482243441), source `b6ffecf455eb5d2aeb84300e9b207a094f4f8c9b`, завершил три native feedback markers, включая HTTP error/retry, private downloads и capture/export. Независимая проверка сохранила отказ полного artifact: normal capture CSS находился в reduced-motion ветке (`bladeDisplay:none`, `animationName:none`), а следующий новый Nora suite остановился на `Nora closed before three distinct reversal frames`. Light-open actual display crop/три foreground probes и stable11 native root IDs прошли; reversal/cleanup/restored — нет. Artifact14510120016 SHA-256 `261c0683d98d62e6acfedf0f0298a0b53ec03f4e02e318b36cc758f9ab0d3e64`.

Новые CI producers задают normal motion через scoped CDP no-preference и проверяют фактический matchMedia(false), затем отдельно проверяют reduce и восстанавливают исходное значение. Прежний628UI уже задавал этот baseline. Product-настройки и анимация300ms/минимум3кадра не меняются. Nora cleanup активирует стол-владелец перед закрытием каждой fixture-вкладки, сохраняя existing cross-desk guard. Независимый629 checker требует normal:false и restored===before.

Build step14 в source4 занял308s против61s source3. В source4 паузы до окончания загрузок Electron и icons-bundle составили около120.2s и122.7s; подпись20.4s и упаковка19.9s сопоставимы с прежним прогоном. Корневая причина сетевых пауз журналом не установлена. Добавлено restore/save кэша только загружаемых build tools с ключом от desktop/package-lock.json, сохраняемого после успешной упаковки перед native tests. Сборки приложения и evidence по-прежнему создаются заново. Default cache access permissions не расширяются. В новом source workflow native/bind/candidate/verification имеют номера17/18/19/20;629publisher проверяет именно их.

## Source6: обычный затвор и отдельный editor hook

Запуск3e5d2b2 `44484289149` завершился до runner: jobs=[],failure0s. Причиной в конфигурации был runner.temp на уровне job.env, где runner context недоступен; пути перенесены в step.env/with. Этот запуск не считается native проверкой.

[Run44484475899](https://github.com/jeep-jim/OSMINOG/actions/runs/44484475899), source `9dbbbc6df8383a9532a38dbd55fdae80977f0eba`, прошёл unit/build/cache и нативные main capture normal/reduced assertions. Native suite отклонён на assert.equal(editor,globalEditor): одноразовый fixture hook по getLastWebPreferences().preload не распознал отдельный редактор. Новый hook должен связываться с точным editorEntry при реальном вызове loadURL и реальной ссылкой globalCapture.editor, до первой загрузки UI. Product-поведение не меняется; обязательные global normal/reduced/restore и все остальные native gates сохраняются.
