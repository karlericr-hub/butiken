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
    if (def.id === 'battre_hyllor') {
      for (const p of this.state.products) {
        p.shelfCapacity = Math.ceil(p.shelfCapacity * BALANCE.shelfCapacityMultiplier);
      }
    }
    return true;
  }

  /** Betalningstid i kassan (kortterminal snabbar upp). */
  get payTimeMs(): number {
    return BALANCE.payTimeMs * (this.has('kortterminal') ? BALANCE.cardPayTimeMultiplier : 1);
  }

  /** Tid för att fylla på en hylla (bättre hyllor snabbar upp). */
  get restockTimeMs(): number {
    return (
      BALANCE.restockTimeMs * (this.has('battre_hyllor') ? BALANCE.betterShelfRestockMultiplier : 1)
    );
  }

  static get all(): UpgradeDef[] {
    return UPGRADES;
  }
}
