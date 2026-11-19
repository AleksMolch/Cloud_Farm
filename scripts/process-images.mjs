import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const INPUT_DIR = 'raw_assets/images';
const OUTPUT_DIR = 'public/assets/final/images';
const RASTER_PATTERN = /\.(png|jpe?g|webp)$/i;
const MAX_DIMENSION = 2048;

async function pathExists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

function safeName(original) {
  const extension = path.extname(original);
  const rawBase = path.basename(original, extension);
  const base = rawBase
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return { base, changed: base !== rawBase };
}

async function main() {
  if (!(await pathExists(INPUT_DIR))) {
    console.log(
      `No source images in ${INPUT_DIR}. Put PNG/JPG/WebP files there and rerun.`,
    );
    return;
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  const entries = await readdir(INPUT_DIR, { withFileTypes: true });
  const files = entries.filter(
    (entry) => entry.isFile() && RASTER_PATTERN.test(entry.name),
  );

  if (files.length === 0) {
    console.log(`No raster images found in ${INPUT_DIR}.`);
    return;
  }

  const manifest = [];

  for (const file of files) {
    const { base, changed } = safeName(file.name);
    if (changed) {
      console.warn(`${file.name} renamed to snake_case key: ${base}`);
    }

    const source = path.join(INPUT_DIR, file.name);
    let pipeline = sharp(source, { failOn: 'error' }).rotate().trim({
      threshold: 1,
    });
    const metadata = await pipeline.metadata();

    if (
      metadata.width &&
      metadata.height &&
      Math.max(metadata.width, metadata.height) > MAX_DIMENSION
    ) {
      pipeline = pipeline.resize({
        width:
          metadata.width >= metadata.height ? MAX_DIMENSION : undefined,
        height:
          metadata.height > metadata.width ? MAX_DIMENSION : undefined,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    if (base.startsWith('bg_')) {
      const output = path.join(OUTPUT_DIR, `${base}.webp`);
      await pipeline.webp({ quality: 86, effort: 5 }).toFile(output);
      manifest.push({ key: base, file: output });
      console.log(`${file.name} -> ${output}`);
    } else {
      const output = path.join(OUTPUT_DIR, `${base}.png`);
      await pipeline.png({ compressionLevel: 9 }).toFile(output);
      manifest.push({ key: base, file: output });
      console.log(`${file.name} -> ${output}`);
    }
  }

  const manifestPath = path.join(OUTPUT_DIR, 'manifest.json');
  await writeFile(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
  console.log(`Processed ${files.length} image(s). Manifest: ${manifestPath}`);
  console.log(
    'Update src/game/scenes/PreloadScene.ts paths if you replace SVG with these files.',
  );
}

main().catch((error) => {
  console.error('Image pipeline failed:', error.message);
  process.exitCode = 1;
});
