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
    this.scene.start('Game');
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
