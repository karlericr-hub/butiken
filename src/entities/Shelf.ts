import Phaser from 'phaser';
import type { Product } from '../state/GameState';
import { isoToScreen } from '../utils/iso';
import { PRODUCT_COLORS } from '../config/products';

/** En hylla som håller en varutyp med begränsad kapacitet. */
export class Shelf extends Phaser.GameObjects.Container {
  readonly product: Product;
  private cube: Phaser.GameObjects.Sprite;
  private bar: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, gridX: number, gridY: number, product: Product) {
    const pos = isoToScreen(gridX, gridY);
    super(scene, pos.x, pos.y);
    this.product = product;
    this.gridX = gridX;
    this.gridY = gridY;

    this.cube = scene.add.sprite(0, 0, 'cube');
    this.cube.setOrigin(0.5, 40 / 56);
    this.cube.setTint(PRODUCT_COLORS[product.id] ?? 0xcccccc);
    this.add(this.cube);

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
    this.redrawBar();

    this.setDepth(pos.y);
    this.setSize(64, 56);
    this.setInteractive(
      new Phaser.Geom.Rectangle(-32, -40, 64, 56),
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
    this.redrawBar();
    return true;
  }

  /** Fyller på ett antal enheter (begränsas av kapaciteten). */
  addStock(units: number): void {
    this.product.currentStock = Math.min(
      this.product.shelfCapacity,
      this.product.currentStock + units,
    );
    this.redrawBar();
  }

  get missingUnits(): number {
    return this.product.shelfCapacity - this.product.currentStock;
  }

  private redrawBar(): void {
    const ratio = this.product.currentStock / this.product.shelfCapacity;
    const color = ratio > 0.5 ? 0x66bb6a : ratio > 0.2 ? 0xffb300 : 0xe53935;
    this.bar.clear();
    this.bar.fillStyle(0x3a3a3a, 0.85);
    this.bar.fillRect(-21, -48, 42, 7);
    this.bar.fillStyle(color, 1);
    this.bar.fillRect(-20, -47, 40 * ratio, 5);
  }
}
