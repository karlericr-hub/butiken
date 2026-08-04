import Phaser from 'phaser';
import type { GameState } from '../state/GameState';
import type { Checkout } from '../entities/Checkout';
import { VIEW_W } from '../utils/scale';

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
    const panel = scene.add.rectangle(0, 0, VIEW_W, 48, 0xfffbf0, 0.95);
    panel.setOrigin(0, 0);
    panel.setDepth(10000);
    const edge = scene.add.rectangle(0, 48, VIEW_W, 3, 0xffb300, 0.9);
    edge.setOrigin(0, 0);
    edge.setDepth(10000);

    this.moneyText = scene.add
      .text(16, 11, '', {
        fontFamily: '"Baloo 2", sans-serif',
        fontSize: '21px',
        color: '#ef6c00',
        fontStyle: 'bold',
      })
      .setDepth(10001);

    this.dayText = scene.add
      .text(VIEW_W / 2, 12, '', {
        fontFamily: '"Baloo 2", sans-serif',
        fontSize: '18px',
        color: '#4e342e',
      })
      .setOrigin(0.5, 0)
      .setDepth(10001);

    this.statsText = scene.add
      .text(VIEW_W - 16, 13, '', {
        fontFamily: '"Baloo 2", sans-serif',
        fontSize: '15px',
        color: '#6d4c41',
      })
      .setOrigin(1, 0)
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
