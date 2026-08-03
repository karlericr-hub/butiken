import { Actor } from './Actor';
import { BALANCE } from '../config/balance';

/** En anställd som syns i butiken och sköter sin station automatiskt. */
export class StaffEntity extends Actor {
  /** Sant medan den anställda utför en handling. */
  working = false;

  constructor(scene: Phaser.Scene, x: number, y: number, role: 'kassor' | 'pafyllare') {
    super(scene, x, y, 'person', BALANCE.customerSpeed);
    this.setTint(role === 'kassor' ? 0x5c6bc0 : 0xffb74d);
  }
}
