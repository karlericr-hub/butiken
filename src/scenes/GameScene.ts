import Phaser from 'phaser';
import { createInitialState, isProductUnlocked, type GameState } from '../state/GameState';
import { PRODUCTS } from '../config/products';
import { BALANCE } from '../config/balance';
import { isoToScreen, screenToIso, GRID_W, GRID_H } from '../utils/iso';
import { INV_SCALE, VIEW_W, setupHiResCamera } from '../utils/scale';
import { Manager } from '../entities/Manager';
import { Shelf } from '../entities/Shelf';
import { Checkout } from '../entities/Checkout';
import { ParcelDesk } from '../entities/ParcelDesk';
import { Delivery } from '../entities/Delivery';
import { InteractionMarker } from '../entities/InteractionMarker';
import { NavGrid } from '../systems/NavGrid';
import { CustomerSystem } from '../systems/CustomerSystem';
import { StaffSystem } from '../systems/StaffSystem';
import { EconomySystem } from '../systems/EconomySystem';
import { TimeSystem } from '../systems/TimeSystem';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import { DifficultySystem } from '../systems/DifficultySystem';
import { sfx } from '../systems/Sfx';
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
  private difficulty!: DifficultySystem;
  private hud!: HUD;
  private delivery?: Delivery;
  private parcelDesk?: ParcelDesk;
  private closingHandled = false;
  private customersSentHome = false;
  private paymentBusy = false;
  private parcelBusy = false;
  /** Klickzoner för stationerna (i rutnätskoordinater) med tillhörande handling. */
  private interactables: { gx: number; gy: number; act: () => void }[] = [];

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
    this.interactables = [];

    setupHiResCamera(this);

    let state = this.registry.get('gameState') as GameState | undefined;
    if (!state) {
      state = createInitialState(BALANCE.startMoney, PRODUCTS);
      this.registry.set('gameState', state);
    }
    this.state = state;
    this.economy = new EconomySystem(this.state);
    this.timeSystem = new TimeSystem();
    this.upgrades = new UpgradeSystem(this.state);

    this.drawBackdrop();
    this.drawFloor();
    this.drawWalls();
    this.placeProps();

    for (const product of this.state.products) {
      const pos = SHELF_POSITIONS[product.id];
      if (!pos || !isProductUnlocked(this.state, product)) continue;
      const shelf = new Shelf(this, pos.gx, pos.gy, product);
      // Klickbar ruta framför hyllan (mot golvet), inte hyllan själv.
      const marker = new InteractionMarker(this, pos.gx, pos.gy + 1);
      const act = () => this.onShelfClicked(shelf);
      marker.on('pointerdown', act);
      // Klickzon mellan hyllan och rutan – klick på hyllan, rutan eller nära räcker.
      this.interactables.push({ gx: pos.gx, gy: pos.gy + 0.5, act });
      this.shelves.set(product.id, shelf);
    }

    this.checkout = new Checkout(this, 7, 6, this.upgrades.maxQueueLength);
    const checkoutMarker = new InteractionMarker(
      this,
      this.checkout.gridX + 1,
      this.checkout.gridY,
      0x64b5f6,
    );
    const checkoutAct = () => this.onCheckoutClicked();
    checkoutMarker.on('pointerdown', checkoutAct);
    this.interactables.push({
      gx: this.checkout.gridX + 0.5,
      gy: this.checkout.gridY,
      act: checkoutAct,
    });

    if (this.state.isParcelAgent) {
      this.parcelDesk = new ParcelDesk(this, 8, 3, BALANCE.parcelQueueMax);
      const parcelMarker = new InteractionMarker(
        this,
        this.parcelDesk.gridX + 1,
        this.parcelDesk.gridY,
        0x64b5f6,
      );
      const parcelAct = () => this.onParcelDeskClicked();
      parcelMarker.on('pointerdown', parcelAct);
      this.interactables.push({
        gx: this.parcelDesk.gridX + 0.5,
        gy: this.parcelDesk.gridY,
        act: parcelAct,
      });
    }

    // Bygg navigeringsrutnätet: hyllor, kassa och paketdisk blockeras så att
    // figurerna går runt dem i stället för rakt igenom.
    const navGrid = new NavGrid();
    for (const shelf of this.shelves.values()) navGrid.block(shelf.gridX, shelf.gridY);
    navGrid.block(this.checkout.gridX, this.checkout.gridY);
    if (this.parcelDesk) navGrid.block(this.parcelDesk.gridX, this.parcelDesk.gridY);
    this.registry.set('navGrid', navGrid);

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

    this.difficulty = new DifficultySystem(this.state, this.checkout, this.shelves);

    this.scheduleDelivery();

    this.hud = new HUD(this, this.state, this.checkout);

    this.showPendingHint();

    // Klick på golvet → sköt närmaste station om klicket är i eller nära den,
    // annars gå till punkten.
    this.input.on(
      'pointerdown',
      (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
        if (over.length > 0) return;
        const { gx, gy } = screenToIso(pointer.worldX, pointer.worldY);
        const station = this.stationAt(gx, gy);
        if (station) {
          station.act();
          return;
        }
        const cgx = Phaser.Math.Clamp(gx, 0.3, GRID_W - 0.3);
        const cgy = Phaser.Math.Clamp(gy, 0.3, GRID_H - 0.3);
        const target = isoToScreen(cgx, cgy);
        this.manager.walkTo(target.x, target.y);
      },
    );
  }

  /**
   * Närmaste stationsklickzon inom räckhåll för en punkt (rutnätskoordinater),
   * eller undefined om klicket är för långt från alla stationer. Generös radie
   * så att klick på hyllan/kassan, rutan framför eller strax intill räknas.
   */
  private stationAt(gx: number, gy: number): { act: () => void } | undefined {
    const reach = 1.15;
    let best: { gx: number; gy: number; act: () => void } | undefined;
    let bestDist = reach;
    for (const it of this.interactables) {
      const d = Math.hypot(gx - it.gx, gy - it.gy);
      if (d <= bestDist) {
        bestDist = d;
        best = it;
      }
    }
    return best;
  }

  update(time: number, delta: number): void {
    this.timeSystem.tick(delta);
    this.handleClosing();
    this.tryStartPayment();
    this.tryStartParcelService();
    this.staffSystem.update(time);
    if (!this.timeSystem.isClosed) this.difficulty.update(time);
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
    this.difficulty.adjustAfterDay();
    this.scene.start('Evening');
  }

  /** Vänlig hint från det adaptiva svårighetssystemet. */
  private showPendingHint(): void {
    const hint = this.state.pendingHint;
    if (!hint) return;
    this.state.pendingHint = undefined;
    const banner = this.add
      .text(VIEW_W / 2, 84, hint, {
        fontFamily: '"Baloo 2", sans-serif',
        fontSize: '17px',
        color: '#ffffff',
        backgroundColor: '#ff8f00',
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5, 0)
      .setDepth(10003);
    this.tweens.add({
      targets: banner,
      alpha: 0,
      delay: 6000,
      duration: 800,
      onComplete: () => banner.destroy(),
    });
  }

  private showClosedBanner(): void {
    this.add
      .text(VIEW_W / 2, 76, 'STÄNGT – sista kunderna betjänas', {
        fontFamily: '"Baloo 2", sans-serif',
        fontSize: '22px',
        color: '#d84315',
        fontStyle: 'bold',
        stroke: '#ffffff',
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
      this.floatText(this.delivery.x, this.delivery.y - 70, 'Varor har kommit!', '#ff8f00');
      sfx.ding();
      this.delivery.setScale(0);
      this.tweens.add({ targets: this.delivery, scale: 1, duration: 400, ease: 'Back.easeOut' });
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
        this.floatText(delivery.x, delivery.y - 64, 'Inlastat i lagret!', '#43a047');
        sfx.pop();
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

  /** Himmel med moln och en gräsplätt som butiken står på. */
  private drawBackdrop(): void {
    const clouds: [number, number, number][] = [
      [120, 120, 0.9],
      [430, 88, 0.65],
      [840, 140, 0.8],
      [180, 560, 0.7],
      [790, 590, 0.85],
    ];
    for (const [x, y, s] of clouds) {
      const g = this.add.graphics();
      g.setDepth(-1200);
      g.fillStyle(0xffffff, 0.85);
      g.fillCircle(x, y, 20 * s);
      g.fillCircle(x + 24 * s, y + 4 * s, 15 * s);
      g.fillCircle(x - 23 * s, y + 5 * s, 13 * s);
      g.fillRoundedRect(x - 28 * s, y, 56 * s, 16 * s, 8 * s);
      this.tweens.add({
        targets: g,
        x: 16,
        duration: 7000 + s * 4000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // Mjuk grön platta under butiken så den inte svävar i himlen.
    const centre = isoToScreen(GRID_W / 2, GRID_H / 2);
    const ground = this.add.graphics();
    ground.setDepth(-1100);
    ground.fillStyle(0x9ccc65, 1);
    ground.fillEllipse(centre.x, centre.y + 30, 860, 500);
    ground.fillStyle(0xaed581, 1);
    ground.fillEllipse(centre.x, centre.y + 18, 800, 460);
  }

  private drawFloor(): void {
    for (let gx = 0; gx < GRID_W; gx++) {
      for (let gy = 0; gy < GRID_H; gy++) {
        const pos = isoToScreen(gx, gy);
        const tile = this.add.sprite(pos.x, pos.y + 16, 'tile');
        tile.setOrigin(0.5, 0.5);
        tile.setScale(INV_SCALE);
        const base = (gx + gy) % 2 === 0 ? 0xf0e7d3 : 0xe5dbc2;
        // Liten slumpvariation gör golvet levande utan att bli plottrigt.
        tile.setTint(
          Phaser.Display.Color.ValueToColor(base).darken(Phaser.Math.Between(0, 3)).color,
        );
        tile.setDepth(-1000);
      }
    }
    // Dörrmatta där kunderna kommer in
    for (const gy of [8, 9]) {
      const pos = isoToScreen(0, gy);
      const mat = this.add.sprite(pos.x, pos.y + 16, 'tile');
      mat.setOrigin(0.5, 0.5);
      mat.setScale(INV_SCALE);
      mat.setTint(0x9c786c);
      mat.setDepth(-999);
    }
  }

  /** Bakväggar längs butikens två bortre kanter, med dörröppning. */
  private drawWalls(): void {
    const g = this.add.graphics();
    g.setDepth(-960);
    const H = 46;

    // Nordöstra väggen (längs gy = 0)
    g.fillStyle(0xcabfa6, 1);
    for (let gx = 0; gx < GRID_W; gx++) {
      const p = isoToScreen(gx, 0);
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.lineTo(p.x + 32, p.y + 16);
      g.lineTo(p.x + 32, p.y + 16 - H);
      g.lineTo(p.x, p.y - H);
      g.closePath();
      g.fillPath();
    }

    // Nordvästra väggen (längs gx = 0), med lucka för dörren vid gy 8–9
    g.fillStyle(0xdcd1b6, 1);
    for (let gy = 0; gy < GRID_H; gy++) {
      if (gy >= 8) continue;
      const p = isoToScreen(0, gy);
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.lineTo(p.x - 32, p.y + 16);
      g.lineTo(p.x - 32, p.y + 16 - H);
      g.lineTo(p.x, p.y - H);
      g.closePath();
      g.fillPath();
    }

    // Takkant som knyter ihop väggarna
    g.lineStyle(3, 0xb0a488, 1);
    const nw = isoToScreen(0, 0);
    const ne = isoToScreen(GRID_W, 0);
    const w2 = isoToScreen(0, 8);
    g.beginPath();
    g.moveTo(w2.x - 32, w2.y + 16 - H);
    g.lineTo(nw.x, nw.y - H);
    g.lineTo(ne.x, ne.y - H);
    g.strokePath();

    // Fönster på nordöstra väggen (punkter längs väggens överkantslinje)
    const winA = isoToScreen(4.4, 0);
    const winB = isoToScreen(6.6, 0);
    g.fillStyle(0xbfe3ef, 1);
    g.beginPath();
    g.moveTo(winA.x, winA.y - 36);
    g.lineTo(winB.x, winB.y - 36);
    g.lineTo(winB.x, winB.y - 10);
    g.lineTo(winA.x, winA.y - 10);
    g.closePath();
    g.fillPath();
    g.lineStyle(2.5, 0x8d7558, 1);
    g.strokePath();
    const winMid = isoToScreen(5.5, 0);
    g.lineStyle(1.5, 0x8d7558, 1);
    g.beginPath();
    g.moveTo(winMid.x, winMid.y - 36);
    g.lineTo(winMid.x, winMid.y - 10);
    g.moveTo(winA.x, winA.y - 23);
    g.lineTo(winB.x, winB.y - 23);
    g.strokePath();

    // Dörrpost vid väggöppningens kant
    g.fillStyle(0x8d7558, 1);
    const post = isoToScreen(0, 8);
    g.fillRect(post.x - 34, post.y + 16 - H - 3, 5, H + 6);
  }

  /** Dekor: krukväxter och en entréskylt. */
  private placeProps(): void {
    const spots: [number, number][] = [
      [9.3, 0.6],
      [0.55, 6.6],
      [9.4, 8.6],
    ];
    for (const [gx, gy] of spots) {
      const p = isoToScreen(gx, gy);
      const plant = this.add.sprite(p.x, p.y, 'plant').setOrigin(0.5, 1).setScale(INV_SCALE);
      plant.setDepth(p.y);
      const shadow = this.add.sprite(p.x, p.y + 1, 'shadow').setAlpha(0.2).setScale(INV_SCALE);
      shadow.setDepth(p.y - 1);
    }

    const door = isoToScreen(0, 9);
    this.add
      .text(door.x - 34, door.y - 58, '🛒 Entré', {
        fontFamily: '"Baloo 2", sans-serif',
        fontSize: '12px',
        color: '#fff8e1',
        backgroundColor: '#6d4c41',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5)
      .setDepth(-940)
      .setAngle(-2);
  }

  /** Myntregn vid en lyckad försäljning. */
  private coinBurst(x: number, y: number): void {
    const particles = this.add.particles(x, y, 'coin', {
      speed: { min: 90, max: 190 },
      angle: { min: 230, max: 310 },
      gravityY: 520,
      lifespan: 650,
      scale: { start: INV_SCALE, end: 0.4 * INV_SCALE },
      emitting: false,
    });
    particles.setDepth(9600);
    particles.explode(12);
    this.time.delayedCall(900, () => particles.destroy());
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
      this.floatText(shelf.x, shelf.y - 60, 'Lagret är tomt!', '#e53935');
      return;
    }
    this.manager.busy = true;
    this.showProgress(shelf.x, shelf.y - 60, this.upgrades.restockTimeMs, () => {
      const units = Math.min(shelf.missingUnits, this.state.storage[shelf.product.id] ?? 0);
      this.state.storage[shelf.product.id] -= units;
      shelf.addStock(units);
      this.floatText(shelf.x, shelf.y - 60, `+${units} ${shelf.product.name}`, '#43a047');
      sfx.pop();
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
      this.floatText(this.checkout.x, this.checkout.y - 64, `+${total} kr`, '#43a047');
      this.coinBurst(this.checkout.x, this.checkout.y - 50);
      sfx.chaChing();
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
      this.floatText(desk.x, desk.y - 64, `+${fee} kr`, '#43a047');
      this.coinBurst(desk.x, desk.y - 50);
      sfx.chaChing();
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
        fontFamily: '"Baloo 2", sans-serif',
        fontSize: '16px',
        color,
        fontStyle: 'bold',
        stroke: '#ffffff',
        strokeThickness: 3.5,
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
