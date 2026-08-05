import Phaser from 'phaser';
import type { NavGrid } from '../systems/NavGrid';
import { INV_SCALE } from '../utils/scale';
import { applySpec } from '../utils/sprites';
import {
  FIGURE_CHARACTER,
  FIGURE_SPEC,
  figureIdleTexture,
  walkAnimKey,
  type CharacterName,
} from '../config/assets';

/** Sprite som går till en punkt – runt hinder via NavGrid – och säger till när den är framme. */
export class Actor extends Phaser.GameObjects.Sprite {
  private targetX = 0;
  private targetY = 0;
  private moving = false;
  private onArrive?: () => void;
  private path: { x: number; y: number }[] = [];
  private shadow: Phaser.GameObjects.Sprite;
  private readonly character: CharacterName;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    /** Figurnyckel (mgr, cashier, cust3, ...) – slås upp till en Toon-figur. */
    figureKey: string,
    private speed: number,
  ) {
    const character = FIGURE_CHARACTER[figureKey] ?? 'malePerson';
    super(scene, x, y, figureIdleTexture(character));
    this.character = character;
    applySpec(this, FIGURE_SPEC);
    this.shadow = scene.add.sprite(x, y, 'shadow').setAlpha(0.22).setScale(INV_SCALE);
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
        // Vänd figuren efter rörelsens riktning i skärm-x-led.
        if (Math.cos(angle) < -0.05) this.setFlipX(true);
        else if (Math.cos(angle) > 0.05) this.setFlipX(false);
      }
    }
    this.updateAnimationState();
    this.setDepth(this.y);
    this.shadow.setPosition(this.x, this.y + 2);
    this.shadow.setDepth(this.y - 1);
  }

  /** Spelar gånganimation medan figuren rör sig, annars idle-bild. */
  private updateAnimationState(): void {
    const walk = walkAnimKey(this.character);
    if (this.moving) {
      if (this.anims.getName() !== walk || !this.anims.isPlaying) this.anims.play(walk, true);
    } else if (this.anims.isPlaying) {
      this.anims.stop();
      this.setTexture(figureIdleTexture(this.character));
    }
  }

  destroy(fromScene?: boolean): void {
    this.shadow.destroy();
    super.destroy(fromScene);
  }
}
