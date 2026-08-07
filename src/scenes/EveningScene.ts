import Phaser from 'phaser';
import { isProductUnlocked, shelfBinCount, type GameState } from '../state/GameState';
import { BALANCE } from '../config/balance';
import { UPGRADES, type UpgradeDef } from '../config/upgrades';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import { PRODUCT_COLORS } from '../config/products';
import { sfx } from '../systems/Sfx';
import { SaveSystem } from '../systems/SaveSystem';
import { INV_SCALE, VIEW_W, VIEW_H, setupHiResCamera } from '../utils/scale';
import { PALETTE, TEXT, css, lighten, darken, mix } from '../config/theme';
import { addPanel } from '../ui/Panel';

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
  /** Stänger ett öppet inmatningsfält för beställning (om något är öppet). */
  private activeInputCleanup?: (apply: boolean) => void;
  private cardTerminalFeeToday = 0;
  /** Sant medan scenen tonar ut, så att knappen bara kan tryckas en gång. */
  private leaving = false;

  constructor() {
    super('Evening');
  }

  create(): void {
    setupHiResCamera(this);
    this.state = this.registry.get('gameState') as GameState;
    this.upgradeSystem = new UpgradeSystem(this.state);
    this.order = {};
    this.orderTexts.clear();
    this.upgradeRefreshers = [];
    this.leaving = false;

    // Betala hyra, löner och terminalhyra för dagen.
    this.wagesToday = this.state.staff.reduce((sum, m) => sum + m.dailyWage, 0);
    this.cardTerminalFeeToday = this.state.upgrades.includes('kortterminal')
      ? BALANCE.cardTerminalDailyFee
      : 0;
    const fixedCosts = BALANCE.rentPerDay + this.wagesToday + this.cardTerminalFeeToday;
    this.state.money -= fixedCosts;
    this.state.stats.costsToday += fixedCosts;

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

    const W = VIEW_W;
    this.cameras.main.fadeIn(380, 255, 250, 240);

    // Varm kvällshimmel som bakgrund till planeringsfasen.
    const bg = this.add.graphics();
    bg.fillGradientStyle(0xffd9a0, 0xffd9a0, 0xfff1d4, 0xfff1d4, 1);
    bg.fillRect(0, 0, W, VIEW_H);
    // Några stjärnor högt upp, mest som stämning.
    bg.fillStyle(0xffffff, 0.55);
    for (let i = 0; i < 22; i++) {
      bg.fillCircle(
        Phaser.Math.Between(0, W),
        Phaser.Math.Between(6, 70),
        Phaser.Math.FloatBetween(0.8, 1.8),
      );
    }

    // Kortpaneler bakom de tre kolumnerna
    for (const [cx, cw] of [
      [COL_SUMMARY_X - 14, 312],
      [COL_ORDER_X - 14, 332],
      [COL_UPGRADES_X - 14, 316],
    ] as [number, number][]) {
      addPanel(this, cx + cw / 2, COL_TOP_Y - 16 + 248, cw, 496);
    }

    const title = this.add
      .text(
        W / 2 + 14,
        24,
        `Dag ${this.state.day} är slut!`,
        TEXT.title({ fontSize: '28px', color: css(PALETTE.accent.deep) }),
      )
      .setOrigin(0.5, 0);
    this.add
      .sprite(title.x - title.width / 2 - 20, 40, 'iconMoon')
      .setScale(INV_SCALE * 1.3);

    this.buildSummary(COL_SUMMARY_X, COL_TOP_Y);
    this.buildOrderSection(COL_ORDER_X, COL_TOP_Y);
    this.buildUpgradeSection(COL_UPGRADES_X, COL_TOP_Y);
    this.buildWarning();

    this.makeButton(800, 596, 260, 46, `Starta dag ${this.state.day + 1} ▶`, () => {
      // Ett andra klick skulle starta om uttoningen och låsa scenen.
      if (this.leaving) return;
      this.leaving = true;
      this.activeInputCleanup?.(true);
      this.cameras.main.fadeOut(300, 255, 250, 240);
      this.cameras.main.once('camerafadeoutcomplete', () => this.startNextDay());
    });

    // Ta bort ett eventuellt öppet inmatningsfält när scenen lämnas.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.activeInputCleanup?.(false));
  }

  private buildSummary(x: number, y: number): void {
    const s = this.state.stats;
    const profit = s.revenueToday - s.costsToday;
    const purchases =
      s.costsToday - BALANCE.rentPerDay - this.wagesToday - this.cardTerminalFeeToday;

    this.sectionTitle(x, y, 'Dagens resultat');

    const good = css(PALETTE.success.deep);
    const bad = css(PALETTE.danger.deep);
    const muted = css(PALETTE.text.body);

    const rows: [string, string, string][] = [
      ['Försäljning', `+${s.revenueToday} kr`, good],
      ['Varuinköp', `-${purchases} kr`, bad],
      ['Hyra', `-${BALANCE.rentPerDay} kr`, bad],
    ];
    if (this.cardTerminalFeeToday > 0) {
      rows.push(['Kortterminal', `-${this.cardTerminalFeeToday} kr`, bad]);
    }
    if (this.wagesToday > 0) {
      rows.push(['Löner', `-${this.wagesToday} kr`, bad]);
    }
    rows.push(
      ['Vinst', `${profit >= 0 ? '+' : ''}${profit} kr`, profit >= 0 ? good : bad],
      ['', '', muted],
      ['Betjänade kunder', `${s.servedToday}`, muted],
      ['Förlorade kunder', `${s.lostToday}`, muted],
      ['Butiksbetyg', `${Math.round(this.state.rating)}`, css(PALETTE.accent.deep)],
      ['Sålda varor idag', '', css(PALETTE.text.strong)],
    );
    for (const p of this.state.products.filter((prod) => isProductUnlocked(this.state, prod))) {
      rows.push([`  ${p.name}`, `${s.soldToday[p.id] ?? 0} st`, muted]);
    }

    rows.forEach(([label, value, color], i) => {
      const ry = y + 34 + i * 24;
      if (!label) return;
      // Varannan rad får en svag botten så att blicken följer raden.
      if (value && i % 2 === 1) {
        this.add
          .rectangle(x - 6, ry - 2, 280, 22, PALETTE.accent.light, 0.1)
          .setOrigin(0, 0);
      }
      this.add.text(x, ry, label, TEXT.label({ fontSize: '14px', color: css(PALETTE.text.strong) }));
      const valueText = this.add
        .text(x + 268, ry, value, TEXT.label({ fontSize: '14px', color, fontStyle: 'bold' }))
        .setOrigin(1, 0);
      // Stjärnan ritas som ikon i stället för emoji, precis som i HUD:en.
      if (label === 'Butiksbetyg') {
        this.add
          .sprite(valueText.x - valueText.width - 11, ry + 9, 'iconStar')
          .setScale(INV_SCALE * 0.85);
      }
    });

    const kassaY = y + 34 + rows.length * 24 + 6;
    this.add.text(x, kassaY, 'Kassa', TEXT.label({ fontSize: '15px', color: css(PALETTE.text.strong), fontStyle: 'bold' }));
    this.kassaText = this.add
      .text(x + 268, kassaY, '', TEXT.label({ fontSize: '15px', fontStyle: 'bold' }))
      .setOrigin(1, 0);
    this.refreshKassaText();
  }

  /** Rubrik med bärnstensstreck under – används av alla tre kolumner. */
  private sectionTitle(x: number, y: number, label: string): void {
    const t = this.add.text(x, y, label, TEXT.heading({ fontSize: '18px' }));
    const rule = this.add.graphics();
    rule.fillStyle(PALETTE.accent.base, 0.85);
    rule.fillRoundedRect(x, y + t.height + 1, 46, 3, 1.5);
  }

  private refreshKassaText(): void {
    this.kassaText.setText(`${this.state.money} kr`);
    this.kassaText.setColor(
      this.state.money >= 0 ? css(PALETTE.accent.deep) : css(PALETTE.danger.deep),
    );
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

    this.sectionTitle(x, y, 'Beställ varor');
    c.add(this.add.text(x, y + 26, 'Leverans imorgon förmiddag', TEXT.small()));

    const available = this.state.products.filter((p) => isProductUnlocked(this.state, p));
    available.forEach((p, i) => {
      const ry = y + 58 + i * 78;
      this.order[p.id] ??= 0;

      // Färgprick som knyter raden till varans färg på hyllan.
      const dot = this.add.graphics();
      dot.fillStyle(PRODUCT_COLORS[p.id] ?? 0xcccccc, 1);
      dot.fillCircle(x + 5, ry + 9, 5);
      dot.lineStyle(1.5, darken(PRODUCT_COLORS[p.id] ?? 0xcccccc, 20), 1);
      dot.strokeCircle(x + 5, ry + 9, 5);
      c.add(dot);

      c.add(
        this.add.text(
          x + 16,
          ry,
          `${p.name}  (${p.buyPrice} kr/st)`,
          TEXT.label({ fontSize: '15px', color: css(PALETTE.text.strong), fontStyle: 'bold' }),
        ),
      );
      c.add(
        this.add.text(
          x + 16,
          ry + 22,
          `Hylla: ${p.currentStock}/${p.shelfCapacity * shelfBinCount(this.state)}   Lager: ${this.state.storage[p.id] ?? 0}`,
          TEXT.small(),
        ),
      );

      c.add(this.makeButton(x + 190, ry + 12, 32, 32, '−', () => this.changeOrder(p.id, -1)));
      const qty = this.add
        .text(
          x + 231,
          ry + 12,
          '0',
          TEXT.body({
            color: css(PALETTE.text.strong),
            fontStyle: 'bold',
            backgroundColor: css(mix(PALETTE.panel.card, PALETTE.accent.light, 0.2)),
            padding: { x: 7, y: 4 },
          }),
        )
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      // Klicka på siffran för att skriva in antalet direkt.
      qty.on('pointerdown', () => this.editOrder(p.id, qty));
      this.orderTexts.set(p.id, qty);
      c.add(qty);
      c.add(this.makeButton(x + 272, ry + 12, 32, 32, '+', () => this.changeOrder(p.id, 1)));
    });

    const totalY = y + 58 + available.length * 78 + 4;
    this.totalText = this.add.text(
      x,
      totalY,
      '',
      TEXT.label({ fontSize: '15px', color: css(PALETTE.accent.deep), fontStyle: 'bold' }),
    );
    c.add(this.totalText);
    this.moneyAfterText = this.add.text(x, totalY + 24, '', TEXT.small({ fontSize: '13px' }));
    c.add(this.moneyAfterText);
    this.refreshOrderTexts();
  }

  private get orderCost(): number {
    return this.state.products.reduce((sum, p) => sum + (this.order[p.id] ?? 0) * p.buyPrice, 0);
  }

  private changeOrder(productId: string, delta: number): void {
    this.setOrder(productId, (this.order[productId] ?? 0) + delta);
  }

  /**
   * Lägger ett riktigt HTML-inmatningsfält ovanpå siffran så att spelaren kan
   * trycka på den och skriva antalet direkt (canvasen skalas med FIT).
   */
  private editOrder(productId: string, qtyText: Phaser.GameObjects.Text): void {
    this.activeInputCleanup?.(false);

    const canvas = this.game.canvas;
    const rect = canvas.getBoundingClientRect();
    // Duken visar hela designytan (VIEW_W×VIEW_H), så designkoordinater mappas
    // mot dukens visade storlek – inte mot den superskalade renderupplösningen.
    const scaleX = rect.width / VIEW_W;
    const scaleY = rect.height / VIEW_H;
    // Minst 16px teckenstorlek – annars zoomar mobilwebbläsare in i fältet och
    // rutan hoppar ur läge. Rutan dimensioneras utifrån den valda storleken.
    const fontPx = Math.max(16, Math.round(18 * scaleY));
    const w = Math.max(48, Math.round(46 * scaleX));
    const h = Math.max(fontPx + 12, Math.round(30 * scaleY));
    // Centrera rutan över siffran.
    const cx = rect.left + qtyText.x * scaleX;
    const cy = rect.top + qtyText.y * scaleY;

    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'numeric';
    input.value = String(this.order[productId] ?? 0);
    Object.assign(input.style, {
      position: 'fixed',
      left: `${Math.round(cx - w / 2)}px`,
      top: `${Math.round(cy - h / 2)}px`,
      width: `${w}px`,
      height: `${h}px`,
      margin: '0',
      padding: '0',
      boxSizing: 'border-box',
      textAlign: 'center',
      fontFamily: '"Baloo 2", sans-serif',
      fontSize: `${fontPx}px`,
      fontWeight: '700',
      color: '#4e342e',
      background: '#fffdf6',
      border: '2px solid #ffa726',
      borderRadius: '6px',
      zIndex: '1000',
    } as Partial<CSSStyleDeclaration>);

    qtyText.setVisible(false);

    let done = false;
    const finish = (apply: boolean): void => {
      if (done) return;
      done = true;
      input.removeEventListener('blur', onBlur);
      document.removeEventListener('pointerdown', onOutside, true);
      if (apply) {
        const value = parseInt(input.value, 10);
        if (!Number.isNaN(value)) this.setOrder(productId, value);
      }
      input.remove();
      qtyText.setVisible(true);
      if (this.activeInputCleanup === finish) this.activeInputCleanup = undefined;
    };
    const onBlur = (): void => finish(true);
    // Backstop: att trycka någon annanstans (t.ex. på canvasen) stänger rutan,
    // även när canvasen inte tar emot fokus och blur därför inte utlöses.
    const onOutside = (e: PointerEvent): void => {
      if (e.target !== input) finish(true);
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        finish(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        finish(false);
      }
    });
    input.addEventListener('blur', onBlur);

    this.activeInputCleanup = finish;
    document.body.appendChild(input);
    input.focus();
    input.select();
    // Lägg till lyssnaren efter aktuell klickhändelse så den inte stänger direkt.
    setTimeout(() => {
      if (!done) document.addEventListener('pointerdown', onOutside, true);
    }, 0);
  }

  /** Sätter beställt antal och håller det inom saldot och ≥ 0. */
  private setOrder(productId: string, value: number): void {
    const product = this.state.products.find((p) => p.id === productId);
    if (!product) return;
    let next = Math.max(0, Math.floor(value));
    // Beställ aldrig mer än kassan räcker till.
    const costWithout = this.orderCost - (this.order[productId] ?? 0) * product.buyPrice;
    if (product.buyPrice > 0) {
      const affordable = Math.floor((this.state.money - costWithout) / product.buyPrice);
      next = Math.min(next, Math.max(0, affordable));
    }
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
    this.sectionTitle(x, y, 'Uppgraderingar');

    this.tooltip = this.add.text(
      x,
      y + 34 + UPGRADES.length * 36 + 8,
      '',
      TEXT.small({ color: css(PALETTE.text.body), wordWrap: { width: 285 } }),
    );

    UPGRADES.forEach((def, i) => {
      this.buildUpgradeRow(def, x, y + 34 + i * 36);
    });
  }

  private buildUpgradeRow(def: UpgradeDef, x: number, y: number): void {
    const idle = mix(PALETTE.panel.card, PALETTE.accent.light, 0.18);
    const dimmed = mix(PALETTE.panel.card, PALETTE.text.muted, 0.14);
    const edge = mix(PALETTE.accent.base, PALETTE.panel.card, 0.55);

    const bg = this.add
      .rectangle(x, y, 285, 32, idle)
      .setOrigin(0, 0)
      .setStrokeStyle(1.5, edge)
      .setInteractive({ useHandCursor: true });
    const name = this.add
      .text(
        x + 28,
        y + 16,
        def.name,
        TEXT.small({ fontSize: '13px', color: css(PALETTE.text.strong), fontStyle: 'bold' }),
      )
      .setOrigin(0, 0.5);
    // Statusikonen till vänster: bock när den är köpt, hänglås när den är låst.
    const mark = this.add.sprite(x + 15, y + 16, 'iconCheck').setScale(INV_SCALE * 0.8);
    const status = this.add
      .text(x + 277, y + 16, '', TEXT.small({ fontSize: '12px', fontStyle: 'bold' }))
      .setOrigin(1, 0.5);

    const refresh = (): void => {
      const owned = !def.repeatable && this.upgradeSystem.has(def.id);
      const pendingAd = def.id === 'reklam' && this.state.adCampaignPending;
      const reqMet = this.upgradeSystem.requirementsMet(def);
      if (owned || pendingAd) {
        mark.setTexture('iconCheck').setVisible(true);
        status.setText(pendingAd ? 'Beställd' : 'Köpt');
        status.setColor(css(PALETTE.success.deep));
        name.setColor(css(PALETTE.text.muted));
        bg.setFillStyle(dimmed);
      } else if (!reqMet) {
        mark.setTexture('iconLock').setVisible(true);
        status.setText('');
        name.setColor(css(PALETTE.text.muted));
        bg.setFillStyle(dimmed);
      } else {
        mark.setVisible(false);
        status.setText(`${def.cost} kr`);
        status.setColor(
          this.state.money >= def.cost ? css(PALETTE.accent.deep) : css(PALETTE.danger.deep),
        );
        name.setColor(css(PALETTE.text.strong));
        bg.setFillStyle(idle);
      }
      // Namnet flyttar in när ingen ikon visas, så raden aldrig ser tom ut.
      name.setX(mark.visible ? x + 28 : x + 12);
    };
    refresh();
    this.upgradeRefreshers.push(refresh);

    bg.on('pointerover', () => {
      bg.setStrokeStyle(2, PALETTE.accent.warm);
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
      bg.setStrokeStyle(1.5, edge);
      this.tooltip.setText('');
    });
    bg.on('pointerdown', () => {
      if (this.upgradeSystem.buy(def)) {
        sfx.chaChing();
        // Kort grön blink bekräftar köpet.
        bg.setFillStyle(PALETTE.success.light);
        this.tweens.addCounter({
          from: 0,
          to: 1,
          duration: 420,
          onComplete: () => this.upgradeRefreshers.forEach((r) => r()),
        });
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
    // Röd varningsruta så att konkursrisken inte går att missa.
    const box = this.add.graphics();
    box.fillStyle(PALETTE.danger.base, 0.1);
    box.fillRoundedRect(COL_SUMMARY_X - 8, 458, 296, 76, 8);
    box.lineStyle(2, PALETTE.danger.base, 0.6);
    box.strokeRoundedRect(COL_SUMMARY_X - 8, 458, 296, 76, 8);

    this.warningText = this.add
      .text(
        COL_SUMMARY_X,
        466,
        `Kassan är negativ! Kväll ${this.state.debtEvenings} av ${BALANCE.maxDebtEvenings} – sedan går butiken i konkurs.`,
        TEXT.label({
          fontSize: '14px',
          color: css(PALETTE.danger.deep),
          fontStyle: 'bold',
          wordWrap: { width: 280 },
        }),
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
          this.warningText?.setColor(css(PALETTE.success.deep));
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
      soldToday: {},
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
    const fill = PALETTE.success.base;
    const shade = this.add.rectangle(cx, cy + 4, w, h, PALETTE.panel.shadow, 0.16);
    const bg = this.add
      .rectangle(cx, cy, w, h, fill)
      .setStrokeStyle(2, PALETTE.success.deep)
      .setInteractive({ useHandCursor: true });
    const txt = this.add
      .text(cx, cy, label, TEXT.button({ fontSize: h > 44 ? '19px' : '16px' }))
      .setOrigin(0.5);

    // Knappen lyfts vid hovring och trycks ned vid klick – skuggan står kvar.
    const setLift = (dy: number): void => {
      bg.setPosition(cx, cy + dy);
      txt.setPosition(cx, cy + dy);
      shade.setAlpha(0.16 - dy * 0.02);
    };
    bg.on('pointerover', () => {
      bg.setFillStyle(lighten(fill, 10));
      setLift(-1);
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(fill);
      setLift(0);
    });
    bg.on('pointerup', () => {
      bg.setFillStyle(lighten(fill, 10));
      setLift(-1);
    });
    bg.on('pointerdown', () => {
      bg.setFillStyle(darken(fill, 8));
      setLift(3);
      sfx.pop();
      onClick();
    });
    return [bg, txt, shade];
  }
}
