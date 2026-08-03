import Phaser from 'phaser';
import { isoToScreen } from '../utils/iso';
import type { Customer } from './Customer';

/** Kassan med en FIFO-kö av kunder. */
export class Checkout extends Phaser.GameObjects.Container {
  readonly queue: Customer[] = [];
  readonly gridX: number;
  readonly gridY: number;

  constructor(scene: Phaser.Scene, gridX: number, gridY: number) {
    const pos = isoToScreen(gridX, gridY);
    super(scene, pos.x, pos.y);
    this.gridX = gridX;
    this.gridY = gridY;

    const cube = scene.add.sprite(0, 0, 'cube');
    cube.setOrigin(0.5, 40 / 56);
    cube.setTint(0x8d6e63);
    this.add(cube);

    const till = scene.add.sprite(0, -30, 'till');
    till.setOrigin(0.5, 1);
    this.add(till);

    const label = scene.add
      .text(0, -52, 'Kassa', {
        fontFamily: 'sans-serif',
        fontSize: '12px',
        color: '#4a3f35',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 1);
    this.add(label);

    this.setDepth(pos.y);
    // Generös träffyta – barnvänligt att inte behöva pricka exakt.
    this.setInteractive(
      new Phaser.Geom.Rectangle(-40, -52, 80, 78),
      Phaser.Geom.Rectangle.Contains,
    );
    if (this.input) this.input.cursor = 'pointer';
    scene.add.existing(this);
  }

  /** Där föreståndaren står och tar betalt. */
  get managerSpot(): { x: number; y: number } {
    return isoToScreen(this.gridX + 1, this.gridY);
  }

  /** Köplats nummer i (0 = längst fram vid kassan). */
  queueSpot(i: number): { x: number; y: number } {
    return isoToScreen(this.gridX - 1, this.gridY + i * 0.9);
  }

  join(customer: Customer): number {
    this.queue.push(customer);
    return this.queue.length - 1;
  }

  /** Ta bort kunden längst fram och låt resten flytta fram. */
  dequeue(): void {
    this.queue.shift();
    this.queue.forEach((c, i) => c.advanceTo(this.queueSpot(i), i));
  }

  removeFromQueue(customer: Customer): void {
    const idx = this.queue.indexOf(customer);
    if (idx === -1) return;
    this.queue.splice(idx, 1);
    this.queue.forEach((c, i) => c.advanceTo(this.queueSpot(i), i));
  }
}
