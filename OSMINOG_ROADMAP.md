# OSMINOG — MASTER ROADMAP & LIVE PROJECT STATE

**Дата актуализации:** 2026-08-28  
**Канонический продукт:** OSMINOG  
**Домен:** `osminog.red`  
**Репозиторий:** `jeep-jim/BriefCraft`  
**Текущая установленная сборка:** **3.10.6 CANVAS CONTROL**  

> Этот файл — живой мастер-документ проекта. Он отвечает одновременно на три вопроса: **что уже было сделано, что реально есть сейчас и что делаем дальше**. После каждого законченного шага он обновляется в GitHub и синхронно дублируется на холсте OSMINOG объектом **OSMINOG ROADMAP — LIVE**. Исторический `OSMINOG_PROJECT_LOG.md` остаётся append-only журналом и никогда не переписывается.

---

## 1. Неподвижные правила проекта

1. Видимое имя продукта — **OSMINOG**. Legacy `BriefCraft/BriefCraft AI/RichCraft` допускаются только во внутренних compatibility identifiers до безопасной миграции.
2. Временный бренд — простой красный круг `#FF2D2D` + `OSMINOG`. Финальный логотип владелец предоставит позже.
3. Фиксированный Chrome `manifest.key`, extension ID, `briefCraft...` storage keys, `.briefcraft.json` и внутренние протоколы типа `briefcraft.patch/v1` сохраняются до отдельной протестированной миграции.
4. GitHub — канонический источник проекта, истории, метаданных релизов и восстановительных точек.
5. Полная сборка считается сохранённой только когда удалённый бинарный файл реально доступен и его размер + SHA-256 совпадают с локально проверенным артефактом.
6. Нельзя заявлять функцию «работающей», если она только собрана/статически проверена, но не прошла реальный runtime-test.
7. Не плодим новые крупные функции, пока существующие подсистемы не сведены в одну понятную архитектуру и не работают согласованно.
8. Любая правка состояния холста AI-агентом идёт по стабильным object/connection IDs и через валидированный patch, а не через текстовое заявление «я сделал».

---

## 2. Текущий канонический baseline — 3.10.6 CANVAS CONTROL

Полученный от владельца архив проверен побайтно как точная текущая сборка:

- Файл: `OSMINOG-Chrome-3.10.6-CANVAS-CONTROL-ROOT.zip`
- Размер: **308710 bytes**
- SHA-256: `c25b2ecfe0ab668993ba83d525fb867efc0f6161ad17e0f6c7e6019de9984f4c`
- Файлов: **52**
- `manifest.json` находится в корне
- Manifest version: **3.10.6**
- Manifest name: **OSMINOG**
- Fixed manifest key: сохранён

Это исходная точка для следующих правок. Никакая более старая ветка/пачка не используется как источник текущего UI.

### Live Presence
На момент создания этого roadmap прямой OSMINOG Browser Presence реально подключён к текущему ChatGPT:

- Project: `Новый мир`
- Project ID: `world-mtayth7j-25lhsc`
- Revision: `117`
- External role: `edit`
- AI получает compact project map, viewport, selection, objects/connections и может запрашивать точные тела/DOM/снимки.

**Следующая задача Presence:** расширить единый snapshot с canvas graph до полного runtime/UI state: открытые окна, provider connections, service tabs, активный чат, attachments, выполняемые задачи и состояние Browser Hub.

---

## 3. Что такое OSMINOG сейчас

OSMINOG — не «чат с холстом» и уже не просто «Figma для промтов». Это локальная визуальная AI-операционная среда проекта:

- бесконечный canvas как визуальная память;
- устойчивые objects и groups;
- nodes/connections как граф контекста и исполнения;
- главный и специализированные AI-агенты;
- Team Room с совместным transcript и execution handoff;
- Provider Registry и Media Crew;
- внутренние provider/browser sessions;
- Code + Markdown Studio;
- реальная локальная папка проекта;
- виртуальные Windows-подобные папки на рабочем столе;
- Browser Presence для внешнего AI-партнёра;
- structured patches для реальных изменений проекта.

Главная продуктовая цель: **человек и подключённые AI-партнёры работают с одним и тем же проектом и буквально “смотрят одними глазами” на одно актуальное состояние.**

---

## 4. История уже построенного ядра

### 3.8.x — устойчивое ядро и AI Presence
- 3.8.8–3.8.10: доказан direct authenticated ChatGPT web-session transport.
- 3.8.11: multimodal image upload.
- 3.8.12: object focus + clipboard/drop attachments.
- 3.8.13: Main + temporary agent chats и tethers.
- 3.8.14: реальные canvas patches и build-from-brief через code/live preview.
- 3.8.17: durable save + фиксированный manifest key.
- 3.8.18: folder-first onboarding, whole-project context, PDF overlay/editing, OWNER device layer.
- 3.8.19–3.8.24: vector tools, providers, Google AI workspace, browser-tab connection UX.
- 3.8.25: доказан DeepSeek direct authenticated hidden web-session transport без записи служебных запросов в видимый consumer chat.
- 3.8.26+: agent relay, ghost/clipboard fixes, observed objects, multi-selection/group frames.
- 3.8.61+: видимый ребрендинг в OSMINOG.
- 3.8.62–3.8.64: OSMINOG chat bridge, Google AI service transport, linked module context, 8-port module connections.

### 3.9.x — TEAM OS
- Общий Team Room вместо изолированных AI-монологов.
- Council / Review / Execute.
- 1–6 rounds.
- Общий transcript.
- `OSMINOGAgentAPI`, `agent_list`, `agent_message`.
- Execute требует реальный `briefcraft.patch/v1`.
- Markdown Studio.
- Browser Hub / отдельное service window.
- Shared movable/resizable window manager.
- Google bridge V4 с freshness/dedupe логикой.

### 3.10.0 — MEDIA CREW
- Provider Registry: 23 chat/image/video/music/voice сервисов.
- Media Crew orchestration surface.
- Team attachments, drag/drop, clipboard/cached screenshot.
- Desktop-first project folder и безопасные project-folder tools.

### 3.10.1 — DESKTOP STABILITY
- Team больше не скрывает canvas.
- Inline thinking/activity strip.
- Реальная жёлтая project-folder icon на OSMINOG desktop.
- Explorer реальной папки.

### 3.10.2–3.10.5 — FOLDERS / UX / RECOVERY
- Telegram-style grouped chat bubbles.
- Universal Ctrl+V image ingestion.
- Windows-like virtual folders.
- 3.10.3 поймал тяжёлый regression: два folder runtime + self-triggering MutationObservers → black screen/high CPU.
- 3.10.4 оставил один folder engine, убрал polling/observer-loop и восстановил производительность.
- 3.10.5: collapsed Layers polish, agent show/hide/rename/collapse, draggable Team bubble, Provider Registry search, Store page, interface text-size presets, восстановление любой virtual folder на desktop.

### 3.10.6 — CANVAS CONTROL
- Окна появляются у последнего owner action point либо по центру, а не в левом верхнем углу.
- Google получает project map + selection + connections + linked context.
- Visual questions могут автоматически прикладывать свежий screenshot.
- Google bridge возвращает rich text/cards/images.
- Connection inspector: color/width/style/dash/arrow + curvature + curveOffset + disconnect/delete.
- Explorer image thumbnails.
- Drag canvas object → folder и folder → canvas.

---

## 5. Что доказано runtime, а что ещё нет

### Доказано/подтверждено
- 3.10.5 запускается у владельца; 3.10.6 установлена как текущая.
- DeepSeek direct authenticated web-session является доказанным рабочим transport и не должен переписываться без причины.
- OSMINOG Browser Presence в текущем ChatGPT теперь реально передаёт live project context.
- 3.10.4 controlled Chromium smoke устранил catastrophic startup loop 3.10.3.

### Требует живой доводки
- Google AI: изображения из OSMINOG chat → реальный multimodal input.
- Google AI: один persistent service session вместо новых чатов/дублей.
- Google AI: один user request → ровно один provider send → один returned answer.
- Browser Hub / внутренние вкладки как единый session runtime для всех providers и ссылок.
- Full Team council→execute runtime path.
- Media Crew autonomous capability parity.
- Markdown/Code/filesystem единая persistence модель.
- Полный regression pass folders, themes, connections, windows после 3.10.6.

---

# 6. ТЕКУЩИЙ UX/STABILITY PASS — НЕ ДОБАВЛЯЕМ НОВЫЕ БОЛЬШИЕ ФИЧИ

Ниже — текущие обязательные пункты владельца. Это ближайший рабочий roadmap.

## P1 — Layers / main project folder

- [ ] В **свёрнутом** Layers rail не показывать содержимое слоёв/списки — только section icons.
- [ ] В **развёрнутом** режиме поменять текущие `+` и folder control местами.
- [ ] `+` сделать маленькой отдельной кнопкой создания folder/object container.
- [ ] Рядом — нормальный main-project-folder control: жёлтая folder icon + текст состояния.
- [ ] Текст зависит от state: `Подключить`, `Открыть`, имя подключённой папки и т.п.
- [ ] Никакой огромной пустой кнопки `+`.

## P2 — Provider/widget icons слева

- [ ] Превратить текущие provider icons из заготовок в полноценные desktop/widget items.
- [ ] Multi-select нескольких widgets.
- [ ] Совместное перемещение выделенных widgets.
- [ ] Создание пользовательских **прозрачных widget folders/containers** по принципу Android folders.
- [ ] Drag providers между контейнерами и desktop.
- [ ] Экономить место без дублирования карточек и панелей.

## P3 — AI chat connection status

- [ ] Убрать `GPT LIVE` и аналогичные дубли названия provider.
- [ ] Использовать единый статус-компонент: зелёная точка + **On**.
- [ ] Статус должен выглядеть одинаково в chat header, settings, Provider Registry, Team и Browser/Session Manager.

## P4 — Agent settings / Connect UX / Poseidon

- [ ] Новый agent/chat без соединения сразу показывает заметную кнопку **Подключить**.
- [ ] Settings не вываливаются вниз поверх чата и не режутся по высоте.
- [ ] Settings открываются как полноценное состояние/аккордеон окна и занимают рабочую область до Save/Close.
- [ ] Settings resize по горизонтали и вертикали через общий window system.
- [ ] Provider chooser показывает реальные provider icons.
- [ ] Provider chooser использует **один общий Provider Registry**, включая 20+ уже добавленных сервисов.
- [ ] `Jarvis` полностью переименовать в **Poseidon**.
- [ ] Poseidon = local device-agent OSMINOG с явными permissions/capabilities.
- [ ] План Poseidon: mic, voice reply, camera, screen, clipboard, files, browser, local automation, device control.
- [ ] Возможности, которые Chrome не может безопасно выполнить сам, идут через native companion / Dev Hub / Native Messaging.
- [ ] Никогда не выдавать скрытый или бессрочный доступ к чувствительным device-функциям без явного разрешения пользователя.

## P5 — Internal Browser / Service Tabs / единая схема соединения

**Главное правило:** всё, что OSMINOG способен открыть внутри себя, **по умолчанию открывается внутри OSMINOG**.

- [ ] Google/DeepSeek/Claude/Gemini/ChatGPT/provider tabs используют единый internal session manager.
- [ ] Ссылки агентов и reference pages также сначала открываются внутри.
- [ ] External Chrome tab — только явное действие `Открыть снаружи` или технический fallback.
- [ ] Убрать дублирование: один provider → один переиспользуемый service session по умолчанию.
- [ ] Новый provider chat/session создаётся только по явной команде пользователя либо после подтверждённой смерти текущей session.
- [ ] Вынести нынешний блок `Внутренние вкладки` из вкладки `Браузер`: это не subsection браузера, а инфраструктура всего OSMINOG.
- [ ] Сделать единый Session Manager доступным из agent settings, Provider Registry, Team, Media Crew и Browser.
- [ ] Browser Hub должен показывать health/state текущей provider session и уметь reopen/reconnect/restart без создания дублей.

## P6 — Agents → рабочие осьминоги, а не зависшие pills на canvas

- [ ] Не оставлять agent pills постоянно на рабочем столе — они дублируют agents в chat.
- [ ] Agents постоянно живут чипами в chat/team UI.
- [ ] На canvas появляется **рабочая осьминожка** только когда агент реально выполняет задачу.
- [ ] Исключение: пользователь явно закрепил agent/node связь на canvas.
- [ ] Нить/tether идёт от agent chip к активной рабочей осьминожке.
- [ ] Study state: осьминожка находится около одного или нескольких исследуемых объектов.
- [ ] Thinking state: отдельная спокойная анимация размышления.
- [ ] Build/Design/Code state: рабочая анимация с инструментами/искрами/роль-зависимыми эффектами.
- [ ] Новая mascot system окончательно становится **octopus state machine**, а не legacy ghost.
- [ ] Детальную графику/персонажей дорисовать отдельным визуальным проходом после функциональной state machine.

### Connection z-order
- [ ] Обычные connections рендерятся низко: сразу над background/canvas и **за окнами/widgets**.
- [ ] Connection не должна перечёркивать поверх рабочие панели.
- [ ] Только hover/selection/edit конкретной связи временно поднимает её поверх интерфейса для редактирования.

## P7 — Browser redesign

Текущий browser/`AI-пространство` признан прототипом.

- [ ] Переделать в нормальный browser surface.
- [ ] Tabs.
- [ ] Address/search bar.
- [ ] Back/forward/reload.
- [ ] Internal/external open intent.
- [ ] Attach current page/result to canvas/context.
- [ ] Downloads/files → project folder/canvas.
- [ ] Использовать **тот же Session Manager** из P5, а не вторую реализацию browser tabs.
- [ ] Отдельный UI/visual pass после стабилизации Provider Sessions.

## P8 — Media Crew UX

- [ ] Убрать `В команду / На стол / Открыть` из каждой provider card.
- [ ] Card становится selectable tile.
- [ ] Один или несколько selected providers → единая contextual toolbar сверху.
- [ ] Общие действия toolbar: `В команду`, `На стол`, `Открыть`.
- [ ] Batch action применяется ко всему selection.
- [ ] Capability tags больше не делать россыпью pill-чипов.
- [ ] Использовать компактную цветную icon + label систему: music/image/video/voice/code/etc.
- [ ] Search сделать примерно вдвое короче.
- [ ] `Разработчикам` перенести в одну строку сразу после search.
- [ ] Developer window = обычное managed window: drag + resize + persisted geometry.

---

## 7. Системная архитектура, к которой сводим существующие части

### 7.1 Один Provider Registry

Не должно существовать отдельных несовместимых списков providers в GPT settings, Team, Media Crew и Browser Hub.

`Provider Registry → Provider Identity → Capabilities → Connection/Session → Agent/Team/Media/Browser consumers`

Для каждого provider единообразно храним:

- id;
- display name/icon/color;
- category;
- capabilities;
- transport type;
- connection state;
- authenticated session state;
- multimodal input/output support;
- last error/health;
- Browser Hub session ID;
- manual-vs-autonomous status.

### 7.2 Один Browser / Service Session Runtime

Ни Google, ни Media Crew, ни Team не создают вкладки самостоятельно.

Все просят у единого менеджера:

`getOrCreateSession(providerId, intent)`

По умолчанию менеджер возвращает существующую live session. Это должно прекратить Google duplicate chats/tabs.

### 7.3 Один Presence / Context Bus

Один проект → один актуальный snapshot → все подключённые AI получают одинаковый контракт.

Canvas context уже работает. Следующий уровень snapshot:

- open managed windows;
- active app mode;
- active chat/thread/agent;
- provider connection states;
- internal service tabs;
- current attachments;
- Team participants/tasks;
- running agent jobs;
- local project-folder status;
- recent UI/runtime changes.

### 7.4 One patch/execution layer

Team, GPT, DeepSeek, Google и будущие providers не должны иметь разные правила записи в проект. Любые canvas mutation проходят один validator/patch layer.

---

## 8. Google AI — ближайший технический приоритет

- [ ] Не создавать новый Google AI chat на каждый запрос.
- [ ] Переиспользовать одну persistent internal Google AI Mode service session.
- [ ] Один OSMINOG request ID → один send.
- [ ] Same-query/in-flight dedupe во всех слоях.
- [ ] Реально загружать attachment image в Google composer; наличие preview в OSMINOG недостаточно.
- [ ] Проверять успешную загрузку/attachment state до Send.
- [ ] Возвращать ровно один новый ответ, а не stale greeting/echo.
- [ ] Возвращать rich cards/images/widgets.
- [ ] Использовать только concise project context + linked context + необходимый screenshot, не giant Presence dump.
- [ ] Все Google service tabs находятся во внутреннем Session Manager.
- [ ] DeepSeek transport при этой работе не менять.

---

## 9. GitHub / релизы — модель как у Чернограма

Начиная с этой точки OSMINOG получает понятный release ledger и rolling prerelease, аналогичный подходу `Chernogram Room Alpha`.

### Rolling development release

Канонический тег разработки:

`latest-osminog-dev`

В assets этого prerelease сохраняются реальные версии. Файл каждой версии уникален и не затирает историю.

Пример naming:

- `osminog-chrome-extension-3.10.6.zip`
- `osminog-windows-X.Y.Z.zip`
- `osminog-macos-X.Y.Z.zip`
- `osminog-web-pwa-X.Y.Z.zip`
- `osminog-android-X.Y.Z.apk`
- `osminog-ios-X.Y.Z.ipa` / store artifact metadata

### Шесть платформ, которые всегда присутствуют в registry

1. `chrome-extension` — **active development**, сейчас 3.10.6.
2. `windows` — planned/native shell, ветка уже зарезервирована.
3. `macos` — planned/native shell.
4. `web-pwa` — planned.
5. `android` — planned.
6. `ios` — planned.

Пока строится Chrome extension, остальные платформы остаются в registry со статусом `planned`, а не изображаются как существующие бинарные сборки.

### Для каждой реальной сборки обязательно

- version;
- codename;
- base version;
- platform;
- artifact name;
- byte size;
- SHA-256;
- manifest/app version;
- source/ref info;
- static-check results;
- runtime verification state;
- release notes;
- rollback/recovery note.

### Recovery rule

- rolling prerelease удобен как каталог разработки;
- подтверждённый стабильный build дополнительно получает immutable recovery ref/tag;
- нельзя считать README/build.json заменой полного бинарного архива.

---

## 10. Репозиторный технический долг

- [ ] Полный current source tree 3.10.6 должен стать детерминированно воспроизводимым из GitHub.
- [ ] Создать canonical source directory для Chrome, не жить вечными micro-patches.
- [ ] Убрать split-brain: старые `CURRENT_STATE.md`, `PROJECT_STATE.md`, `versions/index.json`, старый BriefCraft brand и новый OSMINOG roadmap не должны противоречить друг другу.
- [ ] Visible `BriefCraft Presence`/`BriefCraft ChatGPT App` в MCP/UI перевести на OSMINOG, оставляя legacy protocol names только внутри совместимости.
- [ ] Автоматизировать checks: JS syntax, JSON parse, duplicate IDs, forbidden visible legacy brand, missing refs, ZIP integrity, hash/size.
- [ ] Folder engine regression tests.
- [ ] Startup/performance smoke gate.
- [ ] Provider duplicate-session tests.
- [ ] Google multimodal attachment test.
- [ ] Connection layering/selection tests.
- [ ] Window geometry/migration tests.

---

## 11. Update architecture

Старый folder-selection Native Messaging updater не возвращаем.

Целевая схема:

- Chrome development → **OSMINOG Dev Hub**.
- Chrome beta/stable → Chrome Web Store.
- Windows/macOS → signed native updater.
- Android/iOS → store-native channels.
- Web/PWA → atomic deployment + service-worker versioning.

Dev Hub должен владеть одной детерминированной app directory, проверять hash/signature, хранить rollback и никогда не требовать у пользователя вручную выбирать application-source folder при каждом update.

---

## 12. Порядок выполнения от текущей точки

### Этап A — Project discipline / baseline
- [x] Получен точный текущий ZIP 3.10.6.
- [x] Проверены размер/hash/file count/manifest.
- [x] Presence подключён к текущему ChatGPT.
- [ ] Создать этот MASTER ROADMAP в GitHub.
- [ ] Создать `OSMINOG ROADMAP — LIVE` на canvas.
- [ ] Создать six-platform release registry.
- [ ] Опубликовать точный 3.10.6 ZIP в rolling GitHub prerelease.

### Этап B — Unified Provider/Session foundation
- [ ] P3 unified `● On` state.
- [ ] P4 Connect/settings redesign.
- [ ] P5 single internal Session Manager.
- [ ] Google persistent session + multimodal image transport + dedupe.
- [ ] Extend Presence to UI/runtime state.

### Этап C — Desktop/workspace cleanup
- [ ] P1 Layers/folder dock.
- [ ] P2 widget selection/folders.
- [ ] P6 active octopus agents + connection z-order.
- [ ] P8 Media Crew bulk-selection toolbar.

### Этап D — Browser redesign
- [ ] P7 новый Browser поверх единого Session Manager.

### Этап E — Multi-agent hardening
- [ ] Object leases.
- [ ] Per-agent patch preview.
- [ ] Conflict/merge/rebase UI.
- [ ] Reusable Team templates.

### Этап F — Poseidon / native device capabilities
- [ ] Permission model.
- [ ] Native companion API.
- [ ] voice/mic.
- [ ] camera/screen.
- [ ] device automation.
- [ ] local-first safety/visibility controls.

### Этап G — Platform expansion
- [ ] Windows.
- [ ] macOS.
- [ ] Web/PWA.
- [ ] Android.
- [ ] iOS.

---

## 13. Что НЕ делаем сейчас

- Не добавляем ещё один отдельный provider list.
- Не создаём ещё один browser-tab runtime.
- Не переписываем доказанный DeepSeek transport во время Google repair.
- Не плодим новые постоянно висящие agent pills на desktop.
- Не возвращаем старый updater.
- Не объявляем web-only Media Crew provider автономным агентом.
- Не строим новые крупные поверхности до завершения текущего coherence/stability pass.

---

## 14. Правило синхронизации GitHub ↔ OSMINOG canvas

После каждого законченного изменения проекта:

1. Обновить этот `OSMINOG_ROADMAP.md`: чекбоксы, Current State, Next Action.
2. Добавить append-only запись в `OSMINOG_PROJECT_LOG.md` с фактическим результатом.
3. Обновить canvas object **OSMINOG ROADMAP — LIVE** тем же актуальным содержимым/статусом.
4. Если сделана сборка — обновить six-platform release registry.
5. Если создан бинарный artifact — проверить byte size + SHA-256 и только после совпадения считать его сохранённым.
6. Никогда не заставлять владельца заново пересказывать историю в новом чате.

---

## 15. Definition of Done для следующего стабильного прохода

Следующий UX/stability milestone считается готовым, когда:

- Google видит реальную attached screenshot/image;
- Google не создаёт duplicate chats/sessions;
- все provider/service links по умолчанию открываются внутри OSMINOG;
- один Provider Registry используется всеми поверхностями;
- Connect/settings понятны без захода в скрытые панели;
- Layers/folder dock соответствует утверждённому UX;
- Media Crew имеет bulk selection/actions;
- agents не висят на desktop без работы;
- рабочие octopus states соответствуют задаче;
- обычные connections проходят за окнами;
- Presence видит canvas + UI/runtime state;
- regression smoke не показывает black-screen/high-CPU loop;
- полный build сохранён в GitHub release с подтверждённым hash;
- roadmap и canvas mirror обновлены.

---

## 16. Текущая следующая команда

**Сначала закрепить проектную дисциплину и текущую 3.10.6 как реальный GitHub baseline, затем начать Unified Provider/Session foundation.**

Приоритет исполнения после фиксации baseline:

**P3 → P4 → P5 → Google repair → Presence UI/runtime → P1 → P2 → P6 → P8 → P7.**

Это не очередной feature sprint. Это проход, который заставляет уже построенный OSMINOG наконец работать как **одна система**.
