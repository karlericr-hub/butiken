import Phaser from 'phaser';
import type { GameState } from '../state/GameState';
import type { Checkout } from '../entities/Checkout';
import { INV_SCALE, VIEW_W } from '../utils/scale';
import { PALETTE, DEPTH, TEXT, css } from '../config/theme';

/** En ikon med tillhörande siffra i statusraden. */
interface Stat {
  icon: Phaser.GameObjects.Sprite;
  text: Phaser.GameObjects.Text;
}

const BAR_H = 52;

/** Alltid synlig överlagring: pengar, dag/klocka, betyg och kö. */
export class HUD {
  private moneyText: Phaser.GameObjects.Text;
  private dayText: Phaser.GameObjects.Text;
  private rating: Stat;
  private queue: Stat;
  private served: Stat;
  private lost: Stat;
  /** Pengarna räknas upp mjukt i stället för att hoppa till nytt värde. */
  private shownMoney: number;
  private moneyTween?: Phaser.Tweens.Tween;

  constructor(
    private scene: Phaser.Scene,
    private state: GameState,
    private checkout: Checkout,
  ) {
    const panel = scene.add.rectangle(0, 0, VIEW_W, BAR_H, PALETTE.panel.bar, 0.97);
    panel.setOrigin(0, 0).setDepth(DEPTH.hudPanel);
    // Mjuk skugga under raden lyfter den från spelplanen.
    const shade = scene.add.rectangle(0, BAR_H + 3, VIEW_W, 8, PALETTE.panel.shadow, 0.1);
    shade.setOrigin(0, 0).setDepth(DEPTH.hudPanel);
    const edge = scene.add.rectangle(0, BAR_H, VIEW_W, 3, PALETTE.accent.base, 0.95);
    edge.setOrigin(0, 0).setDepth(DEPTH.hudPanel);

    const coin = scene.add
      .sprite(26, BAR_H / 2, 'iconCoin')
      .setScale(INV_SCALE * 1.15)
      .setDepth(DEPTH.hudText);
    // Myntet gör ett kort snurr då och då så att blicken hittar saldot.
    // Snurret ska vara snabbt – ett långsamt snurr gör att myntet står
    // ihoptryckt större delen av tiden.
    scene.tweens.add({
      targets: coin,
      scaleX: INV_SCALE * 0.2,
      duration: 260,
      yoyo: true,
      repeat: -1,
      repeatDelay: 5200,
      ease: 'Sine.easeInOut',
    });

    this.shownMoney = state.money;
    this.moneyText = scene.add
      .text(
        42,
        BAR_H / 2,
        '',
        TEXT.heading({ fontSize: '22px', color: css(PALETTE.accent.deep) }),
      )
      .setOrigin(0, 0.5)
      .setDepth(DEPTH.hudText);

    scene.add
      .sprite(VIEW_W / 2 - 74, BAR_H / 2, 'iconCalendar')
      .setScale(INV_SCALE)
      .setDepth(DEPTH.hudText);
    this.dayText = scene.add
      .text(VIEW_W / 2 - 60, BAR_H / 2, '', TEXT.body({ color: css(PALETTE.text.strong) }))
      .setOrigin(0, 0.5)
      .setDepth(DEPTH.hudText);

    // Statusgruppen till höger, från vänster till höger.
    this.rating = this.makeStat(VIEW_W - 320, 'iconStar');
    this.queue = this.makeStat(VIEW_W - 240, 'iconPerson');
    this.served = this.makeStat(VIEW_W - 160, 'iconCheck');
    this.lost = this.makeStat(VIEW_W - 80, 'iconCross');

    this.update();
  }

  private makeStat(x: number, iconKey: string): Stat {
    const icon = this.scene.add
      .sprite(x, BAR_H / 2, iconKey)
      .setScale(INV_SCALE)
      .setDepth(DEPTH.hudText);
    const text = this.scene.add
      .text(x + 14, BAR_H / 2, '0', TEXT.label({ fontSize: '17px', fontStyle: 'bold' }))
      .setOrigin(0, 0.5)
      .setDepth(DEPTH.hudText);
    return { icon, text };
  }

  /** Sätter siffran och puffar till ikonen när värdet ändrats. */
  private setStat(stat: Stat, value: string): void {
    if (stat.text.text === value) return;
    stat.text.setText(value);
    this.scene.tweens.add({
      targets: stat.icon,
      scale: INV_SCALE * 1.3,
      duration: 110,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
  }

  update(timeText?: string): void {
    // Saldot tickar mot sitt nya värde i stället för att hoppa dit.
    if (Math.round(this.shownMoney) !== this.state.money) {
      this.moneyTween?.remove();
      this.moneyTween = this.scene.tweens.add({
        targets: this,
        shownMoney: this.state.money,
        duration: 500,
        ease: 'Cubic.easeOut',
      });
    }
    this.moneyText.setText(`${Math.round(this.shownMoney)} kr`);

    const clock = timeText ? `  •  ${timeText}` : '';
    this.dayText.setText(`Dag ${this.state.day}${clock}`);

    const s = this.state.stats;
    this.setStat(this.rating, String(Math.round(this.state.rating)));
    this.setStat(this.queue, String(this.checkout.queue.length));
    this.setStat(this.served, String(s.servedToday));
    this.setStat(this.lost, String(s.lostToday));
  }
}
