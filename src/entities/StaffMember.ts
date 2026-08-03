import { Actor } from './Actor';
import { BALANCE } from '../config/balance';

/** En anställd som syns i butiken och sköter sin station automatiskt. */
export class StaffEntity extends Actor {
  /** Sant medan den anställda utför en handling. */
  working = false;

  constructor(scene: Phaser.Scene, x: number, y: number, role: 'kassor' | 'pafyllare') {
    super(scene, x, y, role === 'kassor' ? 'cashier' : 'stocker', BALANCE.customerSpeed);
  }
}
