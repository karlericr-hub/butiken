import Phaser from 'phaser';
import type { GameState } from '../state/GameState';
import type { Checkout } from '../entities/Checkout';

/** Alltid synlig överlagring: pengar, dag/klocka, betyg och kö. */
export class HUD {
  private moneyText: Phaser.GameObjects.Text;
  private dayText: Phaser.GameObjects.Text;
  private statsText: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    private state: GameState,
    private checkout: Checkout,
  ) {
    const panel = scene.add.rectangle(0, 0, scene.scale.width, 48, 0xfffbf0, 0.95);
    panel.setOrigin(0, 0);
    panel.setDepth(10000);
    const edge = scene.add.rectangle(0, 48, scene.scale.width, 3, 0xffb300, 0.9);
    edge.setOrigin(0, 0);
    edge.setDepth(10000);

    this.moneyText = scene.add
      .text(16, 11, '', {
        fontFamily: 'sans-serif',
        fontSize: '21px',
        color: '#ef6c00',
        fontStyle: 'bold',
      })
      .setDepth(10001);

    this.dayText = scene.add
      .text(scene.scale.width / 2, 12, '', {
        fontFamily: 'sans-serif',
        fontSize: '18px',
        color: '#4e342e',
      })
      .setOrigin(0.5, 0)
      .setDepth(10001);

    this.statsText = scene.add
      .text(scene.scale.width - 16, 13, '', {
        fontFamily: 'sans-serif',
        fontSize: '15px',
        color: '#6d4c41',
      })
      .setOrigin(1, 0)
      .setDepth(10001);

    scene.add
      .text(
        scene.scale.width / 2,
        scene.scale.height - 12,
        'Klicka på kassan för att ta betalt  •  Klicka på en hylla för att fylla på',
        {
          fontFamily: 'sans-serif',
          fontSize: '14px',
          color: '#4e342e',
          backgroundColor: '#fffbf0',
          padding: { x: 12, y: 5 },
        },
      )
      .setOrigin(0.5, 1)
      .setDepth(10001);

    this.update();
  }

  update(timeText?: string): void {
    this.moneyText.setText(`💰 ${this.state.money} kr`);
    const clock = timeText ? `  •  ${timeText}` : '';
    this.dayText.setText(`📅 Dag ${this.state.day}${clock}`);
    const s = this.state.stats;
    this.statsText.setText(
      `⭐ ${Math.round(this.state.rating)}    🧍 ${this.checkout.queue.length}    ✅ ${s.servedToday}    ❌ ${s.lostToday}`,
    );
  }
}
