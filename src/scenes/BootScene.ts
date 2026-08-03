import Phaser from 'phaser';

/**
 * Genererar all placeholder-grafik programmatiskt (vita/grå texturer som
 * tintas per användning). Ersätts med riktiga sprites i polish-steget.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.makeTile();
    this.makeCube();
    this.makePerson();
    this.makeTill();
    this.makeParcel();
    this.makeShadow();
    this.makeCoin();
    this.makeMini();
    this.scene.start('Menu');
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
    g.lineStyle(1, 0x000000, 0.1);
    g.strokePath();
    g.generateTexture('tile', 64, 32);
    g.destroy();
  }

  private makeCube(): void {
    const g = this.add.graphics();
    // Ovansida
    g.fillStyle(0xffffff, 1);
    g.beginPath();
    g.moveTo(32, 0);
    g.lineTo(64, 16);
    g.lineTo(32, 32);
    g.lineTo(0, 16);
    g.closePath();
    g.fillPath();
    // Vänster sida
    g.fillStyle(0xd9d9d9, 1);
    g.beginPath();
    g.moveTo(0, 16);
    g.lineTo(32, 32);
    g.lineTo(32, 56);
    g.lineTo(0, 40);
    g.closePath();
    g.fillPath();
    // Höger sida
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

  private makePerson(): void {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(12, 7, 6);
    g.fillRoundedRect(4, 15, 16, 21, 6);
    g.generateTexture('person', 24, 38);
    g.destroy();
  }

  private makeParcel(): void {
    const g = this.add.graphics();
    g.fillStyle(0xa1785c, 1);
    g.fillRoundedRect(0, 2, 18, 14, 2);
    g.fillStyle(0xd7ccc8, 1);
    g.fillRect(8, 2, 3, 14);
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

  private makeTill(): void {
    const g = this.add.graphics();
    g.fillStyle(0x37474f, 1);
    g.fillRoundedRect(0, 4, 20, 12, 2);
    g.fillStyle(0x80deea, 1);
    g.fillRect(3, 6, 8, 5);
    g.generateTexture('till', 20, 16);
    g.destroy();
  }
}
