# Prodamus — заметка для будущей монетизации BriefCraft

Дата фиксации: 2026-08-26.

## Зачем
Рассмотреть Prodamus как платёжный контур для подписки BriefCraft, когда дойдём до Free / Pro / Team.

## Что уже проверено
- Prodamus заявляет приём зарубежных Visa / Mastercard / Maestro: https://prodamus.ru/priem-mezhdynarodnyh-platezhey
- Для интеграции доступны платёжные ссылки / REST API и подписанные webhook-уведомления. Доступ BriefCraft выдавать только после подтверждённого webhook, не по redirect после оплаты: https://help.prodamus.ru/payform/integracii/rest-api/instrukcii-dlya-samostoyatelnaya-integracii-servisov
- Есть API для управления подписками / следующей датой списания / скидками: https://help.prodamus.ru/payform/integracii/rest-api-1
- Критичное ограничение на момент проверки: рекуррентные списания Prodamus заявлены только для карт российских банков: https://prodamus.ru/priem-rekurrentnyh-platezhej

## Предварительная схема BriefCraft
BriefCraft client → наш backend → Prodamus checkout → Prodamus webhook → наш backend → entitlement аккаунта BriefCraft.

Секрет Prodamus никогда не хранить в Chrome extension. Карточные данные через BriefCraft не пропускать.

Предварительно:
- РФ: месячная / годовая автоподписка через Prodamus.
- Иностранные карты: обычная разовая оплата периода (например месяц/год) с ручным продлением, пока не подключён второй processor с международным recurring.

## Перед внедрением обязательно перепроверить
1. Письменно подтвердить у Prodamus, что они принимают оплату именно за SaaS / Chrome extension / программную подписку BriefCraft.
2. Актуальные комиссии и доступные страны/валюты.
3. Актуальные условия зарубежных карт и рекуррентов.
4. Webhook signature, idempotency, refund/cancel flow.
5. Требования Chrome Web Store и пользовательские Terms / Refund policy.

Не считать эту записку финальной спецификацией: перед реализацией перечитать актуальную документацию Prodamus.