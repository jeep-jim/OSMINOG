# OSMINOG — MASTER ROADMAP & LIVE PROJECT STATE

**Дата актуализации:** 2026-08-29  
**Канонический продукт:** OSMINOG  
**Домен:** `osminog.red`  
**Репозиторий:** `jeep-jim/BriefCraft`  
**Текущая установленная сборка:** **3.11.16 OCEAN UI POLISH — owner установил; интерфейс работает, но Ocean оказался слишком ярко-бирюзовым, Layers bubble перекрывает панель, а zoom UX требует исправления**  
**Текущий кандидат:** **3.11.17 OCEAN CONTRAST & LAYOUT FIX — собран, static checks PASS, owner runtime pending**  

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

## 2. Текущий установленный baseline — 3.11.2 PROVIDER / SESSION LAYER

- Владелец установил 3.11.2 и прислал несколько runtime-скриншотов: версия отображается в top bar, Ocean workspace загружается, Search Layer, папки и Media Crew визуально открываются.
- Это подтверждает загрузку 3.11.2 на реальном Windows/Chrome, но НЕ считается полным regression provider transports, Team execute, Browser Hub, Google multimodal, folders, connections и Presence.
- 3.11.3 строится поверх этой реальной установленной точки, а 3.10.6 остаётся проверенной восстановительной базой.

### Проверенный восстановительный baseline — 3.10.6 CANVAS CONTROL

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

# 6. НОВОЕ НАПРАВЛЕНИЕ — OCEAN SHELL

Владелец утвердил полный interface-shell rewrite вокруг глубинной океанской метафоры, при сохранении существующего engine/data model. Каноническая спецификация: `docs/OSMINOG_OCEAN_SHELL.md`. Источник дизайна: Figma `h1aG9cEdviAPA45gygUsB9`, Page 1 / node `0:1`.

Главный принцип: OSMINOG — не canvas с набором постоянно открытых AI-окон, а единая пространственная AI-операционная среда. Холст остаётся памятью/графом проекта; тяжёлые модули переходят в sheets/drawers/focus surfaces, а idle workspace должен оставаться спокойным и незахламлённым.

План релизов оболочки:
- [x] 3.11.0 OCEAN SHELL ALPHA — owner runtime загрузки подтверждён: Ocean workspace и существующий проект открылись; визуальное направление принято. Полный subsystem regression остаётся открытым.
  - ZIP: 54 files · 317919 bytes · SHA-256 `f9bad38e1cbca7ad7c8bd3cea739c16deb918bf4241753862e9ac2a7908c2bfd`.
  - P1–P8 остаются обязательными требованиями следующих 3.11.x миграций, а не отменяются редизайном.
- [x] 3.11.1 SEARCH LAYER — owner runtime загрузки подтверждён: Search Layer и живой индекс отображаются. Полезная search/index логика сохраняется.
  - Owner visual feedback: большая dome-like поверхность раскрывалась не так, как исходная Yokkey/OSMINOG 2011 механика; требовалось ощущение, что поверхность выталкивается из постоянной нижней полосы с округлёнными нижними плечами.
  - Эта геометрия считается отвергнутой и не переносится дальше.
  - ZIP: 54 files · 323960 bytes · SHA-256 `b5039cc4d903645f2f423e6235abe6d75509d3a1c485dbbc9ae233e9d92a1c0a`.
- [x] 3.11.2 PROVIDER / SESSION LAYER — candidate собран.
  - Search emergence: постоянная нижняя Ocean-полоса; глаз остаётся в ней; search surface стартует сжатой в центральном slot и расширяется вверх; нижние плечи и central stem скруглены.
  - Добавлен единый `OSMINOGSessionManager`: один provider → одна переиспользуемая internal Browser Hub/service session по умолчанию.
  - Session identity сохраняется; stale tabs очищаются; Provider Registry использует общий Session Manager.
  - AI chat status унифицирован до `On` / `Off` с точкой; `GPT LIVE` и подобные дубли provider-name убираются.
  - В неподключённом AI chat появляется сразу видимая кнопка `Подключить`.
  - Settings становятся full-surface внутри AI-chat вместо выпадающей вниз панели.
  - Provider brain picker получает реальные иконки; доступны ChatGPT, DeepSeek, Google AI, Gemini, Claude и Custom; полный Provider Registry подключается к тому же settings surface.
  - Google AI добавлен как agent brain через существующий Google service transport; один service-session переиспользуется.
  - Google multimodal send теперь fail-closed: если OSMINOG не подтверждает видимое принятие изображения Google-композером, текстовый запрос без картинки не отправляется.
  - Видимое `Jarvis` переименовано в **Poseidon**; legacy internal/storage aliases сохранены для совместимости.
  - DeepSeek proven transport намеренно не переписывался.
  - Candidate ZIP: 55 files · 335371 bytes · SHA-256 `0efec9227915c14178064e17527a0755fc5e42c147871f80ae27b2a0cc1ce1bd`.
  - Static checks: 21 JS syntax PASS, 8 JSON parse PASS, 0 real duplicate HTML IDs, ZIP integrity PASS. Owner runtime pending.
- [x] 3.11.3 BUBBLE EYE / ENVIRONMENT — owner runtime загрузки подтверждён, но нижний eye/dock/search визуально забракован.
  - Полезные Ocean FX, bubble hover/delete/drag/focus эффекты и desktop-first environment language сохраняются.
  - Ошибка: глаз был собран как несколько независимых halo/pedestal слоёв; появились артефакты, отдельный полукруг-пьедестал и дублирующая eye-графика внутри Search.
  - Owner обновил Figma desktop reference: один длинный нижний rail; спящий почти прозрачный глаз с пузырями; hover пробуждает глаз и зрачок следит за мышью; click делает глаз красным; Search поднимается из того же rail.
  - ZIP: 55 files · 337047 bytes · SHA-256 `797136658d01c5b636f3e79500ddf7c38ad93d9f92c9b7ba2394cbe58ceb2050`.
- [x] 3.11.4 LIVING EYE DOCK — owner runtime загрузки подтверждён, но interaction снова уточнён по свежему Figma desktop reference.
  - Один глаз загружается корректно, но постоянный нижний rail в idle не нужен.
  - Owner требует: idle = только один почти прозрачный глаз; pupil следит за мышью всегда; hover = глаз краснеет/просыпается и из него горизонтально растёт translucent bubble; click = из этого же bubble вверх раскрывается Search.
  - Bottom canvas toolbar также не должен висеть на пустом холсте — показывать его только при selection/edit context.
  - ZIP: 55 files · 342950 bytes · SHA-256 `74a9b7a760954785150de8bcaeeadca43fd4818f3659cd32acaa7f40b99ceec2`.
- [x] 3.11.5 EYE REVEAL — owner runtime загрузки подтверждён.
  - Idle eye / hover bubble / click-lift направление стало ближе к Figma.
  - Remaining owner feedback: при открытом Search глаз должен морфиться/уезжать в правую красную кнопку поиска; убрать лишний bright/white search-row эффект и грубый scrollbar; расширить Search и внутренние элементы.
  - ZIP: 55 files · 344669 bytes · SHA-256 `1473094f457ae801b48d2805e9f712523bc1264dd4df9b73909fa0c8a5d4b11f`.
- [x] 3.11.6 KRAKEN DRIFT — owner runtime загрузки подтверждён.
  - Living Eye/Search morph, integrated search row, hidden scrollbar, wider Search and water drift are visible in real Chrome.
  - Owner changed the first interaction model: approaching the eye must NOT immediately become the Search surface; the eye is Kraken's sensor and first reveals a semicircular launcher of primary functions.
  - ZIP: 55 files · 348750 bytes · SHA-256 `712ead4d1d5c9643b72fe005247f770634259d25e3cda6519ba37b09628abe21`.
- [x] 3.11.7 OCEAN ARC LAUNCHER — owner runtime загрузки подтверждён; Kraken radial launcher и Ocean/Space mode-switch реально загружаются в Chrome.
  - Interface settings now have two first-class modes: **Ocean** and **Space**. Ocean is the active experimental design line; Space preserves the earlier classic OSMINOG interaction model for users who prefer it.
  - Ocean keeps its own **Day / Night** variants; Space keeps **Light / Dark** variants. Theme toggle changes the variant inside the current mode instead of switching the product between unrelated shells.
  - Empty-canvas welcome card is session-only onboarding: it has a round close button and, once dismissed, stays hidden until a new tab/browser session. It no longer permanently occupies the canvas.
  - Kraken Eye uses proximity wake: entering roughly 17% of the viewport-scale wake radius makes the eye wake before direct hover.
  - First-level Ocean navigation is a semicircular **Kraken radial launcher** with Search, Files, Team, AI, Browser, Media, Code, Settings and Store. Mouse wheel rotates items along the arc.
  - Search becomes a second-level bubble selected from the Kraken launcher and preserves the 3.11.6 eye→search action morph.
  - Existing folders/modules/windows open through their existing logic but receive Ocean bubble-entry motion and round close/minimize controls; Space keeps the classic surfaces.
  - Owner feedback после runtime: Kraken arc direction принят, но reef/lagoon/island Day scene отклонён. Ocean Day возвращается к светлой дневной глубине без острова/пальм; Ocean Night остаётся abyss/bioluminescent depth. Space не получает Ocean ambience.
  - Search index, Provider/Session Manager, Google/DeepSeek, Team, Browser Hub, Media Crew, folders, Presence, water drift and stable project IDs/data are preserved.
  - Candidate ZIP: 55 files · 354073 bytes · SHA-256 `6bc49dddef6fa5cdd654e3ba81a2f76dc5b6306195b407e53ae222f27f608833`.
  - Static checks: 21 JS syntax PASS, 9 JSON parse PASS, 0 real duplicate HTML IDs, ZIP integrity PASS. Owner runtime pending.
- [x] 3.11.8 OCTOPUS WORK STATES — owner runtime загрузки подтверждён.
  - Ocean Day возвращён к светлой подводной глубине из раннего Ocean Shell: свет сверху, голубая толща, планктон/пузыри; reef/island/palms удалены.
  - Task execution больше не заставляет agent pill висеть на canvas. Постоянный pill остаётся только при явном linked/pinned context.
  - Активная задача показывает рабочего осьминога около исследуемого/редактируемого объекта; inspect и work states визуально различаются.
  - Добавлен live tether от agent chip в chat к активному worker-octopus.
  - Обычные canvas connections лежат за objects; hover/selected edit временно поднимает connection layer для редактирования.
  - Kraken Arc Launcher, Search, Provider/Session Manager, Google/DeepSeek, Team, Browser Hub, Media Crew, folders, Presence и stable IDs/data не переписывались.
  - ZIP: 55 files · 356050 bytes · SHA-256 `1ecfdcbe60f9af341f74ea8e553db56e0235437cecf8d9fe0d6f76880a06345f`.
- [x] 3.11.9 TASK ORBIT INTRO — owner runtime загрузки подтверждён.
  - Стих пробуждения полностью удалён из Search.
  - Стих показывается только при первом раскрытии Kraken Arc в текущей browser/tab session и больше не мешает поиску.
  - Добавлены локализованные варианты onboarding-текста для RU / EN / DE / ES / JA / ZH.
  - Kraken Arc получил отдельное действие `Задача`.
  - Добавлен реальный canvas object `task`: центральная командная задача и orbit bubbles ChatGPT / Claude / Gemini / DeepSeek / Chat / Files / Result.
  - Orbit actions переиспользуют существующие Provider Registry, Team Room и project-folder runtimes; второго chat/files/provider engine не создаётся.
  - Double click центральной задачи открывает Team Room и подставляет название задачи в mission input.
  - Candidate ZIP: 55 files · 356012 bytes · SHA-256 `e547ad48a4f8762a03b8e3c98fd772f63a3f64285cc3b85386269b906cf842d9`.
  - Static checks: 21 JS syntax PASS, 9 JSON parse PASS, 0 real duplicate HTML IDs, ZIP integrity PASS. Owner runtime pending.
- [x] 3.11.10 OCEAN DESKTOP SHELL — owner runtime загрузки подтверждён; функциональная идея принята, но обнаружен positioning regression: top-left identity, workspace modes и top-right utilities оставались дочерними legacy glass topbar и поэтому Chrome позиционировал fixed descendants относительно старого containing block.
  - Ocean получает одноразовую desktop-default миграцию: **Day depth** по умолчанию и **Без сетки** (`plain`) по умолчанию; сетку/точки пользователь может включить вручную.
  - В Ocean настройки цветов холста/сетки скрыты: палитра принадлежит самой Ocean-сцене; остаются grid selector и собственные Ocean FX. Space сохраняет классические canvas colors.
  - Верхний центр освобождён: OSMINOG + язык + переключатель Ocean Day/Night вынесены в компактный bubble-cluster слева.
  - Layers вынесены отдельным пузырём в левом верхнем углу.
  - `Brief / Code / Browser / Design / Team` перенесены с верхней полосы в вертикальный bubble-rail справа. Неоновые цвета/иконки режимов сохранены.
  - Hover/click активного режима раскрывает radial sub-tools: Brief → Text/Note/Node/Image/File; Code → Code/Markdown/File/Capture/Browser; Browser → Window/Tabs/Search/File/Capture; Design → Shape/Text/Pen/Vector/Image; Team → Team/Task/AI/Files/Media.
  - Верхние правые Access / Chat AI / Export и остальные системные действия пока сохранены без функциональной миграции.
  - Начат переход close/minimize controls к круглым Ocean bubble controls.
  - Стих первого пробуждения расположен внутри Kraken Arc и не возвращается в Search.
  - Candidate ZIP: 55 files · 362800 bytes · SHA-256 `ea2b19e22010f8c7ea37b3f7e7c4e4462a22e7b894fd41927dff504c0926fa23`.
  - Static checks: 21 JS syntax PASS, 9 JSON parse PASS, 0 real duplicate HTML IDs, ZIP integrity PASS. Owner runtime pending.
- [x] 3.11.11 SHELL POSITION FIX — owner runtime загрузки подтверждён, но shell layout визуально отклонён.
  - Portal/containing-block regression исправлен технически: top-right controls снова на месте.
  - Owner runtime feedback: отдельный identity bubble сверху слева + отдельный mode rail справа + Kraken снизу + legacy rail создают слишком много независимых навигаций и выглядят как перегруженный Flash-era UI.
  - Этот layout не переносится дальше как основной Ocean shell; полезный portal fix сохраняется.
  - ZIP: 55 files · 363750 bytes · SHA-256 `cfbd35bdd7297c129e90067d944b20061ded39def29a2c4c3631dc639f2cd674`.
- [x] 3.11.12 OCEAN DOCK & BUBBLE CONTAINERS — owner runtime загрузки подтверждён, но обнаружен P0 freeze/performance regression.
  - Нижний dock, linear tool shelf, zoom pill и provider bubble grouping реально загрузились в Chrome.
  - Owner сообщил о полном зависании вкладки/расширения после работы с новым Ocean shell.
  - Разбор показал конкретный feedback-loop: bubble-group MutationObserver вызывал `renderGroupBubbles()`, который сам удалял/создавал group DOM и повторно будил observer; одновременно collision resolver запускался каждые 1.1s как O(n²) layout-pass.
  - Water drift писал `style.translate` каждый animation frame, а глобальные body MutationObserver следили за `style/class`, поэтому drift дополнительно будил дорогие layout/UI sync callbacks практически каждый кадр.
  - Эта performance-схема запрещена к возврату в следующие версии.
  - ZIP: 55 files · 369631 bytes · SHA-256 `049aa1245c38495946c8a45eb712205d2f4c1c6a218562da09709d7803644487`.
- [x] 3.11.13 OCEAN CLARITY & PERFORMANCE — owner runtime загрузки подтверждён.
  - P0 freeze-path из 3.11.12 убран: self-triggering observer/collision loops сняты.
  - Owner feedback после реального использования: даже после performance fix отдельная Ocean interaction system остаётся слишком сложной, непредсказуемой и мешает базовой работе; создателю самому трудно понять, где находится привычный инструмент.
  - Product decision: Kraken Arc / Living Eye launcher / отдельный Ocean dock / tool shelves / bubble-container physics больше НЕ являются основным интерфейсом OSMINOG.
  - Исторические идеи сохраняются в project log как R&D, но runtime возвращается к одной знакомой рабочей раскладке.
  - ZIP: 55 files · 372219 bytes · SHA-256 `5d7f279d6b1e63c14bda39031a7b6c969ace7c4d2edc6f8d0db7aba2218073a9`.
- [x] 3.11.14 THREE THEME RESET — owner runtime загрузки подтверждён, но Ocean theme switch поймал regression.
  - Product reset верный: Light / Dark / Ocean должны использовать один familiar classic layout.
  - Runtime bug: после переключения Dark → Ocean владелец получил только синий фон; рабочий UI исчез.
  - Причина направления hotfix: Ocean всё ещё имел отдельный ambience DOM/stacking path, хотя после reset он уже не должен создавать никакую отдельную оболочку.
  - ZIP: 55 files · 323979 bytes · SHA-256 `4c0812846e17c0f2d96b795cdf4d22308a68cbe6ac444e2f357e459029661498`.
- [x] 3.11.15 OCEAN THEME HOTFIX — owner runtime загрузки подтверждён.
  - Ocean CSS-only theme снова показывает полный рабочий интерфейс; blank-blue regression 3.11.14 устранён.
  - Light / Dark / Ocean используют один и тот же `#app`, DOM и layout.
  - ZIP: 55 files · 323297 bytes · SHA-256 `d2130d19f25a15577e7bfbf3b7bec654cd7a1d3bbe4dd6480a5fe49f3bf70ace`.
- [x] 3.11.16 OCEAN UI POLISH — owner runtime загрузки подтверждён.
  - Основной classic layout сохранился, Ocean FX и три темы работают.
  - Owner feedback: Ocean-палитра получилась слишком ярко-бирюзовой и низкоконтрастной по сравнению с Light/Dark; панели и текст плохо считываются.
  - Layers bubble расположен слишком низко и визуально наезжает на Layers panel; должен жить в самом левом углу шапки.
  - Zoom в collapsed Inspector был реализован слишком буквально: процент повернут вертикально, а при раскрытии Inspector zoom исчезает.
  - ZIP: 55 files · 329105 bytes · SHA-256 `c3a32fc2eb2da20cbd9c8c93d752e7920963092246f2a6933691dd721c721177`.
- [x] 3.11.17 OCEAN CONTRAST & LAYOUT FIX — candidate собран.
  - Ocean переведён с washed cyan на более глубокий читаемый blue-glass: фон остаётся светлее Dark, но surfaces стали темнее и контрастнее; blur ~32px сохраняет глубину и отделяет контент от холста.
  - Layers bubble перенесён в самый левый верхний угол header; topbar смещён вправо, поэтому кнопка больше не перекрывает Layers panel.
  - Zoom больше не живёт внутри `.inspector-mini`: он всегда остаётся доступным как отдельная вертикальная pill справа.
  - Процент zoom снова читается горизонтально (`100%`), без writing-mode rotation.
  - При открытом/ресайзнутом Inspector zoom автоматически сдвигается влево от панели вместо исчезновения или перекрытия.
  - CSS-only plankton / bubbles / sea forms сохранены; performance-dangerous collision/drift JS loops не возвращались.
  - Candidate ZIP: 55 files · 324575 bytes · SHA-256 `d8e6b11c692c71e505e5efb2ad16216131477647183f9f0516310279b11f3a32`.
  - Static checks: 21 JS syntax PASS, 9 JSON parse PASS, 0 real duplicate HTML IDs, ZIP integrity PASS. Owner runtime pending.
- [ ] 3.11.18 WORKFLOW POLISH & FUNCTION REGRESSION — после UI-подтверждения вернуться к Google/Team/Browser/Media/Presence и реальной работе функций.

Обязательные guardrails: progressive disclosure, recognition over recall, знакомые подписи/иконки для базовых действий, keyboard/mouse/touch, reduced-motion/static mode, читаемый contrast/typography, performance budgets и rollback на каждом этапе.

Текущие 8 UX-пунктов владельца НЕ отменяются — они становятся обязательными требованиями миграции в Ocean Shell.

# 7. ТЕКУЩИЙ UX/STABILITY PASS — 8 ОБЯЗАТЕЛЬНЫХ ПУНКТОВ

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

**Окончательное решение после провалов bootstrap 1.1.0/1.1.1:** Dev Hub не должен искать и обновлять произвольную `Load unpacked` папку на Desktop. Он владеет фиксированной dev-папкой `%LOCALAPPDATA%\OSMINOG\Chrome\current`. Один раз пользователь загружает именно её через Chrome `Load unpacked`; после этого все dev-обновления идут по цепочке `OSMINOG button → Dev Hub → GitHub package → SHA/size verify → staging → backup → managed current → chrome.runtime.reload()`. Для production delivery используется Chrome Web Store automatic update, а Dev Hub конечным пользователям не нужен. Подробный контракт: `docs/OSMINOG_UPDATE_ARCHITECTURE.md`.

---

## 12. Порядок выполнения от текущей точки

### Этап A — Project discipline / baseline
- [x] Получен точный текущий ZIP 3.10.6.
- [x] Проверены размер/hash/file count/manifest.
- [x] Presence подключён к текущему ChatGPT.
- [x] Создать этот MASTER ROADMAP в GitHub.
- [ ] Создать `OSMINOG ROADMAP — LIVE` на canvas.
- [x] Создать six-platform release registry.
- [ ] Опубликовать точный 3.10.6 ZIP в rolling GitHub prerelease.

### Этап B — Unified Provider/Session foundation
- [x] Собран OSMINOG Dev Hub 1.1: CI run `33175649379` success.
- [x] Подготовлен exact guarded fileset `3.10.6 → 3.10.7`; локально воспроизводит byte-identical 52-file tree.
- [x] Public dev feed `osminog/channels/dev/chrome-extension.json` указывает на 3.10.7.
- [x] Runtime 1.1.0: установщик Dev Hub установился, но bootstrap не нашёл текущую unpacked-папку OSMINOG на рабочем столе; рабочая папка не изменена.
- [x] Исправлен bootstrap 1.1.1: после Chrome Preferences автоматически сканирует прямые папки Windows Desktop; если не найдено — разрешён одноразовый выбор текущей папки OSMINOG с проверкой manifest/key и сохранением пути. Routine updates папку больше не спрашивают.
- [x] Dev Hub 1.1.1 installer CI run `33177530597` завершён `success`.
- [x] Runtime 1.1.1: даже после одноразового выбора Desktop-папки bootstrap 3.10.6 → 3.10.7 не завершился; Desktop-path discovery/mutation признан неправильной архитектурой и закрыт.
- [ ] Managed Dev Channel v2: Dev Hub создаёт и владеет `%LOCALAPPDATA%\OSMINOG\Chrome\current`, скачивает туда канонический baseline и больше никогда не ищет arbitrary Desktop source.
- [ ] Один раз загрузить managed `current` через Chrome `Load unpacked`, сохранив фиксированный manifest key/extension ID.
- [ ] После managed bootstrap опубликовать UPDATE PROOF и проверить кнопку OSMINOG без скачивания ZIP, выбора папки и ручной замены файлов.
- [ ] Production: CI → Chrome Web Store API → review/publish → automatic Chrome update.
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
