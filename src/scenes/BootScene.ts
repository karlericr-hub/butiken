import Phaser from 'phaser';

/** Tröjfärger för kundvarianterna cust0..cust7. */
export const CUSTOMER_VARIANTS = 8;

const SHIRT_COLORS = [
  0xe57373, 0x64b5f6, 0xffd54f, 0xba68c8, 0x81c784, 0xff8a65, 0x4dd0e1, 0xf06292,
];
const HAIR_COLORS = [0x4e342e, 0x212121, 0xffb74d, 0x8d6e63, 0x616161, 0xd84315];
const SKIN_TONES = [0xf2c9a1, 0xe0ac7e, 0xc68863, 0xf7d7b6];

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
    this.makeShadow();
    this.makeCoin();
    this.makeMini();
    this.makeBubble();
    this.makePallet();
    this.makePlant();

    // Föreståndare och personal (med förkläde), paketkund samt kundvarianter.
    this.makePerson('mgr', 0x43a047, 0x4e342e, 0xf2c9a1, true);
    this.makePerson('cashier', 0x5c6bc0, 0x212121, 0xe0ac7e, true);
    this.makePerson('stocker', 0xfb8c00, 0xffb74d, 0xf7d7b6, true);
    this.makePerson('parcelcust', 0x795548, 0x3e2723, 0xc68863, false);
    for (let i = 0; i < CUSTOMER_VARIANTS; i++) {
      this.makePerson(
        `cust${i}`,
        SHIRT_COLORS[i % SHIRT_COLORS.length],
        HAIR_COLORS[i % HAIR_COLORS.length],
        SKIN_TONES[i % SKIN_TONES.length],
        false,
      );
    }

    this.scene.start('Menu');
  }

  /** En liten figur med ben, tröja, armar, huvud och hår. 26×44 px. */
  private makePerson(
    key: string,
    shirt: number,
    hair: number,
    skin: number,
    apron: boolean,
  ): void {
    const g = this.add.graphics();
    const darkerShirt = Phaser.Display.Color.ValueToColor(shirt).darken(18).color;

    // Ben
    g.fillStyle(0x3b4252, 1);
    g.fillRoundedRect(6, 31, 6, 12, 2.5);
    g.fillRoundedRect(14, 31, 6, 12, 2.5);
    // Armar (mörkare nyans av tröjan)
    g.fillStyle(darkerShirt, 1);
    g.fillRoundedRect(1.5, 18, 4.5, 13, 2);
    g.fillRoundedRect(20, 18, 4.5, 13, 2);
    // Kropp
    g.fillStyle(shirt, 1);
    g.fillRoundedRect(4, 15, 18, 20, 7);
    // Förkläde för personal
    if (apron) {
      g.fillStyle(0xfff3e0, 1);
      g.fillRoundedRect(7.5, 21, 11, 13, 3);
    }
    // Huvud
    g.fillStyle(skin, 1);
    g.fillCircle(13, 9, 7);
    // Hår (övre halvan av huvudet)
    g.fillStyle(hair, 1);
    g.beginPath();
    g.arc(13, 8.2, 7.2, Math.PI, 2 * Math.PI);
    g.closePath();
    g.fillPath();

    g.generateTexture(key, 26, 44);
    g.destroy();
  }

  private makeTile(): void {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.beginPath();
    g.moveTo(32, 0);
    g.lineTo(64, 16);
    g.lineTo(32, 32);
    g.lineTo(0, 16);
    g.closePath();
    g.fillPath();
    g.lineStyle(1, 0x000000, 0.07);
    g.strokePath();
    g.generateTexture('tile', 64, 32);
    g.destroy();
  }

  /** Neutral kub som tintas (kassa- och paketdisk). */
  private makeCube(): void {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.beginPath();
    g.moveTo(32, 0);
    g.lineTo(64, 16);
    g.lineTo(32, 32);
    g.lineTo(0, 16);
    g.closePath();
    g.fillPath();
    g.fillStyle(0xd9d9d9, 1);
    g.beginPath();
    g.moveTo(0, 16);
    g.lineTo(32, 32);
    g.lineTo(32, 56);
    g.lineTo(0, 40);
    g.closePath();
    g.fillPath();
    g.fillStyle(0xbababa, 1);
    g.beginPath();
    g.moveTo(32, 32);
    g.lineTo(64, 16);
    g.lineTo(64, 40);
    g.lineTo(32, 56);
    g.closePath();
    g.fillPath();
    g.generateTexture('cube', 64, 56);
    g.destroy();
  }

  /** Hyllmöbel i trä med kantlist och sockel. Färdigfärgad. */
  private makeShelfCube(): void {
    const g = this.add.graphics();
    // Ovansida (ljus träyta)
    g.fillStyle(0xf3ead9, 1);
    g.beginPath();
    g.moveTo(32, 0);
    g.lineTo(64, 16);
    g.lineTo(32, 32);
    g.lineTo(0, 16);
    g.closePath();
    g.fillPath();
    g.lineStyle(2, 0xb59b7c, 1);
    g.strokePath();
    // Vänster sida
    g.fillStyle(0xd3c1a5, 1);
    g.beginPath();
    g.moveTo(0, 16);
    g.lineTo(32, 32);
    g.lineTo(32, 56);
    g.lineTo(0, 40);
    g.closePath();
    g.fillPath();
    // Höger sida
    g.fillStyle(0xbfab8c, 1);
    g.beginPath();
    g.moveTo(32, 32);
    g.lineTo(64, 16);
    g.lineTo(64, 40);
    g.lineTo(32, 56);
    g.closePath();
    g.fillPath();
    // Hyllspår på sidorna
    g.lineStyle(1.5, 0xa38d6d, 0.8);
    g.beginPath();
    g.moveTo(0, 27);
    g.lineTo(32, 43);
    g.lineTo(64, 27);
    g.strokePath();
    // Sockel
    g.fillStyle(0x8d7558, 1);
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

  /** Kassaapparat med skärm och knappar. */
  private makeTill(): void {
    const g = this.add.graphics();
    g.fillStyle(0x37474f, 1);
    g.fillRoundedRect(0, 5, 24, 13, 3);
    g.fillStyle(0x263238, 1);
    g.fillRoundedRect(14, 0, 10, 8, 2);
    g.fillStyle(0x80deea, 1);
    g.fillRect(16, 2, 6, 4);
    g.fillStyle(0xb0bec5, 1);
    g.fillCircle(5, 10, 1.3);
    g.fillCircle(9, 10, 1.3);
    g.fillCircle(5, 14, 1.3);
    g.fillCircle(9, 14, 1.3);
    g.generateTexture('till', 24, 18);
    g.destroy();
  }

  private makeParcel(): void {
    const g = this.add.graphics();
    g.fillStyle(0xa1785c, 1);
    g.fillRoundedRect(0, 2, 18, 14, 2);
    g.fillStyle(0xd7ccc8, 1);
    g.fillRect(8, 2, 3, 14);
    g.lineStyle(1, 0x6d4c41, 0.6);
    g.strokeRoundedRect(0, 2, 18, 14, 2);
    g.generateTexture('parcel', 18, 16);
    g.destroy();
  }

  private makeShadow(): void {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 1);
    g.fillEllipse(14, 5, 28, 10);
    g.generateTexture('shadow', 28, 10);
    g.destroy();
  }

  private makeCoin(): void {
    const g = this.add.graphics();
    g.fillStyle(0xffb300, 1);
    g.fillCircle(5, 5, 5);
    g.fillStyle(0xffd54f, 1);
    g.fillCircle(5, 5, 3.4);
    g.generateTexture('coin', 10, 10);
    g.destroy();
  }

  /** Liten varulåda som visas på hylltopparna (tintas per vara). */
  private makeMini(): void {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.beginPath();
    g.moveTo(7, 0);
    g.lineTo(14, 3.5);
    g.lineTo(7, 7);
    g.lineTo(0, 3.5);
    g.closePath();
    g.fillPath();
    g.fillStyle(0xd0d0d0, 1);
    g.beginPath();
    g.moveTo(0, 3.5);
    g.lineTo(7, 7);
    g.lineTo(7, 12);
    g.lineTo(0, 9);
    g.closePath();
    g.fillPath();
    g.fillStyle(0xb0b0b0, 1);
    g.beginPath();
    g.moveTo(7, 7);
    g.lineTo(14, 3.5);
    g.lineTo(14, 9);
    g.lineTo(7, 12);
    g.closePath();
    g.fillPath();
    g.generateTexture('mini', 14, 12);
    g.destroy();
  }

  /** Pratbubbla med svans för kundernas humör. */
  private makeBubble(): void {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(1, 1, 30, 19, 7);
    g.fillTriangle(13, 19, 20, 19, 16, 25);
    g.lineStyle(1.5, 0x90a4ae, 1);
    g.strokeRoundedRect(1, 1, 30, 19, 7);
    g.generateTexture('bubble', 32, 26);
    g.destroy();
  }

  /** Träpall som leveransen står på. */
  private makePallet(): void {
    const g = this.add.graphics();
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

  /** Krukväxt som piffar upp butiken. */
  private makePlant(): void {
    const g = this.add.graphics();
    // Kruka
    g.fillStyle(0xbf6b4f, 1);
    g.beginPath();
    g.moveTo(6, 23);
    g.lineTo(20, 23);
    g.lineTo(18, 33);
    g.lineTo(8, 33);
    g.closePath();
    g.fillPath();
    g.fillStyle(0xa8563c, 1);
    g.fillRect(5, 21, 16, 4);
    // Grönska
    g.fillStyle(0x388e3c, 1);
    g.fillCircle(8, 14, 6);
    g.fillCircle(18, 14, 6);
    g.fillStyle(0x4caf50, 1);
    g.fillCircle(13, 9, 7);
    g.fillStyle(0x66bb6a, 1);
    g.fillCircle(13, 15, 6);
    g.generateTexture('plant', 26, 34);
    g.destroy();
  }
}
