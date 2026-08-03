import type { GameState } from '../state/GameState';

const KEY = 'butiken-save-v1';

/** Sparar och laddar speltillståndet i localStorage. */
export const SaveSystem = {
  save(state: GameState): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // T.ex. privat läge utan lagring – spelet fungerar ändå.
    }
  },

  load(): GameState | undefined {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return undefined;
      const state = JSON.parse(raw) as GameState;
      if (typeof state.day !== 'number' || !Array.isArray(state.products)) return undefined;
      return state;
    } catch {
      return undefined;
    }
  },

  has(): boolean {
    return this.load() !== undefined;
  },

  clear(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // Ignorera.
    }
  },
};
