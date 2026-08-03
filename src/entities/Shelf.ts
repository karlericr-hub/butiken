import Phaser from 'phaser';
import type { Product } from '../state/GameState';
import { isoToScreen } from '../utils/iso';
import { PRODUCT_COLORS } from '../config/products';
import { sfx } from '../systems/Sfx';

/** Positioner för varulådorna på hylltoppen (lokala koordinater). */
const MINI_POSITIONS: [number, number][] = [
  [-16, -34],
  [0, -34],
  [16, -34],
  [-8, -27],
  [8, -27],
  [-24, -27],
];

/** En hylla som håller en varutyp med begränsad kapacitet. */
export class Shelf extends Phaser.GameObjects.Container {
  readonly product: Product;
  private bar: Phaser.GameObjects.Graphics;
  private minis: Phaser.GameObjects.Sprite[] = [];
  private emptyAlert?: Phaser.GameObjects.Text;
  private alertTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, gridX: number, gridY: number, product: Product) {
    const pos = isoToScreen(gridX, gridY);
    super(scene, pos.x, pos.y);
    this.product = product;
    this.gridX = gridX;
    this.gridY = gridY;

    const cube = scene.add.sprite(0, 0, 'shelfCube');
    cube.setOrigin(0.5, 40 / 60);
    this.add(cube);

    for (const [mx, my] of MINI_POSITIONS) {
      const mini = scene.add.sprite(mx, my, 'mini');
      mini.setTint(PRODUCT_COLORS[product.id] ?? 0xcccccc);
      mini.setVisible(false);
      this.add(mini);
      this.minis.push(mini);
    }

    const label = scene.add
      .text(0, -52, product.name, {
        fontFamily: 'sans-serif',
        fontSize: '12px',
        color: '#4a3f35',
      })
      .setOrigin(0.5, 1);
    this.add(label);

    this.bar = scene.add.graphics();
    this.add(this.bar);
    this.refreshVisuals();

    this.setDepth(pos.y);
    this.setSize(64, 56);
    // Generös träffyta – barnvänligt att inte behöva pricka exakt.
    this.setInteractive(
      new Phaser.Geom.Rectangle(-40, -52, 80, 78),
      Phaser.Geom.Rectangle.Contains,
    );
    if (this.input) this.input.cursor = 'pointer';
    scene.add.existing(this);
  }

  readonly gridX: number;
  readonly gridY: number;

  /** Punkten framför hyllan där man ställer sig. */
  get standPoint(): { x: number; y: number } {
    return isoToScreen(this.gridX, this.gridY + 1);
  }

  get isEmpty(): boolean {
    return this.product.currentStock <= 0;
  }

  /** Kund plockar en enhet. Returnerar false om hyllan är tom. */
  takeOne(): boolean {
    if (this.product.currentStock <= 0) return false;
    this.product.currentStock--;
    this.refreshVisuals();
    if (this.product.currentStock === 0) sfx.alert();
    return true;
  }

  /** Fyller på ett antal enheter (begränsas av kapaciteten). */
  addStock(units: number): void {
    this.product.currentStock = Math.min(
      this.product.shelfCapacity,
      this.product.currentStock + units,
    );
    this.refreshVisuals();
  }

  get missingUnits(): number {
    return this.product.shelfCapacity - this.product.currentStock;
  }

  private refreshVisuals(): void {
    const ratio = this.product.currentStock / this.product.shelfCapacity;

    const color = ratio > 0.5 ? 0x66bb6a : ratio > 0.2 ? 0xffb300 : 0xe53935;
    this.bar.clear();
    this.bar.fillStyle(0x3a3a3a, 0.85);
    this.bar.fillRect(-21, -48, 42, 7);
    this.bar.fillStyle(color, 1);
    this.bar.fillRect(-20, -47, 40 * ratio, 5);

    const visibleMinis =
      this.product.currentStock > 0 ? Math.max(1, Math.ceil(ratio * this.minis.length)) : 0;
    this.minis.forEach((m, i) => m.setVisible(i < visibleMinis));

    if (this.isEmpty) this.showEmptyAlert();
    else this.hideEmptyAlert();
  }

  private showEmptyAlert(): void {
    if (this.emptyAlert) return;
    this.emptyAlert = this.scene.add
      .text(0, -68, '❗', { fontSize: '20px' })
      .setOrigin(0.5, 1);
    this.add(this.emptyAlert);
    this.alertTween = this.scene.tweens.add({
      targets: this.emptyAlert,
      alpha: 0.25,
      duration: 400,
      yoyo: true,
      repeat: -1,
    });
  }

  private hideEmptyAlert(): void {
    this.alertTween?.remove();
    this.alertTween = undefined;
    this.emptyAlert?.destroy();
    this.emptyAlert = undefined;
  }
}
