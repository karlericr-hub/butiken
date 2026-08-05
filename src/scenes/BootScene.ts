import Phaser from 'phaser';
import { RENDER_SCALE } from '../utils/scale';
import {
  ASSET_BASE,
  CHARACTERS,
  PROP_ASSETS,
  WALK_FRAMES,
  walkAnimKey,
} from '../config/assets';

/** Tröjfärger för kundvarianterna cust0..cust7. */
export const CUSTOMER_VARIANTS = 8;

const S = RENDER_SCALE;

/**
 * Ritverktyg som skalar geometri med RENDER_SCALE innan texturen bakas, så att
 * de fåtal texturer vi fortfarande genererar programmatiskt (skugga, humör-
 * smileys, leveranspall) blir skarpa när kameran zoomar upp världen.
 */
class Tex {
  private g: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics();
  }
  fillStyle(color: number, alpha?: number): this {
    this.g.fillStyle(color, alpha);
    return this;
  }
  lineStyle(width: number, color: number, alpha?: number): this {
    this.g.lineStyle(width * S, color, alpha);
    return this;
  }
  fillRect(x: number, y: number, w: number, h: number): this {
    this.g.fillRect(x * S, y * S, w * S, h * S);
    return this;
  }
  fillCircle(x: number, y: number, radius: number): this {
    this.g.fillCircle(x * S, y * S, radius * S);
    return this;
  }
  strokeCircle(x: number, y: number, radius: number): this {
    this.g.strokeCircle(x * S, y * S, radius * S);
    return this;
  }
  fillEllipse(x: number, y: number, w: number, h: number): this {
    this.g.fillEllipse(x * S, y * S, w * S, h * S);
    return this;
  }
  beginPath(): this {
    this.g.beginPath();
    return this;
  }
  closePath(): this {
    this.g.closePath();
    return this;
  }
  fillPath(): this {
    this.g.fillPath();
    return this;
  }
  strokePath(): this {
    this.g.strokePath();
    return this;
  }
  moveTo(x: number, y: number): this {
    this.g.moveTo(x * S, y * S);
    return this;
  }
  lineTo(x: number, y: number): this {
    this.g.lineTo(x * S, y * S);
    return this;
  }
  generateTexture(key: string, width: number, height: number): this {
    this.g.generateTexture(key, Math.ceil(width * S), Math.ceil(height * S));
    return this;
  }
  destroy(): void {
    this.g.destroy();
  }
}

/**
 * Laddar all riktig grafik (Kenney, CC0) och genererar de få hjälptexturer som
 * inte hämtas från biblioteket (mjuk skugga, humör-smileys, leveranspall).
 * Definierar även figurernas gånganimationer.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.load.setPath(ASSET_BASE);
    // Miljö- och prop-texturer.
    for (const asset of PROP_ASSETS) {
      this.load.image(asset.key, asset.url);
    }
    // Figurer: idle + åtta gångramar per Toon-figur.
    for (const c of CHARACTERS) {
      this.load.image(`${c}-idle`, `char/${c}_idle.png`);
      for (let i = 0; i < WALK_FRAMES; i++) {
        this.load.image(`${c}-walk${i}`, `char/${c}_walk${i}.png`);
      }
    }
  }

  create(): void {
    this.makeShadow();
    this.makeMoodFaces();
    this.makePallet();
    this.createWalkAnimations();
    this.scene.start('Menu');
  }

  /** En gånganimation per figur, byggd av de åtta walk-ramarna. */
  private createWalkAnimations(): void {
    for (const c of CHARACTERS) {
      const frames = [];
      for (let i = 0; i < WALK_FRAMES; i++) frames.push({ key: `${c}-walk${i}` });
      this.anims.create({
        key: walkAnimKey(c),
        frames,
        frameRate: 10,
        repeat: -1,
      });
    }
  }

  private makeShadow(): void {
    const g = new Tex(this);
    g.fillStyle(0x000000, 1);
    g.fillEllipse(14, 5, 28, 10);
    g.generateTexture('shadow', 28, 10);
    g.destroy();
  }

  /**
   * Fyra humör-smileys enligt HappyOrNot-skalan (mood0..mood3): mörkgrön,
   * gul, orange, röd. Behålls programgenererade – den fyrgradiga färgskalan
   * har ingen ren motsvarighet i bibliotekets emote-paket.
   */
  private makeMoodFaces(): void {
    const faces = [
      { color: 0x2ecc55, curve: 3.5 },
      { color: 0xf2c81e, curve: 1.5 },
      { color: 0xef8b3b, curve: -1.5 },
      { color: 0xe23b3b, curve: -3.5 },
    ];
    const size = 22;
    const cx = size / 2;
    const cy = size / 2;
    const r = 9;
    faces.forEach((face, i) => {
      const g = new Tex(this);
      g.fillStyle(face.color, 1);
      g.fillCircle(cx, cy, r);
      g.lineStyle(1.5, 0x000000, 0.35);
      g.strokeCircle(cx, cy, r);
      g.fillStyle(0x000000, 1);
      g.fillCircle(cx - 3.5, cy - 2, 1.4);
      g.fillCircle(cx + 3.5, cy - 2, 1.4);
      g.lineStyle(1.6, 0x000000, 1);
      const half = 4;
      const my = cy + 3;
      g.beginPath();
      for (let sx = -half; sx <= half; sx++) {
        const t = sx / half;
        const y = my + face.curve * (1 - t * t);
        if (sx === -half) g.moveTo(cx + sx, y);
        else g.lineTo(cx + sx, y);
      }
      g.strokePath();
      g.generateTexture(`mood${i}`, size, size);
      g.destroy();
    });
  }

  /** Träpall som leveransen står på – enkel form, behålls genererad. */
  private makePallet(): void {
    const g = new Tex(this);
    g.fillStyle(0x9c7a54, 1);
    g.beginPath();
    g.moveTo(26, 0);
    g.lineTo(52, 7);
    g.lineTo(26, 14);
    g.lineTo(0, 7);
    g.closePath();
    g.fillPath();
    g.lineStyle(1, 0x6d4c41, 0.7);
    g.strokePath();
    g.lineStyle(1.5, 0x7a5c3e, 0.9);
    g.beginPath();
    g.moveTo(9, 4.7);
    g.lineTo(35, 11.7);
    g.moveTo(17, 2.4);
    g.lineTo(43, 9.4);
    g.strokePath();
    g.generateTexture('pallet', 52, 15);
    g.destroy();
  }
}
