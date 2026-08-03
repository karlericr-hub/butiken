import Phaser from 'phaser';
import { Customer } from '../entities/Customer';
import type { Shelf } from '../entities/Shelf';
import type { Checkout } from '../entities/Checkout';
import type { ParcelDesk } from '../entities/ParcelDesk';
import { isProductUnlocked, type GameState } from '../state/GameState';
import type { EconomySystem } from './EconomySystem';
import type { UpgradeSystem } from './UpgradeSystem';
import { sfx } from './Sfx';
import { BALANCE } from '../config/balance';

/** Spawnar kunder (och paketkunder) och håller reda på alla i butiken. */
export class CustomerSystem {
  readonly customers: Customer[] = [];
  private spawnTimer?: Phaser.Time.TimerEvent;
  private parcelTimer?: Phaser.Time.TimerEvent;

  constructor(
    private scene: Phaser.Scene,
    private shelves: Map<string, Shelf>,
    private checkout: Checkout,
    private parcelDesk: ParcelDesk | undefined,
    private state: GameState,
    private economy: EconomySystem,
    private upgrades: UpgradeSystem,
    private doorPoint: { x: number; y: number },
  ) {}

  start(): void {
    this.scheduleNext();
    if (this.parcelDesk) this.scheduleParcel();
  }

  stop(): void {
    this.spawnTimer?.remove();
    this.parcelTimer?.remove();
  }

  private scheduleNext(): void {
    const rate =
      this.state.difficulty.spawnRate *
      this.upgrades.spawnMultiplier *
      (this.state.adActiveToday ? BALANCE.adSpawnBoost : 1);
    const delay = Phaser.Math.Between(BALANCE.spawnIntervalMinMs, BALANCE.spawnIntervalMaxMs) / rate;
    this.spawnTimer = this.scene.time.delayedCall(delay, () => {
      this.spawn();
      this.scheduleNext();
    });
  }

  private scheduleParcel(): void {
    const delay = Phaser.Math.Between(BALANCE.parcelSpawnMinMs, BALANCE.parcelSpawnMaxMs);
    this.parcelTimer = this.scene.time.delayedCall(delay, () => {
      this.spawnParcelCustomer();
      this.scheduleParcel();
    });
  }

  private spawnParcelCustomer(): void {
    if (!this.parcelDesk) return;
    const customer = new Customer(
      this.scene,
      this.doorPoint.x,
      this.doorPoint.y,
      [],
      this.rollPatience(),
      this.shelves,
      this.parcelDesk,
      this.doorPoint,
      this.makeCallbacks(),
      'paket',
    );
    this.customers.push(customer);
  }

  private rollPatience(): number {
    return (
      Phaser.Math.Between(BALANCE.patienceMinS * 1000, BALANCE.patienceMaxS * 1000) *
      this.state.difficulty.patienceModifier
    );
  }

  private makeCallbacks() {
    return {
      onLost: () => {
        this.economy.registerLostCustomer();
        sfx.sad();
      },
      onGone: (c: Customer) => {
        const idx = this.customers.indexOf(c);
        if (idx !== -1) this.customers.splice(idx, 1);
      },
    };
  }

  private spawn(): void {
    const productIds = this.state.products
      .filter((p) => isProductUnlocked(this.state, p))
      .map((p) => p.id);
    const count = Phaser.Math.Between(BALANCE.shoppingListMin, BALANCE.shoppingListMax);
    const list: string[] = [];
    for (let i = 0; i < count; i++) {
      list.push(Phaser.Utils.Array.GetRandom(productIds));
    }

    const customer = new Customer(
      this.scene,
      this.doorPoint.x,
      this.doorPoint.y,
      list,
      this.rollPatience(),
      this.shelves,
      this.checkout,
      this.doorPoint,
      this.makeCallbacks(),
    );
    this.customers.push(customer);
  }
}
