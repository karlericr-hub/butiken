import { QueueStation } from './QueueStation';

/** Paketdisken där paketkunder hämtar och lämnar paket. */
export class ParcelDesk extends QueueStation {
  constructor(scene: Phaser.Scene, gridX: number, gridY: number, maxLength: number) {
    super(scene, gridX, gridY, maxLength);
    this.buildVisuals(0x78909c, 'Paket', 'parcel');
  }
}
