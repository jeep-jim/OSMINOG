# Mouse Browser — рабочая сводка

26.11.2026. **6.0.41 в работе; 6.0.40 опубликована на всех платформах.** Порядок нового выпуска: **Mac → Linux → Windows**. Сводка ≤8000 байт; подробности и доказательства — в документах задач, PR и pins.

## Проект и решения владельца

- Исходники: [OSMINOG](https://github.com/jeep-jim/OSMINOG); публикация: [OSMINOG-Releases](https://github.com/jeep-jim/OSMINOG-Releases). АвтоЦена — отдельный проект; её доступы/workflows не использовать.
- Фокус Антона: много окон/столов, локальное автосохранение, плавность и сохранение страниц. Плиточный поиск отменён в 636.
- **Agent Mouse удалён в 637:** чат агента, режим «Агенты», Local MCP, терминал и модельные подключения. Не возвращать по старым заданиям. Обычные сайты боковой ИИ-панели остаются.
- Сохранять профиль, App ID, Chromium partition, cookies, вкладки, столы, совместимость обновляторов. Опубликованные пакеты/адреса неизменяемы. Маскот, очки и Dock без новой просьбы не менять.
- Продукт: `desktop/mouse-main.cjs`, `desktop/mouse/`; preload/update/build рядом. Правила: [desktop/AGENTS.md](desktop/AGENTS.md).

## Принятый source — 640

Пользователь не заметил AdBlock в длинной ленте настроек. Новый интерфейс: девять разделов, поиск, AdBlock на первом экране, явные состояния, цветные SVG, тёмное/белое стекло, независимая сохраняемая ширина. Все прежние IPC и ограничения инкогнито сохраняются. [Задача](docs/desktop/2026-11-26-mouse640-settings-glass.md).

В [PR216](https://github.com/jeep-jim/OSMINOG/pull/216) принят head `7428ecf52698e62468bb7befb9d7d2d06ee7b6d9`; merge `7e0de1d371f206c26879d502ab2e4b470731da53`. Дерево обоих `0c98e782ae21f4818ec6ab83d037e54ca7f3e444`. Принятую ветку `feat/mouse640-settings-glass-20261126` не двигать; последующие документы — отдельная ветка от main.

Нативные source-gates SUCCESS: [Mac 45730096243](https://github.com/jeep-jim/OSMINOG/actions/runs/45730096243), [Linux + Noble 45730096469](https://github.com/jeep-jim/OSMINOG/actions/runs/45730096469), [Windows + modern 45730096285](https://github.com/jeep-jim/OSMINOG/actions/runs/45730096285), Windows attempt 2. Новый gate проверяет AdBlock сразу после открытия, до прокрутки к контролу; старый тест мог сам прокрутить скрытую ниже настройку. Нативные светлые/тёмные кадры трёх платформ визуально проверены; подробные границы проверки — в задаче.

**640 PUBLIC VERIFIED:** Mac — [45738926996](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/45738926996); Linux — [45742571751](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/45742571751); Windows — [45744897208](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/45744897208), все publisher SUCCESS. Канонические feed 6.0.40 и полные публичные DMG/ZIP/AppImage/deb/EXE сверены по размеру и SHA256; точные receipts и ссылки — в задаче.

## Текущая задача — 641

[PR218](https://github.com/jeep-jim/OSMINOG/pull/218), [требования и доказательства](docs/desktop/2026-11-26-mouse641-flexible-workspaces.md). База main `85fa6dc6128c24016a97bc96c68022d159914da4`.

На head `27965f51bc4ad389c7bc71ec9630a43d78c243b4` все три source-gate FAIL: fake timer; дополнительно Linux — старое ожидание639 вместо baseline640, Windows — клик внутри неизменяемой629. Ошибки таймера/версии исправлены; перенос привязан к получателю и координатам при dragend, Escape отменяет источник. Локально:1476 pass/9 native skip; Python155 pass/2 skip. Следующий шаг — полный native-прогон и независимый publisher; 641 ещё не опубликована, feeds остаются640. Подробные логи и границы проверки — в задаче.

## Сохранённые возможности и ограничения

- Графика638: целочисленные границы, правильные надписи/иконки новой вкладки. Прямоугольная сетка: разделитель 1 px без радиусов; обычная: промежутки 6 px, радиусы 12 px. Обе темы, resize/drag и множество живых страниц обязательны.
- Тон белого: нейтральный светлый текст тёмных страниц и интерфейса, сразу и после перезапуска; цветные элементы/светлые поверхности сохраняются.
- Chrome Web Store: страница расширения → меню расширений → «Установить в Mouse». CRX3/ID/подписи, нативное согласие, привязка к странице/столу и отмена при смене контекста. Не все Chrome API поддерживаются.
- Mac Apple Silicon: ad-hoc preview без Developer ID/notarization. Windows: unsigned preview. Linux: AppImage/deb, Ubuntu 24.04 gate; Mint владельца не проверен. Sandbox не отключать.
- [Графика/Store/приёмка 638](docs/desktop/2026-11-23-mouse638-rendering-webstore.md), [Linux 638](docs/desktop/2026-11-23-mouse638-linux-install.md). 638 была опубликована на всех платформах; размеры/SHA брать из точных pins, а не из памяти.

## Сайт и автообновление

[mouse.black](https://mouse.black/) — собственный webroot/HTTPS osminog, 72 языка. [Инфраструктура](docs/website/2026-11-22-mouse-black-launch.md). Каналы проверяются через 60 секунд после завершения проверки; платформы обновляются независимо, SHA256/Range обязательны.

Free/Cheese: Free 2 стола/4 окна, Cheese 5/12 за $3 — будущая модель. Сейчас все функции бесплатны; оплаты/ограничений нет.

PR213 опубликован 25.11: 10 браузеров + Mouse, цветные лого, режимы, 5 независимых столов. [Задача](docs/website/2026-11-25-browser-comparison.md). Счётчик UNAVAILABLE: нужен администратор Mouse vhost. [Процедура](docs/website/2026-11-25-download-metrics.md). Сохранять параллельные изменения сайта и свежие загрузки.
