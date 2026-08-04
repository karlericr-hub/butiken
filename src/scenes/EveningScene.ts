import Phaser from 'phaser';
import { isProductUnlocked, type GameState } from '../state/GameState';
import { BALANCE } from '../config/balance';
import { UPGRADES, type UpgradeDef } from '../config/upgrades';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import { sfx } from '../systems/Sfx';
import { SaveSystem } from '../systems/SaveSystem';

const COL_SUMMARY_X = 40;
const COL_ORDER_X = 348;
const COL_UPGRADES_X = 645;
const COL_TOP_Y = 84;

/**
 * Kvällsfasen: lugn paus utan tidspress. Dagssammanfattning, hyra och
 * löner, beställning av varor inför nästa dag, uppgraderingsbutik samt
 * konkursvarning/nödlån.
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
  private wagesToday = 0;

  constructor() {
    super('Evening');
  }

  create(): void {
    this.state = this.registry.get('gameState') as GameState;
    this.upgradeSystem = new UpgradeSystem(this.state);
    this.order = {};
    this.orderTexts.clear();
    this.upgradeRefreshers = [];

    // Betala hyra och löner för dagen.
    this.wagesToday = this.state.staff.reduce((sum, m) => sum + m.dailyWage, 0);
    this.state.money -= BALANCE.rentPerDay + this.wagesToday;
    this.state.stats.costsToday += BALANCE.rentPerDay + this.wagesToday;

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
    this.add.rectangle(0, 0, W, this.scale.height, 0xffecc7).setOrigin(0, 0);

    // Kortpaneler bakom de tre kolumnerna
    const cards = this.add.graphics();
    for (const [cx, cw] of [
      [COL_SUMMARY_X - 14, 312],
      [COL_ORDER_X - 14, 332],
      [COL_UPGRADES_X - 14, 316],
    ] as [number, number][]) {
      cards.fillStyle(0xfffdf6, 1);
      cards.fillRoundedRect(cx, COL_TOP_Y - 16, cw, 496, 12);
      cards.lineStyle(1, 0xe6d5ae, 1);
      cards.strokeRoundedRect(cx, COL_TOP_Y - 16, cw, 496, 12);
    }

    this.add
      .text(W / 2, 24, `🌙 Dag ${this.state.day} är slut!`, {
        fontFamily: '"Baloo 2", sans-serif',
        fontSize: '28px',
        color: '#ef6c00',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0);

    this.buildSummary(COL_SUMMARY_X, COL_TOP_Y);
    this.buildOrderSection(COL_ORDER_X, COL_TOP_Y);
    this.buildUpgradeSection(COL_UPGRADES_X, COL_TOP_Y);
    this.buildWarning();

    this.makeButton(800, 596, 260, 46, `Starta dag ${this.state.day + 1} ▶`, () =>
      this.startNextDay(),
    );
  }

  private buildSummary(x: number, y: number): void {
    const s = this.state.stats;
    const profit = s.revenueToday - s.costsToday;
    const purchases = s.costsToday - BALANCE.rentPerDay - this.wagesToday;

    this.add.text(x, y, 'Dagens resultat', {
      fontFamily: '"Baloo 2", sans-serif',
      fontSize: '18px',
      color: '#4e342e',
      fontStyle: 'bold',
    });

    const rows: [string, string, string][] = [
      ['Försäljning', `+${s.revenueToday} kr`, '#2e7d32'],
      ['Varuinköp', `-${purchases} kr`, '#c62828'],
      ['Hyra', `-${BALANCE.rentPerDay} kr`, '#c62828'],
    ];
    if (this.wagesToday > 0) {
      rows.push(['Löner', `-${this.wagesToday} kr`, '#c62828']);
    }
    rows.push(
      ['Vinst', `${profit >= 0 ? '+' : ''}${profit} kr`, profit >= 0 ? '#2e7d32' : '#c62828'],
      ['', '', '#ffffff'],
      ['Betjänade kunder', `${s.servedToday}`, '#6d4c41'],
      ['Förlorade kunder', `${s.lostToday}`, '#6d4c41'],
      ['Butiksbetyg', `⭐ ${Math.round(this.state.rating)}`, '#ef6c00'],
    );

    rows.forEach(([label, value, color], i) => {
      const ry = y + 34 + i * 26;
      if (!label) return;
      this.add.text(x, ry, label, {
        fontFamily: '"Baloo 2", sans-serif',
        fontSize: '14px',
        color: '#4e342e',
      });
      this.add
        .text(x + 268, ry, value, {
          fontFamily: '"Baloo 2", sans-serif',
          fontSize: '14px',
          color,
          fontStyle: 'bold',
        })
        .setOrigin(1, 0);
    });

    const kassaY = y + 34 + rows.length * 26 + 6;
    this.add.text(x, kassaY, 'Kassa', {
      fontFamily: '"Baloo 2", sans-serif',
      fontSize: '15px',
      color: '#4e342e',
      fontStyle: 'bold',
    });
    this.kassaText = this.add
      .text(x + 268, kassaY, '', {
        fontFamily: '"Baloo 2", sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
      })
      .setOrigin(1, 0);
    this.refreshKassaText();
  }

  private refreshKassaText(): void {
    this.kassaText.setText(`${this.state.money} kr`);
    this.kassaText.setColor(this.state.money >= 0 ? '#ef6c00' : '#c62828');
  }

  /** Byggs om när en uppgradering låser upp en ny vara. */
  private rebuildOrderSection(): void {
    this.orderContainer?.destroy();
    this.orderTexts.clear();
    this.buildOrderSection(COL_ORDER_X, COL_TOP_Y);
  }

  private buildOrderSection(x: number, y: number): void {
    const c = this.add.container(0, 0);
    this.orderContainer = c;

    c.add(
      this.add.text(x, y, 'Beställ varor', {
        fontFamily: '"Baloo 2", sans-serif',
        fontSize: '18px',
        color: '#4e342e',
        fontStyle: 'bold',
      }),
    );
    c.add(
      this.add.text(x, y + 26, 'Leverans imorgon förmiddag', {
        fontFamily: '"Baloo 2", sans-serif',
        fontSize: '12px',
        color: '#8d6e63',
      }),
    );

    const available = this.state.products.filter((p) => isProductUnlocked(this.state, p));
    available.forEach((p, i) => {
      const ry = y + 58 + i * 78;
      this.order[p.id] ??= 0;

      c.add(
        this.add.text(x, ry, `${p.name}  (${p.buyPrice} kr/st)`, {
          fontFamily: '"Baloo 2", sans-serif',
          fontSize: '15px',
          color: '#4e342e',
          fontStyle: 'bold',
        }),
      );
      c.add(
        this.add.text(
          x,
          ry + 22,
          `Hylla: ${p.currentStock}/${p.shelfCapacity}   Lager: ${this.state.storage[p.id] ?? 0}`,
          {
            fontFamily: '"Baloo 2", sans-serif',
            fontSize: '12px',
            color: '#8d6e63',
          },
        ),
      );

      c.add(this.makeButton(x + 190, ry + 12, 32, 32, '−', () => this.changeOrder(p.id, -1)));
      const qty = this.add
        .text(x + 231, ry + 12, '0', {
          fontFamily: '"Baloo 2", sans-serif',
          fontSize: '18px',
          color: '#4e342e',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      this.orderTexts.set(p.id, qty);
      c.add(qty);
      c.add(this.makeButton(x + 272, ry + 12, 32, 32, '+', () => this.changeOrder(p.id, 1)));
    });

    const totalY = y + 58 + available.length * 78 + 4;
    this.totalText = this.add.text(x, totalY, '', {
      fontFamily: '"Baloo 2", sans-serif',
      fontSize: '15px',
      color: '#ef6c00',
      fontStyle: 'bold',
    });
    c.add(this.totalText);
    this.moneyAfterText = this.add.text(x, totalY + 24, '', {
      fontFamily: '"Baloo 2", sans-serif',
      fontSize: '13px',
      color: '#8d6e63',
    });
    c.add(this.moneyAfterText);
    this.refreshOrderTexts();
  }

  private get orderCost(): number {
    return this.state.products.reduce((sum, p) => sum + (this.order[p.id] ?? 0) * p.buyPrice, 0);
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
      fontFamily: '"Baloo 2", sans-serif',
      fontSize: '18px',
      color: '#4e342e',
      fontStyle: 'bold',
    });

    this.tooltip = this.add.text(x, y + 34 + UPGRADES.length * 36 + 8, '', {
      fontFamily: '"Baloo 2", sans-serif',
      fontSize: '12px',
      color: '#6d4c41',
      wordWrap: { width: 285 },
    });

    UPGRADES.forEach((def, i) => {
      this.buildUpgradeRow(def, x, y + 34 + i * 36);
    });
  }

  private buildUpgradeRow(def: UpgradeDef, x: number, y: number): void {
    const bg = this.add
      .rectangle(x, y, 285, 32, 0xf7f0dd)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0xdccba4)
      .setInteractive({ useHandCursor: true });
    const name = this.add
      .text(x + 10, y + 16, def.name, {
        fontFamily: '"Baloo 2", sans-serif',
        fontSize: '13px',
        color: '#4e342e',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5);
    const status = this.add
      .text(x + 277, y + 16, '', {
        fontFamily: '"Baloo 2", sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
      })
      .setOrigin(1, 0.5);

    const refresh = (): void => {
      const owned = !def.repeatable && this.upgradeSystem.has(def.id);
      const pendingAd = def.id === 'reklam' && this.state.adCampaignPending;
      const reqMet = this.upgradeSystem.requirementsMet(def);
      if (owned || pendingAd) {
        status.setText(pendingAd ? '✔ Beställd' : '✔ Köpt');
        status.setColor('#2e7d32');
        name.setColor('#a1887f');
        bg.setFillStyle(0xefe6d2);
      } else if (!reqMet) {
        status.setText('🔒');
        status.setColor('#a1887f');
        name.setColor('#a1887f');
        bg.setFillStyle(0xefe6d2);
      } else {
        status.setText(`${def.cost} kr`);
        status.setColor(this.state.money >= def.cost ? '#ef6c00' : '#c62828');
        name.setColor('#4e342e');
        bg.setFillStyle(0xf7f0dd);
      }
    };
    refresh();
    this.upgradeRefreshers.push(refresh);

    bg.on('pointerover', () => {
      bg.setStrokeStyle(1, 0xffa726);
      let text = def.description;
      if (!this.upgradeSystem.requirementsMet(def)) {
        const names = (def.requires ?? [])
          .map((r) => UPGRADES.find((u) => u.id === r)?.name ?? r)
          .join(', ');
        text += `  (Kräver: ${names})`;
      }
      this.tooltip.setText(text);
    });
    bg.on('pointerout', () => {
      bg.setStrokeStyle(1, 0xdccba4);
      this.tooltip.setText('');
    });
    bg.on('pointerdown', () => {
      if (this.upgradeSystem.buy(def)) {
        sfx.chaChing();
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
        COL_SUMMARY_X,
        466,
        `⚠️ Kassan är negativ! Kväll ${this.state.debtEvenings} av ${BALANCE.maxDebtEvenings} – sedan går butiken i konkurs.`,
        {
          fontFamily: '"Baloo 2", sans-serif',
          fontSize: '14px',
          color: '#c62828',
          fontStyle: 'bold',
          wordWrap: { width: 280 },
        },
      )
      .setOrigin(0, 0);

    if (!this.state.loanTaken) {
      this.makeButton(
        COL_SUMMARY_X + 125,
        560,
        250,
        38,
        `Ta nödlån (+${BALANCE.emergencyLoanAmount} kr)`,
        () => {
          this.state.loanTaken = true;
          this.state.money += BALANCE.emergencyLoanAmount;
          this.warningText?.setText('Nödlånet är insatt på kontot. Lycka till!');
          this.warningText?.setColor('#2e7d32');
          this.refreshOrderTexts();
          this.refreshKassaText();
        },
      );
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

    // Autospar i slutet av varje dag.
    SaveSystem.save(this.state);

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
        fontFamily: '"Baloo 2", sans-serif',
        fontSize: h > 44 ? '19px' : '16px',
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
    return [bg, txt];
  }
}
