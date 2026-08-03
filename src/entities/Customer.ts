import Phaser from 'phaser';
import { Actor } from './Actor';
import { BALANCE } from '../config/balance';
import type { Product } from '../state/GameState';
import type { Shelf } from './Shelf';
import type { Checkout } from './Checkout';

export type CustomerState = 'shopping' | 'picking' | 'toQueue' | 'queuing' | 'paying' | 'leaving';

const CUSTOMER_TINTS = [0xef9a9a, 0x90caf9, 0xffe082, 0xce93d8, 0xa5d6a7, 0xffab91];

export interface CustomerCallbacks {
  /** Kunden lämnade utan att handla (tomma hyllor eller full kö). */
  onLost: (customer: Customer) => void;
  /** Kunden är helt borta ur butiken (efter köp eller förlust). */
  onGone: (customer: Customer) => void;
}

export class Customer extends Actor {
  state: CustomerState = 'shopping';
  readonly basket: Product[] = [];
  private shoppingList: string[];
  private queueIndex = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    shoppingList: string[],
    private shelves: Map<string, Shelf>,
    private checkout: Checkout,
    private doorPoint: { x: number; y: number },
    private callbacks: CustomerCallbacks,
  ) {
    super(scene, x, y, 'person', BALANCE.customerSpeed);
    this.shoppingList = [...shoppingList];
    this.setTint(Phaser.Utils.Array.GetRandom(CUSTOMER_TINTS));
    this.startNextTask();
  }

  private jitter(p: { x: number; y: number }): { x: number; y: number } {
    return {
      x: p.x + Phaser.Math.Between(-12, 12),
      y: p.y + Phaser.Math.Between(-6, 6),
    };
  }

  private startNextTask(): void {
    const nextId = this.shoppingList.shift();
    if (nextId === undefined) {
      this.headForCheckout();
      return;
    }
    const shelf = this.shelves.get(nextId);
    if (!shelf) {
      this.startNextTask();
      return;
    }
    this.state = 'shopping';
    const spot = this.jitter(shelf.standPoint);
    this.moveTo(spot.x, spot.y, () => this.pickAt(shelf));
  }

  private pickAt(shelf: Shelf): void {
    this.state = 'picking';
    this.scene.time.delayedCall(BALANCE.pickTimeMs, () => {
      if (!this.active) return;
      if (shelf.takeOne()) {
        this.basket.push(shelf.product);
      }
      this.startNextTask();
    });
  }

  private headForCheckout(): void {
    if (this.basket.length === 0) {
      // Hittade inget att köpa – går hem missnöjd.
      this.callbacks.onLost(this);
      this.leave();
      return;
    }
    if (this.checkout.queue.length >= BALANCE.maxQueueLength) {
      this.callbacks.onLost(this);
      this.leave();
      return;
    }
    this.state = 'toQueue';
    this.queueIndex = this.checkout.join(this);
    const spot = this.checkout.queueSpot(this.queueIndex);
    this.moveTo(spot.x, spot.y, () => {
      this.state = 'queuing';
    });
  }

  /** Kön flyttar fram – gå till ny plats. */
  advanceTo(spot: { x: number; y: number }, index: number): void {
    if (this.state !== 'queuing' && this.state !== 'toQueue') return;
    this.queueIndex = index;
    this.state = 'toQueue';
    this.moveTo(spot.x, spot.y, () => {
      this.state = 'queuing';
    });
  }

  /** Sant när kunden står stilla längst fram i kön, redo att betala. */
  get readyToPay(): boolean {
    return this.state === 'queuing' && this.queueIndex === 0 && !this.isMoving;
  }

  startPaying(): void {
    this.state = 'paying';
  }

  finishPayment(): void {
    this.leave();
  }

  private leave(): void {
    this.state = 'leaving';
    this.moveTo(this.doorPoint.x, this.doorPoint.y, () => {
      this.callbacks.onGone(this);
      this.destroy();
    });
  }
}
