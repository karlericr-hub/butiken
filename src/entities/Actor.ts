import Phaser from 'phaser';
import type { NavGrid } from '../systems/NavGrid';

/** Sprite som går till en punkt – runt hinder via NavGrid – och säger till när den är framme. */
export class Actor extends Phaser.GameObjects.Sprite {
  private targetX = 0;
  private targetY = 0;
  private moving = false;
  private onArrive?: () => void;
  private path: { x: number; y: number }[] = [];
  private shadow: Phaser.GameObjects.Sprite;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    texture: string,
    private speed: number,
  ) {
    super(scene, x, y, texture);
    this.setOrigin(0.5, 0.95);
    this.shadow = scene.add.sprite(x, y, 'shadow').setAlpha(0.22);
    scene.add.existing(this);
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
      this.moving = true;
    } else {
      this.moving = false;
      const cb = this.onArrive;
      this.onArrive = undefined;
      cb?.();
    }
  }

  get isMoving(): boolean {
    return this.moving;
  }

  stopMoving(): void {
    this.moving = false;
    this.path = [];
    this.onArrive = undefined;
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
      // Lätt gung i steget medan figuren går.
      this.setScale(1, 1 + Math.sin(time * 0.02) * 0.045);
    } else if (this.scaleY !== 1) {
      this.setScale(1, 1);
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
