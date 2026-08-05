import Phaser from 'phaser';
import { isoToScreen } from '../utils/iso';
import { INV_SCALE } from '../utils/scale';
import { applySprite } from '../utils/sprites';

/** En leveranspall med beställda varor som ska lastas in i lagret. */
export class Delivery extends Phaser.GameObjects.Container {
  readonly contents: Record<string, number>;
  readonly gridX: number;
  readonly gridY: number;

  constructor(
    scene: Phaser.Scene,
    gridX: number,
    gridY: number,
    contents: Record<string, number>,
  ) {
    const pos = isoToScreen(gridX, gridY);
    super(scene, pos.x, pos.y);
    this.gridX = gridX;
    this.gridY = gridY;
    this.contents = { ...contents };

    const pallet = scene.add.sprite(0, 14, 'pallet').setOrigin(0.5, 1).setScale(INV_SCALE);
    this.add(pallet);
    const box1 = scene.add.sprite(-7, 8, 'boxOpen');
    applySprite(box1, 'boxOpen');
    this.add(box1);
    const box2 = scene.add.sprite(8, 2, 'parcel');
    applySprite(box2, 'parcel');
    this.add(box2);

    const label = scene.add
      .text(0, -50, '📦 Leverans!', {
        fontFamily: '"Baloo 2", sans-serif',
        fontSize: '13px',
        color: '#fff3e0',
        fontStyle: 'bold',
        stroke: '#4e342e',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1);
    this.add(label);

    scene.tweens.add({
      targets: label,
      y: -58,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.setDepth(pos.y);
    this.setInteractive(
      new Phaser.Geom.Rectangle(-28, -40, 56, 52),
      Phaser.Geom.Rectangle.Contains,
    );
    if (this.input) this.input.cursor = 'pointer';
    scene.add.existing(this);
  }

  get standPoint(): { x: number; y: number } {
    return isoToScreen(this.gridX, this.gridY + 1);
  }
}
