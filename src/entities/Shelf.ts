import Phaser from 'phaser';
import type { Product } from '../state/GameState';
import { isoToScreen, screenToIso, TILE_W, TILE_H } from '../utils/iso';
import { INV_SCALE } from '../utils/scale';
import { PRODUCT_COLORS } from '../config/products';
import { sfx } from '../systems/Sfx';
import { PALETTE, TEXT, css, darken, mix } from '../config/theme';

/** Positioner för varulådorna på hylltoppen (lokala koordinater). */
const MINI_POSITIONS: [number, number][] = [
  [-16, -34],
  [0, -34],
  [16, -34],
  [-8, -27],
  [8, -27],
  [-24, -27],
];

/** Storleken på en låda på en dubbelhylla jämfört med en enkellåda. */
const DOUBLE_SCALE = 0.72;
/**
 * De två lådorna förskjuts ett halvt (nedskalat) cellsteg åt var sitt håll
 * längs den isometriska gx-axeln, så att lådornas toppar tessellerar precis
 * som två grannplattor i stället för att flyta bredvid varandra.
 */
const BOX_STEP_X = (TILE_W / 2) * DOUBLE_SCALE * 0.5;
const BOX_STEP_Y = (TILE_H / 2) * DOUBLE_SCALE * 0.5;

/** En enskild låda på hyllan – egen kub, mätare och varupuckar. */
interface Box {
  /** Kubens lokala förskjutning i containern (skärm-px). */
  localX: number;
  localY: number;
  /** Skalfaktor jämfört med en enkellåda (mindre när hyllan har två lådor). */
  scale: number;
  cube: Phaser.GameObjects.Sprite;
  minis: Phaser.GameObjects.Sprite[];
  /** Mätarens mått: mittpunkt, topp-y och bredd. */
  barCx: number;
  barTopY: number;
  barW: number;
  alertY: number;
  emptyAlert?: Phaser.GameObjects.Text;
  alertTween?: Phaser.Tweens.Tween;
}

/**
 * En hylla som håller en varutyp. Normalt är hyllan en enda låda, men med
 * uppgraderingen "Större hyllor" delas den i två lådor som fylls på var för
 * sig. Kunderna plockar automatiskt från den låda som har varor kvar.
 */
export class Shelf extends Phaser.GameObjects.Container {
  readonly product: Product;
  readonly binCount: number;
  readonly gridX: number;
  readonly gridY: number;
  private boxes: Box[] = [];
  private bar: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    gridX: number,
    gridY: number,
    product: Product,
    binCount = 1,
  ) {
    const pos = isoToScreen(gridX, gridY);
    super(scene, pos.x, pos.y);
    this.product = product;
    this.gridX = gridX;
    this.gridY = gridY;
    this.binCount = Math.max(1, binCount);

    this.reconcileBins();

    // Mjuk kontaktskugga så att hyllan står på golvet i stället för att sväva.
    const shadow = scene.add.sprite(0, 16, 'shadowM');
    shadow.setScale(INV_SCALE * (this.binCount > 1 ? 1.4 : 1.2), INV_SCALE * 1.1);
    shadow.setAlpha(0.3);
    this.add(shadow);

    const tint = PRODUCT_COLORS[product.id] ?? 0xcccccc;
    const single = this.binCount === 1;
    const scale = single ? 1 : DOUBLE_SCALE;
    // Lådorna byggs bakifrån och fram (uppe-vänster → nere-höger) så att den
    // främre lådan hamnar överst i ritordningen.
    for (let i = 0; i < this.binCount; i++) {
      const step = single ? 0 : i === 0 ? -1 : 1;
      const localX = step * BOX_STEP_X;
      const localY = step * BOX_STEP_Y;

      const cube = scene.add.sprite(localX, localY, 'shelfCube');
      cube.setOrigin(0.5, 40 / 60);
      cube.setScale(INV_SCALE * scale);
      this.add(cube);

      const minis: Phaser.GameObjects.Sprite[] = [];
      MINI_POSITIONS.forEach(([mx, my], m) => {
        const mini = scene.add.sprite(localX + mx * scale, localY + my * scale, 'mini');
        mini.setScale(INV_SCALE * scale);
        // Lådorna längre bak är en aning mörkare – ger djup i stapeln.
        mini.setTint(m >= 3 ? darken(tint, 8) : tint);
        mini.setVisible(false);
        this.add(mini);
        minis.push(mini);
      });

      this.boxes.push({
        localX,
        localY,
        scale,
        cube,
        minis,
        barCx: localX,
        barTopY: localY + (single ? -50 : -38),
        barW: single ? 44 : 30,
        alertY: localY + (single ? -68 : -46),
      });
    }

    const label = scene.add
      .text(0, -54, product.name, TEXT.small({ fontSize: '12px', color: css(PALETTE.text.strong) }))
      .setOrigin(0.5, 1);
    this.add(label);

    this.bar = scene.add.graphics();
    this.add(this.bar);
    this.refreshVisuals();

    this.setDepth(pos.y);
    this.setSize(64, 56);
    // Klicket sker på markeringsrutan framför hyllan (InteractionMarker),
    // inte på själva hyllan.
    scene.add.existing(this);
  }

  /**
   * Säkerställer att product.binStock har rätt antal lådor. Byter antalet lådor
   * (t.ex. när "Större hyllor" precis köpts) eller äldre sparfiler utan fältet
   * genom att fördela det totala lagret jämnt över lådorna.
   */
  private reconcileBins(): void {
    const cap = this.product.shelfCapacity;
    let bins = this.product.binStock;
    if (!bins || bins.length !== this.binCount) {
      const total = bins
        ? bins.reduce((a, b) => a + b, 0)
        : this.product.currentStock;
      bins = new Array(this.binCount).fill(0);
      let remaining = Math.min(total, this.binCount * cap);
      for (let i = 0; i < this.binCount && remaining > 0; i++) {
        const put = Math.min(cap, remaining);
        bins[i] = put;
        remaining -= put;
      }
      this.product.binStock = bins;
    }
    this.syncTotal();
  }

  private get bins(): number[] {
    return this.product.binStock as number[];
  }

  private syncTotal(): void {
    this.product.currentStock = this.bins.reduce((a, b) => a + b, 0);
  }

  /** Punkten framför en viss låda där man ställer sig. */
  boxStandPoint(i: number): { x: number; y: number } {
    const front = isoToScreen(this.gridX, this.gridY + 1);
    return { x: front.x + this.boxes[i].localX, y: front.y + this.boxes[i].localY };
  }

  /** Låda i:s mittpunkt i skärmkoordinater (för flyttext och förlopp). */
  boxAnchor(i: number): { x: number; y: number } {
    return { x: this.x + this.boxes[i].localX, y: this.y + this.boxes[i].localY };
  }

  /** Rutnätskoordinat framför en låda – används för klickzon och markering. */
  boxFrontGrid(i: number): { gx: number; gy: number } {
    const front = isoToScreen(this.gridX, this.gridY + 1);
    return screenToIso(front.x + this.boxes[i].localX, front.y + this.boxes[i].localY);
  }

  /** Kunden går till den låda som har mest kvar (annars rakt framför hyllan). */
  customerStandPoint(): { x: number; y: number } {
    const i = this.fullestBox();
    if (i < 0) {
      const front = isoToScreen(this.gridX, this.gridY + 1);
      return { x: front.x, y: front.y };
    }
    return this.boxStandPoint(i);
  }

  /** Index på lådan med mest lager (>0), annars -1. */
  private fullestBox(): number {
    let best = -1;
    let bestStock = 0;
    this.bins.forEach((s, i) => {
      if (s > bestStock) {
        bestStock = s;
        best = i;
      }
    });
    return best;
  }

  get isEmpty(): boolean {
    return this.product.currentStock <= 0;
  }

  /** Totalt antal enheter som saknas över alla lådor. */
  get missingUnits(): number {
    return this.binCount * this.product.shelfCapacity - this.product.currentStock;
  }

  /** Antal enheter som saknas i en enskild låda. */
  boxMissingUnits(i: number): number {
    return this.product.shelfCapacity - this.bins[i];
  }

  /** Index på lådan som saknar mest (>0), annars -1 – för den anställda påfyllaren. */
  boxNeedingRestock(): number {
    let best = -1;
    let mostMissing = 0;
    for (let i = 0; i < this.binCount; i++) {
      const missing = this.boxMissingUnits(i);
      if (missing > mostMissing) {
        mostMissing = missing;
        best = i;
      }
    }
    return best;
  }

  /** Kund plockar en enhet från den fullaste lådan. Returnerar false om tom. */
  takeOne(): boolean {
    const i = this.fullestBox();
    if (i < 0) return false;
    this.bins[i]--;
    this.syncTotal();
    this.refreshVisuals();
    if (this.bins[i] === 0) {
      this.pulseEmpty(i);
      // Larma bara när hela hyllan är slut, så en tömd låda av två inte tjuter.
      if (this.isEmpty) sfx.alert();
    }
    return true;
  }

  /** Fyller på ett antal enheter i en låda (begränsas av lådans kapacitet). */
  addStock(i: number, units: number): void {
    this.bins[i] = Math.min(this.product.shelfCapacity, this.bins[i] + units);
    this.syncTotal();
    this.refreshVisuals();
  }

  /** Liten glädjeskutt när en låda fyllts på. */
  celebrate(i = 0): void {
    const box = this.boxes[i];
    this.scene.tweens.add({
      targets: box.cube,
      scaleY: INV_SCALE * box.scale * 1.12,
      duration: 130,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
  }

  /** Röd puls när sista varan plockats ur en låda. */
  private pulseEmpty(i: number): void {
    const cube = this.boxes[i].cube;
    cube.setTint(mix(0xffffff, PALETTE.danger.light, 0.55));
    this.scene.time.delayedCall(220, () => cube.clearTint());
  }

  private refreshVisuals(): void {
    const cap = this.product.shelfCapacity;
    this.bar.clear();
    this.boxes.forEach((box, i) => {
      const stock = this.bins[i];
      const ratio = stock / cap;
      const color =
        ratio > 0.5
          ? PALETTE.success.light
          : ratio > 0.2
            ? PALETTE.warning.base
            : PALETTE.danger.base;
      this.drawBar(box, ratio, color);

      const visibleMinis =
        stock > 0 ? Math.max(1, Math.ceil(ratio * box.minis.length)) : 0;
      box.minis.forEach((m, mi) => m.setVisible(mi < visibleMinis));

      if (stock <= 0) this.showEmptyAlert(box);
      else this.hideEmptyAlert(box);
    });
  }

  /** Rundad mätare för en låda, matchar förloppsindikatorn i GameScene. */
  private drawBar(box: Box, ratio: number, color: number): void {
    const { barCx: cx, barTopY: top, barW: w } = box;
    const left = cx - w / 2;
    this.bar.fillStyle(PALETTE.metal.darker, 0.35);
    this.bar.fillRoundedRect(left, top, w, 9, 4.5);
    this.bar.fillStyle(PALETTE.panel.card, 0.9);
    this.bar.fillRoundedRect(left + 1, top + 1, w - 2, 7, 3.5);
    if (ratio > 0.02) {
      const iw = (w - 4) * ratio;
      this.bar.fillStyle(color, 1);
      this.bar.fillRoundedRect(left + 2, top + 2, iw, 5, 2.5);
      this.bar.fillStyle(0xffffff, 0.35);
      this.bar.fillRoundedRect(left + 2, top + 2, iw, 2, 1);
    }
  }

  private showEmptyAlert(box: Box): void {
    if (box.emptyAlert) return;
    box.emptyAlert = this.scene.add
      .text(box.localX, box.alertY, '❗', { fontSize: '20px' })
      .setOrigin(0.5, 1);
    this.add(box.emptyAlert);
    box.alertTween = this.scene.tweens.add({
      targets: box.emptyAlert,
      alpha: 0.25,
      duration: 400,
      yoyo: true,
      repeat: -1,
    });
  }

  private hideEmptyAlert(box: Box): void {
    box.alertTween?.remove();
    box.alertTween = undefined;
    box.emptyAlert?.destroy();
    box.emptyAlert = undefined;
  }
}
