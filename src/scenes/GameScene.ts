import Phaser from 'phaser';
import { createInitialState, type GameState } from '../state/GameState';
import { PRODUCTS } from '../config/products';
import { BALANCE } from '../config/balance';
import { isoToScreen, screenToIso, GRID_W, GRID_H } from '../utils/iso';
import { Manager } from '../entities/Manager';
import { Shelf } from '../entities/Shelf';
import { Checkout } from '../entities/Checkout';
import { Delivery } from '../entities/Delivery';
import { CustomerSystem } from '../systems/CustomerSystem';
import { EconomySystem } from '../systems/EconomySystem';
import { TimeSystem } from '../systems/TimeSystem';
import { HUD } from '../ui/HUD';

const SHELF_POSITIONS: Record<string, { gx: number; gy: number }> = {
  mjolk: { gx: 3, gy: 2 },
  brod: { gx: 6, gy: 2 },
};

export class GameScene extends Phaser.Scene {
  private state!: GameState;
  private manager!: Manager;
  private shelves = new Map<string, Shelf>();
  private checkout!: Checkout;
  private customerSystem!: CustomerSystem;
  private economy!: EconomySystem;
  private timeSystem!: TimeSystem;
  private hud!: HUD;
  private delivery?: Delivery;
  private closingHandled = false;
  private customersSentHome = false;

  constructor() {
    super('Game');
  }

  create(): void {
    this.shelves.clear();
    this.delivery = undefined;
    this.closingHandled = false;
    this.customersSentHome = false;

    let state = this.registry.get('gameState') as GameState | undefined;
    if (!state) {
      state = createInitialState(BALANCE.startMoney, PRODUCTS);
      this.registry.set('gameState', state);
    }
    this.state = state;
    this.economy = new EconomySystem(this.state);
    this.timeSystem = new TimeSystem();

    this.drawFloor();

    for (const product of this.state.products) {
      const pos = SHELF_POSITIONS[product.id];
      if (!pos) continue;
      const shelf = new Shelf(this, pos.gx, pos.gy, product);
      shelf.on('pointerdown', () => this.onShelfClicked(shelf));
      this.shelves.set(product.id, shelf);
    }

    this.checkout = new Checkout(this, 7, 6);
    this.checkout.on('pointerdown', () => this.onCheckoutClicked());

    const managerStart = isoToScreen(4, 5);
    this.manager = new Manager(this, managerStart.x, managerStart.y);

    const doorPoint = isoToScreen(-1.5, 8.5);
    this.customerSystem = new CustomerSystem(
      this,
      this.shelves,
      this.checkout,
      this.state,
      this.economy,
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

  update(_time: number, delta: number): void {
    this.timeSystem.tick(delta);
    this.handleClosing();
    this.tryStartPayment();
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
    this.showProgress(shelf.x, shelf.y - 60, BALANCE.restockTimeMs, () => {
      const units = Math.min(shelf.missingUnits, this.state.storage[shelf.product.id] ?? 0);
      this.state.storage[shelf.product.id] -= units;
      shelf.addStock(units);
      this.floatText(shelf.x, shelf.y - 60, `+${units} ${shelf.product.name}`, '#aed581');
      this.manager.busy = false;
    });
  }

  private tryStartPayment(): void {
    if (this.manager.station !== 'checkout' || this.manager.busy) return;
    const customer = this.checkout.queue[0];
    if (!customer || !customer.readyToPay) return;

    this.manager.busy = true;
    customer.startPaying();
    this.showProgress(this.checkout.x, this.checkout.y - 64, BALANCE.payTimeMs, () => {
      const total = this.economy.sell(customer.basket);
      this.floatText(this.checkout.x, this.checkout.y - 64, `+${total} kr`, '#aed581');
      customer.finishPayment();
      this.checkout.dequeue();
      this.manager.busy = false;
    });
  }

  /** Liten grön förloppsindikator för en pågående handling. */
  private showProgress(x: number, y: number, durationMs: number, onDone: () => void): void {
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

  private floatText(x: number, y: number, text: string, color: string): void {
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
