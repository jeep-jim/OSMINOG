# Проверка исправления вложений 4.0.16

- PR57: https://github.com/jeep-jim/OSMINOG/pull/57
- Проверенная ветка: `46dd5d21103c93bd8142ef4b96a6a3e52bb37f94`.
- Merge: `97196567decaadd7fa25614a7614818adc17c6ba`.
- Windows: https://github.com/jeep-jim/OSMINOG/actions/runs/38917426805 — success.
- Agent: https://github.com/jeep-jim/OSMINOG/actions/runs/38917426998 — success.
- 126 unit-тестов; установленная копия и обычный запуск проверены.

В `installed-provider-smoke.log`:

- LAZY_INPUT_REMOTE_PREVIEW_REMOUNT_AND_UPLOAD_READY_PASS — поле появляется по кнопке +, accept содержит расширения, превью имеет HTTPS URL, textarea заменяется сайтом; отправка ждёт снятия aria-busy с формы, хотя превью появляется раньше.
- STALE_TRANSCRIPT_AND_PREVIEW_CANNOT_CONFIRM_UPLOAD_PASS — старое превью и имя файла в истории не подтверждают игнорируемую загрузку; сообщение не отправляется.
- UNCONFIRMED_SEND_FAILS_WITHOUT_RETRY_PASS — отсутствие подтверждения отправки не приводит к повторной отправке.

Остальные регрессии: исходный чат → нативные действия/холст/изображение, шесть сценариев оркестратора, независимые окна, указатель, снимок/запись и файлы. Логи находятся рядом. Все провайдерские ответы в этом прогоне контролируемые; живые аккаунты пользователя не тестировались.

Runtime source `4638361c3bbf72660a9567d24f2fecd00a317d3d` совпадает с merge по всем 417 blob-файлам. Runtime: 4838349 bytes, SHA256 `8ed357a3ffece7f8fab9130f3f4a57577b1d1b85703682ee5eacb9351bb3ab7f`. Архив CI проверен по SHA256 `3bcc092bcd55399ac43c3691ac85ae1f9b54404e44d8f38953e81b8b4ba99b87`.
