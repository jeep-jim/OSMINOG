# 2026-10-06 — внешний MCP-пилот OSMINOG

База: main 22f85bae2bc6547e27dba947402ec3c400932734, пакет Chrome 4.0.7
из успешной сборки GitHub Actions 37405235698. Существующий project log не затирался.

Пользователь подтвердил, что внутренний чат раньше видел холст; задача — надёжный
доступ внешнего обычного ChatGPT без переноса переписки. Во время разработки пользователь
подключил существующий browser_presence: получен структурный контекст «АвтоЦена правки»,
revision 3, 43 объекта, одно выделенное изображение, imageAttached:false.
Это подтверждает доставку структуры, но не изображений или выполненной записи.
Пользовательская доска при разработке не изменялась.

Добавлены osminog-mcp-contract.js, osminog-mcp-board.js, локальный stdio сервер,
Windows launcher, документация, модульные тесты и CI browser fixture. Изменён только
cloud-config.js для загрузки двух новых локальных скриптов в editor.html после DOM ready.
Внутренний чат, browser_presence, существующий patch engine, роли владельца и механизм
обновления не переписывались. Manifest/version сохранены: это отдельный пилот, не релиз.

14 Node-тестов пройдены локально: схемы, Host/Origin/token, привязка к проекту,
read-only, однократная доставка, disconnect, timeout/unknown outcome, cancellation,
MCP handshake, image content, сохранение заметки, requestKey, ошибки диска и гонки проекта.
Браузерный прогон в контейнере заблокирован managed browser policy; не считать пройденным.
Для независимого прогона редактора подготовлен отдельный GitHub Actions workflow.
Настоящая Windows-сессия, Chrome permissions и ChatGPT Secure MCP Tunnel пока не проверены.
