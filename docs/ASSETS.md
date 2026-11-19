# Ассеты «Фермы на Облаке»

Все текущие изображения — собственные SVG-ассеты в единой палитре. Они полностью рабочие для MVP и могут быть заменены финальным растровым или векторным артом без изменения игровой логики. Пути к текстурам заданы в `src/game/scenes/PreloadScene.ts` через `ASSET_PATH(name)`.

## Палитра

- небо: `#6ac7f2` → `#bcecff` → `#f2fbff`
- трава: `#b9f58a`, `#7ed95f`, `#52b84b`
- земля: `#d99d66`, `#b97c4d`, `#8b5534`
- дерево: `#b97845`, `#8c5730`
- свет: `#fff8ec`, `#ffe066`, `#ffa63d`
- акценты: `#ff9fb2`, `#8be9ff`, `#b6a3ff`

## Изображения

Формат по умолчанию: SVG с `viewBox`; прозрачный фон, кроме фонов неба (небо рисуется в Phaser).

| Путь | Размер viewBox | Назначение | Где используется | Можно заменить |
|---|---:|---|---|---|
| `public/assets/images/island.svg` | 1300×660 | Парящий остров | `FarmScene` | да |
| `public/assets/images/plot.svg` | 200×130 | Грядка | `FarmObjectView` | да |
| `public/assets/images/crop_wheat.svg` | 100×130 | Пшеница | грядка, склад, заказы | да |
| `public/assets/images/crop_carrot.svg` | 110×130 | Морковь | грядка, склад, заказы | да |
| `public/assets/images/crop_strawberry.svg` | 110×130 | Клубника | грядка, склад, заказы | да |
| `public/assets/images/crop_cloudberry.svg` | 110×130 | Облачная ягода | грядка, склад, заказы | да |
| `public/assets/images/animal_chicken.svg` | 130×130 | Курица / иконка курятника | животное, магазин | да |
| `public/assets/images/animal_cow.svg` | 180×150 | Корова | животное, магазин | да |
| `public/assets/images/animal_sheep.svg` | 170×150 | Овечка | животное, магазин | да |
| `public/assets/images/building_mill.svg` | 260×300 | Мельница | здание, магазин | да |
| `public/assets/images/building_bakery.svg` | 240×220 | Пекарня | здание, магазин | да |
| `public/assets/images/building_dairy.svg` | 230×220 | Молочная будка | здание, магазин | да |
| `public/assets/images/helper_cat.svg` | 120×110 | Облачный кот | помощник, магазин | да |
| `public/assets/images/helper_dog.svg` | 130×110 | Пёс-пастух | помощник, магазин | да |
| `public/assets/images/cloud.svg` | 220×100 | Облако | фон `FarmScene` | да |
| `public/assets/images/rainbow_bridge.svg` | 340×190 | Радужный мост-тизер | `FarmScene` | да |
| `public/assets/images/icon_coin.svg` | 64×64 | Монета | HUD, магазин, заказы | да |
| `public/assets/images/icon_crystal.svg` | 64×64 | Кристалл | HUD, магазин | да |
| `public/assets/images/icon_orders.svg` | 64×64 | Заказы | HUD | да |
| `public/assets/images/icon_shop.svg` | 64×64 | Магазин | HUD | да |
| `public/assets/images/icon_basket.svg` | 64×64 | Склад | HUD | да |
| `public/assets/images/icon_gear.svg` | 64×64 | Настройки | HUD | да |
| `public/assets/images/icon_lock.svg` | 64×64 | Замок | мир, магазин | да |
| `public/assets/images/icon_star.svg` | 64×64 | Цель/награда | HUD, подсказки | да |
| `public/assets/images/icon_music.svg` | 64×64 | Музыка | настройки | да |
| `public/assets/images/icon_sound.svg` | 64×64 | Звуки | настройки | да |
| `public/assets/images/resource_egg.svg` | 64×64 | Яйцо | склад, заказы, пузырь | да |
| `public/assets/images/resource_milk.svg` | 64×64 | Молоко | склад, заказы, пузырь | да |
| `public/assets/images/resource_wool.svg` | 64×64 | Шерсть | склад, заказы, пузырь | да |
| `public/assets/images/resource_flour.svg` | 64×64 | Мука | склад, заказы, пузырь | да |
| `public/assets/images/resource_pie.svg` | 64×64 | Пирог | склад, заказы, пузырь | да |
| `public/assets/images/resource_cream.svg` | 64×64 | Сливки | склад, заказы, пузырь | да |
| `index.html` → `icon_coin.svg` | 64×64 | favicon | браузер | да |

Итого: 32 SVG-файла. Все загружаются в `PreloadScene` с явными размерами, чтобы избежать зависимости от intrinsic size SVG.

## Аудио

В MVP аудио синтезируется через WebAudio в `src/game/systems/AudioService.ts`:

- `music_loop` — спокойная пентатоническая петля (синтез);
- `collect` — короткий восходящий сигнал;
- `success` — аккорд выполнения заказа/туториала;
- `upgrade` — восходящее арпеджио;
- `purchase` — покупка/найм;
- `error` — мягкий низкий сигнал;
- `click` — короткий тап.

Внешние файлы не требуются. Если нужен финальный аудио-арт, используйте `scripts/process-audio.sh` и имена из `docs/NANO_BANANA_PROMPTS.md` (раздел audio names).

## Manifest

Отдельный manifest для MVP не нужен: список ключей и размеров задан в `PreloadScene`. При замене SVG на PNG/WebP:

1. положите файлы в `public/assets/final/images`;
2. обновите пути/размеры в `PreloadScene`;
3. прогоните `node scripts/process-images.mjs` для trim/компрессии;
4. проверьте размеры силуэтов на 64 px и мобильном экране.

## Правила замены

- Не менять имена игровых ключей без обновления `PreloadScene`.
- Сохранять прозрачный фон для объектов и иконок.
- Не добавлять текст в изображения: все подписи локализуются в коде.
- Не копировать чужие ассеты, персонажей, логотипы и UI.
- Держать читаемый силуэт при 64×64 для иконок и 100–200 px для объектов.
- Для фонов использовать WebP; для прозрачных объектов — PNG или SVG.
