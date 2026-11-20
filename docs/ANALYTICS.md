# Аналитика

## Принцип

Свой backend и endpoint не нужны. Используются встроенные каналы платформ:

- Playgama — `bridge.analytics.send` и телеметрия Playgama;
- Yandex Games — встроенные метрики Консоли и Yandex Metrica для кастомных воронок;
- Mock/local — локальный debug-транспорт для разработки и плейтестов.

Кастомные события отправляются только после явного согласия игрока. До согласия события копятся в памяти, после «Не сейчас» буфер очищается. PII не собирается.

## Транспорты

| Платформа | Транспорт | Consent | Что нужно |
|---|---|---|---|
| Playgama | `PlaygamaAnalyticsTransport` → `bridge.analytics.send` | Да | Ничего дополнительно |
| Yandex (напрямую) | `YandexMetricaTransport` → `window.ym` | Да | `VITE_YANDEX_METRICA_COUNTER_ID` |
| Mock/dev | `LocalAnalyticsTransport` | Нет | Ничего |

Выбор происходит в `src/game/analytics/createAnalyticsTransport.ts` по `platform.id`.

Если Yandex-сборка запущена через Playgama Bridge, используется Playgama-транспорт, чтобы не дублировать данные и не подключать второй SDK.

## События

| Событие | Когда | Основные параметры |
|---|---|---|
| `first_tap` | первый pointer/tap | `elapsed_ms` |
| `first_harvest` | первый сбор урожая | `object_id`, `auto`, `elapsed_ms` |
| `first_order` | первый выполненный заказ | `template_id`, `elapsed_ms` |
| `first_upgrade` | первый апгрейд | `object_id`, `level`, `elapsed_ms` |
| `first_zone` | первое открытие зоны | `zone_id`, `elapsed_ms` |
| `first_animal` | первое открытие животного | `object_id`, `elapsed_ms` |
| `tutorial_step` | завершён шаг туториала | `step`, `elapsed_ms` |
| `tutorial_completed` | туториал завершён | `elapsed_ms` |
| `story_beat_shown` | открылся новый сюжетный бит | `beat_id`, `elapsed_ms` |
| `offline_claimed` | забран оффлайн-доход | `multiplier`, `total`, `elapsed_ms` |
| `consent_granted` | игрок разрешил аналитику | `elapsed_ms` |

Отказ в согласии не отправляется внешне: без согласия события не покидают устройство.

Правила:

- имена стабильные, `snake_case`;
- меняющиеся значения — в параметрах, не в имени;
- не отправлять автоматические события Playgama повторно: `game_ready`, рекламу, покупки, старт/конец сессии;
- не отправлять каждый кадр;
- не добавлять имена, email, рекламные ID и другие PII.

## Consent

- Карточка появляется после завершения туториала, а не перед первым действием.
- Кнопки: «Разрешить» / «Не сейчас»; настройки позволяют изменить выбор позже.
- До «Разрешить» события лежат в памяти (до 100 событий).
- После «Разрешить» буфер отправляется по порядку.
- После «Не сейчас» буфер очищается.
- `installId` — случайный UUID, не связан с личностью; хранится в сохранении.
- `firstEvents` хранит список уже отправленных первых событий, чтобы не дублировать их между сессиями.

## Playgama

```js
bridge.analytics.send('first_harvest', {
  object_id: 'plot_wheat',
  elapsed_ms: 9200,
});
```

- Bridge v1.33.1 в текущей сборке имеет `bridge.analytics.send`; это проверено в браузере.
- Документация v1 не выделяет analytics в отдельную страницу, поэтому перед публикацией проверьте событие в Playgama sandbox.
- Playgama сам записывает lifecycle/ads/purchases/session; наши события только кастомные.
- Смотреть данные в кабинете Playgama / через MCP-телеметрию.

## Yandex Metrica

1. Создайте счётчик в Yandex Metrica.
2. Укажите его ID:

```env
VITE_YANDEX_METRICA_COUNTER_ID=12345678
```

3. Для каждого события создайте Goal типа «Конверсия» (JS event) с тем же именем.
4. Проверьте через `_ym_debug=1`.
5. Воронка: `first_tap` → `first_harvest` → `first_order` → `first_upgrade` → `first_zone`.

Транспорт динамически подключает `https://mc.yandex.ru/metrika/tag.js` только после согласия и вызывает `ym(counterId, 'reachGoal', name, params)`. Если snippet Metrica уже добавлен в `index.html` вручную, повторная инициализация не выполняется.

Ограничения Metrica: одно goal считается не чаще раза в секунду, до 400 онлайн-достижений за визит; события не должны идти каждый кадр.

## Локальная проверка

```bash
npm run dev
# Playgama consent:
open 'http://localhost:5173/?platform=playgama'
```

- В Playgama mock `analytics.send` является безопасным no-op; consent-карточка появляется, события записываются локально в состоянии `firstEvents`.
- Для Yandex Metrica без реального счётчика используется `LocalAnalyticsTransport`; данные видны в консоли `[Analytics:local]`.
- Проверяйте сохранение: `localStorage.getItem('cloud_farm_save')`, поля `analytics` и `story`.
- Для Yandex: `?platform=yandex&_ym_debug=1` (при наличии `/sdk.js` и счётчика).

## Приватность

- Собираются только игровые действия и технические поля.
- Нет имён, email, телефонов, рекламных идентификаторов.
- Согласие хранится в сохранении; отказ можно изменить в настройках.
- Внешние события не отправляются до согласия.
- Платформенная автоматическая аналитика регулируется правилами Playgama/Yandex и может собираться независимо от нашей consent-карточки; это нужно отразить в privacy policy.
