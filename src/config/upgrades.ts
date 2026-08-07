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
    name: 'Större hyllor',
    description:
      'Varje hylla blir två lådor med dubbelt så mycket plats. Lådorna fylls på var för sig – och kunden går automatiskt till den låda som har varor kvar.',
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
    description:
      'Anställer en påfyllare som sköter EN varusort automatiskt från lagret. Anställ en per varusort. Lön 50 kr/dag.',
    cost: 350,
    requires: ['battre_hyllor'],
    repeatable: true,
  },
  {
    id: 'lagerutrymme',
    name: 'Extra lagerutrymme',
    description:
      'Bygger ut lagret så att det får plats med fler varor. Höjer hyran med 15 kr/dag per utbyggnad. Kan köpas flera gånger.',
    cost: 180,
    repeatable: true,
  },
  {
    id: 'extra_kassa',
    name: 'Extra kassa',
    description:
      'Öppnar en kassa till med en egen kassör i den blå rutan. Fler kassor betjänar kön snabbare. Lön 60 kr/dag.',
    cost: 500,
    requires: ['anstalld_kassor'],
    repeatable: true,
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
