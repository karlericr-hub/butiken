import Phaser from 'phaser';
import { isoToScreen } from '../utils/iso';
import { INV_SCALE } from '../utils/scale';
import type { Customer } from './Customer';
import { PALETTE, TEXT, css } from '../config/theme';

/** Gemensam bas för stationer med FIFO-kö (kassa, paketdisk). */
export abstract class QueueStation extends Phaser.GameObjects.Container {
  readonly queue: Customer[] = [];
  readonly gridX: number;
  readonly gridY: number;

  constructor(
    scene: Phaser.Scene,
    gridX: number,
    gridY: number,
    public readonly maxLength: number,
  ) {
    const pos = isoToScreen(gridX, gridY);
    super(scene, pos.x, pos.y);
    this.gridX = gridX;
    this.gridY = gridY;
    this.setDepth(pos.y);
    scene.add.existing(this);
  }

  /** Ljus som blinkar till när stationen expedierat en kund. */
  private glow?: Phaser.GameObjects.Sprite;

  /** Disksprite, etikett och klickyta – anropas av subklasserna. */
  protected buildVisuals(tint: number, label: string, topTexture: string): void {
    // Mjuk kontaktskugga binder disken till golvet.
    const shadow = this.scene.add.sprite(0, 14, 'shadowM');
    shadow.setScale(INV_SCALE * 1.15, INV_SCALE * 1.1);
    shadow.setAlpha(0.3);
    this.add(shadow);

    const cube = this.scene.add.sprite(0, 0, 'cube');
    cube.setOrigin(0.5, 40 / 56);
    cube.setScale(INV_SCALE);
    cube.setTint(tint);
    this.add(cube);

    const top = this.scene.add.sprite(0, -30, topTexture);
    top.setOrigin(0.5, 1);
    top.setScale(INV_SCALE);
    this.add(top);

    // Blinkljus ovanför disken, osynligt tills en kund expedierats.
    this.glow = this.scene.add.sprite(0, -34, 'dust');
    this.glow.setScale(INV_SCALE * 3.4);
    this.glow.setTint(PALETTE.accent.light);
    this.glow.setBlendMode(Phaser.BlendModes.ADD);
    this.glow.setAlpha(0);
    this.add(this.glow);

    const text = this.scene.add
      .text(
        0,
        -52,
        label,
        TEXT.small({ fontSize: '12px', color: css(PALETTE.text.strong), fontStyle: 'bold' }),
      )
      .setOrigin(0.5, 1);
    this.add(text);

    // Klicket sker på markeringsrutan framför disken (InteractionMarker),
    // inte på själva disken.
  }

  /** Kort ljusblink – används när en betalning gått igenom. */
  flash(): void {
    if (!this.glow) return;
    this.glow.setAlpha(0.9).setScale(INV_SCALE * 2.4);
    this.scene.tweens.add({
      targets: this.glow,
      alpha: 0,
      scale: INV_SCALE * 4.6,
      duration: 380,
      ease: 'Cubic.easeOut',
    });
  }

  /** Där föreståndaren (eller personalen) står och arbetar. */
  get managerSpot(): { x: number; y: number } {
    return isoToScreen(this.gridX + 1, this.gridY);
  }

  /** Köplats nummer i (0 = längst fram vid disken). */
  queueSpot(i: number): { x: number; y: number } {
    return isoToScreen(this.gridX - 1, this.gridY + i * 0.9);
  }

  join(customer: Customer): number {
    this.queue.push(customer);
    return this.queue.length - 1;
  }

  /** Ta bort kunden längst fram och låt resten flytta fram. */
  dequeue(): void {
    this.queue.shift();
    this.queue.forEach((c, i) => c.advanceTo(this.queueSpot(i), i));
  }

  removeFromQueue(customer: Customer): void {
    const idx = this.queue.indexOf(customer);
    if (idx === -1) return;
    this.queue.splice(idx, 1);
    this.queue.forEach((c, i) => c.advanceTo(this.queueSpot(i), i));
  }
}
