# Контекст сессии: «Ферма на Облаке»

Дата сессии: 2026-11-19  
Назначение: восстановить контекст следующей сессии без истории чата.  
Проект: `/Users/aleksandrmolcanov/Documents/Project/Farm`  
Репозиторий: https://github.com/AleksMolch/Cloud_Farm.git  
Ветка: `main`, upstream `origin/main`  
Последний проверенный commit: `9085d9d` (`fix: harden saves, offline claims and platform lifecycle`)  
Пуш: выполнен, `git ls-remote origin main` = `9085d9dd8a939a54f3a08c39a45f8a440cb43c6d`  
Рабочее дерево на момент завершения: чистое (`main...origin/main`)

## 1. Указания пользователя

- Изучить файлы в папке проекта: идея игры, требования SDK, задание на реализацию.
- Составить план и приступить к реализации.
- Задавать вопросы при необходимости.
- Общаться и вести рассуждения на русском языке.
- Сделать коммит и пуш в `https://github.com/AleksMolch/Cloud_Farm.git`.
- Сохранить контекст этой сессии в отдельный файл для следующей сессии (этот файл).
- На уточняющий вопрос пользователь подтвердил, что генерация изображений не обязательна и участие оператора нужно только для публикации/финального арта.

## 2. Исходные документы проекта

- `ferma_na_oblake_llm_design_brief.md` — подробный дизайн-бриф.
- `llm_game_dev_playgama_yandex_prompt.md` — универсальное задание по разработке HTML5-игры.
- `sdk_compatibility_report_playgama_yandex.md` — отчёт о совместимости SDK.
- `docs/superpowers/specs/2026-11-19-cloud-farm-design.md` — принятая спецификация MVP.
- `docs/superpowers/plans/2026-11-19-cloud-farm-mvp.md` — план реализации (все задачи выполнены).

## 3. Что построено

Игра «Ферма на Облаке» / Cloud Farm — data-driven idle farm tycoon для Playgama, Yandex Games и web.

Стек:

- Phaser 3.90.0
- TypeScript 5.9.3
- Vite 7.3.8
- Vitest 3.2.7
- Sharp 0.35.5 (опциональный image pipeline)
- SVG-ассеты
- WebAudio-синтез музыки и SFX
- Node.js 24 (проверено), требуется Node 20+

Реализовано:

- Один парящий остров с 4 зонами: meadow, terrace, yard, mill.
- 4 культуры: wheat, carrot, strawberry, cloudberry.
- 3 животных: chicken (egg), cow (milk), sheep (wool).
- 3 здания: mill (wheat → flour), bakery (flour + egg → pie), dairy (milk → cream).
- 2 помощника: cat (автосбор и пересадка plot_wheat), dog (ускорение животных на 20%).
- 14 шаблонов заказов, 3 активных заказа, таймеры и автообновление.
- Апгрейды до 5 уровня, цена `baseCost * growth^(level-1)`.
- Облачная экономика: coin + crystal.
- Туториал из 3 шагов: собрать пшеницу, выполнить заказ, улучшить грядку.
- Оффлайн-доход до 2 часов, не более 60 циклов на объект.
- Rewarded x2 оффлайн и ускорение производства.
- Interstitial после 3 минут сессии (открытие зоны и каждая 5-я цель заказов).
- Сохранения с версией, нормализацией, autosave, pendingOffline.
- ru/en локализация, смена языка в настройках.
- Склад ресурсов, магазин, панель объекта, заказы, настройки, оффлайн-модалка.
- Pause/audio/platform lifecycle.
- MockAdapter, PlaygamaAdapter, YandexAdapter.
- 33 SVG-ассета (добавлена иконка почты).
- Docs, Nano Banana prompts, image/audio pipelines.
- 102 unit-теста в 20 файлах.

## 4. Структура проекта

```text
src/
  main.ts
  game/
    config.ts
    data/
      loadGameData.ts
      createInitialState.ts
    scenes/
      BootScene.ts
      PreloadScene.ts
      FarmScene.ts
      UIScene.ts
    systems/
      EventBus.ts
      TimeService.ts
      EconomyService.ts
      ProductionService.ts
      UpgradeService.ts
      UnlockService.ts
      OrderService.ts
      OfflineProgressService.ts
      TutorialService.ts
      SaveService.ts
      LocalizationService.ts
      AudioService.ts
      AdManager.ts
      GameplayLifecycle.ts
      GameContext.ts
    platform/
      MockAdapter.ts
      PlaygamaAdapter.ts
      YandexAdapter.ts
      createPlatform.ts
      platformGlobals.d.ts
    types/
      GameState.ts
      ConfigTypes.ts
      PlatformTypes.ts
    ui/
      Button.ts
      Modal.ts
      FloatingText.ts
      theme.ts
    views/
      FarmObjectView.ts
  data/
    crops.json
    animals.json
    buildings.json
    zones.json
    orders.json
    helpers.json
    tutorial.json
    locales/ru.json
    locales/en.json
  styles.css
tests/
public/
  assets/images/*.svg
  playgama-bridge-config.json
docs/
scripts/
```

## 5. Ключевые проектные решения

- `GameState` — единственный источник прогресса.
- JSON-конфиги определяют контент, цены, таймеры, уровни, награды.
- Сервисы не зависят от Phaser.
- Сцены только отображают состояние и вызывают сервисы.
- UI не мутирует `GameState` напрямую; для открытий добавлен `UnlockService`.
- Время хранится timestamp-ами (`productionStartedAt`, `productionEndsAt`).
- Оффлайн-отчёт хранится в `GameState.pendingOffline`, чтобы autosave/reload не теряли награду.
- Claim оффлайн-награды атомарен: при ошибке сохранения состояние откатывается, модалка остаётся.
- `SaveService` сериализует записи; `lastSaveTimestamp` обновляется только после успешной записи.
- `GameplayLifecycle` централизованно управляет `gameplayStart/gameplayStop`; причины паузы стекируются (`modal`, `ad`, `platform`).
- Открытые модалки ставят `FarmScene` на паузу через `scene.pause('FarmScene')`.
- Bridge имеет приоритет над Yandex-доменом; нативный YandexAdapter только через `?platform=yandex` или при отсутствии Bridge.
- Yandex язык читается из `ysdk.environment.i18n.lang`.
- Yandex и Playgama не используют `localStorage` как fallback сохранения.
- Ошибка чтения сохранения не трактуется как новый игрок: boot показывает безопасный экран ошибки.
- Canvas: `Phaser.Scale.FIT`, базовая логика 1280×720.
- Портрет на телефоне: HTML-подсказка «Поверните устройство»; landscape поддерживается.

## 6. Сохранения и оффлайн

- Ключ: `cloud_farm_save`.
- Версия: `1`.
- Autosave: 20 секунд.
- Debounce значимых действий: 250 мс.
- Также сохранение на `pagehide` и `visibilitychange`.
- `pendingOffline` сохраняется в JSON.
- Оффлайн cap: 2 часа.
- Лимит циклов на объект: 60.
- Кот автоматически собирает и пересаживает пшеницу.
- Кот догоняет пропущенные циклы после throttling/скрытия вкладки.
- Claim rebase-ит таймеры животных и автособираемых грядок, чтобы не было двойного сбора.
- При ошибке сохранения claim: ресурсы откатываются, pending остаётся, UI показывает `toast.offline_save_failed`.
- При ошибке загрузки сохранения игра не стартует с новым состоянием и не перезаписывает прогресс; показывается безопасный экран ошибки.

## 7. Платформы и реклама

Playgama:

- Bridge script подключён в `index.html`: `https://bridge.playgama.com/v1/stable/playgama-bridge.js`.
- `bridge.initialize()`.
- `bridge.platform.language`.
- `bridge.platform.sendMessage('game_ready')`.
- `bridge.storage.get/set`.
- `bridge.advertisement.showRewarded` + `rewardedState` events.
- `bridge.advertisement.showInterstitial`.
- Pause/audio events.
- `public/playgama-bridge-config.json` содержит placements: `offline_double`, `speed_up`, `zone_unlocked`, `milestone`.

Yandex:

- `YaGames.init()`.
- `/sdk.js` подключается динамически только в YandexAdapter.
- `LoadingAPI.ready`.
- `GameplayAPI.start/stop`.
- `showFullscreenAdv`, `showRewardedVideo`.
- `ysdk.getStorage()`.
- Без localStorage fallback.
- Язык из `environment.i18n.lang`.

Выбор адаптера (`createPlatform.ts`):

- `?platform=mock` → Mock.
- `?platform=yandex` → Yandex.
- `?platform=playgama` → Playgama.
- Bridge загружен → Playgama; если platform.id = mock → Mock.
- Bridge отсутствует, Yandex-домен → Yandex.
- Иначе → Mock.

Тестовые режимы:

- `?platform=mock`
- `?platform=playgama`
- `?platform=yandex`

Особенность: Playgama Bridge в mock-режиме показывает свой оверлей до `game_ready`; при fallback на MockAdapter `createPlatform` сначала отправляет `game_ready`, чтобы оверлей исчез.

## 8. Проверка и результаты

Последняя верификация:

- `npm run typecheck` — pass.
- `npm test` — 102/102 pass, 20 файлов (после modernization milestone).
- `npm run build` — pass.
- Chrome headless smoke — 0 console/page errors.
- Проверены:
  - сбор урожая;
  - посадка;
  - заказ и награда;
  - апгрейд;
  - покупка моркови;
  - склад;
  - настройки и ru/en;
  - оффлайн-модалка;
  - autosave → reload → pending offline сохранился;
  - claim → pending null, ресурсы начислены, повторный reload без дубля;
  - мобильный landscape;
  - portrait rotate hint;
  - блокировка закрытия модалки кликом по пустому месту;
  - touch targets увеличены до 56 логических px у основных кнопок.

Git:

```text
9085d9d fix: harden saves, offline claims and platform lifecycle
1c3864c docs: add assets, platform and publishing guides
6a1cb0d feat: build playable cloud farm scene and UI
e0a3d35 feat: add tested unlock service for UI actions
ab6b768 feat: wire audio, ads and game context
f13696e feat: add isolated platform adapters
0ed74a8 feat: add save and localization services
f6c4c65 feat: add orders, offline progress and tutorial
c50dbac feat: add production and upgrade systems
425cce7 feat: add core state, events and economy
0029cf3 chore: scaffold project, game data and design plan
```

Пуш выполнен в `origin/main`; SHA удалённой ветки совпадает с локальным.

## 9. Независимое ревью

Было запущено fresh-context ревью всего diff. Найдены 2 Critical и 8 Important.

Исправлено:

- потеря невостребованного оффлайн-дохода до claim;
- неупорядоченные/неатомарные записи сохранения и ложный успех claim;
- двойной сбор после оффлайн-claim;
- кот останавливался после ручного сбора;
- Playgama-on-Yandex выбирал нативный Yandex SDK;
- Yandex locale и localStorage fallback;
- lifecycle меню/рекламы/паузы;
- transient save-load failure перезаписывал сохранение;
- touch targets;
- пробелы в тестах;
- закрытие модалки кликом по пустому месту;
- кнопки пагинации за пределами панели;
- составные заказы без проверки входных ресурсов;
- сохранение после collect/plant/start/collect building.

Решение по скрытой вкладке:

- Оффлайн-доход за скрытую вкладку начисляется при reload.
- В активной скрытой вкладке животные сохраняют один готовый продукт, а кот догоняет пропущенные циклы.
- Причина: не показывать оффлайн-модалку при каждом возврате фокуса и сохранить idle-семантику.
- Если это неверно: игрок получит меньше продукции животных до перезагрузки.

Отложенные мелочи:

- локализация статического HTML и версии;
- таймауты инициализации Bridge/storage;
- multi-tab save locking;
- внешние провайдеры аналитики сверх Playgama/Metrica;
- полноценный portrait UI (сейчас rotate hint);
- физический размер touch targets при FIT-масштабировании на маленьких телефонах.

Вне MVP по решению ревью/спеки:

- реальные sandbox-проверки Playgama/Yandex;
- IAP, лидерборды, player profile;
- балансовая тонкая настройка;
- финальный арт/музыка;
- store metadata, privacy policy, возрастной рейтинг;
- multi-tab, clock tampering, серверная экономика.

## 10. Ассеты и опциональная генерация

- Все текущие изображения — 33 SVG в `public/assets/images`.
- Генерация изображений для запуска не нужна.
- `docs/ASSETS.md` — список ассетов.
- `docs/NANO_BANANA_PROMPTS.md` — промпты для опциональной замены арта.
- `scripts/process-images.mjs` — trim/compress и manifest для растровых ассетов.
- `scripts/process-audio.sh` — нормализация/fade/OGG через ffmpeg.
- ffmpeg на машине отсутствовал; для audio pipeline нужен `brew install ffmpeg`.
- Если менять SVG на PNG/WebP, обновить пути в `src/game/scenes/PreloadScene.ts`.

## 11. Команды

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build
npm run preview
```

Если `npm install` падает с EACCES на глобальном cache:

```bash
npm install --cache /var/folders/3j/tlh8pf715qv5t8jg2y6xm7_w0000gn/T/opencode/npm-cache
```

Проверка страницы:

```bash
npm run preview -- --port 4173 --strictPort
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:4173/
```

Playwright на машине был доступен через npx cache, но ожидаемая ревизия браузера не совпадала. Рабочий вариант:

```bash
npx playwright screenshot --channel chrome --wait-for-timeout=3500 --viewport-size=1280,720 http://localhost:4173/ /tmp/screen.png
```

Для интерактивных smoke-тестов использовался Node-скрипт с:

```bash
NODE_PATH=/Users/aleksandrmolcanov/.npm/_npx/e41f203b7505f1fb/node_modules node /tmp/script.cjs
```

Временные Playwright-скрипты в `/tmp` в репозиторий не входят и могут не сохраниться.

## 12. Документация проекта

- `README.md` — запуск, обзор, архитектура, тесты, сборка.
- `docs/PLATFORM_INTEGRATION.md` — Playgama/Yandex/Mock, lifecycle, storage, ads, pause.
- `docs/PUBLISHING_CHECKLIST.md` — чек-лист публикации.
- `docs/ASSETS.md` — ассеты.
- `docs/NANO_BANANA_PROMPTS.md` — промпты Nano Banana.
- `docs/superpowers/specs/2026-11-19-cloud-farm-design.md` — спецификация.
- `docs/superpowers/plans/2026-11-19-cloud-farm-mvp.md` — план.

## 13. Что делать в следующей сессии

1. Прочитать этот файл, `README.md`, спеку и план.
2. Проверить `git status -sb` и `git log --oneline -3`.
3. Запустить `npm run typecheck && npm test && npm run build`.
4. Если нужна доработка — открыть соответствующий сервис/сцену, писать тест первым для логики.
5. Для UI-изменений проверять Chrome headless desktop + mobile landscape + portrait hint.
6. Не забыть: коммит и пуш только по явному запросу пользователя.
7. Перед публикацией выполнить `docs/PUBLISHING_CHECKLIST.md` и sandbox-проверки платформ.

## 14. Важные предупреждения

- Не добавлять нативный Yandex SDK поверх Playgama Bridge без явной необходимости.
- Не использовать `localStorage` как основной storage для Playgama/Yandex.
- Не менять `SAVE_VERSION` без миграции/нормализации.
- Не сохранять каждый кадр и не спамить сохранениями.
- Не выдавать rewarded-награду без подтверждения SDK.
- Не показывать interstitial в первые 3 минуты.
- Не коммитить `node_modules`, `dist`, `.superpowers`, `raw_assets`.
- Не добавлять секреты и platform ID, которые должны настраиваться вручную.
- Текущий файл `docs/SESSION_CONTEXT.md` на момент создания может быть не закоммичен; проверить `git status`.

## 15. Текущее состояние репозитория

- Локальная ветка `main` отслеживает `origin/main`.
- Последний коммит: `9085d9d`.
- Удалённый `main` указывает на тот же SHA.
- `docs/SESSION_CONTEXT.md` создан после пуша и не входит в последний коммит.
- Рабочее дерево до создания этого файла было чистым.
- Preview-сервер после проверки был остановлен.

## 16. Ответ на вопрос про оператора

- Генерация изображений не требуется для текущей версии.
- Для финального арта генерация опциональна; оператор нужен для выбора/утверждения.
- Для публикации оператор нужен: аккаунты Playgama/Yandex, ad placements, sandbox, модерация, иконка, скриншоты, privacy policy.
- Для локального запуска, тестов и сборки участие оператора не требуется.


## Обновление 2026-11-20: modernization milestone

Реализовано поверх коммита `9085d9d` (изменения пока не закоммичены):

- `AnalyticsService` с consent-буфером и `firstEvents`.
- Транспорты:
  - `PlaygamaAnalyticsTransport` через `bridge.analytics.send`;
  - `YandexMetricaTransport` через `window.ym` и `VITE_YANDEX_METRICA_COUNTER_ID`;
  - `LocalAnalyticsTransport` для Mock/dev.
- Consent-карточка после туториала, настройка аналитики в settings.
- `StoryService` и `src/data/story.json`: 5 коротких писем Хранителя.
- Почта в HUD, модалка писем, unread/pulse.
- Progressive HUD: заказы после первого сбора, магазин после первого заказа, склад после ресурса, цель после туториала, почта после первого письма.
- First-session juice: burst-частицы, camera flash, island pulse, first tap tracking.
- Save version 2 с нормализацией старых сохранений; новые поля `analytics` и `story`.
- Документация `docs/ANALYTICS.md`, `.env.example`, обновлены README/PLATFORM/PUBLISHING/ASSETS.
- Новая иконка `public/assets/images/icon_mail.svg`.
- Тесты: 102/102 pass.

Проверено в браузере:

- initial HUD показывает только валюту и настройки;
- после сбора появляются заказы и склад;
- после заказа появляются магазин и почта;
- письмо открывается, unread сбрасывается;
- consent-карточка появляется после туториала в `?platform=playgama`;
- allow сохраняет `analytics.consent=granted` и `firstEvents`;
- в Mock/local consent не запрашивается, события идут в локальный транспорт;
- settings показывает переключатель аналитики для Playgama/Metrica;
- сборка, typecheck и browser smoke без ошибок.

Текущий git status: modernization-изменения не закоммичены; перед следующей сессией проверить `git status` и при необходимости сделать commit/push по запросу пользователя.
