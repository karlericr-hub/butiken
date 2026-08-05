/**
 * Asset-manifest för den riktiga grafiken (Kenney, CC0).
 *
 * Spelet refererar grafik via texturnycklar (tile, shelfCube, cube, ...). Här
 * kopplas varje nyckel till en bildfil samt hur den ska visas: `display` är
 * storleken i DESIGNPIXLAR (samma koordinatrum som förr – kameran zoomar sedan
 * upp hela världen till full renderupplösning) och `origin` är ankarpunkten
 * (0–1) så att fötter/iso-bas hamnar på rätt ställe i rutnätet.
 *
 * Figurerna kommer från Kenney "Toon Characters 1" (front-vända, 96×128, med
 * åtta gångramar + idle). Möbler/props kommer från Kenney "Furniture Kit" och
 * "Isometric Blocks". Se public/assets/kenney/CREDITS.md.
 */

/** Bas-URL för assets, respekterar Vite-basen (/butiken/). */
export const ASSET_BASE = `${import.meta.env.BASE_URL}assets/kenney`;

export interface SpriteSpec {
  /** Visningsstorlek i designpixlar [bredd, höjd]. */
  display: [number, number];
  /** Ankarpunkt 0–1 [x, y]. */
  origin: [number, number];
}

/** De sex Toon-figurerna vi använder. */
export const CHARACTERS = [
  'malePerson',
  'femalePerson',
  'maleAdventurer',
  'femaleAdventurer',
  'robot',
  'zombie',
] as const;
export type CharacterName = (typeof CHARACTERS)[number];

/** Gångramar per figur (character_<namn>_walk0..7). */
export const WALK_FRAMES = 8;

/**
 * Kopplar spelets figurnycklar till en Toon-figur. Personalen får de mest
 * "arbetar-lika" figurerna; kunderna varieras över alla sex (robot/zombie som
 * lite lustiga inslag). cust0..7 slumpas, så viss upprepning märks inte.
 */
export const FIGURE_CHARACTER: Record<string, CharacterName> = {
  mgr: 'maleAdventurer',
  cashier: 'femalePerson',
  stocker: 'femaleAdventurer',
  parcelcust: 'malePerson',
  cust0: 'femalePerson',
  cust1: 'malePerson',
  cust2: 'femaleAdventurer',
  cust3: 'maleAdventurer',
  cust4: 'robot',
  cust5: 'zombie',
  cust6: 'malePerson',
  cust7: 'femalePerson',
};

/** Gemensam visningsspec för alla figurer (samma canvas 96×128). */
export const FIGURE_SPEC: SpriteSpec = {
  display: [46, 61],
  origin: [0.5, 0.98],
};

/** Miljö- och prop-texturer: nyckel → fil + visningsspec. */
export interface PropAsset extends SpriteSpec {
  key: string;
  url: string;
}

export const PROP_ASSETS: PropAsset[] = [
  // Golv – platt trädiamant, tintas för variation. Origin på diamantens mitt.
  { key: 'tile', url: 'furniture/floor.png', display: [64, 47], origin: [0.5, 0.38] },
  // Hylla – öppen bokhylla.
  { key: 'shelfCube', url: 'furniture/shelf.png', display: [48, 100], origin: [0.5, 0.86] },
  // Disk – köksbardisk (kassa/paketdisk). Tintas svagt per station.
  { key: 'cube', url: 'furniture/counter.png', display: [60, 79], origin: [0.5, 0.82] },
  // Kassaapparat som står på disken.
  { key: 'till', url: 'furniture/register.png', display: [30, 38], origin: [0.5, 1] },
  // Paket / kartong (paketdisk + leverans).
  { key: 'parcel', url: 'furniture/box.png', display: [22, 27], origin: [0.5, 1] },
  // Öppen kartong (leverans).
  { key: 'boxOpen', url: 'furniture/boxOpen.png', display: [26, 29], origin: [0.5, 1] },
  // Varulåda på hylltoppen (tintas per vara).
  { key: 'mini', url: 'furniture/box.png', display: [16, 20], origin: [0.5, 1] },
  // Krukväxt.
  { key: 'plant', url: 'furniture/plant.png', display: [22, 28], origin: [0.5, 1] },
  // Mynt (myntregn).
  { key: 'coin', url: 'coin.png', display: [12, 12], origin: [0.5, 0.5] },
];

/** Slår upp visningsspec för en nyckel (prop eller figur). */
const PROP_SPEC_MAP: Record<string, SpriteSpec> = Object.fromEntries(
  PROP_ASSETS.map((a) => [a.key, { display: a.display, origin: a.origin }]),
);

export function spriteSpec(key: string): SpriteSpec {
  return PROP_SPEC_MAP[key] ?? FIGURE_SPEC;
}

/** Texturnyckel för en figurs idle-bild. */
export function figureIdleTexture(character: CharacterName): string {
  return `${character}-idle`;
}
export function walkAnimKey(character: CharacterName): string {
  return `${character}-walk`;
}
