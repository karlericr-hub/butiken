import Phaser from 'phaser';
import { isProductUnlocked, type GameState } from '../state/GameState';
import { BALANCE } from '../config/balance';
import { UPGRADES, type UpgradeDef } from '../config/upgrades';
import { UpgradeSystem } from '../systems/UpgradeSystem';

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
  private kassaText!: Phaser.GameObjects.Text;
  private tooltip!: Phaser.GameObjects.Text;
  private upgradeSystem!: UpgradeSystem;
  private upgradeRefreshers: (() => void)[] = [];
  private orderContainer?: Phaser.GameObjects.Container;

  constructor() {
    super('Evening');
  }

  create(): void {
    this.state = this.registry.get('gameState') as GameState;
    this.upgradeSystem = new UpgradeSystem(this.state);
    this.order = {};
    this.orderTexts.clear();
    this.upgradeRefreshers = [];

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

    this.buildSummary(70, 96);
    this.buildOrderSection(520, 96);
    this.buildUpgradeSection(70, 396);
    this.buildWarning();

    this.makeButton(760, 596, 260, 44, `Starta dag ${this.state.day + 1} ▶`, () =>
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

    const kassaY = y + 40 + rows.length * 30;
    this.add.text(x, kassaY, 'Kassa', {
      fontFamily: 'sans-serif',
      fontSize: '16px',
      color: '#eceff1',
      fontStyle: 'bold',
    });
    this.kassaText = this.add
      .text(x + 300, kassaY, '', {
        fontFamily: 'sans-serif',
        fontSize: '16px',
        fontStyle: 'bold',
      })
      .setOrigin(1, 0);
    this.refreshKassaText();
  }

  private refreshKassaText(): void {
    this.kassaText.setText(`${this.state.money} kr`);
    this.kassaText.setColor(this.state.money >= 0 ? '#ffd54f' : '#ef5350');
  }

  /** Byggs om när en uppgradering låser upp en ny vara. */
  private rebuildOrderSection(): void {
    this.orderContainer?.destroy();
    this.orderTexts.clear();
    this.buildOrderSection(520, 96);
  }

  private buildOrderSection(x: number, y: number): void {
    const c = this.add.container(0, 0);
    this.orderContainer = c;

    c.add(
      this.add.text(x, y, 'Beställ varor till imorgon', {
        fontFamily: 'sans-serif',
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      }),
    );
    c.add(
      this.add.text(x, y + 28, 'Leverans kommer under förmiddagen', {
        fontFamily: 'sans-serif',
        fontSize: '13px',
        color: '#90a4ae',
      }),
    );

    const available = this.state.products.filter((p) => isProductUnlocked(this.state, p));
    available.forEach((p, i) => {
      const ry = y + 66 + i * 84;
      this.order[p.id] ??= 0;

      c.add(
        this.add.text(x, ry, `${p.name}  (${p.buyPrice} kr/st)`, {
          fontFamily: 'sans-serif',
          fontSize: '17px',
          color: '#eceff1',
          fontStyle: 'bold',
        }),
      );
      c.add(
        this.add.text(
          x,
          ry + 24,
          `På hyllan: ${p.currentStock}/${p.shelfCapacity}   I lagret: ${this.state.storage[p.id] ?? 0}`,
          {
            fontFamily: 'sans-serif',
            fontSize: '13px',
            color: '#90a4ae',
          },
        ),
      );

      c.add(this.makeButton(x + 250, ry + 14, 36, 36, '−', () => this.changeOrder(p.id, -1)));
      const qty = this.add
        .text(x + 300, ry + 14, '0', {
          fontFamily: 'sans-serif',
          fontSize: '20px',
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      this.orderTexts.set(p.id, qty);
      c.add(qty);
      c.add(this.makeButton(x + 350, ry + 14, 36, 36, '+', () => this.changeOrder(p.id, 1)));
    });

    const totalY = y + 66 + available.length * 84 + 8;
    this.totalText = this.add.text(x, totalY, '', {
      fontFamily: 'sans-serif',
      fontSize: '17px',
      color: '#ffd54f',
      fontStyle: 'bold',
    });
    c.add(this.totalText);
    this.moneyAfterText = this.add.text(x, totalY + 26, '', {
      fontFamily: 'sans-serif',
      fontSize: '14px',
      color: '#90a4ae',
    });
    c.add(this.moneyAfterText);
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

  private buildUpgradeSection(x: number, y: number): void {
    this.add.text(x, y, 'Uppgraderingar', {
      fontFamily: 'sans-serif',
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold',
    });

    this.tooltip = this.add.text(x, y + 34 + UPGRADES.length * 38 + 10, '', {
      fontFamily: 'sans-serif',
      fontSize: '13px',
      color: '#b0bec5',
      wordWrap: { width: 440 },
    });

    UPGRADES.forEach((def, i) => {
      this.buildUpgradeRow(def, x, y + 34 + i * 38);
    });
  }

  private buildUpgradeRow(def: UpgradeDef, x: number, y: number): void {
    const bg = this.add
      .rectangle(x, y, 410, 34, 0x2e3448)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x3e4663)
      .setInteractive({ useHandCursor: true });
    const name = this.add
      .text(x + 12, y + 17, def.name, {
        fontFamily: 'sans-serif',
        fontSize: '15px',
        color: '#eceff1',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5);
    const status = this.add
      .text(x + 398, y + 17, '', {
        fontFamily: 'sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
      })
      .setOrigin(1, 0.5);

    const refresh = (): void => {
      const owned = !def.repeatable && this.upgradeSystem.has(def.id);
      const pendingAd = def.id === 'reklam' && this.state.adCampaignPending;
      const reqMet = this.upgradeSystem.requirementsMet(def);
      if (owned || pendingAd) {
        status.setText(pendingAd ? '✔ Beställd' : '✔ Köpt');
        status.setColor('#81c784');
        name.setColor('#78909c');
        bg.setFillStyle(0x252a3a);
      } else if (!reqMet) {
        const names = (def.requires ?? [])
          .map((r) => UPGRADES.find((u) => u.id === r)?.name ?? r)
          .join(', ');
        status.setText(`🔒 ${names}`);
        status.setColor('#78909c');
        name.setColor('#78909c');
        bg.setFillStyle(0x252a3a);
      } else {
        status.setText(`${def.cost} kr`);
        status.setColor(this.state.money >= def.cost ? '#ffd54f' : '#ef9a9a');
        name.setColor('#eceff1');
        bg.setFillStyle(0x2e3448);
      }
    };
    refresh();
    this.upgradeRefreshers.push(refresh);

    bg.on('pointerover', () => {
      bg.setStrokeStyle(1, 0x5c6bc0);
      this.tooltip.setText(def.description);
    });
    bg.on('pointerout', () => {
      bg.setStrokeStyle(1, 0x3e4663);
      this.tooltip.setText('');
    });
    bg.on('pointerdown', () => {
      if (this.upgradeSystem.buy(def)) {
        this.upgradeRefreshers.forEach((r) => r());
        // Låste köpet upp en ny vara? Då ska den gå att beställa direkt.
        if (this.state.products.some((p) => p.requiresUpgrade === def.id)) {
          this.rebuildOrderSection();
        }
        this.refreshOrderTexts();
        this.refreshKassaText();
      }
    });
  }

  private buildWarning(): void {
    if (this.state.money >= 0) return;
    this.warningText = this.add
      .text(
        520,
        482,
        `⚠️ Kassan är negativ! Kväll ${this.state.debtEvenings} av ${BALANCE.maxDebtEvenings} – sedan går butiken i konkurs.`,
        {
          fontFamily: 'sans-serif',
          fontSize: '15px',
          color: '#ef9a9a',
          fontStyle: 'bold',
          wordWrap: { width: 420 },
        },
      )
      .setOrigin(0, 0);

    if (!this.state.loanTaken) {
      this.makeButton(640, 548, 260, 38, `Ta nödlån (+${BALANCE.emergencyLoanAmount} kr)`, () => {
        this.state.loanTaken = true;
        this.state.money += BALANCE.emergencyLoanAmount;
        this.warningText?.setText('Nödlånet är insatt på kontot. Lycka till!');
        this.warningText?.setColor('#aed581');
        this.refreshOrderTexts();
        this.refreshKassaText();
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

    // Reklamkampanj beställd i kväll gäller under morgondagen.
    this.state.adActiveToday = this.state.adCampaignPending;
    this.state.adCampaignPending = false;

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
  ): Phaser.GameObjects.GameObject[] {
    const bg = this.add
      .rectangle(cx, cy, w, h, 0x43a047)
      .setStrokeStyle(2, 0x2e7d32)
      .setInteractive({ useHandCursor: true });
    const txt = this.add
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
    return [bg, txt];
  }
}
