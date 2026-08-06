import Phaser from 'phaser';
import type { NavGrid } from '../systems/NavGrid';
import { INV_SCALE } from '../utils/scale';
import { PERSON_FRAMES } from '../scenes/BootScene';

/** Sprite som går till en punkt – runt hinder via NavGrid – och säger till när den är framme. */
export class Actor extends Phaser.GameObjects.Sprite {
  private targetX = 0;
  private targetY = 0;
  private moving = false;
  private onArrive?: () => void;
  private path: { x: number; y: number }[] = [];
  private shadow: Phaser.GameObjects.Sprite;
  private animKey: string;
  private reaching = false;
  /** Fasförskjutning så att figurerna inte andas i takt. */
  private breathOffset = Phaser.Math.FloatBetween(0, Math.PI * 2);

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    texture: string,
    private speed: number,
  ) {
    super(scene, x, y, texture);
    this.animKey = texture;
    // Fötterna står i rutans nederkant.
    this.setOrigin(0.5, 0.985);
    this.setScale(INV_SCALE);
    this.shadow = scene.add.sprite(x, y, 'shadow').setAlpha(0.34).setScale(INV_SCALE);
    scene.add.existing(this);
    this.play(`${this.animKey}-idle`);
  }

  moveTo(x: number, y: number, onArrive?: () => void): void {
    this.onArrive = onArrive;
    const grid = this.scene.registry.get('navGrid') as NavGrid | undefined;
    const route = grid ? grid.route(this.x, this.y, x, y) : [{ x, y }];
    this.path = route.length > 0 ? route : [{ x, y }];
    this.advancePath();
  }

  /** Gå vidare till nästa delmål, eller avsluta och anropa callbacken. */
  private advancePath(): void {
    const next = this.path.shift();
    if (next) {
      this.targetX = next.x;
      this.targetY = next.y;
      if (!this.moving) this.startWalkAnim();
      this.moving = true;
      // Vänd figuren åt det håll den går.
      if (Math.abs(next.x - this.x) > 1) this.setFlipX(next.x < this.x);
    } else {
      this.moving = false;
      this.startIdleAnim();
      const cb = this.onArrive;
      this.onArrive = undefined;
      cb?.();
    }
  }

  private startWalkAnim(): void {
    this.reaching = false;
    this.play(`${this.animKey}-walk`, true);
  }

  private startIdleAnim(): void {
    if (this.reaching) return;
    this.play(`${this.animKey}-idle`, true);
  }

  /**
   * Fryser figuren i "sträcker sig"-rutan medan den plockar eller expedierar.
   * Anropa `stopReaching()` när handlingen är klar.
   */
  startReaching(): void {
    if (this.moving) return;
    this.reaching = true;
    this.stop();
    this.setFrame(PERSON_FRAMES.reach);
  }

  stopReaching(): void {
    if (!this.reaching) return;
    this.reaching = false;
    if (!this.moving) this.play(`${this.animKey}-idle`, true);
  }

  get isMoving(): boolean {
    return this.moving;
  }

  stopMoving(): void {
    this.moving = false;
    this.path = [];
    this.onArrive = undefined;
    this.startIdleAnim();
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (this.moving) {
      const dist = Phaser.Math.Distance.Between(this.x, this.y, this.targetX, this.targetY);
      const step = (this.speed * delta) / 1000;
      if (dist <= step) {
        this.setPosition(this.targetX, this.targetY);
        this.advancePath();
      } else {
        const angle = Phaser.Math.Angle.Between(this.x, this.y, this.targetX, this.targetY);
        this.x += Math.cos(angle) * step;
        this.y += Math.sin(angle) * step;
      }
      this.setScale(INV_SCALE);
    } else if (!this.reaching) {
      // Stillastående figurer andas svagt så att butiken aldrig ser frusen ut.
      const breath = 1 + Math.sin(time * 0.0028 + this.breathOffset) * 0.014;
      this.setScale(INV_SCALE, INV_SCALE * breath);
    }
    this.setDepth(this.y);
    this.shadow.setPosition(this.x, this.y + 2);
    this.shadow.setDepth(this.y - 1);
  }

  destroy(fromScene?: boolean): void {
    this.shadow.destroy();
    super.destroy(fromScene);
  }
}
