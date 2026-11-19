# Промпты Nano Banana для ассетов

Документ описывает, как заменить текущие SVG на финальный арт. Промпты не копируют чужие игры, персонажей, интерфейсы или ассеты: используется только общий жанровый язык cozy cartoon.

## Общий стиль

- Cozy cartoon 2.5D, мягкие округлые формы, дружелюбные персонажи.
- Насыщенные, но не кислотные цвета: зелёный, небесно-голубой, кремовый, золотой, розовый.
- Чистые силуэты, крупные детали, читаемость на мобильном экране.
- Мягкий свет, без фотореализма, без тёмной gritty-эстетики.
- Прозрачный фон для объектов; для острова — прозрачный фон, небо рисуется кодом.
- Без текста, логотипов, водяных знаков, рамок и лишних объектов.

Общий negative prompt:

```text
photorealistic, blurry, noisy, text, watermark, logo, ui frame, cropped object,
extra limbs, complex background, low contrast, unreadable silhouette,
dark gritty style, hard black outlines, neon acid colors, copyrighted character,
known game character, brand mascot, realistic fur, 3d render artifacts
```

Шаблон:

```text
Asset: <path>
Prompt: Create a single 2D game asset for a cozy HTML5 idle farm game.
Subject: <subject>.
Style: cozy cartoon 2.5D, soft rounded shapes, clean readable silhouette.
Camera: <front 3/4 / top-down isometric> view.
Background: transparent.
Lighting: soft warm daylight.
Palette: fresh green, sky blue, cream, golden yellow, soft pink.
Composition: centered, generous padding, no text, no frame, no shadow cut off.
Output: PNG with transparent background, <size>, high contrast at small scale.
Negative prompt: <shared negative>.
Post-process: trim transparent margins, compress, verify at 64 px if icon.
```

## Ключевые ассеты

### `public/assets/images/island.svg`

```text
Asset: public/assets/images/island.svg
Prompt: A cozy floating farm island seen from a high three-quarter top-down view.
Subject: one large round island with a bright green grassy top, layered warm brown earth,
small hanging roots, tiny flowers, soft bushes at the edges, a winding cream path connecting
four farm areas, and soft white clouds underneath. No buildings, animals or plots on top:
the island is a base layer. Cozy cartoon 2.5D, soft rounded silhouette, warm daylight.
Background: transparent.
Composition: centered, wide 2:1 canvas, main grass area occupies the upper two thirds;
leave the center and lower areas visually calm for game objects.
Size: 2600×1320.
Post-process: trim, downscale to 1300×660, optimize.
```

### `public/assets/images/plot.svg`

```text
Asset: public/assets/images/plot.svg
Prompt: A cute empty farm plot for a casual game: a rounded rectangle of dark rich soil
surrounded by a soft green grass rim with tiny stones and flowers. Cozy cartoon 2.5D,
three-quarter top-down view, soft warm light, transparent background, centered, generous padding.
Size: 400×260. No text.
```

### Культуры

Общая композиция: одно растение/плод по центру, прозрачный фон, мягкая тень только внутри силуэта, без земли и горшков.

- `crop_wheat.svg`: `A small golden wheat sheaf with three green stems and plump rounded grains, cozy cartoon style, centered, transparent background, 200×260, readable at 64 px.`
- `crop_carrot.svg`: `One bright orange carrot with a fluffy green leafy top, rounded cartoon shape, soft highlight, transparent background, 220×260.`
- `crop_strawberry.svg`: `A cluster of three juicy red strawberries with green leaves and tiny cream seeds, cozy cartoon, transparent background, 220×260.`
- `crop_cloudberry.svg`: `A magical cloudberry bush with glowing cyan-orange berries, soft white highlights and tiny sparkles, cozy fantasy farm style, transparent background, 220×260.`

### Животные

- `animal_chicken.svg`: `A friendly white chicken with a small red comb, orange beak and feet, big dark eyes, cozy cartoon 3/4 view, transparent background, 260×260.`
- `animal_cow.svg`: `A friendly white cow with soft brown spots, pink muzzle, small horns, big eyes, cozy cartoon 3/4 view, transparent background, 360×300.`
- `animal_sheep.svg`: `A fluffy white sheep with a cream face, floppy ears, rounded wool circles, cozy cartoon 3/4 view, transparent background, 340×300.`

### Здания

- `building_mill.svg`: `A cozy windmill on a farm: cream stone-and-wood tower, coral red conical roof, four wooden sails, small blue windows, warm cartoon lighting, three-quarter view, transparent background, 520×600.`
- `building_bakery.svg`: `A tiny cozy bakery house with a warm orange roof, cream walls, blue windows, chimney with soft smoke, a pie sign, cartoon 3/4 view, transparent background, 480×440.`
- `building_dairy.svg`: `A small pastel dairy stand with a striped blue-and-white awning, a big shiny milk can, soft clouds, cartoon 3/4 view, transparent background, 460×440.`

### Помощники

- `helper_cat.svg`: `A cute cloud cat helper: white fluffy cat with a light blue cloud-like tail, tiny pink ears, big friendly eyes, floating slightly, cozy cartoon, transparent background, 240×220.`
- `helper_dog.svg`: `A friendly shepherd dog helper: warm brown fur, cream chest, floppy dark ears, happy face, cozy cartoon, transparent background, 260×220.`

### Декор

- `cloud.svg`: `A soft fluffy white cloud with rounded cartoon puffs and a pale blue underside, transparent background, 440×200.`
- `rainbow_bridge.svg`: `A small rainbow bridge leading to a distant island, seven pastel arcs, two fluffy white clouds at the ends, tiny sparkles, cozy fantasy farm style, transparent background, 680×380.`

### Иконки

Формат: 64×64 или 128×128, простой силуэт, без текста, читаемость при 32 px.

- `icon_coin.svg`: `A round golden coin with a soft cream star emboss, warm highlight, cartoon game icon, transparent background.`
- `icon_crystal.svg`: `A bright cyan crystal gem with white facets and a tiny sparkle, cartoon game icon, transparent background.`
- `icon_orders.svg`: `A cream paper order scroll with a green checkmark badge, cartoon game icon, transparent background.`
- `icon_shop.svg`: `A small cozy market stall icon with an orange striped awning, cartoon game icon, transparent background.`
- `icon_basket.svg`: `A woven farm basket with green leaves peeking out, cartoon game icon, transparent background.`
- `icon_gear.svg`: `A soft blue-grey gear with a cream center, rounded cartoon game icon, transparent background.`
- `icon_lock.svg`: `A friendly golden padlock with a rounded shape, cartoon game icon, transparent background.`
- `icon_star.svg`: `A cheerful golden star with a cream inner highlight, cartoon game icon, transparent background.`
- `icon_music.svg`: `A green music note with rounded cartoon shapes, transparent background.`
- `icon_sound.svg`: `A soft blue speaker with two sound waves, rounded cartoon icon, transparent background.`

### Ресурсы

- `resource_egg.svg`: `A smooth cream egg with a soft white highlight, cartoon game icon, transparent background, 128×128.`
- `resource_milk.svg`: `A small milk bottle with a blue cap and blue label, cartoon game icon, transparent background.`
- `resource_wool.svg`: `A fluffy white ball of wool with soft curls, cartoon game icon, transparent background.`
- `resource_flour.svg`: `A cream flour sack tied with a simple string, cartoon game icon, transparent background.`
- `resource_pie.svg`: `A golden pie with a lattice crust and tiny red berry dots, cartoon game icon, transparent background.`
- `resource_cream.svg`: `A small glass jar of whipped cream with a white swirl, cartoon game icon, transparent background.`

## Аудио-замены

Если заменять синтез на файлы, используйте имена:

```text
raw_assets/audio/music_farm_loop.wav
raw_assets/audio/sfx_collect.wav
raw_assets/audio/sfx_success.wav
raw_assets/audio/sfx_upgrade.wav
raw_assets/audio/sfx_purchase.wav
raw_assets/audio/sfx_error.wav
raw_assets/audio/sfx_click.wav
```

Параметры: музыка 60–90 секунд, loop, −18 LUFS, мягкий fade in/out; SFX 0.1–0.7 секунды, −14 LUFS, один смысловой звук на файл. После обработки `scripts/process-audio.sh` кладёт OGG в `public/assets/audio`.

## Проверка результата

- Прозрачный фон и отсутствие обрезанных краёв.
- Объект читается в 64 px.
- Цвета совпадают с общей палитрой.
- Нет текста, логотипов, чужих персонажей и следов генерации.
- На мобильном экране объект не сливается с травой/небом.
- Пользователь принимает арт до замены в игре.
- После замены: trim, сжатие, проверка размера билда и визуальный smoke-test.
