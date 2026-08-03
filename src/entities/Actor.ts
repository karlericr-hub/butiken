import Phaser from 'phaser';

/** Sprite som kan gå i rak linje till en punkt och meddela när den är framme. */
export class Actor extends Phaser.GameObjects.Sprite {
  private targetX = 0;
  private targetY = 0;
  private moving = false;
  private onArrive?: () => void;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    texture: string,
    private speed: number,
  ) {
    super(scene, x, y, texture);
    this.setOrigin(0.5, 0.9);
    scene.add.existing(this);
  }

  moveTo(x: number, y: number, onArrive?: () => void): void {
    this.targetX = x;
    this.targetY = y;
    this.onArrive = onArrive;
    this.moving = true;
  }

  get isMoving(): boolean {
    return this.moving;
  }

  stopMoving(): void {
    this.moving = false;
    this.onArrive = undefined;
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (this.moving) {
      const dist = Phaser.Math.Distance.Between(this.x, this.y, this.targetX, this.targetY);
      const step = (this.speed * delta) / 1000;
      if (dist <= step) {
        this.setPosition(this.targetX, this.targetY);
        this.moving = false;
        const cb = this.onArrive;
        this.onArrive = undefined;
        cb?.();
      } else {
        const angle = Phaser.Math.Angle.Between(this.x, this.y, this.targetX, this.targetY);
        this.x += Math.cos(angle) * step;
        this.y += Math.sin(angle) * step;
      }
    }
    this.setDepth(this.y);
  }
}
