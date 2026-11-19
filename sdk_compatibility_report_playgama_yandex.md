# Отчет о совместимости: универсальное задание для LLM + Playgama Bridge SDK + Yandex Games SDK

Дата подготовки: 2026-11-19  
Назначение: проверить, не конфликтует ли ранее подготовленный универсальный промпт с актуальными требованиями Playgama Bridge SDK и Yandex Games SDK, и зафиксировать уточнения для передачи LLM.

---

## 1. Использованные источники

### Playgama Bridge SDK

Изучены материалы:

- https://wiki.playgama.com/playgama/bridge-sdk-v1
- https://wiki.playgama.com/playgama/bridge-sdk-v1/bridge-sdk/setup
- https://wiki.playgama.com/playgama/bridge-sdk-v1/bridge-sdk/api
- https://wiki.playgama.com/playgama/bridge-sdk-v1/bridge-sdk/api/platform
- https://wiki.playgama.com/playgama/bridge-sdk/api/advertisement/interstitial
- https://wiki.playgama.com/playgama/bridge-sdk/api/advertisement/rewarded
- https://wiki.playgama.com/playgama/bridge-sdk/api/storage
- https://github.com/playgama/bridge

### Yandex Games SDK

Изучены материалы:

- https://yandex.com/dev/games/doc/en/sdk/sdk-about
- https://yandex.com/dev/games/doc/en/sdk/sdk-game-events
- https://yandex.com/dev/games/doc/en/sdk/sdk-adv
- https://yandex.com/dev/games/doc/en/sdk/sdk-player
- https://yandex.com/dev/games/doc/en/sdk/sdk-leaderboard
- https://yandex.com/dev/games/doc/en/requirements/1/19

---

## 2. Главный вывод

Ранее подготовленный универсальный промпт в целом совместим с требованиями Playgama и Yandex Games, потому что уже содержит правильные базовые принципы:

- обязательное планирование до написания кода;
- изоляция платформенного SDK через adapter;
- fallback/mock-режим для локальной разработки;
- аккуратная реклама;
- сохранения;
- локализация;
- ассеты и pipeline обработки;
- запрет на выдумывание неподтвержденных SDK-вызовов.

Но прежний промпт был слишком общим по SDK. Для реального прохождения платформенной проверки его нужно усилить в четырех местах:

1. Playgama требует `platform.sendMessage('game_ready')` именно когда первый playable frame готов.
2. Playgama требует storage через Bridge Storage, а не через `localStorage` как основной механизм.
3. Yandex требует `ysdk.features.LoadingAPI?.ready()` и корректную разметку gameplay через `GameplayAPI.start()`/`GameplayAPI.stop()`.
4. Нельзя одновременно бездумно подключать Playgama Bridge и прямой Yandex SDK, если Playgama Bridge уже является основным кроссплатформенным слоем.

Эти уточнения внесены в обновленный файл `llm_game_dev_playgama_yandex_prompt.md`.

---

## 3. Playgama Bridge SDK: подтвержденные требования

### 3.1. Обязательные шаги интеграции

Из документации Playgama следует обязательный порядок:

1. Установить Bridge package для выбранного движка или JS Core.
2. Создать/обновить `playgama-bridge-config.json`, если стек этого требует.
3. Дождаться завершения инициализации Bridge до любых вызовов SDK.
4. Использовать `platform.language` для локализации.
5. Загрузить сохраненный прогресс через `storage.get(...)`.
6. Вызвать `platform.sendMessage('game_ready')`, когда игра реально готова к взаимодействию.
7. Показывать interstitial-рекламу в естественных паузах.
8. Использовать rewarded ads как дополнительную монетизацию.
9. Обрабатывать pause/audio state events.

### 3.2. `game_ready`

Подтвержденное требование:

```js
platform.sendMessage('game_ready')
```

Смысл: платформа скрывает loading screen и начинает корректную аналитику только после этого сигнала.

Критично: `game_ready` нельзя отправлять во время loading screen. Его нужно отправлять после загрузки ресурсов и подготовки первого интерактивного кадра.

### 3.3. Язык

Подтвержденный источник:

```js
bridge.platform.language
```

Формат: ISO 639-1, например `ru`, `en`.

### 3.4. Storage

Подтвержденные примеры:

```js
bridge.storage.get(['coins', 'level'])
bridge.storage.set(['key_1', 'key_2'], ['value_1', 'value_2'])
```

Важное отличие от прежней общей рекомендации:

- для Playgama нельзя полагаться на `localStorage`, `sessionStorage`, IndexedDB, cookies или встроенные save-системы движка как на основной механизм;
- на старте нужно прочитать все ключи одним `storage.get([...])`;
- запись делать только при значимых изменениях;
- не писать каждый кадр или на каждое мелкое действие.

### 3.5. Interstitial-реклама

Подтвержденный пример:

```js
let placement = 'test_placement'; // optional
bridge.advertisement.showInterstitial(placement);
```

Важное уточнение:

- Bridge сам контролирует интервалы и возможность показа;
- разработчик должен вызывать interstitial в естественных паузах;
- не надо добавлять собственные таймеры/счетчики частоты показов, если платформа не требует иного.

### 3.6. Rewarded-реклама

Подтвержденный пример:

```js
let placement = 'test_placement'; // optional
bridge.advertisement.showRewarded(placement);
```

Осторожность: если конкретные callbacks/события rewarded не указаны во входной документации для выбранного движка, LLM не должна выдумывать их. Нужно оставить TODO и выдавать награду только по подтвержденному сигналу SDK.

### 3.7. Pause/audio state

Playgama требует, чтобы игра реагировала на паузу и состояние аудио.

Подтвержденный пример pause event:

```js
bridge.platform.on(EVENT_NAME.PAUSE_STATE_CHANGED, this.onPauseStateChanged.bind(this));

onPauseStateChanged(isPaused) {
  console.log('Is paused: ', isPaused);
}
```

Игра должна:

- ставить gameplay на паузу при platform pause;
- отключать звук при platform audio disabled;
- не продолжать играть/звучать в фоне;
- корректно восстанавливаться после рекламы/возврата вкладки.

---

## 4. Yandex Games SDK: подтвержденные требования

### 4.1. Подключение и инициализация

Подтвержденный пример:

```html
<script async src="/sdk.js" onload="initSDK()"></script>
<script>
  async function initSDK() {
    const ysdk = await YaGames.init();
  }
</script>
```

Подтвержденный пример:

```js
const ysdk = await YaGames.init();
ysdk.adv.showFullscreenAdv();
```

Критично:

- `/sdk.js` должен быть подключен до `YaGames.init()`;
- методы SDK нельзя вызывать до завершения инициализации;
- локальная разработка должна иметь mock/fallback.

### 4.2. LoadingAPI.ready

Подтвержденный метод:

```js
ysdk.features.LoadingAPI?.ready();
```

Его нужно вызывать, когда игра загрузила ресурсы и готова к взаимодействию.

### 4.3. GameplayAPI.start/stop

Подтвержденные методы:

```js
ysdk.features.GameplayAPI?.start();
ysdk.features.GameplayAPI?.stop();
```

`start()` вызывается, когда gameplay реально начинается/возобновляется:

- старт уровня;
- закрытие меню;
- снятие паузы;
- возврат после рекламы;
- возврат на вкладку.

`stop()` вызывается, когда gameplay реально прекращается:

- пауза;
- game over;
- завершение уровня;
- открытие меню;
- показ рекламы;
- уход со вкладки.

### 4.4. Fullscreen ads

Подтвержденный метод:

```js
ysdk.adv.showFullscreenAdv({
  callbacks: {
    onOpen: () => console.log('Ad opened.'),
    onClose: (wasShown) => console.log(wasShown ? 'Shown and closed.' : 'Not shown.'),
    onError: (error) => console.log('Call error.', error)
  }
});
```

Обязательная логика:

- до рекламы остановить gameplay;
- вызвать `GameplayAPI.stop()`;
- после закрытия рекламы восстановить состояние;
- не ломать игру при ошибке или `wasShown === false`.

### 4.5. Rewarded video

Подтвержденный метод:

```js
ysdk.adv.showRewardedVideo({
  callbacks: {
    onOpen: () => console.log('Ad opened.'),
    onRewarded: () => console.log('User received reward.'),
    onClose: (wasShown) => console.log(wasShown ? 'Shown and closed.' : 'Not shown.'),
    onError: (error) => console.log('Call error.', error)
  }
});
```

Главное правило: награда выдается только после `onRewarded`.

### 4.6. Storage/player

Подтвержденный safe storage:

```js
const ysdk = await YaGames.init();
const safeStorage = await ysdk.getStorage();
safeStorage.setItem('key', 'safe storage is working');
console.log(safeStorage.getItem('key'));
```

Возможное глобальное переопределение:

```js
const safeStorage = await ysdk.getStorage();
Object.defineProperty(window, 'localStorage', { get: () => safeStorage });
```

Но это нужно делать до любого использования `localStorage`.

Player:

```js
try {
  const player = await ysdk.getPlayer();
} catch (e) {
  // Error initializing the Player object.
}
```

### 4.7. Leaderboards

Используется `ysdk.leaderboards`. Точные имена таблиц и настройки не должны выдумываться LLM. Их нужно брать из конфигурации игры/платформы.

---

## 5. Найденные потенциальные конфликты с прежним промптом

### Конфликт 1: `localStorage fallback` против Playgama storage-only

В прежнем шаблоне говорилось про `localStorage fallback`. Это нормально для локальной разработки и Yandex safeStorage, но для Playgama как основной механизм нужно использовать Bridge Storage.

Решение в новом файле:

- `localStorage` разрешен только для `MockAdapter`/локальной разработки;
- PlaygamaAdapter обязан использовать `bridge.storage.get/set`;
- SaveManager не должен напрямую знать про `localStorage`.

Статус: конфликт устранен.

### Конфликт 2: общий `ready()` без различия платформ

Прежний шаблон говорил “ready”, но недостаточно жестко различал платформы.

Решение:

- Playgama: `platform.sendMessage('game_ready')`;
- Yandex: `ysdk.features.LoadingAPI?.ready()`.

Статус: конфликт устранен.

### Конфликт 3: gameplay lifecycle был описан слишком общо

Yandex moderation проверяет `GameplayAPI.start()` и `GameplayAPI.stop()`.

Решение:

- добавлен обязательный `gameplayStart()`/`gameplayStop()` в `PlatformAdapter`;
- описано, когда именно их вызывать.

Статус: конфликт устранен.

### Конфликт 4: риск двойной интеграции Playgama Bridge + Yandex SDK

Если Playgama Bridge используется как кроссплатформенный слой и публикация на Yandex идет через него, отдельное прямое подключение Yandex SDK может быть лишним или конфликтным.

Решение:

- новый промпт требует выбрать один основной слой интеграции;
- если используется Bridge, нативный YandexAdapter нужен только при прямой публикации в Yandex Games без Bridge или если это явно требуется.

Статус: предупреждение добавлено.

### Конфликт 5: rewarded ads в Playgama

Для Yandex callback `onRewarded` подтвержден. Для Playgama в извлеченных материалах подтвержден вызов `bridge.advertisement.showRewarded(placement)`, но не был надежно извлечен универсальный callback выдачи награды для всех движков.

Решение:

- YandexAdapter может возвращать `true` по `onRewarded`;
- PlaygamaAdapter не должен выдумывать callback;
- если в конкретном SDK-wrapper есть событие rewarded-state, нужно использовать официальную документацию выбранного wrapper;
- иначе оставить TODO и не выдавать награду без подтверждения.

Статус: риск отмечен, безопасное поведение задано.

---

## 6. Рекомендованная архитектура адаптеров

### 6.1. Единый интерфейс

```ts
export interface PlatformAdapter {
  init(): Promise<void>;
  ready(): Promise<void>;
  gameplayStart(): Promise<void>;
  gameplayStop(): Promise<void>;
  getLanguage(): string;
  isAudioEnabled(): boolean;
  onPauseChanged(callback: (paused: boolean) => void): void;
  onAudioChanged(callback: (enabled: boolean) => void): void;
  showInterstitial(placement?: string): Promise<boolean>;
  showRewarded(placement?: string): Promise<boolean>;
  saveData(key: string, value: unknown): Promise<void>;
  loadData<T>(key: string, fallback: T): Promise<T>;
  submitScore?(leaderboardName: string, score: number): Promise<void>;
  getLeaderboardEntries?(leaderboardName: string): Promise<unknown>;
}
```

### 6.2. MockAdapter

Назначение:

- локальный запуск;
- dev-сборка;
- тесты;
- отсутствие платформенного SDK.

Можно использовать `localStorage`, но только внутри MockAdapter.

### 6.3. PlaygamaAdapter

Использует:

- Bridge init;
- `bridge.platform.language`;
- `bridge.platform.sendMessage('game_ready')`;
- `bridge.storage.get/set`;
- `bridge.advertisement.showInterstitial(...)`;
- `bridge.advertisement.showRewarded(...)`;
- platform pause/audio events.

### 6.4. YandexAdapter

Использует:

- `YaGames.init()`;
- `ysdk.features.LoadingAPI?.ready()`;
- `ysdk.features.GameplayAPI?.start()`;
- `ysdk.features.GameplayAPI?.stop()`;
- `ysdk.adv.showFullscreenAdv(...)`;
- `ysdk.adv.showRewardedVideo(...)`;
- `ysdk.getStorage()`;
- `ysdk.getPlayer()`, если нужно;
- `ysdk.leaderboards`, если нужны лидерборды.

---

## 7. Итоговая рекомендация

Использовать обновленный файл:

```text
llm_game_dev_playgama_yandex_prompt.md
```

Он заменяет прежний универсальный промпт, потому что включает:

- исходную логику планирования и реализации;
- ассеты и Nano Banana;
- pipeline изображений/аудио;
- Playgama Bridge SDK specifics;
- Yandex Games SDK specifics;
- проверку конфликтов;
- безопасное правило не выдумывать SDK API.

Прежний промпт можно считать устаревшим, но не ошибочным. Главная проблема прежней версии — недостаточная конкретика по платформенным lifecycle/storage/gameplay requirements.

---

## 8. Краткий checklist для проверки будущих ответов LLM

Ответ LLM по конкретной игре должен содержать:

1. План до кода.
2. Рабочий MVP-код.
3. `PlatformAdapter`.
4. `MockAdapter`.
5. `PlaygamaAdapter`.
6. `YandexAdapter`, если нужна прямая публикация в Yandex.
7. `ready()` с правильным mapping.
8. `gameplayStart()`/`gameplayStop()`.
9. Playgama Bridge Storage для Playgama.
10. Yandex safeStorage/getStorage для Yandex.
11. Interstitial в естественных паузах.
12. Rewarded только по действию игрока.
13. Награда только после подтверждения SDK.
14. Обработка pause/audio/focus.
15. Локализация от SDK language.
16. Asset list.
17. Nano Banana prompts.
18. Image/audio processing pipeline.
19. Build/deploy instructions.
20. Checklist публикации.

Если этих пунктов нет, ответ LLM неполный.
