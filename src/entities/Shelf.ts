import Phaser from 'phaser';
import type { Product } from '../state/GameState';
import { isoToScreen } from '../utils/iso';
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

/** En hylla som håller en varutyp med begränsad kapacitet. */
export class Shelf extends Phaser.GameObjects.Container {
  readonly product: Product;
  private bar: Phaser.GameObjects.Graphics;
  private minis: Phaser.GameObjects.Sprite[] = [];
  private emptyAlert?: Phaser.GameObjects.Text;
  private alertTween?: Phaser.Tweens.Tween;
  private cube!: Phaser.GameObjects.Sprite;

  constructor(scene: Phaser.Scene, gridX: number, gridY: number, product: Product) {
    const pos = isoToScreen(gridX, gridY);
    super(scene, pos.x, pos.y);
    this.product = product;
    this.gridX = gridX;
    this.gridY = gridY;

    // Mjuk kontaktskugga så att hyllan står på golvet i stället för att sväva.
    const shadow = scene.add.sprite(0, 16, 'shadowM');
    shadow.setScale(INV_SCALE * 1.2, INV_SCALE * 1.1);
    shadow.setAlpha(0.3);
    this.add(shadow);

    const cube = scene.add.sprite(0, 0, 'shelfCube');
    cube.setOrigin(0.5, 40 / 60);
    cube.setScale(INV_SCALE);
    this.add(cube);
    this.cube = cube;

    const tint = PRODUCT_COLORS[product.id] ?? 0xcccccc;
    MINI_POSITIONS.forEach(([mx, my], i) => {
      const mini = scene.add.sprite(mx, my, 'mini');
      mini.setScale(INV_SCALE);
      // Lådorna längre bak är en aning mörkare – ger djup i stapeln.
      mini.setTint(i >= 3 ? darken(tint, 8) : tint);
      mini.setVisible(false);
      this.add(mini);
      this.minis.push(mini);
    });

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
    if (this.product.currentStock === 0) {
      sfx.alert();
      this.pulseEmpty();
    }
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

  /** Liten glädjeskutt när hyllan fyllts på. */
  celebrate(): void {
    this.scene.tweens.add({
      targets: this.cube,
      scaleY: INV_SCALE * 1.12,
      duration: 130,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
  }

  /** Röd puls när sista varan plockats. */
  private pulseEmpty(): void {
    this.cube.setTint(mix(0xffffff, PALETTE.danger.light, 0.55));
    this.scene.time.delayedCall(220, () => this.cube.clearTint());
  }

  private refreshVisuals(): void {
    const ratio = this.product.currentStock / this.product.shelfCapacity;

    const color =
      ratio > 0.5
        ? PALETTE.success.light
        : ratio > 0.2
          ? PALETTE.warning.base
          : PALETTE.danger.base;
    this.bar.clear();
    // Rundad mätare med ljus kant, matchar förloppsindikatorn i GameScene.
    this.bar.fillStyle(PALETTE.metal.darker, 0.35);
    this.bar.fillRoundedRect(-22, -50, 44, 9, 4.5);
    this.bar.fillStyle(PALETTE.panel.card, 0.9);
    this.bar.fillRoundedRect(-21, -49, 42, 7, 3.5);
    if (ratio > 0.02) {
      this.bar.fillStyle(color, 1);
      this.bar.fillRoundedRect(-20, -48, 40 * ratio, 5, 2.5);
      this.bar.fillStyle(0xffffff, 0.35);
      this.bar.fillRoundedRect(-20, -48, 40 * ratio, 2, 1);
    }

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
