import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem';
import { sfx } from '../systems/Sfx';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;

    this.add.rectangle(0, 0, W, H, 0xaee3f2).setOrigin(0, 0);
    this.drawSun(W - 110, 90);
    this.drawClouds();
    this.drawGround(H);

    // Vitt kort som håller ihop titel och knappar
    const card = this.add.graphics();
    card.fillStyle(0xfffdf6, 0.96);
    card.fillRoundedRect(W / 2 - 250, 96, 500, 340, 24);
    card.lineStyle(3, 0xffffff, 1);
    card.strokeRoundedRect(W / 2 - 250, 96, 500, 340, 24);

    const cart = this.add.text(W / 2 - 152, 168, '🛒', { fontSize: '52px' }).setOrigin(0.5);
    this.tweens.add({
      targets: cart,
      y: cart.y - 10,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.add
      .text(W / 2 + 40, 168, 'Butiken', {
        fontFamily: 'sans-serif',
        fontSize: '56px',
        color: '#f57f17',
        fontStyle: 'bold',
        stroke: '#ffffff',
        strokeThickness: 6,
        shadow: { offsetX: 0, offsetY: 3, color: '#e6510033', blur: 6, fill: true },
      })
      .setOrigin(0.5);

    this.add
      .text(W / 2, 228, 'Driv din egen butik – hinner du med allt?', {
        fontFamily: 'sans-serif',
        fontSize: '18px',
        color: '#6d4c41',
      })
      .setOrigin(0.5);

    const savedState = SaveSystem.load();
    if (savedState) {
      this.makeButton(W / 2, 300, `Fortsätt (dag ${savedState.day})`, 0x43a047, 0x2e7d32, () => {
        this.registry.set('gameState', savedState);
        this.scene.start('Game');
      });
      this.makeButton(W / 2, 372, 'Nytt spel', 0xffa726, 0xef6c00, () => {
        SaveSystem.clear();
        this.registry.remove('gameState');
        this.scene.start('Game');
      });
    } else {
      this.makeButton(W / 2, 336, 'Nytt spel', 0x43a047, 0x2e7d32, () => {
        SaveSystem.clear();
        this.registry.remove('gameState');
        this.scene.start('Game');
      });
    }

    this.add
      .text(
        W / 2,
        H - 74,
        'Klicka på kassan för att ta betalt, på hyllorna för att fylla på\noch på golvet för att gå. Beställ varor och köp uppgraderingar på kvällen!',
        {
          fontFamily: 'sans-serif',
          fontSize: '14px',
          color: '#5d4037',
          align: 'center',
          lineSpacing: 4,
        },
      )
      .setOrigin(0.5);
  }

  private drawSun(x: number, y: number): void {
    const g = this.add.graphics();
    g.fillStyle(0xffe082, 0.55);
    g.fillCircle(x, y, 62);
    g.fillStyle(0xffd54f, 1);
    g.fillCircle(x, y, 42);
  }

  private drawClouds(): void {
    const clouds: [number, number, number][] = [
      [140, 88, 1],
      [400, 60, 0.75],
      [700, 118, 0.6],
      [250, 480, 0.85],
      [820, 430, 0.7],
    ];
    for (const [x, y, scale] of clouds) {
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(x, y, 22 * scale);
      g.fillCircle(x + 26 * scale, y + 4 * scale, 17 * scale);
      g.fillCircle(x - 25 * scale, y + 5 * scale, 15 * scale);
      g.fillRoundedRect(x - 30 * scale, y, 62 * scale, 18 * scale, 9 * scale);
      this.tweens.add({
        targets: g,
        x: 18,
        duration: 5000 + scale * 3000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  /** Grässlänt längst ned som ger menyn ett golv att stå på. */
  private drawGround(H: number): void {
    const g = this.add.graphics();
    g.fillStyle(0x8bc34a, 1);
    g.fillEllipse(480, H + 40, 1400, 190);
    g.fillStyle(0x9ccc65, 1);
    g.fillEllipse(480, H + 62, 1400, 190);
  }

  private makeButton(
    cx: number,
    cy: number,
    label: string,
    fill: number,
    stroke: number,
    onClick: () => void,
  ): void {
    const bg = this.add
      .rectangle(cx, cy, 300, 54, fill)
      .setStrokeStyle(3, stroke)
      .setInteractive({ useHandCursor: true });
    const txt = this.add
      .text(cx, cy, label, {
        fontFamily: 'sans-serif',
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    const hoverFill = Phaser.Display.Color.ValueToColor(fill).lighten(12).color;
    bg.on('pointerover', () => {
      bg.setFillStyle(hoverFill);
      bg.setScale(1.04);
      txt.setScale(1.04);
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(fill);
      bg.setScale(1);
      txt.setScale(1);
    });
    bg.on('pointerdown', () => {
      sfx.pop();
      onClick();
    });
  }
}
