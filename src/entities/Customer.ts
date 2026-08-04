import Phaser from 'phaser';
import { Actor } from './Actor';
import { BALANCE } from '../config/balance';
import type { Product } from '../state/GameState';
import type { Shelf } from './Shelf';
import type { QueueStation } from './QueueStation';

export type CustomerState = 'shopping' | 'picking' | 'toQueue' | 'queuing' | 'paying' | 'leaving';

const CUSTOMER_VARIANTS = 8;

export interface CustomerCallbacks {
  /** Kunden lämnade utan att handla (tomma hyllor eller full kö). */
  onLost: (customer: Customer) => void;
  /** Kunden är helt borta ur butiken (efter köp eller förlust). */
  onGone: (customer: Customer) => void;
}

export type Mood = 'green' | 'yellow' | 'orange' | 'red';

/**
 * Humörskala à la HappyOrNot – fyra nivåer där näst högsta är gul (inte
 * ljusgrön). Index 0 = gladast, index 3 = argast. Själva smileyn (texturerna
 * mood0..mood3, genererade i BootScene) bär färgen – ingen pratbubbla.
 */
const MOOD_NAMES: Mood[] = ['green', 'yellow', 'orange', 'red'];

export class Customer extends Actor {
  state: CustomerState = 'shopping';
  readonly basket: Product[] = [];
  mood: Mood = 'green';
  private moodLevel = 0;
  /** Antal varor kunden inte kunde få tag på (tom eller saknad hylla). */
  private missingCount = 0;
  private shoppingList: string[];
  private queueIndex = 0;
  private patienceTotalMs: number;
  private patienceLeftMs: number;
  private moodFace?: Phaser.GameObjects.Sprite;

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
    super(
      scene,
      x,
      y,
      kind === 'paket' ? 'parcelcust' : `cust${Phaser.Math.Between(0, CUSTOMER_VARIANTS - 1)}`,
      BALANCE.customerSpeed,
    );
    this.shoppingList = [...shoppingList];
    this.patienceTotalMs = patienceMs;
    this.patienceLeftMs = patienceMs;
    this.showMoodFace();
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
      // Ingen hylla för varan – räknas som saknad vara, humöret sjunker ett hack.
      this.missingCount++;
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
      } else {
        // Tom hylla – varan saknas, humöret sjunker ett hack.
        this.missingCount++;
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

  private showMoodFace(): void {
    this.moodFace = this.scene.add
      .sprite(this.x, this.y - 40, `mood${this.moodLevel}`)
      .setOrigin(0.5);
  }

  private hideMoodFace(): void {
    this.moodFace?.destroy();
    this.moodFace = undefined;
  }

  /**
   * Räknar ut humörnivån (0 gladast … 3 argast). Varje saknad vara sänker
   * humöret ett hack, och otålighet i kön sänker det ytterligare.
   */
  private computeMoodLevel(): number {
    let level = this.missingCount;
    if (this.inQueue) {
      const ratio = this.patienceLeftMs / this.patienceTotalMs;
      if (ratio <= 0.2) level += 2;
      else if (ratio <= 0.5) level += 1;
    }
    return Phaser.Math.Clamp(level, 0, MOOD_NAMES.length - 1);
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
    }
    this.moodLevel = this.computeMoodLevel();
    this.mood = MOOD_NAMES[this.moodLevel];
    if (this.moodFace) {
      this.moodFace.setTexture(`mood${this.moodLevel}`);
      this.moodFace.setPosition(this.x, this.y - 40);
      this.moodFace.setDepth(this.depth + 1);
    }
  }

  destroy(fromScene?: boolean): void {
    this.hideMoodFace();
    super.destroy(fromScene);
  }
}
