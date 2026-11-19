# Интеграция Playgama и Yandex Games

## Архитектура

Все платформенные вызовы изолированы в `src/game/platform`:

- `PlatformAdapter.ts` — единый интерфейс;
- `MockAdapter.ts` — локальная разработка, `localStorage`, имитация рекламы;
- `PlaygamaAdapter.ts` — Playgama Bridge JS Core;
- `YandexAdapter.ts` — прямой Yandex Games SDK;
- `createPlatform.ts` — auto-detect и fallback на Mock.

Игровые сервисы (`EconomyService`, `ProductionService`, `SaveService`, `AdManager`, `AudioService`) зависят только от интерфейса. `GameContext` связывает их и реагирует на platform events.

## Выбор платформы

| Условие | Адаптер |
|---|---|
| `?platform=mock` | MockAdapter |
| `?platform=yandex` или Yandex-домен | YandexAdapter, при ошибке — Mock |
| `?platform=playgama` или загружен Bridge | PlaygamaAdapter; если Bridge сообщает `platform.id === 'mock'`, игра продолжает локально на MockAdapter |
| иначе | MockAdapter |

При публикации через Playgama Bridge на Yandex используется Playgama-слой. Нативный YandexAdapter нужен только для прямой публикации, когда доступен `/sdk.js`.

Чтобы не оставлять загрузочный оверлей Bridge в локальном mock-режиме, `createPlatform` отправляет `game_ready` перед fallback на MockAdapter.

## Lifecycle

| Действие | Playgama | Yandex |
|---|---|---|
| Инициализация | `await bridge.initialize()` | `await YaGames.init()` |
| Готовность | `bridge.platform.sendMessage('game_ready')` | `ysdk.features.LoadingAPI?.ready()` |
| Старт gameplay | `level_started`, далее `level_resumed` | `ysdk.features.GameplayAPI?.start()` |
| Пауза/стоп | `level_paused` | `ysdk.features.GameplayAPI?.stop()` |
| Язык | `bridge.platform.language` | `navigator.language` как fallback |
| Аудио | `bridge.platform.isAudioEnabled` + `AUDIO_STATE_CHANGED` | браузерное состояние; платформенного audio API нет |
| Pause | `EVENT_NAME.PAUSE_STATE_CHANGED` | `document.visibilitychange` |

`ready()` вызывается после загрузки ассетов и создания первого интерактивного кадра (в `FarmScene`), а не на экране загрузки. `gameplayStart()` вызывается после ready, а также после закрытия меню/рекламы и возврата на вкладку. `gameplayStop()` — при паузе, открытии рекламы и уходе со вкладки.

## Playgama Bridge

Подключение уже есть в `index.html`:

```html
<script src="https://bridge.playgama.com/v1/stable/playgama-bridge.js"></script>
```

Порядок в игре:

1. Дождаться загрузки `window.bridge`.
2. `await bridge.initialize()`.
3. Прочитать `bridge.platform.language` и `bridge.platform.isAudioEnabled`.
4. Загрузить сохранение через `bridge.storage.get('cloud_farm_save')`.
5. После первого играбельного кадра отправить `game_ready`.
6. Показывать rewarded только по действию игрока.
7. Показывать interstitial в естественных паузах (сейчас: открытие зоны и каждая 5-я выполненная цель заказов, но не раньше 3 минут сессии).

Сохранение:

```js
bridge.storage.set('cloud_farm_save', JSON.stringify(gameState));
const raw = await bridge.storage.get('cloud_farm_save');
```

Rewarded:

- подписка на `bridge.EVENT_NAME.REWARDED_STATE_CHANGED`;
- награда только при состоянии `rewarded`;
- `closed` без `rewarded` и `failed` дают `false`;
- предусмотрен таймаут 90 секунд;
- кнопки скрываются/не показываются, если `bridge.advertisement.isRewardedSupported === false`.

Interstitial:

- используется `bridge.advertisement.showInterstitial(placement)`;
- собственных таймеров частоты нет;
- игра ставит gameplay на паузу до и после показа;
- Bridge сам решает, можно ли показать рекламу.

Конфиг `public/playgama-bridge-config.json` содержит placements:

- `offline_double`
- `speed_up`
- `zone_unlocked`
- `milestone`

Если нужны нативные ID для конкретной платформы, добавьте их через config editor или в `platforms.<id>`.

## Yandex Games SDK

Прямая публикация:

1. Yandex должен отдавать `/sdk.js` на том же домене.
2. `YandexAdapter` динамически подключает `/sdk.js`, если `window.YaGames` ещё нет.
3. `YaGames.init()` вызывается только после загрузки SDK.
4. `LoadingAPI.ready()` — после первого интерактивного кадра.
5. `GameplayAPI.start/stop()` — при старте/паузе gameplay.
6. Fullscreen: `ysdk.adv.showFullscreenAdv`, `wasShown === false` не ломает игру.
7. Rewarded: `ysdk.adv.showRewardedVideo`; награда только после `onRewarded`.
8. Сохранения: `ysdk.getStorage()`, fallback на `localStorage` только при ошибке safe storage.
9. Player/leaderboards не используются в MVP; имена таблиц не выдумываются.

Если игра публикуется через Playgama Bridge на Yandex, прямой `/sdk.js` не подключается и YandexAdapter не используется.

## Реклама

| Placement | Тип | Где | Награда |
|---|---|---|---|
| `offline_double` | rewarded | модальное окно оффлайна | ×2 ресурсов |
| `speed_up` | rewarded | панель объекта во время цикла | завершение текущего цикла |
| `zone_unlocked` | interstitial | после открытия зоны | — |
| `milestone` | interstitial | каждая 5-я выполненная цель заказов | — |

Правила:

- rewarded никогда не запускается автоматически;
- при отмене/ошибке награда не выдаётся, UI остаётся рабочим;
- interstitial не показывается в первые 3 минуты;
- на время рекламы звук и gameplay останавливаются;
- в MockAdapter реклама показывается тёмным DOM-оверлеем и завершается через 1 секунду.

## Сохранения

- Ключ: `cloud_farm_save`.
- Версия: `1`.
- Повреждённый JSON, не-объект или версия из будущего → сохранение игнорируется.
- Неполные данные нормализуются: добавляются новые объекты/зоны/ресурсы.
- Autosave: 20 секунд, debounce 250 мс после значимых действий, `pagehide` и `visibilitychange`.
- Оффлайн: максимум 2 часа; не более 60 циклов на объект; учитываются животные и автособираемые грядки; с помощниками доход выше.
- При claim оффлайн-награды состояние сохраняется сразу, чтобы не было дублей.

## Пауза, звук, фокус

- Playgama pause/audio events подписаны в адаптере.
- Yandex не даёт отдельного audio state API; игра реагирует на `visibilitychange`.
- При потере фокуса/скрытии вкладки звук ставится на паузу, gameplay останавливается, прогресс сохраняется.
- При возврате звук возобновляется только если пользователь не выключил его в настройках.

## Локализация

- Источник: сохранённый язык → язык платформы → `en`.
- Поддержаны `ru` и `en`.
- Тексты лежат в `src/data/locales`.
- При смене языка HUD, подписи объектов, зоны, магазин и подсказки перерисовываются без перезагрузки.

## Ручная проверка

```bash
npm run dev
# http://localhost:5173/?platform=mock
```

Чек-лист:

1. В консоли нет ошибок.
2. `game_ready`/`gameplay_start` вызываются после загрузки.
3. Сохранение появляется в `localStorage` после первого действия.
4. Rewarded в Mock показывает оверлей и выдаёт награду после завершения.
5. Отмена rewarded не выдаёт награду.
6. Оффлайн-модалка появляется после возврата с `lastSaveTimestamp` в прошлом.
7. Язык переключается в настройках.
8. При скрытии вкладки звук останавливается, при возврате — возобновляется.
9. На мобильном landscape интерфейс читаем; в портрете показывается rotate hint.

## Ограничения

- Нет IAP, лидербордов, player profile и cloud sync между устройствами в MVP.
- Yandex music/audio state не предоставляется SDK; используется браузерная видимость.
- Playgama rewarded callbacks подтверждены через state events; при использовании другого wrapper проверьте его официальную документацию.
- Не добавляйте нативный Yandex SDK поверх Playgama Bridge без необходимости.
