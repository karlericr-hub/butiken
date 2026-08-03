import Phaser from 'phaser';
import { createInitialState, isProductUnlocked, type GameState } from '../state/GameState';
import { PRODUCTS } from '../config/products';
import { BALANCE } from '../config/balance';
import { isoToScreen, screenToIso, GRID_W, GRID_H } from '../utils/iso';
import { Manager } from '../entities/Manager';
import { Shelf } from '../entities/Shelf';
import { Checkout } from '../entities/Checkout';
import { ParcelDesk } from '../entities/ParcelDesk';
import { Delivery } from '../entities/Delivery';
import { CustomerSystem } from '../systems/CustomerSystem';
import { StaffSystem } from '../systems/StaffSystem';
import { EconomySystem } from '../systems/EconomySystem';
import { TimeSystem } from '../systems/TimeSystem';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import { HUD } from '../ui/HUD';

const SHELF_POSITIONS: Record<string, { gx: number; gy: number }> = {
  mjolk: { gx: 3, gy: 2 },
  brod: { gx: 6, gy: 2 },
  godis: { gx: 1, gy: 3 },
};

export class GameScene extends Phaser.Scene {
  private state!: GameState;
  private manager!: Manager;
  private shelves = new Map<string, Shelf>();
  private checkout!: Checkout;
  private customerSystem!: CustomerSystem;
  private staffSystem!: StaffSystem;
  private economy!: EconomySystem;
  private timeSystem!: TimeSystem;
  private upgrades!: UpgradeSystem;
  private hud!: HUD;
  private delivery?: Delivery;
  private parcelDesk?: ParcelDesk;
  private closingHandled = false;
  private customersSentHome = false;
  private paymentBusy = false;
  private parcelBusy = false;

  constructor() {
    super('Game');
  }

  create(): void {
    this.shelves.clear();
    this.delivery = undefined;
    this.parcelDesk = undefined;
    this.closingHandled = false;
    this.customersSentHome = false;
    this.paymentBusy = false;
    this.parcelBusy = false;

    let state = this.registry.get('gameState') as GameState | undefined;
    if (!state) {
      state = createInitialState(BALANCE.startMoney, PRODUCTS);
      this.registry.set('gameState', state);
    }
    this.state = state;
    this.economy = new EconomySystem(this.state);
    this.timeSystem = new TimeSystem();
    this.upgrades = new UpgradeSystem(this.state);

    this.drawFloor();

    for (const product of this.state.products) {
      const pos = SHELF_POSITIONS[product.id];
      if (!pos || !isProductUnlocked(this.state, product)) continue;
      const shelf = new Shelf(this, pos.gx, pos.gy, product);
      shelf.on('pointerdown', () => this.onShelfClicked(shelf));
      this.shelves.set(product.id, shelf);
    }

    this.checkout = new Checkout(this, 7, 6, this.upgrades.maxQueueLength);
    this.checkout.on('pointerdown', () => this.onCheckoutClicked());

    if (this.state.isParcelAgent) {
      this.parcelDesk = new ParcelDesk(this, 8, 3, BALANCE.parcelQueueMax);
      this.parcelDesk.on('pointerdown', () => this.onParcelDeskClicked());
    }

    const managerStart = isoToScreen(4, 5);
    this.manager = new Manager(this, managerStart.x, managerStart.y);

    this.staffSystem = new StaffSystem(
      this,
      this.state,
      this.shelves,
      this.checkout,
      this.upgrades,
    );
    this.staffSystem.spawn();

    const doorPoint = isoToScreen(-1.5, 8.5);
    this.customerSystem = new CustomerSystem(
      this,
      this.shelves,
      this.checkout,
      this.parcelDesk,
      this.state,
      this.economy,
      this.upgrades,
      doorPoint,
    );
    this.customerSystem.start();

    this.scheduleDelivery();

    this.hud = new HUD(this, this.state, this.checkout);

    // Klick på golvet (inte på en station) → gå dit.
    this.input.on(
      'pointerdown',
      (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
        if (over.length > 0) return;
        const { gx, gy } = screenToIso(pointer.worldX, pointer.worldY);
        const cgx = Phaser.Math.Clamp(gx, 0.3, GRID_W - 0.3);
        const cgy = Phaser.Math.Clamp(gy, 0.3, GRID_H - 0.3);
        const target = isoToScreen(cgx, cgy);
        this.manager.walkTo(target.x, target.y);
      },
    );
  }

  update(time: number, delta: number): void {
    this.timeSystem.tick(delta);
    this.handleClosing();
    this.tryStartPayment();
    this.tryStartParcelService();
    this.staffSystem.update(time);
    this.hud.update(this.timeSystem.isClosed ? 'STÄNGT' : this.timeSystem.clockText);
  }

  // --- Dagcykel ---

  private handleClosing(): void {
    if (!this.timeSystem.isClosed) return;

    if (!this.closingHandled) {
      this.closingHandled = true;
      this.customerSystem.stop();
      this.showClosedBanner();
    }

    // Skicka hem kvarvarande kunder om de dröjer för länge efter stängning.
    if (!this.customersSentHome && this.timeSystem.msSinceClose > BALANCE.closingGraceMs) {
      this.customersSentHome = true;
      for (const c of [...this.customerSystem.customers]) c.forceLeave();
    }

    if (this.customerSystem.customers.length === 0 && !this.manager.busy) {
      this.endDay();
    }
  }

  private endDay(): void {
    // Ej upplastad leverans bärs in i lagret automatiskt vid stängning.
    if (this.delivery) {
      this.storeDeliveryContents(this.delivery.contents);
      this.delivery.destroy();
      this.delivery = undefined;
    }
    this.scene.start('Evening');
  }

  private showClosedBanner(): void {
    this.add
      .text(this.scale.width / 2, 76, 'STÄNGT – sista kunderna betjänas', {
        fontFamily: 'sans-serif',
        fontSize: '22px',
        color: '#ffcc80',
        fontStyle: 'bold',
        stroke: '#1e1e2e',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0)
      .setDepth(10002);
  }

  // --- Leverans ---

  private scheduleDelivery(): void {
    const order = this.state.pendingOrder;
    if (Object.values(order).every((n) => !n)) return;
    this.time.delayedCall(BALANCE.dayDurationMs * BALANCE.deliveryArrivalFraction, () => {
      this.delivery = new Delivery(this, 1, 7, order);
      this.delivery.on('pointerdown', () => this.onDeliveryClicked());
      this.state.pendingOrder = {};
      this.floatText(this.delivery.x, this.delivery.y - 70, 'Varor har kommit!', '#ffe082');
    });
  }

  private onDeliveryClicked(): void {
    const delivery = this.delivery;
    if (!delivery || this.manager.busy) return;
    const spot = delivery.standPoint;
    this.manager.walkTo(spot.x, spot.y, () => {
      if (!this.delivery) return;
      this.manager.busy = true;
      this.showProgress(delivery.x, delivery.y - 64, BALANCE.unloadTimeMs, () => {
        this.storeDeliveryContents(delivery.contents);
        this.floatText(delivery.x, delivery.y - 64, 'Inlastat i lagret!', '#aed581');
        delivery.destroy();
        this.delivery = undefined;
        this.manager.busy = false;
      });
    });
  }

  private storeDeliveryContents(contents: Record<string, number>): void {
    for (const [id, units] of Object.entries(contents)) {
      this.state.storage[id] = (this.state.storage[id] ?? 0) + units;
    }
  }

  // --- Ritning & interaktion ---

  private drawFloor(): void {
    for (let gx = 0; gx < GRID_W; gx++) {
      for (let gy = 0; gy < GRID_H; gy++) {
        const pos = isoToScreen(gx, gy);
        const tile = this.add.sprite(pos.x, pos.y + 16, 'tile');
        tile.setOrigin(0.5, 0.5);
        tile.setTint((gx + gy) % 2 === 0 ? 0xe9e1d1 : 0xdfd6c3);
        tile.setDepth(-1000);
      }
    }
    // Dörrmatta där kunderna kommer in
    for (const gy of [8, 9]) {
      const pos = isoToScreen(0, gy);
      const mat = this.add.sprite(pos.x, pos.y + 16, 'tile');
      mat.setOrigin(0.5, 0.5);
      mat.setTint(0xa1887f);
      mat.setDepth(-999);
    }
  }

  private onCheckoutClicked(): void {
    const spot = this.checkout.managerSpot;
    this.manager.walkTo(spot.x, spot.y, () => {
      this.manager.station = 'checkout';
    });
  }

  private onParcelDeskClicked(): void {
    if (!this.parcelDesk) return;
    const spot = this.parcelDesk.managerSpot;
    this.manager.walkTo(spot.x, spot.y, () => {
      this.manager.station = 'parcel';
    });
  }

  private onShelfClicked(shelf: Shelf): void {
    if (this.manager.busy) return;
    const spot = shelf.standPoint;
    this.manager.walkTo(spot.x, spot.y, () => this.restock(shelf));
  }

  /** Fyller på hyllan från lagerrummet (varor köps in via kvällsbeställningen). */
  private restock(shelf: Shelf): void {
    if (shelf.missingUnits <= 0) return;
    const available = this.state.storage[shelf.product.id] ?? 0;
    if (available <= 0) {
      this.floatText(shelf.x, shelf.y - 60, 'Lagret är tomt!', '#ef9a9a');
      return;
    }
    this.manager.busy = true;
    this.showProgress(shelf.x, shelf.y - 60, this.upgrades.restockTimeMs, () => {
      const units = Math.min(shelf.missingUnits, this.state.storage[shelf.product.id] ?? 0);
      this.state.storage[shelf.product.id] -= units;
      shelf.addStock(units);
      this.floatText(shelf.x, shelf.y - 60, `+${units} ${shelf.product.name}`, '#aed581');
      this.manager.busy = false;
    });
  }

  private tryStartPayment(): void {
    if (this.paymentBusy) return;
    const customer = this.checkout.queue[0];
    if (!customer || !customer.readyToPay) return;

    // Anställd kassör sköter kassan automatiskt, annars krävs föreståndaren.
    const cashier = this.staffSystem.cashier;
    const managerReady = this.manager.station === 'checkout' && !this.manager.busy;
    if (!cashier && !managerReady) return;

    this.paymentBusy = true;
    if (cashier) cashier.working = true;
    else this.manager.busy = true;

    customer.startPaying();
    this.showProgress(this.checkout.x, this.checkout.y - 64, this.upgrades.payTimeMs, () => {
      const total = this.economy.sell(customer.basket);
      this.floatText(this.checkout.x, this.checkout.y - 64, `+${total} kr`, '#aed581');
      customer.finishPayment();
      this.checkout.dequeue();
      this.paymentBusy = false;
      if (cashier) cashier.working = false;
      else this.manager.busy = false;
    });
  }

  private tryStartParcelService(): void {
    const desk = this.parcelDesk;
    if (!desk || this.parcelBusy) return;
    const customer = desk.queue[0];
    if (!customer || !customer.readyToPay) return;
    if (this.manager.station !== 'parcel' || this.manager.busy) return;

    this.parcelBusy = true;
    this.manager.busy = true;
    customer.startPaying();
    this.showProgress(desk.x, desk.y - 64, BALANCE.parcelHandleTimeMs, () => {
      const fee = this.economy.parcelIncome();
      this.floatText(desk.x, desk.y - 64, `+${fee} kr`, '#aed581');
      customer.finishPayment();
      desk.dequeue();
      this.parcelBusy = false;
      this.manager.busy = false;
    });
  }

  /** Liten grön förloppsindikator för en pågående handling. */
  showProgress(x: number, y: number, durationMs: number, onDone: () => void): void {
    const g = this.add.graphics();
    g.setDepth(9000);
    const progress = { p: 0 };
    this.tweens.add({
      targets: progress,
      p: 1,
      duration: durationMs,
      onUpdate: () => {
        g.clear();
        g.fillStyle(0x263238, 0.8);
        g.fillRect(x - 26, y, 52, 8);
        g.fillStyle(0x66bb6a, 1);
        g.fillRect(x - 24, y + 2, 48 * progress.p, 4);
      },
      onComplete: () => {
        g.destroy();
        onDone();
      },
    });
  }

  floatText(x: number, y: number, text: string, color: string): void {
    const t = this.add
      .text(x, y, text, {
        fontFamily: 'sans-serif',
        fontSize: '16px',
        color,
        fontStyle: 'bold',
        stroke: '#1e1e2e',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(9500);
    this.tweens.add({
      targets: t,
      y: y - 36,
      alpha: 0,
      duration: 1100,
      ease: 'Cubic.easeOut',
      onComplete: () => t.destroy(),
    });
  }
}
