import Phaser from 'phaser';
import { Button } from './Button';
import {
  COLORS,
  FONT_FAMILY,
  GAME_HEIGHT,
  GAME_WIDTH,
  TEXT,
} from './theme';

export interface ModalOptions {
  closable?: boolean;
  closeOnOverlay?: boolean;
  onClose?: () => void;
}

export class ModalPanel {
  readonly body: Phaser.GameObjects.Container;
  readonly panelWidth: number;
  readonly panelHeight: number;

  private readonly overlay: Phaser.GameObjects.Rectangle;
  private readonly root: Phaser.GameObjects.Container;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly options: ModalOptions;
  private readonly closeButton: Button | null;
  private destroyed = false;

  constructor(
    scene: Phaser.Scene,
    width: number,
    height: number,
    title: string,
    options: ModalOptions = {},
  ) {
    this.panelWidth = width;
    this.panelHeight = height;
    this.options = options;

    this.overlay = scene.add
      .rectangle(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2,
        GAME_WIDTH,
        GAME_HEIGHT,
        COLORS.inkDark,
        0.58,
      )
      .setDepth(900)
      .setInteractive();

    this.root = scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setDepth(910);

    const shadow = scene.add.graphics();
    shadow.fillStyle(0x102838, 0.28);
    shadow.fillRoundedRect(
      -width / 2 + 6,
      -height / 2 + 14,
      width,
      height,
      30,
    );

    const background = scene.add.graphics();
    background.fillStyle(COLORS.panel, 1);
    background.fillRoundedRect(-width / 2, -height / 2, width, height, 30);
    background.lineStyle(5, COLORS.panelStroke, 0.9);
    background.strokeRoundedRect(-width / 2, -height / 2, width, height, 30);
    background.fillStyle(0xffffff, 0.35);
    background.fillRoundedRect(
      -width / 2 + 18,
      -height / 2 + 16,
      width - 36,
      54,
      20,
    );

    this.titleText = scene.add
      .text(-width / 2 + 32, -height / 2 + 28, title, {
        fontFamily: FONT_FAMILY,
        fontSize: '30px',
        fontStyle: 'bold',
        color: TEXT.ink,
      })
      .setOrigin(0, 0);

    this.closeButton =
      options.closable === false
        ? null
        : new Button(scene, width / 2 - 38, -height / 2 + 38, {
            width: 54,
            height: 54,
            label: '×',
            fontSize: 30,
            fill: COLORS.inkSoft,
            stroke: COLORS.ink,
            onClick: () => this.close(),
          });

    this.body = scene.add.container(0, 0);
    this.root.add([shadow, background, this.titleText, this.body]);
    if (this.closeButton) this.root.add(this.closeButton);

    if (options.closable !== false && options.closeOnOverlay !== false) {
      this.overlay.on('pointerdown', () => this.close());
    }
  }

  setTitle(title: string): void {
    this.titleText.setText(title);
  }

  clearBody(): void {
    this.body.removeAll(true);
  }

  close(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.options.onClose?.();
    this.overlay.destroy();
    this.root.destroy(true);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.overlay.destroy();
    this.root.destroy(true);
  }
}
