import Phaser from 'phaser';
import type { GameState } from '../state/GameState';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create(): void {
    const state = this.registry.get('gameState') as GameState;
    const W = this.scale.width;
    const H = this.scale.height;

    this.add.rectangle(0, 0, W, H, 0x1e1e2e).setOrigin(0, 0);

    this.add
      .text(W / 2, H / 2 - 120, '💸 Konkurs!', {
        fontFamily: 'sans-serif',
        fontSize: '44px',
        color: '#ef5350',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(
        W / 2,
        H / 2 - 40,
        `Butiken klarade sig i ${state.day} dagar.\nButiksbetyg: ⭐ ${Math.round(state.rating)}`,
        {
          fontFamily: 'sans-serif',
          fontSize: '20px',
          color: '#eceff1',
          align: 'center',
        },
      )
      .setOrigin(0.5);

    const btn = this.add
      .rectangle(W / 2, H / 2 + 70, 240, 52, 0x43a047)
      .setStrokeStyle(2, 0x2e7d32)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(W / 2, H / 2 + 70, 'Spela igen', {
        fontFamily: 'sans-serif',
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    btn.on('pointerdown', () => {
      this.registry.remove('gameState');
      this.scene.start('Game');
    });
  }
}
