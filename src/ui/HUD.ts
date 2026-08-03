import Phaser from 'phaser';
import type { GameState } from '../state/GameState';
import type { Checkout } from '../entities/Checkout';

/** Alltid synlig överlagring: pengar, dag, betyg och kö. */
export class HUD {
  private moneyText: Phaser.GameObjects.Text;
  private dayText: Phaser.GameObjects.Text;
  private statsText: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    private state: GameState,
    private checkout: Checkout,
  ) {
    const panel = scene.add.rectangle(0, 0, scene.scale.width, 44, 0x1e1e2e, 0.85);
    panel.setOrigin(0, 0);
    panel.setDepth(10000);

    this.moneyText = scene.add
      .text(16, 10, '', {
        fontFamily: 'sans-serif',
        fontSize: '20px',
        color: '#ffd54f',
        fontStyle: 'bold',
      })
      .setDepth(10001);

    this.dayText = scene.add
      .text(scene.scale.width / 2, 10, '', {
        fontFamily: 'sans-serif',
        fontSize: '18px',
        color: '#ffffff',
      })
      .setOrigin(0.5, 0)
      .setDepth(10001);

    this.statsText = scene.add
      .text(scene.scale.width - 16, 10, '', {
        fontFamily: 'sans-serif',
        fontSize: '14px',
        color: '#b0bec5',
      })
      .setOrigin(1, 0)
      .setDepth(10001);

    scene.add
      .text(
        scene.scale.width / 2,
        scene.scale.height - 14,
        'Klicka på kassan för att ta betalt  •  Klicka på en hylla för att fylla på',
        {
          fontFamily: 'sans-serif',
          fontSize: '14px',
          color: '#eceff1',
        },
      )
      .setOrigin(0.5, 1)
      .setDepth(10001);

    this.update();
  }

  update(timeText?: string): void {
    this.moneyText.setText(`${this.state.money} kr`);
    const clock = timeText ? `  •  ${timeText}` : '';
    this.dayText.setText(`Dag ${this.state.day}${clock}  •  ⭐ ${Math.round(this.state.rating)}`);
    const s = this.state.stats;
    this.statsText.setText(
      `Kö: ${this.checkout.queue.length}   Betjänade: ${s.servedToday}   Förlorade: ${s.lostToday}`,
    );
  }
}
