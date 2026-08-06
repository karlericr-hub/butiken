import Phaser from 'phaser';
import { RENDER_SCALE } from '../utils/scale';
import { PALETTE, TINT_FACES, isoFaces, darken, lighten, mix } from '../config/theme';

/** Tröjfärger för kundvarianterna cust0..cust7. */
export const CUSTOMER_VARIANTS = 8;

/** Figurernas rutstorlek i designpixlar. */
export const PERSON_W = 26;
export const PERSON_H = 46;

/**
 * Bildrutor i varje figurs sprite sheet.
 * 0 = stillastående, 1–4 = gångcykel, 5 = sträcker sig (plockar/betalar),
 * 6 = blink (stillastående med slutna ögon).
 */
export const PERSON_FRAMES = {
  idle: 0,
  walk: [1, 2, 3, 4],
  reach: 5,
  blink: 6,
} as const;

const FRAME_COUNT = 7;

const S = RENDER_SCALE;

/**
 * Ritverktyg som skalar all geometri med RENDER_SCALE innan texturen bakas.
 * Ritkoden nedan är oförändrad och uttryckt i designpixlar; wrappern gör att
 * texturerna genereras i full renderupplösning så att de blir skarpa när
 * kameran zoomar upp världen. Färger och vinklar lämnas orörda.
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

  fillRoundedRect(x: number, y: number, w: number, h: number, radius: number): this {
    this.g.fillRoundedRect(x * S, y * S, w * S, h * S, radius * S);
    return this;
  }

  strokeRoundedRect(x: number, y: number, w: number, h: number, radius: number): this {
    this.g.strokeRoundedRect(x * S, y * S, w * S, h * S, radius * S);
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

  fillTriangle(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
  ): this {
    this.g.fillTriangle(x1 * S, y1 * S, x2 * S, y2 * S, x3 * S, y3 * S);
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

  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): this {
    this.g.arc(x * S, y * S, radius * S, startAngle, endAngle);
    return this;
  }

  /** Isometrisk diamant med centrum i (x, y). */
  diamond(x: number, y: number, w: number, h: number): this {
    this.beginPath();
    this.moveTo(x, y - h / 2);
    this.lineTo(x + w / 2, y);
    this.lineTo(x, y + h / 2);
    this.lineTo(x - w / 2, y);
    this.closePath();
    return this;
  }

  /**
   * Mjuk skugga: staplade ellipser med stigande alpha inåt ger en gradient
   * utan att vi behöver en riktig radiell gradient.
   */
  softEllipse(x: number, y: number, w: number, h: number, color: number, steps = 9): this {
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      // Kvadratisk upptrappning gör kanten mjuk och kärnan tät.
      this.fillStyle(color, 0.09 + 0.09 * t * t);
      this.fillEllipse(x, y, w * (1 - t * 0.82), h * (1 - t * 0.82));
    }
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

/** En hållning i figurens gångcykel. */
interface Pose {
  /** Benens gung, -1 = vänster ben ut, 1 = höger ben ut. */
  legs: number;
  /** Armarnas gung, motsatt benen. */
  arms: number;
  /** Hur högt kroppen lyfts i steget. */
  lift: number;
  /** Squash-and-stretch på kroppen. */
  squash: number;
  /** Höger arm sträcks uppåt (plocka/räcka över). */
  reach: boolean;
  /** Slutna ögon. */
  blink: boolean;
}

const NEUTRAL: Pose = { legs: 0, arms: 0, lift: 0, squash: 0, reach: false, blink: false };

const POSES: Pose[] = [
  NEUTRAL,
  { legs: -1, arms: 1, lift: 0, squash: 0.06, reach: false, blink: false },
  { legs: 0, arms: 0, lift: -1.6, squash: -0.05, reach: false, blink: false },
  { legs: 1, arms: -1, lift: 0, squash: 0.06, reach: false, blink: false },
  { legs: 0, arms: 0, lift: -1.6, squash: -0.05, reach: false, blink: false },
  { ...NEUTRAL, reach: true },
  { ...NEUTRAL, blink: true },
];

/**
 * Genererar all grafik programmatiskt (färdigfärgade texturer).
 * Ersätts med riktiga sprites om spelet senare får ett grafikpaket.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.makeTile();
    this.makeCube();
    this.makeShelfCube();
    this.makeTill();
    this.makeParcel();
    this.makeShadows();
    this.makeCoin();
    this.makeMini();
    this.makeMoodFaces();
    this.makePallet();
    this.makePlant();
    this.makeBasket();
    this.makeEffects();
    this.makeIcons();
    this.makePanel();

    // Föreståndare och personal (med förkläde), paketkund samt kundvarianter.
    const P = PALETTE.people;
    this.makePerson('mgr', 0x43a047, P.hair[0], P.skin[0], true);
    this.makePerson('cashier', 0x5c6bc0, P.hair[1], P.skin[1], true);
    this.makePerson('stocker', 0xfb8c00, P.hair[2], P.skin[3], true);
    this.makePerson('parcelcust', 0x795548, 0x3e2723, P.skin[2], false);
    for (let i = 0; i < CUSTOMER_VARIANTS; i++) {
      this.makePerson(
        `cust${i}`,
        P.shirts[i % P.shirts.length],
        P.hair[i % P.hair.length],
        P.skin[i % P.skin.length],
        false,
      );
    }

    this.scene.start('Menu');
  }

  // --- Figurer ---------------------------------------------------------

  /**
   * Bakar en figur som ett sprite sheet med sju hållningar och registrerar
   * gång- och plockanimationerna. Rutan är PERSON_W×PERSON_H designpixlar.
   */
  private makePerson(
    key: string,
    shirt: number,
    hair: number,
    skin: number,
    apron: boolean,
  ): void {
    const g = new Tex(this);
    POSES.forEach((pose, i) => {
      this.drawPerson(g, i * PERSON_W, pose, shirt, hair, skin, apron);
    });

    const stripKey = `${key}__strip`;
    g.generateTexture(stripKey, PERSON_W * FRAME_COUNT, PERSON_H);
    g.destroy();

    const source = this.textures.get(stripKey).getSourceImage() as HTMLImageElement;
    this.textures.addSpriteSheet(key, source, {
      frameWidth: Math.round(PERSON_W * S),
      frameHeight: Math.round(PERSON_H * S),
    });

    this.anims.create({
      key: `${key}-walk`,
      frames: this.anims.generateFrameNumbers(key, { frames: [...PERSON_FRAMES.walk] }),
      frameRate: 9,
      repeat: -1,
    });
    this.anims.create({
      key: `${key}-idle`,
      frames: this.anims.generateFrameNumbers(key, {
        frames: [PERSON_FRAMES.idle, PERSON_FRAMES.blink],
      }),
      // Långsam takt: figuren står still och blinkar till då och då.
      frameRate: 0.9,
      repeat: -1,
    });
  }

  /** Ritar en hållning med övre vänstra hörnet i (ox, 0). */
  private drawPerson(
    g: Tex,
    ox: number,
    pose: Pose,
    shirt: number,
    hair: number,
    skin: number,
    apron: boolean,
  ): void {
    const ink = darken(shirt, 45);
    const armColor = darken(shirt, 18);
    const skinShade = darken(skin, 12);
    // Alla figurer står med fötterna i rutans nederkant.
    const lift = pose.lift;
    const swing = 2.4;

    // Ben – de scissrar i sidled och kortas något när de svingar ut.
    const legOut = pose.legs * swing;
    g.fillStyle(PALETTE.people.trousers, 1);
    g.fillRoundedRect(ox + 6 - legOut, 33 + lift * 0.3, 6, 12 - Math.abs(legOut) * 0.5, 2.5);
    g.fillRoundedRect(ox + 14 + legOut, 33 + lift * 0.3, 6, 12 - Math.abs(legOut) * 0.5, 2.5);
    // Skor
    g.fillStyle(darken(PALETTE.people.trousers, 12), 1);
    g.fillRoundedRect(ox + 5.5 - legOut, 42 + lift * 0.3, 7, 3.4, 1.7);
    g.fillRoundedRect(ox + 13.5 + legOut, 42 + lift * 0.3, 7, 3.4, 1.7);

    // Armar – motsatt fas mot benen. Höger arm går upp i "sträck"-rutan.
    const armOut = pose.arms * 1.6;
    g.fillStyle(armColor, 1);
    g.fillRoundedRect(ox + 1.5 - armOut, 20 + lift, 4.5, 13, 2.2);
    if (pose.reach) {
      g.fillRoundedRect(ox + 20.5, 12 + lift, 4.5, 12, 2.2);
    } else {
      g.fillRoundedRect(ox + 20 + armOut, 20 + lift, 4.5, 13, 2.2);
    }

    // Kropp – squash-and-stretch i steget.
    const bodyH = 20 * (1 + pose.squash);
    const bodyW = 18 * (1 - pose.squash * 0.5);
    const bodyX = ox + 13 - bodyW / 2;
    const bodyY = 37 + lift - bodyH;
    g.fillStyle(shirt, 1);
    g.fillRoundedRect(bodyX, bodyY, bodyW, bodyH, 7);
    // Mjuk skuggning längs kroppens högra sida ger volym.
    g.fillStyle(armColor, 0.55);
    g.fillRoundedRect(bodyX + bodyW - 5, bodyY + 2, 4.5, bodyH - 4, 2.2);

    // Förkläde för personal
    if (apron) {
      g.fillStyle(PALETTE.people.apron, 1);
      g.fillRoundedRect(ox + 7.5, bodyY + 6, 11, bodyH - 6, 3);
      g.fillStyle(darken(PALETTE.people.apron, 8), 1);
      g.fillRect(ox + 7.5, bodyY + 6, 11, 1.2);
    }

    // Huvud
    const headY = bodyY - 5.5;
    g.fillStyle(skin, 1);
    g.fillCircle(ox + 13, headY, 7);
    g.fillStyle(skinShade, 0.4);
    g.fillCircle(ox + 15.5, headY + 1, 5);
    g.fillStyle(skin, 1);
    g.fillCircle(ox + 12.4, headY - 0.4, 6.6);

    // Ögon – syns bara som två små prickar, men gör figuren levande.
    g.fillStyle(ink, 1);
    if (pose.blink) {
      g.fillRect(ox + 9.6, headY + 0.6, 2.4, 0.9);
      g.fillRect(ox + 14.2, headY + 0.6, 2.4, 0.9);
    } else {
      g.fillCircle(ox + 10.8, headY + 1, 1.15);
      g.fillCircle(ox + 15.4, headY + 1, 1.15);
    }

    // Hår (övre halvan av huvudet) med en ljusare dager.
    g.fillStyle(hair, 1);
    g.beginPath();
    g.arc(ox + 13, headY - 0.8, 7.3, Math.PI, 2 * Math.PI);
    g.closePath();
    g.fillPath();
    g.fillStyle(lighten(hair, 16), 0.75);
    g.beginPath();
    g.arc(ox + 11.4, headY - 1.6, 4.4, Math.PI * 1.05, Math.PI * 1.75);
    g.closePath();
    g.fillPath();
  }

  // --- Golv, väggar och möbler ----------------------------------------

  private makeTile(): void {
    const g = new Tex(this);
    g.fillStyle(0xffffff, 1);
    g.diamond(32, 16, 64, 32).fillPath();
    // Svag inre fasning: ljus uppåt, skugga nedåt, ger klinkerkänsla.
    g.lineStyle(1.6, 0xffffff, 0.55);
    g.beginPath();
    g.moveTo(3, 16);
    g.lineTo(32, 1.5);
    g.lineTo(61, 16);
    g.strokePath();
    g.lineStyle(1.6, 0x000000, 0.06);
    g.beginPath();
    g.moveTo(3, 16);
    g.lineTo(32, 30.5);
    g.lineTo(61, 16);
    g.strokePath();
    g.lineStyle(1, 0x000000, 0.09);
    g.diamond(32, 16, 64, 32).strokePath();
    g.generateTexture('tile', 64, 32);
    g.destroy();
  }

  /** Neutral kub som tintas (kassa- och paketdisk). */
  private makeCube(): void {
    const g = new Tex(this);
    g.fillStyle(TINT_FACES.top, 1);
    g.diamond(32, 16, 64, 32).fillPath();
    g.fillStyle(TINT_FACES.left, 1);
    g.beginPath();
    g.moveTo(0, 16);
    g.lineTo(32, 32);
    g.lineTo(32, 56);
    g.lineTo(0, 40);
    g.closePath();
    g.fillPath();
    g.fillStyle(TINT_FACES.right, 1);
    g.beginPath();
    g.moveTo(32, 32);
    g.lineTo(64, 16);
    g.lineTo(64, 40);
    g.lineTo(32, 56);
    g.closePath();
    g.fillPath();
    // Ljus kantlinje längs ovansidan lyfter fram formen.
    g.lineStyle(1.4, 0xffffff, 0.5);
    g.diamond(32, 16, 62, 30).strokePath();
    g.generateTexture('cube', 64, 56);
    g.destroy();
  }

  /** Hyllmöbel i trä med kantlist, hyllplan och sockel. */
  private makeShelfCube(): void {
    const g = new Tex(this);
    const faces = isoFaces(PALETTE.wood.base);
    // Ovansida (ljus träyta)
    g.fillStyle(PALETTE.wood.light, 1);
    g.diamond(32, 16, 64, 32).fillPath();
    g.lineStyle(2, PALETTE.wood.edge, 1);
    g.diamond(32, 16, 64, 32).strokePath();
    // Ådring på ovansidan
    g.lineStyle(1, darken(PALETTE.wood.light, 8), 0.5);
    g.beginPath();
    g.moveTo(14, 15);
    g.lineTo(46, 15);
    g.moveTo(20, 21);
    g.lineTo(44, 21);
    g.strokePath();
    // Vänster sida
    g.fillStyle(faces.left, 1);
    g.beginPath();
    g.moveTo(0, 16);
    g.lineTo(32, 32);
    g.lineTo(32, 56);
    g.lineTo(0, 40);
    g.closePath();
    g.fillPath();
    // Höger sida
    g.fillStyle(faces.right, 1);
    g.beginPath();
    g.moveTo(32, 32);
    g.lineTo(64, 16);
    g.lineTo(64, 40);
    g.lineTo(32, 56);
    g.closePath();
    g.fillPath();
    // Två hyllplan på sidorna
    for (const dy of [9, 17]) {
      g.lineStyle(1.5, darken(PALETTE.wood.base, 22), 0.75);
      g.beginPath();
      g.moveTo(0, 16 + dy);
      g.lineTo(32, 32 + dy);
      g.lineTo(64, 16 + dy);
      g.strokePath();
      g.lineStyle(1, PALETTE.wood.light, 0.35);
      g.beginPath();
      g.moveTo(0, 15 + dy);
      g.lineTo(32, 31 + dy);
      g.lineTo(64, 15 + dy);
      g.strokePath();
    }
    // Sockel
    g.fillStyle(PALETTE.wood.dark, 1);
    g.beginPath();
    g.moveTo(0, 40);
    g.lineTo(32, 56);
    g.lineTo(64, 40);
    g.lineTo(64, 44);
    g.lineTo(32, 60);
    g.lineTo(0, 44);
    g.closePath();
    g.fillPath();
    g.generateTexture('shelfCube', 64, 60);
    g.destroy();
  }

  /** Kassaapparat med skärm, knappar och kvittorulle. */
  private makeTill(): void {
    const g = new Tex(this);
    g.fillStyle(PALETTE.metal.dark, 1);
    g.fillRoundedRect(0, 5, 24, 13, 3);
    g.fillStyle(lighten(PALETTE.metal.dark, 10), 1);
    g.fillRoundedRect(0.8, 5.6, 22.4, 4, 2);
    g.fillStyle(PALETTE.metal.darker, 1);
    g.fillRoundedRect(14, 0, 10, 8, 2);
    g.fillStyle(PALETTE.metal.screen, 1);
    g.fillRect(16, 2, 6, 4);
    g.fillStyle(lighten(PALETTE.metal.screen, 22), 0.85);
    g.fillRect(16, 2, 6, 1.4);
    g.fillStyle(PALETTE.metal.light, 1);
    g.fillCircle(5, 10, 1.3);
    g.fillCircle(9, 10, 1.3);
    g.fillCircle(5, 14, 1.3);
    g.fillCircle(9, 14, 1.3);
    // Kvittorulle
    g.fillStyle(PALETTE.panel.card, 1);
    g.fillRoundedRect(2.5, 2.5, 6, 4, 1.4);
    g.generateTexture('till', 24, 18);
    g.destroy();
  }

  private makeParcel(): void {
    const g = new Tex(this);
    g.fillStyle(0xa1785c, 1);
    g.fillRoundedRect(0, 2, 18, 14, 2);
    g.fillStyle(lighten(0xa1785c, 10), 1);
    g.fillRoundedRect(0.6, 2.6, 16.8, 4, 1.5);
    g.fillStyle(0xd7ccc8, 1);
    g.fillRect(8, 2, 3, 14);
    g.lineStyle(1, PALETTE.wood.deep, 0.6);
    g.strokeRoundedRect(0, 2, 18, 14, 2);
    g.generateTexture('parcel', 18, 16);
    g.destroy();
  }

  /**
   * Tre mjuka skuggor i olika storlek: figurer, möbler och leveranser.
   * Kanten tonar ut, till skillnad från den hårda ellipsen tidigare.
   */
  private makeShadows(): void {
    const sizes: [string, number, number][] = [
      ['shadow', 34, 15],
      ['shadowM', 52, 22],
      ['shadowL', 74, 32],
    ];
    for (const [key, w, h] of sizes) {
      const g = new Tex(this);
      g.softEllipse(w / 2, h / 2, w, h, 0x2b1d12);
      g.generateTexture(key, w, h);
      g.destroy();
    }
  }

  private makeCoin(): void {
    const g = new Tex(this);
    g.fillStyle(darken(PALETTE.accent.base, 12), 1);
    g.fillCircle(5, 5, 5);
    g.fillStyle(PALETTE.accent.base, 1);
    g.fillCircle(5, 4.6, 4.4);
    g.fillStyle(PALETTE.accent.light, 1);
    g.fillCircle(5, 5, 3);
    g.fillStyle(0xffffff, 0.8);
    g.fillEllipse(3.6, 3.4, 3, 2);
    g.generateTexture('coin', 10, 10);
    g.destroy();
  }

  /** Liten varulåda som visas på hylltopparna (tintas per vara). */
  private makeMini(): void {
    const g = new Tex(this);
    g.fillStyle(TINT_FACES.top, 1);
    g.diamond(7, 3.5, 14, 7).fillPath();
    g.fillStyle(TINT_FACES.left, 1);
    g.beginPath();
    g.moveTo(0, 3.5);
    g.lineTo(7, 7);
    g.lineTo(7, 12);
    g.lineTo(0, 9);
    g.closePath();
    g.fillPath();
    g.fillStyle(TINT_FACES.right, 1);
    g.beginPath();
    g.moveTo(7, 7);
    g.lineTo(14, 3.5);
    g.lineTo(14, 9);
    g.lineTo(7, 12);
    g.closePath();
    g.fillPath();
    g.lineStyle(0.8, 0xffffff, 0.5);
    g.diamond(7, 3.5, 13, 6.5).strokePath();
    g.generateTexture('mini', 14, 12);
    g.destroy();
  }

  /** Kundkorg som bärs när kunden plockat på sig varor (tintas). */
  private makeBasket(): void {
    const g = new Tex(this);
    g.fillStyle(TINT_FACES.left, 1);
    g.fillRoundedRect(0, 3, 12, 7, 2);
    g.fillStyle(TINT_FACES.top, 1);
    g.fillRoundedRect(0.6, 3.4, 10.8, 2.6, 1.3);
    g.lineStyle(1.2, 0x8d6e63, 0.85);
    g.beginPath();
    g.arc(6, 3.4, 3.4, Math.PI, 2 * Math.PI);
    g.strokePath();
    g.generateTexture('basket', 12, 11);
    g.destroy();
  }

  /**
   * Fyra humör-smileys enligt HappyOrNot-skalan (mood0..mood3): mörkgrön,
   * gul, orange, röd. Munnen går från stort leende till surmun. Själva
   * smileyn bär färgen – ingen pratbubbla.
   */
  private makeMoodFaces(): void {
    // curve > 0 = leende, < 0 = sur mun.
    const curves = [3.5, 1.5, -1.5, -3.5];
    const size = 22;
    const cx = size / 2;
    const cy = size / 2;
    const r = 9;
    PALETTE.mood.forEach((color, i) => {
      const g = new Tex(this);
      // Ansikte med mörkare kant och en mjuk dager uppe till vänster.
      g.fillStyle(darken(color, 18), 1);
      g.fillCircle(cx, cy, r);
      g.fillStyle(color, 1);
      g.fillCircle(cx, cy - 0.4, r - 0.9);
      g.fillStyle(0xffffff, 0.28);
      g.fillEllipse(cx - 2.6, cy - 4.2, 8, 5);
      g.lineStyle(1.5, 0x000000, 0.3);
      g.strokeCircle(cx, cy, r);
      // Ögon.
      g.fillStyle(0x000000, 1);
      g.fillCircle(cx - 3.5, cy - 2, 1.4);
      g.fillCircle(cx + 3.5, cy - 2, 1.4);
      // Mun – kurva ritad som en liten stapel av punkter.
      g.lineStyle(1.6, 0x000000, 1);
      const half = 4;
      const my = cy + 3;
      g.beginPath();
      for (let sx = -half; sx <= half; sx++) {
        const t = sx / half; // -1..1
        const y = my + curves[i] * (1 - t * t);
        if (sx === -half) g.moveTo(cx + sx, y);
        else g.lineTo(cx + sx, y);
      }
      g.strokePath();
      g.generateTexture(`mood${i}`, size, size);
      g.destroy();
    });
  }

  /** Träpall som leveransen står på. */
  private makePallet(): void {
    const g = new Tex(this);
    g.fillStyle(0x9c7a54, 1);
    g.diamond(26, 7, 52, 14).fillPath();
    g.lineStyle(1, PALETTE.wood.deep, 0.7);
    g.diamond(26, 7, 52, 14).strokePath();
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

  /** Krukväxt som piffar upp butiken. */
  private makePlant(): void {
    const g = new Tex(this);
    // Kruka
    g.fillStyle(0xbf6b4f, 1);
    g.beginPath();
    g.moveTo(6, 23);
    g.lineTo(20, 23);
    g.lineTo(18, 33);
    g.lineTo(8, 33);
    g.closePath();
    g.fillPath();
    g.fillStyle(darken(0xbf6b4f, 12), 1);
    g.beginPath();
    g.moveTo(14, 23);
    g.lineTo(20, 23);
    g.lineTo(18, 33);
    g.lineTo(14, 33);
    g.closePath();
    g.fillPath();
    g.fillStyle(0xa8563c, 1);
    g.fillRoundedRect(5, 21, 16, 4, 1.4);
    // Grönska i tre djup
    g.fillStyle(0x2e7d32, 1);
    g.fillCircle(8, 14.5, 6);
    g.fillCircle(18, 14.5, 6);
    g.fillStyle(0x43a047, 1);
    g.fillCircle(13, 9, 7);
    g.fillCircle(7.5, 13.5, 5.2);
    g.fillStyle(0x66bb6a, 1);
    g.fillCircle(13, 15, 5.6);
    g.fillCircle(11, 7.5, 3.6);
    g.generateTexture('plant', 26, 34);
    g.destroy();
  }

  // --- Effekter --------------------------------------------------------

  /** Partikeltexturer: glitter, damm, konfetti och klickring. */
  private makeEffects(): void {
    // Glitter: fyruddig stjärna.
    let g = new Tex(this);
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(6, 0, 7.6, 6, 6, 12);
    g.fillTriangle(6, 0, 4.4, 6, 6, 12);
    g.fillTriangle(0, 6, 6, 7.6, 12, 6);
    g.fillTriangle(0, 6, 6, 4.4, 12, 6);
    g.fillCircle(6, 6, 2.2);
    g.generateTexture('sparkle', 12, 12);
    g.destroy();

    // Damm: mjuk vit prick som tonar ut mot kanten.
    g = new Tex(this);
    g.softEllipse(7, 7, 14, 14, 0xffffff, 7);
    g.fillStyle(0xffffff, 0.55);
    g.fillCircle(7, 7, 3.4);
    g.generateTexture('dust', 14, 14);
    g.destroy();

    // Konfetti: liten vit rektangel som tintas per partikel.
    g = new Tex(this);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(0, 0, 7, 4, 1.2);
    g.generateTexture('confetti', 7, 4);
    g.destroy();

    // Klickring: isometrisk ring som pulsar ut från klickpunkten.
    g = new Tex(this);
    g.lineStyle(3, 0xffffff, 1);
    g.diamond(32, 16, 58, 28).strokePath();
    g.generateTexture('ring', 64, 32);
    g.destroy();

    // Ljuspöl: mjuk iso-diamant för fönsterljus (adderas ovanpå golvet).
    g = new Tex(this);
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      g.fillStyle(0xffffff, 0.06 + 0.05 * t * t);
      g.diamond(48, 24, 96 * (1 - t * 0.7), 48 * (1 - t * 0.7)).fillPath();
    }
    g.generateTexture('lightPool', 96, 48);
    g.destroy();
  }

  // --- UI --------------------------------------------------------------

  /**
   * Ikoner som ersätter emoji i HUD och paneler. Emoji ritas olika på olika
   * operativsystem; egna ikoner håller gränssnittet enhetligt.
   */
  private makeIcons(): void {
    const size = 20;
    const c = size / 2;

    // Mynt
    let g = new Tex(this);
    g.fillStyle(darken(PALETTE.accent.base, 14), 1);
    g.fillCircle(c, c, 8.5);
    g.fillStyle(PALETTE.accent.base, 1);
    g.fillCircle(c, c - 0.5, 7.4);
    g.fillStyle(PALETTE.accent.light, 1);
    g.fillCircle(c, c - 0.5, 5.4);
    g.fillStyle(darken(PALETTE.accent.deep, 5), 1);
    g.fillRect(c - 2.6, c - 3.4, 5.2, 1.7);
    g.fillRect(c - 1.3, c - 3.4, 2.6, 7);
    g.generateTexture('iconCoin', size, size);
    g.destroy();

    // Stjärna
    g = new Tex(this);
    const star = (r1: number, r2: number, color: number, dy: number): void => {
      g.fillStyle(color, 1);
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 === 0 ? r1 : r2;
        const px = c + Math.cos(a) * r;
        const py = c + dy + Math.sin(a) * r;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
      g.fillPath();
    };
    star(9, 4, darken(PALETTE.warning.base, 18), 0.6);
    star(8.2, 3.6, PALETTE.accent.light, 0);
    g.generateTexture('iconStar', size, size);
    g.destroy();

    // Person i kö
    g = new Tex(this);
    g.fillStyle(PALETTE.text.body, 1);
    g.fillCircle(c, 6, 3.6);
    g.fillRoundedRect(c - 4.6, 10.5, 9.2, 8.5, 3.4);
    g.generateTexture('iconPerson', size, size);
    g.destroy();

    // Kalender
    g = new Tex(this);
    g.fillStyle(PALETTE.text.body, 1);
    g.fillRoundedRect(2, 4, 16, 14, 2.6);
    g.fillStyle(PALETTE.panel.card, 1);
    g.fillRoundedRect(3.4, 8, 13.2, 8.6, 1.6);
    g.fillStyle(PALETTE.danger.base, 1);
    g.fillRoundedRect(2, 4, 16, 3.4, 1.6);
    g.fillStyle(PALETTE.text.body, 1);
    g.fillRect(5.5, 2, 2, 4);
    g.fillRect(12.5, 2, 2, 4);
    g.generateTexture('iconCalendar', size, size);
    g.destroy();

    // Bock
    g = new Tex(this);
    g.lineStyle(3.2, PALETTE.success.base, 1);
    g.beginPath();
    g.moveTo(4.5, 10.5);
    g.lineTo(8.5, 14.5);
    g.lineTo(15.5, 5.5);
    g.strokePath();
    g.generateTexture('iconCheck', size, size);
    g.destroy();

    // Kryss
    g = new Tex(this);
    g.lineStyle(3.2, PALETTE.danger.base, 1);
    g.beginPath();
    g.moveTo(5.5, 5.5);
    g.lineTo(14.5, 14.5);
    g.moveTo(14.5, 5.5);
    g.lineTo(5.5, 14.5);
    g.strokePath();
    g.generateTexture('iconCross', size, size);
    g.destroy();

    // Kundvagn – menyns logotyp, i större format.
    g = new Tex(this);
    g.lineStyle(4, PALETTE.accent.deep, 1);
    g.beginPath();
    g.moveTo(4, 6);
    g.lineTo(11, 6);
    g.lineTo(17, 26);
    g.lineTo(40, 26);
    g.strokePath();
    g.fillStyle(PALETTE.accent.warm, 1);
    g.beginPath();
    g.moveTo(12.5, 10);
    g.lineTo(45, 10);
    g.lineTo(41, 23);
    g.lineTo(16.5, 23);
    g.closePath();
    g.fillPath();
    g.lineStyle(3, PALETTE.accent.deep, 1);
    g.beginPath();
    g.moveTo(12.5, 10);
    g.lineTo(45, 10);
    g.lineTo(41, 23);
    g.lineTo(16.5, 23);
    g.closePath();
    g.strokePath();
    g.fillStyle(PALETTE.accent.deep, 1);
    g.fillCircle(21, 33, 4.5);
    g.fillCircle(37, 33, 4.5);
    g.generateTexture('iconCart', 50, 38);
    g.destroy();
  }

  /**
   * Panelbricka för nineslice: mjuk slagskugga, gräddvit yta och en ljus
   * innerkant. Används av HUD, menykort, kvällspanel och game over-kort.
   */
  private makePanel(): void {
    const g = new Tex(this);
    const pad = 8;
    const r = 16;
    // Slagskugga i tre svaga lager.
    for (let i = 3; i >= 1; i--) {
      g.fillStyle(PALETTE.panel.shadow, 0.06);
      g.fillRoundedRect(pad - i, pad + i * 0.8, 64 - pad * 2 + i * 2, 64 - pad * 2 + i, r + i);
    }
    g.fillStyle(PALETTE.panel.card, 1);
    g.fillRoundedRect(pad, pad, 64 - pad * 2, 64 - pad * 2, r);
    g.lineStyle(2, PALETTE.panel.edge, 0.9);
    g.strokeRoundedRect(pad + 1, pad + 1, 64 - pad * 2 - 2, 64 - pad * 2 - 2, r - 1);
    g.generateTexture('panel', 64, 64);
    g.destroy();

    // Bärnstensfärgad variant för framhävda ytor (HUD-bar, knappar).
    const g2 = new Tex(this);
    for (let i = 3; i >= 1; i--) {
      g2.fillStyle(PALETTE.panel.shadow, 0.07);
      g2.fillRoundedRect(pad - i, pad + i * 0.8, 64 - pad * 2 + i * 2, 64 - pad * 2 + i, r + i);
    }
    g2.fillStyle(mix(PALETTE.panel.bar, PALETTE.accent.light, 0.12), 1);
    g2.fillRoundedRect(pad, pad, 64 - pad * 2, 64 - pad * 2, r);
    g2.lineStyle(2.5, PALETTE.accent.base, 0.85);
    g2.strokeRoundedRect(pad + 1.2, pad + 1.2, 64 - pad * 2 - 2.4, 64 - pad * 2 - 2.4, r - 1);
    g2.generateTexture('panelWarm', 64, 64);
    g2.destroy();
  }
}
