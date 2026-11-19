import Phaser from 'phaser';
import type { GameContext } from '../systems/GameContext';
import {
  ASSET_PATH,
  COLORS,
  FONT_FAMILY,
  GAME_HEIGHT,
  GAME_WIDTH,
  TEXT,
} from '../ui/theme';

interface AssetSpec {
  key: string;
  width: number;
  height: number;
}

const ASSETS: AssetSpec[] = [
  { key: 'island', width: 1300, height: 660 },
  { key: 'plot', width: 200, height: 130 },
  { key: 'crop_wheat', width: 100, height: 130 },
  { key: 'crop_carrot', width: 110, height: 130 },
  { key: 'crop_strawberry', width: 110, height: 130 },
  { key: 'crop_cloudberry', width: 110, height: 130 },
  { key: 'animal_chicken', width: 130, height: 130 },
  { key: 'animal_cow', width: 180, height: 150 },
  { key: 'animal_sheep', width: 170, height: 150 },
  { key: 'building_mill', width: 260, height: 300 },
  { key: 'building_bakery', width: 240, height: 220 },
  { key: 'building_dairy', width: 230, height: 220 },
  { key: 'helper_cat', width: 120, height: 110 },
  { key: 'helper_dog', width: 130, height: 110 },
  { key: 'cloud', width: 220, height: 100 },
  { key: 'rainbow_bridge', width: 340, height: 190 },
  { key: 'icon_coin', width: 64, height: 64 },
  { key: 'icon_crystal', width: 64, height: 64 },
  { key: 'icon_orders', width: 64, height: 64 },
  { key: 'icon_shop', width: 64, height: 64 },
  { key: 'icon_gear', width: 64, height: 64 },
  { key: 'icon_lock', width: 64, height: 64 },
  { key: 'icon_star', width: 64, height: 64 },
  { key: 'icon_basket', width: 64, height: 64 },
  { key: 'icon_music', width: 64, height: 64 },
  { key: 'icon_sound', width: 64, height: 64 },
  { key: 'resource_egg', width: 64, height: 64 },
  { key: 'resource_milk', width: 64, height: 64 },
  { key: 'resource_wool', width: 64, height: 64 },
  { key: 'resource_flour', width: 64, height: 64 },
  { key: 'resource_pie', width: 64, height: 64 },
  { key: 'resource_cream', width: 64, height: 64 },
];

export class PreloadScene extends Phaser.Scene {
  private progressBar!: Phaser.GameObjects.Graphics;
  private progressText!: Phaser.GameObjects.Text;

  constructor() {
    super('PreloadScene');
  }

  preload(): void {
    document.getElementById('splash')?.remove();
    const ctx = this.registry.get('ctx') as GameContext;
    const loc = ctx.localization;

    this.cameras.main.setBackgroundColor('#8ed8f8');
    const sky = this.add.graphics();
    sky.fillGradientStyle(0x73cdf4, 0x73cdf4, 0xdfeeff, 0xf9fdff, 1, 1, 1, 1);
    sky.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.add
      .circle(210, 160, 54, 0xffffff, 0.5)
      .setOrigin(0.5);
    this.add.circle(270, 150, 42, 0xffffff, 0.45);
    this.add.circle(1060, 210, 58, 0xffffff, 0.5);
    this.add.circle(990, 200, 40, 0xffffff, 0.4);

    this.add
      .text(GAME_WIDTH / 2, 250, loc.t('loading.title'), {
        fontFamily: FONT_FAMILY,
        fontSize: '64px',
        fontStyle: 'bold',
        color: TEXT.ink,
        stroke: '#ffffff',
        strokeThickness: 10,
        align: 'center',
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 340, loc.t('loading.hint'), {
        fontFamily: FONT_FAMILY,
        fontSize: '21px',
        color: TEXT.inkSoft,
        align: 'center',
      })
      .setOrigin(0.5);

    const barWidth = 420;
    const barHeight = 24;
    const barX = GAME_WIDTH / 2 - barWidth / 2;
    const barY = 430;
    const barBackground = this.add.graphics();
    barBackground.fillStyle(COLORS.white, 0.6);
    barBackground.fillRoundedRect(barX, barY, barWidth, barHeight, 12);
    barBackground.lineStyle(3, COLORS.panelStroke, 0.6);
    barBackground.strokeRoundedRect(barX, barY, barWidth, barHeight, 12);

    this.progressBar = this.add.graphics();
    this.progressText = this.add
      .text(GAME_WIDTH / 2, barY + 48, '0%', {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        fontStyle: 'bold',
        color: TEXT.inkSoft,
      })
      .setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      this.progressBar.clear();
      this.progressBar.fillStyle(COLORS.green, 1);
      this.progressBar.fillRoundedRect(
        barX,
        barY,
        Math.max(barHeight, barWidth * value),
        barHeight,
        12,
      );
      this.progressText.setText(`${Math.round(value * 100)}%`);
    });

    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.warn(`[PreloadScene] failed to load ${file.src}`);
    });

    for (const asset of ASSETS) {
      this.load.svg(asset.key, ASSET_PATH(asset.key), {
        width: asset.width,
        height: asset.height,
      });
    }
  }

  create(): void {
    this.scene.start('FarmScene');
  }
}
