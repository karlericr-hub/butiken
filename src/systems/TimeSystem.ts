import { BALANCE } from '../config/balance';

/** Håller reda på dagens öppettid och den visade klockan. */
export class TimeSystem {
  private elapsedMs = 0;

  tick(deltaMs: number): void {
    this.elapsedMs = Math.min(BALANCE.dayDurationMs, this.elapsedMs + deltaMs);
  }

  get isClosed(): boolean {
    return this.elapsedMs >= BALANCE.dayDurationMs;
  }

  get msSinceClose(): number {
    return Math.max(0, this.elapsedMs - BALANCE.dayDurationMs);
  }

  /** Hur långt dagen gått, 0 vid öppning och 1 vid stängning. Styr dagsljuset. */
  get progress(): number {
    return Math.min(1, this.elapsedMs / BALANCE.dayDurationMs);
  }

  /** Öppettiden mappas till en klocka, t.ex. 08:00–20:00. */
  get clockText(): string {
    const fraction = this.elapsedMs / BALANCE.dayDurationMs;
    const totalMinutes = (BALANCE.closeHour - BALANCE.openHour) * 60 * fraction;
    const hour = BALANCE.openHour + Math.floor(totalMinutes / 60);
    const minute = Math.floor(totalMinutes % 60);
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }
}
