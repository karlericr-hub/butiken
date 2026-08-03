export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  cost: number;
  /** Andra uppgraderingar som måste ägas först. */
  requires?: string[];
  /** Kan köpas om och om igen (t.ex. reklam inför varje dag). */
  repeatable?: boolean;
}

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'kortterminal',
    name: 'Kortterminal',
    description: 'Kunderna betalar nästan dubbelt så snabbt i kassan.',
    cost: 150,
  },
  {
    id: 'fler_varutyper',
    name: 'Godishylla',
    description: 'En ny hylla med godis – bra marginal! Glöm inte att beställa godis.',
    cost: 200,
  },
  {
    id: 'battre_hyllor',
    name: 'Bättre hyllor',
    description: 'Alla hyllor rymmer 50 % mer och fylls på snabbare.',
    cost: 300,
    requires: ['kortterminal'],
  },
  {
    id: 'reklam',
    name: 'Reklamkampanj',
    description: 'Många fler kunder imorgon. Se till att hyllorna är fulla!',
    cost: 100,
    requires: ['fler_varutyper'],
    repeatable: true,
  },
];
