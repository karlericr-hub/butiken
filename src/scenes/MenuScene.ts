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

    this.add.rectangle(0, 0, W, H, 0x1e1e2e).setOrigin(0, 0);

    this.add
      .text(W / 2, H / 2 - 170, '🛒 Butiken', {
        fontFamily: 'sans-serif',
        fontSize: '56px',
        color: '#ffd54f',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(W / 2, H / 2 - 105, 'Driv din egen butik – hinner du med allt?', {
        fontFamily: 'sans-serif',
        fontSize: '18px',
        color: '#b0bec5',
      })
      .setOrigin(0.5);

    const savedState = SaveSystem.load();
    if (savedState) {
      this.makeButton(W / 2, H / 2 - 10, `Fortsätt (dag ${savedState.day})`, () => {
        this.registry.set('gameState', savedState);
        this.scene.start('Game');
      });
    }

    this.makeButton(W / 2, H / 2 + (savedState ? 60 : -10), 'Nytt spel', () => {
      SaveSystem.clear();
      this.registry.remove('gameState');
      this.scene.start('Game');
    });

    this.add
      .text(
        W / 2,
        H - 60,
        'Klicka på kassan för att ta betalt, på hyllorna för att fylla på\noch på golvet för att gå. Beställ varor och köp uppgraderingar på kvällen!',
        {
          fontFamily: 'sans-serif',
          fontSize: '14px',
          color: '#78909c',
          align: 'center',
        },
      )
      .setOrigin(0.5);
  }

  private makeButton(cx: number, cy: number, label: string, onClick: () => void): void {
    const bg = this.add
      .rectangle(cx, cy, 300, 52, 0x43a047)
      .setStrokeStyle(2, 0x2e7d32)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(cx, cy, label, {
        fontFamily: 'sans-serif',
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    bg.on('pointerover', () => bg.setFillStyle(0x4caf50));
    bg.on('pointerout', () => bg.setFillStyle(0x43a047));
    bg.on('pointerdown', () => {
      sfx.pop();
      onClick();
    });
  }
}
