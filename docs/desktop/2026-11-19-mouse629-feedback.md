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

## Дополнительный подтверждённый случай: дробные границы семи панелей

При read-only сверке параллельного [commit9a7def0988c09b7566ebdcd59cf4891c8d4cd67c](https://github.com/jeep-jim/OSMINOG/commit/9a7def0988c09b7566ebdcd59cf4891c8d4cd67c) найден применимый пропуск текущего кандидата: guard снимков в `mouse/desktops.js` сравнивал дробную DOM width с целой native width по допуску <0.5. Реальный BrowserWorkspace округляет левый и правый endpoint отдельно. Например, x=517.4375 и width=183.484375 дают native x=517, right=701 и width=184; разница width составляет0.515625. Корректный снимок отклонялся до hold/showModal с «Размер рабочего стола изменился». Исправление видимости native roots этот более ранний путь не покрывает.

Для этого случая добавлена проверка точного native endpoint box с сохранением отказа для реального несовпадения. Три новые unit-регрессии воспроизводят прежние ошибки (отказ корректного capture, принятие неправильной width183 и пропуск перехода через rounded endpoint), после исправления focused suite71/71 проходит. Добавлен один actual native light-сценарий семи панелей при ширине окна971px: реальные View.getBounds,7decodedPNG, OS-display foreground, идентичность WebContents/scroll/root order до/под/после Норы. Его результат ещё требует нового Mac CI. Source7 [44486207467](https://github.com/jeep-jim/OSMINOG/actions/runs/44486207467), head`6c976402d2669e2a6ee8417988232a9d1f8e6b63`, остаётся диагностическим прогоном editor-hook; даже его успех не заменяет полного прогона следующего исправленного head. Параллельная ветка/PR170 не изменяется и целиком не объединяется.

## Source7: отдельный редактор и foreground прошли; retained motion отклонён

[Run44486207467](https://github.com/jeep-jim/OSMINOG/actions/runs/44486207467), job135430186999, завершил actual markers загрузок/private, затвора в обоих редакторах и нового native foreground Норы. Полный прогон отклонён retained628 проверкой `dark closing paints at least three intermediate frames`: записаны только2intermediate samples, progress0.954068 и0.395619. В native кадрах также только промежуточные Y12 иY182. Geometry mutations и longTasks пусты. Trace полна (115842events, dataLossOccurred:false); во время закрытия видны GPU IOSurface/Dawn waits около128.936ms и100.530ms. Эти наблюдения не устанавливают причинную связь с конкретным продуктовым изменением или тестовым readback.

Verification artifact14510554018 SHA-256`ade502a4fbe1a11d2ef436d2c06dd9e5bd2002dd8c69fb434393b5d5cf77e114`. Source7 не принят. Порог минимум3кадра, длительность300ms и прежние проверки trace сохранены; следующий source включает подтверждённое исправление дробных границ и обязан пройти полный gate.

## Source8: семь панелей прошли; устаревший кадр desktopCapturer после reversal

[Run44487516856](https://github.com/jeep-jim/OSMINOG/actions/runs/44487516856), source`4f3babe8c55d106b1c26d2e8fcccb85aa02eff3a`, job135434573117, завершился failure после нового семипанельного сценария. Его before/during/after и7frozenPNG сохранены. В regular light/reversed случае actual native views/clip roots скрыты, visibilityViolations пуст. DOM Норы сообщает open с top263, но снимок desktopCapturer показывает панель с top≈402: разница≈139 точно соответствует последнему closing sample138.995. Отдельный shell failure PNG уже показывает полностью открытую Нору на top263. Это подтверждённое рассогласование времени наблюдений; исходный failed OS PNG сохраняется.

Артефакт14510829640 SHA-256`8739cb70f93718604fabdf6bf0c35de97c4d85bbe1df85a160bf3584f9c69492`; job started08:25:49Z/completed08:32:25Z, artifact created08:32:16Z. Полный прогон не принят. Для state/foreground assertion добавлено существующее bounded получение свежего кадра: максимум4000ms/20acquisitions после settled endpoint, соответствие current shell title/actions/opaque fill реальному OSdisplay. Каждая попытка сохраняет неизменённые shell/displayPNG, SHA-256 и время, включая rejected frames; повторного воспроизведения анимации нет. Product-анимация300ms, минимум3intermediateframes и pixel/visibility/identity требования не меняются. Новая регрессия на lossless crops реальных source8PNG отклоняет устаревший closing frame139px;31/31frame tests проходят. Полный следующий Mac CI всё ещё обязателен.

## Source9: два отклонённых native прогона и отдельное измерение

Точный source `c8848cfa525b2c48ebbafcf7751be1d26d272590`, [run44489726565](https://github.com/jeep-jim/OSMINOG/actions/runs/44489726565), не принят для публикации. Оба attempt прошли новые headers, загрузки/private, capture и foreground Норы, включая семь панелей и проверку свежести display frame. Независимый checker заново проверил исходные PNG, экспортируемые байты и native identities каждой попытки. До native wheel suite выполнение не дошло: retained628 light-closing gate завершился ошибкой.

- Attempt1, job135441982996: среди 12 сохранённых native frames нет кадра в требуемом промежуточном диапазоне. Renderer observations перескочили с Y13.541 на Y303.856 за171.8ms; trace содержит перекрывающиеся GPU/Viz waits. Artifact14513275006, SHA-256 `eb6c241ba2ee5e7f611083f596c6b94bfc58111ad72dbde9cc4cbbc4a07d78fb`.
- Единственный контролируемый повтор того же source, attempt2/job135447346166: native промежуточный PNG получен, но сохранены только два промежуточных RAF-состояния при требовании трёх. Artifact14514030434, SHA-256 `c42a504b7b1c9d55579400af6aaaf22c079628bf633aa65240daa101784de9eb`. Остальные семь checks source завершились успешно; это не заменяет полный Mac gate.

Для установления причины создан отдельный [diagnostic PR171](https://github.com/jeep-jim/OSMINOG/pull/171) с base `mouse629-feedback`. Его два новых файла не входят в выпуск. Workflow привязывает продукт к исходному c8848, создаёт только app directory и не имеет возможности публиковать пакеты или канал. Временные изменения smoke harness, их SHA и полные исходные результаты архивируются; они не заменяют normal source/publisher gates.

Первый diagnostic [44494877955](https://github.com/jeep-jim/OSMINOG/actions/runs/44494877955) остановился до эксперимента на pixel assertion подтверждения снимка; A/B/C cases отсутствуют. Его artifact14514762173 имеет SHA-256 `f69585f0525d6ebb04514269130ff394944046578fe5a9b0b5e82ca1c24ad947`. Он не сохранил необходимые before/after PNG, поэтому причина этого конкретного отказа не установлена. В следующем diagnostic архив расширен на все prefix PNG/JSON/log; единственный известный pixel failure мог быть записан как FAILED и пропущен только после доказанного восстановления состояния. Это исключение существует только в диагностическом checkout и не применяется к выпуску.

Второй diagnostic [44496245735](https://github.com/jeep-jim/OSMINOG/actions/runs/44496245735), job135464039907, завершил полный prefix без этого исключения и все 12 наблюдений. Artifact14516330046: 188 файлов, SHA-256 `ce49bd74efaf265b7ad31fe761b82963e54e734b9fe629454fa5e19fa6333f74`. Для light/dark выполнен одинаковый порядок A–B–C–C–B–A: A без frame subscription, B с числовыми callback metadata, C с исходным pixel detector и ограниченным хранением bitmap. До каждого закрытия одинаково сняты открытая Нора, углы native display и футер; PNG движущихся кадров кодируются после закрытия.

Числа промежуточных RAF-наблюдений: A — 3/2/3/6, B — 4/3/2/2, C — 3/4/1/2. Все анимации сохранили300ms; все12 traces полны, без data loss. Таким образом, frame subscription и JS-конвертация не являются необходимым условием потери кадров. В A light-06 после play-ready присутствует Dawn wait171.823ms и последующие повторные ожидания; одна задержка подготовки старта не объясняет весь эффект. Это наблюдения CI, а не измерение физического FPS на Mac владельца. A и B/C также имеют различное время ожидания первого capture перед input, что ограничивает сравнение частот.

Следующий отдельный [diagnostic44498721024](https://github.com/jeep-jim/OSMINOG/actions/runs/44498721024) сравнивает default Graphite и `--disable-skia-graphite` в двух процессах одного и того же app на одном Mac runner. Используются fresh profiles и отдельные каталоги результатов, неизменный ASAR hash, прежние12 cases и обязательная проверка реального backend. GPU compositing/rasterization должны остаться enabled. Фиксированный порядок default→off не является рандомизированным аппаратным benchmark. На момент этой записи результат ещё не получен; продуктовый backend не изменён.

## Подтверждение снимка: наблюдение естественной видимой фазы

В успешном diagnostic2 первый DOM sample copy badge был снят при currentTime16.358ms и opacity0.0576627. Native capture вернулся через409.319ms; следующий DOM sample уже имел opacity1/currentTime550.586ms. Фактический PNG показывает бледную начальную фазу, changedPixels6858. Это подтверждает рассогласование произвольных двух RAF и момента наблюдения; оно не устанавливает причину предыдущего отказа без сохранённых PNG.

Узкая правка normal feedback fixture ждёт естественного плато той же существующей CSS-анимации (224–1064ms из1400ms, opacity≥0.99), затем выполняет ровно один capturePage. Второй DOM sample снимается сразу после получения native image, до encoding/диска/clipboard. Оба sample, startTime/currentTime, renderer timeOrigin, время request/receive и исходные PNG сохраняются до assertions. Прежние changedPixels>20, export bitmap equality, normal/reduced motion и cancel/error требования остаются. Повторного export/show, растягивания анимации или изменения продукта нет.

Focused fixture tests21/21 проходят, включая отказ для раннего/просроченного кадра, перезапущенной анимации и другого renderer. Native выполнение этой правки и полный выпускной прогон ещё обязательны. Mouse6.0.29 пока не опубликована.

## Diagnostic3: контрольный default завершён, альтернативный backend отвергнут

[Run44498721024](https://github.com/jeep-jim/OSMINOG/actions/runs/44498721024), job135472513190, завершился09:47:32UTC с общим failure на backend guard второго процесса. Artifact14516976221, 313 файлов, SHA-256 `cb7c8bb3a1c5edff5d14a659f93904f2bf1a03351b98a11242ba63555fd82f37`; API digest, размер33125030байт, ZIP CRC и все извлечённые байты проверены. Оба процесса использовали один ASAR SHA-256 `f019a846608eddc92d4a92593e5d9606675b1391020b953c519251306aad9862`.

Default сохранил GPU compositing/rasterization enabled и Graphite enabled_on, завершил все12 случаев с5–7 промежуточными кадрами. Последовательность light A/B/C/C/B/A:7/7/5/6/5/7; dark:6/5/6/6/6/6. Все4 C случая сохранили подходящий промежуточный native PNG. Это успешное контрольное наблюдение, но не normal release gate и не доказательство постоянного устранения GPU waits.

Процесс с `--disable-skia-graphite` сообщил gpu_compositing/rasterization disabled_software, а OpenGL/WebGL/WebGPU disabled_off. Guard остановил его до A/B/C, поэтому сравнение при сохранённом GPU не состоялось. Флаг в продукт не переносится; следующих backend экспериментов на этом шаге нет. Полный source10 использует штатный backend и подтверждённые узкие исправления готовности fixtures.

## Source10: подготовка перехода до скрытия страницы

При read-only разборе [run44495617866](https://github.com/jeep-jim/OSMINOG/actions/runs/44495617866) параллельного PR170 на8a7acf464e575d09b887b9079ccc2e7f9abeef95 независимо подтверждён дефект, присутствующий и в нашем621/627 fixture. Artifact14514718435, SHA-256 `907fd225f6ed54cd129cd58203c6bcf1eeb056cc49695f0cbd3f2e0b26bbb966`: входящий247×572 PNG не содержит ни одного красного пикселя полосы, хотя DOM уже сообщает полосу236×8 и scrollY137; исходящий PNG содержит7976 синих пикселей. В19 native callbacks красных пикселей0 при11 промежуточных renderer frames и завершённой анимации372.7ms. Данные относятся к родителю исправляющего [commit72679ee](https://github.com/jeep-jim/OSMINOG/commit/72679ee907dda6e7ac134b1f01addee858c4e59a), а не к проверке исправленного кода.

Применена только минимальная readiness часть: pageA получает marker/scroll после подтверждения видимого viewport и до первого скрытия; pageB — после actual view/clip visibility. Каждый helper за≤4000ms/≤8 readbacks обязан подтвердить нативные пиксели полосы с исходным RGB±2 и отдельный пиксель прокрученного Drop после двух guest RAF. WC/URL/epoch/bounds/visibility закреплены до и после readback; original style/scroll сохраняются для прежнего cleanup, попытки и PNG архивируются. Поздняя мутация скрытой страницы удалена. Новых переключений столов нет.

Исходный paintedBands image→bitmap selector сохранён побайтно (837байт, SHA-256 `4f5bfea45c0fbda1c9fb80c0f4c31c33915aafd746be0c171d9cf06c87d89d0c`), как и прежний measurement/cleanup tail, 4000ms capture timeout и motion/layout/identity thresholds. Focused82/82 tests и независимый review проходят; оба feedback файла остаются frozen после21/21 focused tests. Эти результаты не являются native приёмкой: следующий полный source run и отдельный installed publisher обязательны. Диагностические workflow/helper не включены в source10.


## Продолжение после принятия независимого6.0.29

Наш source10/e41e7469, run44500891371, не принят из-за footer radius regression; exact artifact14517218131/SHA256`0d9d8ad532b774ed285c093267387c1228d7c4ac02d4343da633c98ce07ddca6`. Параллельный PR170 уже принят и release PR51 владеет отдельными6.0.29 пакетами. Оставшиеся требования перенесены на его принятую основу как6.0.30; прежние результаты и отклонения этого журнала сохраняются. Продолжение — [журнал630](2026-11-19-mouse630-complete-feedback.md).
