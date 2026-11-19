import Phaser from 'phaser';
import type { FarmObjectConfig } from '../types/ConfigTypes';
import type { ResourceId } from '../types/GameState';
import type { GameContext } from '../systems/GameContext';
import {
  COLORS,
  FONT_FAMILY,
  TEXT,
  formatCost,
  formatDuration,
  iconForResource,
} from '../ui/theme';

export class FarmObjectView {
  readonly config: FarmObjectConfig;
  readonly container: Phaser.GameObjects.Container;

  private readonly scene: Phaser.Scene;
  private readonly ctx: GameContext;
  private readonly baseImage: Phaser.GameObjects.Image;
  private readonly cropImage: Phaser.GameObjects.Image | null;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly levelText: Phaser.GameObjects.Text;
  private readonly progress: Phaser.GameObjects.Graphics;
  private readonly bubble: Phaser.GameObjects.Container;
  private readonly bubbleIcon: Phaser.GameObjects.Image;
  private readonly lockImage: Phaser.GameObjects.Image;
  private readonly baseScale: number;
  private readonly barY: number;
  private readonly bubbleY: number;
  private readonly displayWidth: number;
  private readonly displayHeight: number;
  private readonly onClick: (config: FarmObjectConfig) => void;

  private bubbleVisible = false;
  private bubbleTween: Phaser.Tweens.Tween | null = null;
  private wasLocked = false;

  constructor(
    scene: Phaser.Scene,
    ctx: GameContext,
    config: FarmObjectConfig,
    onClick: (config: FarmObjectConfig) => void,
  ) {
    this.scene = scene;
    this.ctx = ctx;
    this.config = config;
    this.onClick = onClick;

    this.container = scene.add.container(config.position.x, config.position.y);
    this.baseScale = 0.8;

    const baseTexture = config.kind === 'crop' ? 'plot' : config.icon;
    this.baseImage = scene.add.image(0, 0, baseTexture).setScale(this.baseScale);
    this.displayWidth = this.baseImage.displayWidth;
    this.displayHeight = this.baseImage.displayHeight;

    this.cropImage =
      config.kind === 'crop'
        ? scene.add.image(0, -34, config.icon).setScale(0.7)
        : null;

    this.barY = this.displayHeight / 2 + 5;
    const nameY = this.barY + 12;
    this.bubbleY =
      config.kind === 'crop'
        ? -34 - (this.cropImage?.displayHeight ?? 80) / 2 - 22
        : -this.displayHeight / 2 - 20;

    this.nameText = scene.add
      .text(0, nameY, ctx.localization.t(config.nameKey), {
        fontFamily: FONT_FAMILY,
        fontSize: '14px',
        fontStyle: 'bold',
        color: TEXT.ink,
        align: 'center',
        backgroundColor: 'rgba(255,248,236,0.82)',
        padding: { x: 6, y: 2 },
        fixedWidth: config.kind === 'building' ? 170 : 140,
      })
      .setOrigin(0.5, 0);

    this.statusText = scene.add
      .text(0, nameY + 26, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '13px',
        fontStyle: 'bold',
        color: TEXT.inkSoft,
        align: 'center',
        stroke: '#fff8ec',
        strokeThickness: 4,
        fixedWidth: 150,
      })
      .setOrigin(0.5, 0);

    this.levelText = scene.add
      .text(-this.displayWidth / 2 + 4, -this.displayHeight / 2 + 2, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        fontStyle: 'bold',
        color: TEXT.white,
        backgroundColor: '#2f5d50',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0, 0);

    this.progress = scene.add.graphics();

    this.bubble = scene.add.container(0, this.bubbleY);
    const bubbleBg = scene.add.graphics();
    bubbleBg.fillStyle(0x183448, 0.15);
    bubbleBg.fillCircle(0, 4, 28);
    bubbleBg.fillStyle(COLORS.white, 1);
    bubbleBg.fillCircle(0, 0, 26);
    bubbleBg.lineStyle(4, COLORS.accent, 1);
    bubbleBg.strokeCircle(0, 0, 26);
    this.bubbleIcon = scene.add
      .image(0, 0, iconForResource(this.bubbleResource()))
      .setDisplaySize(34, 34);
    this.bubble.add([bubbleBg, this.bubbleIcon]);
    this.bubble.setVisible(false);

    this.lockImage = scene.add
      .image(0, -8, 'icon_lock')
      .setDisplaySize(50, 50)
      .setVisible(false);

    this.container.add([
      this.baseImage,
      this.progress,
      ...(this.cropImage ? [this.cropImage] : []),
      this.nameText,
      this.statusText,
      this.levelText,
      this.bubble,
      this.lockImage,
    ]);

    const hitWidth = Math.max(150, this.displayWidth + 10);
    const hitHeight = this.displayHeight + 70;
    this.container.setSize(hitWidth, hitHeight);
    this.container.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, hitWidth, hitHeight),
      Phaser.Geom.Rectangle.Contains,
    );
    this.container.input!.cursor = 'pointer';
    this.container.setDepth(config.position.y);

    this.container.on('pointerover', () => {
      scene.tweens.add({ targets: this.container, scale: 1.03, duration: 100 });
    });
    this.container.on('pointerout', () => {
      scene.tweens.add({ targets: this.container, scale: 1, duration: 100 });
    });
    this.container.on('pointerup', () => this.onClick(config));

    this.refresh(ctx.time.now());
  }

  refresh(now: number): void {
    const { ctx, config } = this;
    const loc = ctx.localization;
    const state = ctx.state;
    const objectState = state.objects[config.id];
    const zoneUnlocked = state.zones[config.zoneId]?.unlocked === true;
    const locked = !zoneUnlocked || !objectState?.unlocked;

    const status = ctx.production.getStatus(config.id, now);

    if (locked) {
      this.baseImage.setAlpha(0.5);
      this.cropImage?.setAlpha(0.18);
      this.nameText.setText(loc.t(config.nameKey));
      this.nameText.setAlpha(0.9);
      this.levelText.setVisible(false);
      this.progress.clear();
      this.setBubbleVisible(false);
      this.lockImage.setVisible(true);
      this.statusText.setVisible(true);
      this.statusText.setColor(TEXT.inkSoft);
      if (!zoneUnlocked) {
        this.statusText.setText('');
      } else {
        this.statusText.setText(formatCost(config.unlockCost, loc));
        this.statusText.setColor(TEXT.accent);
      }
    } else {
      this.baseImage.setAlpha(1);
      this.cropImage?.setAlpha(1);
      this.lockImage.setVisible(false);
      this.nameText.setText(loc.t(config.nameKey));
      this.nameText.setAlpha(1);
      this.levelText.setVisible(true);
      this.levelText.setText(
        loc.t('ui.level_short', { n: objectState.level }),
      );
      this.statusText.setVisible(true);
      this.renderUnlockedStatus(status);
    }

    if (this.wasLocked && !locked) {
      this.container.setScale(0.82);
      this.scene.tweens.add({
        targets: this.container,
        scale: 1,
        duration: 420,
        ease: 'Back.easeOut',
      });
    }
    this.wasLocked = locked;
  }

  getFloatAnchor(): { x: number; y: number } {
    return {
      x: this.container.x,
      y: this.container.y - this.displayHeight / 2,
    };
  }

  getHighlightSize(): { width: number; height: number } {
    return {
      width: Math.max(170, this.displayWidth + 40),
      height: Math.max(100, this.displayHeight + 30),
    };
  }

  destroy(): void {
    this.bubbleTween?.stop();
    this.container.destroy(true);
  }

  private renderUnlockedStatus(
    status: ReturnType<GameContext['production']['getStatus']>,
  ): void {
    const { ctx, config } = this;
    const loc = ctx.localization;
    this.progress.clear();
    this.setBubbleVisible(false);

    if (config.kind === 'crop') {
      const crop = this.cropImage;
      if (!crop) return;
      if (status.kind === 'empty') {
        crop.setAlpha(0.28).setScale(0.55);
        this.statusText.setText(loc.t('common.plant')).setColor(TEXT.accent);
      } else if (status.kind === 'growing') {
        crop.setAlpha(1).setScale(0.55 + status.progress * 0.35);
        this.statusText
          .setText(formatDuration(status.remainingSeconds, loc))
          .setColor(TEXT.inkSoft);
        this.drawProgress(status.progress);
      } else if (status.kind === 'ready') {
        const wasVisible = this.bubbleVisible;
        crop.setAlpha(1).setScale(0.9);
        this.statusText
          .setText(loc.t('object.ready_to_collect'))
          .setColor(TEXT.green);
        this.setBubbleVisible(true);
        if (!wasVisible) {
          this.scene.tweens.add({
            targets: crop,
            scale: 0.96,
            duration: 220,
            yoyo: true,
            repeat: 1,
          });
        }
      }
      return;
    }

    if (status.kind === 'ready') {
      this.statusText
        .setText(loc.t('object.ready_to_collect'))
        .setColor(TEXT.green);
      this.setBubbleVisible(true);
    } else if (status.kind === 'growing' || status.kind === 'producing') {
      this.statusText
        .setText(formatDuration(status.remainingSeconds, loc))
        .setColor(TEXT.inkSoft);
      this.drawProgress(status.progress);
    } else {
      this.statusText
        .setText(
          config.kind === 'building'
            ? loc.t('object.start_hint')
            : loc.t('object.start_hint'),
        )
        .setColor(TEXT.inkSoft);
    }

    if (config.kind === 'animal' && ctx.state.helpers.dog) {
      this.statusText.setColor(TEXT.green);
    }
  }

  private drawProgress(progress: number): void {
    const width = 96;
    const height = 8;
    this.progress.clear();
    this.progress.fillStyle(COLORS.inkDark, 0.16);
    this.progress.fillRoundedRect(-width / 2, this.barY, width, height, 4);
    this.progress.fillStyle(COLORS.green, 1);
    this.progress.fillRoundedRect(
      -width / 2,
      this.barY,
      Math.max(4, width * progress),
      height,
      4,
    );
  }

  private setBubbleVisible(visible: boolean): void {
    if (this.bubbleVisible === visible) return;
    this.bubbleVisible = visible;
    this.bubbleTween?.stop();
    this.bubbleTween = null;
    this.bubble.setVisible(visible);
    if (visible) {
      this.bubble.setY(this.bubbleY);
      this.bubbleTween = this.scene.tweens.add({
        targets: this.bubble,
        y: this.bubbleY - 7,
        duration: 650,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private bubbleResource(): ResourceId {
    if (this.config.kind === 'crop' || this.config.kind === 'animal') {
      return this.config.resourceId;
    }
    return this.config.recipes[0]?.output[0]?.id ?? 'coin';
  }
}
