import type { GameState } from '../state/GameState';
import { UPGRADES, type UpgradeDef } from '../config/upgrades';
import { BALANCE } from '../config/balance';

/** Hanterar köpta uppgraderingar och deras effekter på spelet. */
export class UpgradeSystem {
  constructor(private state: GameState) {}

  has(id: string): boolean {
    return this.state.upgrades.includes(id);
  }

  requirementsMet(def: UpgradeDef): boolean {
    return (def.requires ?? []).every((r) => this.has(r));
  }

  /** Kan uppgraderingen köpas just nu (ägande, beroenden, pengar)? */
  canBuy(def: UpgradeDef): boolean {
    if (def.id === 'reklam' && this.state.adCampaignPending) return false;
    if (!def.repeatable && this.has(def.id)) return false;
    return this.requirementsMet(def) && this.state.money >= def.cost;
  }

  buy(def: UpgradeDef): boolean {
    if (!this.canBuy(def)) return false;
    this.state.money -= def.cost;

    if (def.id === 'reklam') {
      this.state.adCampaignPending = true;
      return true;
    }

    this.state.upgrades.push(def.id);
    // "Större hyllor" delar varje hylla i två lådor (se shelfBinCount) – ingen
    // ändring av produktdatan behövs här.
    if (def.id === 'anstalld_kassor') {
      this.state.staff.push({ id: 'kassor', role: 'kassor', dailyWage: BALANCE.cashierWage });
    }
    if (def.id === 'anstalld_pafyllare') {
      this.state.staff.push({
        id: 'pafyllare',
        role: 'pafyllare',
        dailyWage: BALANCE.restockerWage,
      });
    }
    if (def.id === 'paketombud') {
      this.state.isParcelAgent = true;
    }
    return true;
  }

  /** Betalningstid i kassan (kortterminal snabbar upp). */
  get payTimeMs(): number {
    return BALANCE.payTimeMs * (this.has('kortterminal') ? BALANCE.cardPayTimeMultiplier : 1);
  }

  /** Tid för att fylla på en låda. */
  get restockTimeMs(): number {
    return BALANCE.restockTimeMs;
  }

  /** Kundtakt-multiplikator (större butik lockar fler kunder). */
  get spawnMultiplier(): number {
    return this.has('storre_butik') ? BALANCE.biggerShopSpawnMultiplier : 1;
  }

  /** Max kölängd vid kassan (större butik rymmer fler). */
  get maxQueueLength(): number {
    return BALANCE.maxQueueLength + (this.has('storre_butik') ? BALANCE.biggerShopQueueBonus : 0);
  }

  static get all(): UpgradeDef[] {
    return UPGRADES;
  }
}
