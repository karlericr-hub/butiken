import Phaser from 'phaser';

/** Sprite som kan gå i rak linje till en punkt och meddela när den är framme. */
export class Actor extends Phaser.GameObjects.Sprite {
  private targetX = 0;
  private targetY = 0;
  private moving = false;
  private onArrive?: () => void;
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
