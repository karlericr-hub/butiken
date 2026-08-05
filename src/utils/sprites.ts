import Phaser from 'phaser';
import { spriteSpec, type SpriteSpec } from '../config/assets';

/**
 * Sätter visningsstorlek (designpixlar) och ankarpunkt på en sprite utifrån en
 * spec. Ersätter de gamla `setScale(INV_SCALE)` + `setOrigin(...)`-anropen:
 * riktiga PNG:er har godtycklig upplösning, så vi styr ytan via setDisplaySize
 * istället. Kameran zoomar fortfarande upp världen till full renderupplösning.
 */
export function applySpec(
  sprite: Phaser.GameObjects.Components.Size &
    Phaser.GameObjects.Components.Origin &
    Phaser.GameObjects.Components.ComputedSize,
  spec: SpriteSpec,
  scale = 1,
): void {
  (sprite as unknown as { setDisplaySize(w: number, h: number): void }).setDisplaySize(
    spec.display[0] * scale,
    spec.display[1] * scale,
  );
  sprite.setOrigin(spec.origin[0], spec.origin[1]);
}

/** Applicerar spec:en för en given texturnyckel (miljö/props). */
export function applySprite(
  sprite: Phaser.GameObjects.Sprite,
  key: string,
  scale = 1,
): Phaser.GameObjects.Sprite {
  applySpec(sprite, spriteSpec(key), scale);
  return sprite;
}
