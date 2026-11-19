import Phaser from 'phaser';
import { COLORS, FONT_FAMILY, TEXT } from './theme';

export interface ButtonOptions {
  width: number;
  height: number;
  label?: string;
  icon?: string;
  fontSize?: number;
  fill?: number;
  textColor?: string;
  stroke?: number;
  onClick: () => void;
  disabled?: boolean;
}

export class Button extends Phaser.GameObjects.Container {
  private readonly backgroundGfx: Phaser.GameObjects.Graphics;
  private readonly highlight: Phaser.GameObjects.Graphics;
  private readonly labelText: Phaser.GameObjects.Text;
  private readonly iconImage: Phaser.GameObjects.Image | null;
  private readonly buttonWidth: number;
  private readonly buttonHeight: number;
  private enabled = true;
  private highlightTween: Phaser.Tweens.Tween | null = null;
  private clickHandler: () => void;

  constructor(scene: Phaser.Scene, x: number, y: number, options: ButtonOptions) {
    super(scene, x, y);
    this.buttonWidth = options.width;
    this.buttonHeight = options.height;
    this.clickHandler = options.onClick;

    const fill = options.fill ?? COLORS.accent;
    const stroke = options.stroke ?? COLORS.accentDark;
    const textColor = options.textColor ?? TEXT.white;

    this.backgroundGfx = scene.add.graphics();
    this.drawBody(fill, stroke);

    this.highlight = scene.add.graphics();
    this.highlight.lineStyle(5, COLORS.coin, 1);
    this.highlight.strokeRoundedRect(
      -this.buttonWidth / 2 - 7,
      -this.buttonHeight / 2 - 7,
      this.buttonWidth + 14,
      this.buttonHeight + 14,
      (this.buttonHeight + 14) / 2,
    );
    this.highlight.setVisible(false);

    const iconSize = Math.min(34, this.buttonHeight - 18);
    this.iconImage = options.icon
      ? scene.add.image(
          options.label ? -this.buttonWidth / 2 + 26 : 0,
          0,
          options.icon,
        )
      : null;
    this.iconImage?.setDisplaySize(iconSize, iconSize);

    const labelX = options.icon && options.label ? 14 : 0;
    this.labelText = scene.add
      .text(labelX, 0, options.label ?? '', {
        fontFamily: FONT_FAMILY,
        fontSize: `${options.fontSize ?? 20}px`,
        fontStyle: 'bold',
        color: textColor,
        align: 'center',
      })
      .setOrigin(0.5);

    const children: Phaser.GameObjects.GameObject[] = [
      this.backgroundGfx,
      this.highlight,
    ];
    if (this.iconImage) children.push(this.iconImage);
    children.push(this.labelText);
    this.add(children);
    this.setSize(this.buttonWidth, this.buttonHeight);
    this.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, this.buttonWidth, this.buttonHeight),
      Phaser.Geom.Rectangle.Contains,
    );
    this.input!.cursor = 'pointer';

    this.on('pointerover', () => {
      if (!this.enabled) return;
      scene.tweens.add({ targets: this, scale: 1.03, duration: 90 });
    });
    this.on('pointerout', () => {
      scene.tweens.add({ targets: this, scale: 1, duration: 90 });
    });
    this.on('pointerdown', () => {
      if (!this.enabled) return;
      scene.tweens.add({ targets: this, scale: 0.97, duration: 60 });
    });
    this.on('pointerup', () => {
      if (!this.enabled) return;
      scene.tweens.add({ targets: this, scale: 1, duration: 60 });
      this.clickHandler();
    });

    this.setEnabled(options.disabled !== true);
    scene.add.existing(this);
  }

  setLabel(label: string): void {
    this.labelText.setText(label);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.setAlpha(enabled ? 1 : 0.5);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setOnClick(handler: () => void): void {
    this.clickHandler = handler;
  }

  setHighlighted(highlighted: boolean): void {
    this.highlight.setVisible(highlighted);
    this.highlightTween?.stop();
    this.highlightTween = null;
    this.highlight.setAlpha(1);
    if (highlighted) {
      this.highlightTween = this.scene.tweens.add({
        targets: this.highlight,
        alpha: 0.25,
        duration: 650,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private drawBody(fill: number, stroke: number): void {
    const radius = this.buttonHeight / 2;
    this.backgroundGfx.clear();
    this.backgroundGfx.fillStyle(0x183448, 0.18);
    this.backgroundGfx.fillRoundedRect(
      -this.buttonWidth / 2,
      -this.buttonHeight / 2 + 5,
      this.buttonWidth,
      this.buttonHeight,
      radius,
    );
    this.backgroundGfx.fillStyle(fill, 1);
    this.backgroundGfx.fillRoundedRect(
      -this.buttonWidth / 2,
      -this.buttonHeight / 2,
      this.buttonWidth,
      this.buttonHeight,
      radius,
    );
    this.backgroundGfx.lineStyle(3, stroke, 0.9);
    this.backgroundGfx.strokeRoundedRect(
      -this.buttonWidth / 2,
      -this.buttonHeight / 2,
      this.buttonWidth,
      this.buttonHeight,
      radius,
    );
    this.backgroundGfx.fillStyle(0xffffff, 0.16);
    this.backgroundGfx.fillRoundedRect(
      -this.buttonWidth / 2 + 8,
      -this.buttonHeight / 2 + 6,
      this.buttonWidth - 16,
      this.buttonHeight * 0.3,
      radius * 0.6,
    );
  }
}
