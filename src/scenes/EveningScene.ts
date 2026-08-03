import Phaser from 'phaser';
import type { GameState } from '../state/GameState';
import { BALANCE } from '../config/balance';

/**
 * Kvällsfasen: lugn paus utan tidspress. Dagssammanfattning, hyra,
 * beställning av varor inför nästa dag samt konkursvarning/nödlån.
 */
export class EveningScene extends Phaser.Scene {
  private state!: GameState;
  private order: Record<string, number> = {};
  private orderTexts = new Map<string, Phaser.GameObjects.Text>();
  private totalText!: Phaser.GameObjects.Text;
  private moneyAfterText!: Phaser.GameObjects.Text;
  private warningText?: Phaser.GameObjects.Text;

  constructor() {
    super('Evening');
  }

  create(): void {
    this.state = this.registry.get('gameState') as GameState;
    this.order = {};
    this.orderTexts.clear();

    // Betala hyra för dagen.
    this.state.money -= BALANCE.rentPerDay;
    this.state.stats.costsToday += BALANCE.rentPerDay;

    // Konkursräkning: negativt saldo på kvällen ökar skuldräknaren.
    if (this.state.money < 0) {
      this.state.debtEvenings++;
    } else {
      this.state.debtEvenings = 0;
    }
    if (this.state.debtEvenings >= BALANCE.maxDebtEvenings) {
      this.scene.start('GameOver');
      return;
    }

    const W = this.scale.width;
    this.add.rectangle(0, 0, W, this.scale.height, 0x1e1e2e).setOrigin(0, 0);

    this.add
      .text(W / 2, 34, `🌙 Dag ${this.state.day} är slut!`, {
        fontFamily: 'sans-serif',
        fontSize: '30px',
        color: '#ffd54f',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0);

    this.buildSummary(90, 100);
    this.buildOrderSection(520, 100);
    this.buildWarning();

    this.makeButton(W / 2, 570, 260, 52, `Starta dag ${this.state.day + 1} ▶`, () =>
      this.startNextDay(),
    );
  }

  private buildSummary(x: number, y: number): void {
    const s = this.state.stats;
    const profit = s.revenueToday - s.costsToday;

    this.add.text(x, y, 'Dagens resultat', {
      fontFamily: 'sans-serif',
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold',
    });

    const rows: [string, string, string][] = [
      ['Försäljning', `+${s.revenueToday} kr`, '#aed581'],
      ['Varuinköp', `-${s.costsToday - BALANCE.rentPerDay} kr`, '#ef9a9a'],
      ['Hyra', `-${BALANCE.rentPerDay} kr`, '#ef9a9a'],
      ['Vinst', `${profit >= 0 ? '+' : ''}${profit} kr`, profit >= 0 ? '#aed581' : '#ef9a9a'],
      ['', '', '#ffffff'],
      ['Betjänade kunder', `${s.servedToday}`, '#b0bec5'],
      ['Förlorade kunder', `${s.lostToday}`, '#b0bec5'],
      ['Butiksbetyg', `⭐ ${Math.round(this.state.rating)}`, '#ffd54f'],
      ['Kassa', `${this.state.money} kr`, this.state.money >= 0 ? '#ffd54f' : '#ef5350'],
    ];

    rows.forEach(([label, value, color], i) => {
      const ry = y + 40 + i * 30;
      if (!label) return;
      this.add.text(x, ry, label, {
        fontFamily: 'sans-serif',
        fontSize: '16px',
        color: '#eceff1',
      });
      this.add
        .text(x + 300, ry, value, {
          fontFamily: 'sans-serif',
          fontSize: '16px',
          color,
          fontStyle: 'bold',
        })
        .setOrigin(1, 0);
    });
  }

  private buildOrderSection(x: number, y: number): void {
    this.add.text(x, y, 'Beställ varor till imorgon', {
      fontFamily: 'sans-serif',
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    this.add.text(x, y + 28, 'Leverans kommer under förmiddagen', {
      fontFamily: 'sans-serif',
      fontSize: '13px',
      color: '#90a4ae',
    });

    this.state.products.forEach((p, i) => {
      const ry = y + 66 + i * 84;
      this.order[p.id] = 0;

      this.add.text(x, ry, `${p.name}  (${p.buyPrice} kr/st)`, {
        fontFamily: 'sans-serif',
        fontSize: '17px',
        color: '#eceff1',
        fontStyle: 'bold',
      });
      this.add.text(
        x,
        ry + 24,
        `På hyllan: ${p.currentStock}/${p.shelfCapacity}   I lagret: ${this.state.storage[p.id] ?? 0}`,
        {
          fontFamily: 'sans-serif',
          fontSize: '13px',
          color: '#90a4ae',
        },
      );

      this.makeButton(x + 250, ry + 14, 36, 36, '−', () => this.changeOrder(p.id, -1));
      const qty = this.add
        .text(x + 300, ry + 14, '0', {
          fontFamily: 'sans-serif',
          fontSize: '20px',
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      this.orderTexts.set(p.id, qty);
      this.makeButton(x + 350, ry + 14, 36, 36, '+', () => this.changeOrder(p.id, 1));
    });

    const totalY = y + 66 + this.state.products.length * 84 + 8;
    this.totalText = this.add.text(x, totalY, '', {
      fontFamily: 'sans-serif',
      fontSize: '17px',
      color: '#ffd54f',
      fontStyle: 'bold',
    });
    this.moneyAfterText = this.add.text(x, totalY + 26, '', {
      fontFamily: 'sans-serif',
      fontSize: '14px',
      color: '#90a4ae',
    });
    this.refreshOrderTexts();
  }

  private get orderCost(): number {
    return this.state.products.reduce(
      (sum, p) => sum + (this.order[p.id] ?? 0) * p.buyPrice,
      0,
    );
  }

  private changeOrder(productId: string, delta: number): void {
    const product = this.state.products.find((p) => p.id === productId);
    if (!product) return;
    const next = Math.max(0, (this.order[productId] ?? 0) + delta);
    const costDiff = (next - (this.order[productId] ?? 0)) * product.buyPrice;
    // Beställ aldrig mer än kassan räcker till.
    if (delta > 0 && this.orderCost + costDiff > this.state.money) return;
    this.order[productId] = next;
    this.refreshOrderTexts();
  }

  private refreshOrderTexts(): void {
    for (const [id, text] of this.orderTexts) {
      text.setText(String(this.order[id] ?? 0));
    }
    this.totalText.setText(`Beställning: ${this.orderCost} kr`);
    this.moneyAfterText.setText(`Kassa efter beställning: ${this.state.money - this.orderCost} kr`);
  }

  private buildWarning(): void {
    if (this.state.money >= 0) return;
    const W = this.scale.width;
    this.warningText = this.add
      .text(
        W / 2,
        468,
        `⚠️  Kassan är negativ! Kväll ${this.state.debtEvenings} av ${BALANCE.maxDebtEvenings} – sedan går butiken i konkurs.`,
        {
          fontFamily: 'sans-serif',
          fontSize: '16px',
          color: '#ef9a9a',
          fontStyle: 'bold',
        },
      )
      .setOrigin(0.5, 0);

    if (!this.state.loanTaken) {
      this.makeButton(W / 2, 522, 280, 40, `Ta nödlån (+${BALANCE.emergencyLoanAmount} kr)`, () => {
        this.state.loanTaken = true;
        this.state.money += BALANCE.emergencyLoanAmount;
        this.warningText?.setText('Nödlånet är insatt på kontot. Lycka till!');
        this.warningText?.setColor('#aed581');
        this.refreshOrderTexts();
      });
    }
  }

  private startNextDay(): void {
    // Betala beställningen nu; den levereras under morgondagen.
    const cost = this.orderCost;
    this.state.money -= cost;
    this.state.pendingOrder = Object.fromEntries(
      Object.entries(this.order).filter(([, qty]) => qty > 0),
    );

    this.state.day++;
    this.state.stats = {
      servedToday: 0,
      lostToday: 0,
      revenueToday: 0,
      costsToday: cost,
    };
    this.scene.start('Game');
  }

  private makeButton(
    cx: number,
    cy: number,
    w: number,
    h: number,
    label: string,
    onClick: () => void,
  ): void {
    const bg = this.add
      .rectangle(cx, cy, w, h, 0x43a047)
      .setStrokeStyle(2, 0x2e7d32)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(cx, cy, label, {
        fontFamily: 'sans-serif',
        fontSize: h > 44 ? '20px' : '17px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    bg.on('pointerover', () => bg.setFillStyle(0x4caf50));
    bg.on('pointerout', () => bg.setFillStyle(0x43a047));
    bg.on('pointerdown', onClick);
  }
}
