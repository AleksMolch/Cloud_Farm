# Ферма на Облаке — план реализации MVP

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Рабочий HTML5 idle farm tycoon «Ферма на Облаке» на Phaser 3 + TypeScript + Vite с платформенным слоем Playgama/Yandex, локализацией, сохранениями и оффлайн-доходом.

**Architecture:** Данные и экономика отделены от Phaser: JSON-конфиги + `GameState` + сервисы. Сцены только рисуют состояние и вызывают команды. Внешние SDK скрыты за `PlatformAdapter` с реализациями Mock/Playgama/Yandex.

**Tech Stack:** Phaser 3.90, TypeScript 5.9, Vite 7, Vitest 3, SVG-ассеты, WebAudio-синтез SFX, Playgama Bridge JS Core, Yandex Games SDK.

**Spec:** `docs/superpowers/specs/2026-11-19-cloud-farm-design.md`

## Global Constraints

- Phaser строго 3.x, без Unity/Cocos/3D/физики.
- Никаких цен и таймеров в сценах — только JSON-конфиги.
- Все обращения к SDK — только через `PlatformAdapter`.
- Сохранение — JSON с версией; localStorage только в MockAdapter.
- Rewarded награда только после подтверждения SDK; rewarded строго по действию игрока.
- Interstitial не раньше 3 минут первой сессии и только в естественных паузах.
- Языки: ru + en, fallback en.
- Минимальный touch target 56 логических px.
- Сборка и тесты обязательны перед коммитом.

## Review Focus

- Повторный вход/выход из игры: оффлайн-доход не должен дублироваться, теряться или превышать 2 часа.
- Повреждённое/частичное сохранение: игра должна стартовать с безопасным состоянием, а не падать.
- Rewarded отмена/ошибка: награда не выдаётся, UI остаётся рабочим.
- Быстрые повторные тапы: ресурсы не должны уходить в минус, заказ/апгрейд не выполняются дважды.
- Платформа без рекламы: кнопки rewarded скрыты/не ломают поток, base-награда доступна.

---

### Task 1: Каркас проекта и данные

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts`, `src/styles.css`, `.gitignore`
- Create: `src/data/{crops,animals,buildings,zones,orders,helpers,tutorial}.json`, `src/data/locales/{ru,en}.json`
- Create: `src/game/types/{GameState,ConfigTypes,PlatformTypes}.ts`, `src/game/data/loadGameData.ts`, `src/game/data/createInitialState.ts`

**Interfaces:**
- Produces: `ResourceId`, `ResourceAmount`, `FarmObjectConfig`, `GameData`, `loadGameData()`, `createInitialState(data, now)`, `normalizeState(raw, data, now)`.
- Produces: конфиг-данные для всех сервисов и сцен.

- [ ] **Step 1:** Создать `package.json` со скриптами `dev`, `build`, `test`, `typecheck`, `preview`; зависимости phaser 3.90, vite 7, typescript 5.9, vitest 3.
- [ ] **Step 2:** Создать JSON-конфиги MVP: 4 культуры, 3 животных, 3 здания, 4 зоны, 12+ заказов, 2 помощника, 3 шага туториала, ru/en словари.
- [ ] **Step 3:** Написать типы и `loadGameData()` (объединённый каталог объектов, карта производителей ресурсов).
- [ ] **Step 4:** Написать `createInitialState()` и `normalizeState()` (все ресурсы/объекты/зоны, первая пшеница готова, миграция недостающих полей).
- [ ] **Step 5:** Проверить `npm run typecheck` (ожидается успех после появления зависимостей).
- [ ] **Step 6:** Commit: `chore: scaffold project and game data`.

### Task 2: EventBus, время, экономика

**Files:**
- Create: `src/game/systems/{EventBus,TimeService,EconomyService}.ts`
- Test: `tests/economy.test.ts`, `tests/initial-state.test.ts`

**Interfaces:**
- Consumes: `GameState`, `ResourceAmount`.
- Produces: `EventBus.on/emit`, `TimeService.now()`, `EconomyService.get/grant/spend/canAfford`.

- [ ] **Step 1:** Тесты: начальное состояние содержит все ресурсы и объекты; пшеница готова; `grant` увеличивает, `spend` не уводит в минус и возвращает false при нехватке.
- [ ] **Step 2:** Запустить тесты, убедиться в падении.
- [ ] **Step 3:** Реализовать EventBus (типизированные события), TimeService (инъекция часов), EconomyService.
- [ ] **Step 4:** Запустить тесты — PASS.
- [ ] **Step 5:** Commit: `feat: add core state, events and economy`.

### Task 3: Производство и апгрейды

**Files:**
- Create: `src/game/systems/{ProductionService,UpgradeService}.ts`
- Test: `tests/production.test.ts`, `tests/upgrades.test.ts`

**Interfaces:**
- Consumes: `GameData`, `GameState`, `EconomyService`, `EventBus`, `TimeService`.
- Produces: `getStatus(objectId, now)`, `interact(objectId, now)`, `plant`, `collect`, `startBuilding`, `collectBuilding`, `speedUp`, `tickAutoCollect`, `getUpgradeCost`, `upgrade`.

- [ ] **Step 1:** Тесты полного цикла грядки: сбор → пусто → посадка → рост → готовность → сбор.
- [ ] **Step 2:** Тесты животного (автоцикл, сбор, рестарт), пса (−20% времени), кота (автосбор+пересадка).
- [ ] **Step 3:** Тесты здания: нехватка входа не запускает, успешный запуск списывает вход, сбор выдаёт выход и очищает состояние.
- [ ] **Step 4:** Тесты апгрейда: цена растёт `base * growth^(level-1)`, максимум 5, уровень меняет выход/скорость, при нехватке монет апгрейд не проходит.
- [ ] **Step 5:** Реализовать сервисы; запустить тесты — PASS.
- [ ] **Step 6:** Commit: `feat: add production and upgrade systems`.

### Task 4: Заказы, оффлайн-прогресс, туториал

**Files:**
- Create: `src/game/systems/{OrderService,OfflineProgressService,TutorialService}.ts`
- Test: `tests/orders.test.ts`, `tests/offline.test.ts`, `tests/tutorial.test.ts`

**Interfaces:**
- Produces: `ensureOrders(now)`, `completeOrder(id, now)`, `getEligibleTemplates()`, `compute(state, now)`, `claim(gains, multiplier)`, `getCurrentStep()`, `notify(event)`.
- Consumes события `crop:collected`, `order:completed`, `object:upgraded`.

- [ ] **Step 1:** Тесты заказов: первый заказ — 2 пшеницы → 20 монет; нехватка не списывает; успех списывает и выдаёт; после выполнения список снова из 3; шаблон с мукой недоступен без мельницы.
- [ ] **Step 2:** Тесты оффлайна: без помощников и животных дохода нет; с котом/животными считаются циклы; cap 2 часа; пёс ускоряет; x2 удваивает выдачу.
- [ ] **Step 3:** Тесты туториала: сбор пшеницы, заказ и апгрейд продвигают шаги; награда выдаётся один раз; завершённые шаги не повторяются после загрузки.
- [ ] **Step 4:** Реализовать сервисы, запустить тесты — PASS.
- [ ] **Step 5:** Commit: `feat: add orders, offline progress and tutorial`.

### Task 5: Сохранения и локализация

**Files:**
- Create: `src/game/systems/{SaveService,LocalizationService}.ts`
- Test: `tests/save.test.ts`, `tests/localization.test.ts`

**Interfaces:**
- Produces: `SaveService.load/save/reset`, `SaveScheduler.start/saveNow/dispose`, `LocalizationService.t/setLanguage/getLanguage`.
- Consumes: `PlatformAdapter`-подобный интерфейс load/save.

- [ ] **Step 1:** Тесты сохранения: round-trip; повреждённые данные → null; версия выше текущей → null; нормализация заполняет новые объекты; autosave-планировщик вызывает save.
- [ ] **Step 2:** Тесты локализации: ru/en, параметры `{n}`, fallback на en и ключ.
- [ ] **Step 3:** Реализовать сервисы; тесты — PASS.
- [ ] **Step 4:** Commit: `feat: add save and localization services`.

### Task 6: Платформенный слой

**Files:**
- Create: `src/game/platform/{PlatformAdapter,MockAdapter,PlaygamaAdapter,YandexAdapter,createPlatform}.ts`
- Create: `public/playgama-bridge-config.json`
- Test: `tests/platform.test.ts`

**Interfaces:**
- Produces: `init`, `ready`, `gameplayStart/Stop`, `getLanguage`, `isAudioEnabled`, `onPauseChanged`, `onAudioChanged`, `showRewarded`, `showInterstitial`, `saveData`, `loadData`, `isRewardedSupported`, `isInterstitialSupported`.

- [ ] **Step 1:** Тест MockAdapter: save/load, награда только после имитации, pause-события.
- [ ] **Step 2:** Реализовать MockAdapter (localStorage, DOM-оверлей mock-рекламы).
- [ ] **Step 3:** Реализовать PlaygamaAdapter по подтверждённым API: `bridge.initialize()`, `bridge.platform.language`, `sendMessage('game_ready')`, `EVENT_NAME.PAUSE_STATE_CHANGED/AUDIO_STATE_CHANGED`, `advertisement.showRewarded/showInterstitial`, `rewardedState`, `storage.get/set`, поддержка флагов.
- [ ] **Step 4:** Реализовать YandexAdapter по подтверждённым API: `/sdk.js`, `YaGames.init()`, `LoadingAPI.ready`, `GameplayAPI.start/stop`, `adv.showFullscreenAdv/showRewardedVideo`, `getStorage`; награда только по `onRewarded`.
- [ ] **Step 5:** Реализовать auto-выбор адаптера с fallback на Mock; тесты — PASS.
- [ ] **Step 6:** Commit: `feat: add isolated platform adapters`.

### Task 7: Звук, реклама, игровой контекст

**Files:**
- Create: `src/game/systems/{AudioService,AdManager,GameContext}.ts`
- Test: `tests/ad-manager.test.ts`, `tests/game-context.test.ts`

**Interfaces:**
- Produces: `AudioService.unlock/sfx/applySettings/pause/resume`, `AdManager.showRewarded/showInterstitial/isRewardedSupported`, `GameContext.tick/claimOffline/requestSave`.

- [ ] **Step 1:** Тест AdManager: gameplayStop→showRewarded→gameplayStart, отменённая реклама не увеличивает stats, interstitial уважает 3-минутный порог.
- [ ] **Step 2:** Реализовать WebAudio SFX/музыку без внешних файлов, реакцию на mute/pause.
- [ ] **Step 3:** Реализовать GameContext (сборка сервисов, автосейв, обработка событий).
- [ ] **Step 4:** Тесты — PASS; Commit: `feat: wire audio, ads and game context`.

### Task 8: SVG-ассеты и игровые сцены

**Files:**
- Create: `public/assets/images/*.svg` (остров, грядки, культуры, животные, здания, помощники, иконки, радужный мост)
- Create: `src/game/scenes/{BootScene,PreloadScene,FarmScene,UIScene}.ts`, `src/game/config.ts`, `src/game/views/FarmObjectView.ts`, `src/game/ui/*`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `GameContext` через registry.
- Produces: интерактивный остров, HUD, панели заказов/магазина/объекта/настроек/оффлайна, туториальные подсветки.

- [ ] **Step 1:** Нарисовать связные SVG-ассеты в единой палитре.
- [ ] **Step 2:** Реализовать Boot/Preload: загрузка SVG, прогресс, ready/gameplayStart после первого кадра.
- [ ] **Step 3:** Реализовать FarmScene: фон, облака, остров, зоны, объекты, timers, ready-пузыри, floating text, клики.
- [ ] **Step 4:** Реализовать UIScene: HUD, цель, подсказки, toast, все модальные панели, настройки, оффлайн x2.
- [ ] **Step 5:** Ручная проверка desktop/mobile размеров; `npm run build` — PASS.
- [ ] **Step 6:** Commit: `feat: build playable cloud farm scene and UI`.

### Task 9: Документация, ассеты, pipeline, публикация

**Files:**
- Create: `README.md`, `docs/ASSETS.md`, `docs/NANO_BANANA_PROMPTS.md`, `docs/PLATFORM_INTEGRATION.md`, `docs/PUBLISHING_CHECKLIST.md`
- Create: `scripts/process-images.mjs`, `scripts/process-audio.sh`

- [ ] **Step 1:** Описать запуск, архитектуру, управление, тесты, сборку.
- [ ] **Step 2:** Составить ассет-лист и промпты Nano Banana для замены SVG на финальный арт.
- [ ] **Step 3:** Написать рабочие image/audio pipeline-скрипты с понятными ошибками.
- [ ] **Step 4:** Описать Playgama/Yandex интеграцию, рекламу, сохранения, лимиты, checkout публикации.
- [ ] **Step 5:** Commit: `docs: add assets, platform and publishing guides`.

### Task 10: Финальная верификация и публикация

- [ ] **Step 1:** `npm install`, `npm run typecheck`, `npm test`, `npm run build` — всё PASS.
- [ ] **Step 2:** Проверить сборку через `npm run preview` (HTTP 200, canvas присутствует).
- [ ] **Step 3:** Проверить отсутствие секретов и лишних файлов, `.gitignore`.
- [ ] **Step 4:** Инициализировать git, коммиты по задачам, добавить remote `https://github.com/AleksMolch/Cloud_Farm.git`, push в `main`.
- [ ] **Step 5:** Сообщить пользователю результаты и что осталось сделать вручную (аккаунты платформ, генерация финального арта, настройка placements).
