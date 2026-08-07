import { isProductUnlocked, type GameState } from '../state/GameState';
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

  /** Nästa varusort som saknar en anställd påfyllare (annars undefined). */
  nextRestockerProduct(): string | undefined {
    const taken = new Set(
      this.state.staff.filter((m) => m.role === 'pafyllare').map((m) => m.productId),
    );
    return this.state.products.find(
      (p) => isProductUnlocked(this.state, p) && !taken.has(p.id),
    )?.id;
  }

  /** Har en repeaterbar uppgradering nått sitt tak (allt bemannat/utbyggt)? */
  atCapacity(def: UpgradeDef): boolean {
    if (def.id === 'anstalld_pafyllare') return !this.nextRestockerProduct();
    if (def.id === 'lagerutrymme') {
      return this.state.storageExpansions >= BALANCE.maxStorageExpansions;
    }
    if (def.id === 'extra_kassa') {
      return this.state.extraCheckouts >= BALANCE.maxCheckouts - 1;
    }
    return false;
  }

  /** Kan uppgraderingen köpas just nu (ägande, beroenden, pengar)? */
  canBuy(def: UpgradeDef): boolean {
    if (def.id === 'reklam' && this.state.adCampaignPending) return false;
    // Repeaterbara uppgraderingar med tak (påfyllare/lager/kassor) tar slut.
    if (this.atCapacity(def)) return false;
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
    // Anställ en påfyllare för nästa varusort utan påfyllare (repeaterbar).
    if (def.id === 'anstalld_pafyllare') {
      const productId = this.nextRestockerProduct();
      if (!productId) return false;
      this.state.staff.push({
        id: `pafyllare-${productId}`,
        role: 'pafyllare',
        productId,
        dailyWage: BALANCE.restockerWage,
      });
      return true;
    }
    // Bygg ut lagret (repeaterbar) – ingen post i upgrades-listan behövs.
    if (def.id === 'lagerutrymme') {
      this.state.storageExpansions++;
      return true;
    }
    // Extra kassa med egen kassör (repeaterbar).
    if (def.id === 'extra_kassa') {
      this.state.extraCheckouts++;
      this.state.staff.push({
        id: `kassor-${this.state.extraCheckouts}`,
        role: 'kassor',
        checkoutIndex: this.state.extraCheckouts,
        dailyWage: BALANCE.cashierWage,
      });
      return true;
    }

    this.state.upgrades.push(def.id);
    // "Större hyllor" delar varje hylla i två lådor (se shelfBinCount) – ingen
    // ändring av produktdatan behövs här.
    if (def.id === 'anstalld_kassor') {
      this.state.staff.push({
        id: 'kassor-0',
        role: 'kassor',
        checkoutIndex: 0,
        dailyWage: BALANCE.cashierWage,
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
