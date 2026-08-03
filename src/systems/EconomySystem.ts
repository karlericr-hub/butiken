import type { GameState, Product } from '../state/GameState';
import { BALANCE } from '../config/balance';

/** Hanterar alla pengaflöden och dagsstatistik. */
export class EconomySystem {
  constructor(private state: GameState) {}

  /** Säljer innehållet i en varukorg. Returnerar totalsumman. */
  sell(basket: Product[]): number {
    const total = basket.reduce((sum, p) => sum + p.sellPrice, 0);
    this.state.money += total;
    this.state.stats.revenueToday += total;
    this.state.stats.servedToday++;
    this.state.rating = Math.min(100, this.state.rating + BALANCE.ratingGainPerSale);
    return total;
  }

  /**
   * Köper in varor för påfyllning. Returnerar hur många enheter som
   * faktiskt kunde köpas (begränsas av kassan).
   */
  buyStock(product: Product, wantedUnits: number): number {
    const affordable = Math.floor(this.state.money / product.buyPrice);
    const units = Math.min(wantedUnits, affordable);
    if (units <= 0) return 0;
    const cost = units * product.buyPrice;
    this.state.money -= cost;
    this.state.stats.costsToday += cost;
    return units;
  }

  registerLostCustomer(): void {
    this.state.stats.lostToday++;
    this.state.rating = Math.max(0, this.state.rating - BALANCE.ratingLossPerLostCustomer);
  }
}
