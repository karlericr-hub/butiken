export interface Product {
  id: string;
  name: string;
  category: 'basvara' | 'kyld' | 'godis' | 'frukt' | 'paket';
  buyPrice: number;
  sellPrice: number;
  shelfCapacity: number;
  currentStock: number;
  unlockLevel: number;
}

export interface StaffMember {
  id: string;
  role: 'kassor' | 'pafyllare';
  dailyWage: number;
}

export interface GameState {
  day: number;
  money: number;
  rating: number;
  products: Product[];
  upgrades: string[];
  staff: StaffMember[];
  isParcelAgent: boolean;
  difficulty: {
    spawnRate: number;
    patienceModifier: number;
  };
  stats: {
    servedToday: number;
    lostToday: number;
    revenueToday: number;
    costsToday: number;
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
    difficulty: {
      spawnRate: 1,
      patienceModifier: 1,
    },
    stats: {
      servedToday: 0,
      lostToday: 0,
      revenueToday: 0,
      costsToday: 0,
    },
  };
}
