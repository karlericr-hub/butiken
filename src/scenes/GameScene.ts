import Phaser from 'phaser';
import { createInitialState, isProductUnlocked, type GameState } from '../state/GameState';
import { PRODUCTS } from '../config/products';
import { BALANCE } from '../config/balance';
import { isoToScreen, screenToIso, GRID_W, GRID_H } from '../utils/iso';
import { INV_SCALE, RENDER_SCALE, VIEW_W, VIEW_H, setupHiResCamera } from '../utils/scale';
import { PALETTE, DEPTH, TEXT, css, darken, lighten, mix } from '../config/theme';
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
  /** Sant så fort dagen avslutats, så att scenbytet bara startas en gång. */
  private dayEnded = false;
  private customersSentHome = false;
  private paymentBusy = false;
  private parcelBusy = false;
  /** Klickzoner för stationerna (i rutnätskoordinater) med tillhörande handling. */
  private interactables: { gx: number; gy: number; act: () => void }[] = [];
  /** Heltäckande lager som färgar om scenen efter tid på dygnet. */
  private daylight?: Phaser.GameObjects.Rectangle;
  /** Additiva ljusfläckar på golvet framför fönstren. */
  private lightPools: Phaser.GameObjects.Sprite[] = [];
  /** Återanvända partikelutsläpp – billigare än att skapa nya vid varje effekt. */
  private emitters: Record<string, Phaser.GameObjects.Particles.ParticleEmitter> = {};

  constructor() {
    super('Game');
  }

  create(): void {
    this.shelves.clear();
    this.delivery = undefined;
    this.parcelDesk = undefined;
    this.closingHandled = false;
    this.dayEnded = false;
    this.customersSentHome = false;
    this.paymentBusy = false;
    this.parcelBusy = false;
    this.interactables = [];
    this.lightPools = [];
    this.emitters = {};
    this.daylight = undefined;

    setupHiResCamera(this);
    this.cameras.main.fadeIn(420, 255, 250, 240);

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
      // Markeringsruta framför hyllan (rent visuell) + klickzon.
      new InteractionMarker(this, pos.gx, pos.gy + 1);
      // Klickzon mellan hyllan och rutan – klick på hyllan, rutan eller nära räcker.
      this.interactables.push({ gx: pos.gx, gy: pos.gy + 0.5, act: () => this.onShelfClicked(shelf) });
      this.shelves.set(product.id, shelf);
    }

    this.checkout = new Checkout(this, 7, 6, this.upgrades.maxQueueLength);
    new InteractionMarker(this, this.checkout.gridX + 1, this.checkout.gridY, 0x64b5f6);
    this.interactables.push({
      gx: this.checkout.gridX + 0.5,
      gy: this.checkout.gridY,
      act: () => this.onCheckoutClicked(),
    });

    if (this.state.isParcelAgent) {
      this.parcelDesk = new ParcelDesk(this, 8, 3, BALANCE.parcelQueueMax);
      new InteractionMarker(this, this.parcelDesk.gridX + 1, this.parcelDesk.gridY, 0x64b5f6);
      this.interactables.push({
        gx: this.parcelDesk.gridX + 0.5,
        gy: this.parcelDesk.gridY,
        act: () => this.onParcelDeskClicked(),
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

    this.drawLighting();
    this.createEmitters();

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
        this.clickRipple(target.x, target.y + 16);
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
    this.updateDaylight();
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
    // handleClosing() anropas varje bildruta. Utan spärr skulle uttoningen
    // startas om om och om igen och därmed aldrig hinna bli klar.
    if (this.dayEnded) return;
    this.dayEnded = true;

    // Ej upplastad leverans bärs in i lagret automatiskt vid stängning.
    if (this.delivery) {
      this.storeDeliveryContents(this.delivery.contents);
      this.delivery.destroy();
      this.delivery = undefined;
    }
    this.difficulty.adjustAfterDay();
    // Mjuk övergång till kvällspanelen istället för ett hårt klipp.
    this.cameras.main.fadeOut(380, 255, 250, 240);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Evening'));
  }

  /** Vänlig hint från det adaptiva svårighetssystemet. */
  private showPendingHint(): void {
    const hint = this.state.pendingHint;
    if (!hint) return;
    this.state.pendingHint = undefined;
    const banner = this.add
      .text(
        VIEW_W / 2,
        84,
        hint,
        TEXT.body({
          fontSize: '17px',
          color: css(PALETTE.text.onDark),
          backgroundColor: css(PALETTE.warning.deep),
          padding: { x: 14, y: 8 },
        }),
      )
      .setOrigin(0.5, 0)
      .setDepth(DEPTH.hudText + 2);
    // Glider in uppifrån istället för att bara dyka upp.
    banner.setY(56).setAlpha(0);
    this.tweens.add({ targets: banner, y: 84, alpha: 1, duration: 380, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: banner,
      alpha: 0,
      delay: 6000,
      duration: 800,
      onComplete: () => banner.destroy(),
    });
  }

  private showClosedBanner(): void {
    const banner = this.add
      .text(
        VIEW_W / 2,
        76,
        'STÄNGT – sista kunderna betjänas',
        TEXT.heading({
          fontSize: '22px',
          color: css(PALETTE.accent.deep),
          stroke: css(PALETTE.panel.edge),
          strokeThickness: 5,
        }),
      )
      .setOrigin(0.5, 0)
      .setDepth(DEPTH.hudText + 1);
    banner.setScale(0.6).setAlpha(0);
    this.tweens.add({
      targets: banner,
      scale: 1,
      alpha: 1,
      duration: 460,
      ease: 'Back.easeOut',
    });
    // Konfetti över hela skärmen när dagen är slut.
    this.burst('confetti', VIEW_W * 0.3, 60, 26);
    this.burst('confetti', VIEW_W * 0.7, 60, 26);
  }

  // --- Leverans ---

  private scheduleDelivery(): void {
    const order = this.state.pendingOrder;
    if (Object.values(order).every((n) => !n)) return;
    this.time.delayedCall(BALANCE.dayDurationMs * BALANCE.deliveryArrivalFraction, () => {
      this.delivery = new Delivery(this, 1, 7, order);
      this.delivery.on('pointerdown', () => this.onDeliveryClicked());
      this.state.pendingOrder = {};
      this.floatText(
        this.delivery.x,
        this.delivery.y - 70,
        'Varor har kommit!',
        css(PALETTE.warning.deep),
      );
      sfx.ding();
      this.delivery.setScale(0);
      this.tweens.add({
        targets: this.delivery,
        scale: 1,
        duration: 400,
        ease: 'Back.easeOut',
        onComplete: () => {
          // Dammring och en liten stöt när pallen slår i golvet.
          if (!this.delivery) return;
          this.burst('dust', this.delivery.x, this.delivery.y, 16);
          this.cameras.main.shake(180, 0.002);
        },
      });
    });
  }

  private onDeliveryClicked(): void {
    const delivery = this.delivery;
    if (!delivery || this.manager.busy) return;
    const spot = delivery.standPoint;
    this.manager.walkTo(spot.x, spot.y, () => {
      if (!this.delivery) return;
      this.manager.busy = true;
      this.manager.startReaching();
      this.showProgress(delivery.x, delivery.y - 64, BALANCE.unloadTimeMs, () => {
        this.storeDeliveryContents(delivery.contents);
        this.floatText(
          delivery.x,
          delivery.y - 64,
          'Inlastat i lagret!',
          css(PALETTE.success.base),
        );
        this.burst('sparkle', delivery.x, delivery.y - 30, 12);
        sfx.pop();
        delivery.destroy();
        this.delivery = undefined;
        this.manager.stopReaching();
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

  /** Himmel, fjärran kvarter, moln och gräsplätten som butiken står på. */
  private drawBackdrop(): void {
    // Himmel med mjuk vertikal gradient.
    const sky = this.add.graphics().setDepth(DEPTH.sky);
    sky.fillGradientStyle(
      PALETTE.sky.high,
      PALETTE.sky.high,
      PALETTE.sky.low,
      PALETTE.sky.low,
      1,
    );
    sky.fillRect(0, 0, VIEW_W, VIEW_H);

    this.drawSkyline();

    const clouds: [number, number, number][] = [
      [120, 120, 0.9],
      [430, 88, 0.65],
      [840, 140, 0.8],
      [180, 560, 0.7],
      [790, 590, 0.85],
    ];
    for (const [x, y, s] of clouds) {
      // Molnet är en färdig textur. Ritat som sju överlappande former per moln
      // och bildruta kostade både tessellering och fyllnadsgrad i onödan.
      const cloud = this.add
        .image(x, y, 'cloud')
        .setScale(INV_SCALE * s)
        .setDepth(DEPTH.clouds);
      this.tweens.add({
        targets: cloud,
        x: x + 16,
        duration: 7000 + s * 4000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    this.drawBirds();
    this.drawGround();
  }

  /**
   * Gräsplätten, gångvägen och kontaktskuggan under butiken.
   *
   * Bakas till en textur första gången scenen byggs. Som Graphics skulle de
   * stora, överlappande ellipserna tessellieras och fyllas om varje bildruta;
   * som textur blir det ett enda ritpass.
   */
  private drawGround(): void {
    const centre = isoToScreen(GRID_W / 2, GRID_H / 2);
    const KEY = 'bakedGround';
    if (!this.textures.exists(KEY)) {
      const g = this.make.graphics({}, false);
      g.fillStyle(PALETTE.grass.dark, 1);
      g.fillEllipse(centre.x, centre.y + 34, 880, 512);
      g.fillStyle(PALETTE.grass.base, 1);
      g.fillEllipse(centre.x, centre.y + 24, 852, 494);
      g.fillStyle(PALETTE.grass.light, 1);
      g.fillEllipse(centre.x, centre.y + 14, 800, 460);
      // Grästuvor i kanten bryter upp den perfekta ellipsen.
      g.fillStyle(PALETTE.grass.base, 0.85);
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2;
        const rx = 400 + Phaser.Math.Between(-10, 22);
        const ry = 230 + Phaser.Math.Between(-8, 16);
        g.fillEllipse(
          centre.x + Math.cos(a) * rx,
          centre.y + 18 + Math.sin(a) * ry,
          Phaser.Math.Between(26, 54),
          Phaser.Math.Between(12, 22),
        );
      }
      // Gångväg ut från entrén, så att butiken hör ihop med omvärlden.
      g.fillStyle(mix(PALETTE.floor.b, PALETTE.grass.dark, 0.18), 1);
      for (let i = 0; i < 7; i++) {
        const p = isoToScreen(-1.1 - i * 0.85, 8.6 + i * 0.12);
        g.fillEllipse(p.x, p.y + 16, 54 - i * 2.5, 27 - i * 1.2);
      }
      g.generateTexture(KEY, VIEW_W, VIEW_H);
      g.destroy();
    }
    this.add.image(0, 0, KEY).setOrigin(0, 0).setDepth(DEPTH.ground);

    // Bred kontaktskugga som binder ihop butiken med marken.
    const contact = this.add.sprite(centre.x, centre.y + 46, 'shadowL');
    contact.setDepth(DEPTH.ground + 2);
    contact.setScale(INV_SCALE * 9, INV_SCALE * 7);
    contact.setAlpha(0.16);
  }

  /** Fjärran husrad bakom butiken – ger djup utan att stjäla uppmärksamhet. */
  private drawSkyline(): void {
    const KEY = 'bakedSkyline';
    const baseY = 300;
    if (!this.textures.exists(KEY)) {
      const g = this.make.graphics({}, false);
      // Kvarteret ska bara antydas – håll kontrasten mot himlen mycket låg,
      // annars konkurrerar bakgrunden med butiken.
      const far = mix(PALETTE.sky.low, PALETTE.grass.dark, 0.22);
      const roof = mix(far, PALETTE.wood.deep, 0.22);
      let x = -40;
      while (x < VIEW_W + 60) {
        const w = Phaser.Math.Between(44, 84);
        const h = Phaser.Math.Between(34, 74);
        g.fillStyle(far, 0.3);
        g.fillRect(x, baseY - h, w, h);
        g.fillStyle(roof, 0.28);
        g.fillTriangle(x - 5, baseY - h, x + w / 2, baseY - h - 18, x + w + 5, baseY - h);
        x += w + Phaser.Math.Between(12, 40);
      }
      // Trädrad framför husen.
      g.fillStyle(mix(PALETTE.grass.dark, PALETTE.sky.low, 0.45), 0.32);
      for (let tx = -20; tx < VIEW_W + 40; tx += Phaser.Math.Between(52, 104)) {
        const r = Phaser.Math.Between(13, 21);
        g.fillCircle(tx, baseY - 6 - r * 0.6, r);
        g.fillRect(tx - 2.5, baseY - 12 - r * 0.6, 5, r + 12);
      }
      g.generateTexture(KEY, VIEW_W, baseY + 6);
      g.destroy();
    }
    this.add.image(0, 0, KEY).setOrigin(0, 0).setDepth(DEPTH.farParallax);
  }

  /** Ett par fåglar som seglar över himlen. */
  private drawBirds(): void {
    for (let i = 0; i < 3; i++) {
      const g = this.add.graphics().setDepth(DEPTH.clouds + 1);
      g.lineStyle(1.6, 0x6d7f8a, 0.5);
      g.beginPath();
      g.moveTo(-6, 0);
      g.lineTo(0, -3.5);
      g.lineTo(6, 0);
      g.strokePath();
      g.setPosition(-60, 70 + i * 26);
      this.tweens.add({
        targets: g,
        x: VIEW_W + 80,
        y: `+=${Phaser.Math.Between(-18, 18)}`,
        duration: 22000 + i * 5000,
        delay: i * 4200,
        repeat: -1,
        ease: 'Linear',
      });
    }
  }

  private drawFloor(): void {
    const centre = { gx: (GRID_W - 1) / 2, gy: (GRID_H - 1) / 2 };
    for (let gx = 0; gx < GRID_W; gx++) {
      for (let gy = 0; gy < GRID_H; gy++) {
        const pos = isoToScreen(gx, gy);
        const tile = this.add.sprite(pos.x, pos.y + 16, 'tile');
        tile.setOrigin(0.5, 0.5);
        tile.setScale(INV_SCALE);
        const base = (gx + gy) % 2 === 0 ? PALETTE.floor.a : PALETTE.floor.b;
        // Golvet är ljusast i mitten av butiken och mörknar mot hörnen, vilket
        // ger rummet en mjuk ljussättning utan riktiga ljuskällor.
        const dist = Math.hypot(gx - centre.gx, gy - centre.gy) / 6.4;
        const shaded = darken(base, Math.round(dist * 4) + Phaser.Math.Between(0, 2));
        tile.setTint(shaded);
        tile.setDepth(DEPTH.floor);
      }
    }

    // Matta i mitten av butiken – en 2×2-yta som värmer upp golvet.
    for (const [gx, gy] of [
      [4, 5],
      [5, 5],
      [4, 6],
      [5, 6],
    ] as [number, number][]) {
      const pos = isoToScreen(gx, gy);
      const rug = this.add.sprite(pos.x, pos.y + 16, 'tile');
      rug.setOrigin(0.5, 0.5).setScale(INV_SCALE).setDepth(DEPTH.floorDecal);
      rug.setTint(PALETTE.floor.rug).setAlpha(0.22);
    }

    // Dörrmatta där kunderna kommer in
    for (const gy of [8, 9]) {
      const pos = isoToScreen(0, gy);
      const mat = this.add.sprite(pos.x, pos.y + 16, 'tile');
      mat.setOrigin(0.5, 0.5);
      mat.setScale(INV_SCALE);
      mat.setTint(PALETTE.floor.mat);
      mat.setDepth(DEPTH.floorDecal);
    }
  }

  /** Bakväggar längs butikens två bortre kanter, med dörröppning. */
  private drawWalls(): void {
    const g = this.add.graphics();
    g.setDepth(DEPTH.walls);
    const H = 62;
    const SKIRT = 6;

    /**
     * En vägglöpa ritas som ett fåtal hela band längs hela väggen, inte som
     * band per rutnätskolumn. Det ger samma gradient till en bråkdel av
     * ritkostnaden – Phaser tessellierar om varje Graphics-yta varje bildruta.
     */
    const wallRun = (
      from: { x: number; y: number },
      to: { x: number; y: number },
      dx: number,
      top: number,
      bottom: number,
    ): void => {
      const bands = 5;
      for (let b = 0; b < bands; b++) {
        const t0 = b / bands;
        const t1 = (b + 1) / bands;
        g.fillStyle(mix(top, bottom, t0), 1);
        g.beginPath();
        g.moveTo(from.x, from.y - H * (1 - t0));
        g.lineTo(to.x + dx, to.y + 16 - H * (1 - t0));
        g.lineTo(to.x + dx, to.y + 16 - H * (1 - t1));
        g.lineTo(from.x, from.y - H * (1 - t1));
        g.closePath();
        g.fillPath();
      }
      // Golvlist
      g.fillStyle(PALETTE.wall.skirting, 1);
      g.beginPath();
      g.moveTo(from.x, from.y - SKIRT);
      g.lineTo(to.x + dx, to.y + 16 - SKIRT);
      g.lineTo(to.x + dx, to.y + 16);
      g.lineTo(from.x, from.y);
      g.closePath();
      g.fillPath();
    };

    // Nordöstra väggen (längs gy = 0) – mörkare eftersom den vetter från ljuset.
    wallRun(
      isoToScreen(0, 0),
      isoToScreen(GRID_W - 1, 0),
      32,
      lighten(PALETTE.wall.far, 6),
      darken(PALETTE.wall.far, 8),
    );

    // Nordvästra väggen (längs gx = 0), med lucka för dörren vid gy 8–9
    wallRun(
      isoToScreen(0, 0),
      isoToScreen(0, 7),
      -32,
      lighten(PALETTE.wall.near, 5),
      darken(PALETTE.wall.near, 7),
    );

    const nw = isoToScreen(0, 0);
    const ne = isoToScreen(GRID_W, 0);
    const w2 = isoToScreen(0, 8);

    // Tapetrand i ögonhöjd längs båda väggarna.
    g.lineStyle(4, PALETTE.wall.stripe, 0.75);
    g.beginPath();
    g.moveTo(w2.x - 32, w2.y + 16 - H + 22);
    g.lineTo(nw.x, nw.y - H + 22);
    g.lineTo(ne.x, ne.y - H + 22);
    g.strokePath();

    // Takkant som knyter ihop väggarna
    g.lineStyle(4, PALETTE.wall.trim, 1);
    g.beginPath();
    g.moveTo(w2.x - 32, w2.y + 16 - H);
    g.lineTo(nw.x, nw.y - H);
    g.lineTo(ne.x, ne.y - H);
    g.strokePath();
    g.lineStyle(1.5, lighten(PALETTE.wall.trim, 22), 0.9);
    g.beginPath();
    g.moveTo(w2.x - 32, w2.y + 14 - H);
    g.lineTo(nw.x, nw.y - 2 - H);
    g.lineTo(ne.x, ne.y - 2 - H);
    g.strokePath();

    // Två fönster på nordöstra väggen.
    this.drawWindow(g, 3.1, 5.3, H);
    this.drawWindow(g, 6.4, 8.6, H);

    // Dörrkarm vid väggöppningens kant
    const post = isoToScreen(0, 8);
    g.fillStyle(PALETTE.wood.dark, 1);
    g.fillRect(post.x - 35, post.y + 16 - H - 4, 6, H + 8);
    g.fillStyle(lighten(PALETTE.wood.dark, 12), 1);
    g.fillRect(post.x - 35, post.y + 16 - H - 4, 2, H + 8);

  }

  /** Ett fönster på den bortre väggen, mellan rutnätspunkterna a och b. */
  private drawWindow(
    g: Phaser.GameObjects.Graphics,
    a: number,
    b: number,
    wallHeight: number,
  ): void {
    const pa = isoToScreen(a, 0);
    const pb = isoToScreen(b, 0);
    const top = -wallHeight + 14;
    const bottom = -wallHeight + 46;
    const frame = (inset: number, y0: number, y1: number): void => {
      g.beginPath();
      g.moveTo(pa.x + inset, pa.y + y0 + inset * 0.5);
      g.lineTo(pb.x - inset, pb.y + y0 - inset * 0.5);
      g.lineTo(pb.x - inset, pb.y + y1 - inset * 0.5);
      g.lineTo(pa.x + inset, pa.y + y1 + inset * 0.5);
      g.closePath();
    };
    // Karm
    g.fillStyle(PALETTE.wood.dark, 1);
    frame(-3, top - 3, bottom + 3);
    g.fillPath();
    // Glas med dager uppifrån
    g.fillStyle(PALETTE.glass, 1);
    frame(0, top, bottom);
    g.fillPath();
    g.fillStyle(0xffffff, 0.5);
    frame(0, top, top + (bottom - top) * 0.42);
    g.fillPath();
    // Spröjs
    g.lineStyle(2, PALETTE.wood.dark, 1);
    const mid = isoToScreen((a + b) / 2, 0);
    g.beginPath();
    g.moveTo(mid.x, mid.y + top);
    g.lineTo(mid.x, mid.y + bottom);
    g.moveTo(pa.x, pa.y + (top + bottom) / 2);
    g.lineTo(pb.x, pb.y + (top + bottom) / 2);
    g.strokePath();
    g.lineStyle(2.5, PALETTE.wood.dark, 1);
    frame(0, top, bottom);
    g.strokePath();

    // Ljuspöl på golvet snett framför fönstret – ljuset faller in i rummet,
    // så pölen läggs ut i rutnätet i stället för i skärmkoordinater.
    const poolPos = isoToScreen((a + b) / 2 + 0.9, 1.4);
    const pool = this.add.sprite(poolPos.x, poolPos.y + 16, 'lightPool');
    pool.setDepth(DEPTH.lightPool);
    pool.setScale(INV_SCALE * 2.4, INV_SCALE * 2.4);
    pool.setBlendMode(Phaser.BlendModes.ADD);
    pool.setTint(0xfff0c4);
    this.lightPools.push(pool);
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
      const shadow = this.add.sprite(p.x, p.y + 1, 'shadow').setAlpha(0.24).setScale(INV_SCALE);
      shadow.setDepth(p.y - 1);
      // Växterna vajar svagt så att rummet aldrig står helt stilla.
      this.tweens.add({
        targets: plant,
        angle: Phaser.Math.Between(-2, -1),
        duration: Phaser.Math.Between(2600, 3800),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    this.drawEntranceSign();
  }

  /**
   * Skylten hänger över dörröppningen. Den byggs som en container så att
   * bricka, kundvagn och text alltid följs åt.
   */
  private drawEntranceSign(): void {
    const door = isoToScreen(0, 8.6);
    const w = 92;
    const h = 30;
    const sign = this.add.container(door.x - 40, door.y - 74).setDepth(DEPTH.signage);

    const board = this.add.graphics();
    board.fillStyle(PALETTE.wood.deep, 0.22);
    board.fillRoundedRect(-w / 2 + 2, -h / 2 + 3, w, h, 8);
    // Gräddvit bricka med bärnstenskant – kundvagnen får behålla sina egna
    // färger istället för att tintas bort mot en färgad botten.
    board.fillStyle(PALETTE.panel.card, 1);
    board.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    board.lineStyle(3, PALETTE.accent.base, 1);
    board.strokeRoundedRect(-w / 2 + 1.5, -h / 2 + 1.5, w - 3, h - 3, 7);
    sign.add(board);

    const cart = this.add.sprite(-24, 0, 'iconCart').setScale(INV_SCALE * 0.55);
    sign.add(cart);

    const text = this.add
      .text(
        12,
        0,
        'Entré',
        TEXT.label({ fontSize: '15px', color: css(PALETTE.accent.deep), fontStyle: 'bold' }),
      )
      .setOrigin(0.5);
    sign.add(text);

    // Skylten gungar mycket svagt, som om den hänger i två kedjor.
    sign.setAngle(-1.5);
    this.tweens.add({
      targets: sign,
      angle: 1.5,
      duration: 3400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /**
   * Dagsljuslager och vinjett. Overlayn tintas om under dagens gång så att
   * morgon, middag och kväll känns olika utan att något ritas om.
   */
  private drawLighting(): void {
    this.daylight = this.add
      .rectangle(0, 0, VIEW_W, VIEW_H, 0xffffff, 0)
      .setOrigin(0, 0)
      .setDepth(DEPTH.daylight)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);

    // Vinjett: fyrtio genomskinliga kantband skulle betyda fyrtio ritpass över
    // halva skärmen varje bildruta. Bakad till en textur blir det ett pass.
    const KEY = 'bakedVignette';
    if (!this.textures.exists(KEY)) {
      const v = this.make.graphics({}, false);
      const steps = 10;
      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const a = 0.035 * (1 - t);
        const inset = t * 70;
        v.fillStyle(0x3b2a1a, a);
        v.fillRect(0, inset, VIEW_W, 7);
        v.fillRect(0, VIEW_H - inset - 7, VIEW_W, 7);
        v.fillRect(inset, 0, 7, VIEW_H);
        v.fillRect(VIEW_W - inset - 7, 0, 7, VIEW_H);
      }
      v.generateTexture(KEY, VIEW_W, VIEW_H);
      v.destroy();
    }
    this.add.image(0, 0, KEY).setOrigin(0, 0).setDepth(DEPTH.vignette);
  }

  /**
   * Dagens ljus: sval morgon → neutral middag → varm eftermiddag → gyllene
   * kväll. Ljuspölarna från fönstren följer med och bleknar mot stängning.
   */
  private updateDaylight(): void {
    if (!this.daylight) return;
    const p = this.timeSystem.progress;
    let tint: number;
    let strength: number;
    if (p < 0.3) {
      const t = p / 0.3;
      tint = mix(0xd7e6ff, 0xffffff, t); // sval morgon
      strength = 0.26 * (1 - t);
    } else if (p < 0.62) {
      const t = (p - 0.3) / 0.32;
      tint = mix(0xffffff, 0xfff2dc, t); // middag → eftermiddag
      strength = 0.12 * t;
    } else {
      const t = (p - 0.62) / 0.38;
      tint = mix(0xfff2dc, 0xf6c79a, t); // gyllene kväll
      strength = 0.12 + 0.34 * t;
    }
    this.daylight.setFillStyle(tint, strength);

    // Fönsterljuset är starkast mitt på dagen.
    const poolAlpha = 0.35 + Math.sin(Math.PI * Phaser.Math.Clamp(p, 0, 1)) * 0.55;
    for (const pool of this.lightPools) pool.setAlpha(poolAlpha);
  }

  /**
   * Alla partikeleffekter delar på ett fåtal utsläpp som skapas en gång och
   * sedan bara flyttas och skjuts av. Att skapa ett nytt utsläpp per effekt
   * kostar mycket mer och gav märkbara hack vid många försäljningar.
   */
  private createEmitters(): void {
    this.emitters.coin = this.add
      .particles(0, 0, 'coin', {
        speed: { min: 90, max: 190 },
        angle: { min: 230, max: 310 },
        gravityY: 520,
        lifespan: 650,
        rotate: { start: 0, end: 220 },
        scale: { start: INV_SCALE, end: 0.4 * INV_SCALE },
        emitting: false,
      })
      .setDepth(DEPTH.particles);

    this.emitters.sparkle = this.add
      .particles(0, 0, 'sparkle', {
        speed: { min: 20, max: 70 },
        angle: { min: 250, max: 290 },
        gravityY: -30,
        lifespan: 750,
        alpha: { start: 1, end: 0 },
        scale: { start: INV_SCALE * 0.9, end: 0 },
        tint: [PALETTE.accent.light, 0xffffff, PALETTE.success.light],
        emitting: false,
      })
      .setDepth(DEPTH.particles);

    this.emitters.dust = this.add
      .particles(0, 0, 'dust', {
        speed: { min: 40, max: 110 },
        angle: { min: 0, max: 360 },
        lifespan: 620,
        alpha: { start: 0.55, end: 0 },
        scale: { start: INV_SCALE * 0.5, end: INV_SCALE * 1.6 },
        tint: PALETTE.floor.grout,
        emitting: false,
      })
      .setDepth(DEPTH.particles);

    this.emitters.confetti = this.add
      .particles(0, 0, 'confetti', {
        speed: { min: 120, max: 320 },
        angle: { min: 200, max: 340 },
        gravityY: 420,
        lifespan: 2200,
        rotate: { start: 0, end: 720 },
        scale: INV_SCALE,
        tint: [
          PALETTE.accent.base,
          PALETTE.success.light,
          PALETTE.danger.light,
          PALETTE.mood[1],
          0x64b5f6,
        ],
        emitting: false,
      })
      .setDepth(DEPTH.particles);
  }

  private burst(key: string, x: number, y: number, count: number): void {
    const emitter = this.emitters[key];
    if (!emitter) return;
    emitter.setPosition(x, y);
    emitter.explode(count);
  }

  /** Myntregn vid en lyckad försäljning. */
  private coinBurst(x: number, y: number): void {
    this.burst('coin', x, y, 12);
  }

  /** Kort, mjuk kamerastöt som ger tyngd åt en händelse. */
  private punch(strength = 0.004): void {
    const cam = this.cameras.main;
    this.tweens.add({
      targets: cam,
      zoom: RENDER_SCALE * (1 + strength),
      duration: 90,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
  }

  /** Ring som pulsar ut där spelaren klickade på golvet. */
  private clickRipple(x: number, y: number): void {
    const ring = this.add
      .sprite(x, y, 'ring')
      .setScale(INV_SCALE * 0.35)
      .setAlpha(0.85)
      .setDepth(DEPTH.marker + 1);
    ring.setTint(PALETTE.accent.light);
    this.tweens.add({
      targets: ring,
      scaleX: INV_SCALE * 1.1,
      scaleY: INV_SCALE * 1.1,
      alpha: 0,
      duration: 420,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });
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
      this.floatText(shelf.x, shelf.y - 60, `+${units} ${shelf.product.name}`, css(PALETTE.success.base));
      this.burst('sparkle', shelf.x, shelf.y - 30, 14);
      shelf.celebrate();
      sfx.pop();
      this.manager.stopReaching();
      this.manager.busy = false;
    });
    this.manager.startReaching();
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
    const server = cashier ?? this.manager;
    server.startReaching();
    this.showProgress(this.checkout.x, this.checkout.y - 64, this.upgrades.payTimeMs, () => {
      const total = this.economy.sell(customer.basket);
      this.floatText(
        this.checkout.x,
        this.checkout.y - 64,
        `+${total} kr`,
        css(PALETTE.success.base),
      );
      this.coinBurst(this.checkout.x, this.checkout.y - 50);
      this.checkout.flash();
      this.punch();
      sfx.chaChing();
      server.stopReaching();
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

  /** Rundad förloppsindikator som ljusnar mot slutet av handlingen. */
  showProgress(x: number, y: number, durationMs: number, onDone: () => void): void {
    const g = this.add.graphics();
    g.setDepth(DEPTH.progress);
    const progress = { p: 0 };
    this.tweens.add({
      targets: progress,
      p: 1,
      duration: durationMs,
      onUpdate: () => {
        g.clear();
        // Skål
        g.fillStyle(PALETTE.metal.darker, 0.28);
        g.fillRoundedRect(x - 27, y + 1, 54, 10, 5);
        g.fillStyle(PALETTE.panel.card, 0.92);
        g.fillRoundedRect(x - 26, y, 52, 9, 4.5);
        // Fyllning: grön som växlar mot bärnsten när den närmar sig klart.
        const fill = mix(PALETTE.success.light, PALETTE.accent.light, progress.p);
        const w = 48 * progress.p;
        if (w > 1) {
          g.fillStyle(fill, 1);
          g.fillRoundedRect(x - 24, y + 2, w, 5, 2.5);
          g.fillStyle(0xffffff, 0.35);
          g.fillRoundedRect(x - 24, y + 2, w, 2, 1);
        }
      },
      onComplete: () => {
        g.destroy();
        onDone();
      },
    });
  }

  floatText(x: number, y: number, text: string, color: string): void {
    const t = this.add
      .text(
        x,
        y,
        text,
        TEXT.body({
          fontSize: '16px',
          color,
          fontStyle: 'bold',
          stroke: css(PALETTE.panel.edge),
          strokeThickness: 3.5,
        }),
      )
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.floatText);
    // Poppar fram och stiger sedan uppåt.
    t.setScale(0.6);
    this.tweens.add({ targets: t, scale: 1, duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: t,
      y: y - 40,
      alpha: 0,
      duration: 1200,
      ease: 'Cubic.easeOut',
      onComplete: () => t.destroy(),
    });
  }
}
