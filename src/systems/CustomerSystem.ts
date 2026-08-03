import Phaser from 'phaser';
import { Customer } from '../entities/Customer';
import type { Shelf } from '../entities/Shelf';
import type { Checkout } from '../entities/Checkout';
import { isProductUnlocked, type GameState } from '../state/GameState';
import type { EconomySystem } from './EconomySystem';
import { BALANCE } from '../config/balance';

/** Spawnar kunder och håller reda på alla som är i butiken. */
export class CustomerSystem {
  readonly customers: Customer[] = [];
  private spawnTimer?: Phaser.Time.TimerEvent;

  constructor(
    private scene: Phaser.Scene,
    private shelves: Map<string, Shelf>,
    private checkout: Checkout,
    private state: GameState,
    private economy: EconomySystem,
    private doorPoint: { x: number; y: number },
  ) {}

  start(): void {
    this.scheduleNext();
  }

  stop(): void {
    this.spawnTimer?.remove();
  }

  private scheduleNext(): void {
    const rate =
      this.state.difficulty.spawnRate * (this.state.adActiveToday ? BALANCE.adSpawnBoost : 1);
    const delay = Phaser.Math.Between(BALANCE.spawnIntervalMinMs, BALANCE.spawnIntervalMaxMs) / rate;
    this.spawnTimer = this.scene.time.delayedCall(delay, () => {
      this.spawn();
      this.scheduleNext();
    });
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

    const patienceMs =
      Phaser.Math.Between(BALANCE.patienceMinS * 1000, BALANCE.patienceMaxS * 1000) *
      this.state.difficulty.patienceModifier;

    const customer = new Customer(
      this.scene,
      this.doorPoint.x,
      this.doorPoint.y,
      list,
      patienceMs,
      this.shelves,
      this.checkout,
      this.doorPoint,
      {
        onLost: () => this.economy.registerLostCustomer(),
        onGone: (c) => {
          const idx = this.customers.indexOf(c);
          if (idx !== -1) this.customers.splice(idx, 1);
        },
      },
    );
    this.customers.push(customer);
  }
}
