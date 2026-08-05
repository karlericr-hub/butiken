import { QueueStation } from './QueueStation';
import { applySprite } from '../utils/sprites';

/** Paketdisken där paketkunder hämtar och lämnar paket. */
export class ParcelDesk extends QueueStation {
  constructor(scene: Phaser.Scene, gridX: number, gridY: number, maxLength: number) {
    super(scene, gridX, gridY, maxLength);
    this.buildVisuals(0xd8e4ec, 'Paket', 'parcel');
    // Några extra paket på disken
    const extra = scene.add.sprite(-13, -40, 'parcel');
    applySprite(extra, 'parcel', 0.85);
    this.add(extra);
    const extra2 = scene.add.sprite(9, -52, 'parcel');
    applySprite(extra2, 'parcel', 0.7);
    this.add(extra2);
  }
}
