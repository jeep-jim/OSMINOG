# Mouse 6.0.35 — исправления по установленным сборкам

Статус: кандидат PR187; публикация6.0.35 ещё не подтверждена. Последний проверенный source head до этих исправлений — `252cb8c209719688d2d99276120f30e352599277`. Неуспешные артефакты не используются для release pins.

## Факты предыдущего native CI

- macOS [run44878527762](https://github.com/jeep-jim/OSMINOG/actions/runs/44878527762), job136768488653: retained634 прошёл; owner635 остановился при выборе checkbox Captures. Доверенный OS click попал в ARTICLE, а не checkbox; прямо перед ним завершились три lazy preview. Старая CSS меняла размер иконки24→30px. Это наблюдаемая последовательность, а проверка причинной геометрии добавлена ниже.
- Windows [run44878527798](https://github.com/jeep-jim/OSMINOG/actions/runs/44878527798), legacy job136768510789: реальные обновления629→635 и634→635, стабильность библиотеки и новый Agent Chat прошли. Затем owner635 остановился на custom resize. Production pointerdown вызывал preventDefault и оставлял фокус на кнопке меню. Modern job был пропущен после legacy failure.
- Linux [run44878527702](https://github.com/jeep-jim/OSMINOG/actions/runs/44878527702), job136768552989: retained634, task/stress и обновление634→635 прошли. Downloads показывали декодированную системную иконку32×32, а не миниатюру файла; file-change stage остановился. Electron `createThumbnailFromPath` доступен на macOS/Windows, что совпадает с локальными44.5.0 typings и [официальной документацией](https://www.electronjs.org/docs/latest/api/native-image#nativeimagecreatethumbnailfrompathpath-size-macos-windows).

## Исправления

Для Downloads/Captures область изображения имеет одинаковые размеры до и после загрузки:30×30px в списке и112px по высоте в плитке. Значок файла остаётся36px внутри зарезервированной области плитки. Размеры favicon истории и закладок сохранены.

На Linux при отсутствии OS thumbnail API загружаются реальные локальные bytes через существующий no-follow bounded reader. Допустимы только известные завершённые загрузки с allowlisted расширением; предел24MiB, отказ для symlink/пустого файла, сравнение dev/ino/size/mtime/ctime до и после декодирования, cache key по тому же состоянию. Изображение уменьшается с сохранением пропорций до480×320. Native API macOS/Windows остаётся прежним. Unit cases проверяют оба пути, пропорции, отказ, подмену файла во время чтения и обновление cache.

Разрешённый divider получает фокус от настоящего pointerdown после guards закрепления/переключения стола. После keyboard resize и перестройки DOM фокус возвращается разделителю того же пути. Native smoke использует OS RIGHT→LEFT→RIGHT и требует настоящие trusted keydown, точную цель, ratio0.50→0.53→0.50→0.53 и сохранение фокуса. Новый raw `mouse-635-panes.json` сохраняется также при сбое.

Для Captures обе темы×оба вида измеряют реальные bounds14 строк, изображений и checkbox до/после завершения удержанных настоящих `archive.preview`. Допуск1px; scroll сохраняется; delayed IDs связаны с конкретными requestSequences; placeholder заменяется декодированной миниатюрой. Базовая стабильность Downloads тоже требует `thumbnail:true`, поэтому системная иконка больше не считается успехом. Бюджеты и число14 итоговых кадров не расширены.

## Проверки и пределы

Полный локальный source suite после исправлений:1146 tests,1140PASS,0FAIL,6Windows-onlySKIP. SHA-256 `mouse635-final-unit-4.log`: `fd5c84e3a430323968114a280b5c19e9f542da5ed0725f50f36941f2bd9af779`. Проверки синтаксиса и `git diff --check` прошли. Новые native результаты ожидаются отдельно; этот локальный PASS не означает выпуск.

Уже полученные Windows252 кадры Agent Chat вручную просмотрены: dark400, light400, dark300 и отдельные Settings; SHA всех четырёх content PNG и четырёх полных OS PNG совпали с owner receipt. Native proof подтверждает streaming/history/Stop/503/clear и обычный чат при выключенном доступе к браузеру. Модель — явно собственная HTTP/SSE fixture; `externalModelVerified:false`, подключение к личному Ollama владельца этим не утверждается.

Release PR63 сохраняет ready:false во всех трёх pins и отсутствие PUBLISH_OWNER. Сначала нужен успешный точный source head на всех обязательных платформах, затем merge source с сохранением ancestry, импорт проверенных bytes и отдельные publish/readback gates.
