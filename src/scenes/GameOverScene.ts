import Phaser from 'phaser';
import type { GameState } from '../state/GameState';
import { SaveSystem } from '../systems/SaveSystem';
import { INV_SCALE, VIEW_W, VIEW_H, setupHiResCamera } from '../utils/scale';
import { PALETTE, TEXT, css, lighten, darken } from '../config/theme';
import { addPanel } from '../ui/Panel';

export class GameOverScene extends Phaser.Scene {
  /** Sant medan scenen tonar ut, så att knappen bara kan tryckas en gång. */
  private leaving = false;

  constructor() {
    super('GameOver');
  }

  create(): void {
    this.leaving = false;
    const state = this.registry.get('gameState') as GameState;
    SaveSystem.clear();
    setupHiResCamera(this);
    this.cameras.main.fadeIn(500, 255, 250, 240);
    const W = VIEW_W;
    const H = VIEW_H;

    // Dämpad, rödtonad bakgrund – allvarligt men inte skrämmande.
    const bg = this.add.graphics();
    bg.fillGradientStyle(0xf6b89a, 0xf6b89a, 0xffe3d4, 0xffe3d4, 1);
    bg.fillRect(0, 0, W, H);

    addPanel(this, W / 2, H / 2 - 20, 500, 300);

    const title = this.add
      .text(
        W / 2,
        H / 2 - 120,
        'Konkurs!',
        TEXT.title({ fontSize: '44px', color: css(PALETTE.accent.deep) }),
      )
      .setOrigin(0.5);
    // Titeln faller på plats i stället för att bara dyka upp.
    title.setScale(0.7).setAlpha(0);
    this.tweens.add({
      targets: title,
      scale: 1,
      alpha: 1,
      duration: 520,
      ease: 'Back.easeOut',
    });

    this.add
      .text(
        W / 2,
        H / 2 - 46,
        `Butiken klarade sig i ${state.day} dagar.`,
        TEXT.body({ fontSize: '20px', color: css(PALETTE.text.strong) }),
      )
      .setOrigin(0.5);

    const rating = this.add
      .text(
        W / 2 + 12,
        H / 2 - 14,
        `Butiksbetyg: ${Math.round(state.rating)}`,
        TEXT.body({ fontSize: '20px', color: css(PALETTE.text.strong) }),
      )
      .setOrigin(0.5);
    this.add
      .sprite(rating.x - rating.width / 2 - 16, rating.y, 'iconStar')
      .setScale(INV_SCALE * 1.1);

    this.makeButton(W / 2, H / 2 + 70, 'Spela igen', () => {
      this.registry.remove('gameState');
      this.scene.start('Menu');
    });
  }

  private makeButton(cx: number, cy: number, label: string, onClick: () => void): void {
    const fill = PALETTE.success.base;
    const shade = this.add.rectangle(cx, cy + 5, 240, 52, PALETTE.panel.shadow, 0.16);
    const bg = this.add
      .rectangle(cx, cy, 240, 52, fill)
      .setStrokeStyle(3, PALETTE.success.deep)
      .setInteractive({ useHandCursor: true });
    const txt = this.add.text(cx, cy, label, TEXT.button()).setOrigin(0.5);

    const setLift = (dy: number): void => {
      bg.setPosition(cx, cy + dy);
      txt.setPosition(cx, cy + dy);
      shade.setAlpha(0.16 - dy * 0.02);
    };
    bg.on('pointerover', () => {
      bg.setFillStyle(lighten(fill, 10));
      setLift(-1);
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(fill);
      setLift(0);
    });
    bg.on('pointerdown', () => {
      // Ett andra klick skulle starta om uttoningen och låsa scenen.
      if (this.leaving) return;
      this.leaving = true;
      bg.setFillStyle(darken(fill, 8));
      setLift(3);
      this.cameras.main.fadeOut(300, 255, 250, 240);
      this.cameras.main.once('camerafadeoutcomplete', onClick);
    });
  }
}
