import { StaffEntity } from '../entities/StaffMember';
import type { Shelf } from '../entities/Shelf';
import type { Checkout } from '../entities/Checkout';
import { isProductUnlocked, type GameState } from '../state/GameState';
import type { UpgradeSystem } from './UpgradeSystem';
import type { GameScene } from '../scenes/GameScene';
import { isoToScreen } from '../utils/iso';
import { BALANCE } from '../config/balance';

/** En anställd påfyllare kopplad till en enda varusort. */
interface Restocker {
  entity: StaffEntity;
  productId: string;
  nextCheck: number;
}

/** Ett rastpass: när det börjar (förfluten öppettid) och hur länge det varar. */
interface Break {
  atMs: number;
  durationMs: number;
  taken: boolean;
}

/** En anställd kassör vid en viss kassa, med sitt rastschema. */
interface Cashier {
  entity: StaffEntity;
  index: number;
  checkout: Checkout;
  homeSpot: { x: number; y: number };
  breakSpot: { x: number; y: number };
  breaks: Break[];
  onBreak: boolean;
  /** Förfluten öppettid då rasten är slut. */
  breakEndsAt: number;
}

/**
 * Skapar och styr anställda. Kassörerna står i den blå rutan vid sin kassa och
 * tar två raster om dagen (en kort och en lång) då de lämnar kassan – flera
 * kassörer förskjuts så att de inte går samtidigt. Varje påfyllare sköter en
 * enda varusort, så det går att anställa en per hylla.
 */
export class StaffSystem {
  private restockers: Restocker[] = [];
  private cashiers: Cashier[] = [];

  constructor(
    private scene: GameScene,
    private state: GameState,
    private shelves: Map<string, Shelf>,
    private checkouts: Checkout[],
    private upgrades: UpgradeSystem,
  ) {}

  /** Skapar figurer för den personal som är anställd. */
  spawn(): void {
    for (const member of this.state.staff) {
      if (member.role === 'kassor') this.spawnCashier(member.checkoutIndex ?? 0);
      if (member.role === 'pafyllare') this.spawnRestocker(member.productId, member);
    }
  }

  private spawnCashier(index: number): void {
    const checkout = this.checkouts[index];
    if (!checkout || this.cashiers.some((c) => c.index === index)) return;
    const home = checkout.managerSpot;
    const entity = new StaffEntity(this.scene, home.x, home.y, 'kassor');
    // Rastplatsen förskjuts per kassa så att kassörerna inte trängs ihop.
    const breakSpot = isoToScreen(2 + index, 8);
    this.cashiers.push({
      entity,
      index,
      checkout,
      homeSpot: home,
      breakSpot,
      breaks: this.buildBreaks(index),
      onBreak: false,
      breakEndsAt: 0,
    });
  }

  private spawnRestocker(
    productId: string | undefined,
    member: { productId?: string },
  ): void {
    // Äldre sparfiler saknar varusort – ge påfyllaren nästa lediga sort.
    if (!productId) {
      const taken = new Set(this.restockers.map((r) => r.productId));
      productId = this.state.products.find(
        (p) => isProductUnlocked(this.state, p) && !taken.has(p.id),
      )?.id;
    }
    if (!productId || this.restockers.some((r) => r.productId === productId)) return;
    member.productId = productId;
    const shelf = this.shelves.get(productId);
    const home = shelf ? isoToScreen(shelf.gridX, shelf.gridY + 1.4) : isoToScreen(5, 6);
    const entity = new StaffEntity(this.scene, home.x, home.y, 'pafyllare');
    this.restockers.push({ entity, productId, nextCheck: 0 });
  }

  /** Två raster om dagen, förskjutna per kassa så flera inte lämnar samtidigt. */
  private buildBreaks(index: number): Break[] {
    const day = BALANCE.dayDurationMs;
    const stagger = index * BALANCE.cashierBreakStaggerMs;
    return [
      {
        atMs: day * BALANCE.cashierShortBreakAtFraction + stagger,
        durationMs: BALANCE.cashierShortBreakMs,
        taken: false,
      },
      {
        atMs: day * BALANCE.cashierLongBreakAtFraction + stagger,
        durationMs: BALANCE.cashierLongBreakMs,
        taken: false,
      },
    ];
  }

  /**
   * Kassören vid en viss kassa om den står redo att expediera (inte på rast, på
   * väg eller redan upptagen). Annars undefined.
   */
  availableCashier(index: number): StaffEntity | undefined {
    const c = this.cashiers.find((cc) => cc.index === index);
    if (!c || c.onBreak || c.entity.isMoving || c.entity.working) return undefined;
    return c.entity;
  }

  update(time: number, elapsedMs: number): void {
    for (const r of this.restockers) this.updateRestocker(r, time);
    for (const c of this.cashiers) this.updateCashier(c, elapsedMs);
  }

  private updateCashier(c: Cashier, elapsedMs: number): void {
    const e = c.entity;
    if (c.onBreak) {
      // Rasten är slut: gå tillbaka till kassan (den blå rutan).
      if (elapsedMs >= c.breakEndsAt && !e.isMoving) {
        c.onBreak = false;
        e.moveTo(c.homeSpot.x, c.homeSpot.y);
      }
      return;
    }
    // Starta inte en rast mitt i en expediering eller under förflyttning.
    if (e.working || e.isMoving) return;
    const due = c.breaks.find((b) => !b.taken && elapsedMs >= b.atMs);
    if (due) {
      due.taken = true;
      c.onBreak = true;
      c.breakEndsAt = elapsedMs + due.durationMs;
      e.moveTo(c.breakSpot.x, c.breakSpot.y);
    }
  }

  private updateRestocker(rr: Restocker, time: number): void {
    const r = rr.entity;
    if (r.working || r.isMoving) return;
    if (time < rr.nextCheck) return;
    rr.nextCheck = time + BALANCE.staffRestockCheckMs;

    const shelf = this.shelves.get(rr.productId);
    if (!shelf) return;
    if ((this.state.storage[rr.productId] ?? 0) <= 0) return;
    const box = shelf.boxNeedingRestock();
    if (box < 0) return;

    r.working = true;
    const spot = shelf.boxStandPoint(box);
    const anchor = shelf.boxAnchor(box);
    // Står lite vid sidan av så att föreståndaren får plats framför hyllan.
    r.moveTo(spot.x - 18, spot.y - 4, () => {
      this.scene.showProgress(anchor.x - 20, anchor.y - 60, this.upgrades.restockTimeMs, () => {
        const units = Math.min(
          shelf.boxMissingUnits(box),
          this.state.storage[rr.productId] ?? 0,
        );
        if (units > 0) {
          this.state.storage[rr.productId] -= units;
          shelf.addStock(box, units);
          this.scene.floatText(anchor.x - 20, anchor.y - 60, `+${units}`, '#fb8c00');
        }
        r.working = false;
      });
    });
  }
}
