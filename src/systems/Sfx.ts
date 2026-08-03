/**
 * Enkla syntetiserade ljudeffekter via WebAudio – inga ljudfiler behövs.
 * Kan senare bytas mot riktiga CC0-ljud (Kenney audio) utan att anropen ändras.
 */
class SfxPlayer {
  private ctx?: AudioContext;

  private get context(): AudioContext | undefined {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return undefined;
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private tone(
    freq: number,
    startS: number,
    durS: number,
    type: OscillatorType = 'triangle',
    volume = 0.12,
    slideTo?: number,
  ): void {
    const ctx = this.context;
    if (!ctx) return;
    const t = ctx.currentTime + startS;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + durS);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + durS);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + durS + 0.05);
  }

  /** "Cha-ching" vid försäljning. */
  chaChing(): void {
    this.tone(988, 0, 0.08, 'square', 0.05);
    this.tone(1319, 0.07, 0.28, 'triangle', 0.12);
  }

  /** Mjuk "pop" vid påfyllning och knapptryck. */
  pop(): void {
    this.tone(420, 0, 0.09, 'sine', 0.12, 260);
  }

  /** Pling när leveransen anländer. */
  ding(): void {
    this.tone(880, 0, 0.3, 'sine', 0.1);
    this.tone(1760, 0, 0.2, 'sine', 0.04);
  }

  /** Ledsen ton när en kund ger upp. */
  sad(): void {
    this.tone(330, 0, 0.2, 'sawtooth', 0.045, 210);
  }

  /** Diskret larm när en hylla blir tom. */
  alert(): void {
    this.tone(740, 0, 0.07, 'square', 0.04);
    this.tone(740, 0.13, 0.07, 'square', 0.04);
  }
}

export const sfx = new SfxPlayer();
