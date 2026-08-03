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

  /** Avgift för en hanterad pakethämtning/-inlämning. */
  parcelIncome(): number {
    const fee = BALANCE.parcelFee;
    this.state.money += fee;
    this.state.stats.revenueToday += fee;
    this.state.stats.servedToday++;
    this.state.rating = Math.min(100, this.state.rating + BALANCE.ratingGainPerSale);
    return fee;
  }

  registerLostCustomer(): void {
    this.state.stats.lostToday++;
    this.state.rating = Math.max(0, this.state.rating - BALANCE.ratingLossPerLostCustomer);
  }
}
