import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem';
import { sfx } from '../systems/Sfx';
import { INV_SCALE, VIEW_W, VIEW_H, setupHiResCamera } from '../utils/scale';
import { PALETTE, TEXT, css, lighten, darken, mix } from '../config/theme';
import { addPanel } from '../ui/Panel';

export class MenuScene extends Phaser.Scene {
  /** Sant medan scenen tonar ut, så att knapparna bara kan tryckas en gång. */
  private leaving = false;

  constructor() {
    super('Menu');
  }

  create(): void {
    setupHiResCamera(this);
    this.leaving = false;
    const W = VIEW_W;
    const H = VIEW_H;

    this.cameras.main.fadeIn(400, 255, 250, 240);

    // Himmel med mjuk gradient uppifrån och ned.
    const sky = this.add.graphics();
    sky.fillGradientStyle(
      PALETTE.sky.high,
      PALETTE.sky.high,
      PALETTE.sky.menu,
      PALETTE.sky.menu,
      1,
    );
    sky.fillRect(0, 0, W, H);

    this.drawSun(W - 110, 90);
    this.drawClouds();
    this.drawGround(H);

    // Gräddvitt kort som håller ihop titel och knappar.
    addPanel(this, W / 2, 266, 500, 340);

    const cart = this.add.sprite(W / 2 - 148, 168, 'iconCart').setScale(INV_SCALE * 2.1);
    this.tweens.add({
      targets: cart,
      y: cart.y - 10,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.add
      .text(
        W / 2 + 44,
        168,
        'Butiken',
        TEXT.title({
          color: css(PALETTE.warning.deep),
          stroke: css(PALETTE.panel.edge),
          strokeThickness: 7,
          shadow: { offsetX: 0, offsetY: 4, color: '#e6510038', blur: 8, fill: true },
        }),
      )
      .setOrigin(0.5);

    this.add
      .text(
        W / 2,
        230,
        'Driv din egen butik – hinner du med allt?',
        TEXT.body({ color: css(PALETTE.text.body) }),
      )
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

  }

  private drawSun(x: number, y: number): void {
    const g = this.add.graphics();
    // Flera glorielager ger solen en mjuk utstrålning i stället för en kant.
    for (let i = 5; i >= 1; i--) {
      g.fillStyle(PALETTE.sun.glow, 0.1);
      g.fillCircle(x, y, 42 + i * 9);
    }
    g.fillStyle(PALETTE.sun.glow, 0.55);
    g.fillCircle(x, y, 50);
    g.fillStyle(PALETTE.sun.core, 1);
    g.fillCircle(x, y, 42);
    g.fillStyle(lighten(PALETTE.sun.core, 12), 1);
    g.fillCircle(x - 8, y - 8, 30);
    this.tweens.add({
      targets: g,
      alpha: 0.86,
      duration: 2600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
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
      // Dunig ytterkant först, tät kärna sedan.
      g.fillStyle(0xffffff, 0.3);
      g.fillCircle(x, y + 2, 26 * scale);
      g.fillCircle(x + 28 * scale, y + 6 * scale, 20 * scale);
      g.fillCircle(x - 27 * scale, y + 7 * scale, 18 * scale);
      g.fillStyle(0xffffff, 0.94);
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
    // Tät häck i fjärran: överlappande klot som till hälften döljs av
    // grässlänten, så att de läser som en rad buskar och inte som lösa prickar.
    g.fillStyle(mix(PALETTE.grass.dark, PALETTE.sky.menu, 0.35), 1);
    for (let x = -30; x < VIEW_W + 50; x += Phaser.Math.Between(26, 46)) {
      g.fillCircle(x, H - 78 + Phaser.Math.Between(-6, 8), Phaser.Math.Between(20, 32));
    }
    g.fillStyle(PALETTE.grass.dark, 1);
    g.fillEllipse(480, H + 40, 1400, 190);
    g.fillStyle(PALETTE.grass.base, 1);
    g.fillEllipse(480, H + 62, 1400, 190);
    g.fillStyle(PALETTE.grass.light, 0.7);
    g.fillEllipse(480, H + 84, 1400, 190);
  }

  private makeButton(
    cx: number,
    cy: number,
    label: string,
    fill: number,
    stroke: number,
    onClick: () => void,
  ): void {
    const W = 300;
    const Hb = 54;
    // Skuggan ligger kvar när knappen trycks ned, så knappen känns fysisk.
    const shade = this.add.rectangle(cx, cy + 5, W, Hb, PALETTE.panel.shadow, 0.16);
    const bg = this.add
      .rectangle(cx, cy, W, Hb, fill)
      .setStrokeStyle(3, stroke)
      .setInteractive({ useHandCursor: true });
    const txt = this.add.text(cx, cy, label, TEXT.button()).setOrigin(0.5);

    const hoverFill = lighten(fill, 12);
    const pressFill = darken(fill, 8);
    const setLift = (dy: number, scale: number): void => {
      bg.setPosition(cx, cy + dy).setScale(scale);
      txt.setPosition(cx, cy + dy).setScale(scale);
      shade.setAlpha(0.16 - dy * 0.02);
    };

    bg.on('pointerover', () => {
      bg.setFillStyle(hoverFill);
      setLift(-1, 1.04);
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(fill);
      setLift(0, 1);
    });
    bg.on('pointerdown', () => {
      // En andra klick skulle starta om uttoningen och låsa scenen.
      if (this.leaving) return;
      this.leaving = true;
      bg.setFillStyle(pressFill);
      setLift(3, 0.98);
      sfx.pop();
      // Kort fördröjning så att nedtryckningen hinner synas.
      this.time.delayedCall(90, () => {
        this.cameras.main.fadeOut(280, 255, 250, 240);
        this.cameras.main.once('camerafadeoutcomplete', onClick);
      });
    });
    bg.on('pointerup', () => {
      bg.setFillStyle(hoverFill);
      setLift(-1, 1.04);
    });
  }
}
