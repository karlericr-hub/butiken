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
    description: 'Kunderna betalar nästan dubbelt så snabbt i kassan. Terminalhyra 20 kr/dag.',
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
    id: 'anstalld_kassor',
    name: 'Anställd kassör',
    description: 'Sköter kassan automatiskt så att du kan göra annat. Lön 60 kr/dag.',
    cost: 400,
    requires: ['kortterminal'],
  },
  {
    id: 'anstalld_pafyllare',
    name: 'Anställd påfyllare',
    description: 'Fyller på hyllorna automatiskt från lagret. Lön 50 kr/dag.',
    cost: 350,
    requires: ['battre_hyllor'],
  },
  {
    id: 'paketombud',
    name: 'Paketombud',
    description: 'En paketdisk med egna kunder – stadig extra inkomst, men tar din tid.',
    cost: 350,
    requires: ['kortterminal'],
  },
  {
    id: 'storre_butik',
    name: 'Större butik',
    description: 'Fler kunder hittar hit och kön får plats med fler innan någon ger upp.',
    cost: 600,
    requires: ['battre_hyllor'],
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
