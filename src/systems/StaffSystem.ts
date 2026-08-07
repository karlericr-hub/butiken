import { StaffEntity } from '../entities/StaffMember';
import type { Shelf } from '../entities/Shelf';
import type { Checkout } from '../entities/Checkout';
import { isProductUnlocked, type GameState } from '../state/GameState';
import type { UpgradeSystem } from './UpgradeSystem';
import type { GameScene } from '../scenes/GameScene';
import { isoToScreen } from '../utils/iso';
import { BALANCE } from '../config/balance';

/** Ett rastpass: när det börjar (förfluten öppettid) och hur länge det varar. */
interface Break {
  atMs: number;
  durationMs: number;
  taken: boolean;
}

/** Gemensamma rastfält för all personal – kassörer som påfyllare tar rast. */
interface BreakUnit {
  entity: StaffEntity;
  breaks: Break[];
  onBreak: boolean;
  /** Förfluten öppettid då rasten är slut. */
  breakEndsAt: number;
  /** Platsen den anställda återvänder till efter rasten. */
  homeSpot: { x: number; y: number };
  /** Platsen i personalrummet dit den anställda går på rast. */
  breakSpot: { x: number; y: number };
}

/** En anställd påfyllare kopplad till en enda varusort. */
interface Restocker extends BreakUnit {
  productId: string;
  nextCheck: number;
}

/** En anställd kassör vid en viss kassa. */
interface Cashier extends BreakUnit {
  index: number;
  checkout: Checkout;
}

/**
 * Skapar och styr anställda. Kassörerna står i den blå rutan vid sin kassa och
 * varje påfyllare sköter en enda varusort, så det går att anställa en per hylla.
 * All personal tar två raster om dagen (en kort och en lång) då de lämnar sin
 * station – rasterna förskjuts så att flera inte går samtidigt.
 */
export class StaffSystem {
  private restockers: Restocker[] = [];
  private cashiers: Cashier[] = [];
  /** Löpande nummer som förskjuter varje anställds raster och rastplats. */
  private staffCount = 0;

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
    this.cashiers.push({
      entity,
      index,
      checkout,
      ...this.makeBreakFields(home),
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
    this.restockers.push({
      entity,
      productId,
      nextCheck: 0,
      ...this.makeBreakFields(home),
    });
  }

  /**
   * Rastfälten för en ny anställd. Två raster (en kort, en lång) och en egen
   * rastplats i personalrummet, båda förskjutna via `staffCount` så att flera
   * anställda varken går på rast eller står på samma ruta samtidigt.
   */
  private makeBreakFields(home: { x: number; y: number }): Omit<BreakUnit, 'entity'> {
    const stagger = this.staffCount * BALANCE.staffBreakStaggerMs;
    const day = BALANCE.dayDurationMs;
    const breakSpot = isoToScreen(2 + this.staffCount, 8);
    this.staffCount++;
    return {
      breaks: [
        {
          atMs: day * BALANCE.staffShortBreakAtFraction + stagger,
          durationMs: BALANCE.staffShortBreakMs,
          taken: false,
        },
        {
          atMs: day * BALANCE.staffLongBreakAtFraction + stagger,
          durationMs: BALANCE.staffLongBreakMs,
          taken: false,
        },
      ],
      onBreak: false,
      breakEndsAt: 0,
      homeSpot: home,
      breakSpot,
    };
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
    for (const r of this.restockers) this.updateRestocker(r, time, elapsedMs);
    for (const c of this.cashiers) this.handleBreaks(c, elapsedMs);
  }

  /**
   * Sköter en anställds raster: går på rast när det är dags, står kvar tills den
   * är slut och går sedan tillbaka till sin station. Returnerar true så länge
   * den anställda är på rast (och alltså inte kan arbeta).
   */
  private handleBreaks(unit: BreakUnit, elapsedMs: number): boolean {
    const e = unit.entity;
    if (unit.onBreak) {
      // Rasten är slut: gå tillbaka till stationen.
      if (elapsedMs >= unit.breakEndsAt && !e.isMoving) {
        unit.onBreak = false;
        e.moveTo(unit.homeSpot.x, unit.homeSpot.y);
      }
      return true;
    }
    // Starta inte en rast mitt i ett arbete eller under förflyttning.
    if (e.working || e.isMoving) return false;
    const due = unit.breaks.find((b) => !b.taken && elapsedMs >= b.atMs);
    if (due) {
      due.taken = true;
      unit.onBreak = true;
      unit.breakEndsAt = elapsedMs + due.durationMs;
      e.moveTo(unit.breakSpot.x, unit.breakSpot.y);
      return true;
    }
    return false;
  }

  private updateRestocker(rr: Restocker, time: number, elapsedMs: number): void {
    // Påfyllaren tar rast som all annan personal – då fylls inga hyllor på.
    if (this.handleBreaks(rr, elapsedMs)) return;

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
