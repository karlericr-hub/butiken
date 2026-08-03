import { QueueStation } from './QueueStation';

/** Paketdisken där paketkunder hämtar och lämnar paket. */
export class ParcelDesk extends QueueStation {
  constructor(scene: Phaser.Scene, gridX: number, gridY: number, maxLength: number) {
    super(scene, gridX, gridY, maxLength);
    this.buildVisuals(0x78909c, 'Paket', 'parcel');
    // Några extra paket på disken
    const extra = scene.add.sprite(-13, -26, 'parcel').setOrigin(0.5, 1).setScale(0.85);
    this.add(extra);
    const extra2 = scene.add.sprite(9, -42, 'parcel').setOrigin(0.5, 1).setScale(0.7);
    this.add(extra2);
  }
}
