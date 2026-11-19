import Phaser from 'phaser';
import { FONT_FAMILY } from './theme';

export function showFloatingText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  color = '#ffffff',
  fontSize = 22,
): void {
  const label = scene.add
    .text(x, y, text, {
      fontFamily: FONT_FAMILY,
      fontSize: `${fontSize}px`,
      fontStyle: 'bold',
      color,
      stroke: '#28495b',
      strokeThickness: 4,
      align: 'center',
    })
    .setOrigin(0.5)
    .setDepth(950);

  scene.tweens.add({
    targets: label,
    y: y - 64,
    alpha: 0,
    scale: 1.08,
    duration: 950,
    ease: 'Cubic.easeOut',
    onComplete: () => label.destroy(),
  });
}
