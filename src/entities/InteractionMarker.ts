import Phaser from 'phaser';
import { isoToScreen, TILE_W, TILE_H } from '../utils/iso';

/**
 * En markerad golvruta framför en station. Spelaren klickar på rutan – inte på
 * själva hyllan eller kassan – för att föreståndaren ska gå dit och sköta den.
 */
export class InteractionMarker extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, gridX: number, gridY: number, tint = 0xffd54f) {
    const pos = isoToScreen(gridX, gridY);
    super(scene, pos.x, pos.y);

    const hw = TILE_W / 2 - 4;
    const hh = TILE_H / 2 - 3;

    const g = scene.add.graphics();
    g.fillStyle(tint, 0.22);
    g.lineStyle(2.5, tint, 0.95);
    g.beginPath();
    g.moveTo(0, -hh);
    g.lineTo(hw, 0);
    g.lineTo(0, hh);
    g.lineTo(-hw, 0);
    g.closePath();
    g.fillPath();
    g.strokePath();
    this.add(g);

    // Golvdekal – ligger under figurerna men ovanför golvplattorna.
    this.setDepth(-900);
    // Extra generös träffyta – klick i eller nära rutan räknas, så man
    // slipper pricka exakt mitt i. Figuren går sedan till rätt ställe.
    const hitW = TILE_W + 48;
    const hitH = TILE_H + 44;
    this.setSize(hitW, hitH);
    this.setInteractive(
      new Phaser.Geom.Rectangle(-hitW / 2, -hitH / 2, hitW, hitH),
      Phaser.Geom.Rectangle.Contains,
    );
    if (this.input) this.input.cursor = 'pointer';

    // Sakta pulsering så att rutan syns som klickbar.
    scene.tweens.add({
      targets: g,
      alpha: 0.5,
      duration: 750,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    scene.add.existing(this);
  }
}
