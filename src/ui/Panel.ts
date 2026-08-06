import Phaser from 'phaser';
import { INV_SCALE, RENDER_SCALE } from '../utils/scale';

/** Hörnradie + marginal i panelbrickan, se BootScene.makePanel. */
const SLICE = 26;

/**
 * Panelbricka med mjuk slagskugga och ljus innerkant.
 *
 * Brickan bakas i full renderupplösning, så nineslice byggs i texturpixlar och
 * skalas sedan ned till designkoordinater. Byggs den direkt i designmått blir
 * hörnen RENDER_SCALE gånger för stora.
 */
export function addPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  texture: 'panel' | 'panelWarm' = 'panel',
): Phaser.GameObjects.NineSlice {
  const s = RENDER_SCALE;
  const slice = SLICE * s;
  return scene.add
    .nineslice(x, y, texture, undefined, width * s, height * s, slice, slice, slice, slice)
    .setScale(INV_SCALE);
}
