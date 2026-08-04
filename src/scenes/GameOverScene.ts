import Phaser from 'phaser';
import type { GameState } from '../state/GameState';
import { SaveSystem } from '../systems/SaveSystem';
import { VIEW_W, VIEW_H, setupHiResCamera } from '../utils/scale';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create(): void {
    const state = this.registry.get('gameState') as GameState;
    SaveSystem.clear();
    setupHiResCamera(this);
    const W = VIEW_W;
    const H = VIEW_H;

    this.add.rectangle(0, 0, W, H, 0xffe3d4).setOrigin(0, 0);

    const card = this.add.graphics();
    card.fillStyle(0xfffdf6, 1);
    card.fillRoundedRect(W / 2 - 250, H / 2 - 170, 500, 300, 24);
    card.lineStyle(3, 0xffffff, 1);
    card.strokeRoundedRect(W / 2 - 250, H / 2 - 170, 500, 300, 24);

    this.add
      .text(W / 2, H / 2 - 120, '💸 Konkurs!', {
        fontFamily: '"Baloo 2", sans-serif',
        fontSize: '44px',
        color: '#e64a19',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(
        W / 2,
        H / 2 - 40,
        `Butiken klarade sig i ${state.day} dagar.\nButiksbetyg: ⭐ ${Math.round(state.rating)}`,
        {
          fontFamily: '"Baloo 2", sans-serif',
          fontSize: '20px',
          color: '#4e342e',
          align: 'center',
        },
      )
      .setOrigin(0.5);

    const btn = this.add
      .rectangle(W / 2, H / 2 + 70, 240, 52, 0x43a047)
      .setStrokeStyle(3, 0x2e7d32)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setFillStyle(0x4caf50));
    btn.on('pointerout', () => btn.setFillStyle(0x43a047));
    this.add
      .text(W / 2, H / 2 + 70, 'Spela igen', {
        fontFamily: '"Baloo 2", sans-serif',
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    btn.on('pointerdown', () => {
      this.registry.remove('gameState');
      this.scene.start('Menu');
    });
  }
}
