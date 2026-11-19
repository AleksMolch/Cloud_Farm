import Phaser from 'phaser';
import type { FarmObjectConfig, HelperConfig, ZoneConfig } from '../types/ConfigTypes';
import type { ResourceAmount } from '../types/GameState';
import type { GameEventMap } from '../systems/EventBus';
import type { GameContext } from '../systems/GameContext';
import { FarmObjectView } from '../views/FarmObjectView';
import { showFloatingText } from '../ui/FloatingText';
import {
  COLORS,
  FONT_FAMILY,
  GAME_HEIGHT,
  GAME_WIDTH,
  TEXT,
} from '../ui/theme';

interface HelperView {
  container: Phaser.GameObjects.Container;
  image: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  lock: Phaser.GameObjects.Image;
  helper: HelperConfig;
}

interface ZoneView {
  container: Phaser.GameObjects.Container;
  label: Phaser.GameObjects.Text;
  lock: Phaser.GameObjects.Image;
  zone: ZoneConfig;
  background: Phaser.GameObjects.Graphics;
}

export class FarmScene extends Phaser.Scene {
  private ctx!: GameContext;
  private readonly views = new Map<string, FarmObjectView>();
  private readonly helperViews = new Map<string, HelperView>();
  private readonly zoneViews = new Map<string, ZoneView>();
  private readonly unsubscribers: Array<() => void> = [];
  private refreshAccumulator = 0;
  private tutorialRing!: Phaser.GameObjects.Graphics;
  private soonText!: Phaser.GameObjects.Text;
  private highlightedStep: string | null = null;

  constructor() {
    super('FarmScene');
  }

  create(): void {
    this.ctx = this.registry.get('ctx') as GameContext;
    this.createSky();
    this.createClouds();
    this.add
      .image(GAME_WIDTH / 2, 438, 'island')
      .setOrigin(0.5)
      .setScale(0.97)
      .setDepth(1);
    this.createRainbowTeaser();
    this.createZoneLabels();
    this.createObjects();
    this.createHelpers();

    this.tutorialRing = this.add
      .graphics()
      .setDepth(700)
      .setVisible(false);
    this.tweens.add({
      targets: this.tutorialRing,
      alpha: { from: 0.45, to: 1 },
      duration: 720,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.input.on('pointerdown', () => this.ctx.audio.unlock());
    this.bindEvents();

    this.scene.launch('UIScene');
    this.updateTutorialHighlight();

    this.cameras.main.fadeIn(450, 255, 255, 255);

    this.time.delayedCall(150, async () => {
      try {
        await this.ctx.platform.ready();
        await this.ctx.platform.gameplayStart();
      } catch (error) {
        console.warn('[FarmScene] platform lifecycle failed', error);
      }
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const unsubscribe of this.unsubscribers) unsubscribe();
      this.unsubscribers.length = 0;
    });
  }

  update(_time: number, delta: number): void {
    this.refreshAccumulator += delta;
    if (this.refreshAccumulator < 300) return;
    this.refreshAccumulator = 0;

    const now = this.ctx.time.now();
    this.ctx.tick(now);
    for (const view of this.views.values()) {
      view.refresh(now);
    }
    this.refreshHelperViews();
  }

  private createSky(): void {
    const texture = this.textures.createCanvas(
      'sky-gradient',
      GAME_WIDTH,
      GAME_HEIGHT,
    );
    if (!texture) {
      this.cameras.main.setBackgroundColor('#8ed8f8');
      return;
    }
    const context = texture.getContext();
    const gradient = context.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    gradient.addColorStop(0, '#6ac7f2');
    gradient.addColorStop(0.55, '#bcecff');
    gradient.addColorStop(1, '#f2fbff');
    context.fillStyle = gradient;
    context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const sun = context.createRadialGradient(1040, 120, 10, 1040, 120, 260);
    sun.addColorStop(0, 'rgba(255, 249, 196, 0.95)');
    sun.addColorStop(0.35, 'rgba(255, 244, 173, 0.35)');
    sun.addColorStop(1, 'rgba(255, 244, 173, 0)');
    context.fillStyle = sun;
    context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    texture.refresh();
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'sky-gradient').setDepth(0);
  }

  private createClouds(): void {
    const configurations = [
      { x: 140, y: 150, scale: 0.9, alpha: 0.85, drift: 40, duration: 9000 },
      { x: 450, y: 92, scale: 0.6, alpha: 0.7, drift: -30, duration: 12000 },
      { x: 880, y: 120, scale: 0.8, alpha: 0.75, drift: 35, duration: 10000 },
      { x: 1180, y: 205, scale: 0.55, alpha: 0.65, drift: -25, duration: 14000 },
      { x: 250, y: 260, scale: 0.45, alpha: 0.55, drift: 24, duration: 11000 },
      { x: 760, y: 235, scale: 0.4, alpha: 0.5, drift: -20, duration: 13000 },
    ];

    for (const config of configurations) {
      const cloud = this.add
        .image(config.x, config.y, 'cloud')
        .setScale(config.scale)
        .setAlpha(config.alpha)
        .setDepth(0);
      this.tweens.add({
        targets: cloud,
        x: config.x + config.drift,
        duration: config.duration,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private createObjects(): void {
    for (const config of this.ctx.data.objectList) {
      const view = new FarmObjectView(this, this.ctx, config, (clicked) =>
        this.handleObjectClick(clicked),
      );
      this.views.set(config.id, view);
    }
  }

  private createHelpers(): void {
    for (const helper of this.ctx.data.helpers) {
      const container = this.add
        .container(helper.position.x, helper.position.y)
        .setDepth(helper.position.y + 2);
      const image = this.add.image(0, 0, helper.icon).setScale(0.75);
      const label = this.add
        .text(0, 52, this.ctx.localization.t(helper.nameKey), {
          fontFamily: FONT_FAMILY,
          fontSize: '13px',
          fontStyle: 'bold',
          color: TEXT.ink,
          backgroundColor: 'rgba(255,248,236,0.85)',
          padding: { x: 6, y: 2 },
        })
        .setOrigin(0.5);
      const lock = this.add
        .image(28, -30, 'icon_lock')
        .setDisplaySize(28, 28);
      container.add([image, label, lock]);
      container.setSize(120, 120);
      container.setInteractive(
        new Phaser.Geom.Rectangle(0, 0, 120, 120),
        Phaser.Geom.Rectangle.Contains,
      );
      container.input!.cursor = 'pointer';
      container.on('pointerup', () => {
        if (!this.ctx.state.helpers[helper.id]) {
          this.ctx.bus.emit('ui:open-panel', { panel: 'shop' });
        }
      });
      this.helperViews.set(helper.id, {
        container,
        image,
        label,
        lock,
        helper,
      });
    }
    this.refreshHelperViews();
  }

  private createZoneLabels(): void {
    for (const zone of this.ctx.data.zones) {
      if (!zone.labelPosition) continue;
      const container = this.add
        .container(zone.labelPosition.x, zone.labelPosition.y)
        .setDepth(640);
      const background = this.add.graphics();
      background.fillStyle(COLORS.inkDark, 0.2);
      background.fillRoundedRect(-67, -14, 134, 30, 14);
      background.fillStyle(0xb97845, 0.95);
      background.fillRoundedRect(-67, -16, 134, 30, 14);
      background.lineStyle(2, 0x8c5730, 1);
      background.strokeRoundedRect(-67, -16, 134, 30, 14);
      const label = this.add
        .text(-6, 0, this.ctx.localization.t(zone.nameKey), {
          fontFamily: FONT_FAMILY,
          fontSize: '11px',
          fontStyle: 'bold',
          color: '#fff4d8',
          fixedWidth: 112,
          align: 'center',
        })
        .setOrigin(0.5);
      const lock = this.add
        .image(52, -1, 'icon_lock')
        .setDisplaySize(19, 19);
      container.add([background, label, lock]);
      container.setSize(134, 30);
      container.setInteractive(
        new Phaser.Geom.Rectangle(0, 0, 134, 30),
        Phaser.Geom.Rectangle.Contains,
      );
      container.input!.cursor = 'pointer';
      container.on('pointerup', () => {
        if (!this.ctx.state.zones[zone.id]?.unlocked) {
          this.ctx.bus.emit('ui:open-panel', { panel: 'shop' });
        }
      });
      this.zoneViews.set(zone.id, { container, label, lock, zone, background });
    }
    this.refreshZoneLabels();
  }

  private createRainbowTeaser(): void {
    const bridge = this.add
      .image(95, 265, 'rainbow_bridge')
      .setScale(0.45)
      .setAlpha(0.85)
      .setDepth(3);
    this.tweens.add({
      targets: bridge,
      x: 85,
      duration: 4500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.soonText = this.add
      .text(100, 325, this.ctx.localization.t('ui.soon'), {
        fontFamily: FONT_FAMILY,
        fontSize: '14px',
        fontStyle: 'bold',
        color: TEXT.inkSoft,
        backgroundColor: 'rgba(255,248,236,0.7)',
        padding: { x: 8, y: 3 },
      })
      .setOrigin(0.5)
      .setDepth(640);
  }

  private handleObjectClick(config: FarmObjectConfig): void {
    const ctx = this.ctx;
    const now = ctx.time.now();
    const objectState = ctx.state.objects[config.id];
    const zoneUnlocked = ctx.state.zones[config.zoneId]?.unlocked === true;

    if (!zoneUnlocked || !objectState?.unlocked) {
      ctx.audio.sfx('error');
      ctx.bus.emit('toast', {
        key: zoneUnlocked ? 'toast.locked_object' : 'toast.locked_zone',
      });
      ctx.bus.emit('ui:open-panel', { panel: 'shop' });
      return;
    }

    if (config.kind === 'building') {
      if (ctx.production.getStatus(config.id, now).kind === 'ready') {
        ctx.production.collect(config.id, now);
      } else {
        ctx.bus.emit('ui:open-panel', {
          panel: 'object',
          objectId: config.id,
        });
      }
      return;
    }

    const result = ctx.production.interact(config.id, now);
    if (result.action === 'plant') {
      ctx.audio.sfx('click');
      return;
    }
    if (result.action === 'none') {
      ctx.bus.emit('ui:open-panel', {
        panel: 'object',
        objectId: config.id,
      });
    }
  }

  private bindEvents(): void {
    this.subscribe('object:changed', ({ objectId }) => {
      this.views.get(objectId)?.refresh(this.ctx.time.now());
    });
    this.subscribe('crop:collected', ({ objectId, output }) =>
      this.floatOutput(objectId, output),
    );
    this.subscribe('animal:collected', ({ objectId, output }) =>
      this.floatOutput(objectId, output),
    );
    this.subscribe('building:collected', ({ objectId, output }) =>
      this.floatOutput(objectId, output),
    );
    this.subscribe('object:unlocked', () => {
      const now = this.ctx.time.now();
      for (const view of this.views.values()) view.refresh(now);
    });
    this.subscribe('zone:unlocked', () => {
      this.refreshZoneLabels();
      const now = this.ctx.time.now();
      for (const view of this.views.values()) view.refresh(now);
    });
    this.subscribe('helper:unlocked', () => {
      this.refreshHelperViews();
      const added = this.add
        .text(GAME_WIDTH / 2, 330, '★', {
          fontFamily: FONT_FAMILY,
          fontSize: '72px',
          color: '#ffe066',
          stroke: '#e5a91f',
          strokeThickness: 6,
        })
        .setOrigin(0.5)
        .setDepth(900);
      this.tweens.add({
        targets: added,
        y: 260,
        alpha: 0,
        scale: 1.4,
        duration: 900,
        onComplete: () => added.destroy(),
      });
    });
    this.subscribe('settings:changed', () => {
      const now = this.ctx.time.now();
      for (const view of this.views.values()) view.refresh(now);
      this.refreshHelperViews();
      this.refreshZoneLabels();
      this.updateTutorialHighlight();
      this.soonText.setText(this.ctx.localization.t('ui.soon'));
    });
    this.subscribe('tutorial:changed', () => this.updateTutorialHighlight());
  }

  private subscribe<K extends keyof GameEventMap>(
    event: K,
    handler: (payload: GameEventMap[K]) => void,
  ): void {
    this.unsubscribers.push(this.ctx.bus.on(event, handler));
  }

  private floatOutput(objectId: string, output: ResourceAmount[]): void {
    const view = this.views.get(objectId);
    if (!view) return;
    const anchor = view.getFloatAnchor();
    output.forEach((amount, index) => {
      const color =
        amount.id === 'coin'
          ? '#ffd45e'
          : amount.id === 'crystal'
            ? '#8be9ff'
            : '#ffffff';
      showFloatingText(
        this,
        anchor.x + index * 18,
        anchor.y - index * 22,
        `+${amount.amount} ${this.ctx.localization.t(`resource.${amount.id}`)}`,
        color,
        20,
      );
    });
  }

  private refreshHelperViews(): void {
    for (const [id, view] of this.helperViews) {
      const hired = this.ctx.state.helpers[id] === true;
      view.image.setAlpha(hired ? 1 : 0.45);
      view.label.setAlpha(hired ? 1 : 0.7);
      view.label.setText(this.ctx.localization.t(view.helper.nameKey));
      view.lock.setVisible(!hired);
    }
  }

  private refreshZoneLabels(): void {
    for (const [id, view] of this.zoneViews) {
      const unlocked = this.ctx.state.zones[id]?.unlocked === true;
      view.label.setText(this.ctx.localization.t(view.zone.nameKey));
      view.lock.setVisible(!unlocked);
      view.container.setAlpha(unlocked ? 1 : 0.8);
    }
  }

  private updateTutorialHighlight(): void {
    const step = this.ctx.tutorial.getCurrentStep();
    if (step?.highlight?.kind === 'object') {
      const view = this.views.get(step.highlight.id);
      if (view) {
        const size = view.getHighlightSize();
        if (this.highlightedStep !== step.id) {
          this.highlightedStep = step.id;
          this.tutorialRing.clear();
          this.tutorialRing.lineStyle(6, COLORS.coin, 0.95);
          this.tutorialRing.strokeEllipse(0, 0, size.width, size.height);
        }
        this.tutorialRing
          .setPosition(view.container.x, view.container.y)
          .setVisible(true);
        return;
      }
    }
    this.highlightedStep = null;
    this.tutorialRing.setVisible(false);
  }
}
