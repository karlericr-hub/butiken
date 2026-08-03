import Phaser from 'phaser';
import { Actor } from './Actor';
import { BALANCE } from '../config/balance';
import type { Product } from '../state/GameState';
import type { Shelf } from './Shelf';
import type { QueueStation } from './QueueStation';

export type CustomerState = 'shopping' | 'picking' | 'toQueue' | 'queuing' | 'paying' | 'leaving';

const CUSTOMER_TINTS = [0xef9a9a, 0x90caf9, 0xffe082, 0xce93d8, 0xa5d6a7, 0xffab91];

export interface CustomerCallbacks {
  /** Kunden lämnade utan att handla (tomma hyllor eller full kö). */
  onLost: (customer: Customer) => void;
  /** Kunden är helt borta ur butiken (efter köp eller förlust). */
  onGone: (customer: Customer) => void;
}

export type Mood = 'happy' | 'impatient' | 'angry';

const MOOD_EMOJI: Record<Mood, string> = {
  happy: '🙂',
  impatient: '😕',
  angry: '😠',
};

export class Customer extends Actor {
  state: CustomerState = 'shopping';
  readonly basket: Product[] = [];
  mood: Mood = 'happy';
  private shoppingList: string[];
  private queueIndex = 0;
  private patienceTotalMs: number;
  private patienceLeftMs: number;
  private moodBubble?: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    shoppingList: string[],
    patienceMs: number,
    private shelves: Map<string, Shelf>,
    private station: QueueStation,
    private doorPoint: { x: number; y: number },
    private callbacks: CustomerCallbacks,
    /** 'paket'-kunder går direkt till sin station utan att handla. */
    readonly kind: 'shopper' | 'paket' = 'shopper',
  ) {
    super(scene, x, y, 'person', BALANCE.customerSpeed);
    this.shoppingList = [...shoppingList];
    this.patienceTotalMs = patienceMs;
    this.patienceLeftMs = patienceMs;
    this.setTint(
      kind === 'paket' ? 0x8d6e63 : Phaser.Utils.Array.GetRandom(CUSTOMER_TINTS),
    );
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
    if (this.kind === 'shopper' && this.basket.length === 0) {
      // Hittade inget att köpa – går hem missnöjd.
      this.callbacks.onLost(this);
      this.leave();
      return;
    }
    if (this.station.queue.length >= this.station.maxLength) {
      this.callbacks.onLost(this);
      this.leave();
      return;
    }
    this.state = 'toQueue';
    this.queueIndex = this.station.join(this);
    this.showMoodBubble();
    const spot = this.station.queueSpot(this.queueIndex);
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
    this.hideMoodBubble();
  }

  finishPayment(): void {
    this.leave();
  }

  private leave(): void {
    this.state = 'leaving';
    this.hideMoodBubble();
    this.moveTo(this.doorPoint.x, this.doorPoint.y, () => {
      this.callbacks.onGone(this);
      this.destroy();
    });
  }

  /** Butiken stänger – gå hem (räknas inte som förlorad kund). */
  forceLeave(): void {
    if (this.state === 'paying' || this.state === 'leaving') return;
    if (this.inQueue) this.station.removeFromQueue(this);
    this.leave();
  }

  /** Tröttnade på att köa – lämnar utan att handla. */
  private abandonQueue(): void {
    this.station.removeFromQueue(this);
    this.callbacks.onLost(this);
    this.leave();
  }

  private showMoodBubble(): void {
    this.moodBubble = this.scene.add
      .text(this.x, this.y - 44, MOOD_EMOJI[this.mood], { fontSize: '18px' })
      .setOrigin(0.5, 1);
  }

  private hideMoodBubble(): void {
    this.moodBubble?.destroy();
    this.moodBubble = undefined;
  }

  private get inQueue(): boolean {
    return this.state === 'toQueue' || this.state === 'queuing';
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (this.inQueue) {
      this.patienceLeftMs -= delta;
      if (this.patienceLeftMs <= 0) {
        this.abandonQueue();
        return;
      }
      const ratio = this.patienceLeftMs / this.patienceTotalMs;
      this.mood = ratio > 0.5 ? 'happy' : ratio > 0.2 ? 'impatient' : 'angry';
    }
    if (this.moodBubble) {
      this.moodBubble.setText(MOOD_EMOJI[this.mood]);
      this.moodBubble.setPosition(this.x, this.y - 44);
      this.moodBubble.setDepth(this.depth + 1);
    }
  }

  destroy(fromScene?: boolean): void {
    this.hideMoodBubble();
    super.destroy(fromScene);
  }
}
