import type { GameState } from '../state/GameState';
import type { Checkout } from '../entities/Checkout';
import type { Shelf } from '../entities/Shelf';
import { BALANCE } from '../config/balance';

/**
 * Det adaptiva gummibandet: läser av hur dagen går (kölängd, förlorade
 * kunder, kassatrend, tomma hyllor) och justerar kundtakt och tålamod
 * mjukt varje kväll så att både barn och vuxna hålls i flow.
 */
export class DifficultySystem {
  private samples = 0;
  private queueTotal = 0;
  private emptyShelfSamples = 0;
  private nextSampleAt = 0;
  private readonly moneyAtDayStart: number;

  constructor(
    private state: GameState,
    private checkout: Checkout,
    private shelves: Map<string, Shelf>,
  ) {
    this.moneyAtDayStart = state.money;
  }

  /** Samplar signaler med jämna mellanrum under öppettiden. */
  update(time: number): void {
    if (time < this.nextSampleAt) return;
    this.nextSampleAt = time + BALANCE.difficulty.sampleIntervalMs;
    this.samples++;
    this.queueTotal += this.checkout.queue.length;
    for (const shelf of this.shelves.values()) {
      if (shelf.isEmpty) {
        this.emptyShelfSamples++;
        break;
      }
    }
  }

  /** Justerar svårigheten efter dagens resultat. Anropas vid stängning. */
  adjustAfterDay(): void {
    const cfg = BALANCE.difficulty;
    const s = this.state.stats;
    const d = this.state.difficulty;

    const total = s.servedToday + s.lostToday;
    const lostShare = total > 0 ? s.lostToday / total : 0;
    const avgQueue = this.samples > 0 ? this.queueTotal / this.samples : 0;
    const emptyShare = this.samples > 0 ? this.emptyShelfSamples / this.samples : 0;
    const moneyTrend = this.state.money - this.moneyAtDayStart;

    const struggling =
      lostShare > cfg.strugglingLostShare ||
      (avgQueue > cfg.strugglingQueueAvg && moneyTrend < 0);
    const cruising =
      lostShare < cfg.cruisingLostShare &&
      avgQueue < cfg.cruisingQueueAvg &&
      moneyTrend > 0;

    if (struggling) {
      d.spawnRate = Math.max(cfg.spawnRateMin, d.spawnRate - cfg.spawnStep);
      d.patienceModifier = Math.min(cfg.patienceModMax, d.patienceModifier + cfg.patienceStep);
      this.state.pendingHint =
        emptyShare > cfg.emptyShelfHintShare
          ? 'Tips! Glöm inte att fylla på hyllorna – tomma hyllor ger inga pengar.'
          : 'Tips! Stå i kassan så krymper kön snabbare.';
    } else if (cruising) {
      d.spawnRate = Math.min(cfg.spawnRateMax, d.spawnRate + cfg.spawnStep);
      d.patienceModifier = Math.max(cfg.patienceModMin, d.patienceModifier - cfg.patienceStep);
    }
  }
}
