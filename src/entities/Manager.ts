import { Actor } from './Actor';
import { BALANCE } from '../config/balance';

export type StationId = 'checkout' | null;

/** Butiksföreståndaren – spelarens avatar. Kan bara göra en sak i taget. */
export class Manager extends Actor {
  /** Stationen avataren just nu står vid och betjänar. */
  station: StationId = null;
  /** Sant medan en handling pågår (betalning, påfyllning). */
  busy = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'person', BALANCE.managerSpeed);
    this.setTint(0x4caf50);
  }

  /** Gå till en punkt. Avbryter pågående stationering (men inte pågående handling). */
  walkTo(x: number, y: number, onArrive?: () => void): void {
    if (this.busy) return;
    this.station = null;
    this.moveTo(x, y, onArrive);
  }
}
