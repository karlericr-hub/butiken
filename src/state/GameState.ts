import { BALANCE } from '../config/balance';

export interface Product {
  id: string;
  name: string;
  category: 'basvara' | 'kyld' | 'godis' | 'frukt' | 'paket';
  buyPrice: number;
  sellPrice: number;
  /** Kapacitet per låda. Utan "Större hyllor" har hyllan en låda, annars två. */
  shelfCapacity: number;
  /** Totalt antal enheter på hyllan (summan av lådorna). */
  currentStock: number;
  /**
   * Lager per låda. Med "Större hyllor" delas hyllan i två lådor som fylls på
   * var för sig. Saknas fältet (äldre sparfiler) härleds det från currentStock.
   */
  binStock?: number[];
  unlockLevel: number;
  /** Uppgradering som måste ägas för att varan ska säljas. */
  requiresUpgrade?: string;
}

export function isProductUnlocked(state: GameState, product: Product): boolean {
  return !product.requiresUpgrade || state.upgrades.includes(product.requiresUpgrade);
}

/** Antal separata lådor per hylla – dubblas av uppgraderingen "Större hyllor". */
export function shelfBinCount(state: GameState): number {
  return state.upgrades.includes('battre_hyllor') ? BALANCE.shelfBoxCount : 1;
}

/** Total lagerkapacitet: bas plus köpta utbyggnader. */
export function storageCapacity(state: GameState): number {
  return BALANCE.baseStorageCapacity + state.storageExpansions * BALANCE.storageExpansionAmount;
}

/** Antal enheter som just nu ligger i lagret (summan över alla varor). */
export function storageUsed(state: GameState): number {
  return Object.values(state.storage).reduce((sum, n) => sum + (n ?? 0), 0);
}

/** Antal kassor totalt (huvudkassan plus köpta extrakassor). */
export function checkoutCount(state: GameState): number {
  return 1 + state.extraCheckouts;
}

export interface StaffMember {
  id: string;
  role: 'kassor' | 'pafyllare';
  dailyWage: number;
  /** Påfyllare: den varusort denna anställd sköter (fyller bara en sort). */
  productId?: string;
  /** Kassör: vilken kassa (0 = huvudkassan) den anställda står vid. */
  checkoutIndex?: number;
}

export interface GameState {
  day: number;
  money: number;
  rating: number;
  products: Product[];
  upgrades: string[];
  staff: StaffMember[];
  isParcelAgent: boolean;
  /** Varor i lagerrummet (levererade men inte utställda), per produkt-id. */
  storage: Record<string, number>;
  /** Antal köpta lagerutbyggnader – varje utbyggnad ger mer lagerplats. */
  storageExpansions: number;
  /** Antal extra kassor som köpts till (utöver huvudkassan). */
  extraCheckouts: number;
  /** Beställning som levereras under nästa dag, per produkt-id. */
  pendingOrder: Record<string, number>;
  /** Antal kvällar i rad med negativt saldo. */
  debtEvenings: number;
  loanTaken: boolean;
  /** Reklamkampanj beställd i kväll (gäller imorgon). */
  adCampaignPending: boolean;
  /** Reklamkampanj aktiv idag. */
  adActiveToday: boolean;
  /** Vänlig hint som visas vid nästa dags start (sätts av DifficultySystem). */
  pendingHint?: string;
  difficulty: {
    spawnRate: number;
    patienceModifier: number;
  };
  stats: {
    servedToday: number;
    lostToday: number;
    revenueToday: number;
    costsToday: number;
    /** Antal sålda enheter per produkt-id under dagen. */
    soldToday: Record<string, number>;
  };
}

export function createInitialState(startMoney: number, products: Product[]): GameState {
  return {
    day: 1,
    money: startMoney,
    rating: 80,
    products: products.map((p) => ({ ...p })),
    upgrades: [],
    staff: [],
    isParcelAgent: false,
    storage: Object.fromEntries(
      products.map((p) => [p.id, p.requiresUpgrade ? 0 : p.shelfCapacity]),
    ),
    storageExpansions: 0,
    extraCheckouts: 0,
    pendingOrder: {},
    debtEvenings: 0,
    loanTaken: false,
    adCampaignPending: false,
    adActiveToday: false,
    difficulty: {
      spawnRate: 1,
      patienceModifier: 1,
    },
    stats: {
      servedToday: 0,
      lostToday: 0,
      revenueToday: 0,
      costsToday: 0,
      soldToday: {},
    },
  };
}
