import { StaffEntity } from '../entities/StaffMember';
import type { Shelf } from '../entities/Shelf';
import type { Checkout } from '../entities/Checkout';
import type { GameState } from '../state/GameState';
import type { UpgradeSystem } from './UpgradeSystem';
import type { GameScene } from '../scenes/GameScene';
import { isoToScreen } from '../utils/iso';
import { BALANCE } from '../config/balance';

/** Skapar och styr anställda: kassören sköter kassan, påfyllaren hyllorna. */
export class StaffSystem {
  cashier?: StaffEntity;
  restocker?: StaffEntity;
  private nextRestockCheck = 0;

  constructor(
    private scene: GameScene,
    private state: GameState,
    private shelves: Map<string, Shelf>,
    private checkout: Checkout,
    private upgrades: UpgradeSystem,
  ) {}

  /** Skapar figurer för den personal som är anställd. */
  spawn(): void {
    for (const member of this.state.staff) {
      if (member.role === 'kassor' && !this.cashier) {
        const spot = isoToScreen(this.checkout.gridX + 1, this.checkout.gridY - 0.7);
        this.cashier = new StaffEntity(this.scene, spot.x, spot.y, 'kassor');
      }
      if (member.role === 'pafyllare' && !this.restocker) {
        const spot = isoToScreen(5, 6);
        this.restocker = new StaffEntity(this.scene, spot.x, spot.y, 'pafyllare');
      }
    }
  }

  update(time: number): void {
    const r = this.restocker;
    if (!r || r.working || r.isMoving) return;
    if (time < this.nextRestockCheck) return;
    this.nextRestockCheck = time + BALANCE.staffRestockCheckMs;

    const target = this.pickBoxToRestock();
    if (!target) return;
    const { shelf, box } = target;

    r.working = true;
    const spot = shelf.boxStandPoint(box);
    const anchor = shelf.boxAnchor(box);
    // Står lite vid sidan av så att föreståndaren får plats framför hyllan.
    r.moveTo(spot.x - 18, spot.y - 4, () => {
      this.scene.showProgress(anchor.x - 20, anchor.y - 60, this.upgrades.restockTimeMs, () => {
        const units = Math.min(
          shelf.boxMissingUnits(box),
          this.state.storage[shelf.product.id] ?? 0,
        );
        if (units > 0) {
          this.state.storage[shelf.product.id] -= units;
          shelf.addStock(box, units);
          this.scene.floatText(anchor.x - 20, anchor.y - 60, `+${units}`, '#fb8c00');
        }
        r.working = false;
      });
    });
  }

  /** Den låda som saknar mest, förutsatt att det finns varor i lagret. */
  private pickBoxToRestock(): { shelf: Shelf; box: number } | undefined {
    let best: { shelf: Shelf; box: number; missing: number } | undefined;
    for (const shelf of this.shelves.values()) {
      if ((this.state.storage[shelf.product.id] ?? 0) <= 0) continue;
      const box = shelf.boxNeedingRestock();
      if (box < 0) continue;
      const missing = shelf.boxMissingUnits(box);
      if (!best || missing > best.missing) best = { shelf, box, missing };
    }
    return best;
  }
}
