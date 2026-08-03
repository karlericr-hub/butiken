import type { Product } from '../state/GameState';

export const PRODUCTS: Product[] = [
  {
    id: 'mjolk',
    name: 'Mjölk',
    category: 'basvara',
    buyPrice: 8,
    sellPrice: 14,
    shelfCapacity: 10,
    currentStock: 10,
    unlockLevel: 0,
  },
  {
    id: 'brod',
    name: 'Bröd',
    category: 'basvara',
    buyPrice: 12,
    sellPrice: 22,
    shelfCapacity: 8,
    currentStock: 8,
    unlockLevel: 0,
  },
];

export const PRODUCT_COLORS: Record<string, number> = {
  mjolk: 0x7ec8e3,
  brod: 0xe8a15c,
};
