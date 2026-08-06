import Phaser from 'phaser';

/**
 * Spelets enda sanning om färg, ljus, typografi och djup.
 *
 * All grafik ritas procedurellt, så paletten är det som håller ihop uttrycket.
 * Lägg aldrig nya hexvärden direkt i scener eller entiteter – lägg dem här och
 * referera hit, annars glider stilen isär.
 *
 * Stilen är ljus, varm och tecknad: gräddvita ytor, mjukt trä, bärnstensgula
 * accenter och en klar sommarhimmel.
 */

/** Hex-nummer → CSS-sträng, för `add.text`-stilar som kräver strängfärg. */
export function css(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/** Ljusare variant av en färg (0–100). */
export function lighten(color: number, amount: number): number {
  return Phaser.Display.Color.ValueToColor(color).lighten(amount).color;
}

/** Mörkare variant av en färg (0–100). */
export function darken(color: number, amount: number): number {
  return Phaser.Display.Color.ValueToColor(color).darken(amount).color;
}

/** Blandar två färger; `t` 0 = a, 1 = b. */
export function mix(a: number, b: number, t: number): number {
  const ca = Phaser.Display.Color.ValueToColor(a);
  const cb = Phaser.Display.Color.ValueToColor(b);
  const k = Phaser.Math.Clamp(t, 0, 1);
  return Phaser.Display.Color.GetColor(
    Math.round(ca.red + (cb.red - ca.red) * k),
    Math.round(ca.green + (cb.green - ca.green) * k),
    Math.round(ca.blue + (cb.blue - ca.blue) * k),
  );
}

// --- Palett ------------------------------------------------------------

export const PALETTE = {
  sky: {
    high: 0x8fd3ee,
    low: 0xc7ecf7,
    menu: 0xaee3f2,
    page: 0x9fd6e8,
  },
  sun: {
    core: 0xffd54f,
    glow: 0xffe082,
  },
  grass: {
    dark: 0x7cb342,
    base: 0x9ccc65,
    light: 0xaed581,
  },
  /** Butiksgolvets två schackrutor + fog. */
  floor: {
    a: 0xf3ebd9,
    b: 0xe7dcc5,
    grout: 0xc9bda2,
    mat: 0x9c786c,
    rug: 0xd98c6a,
  },
  wall: {
    near: 0xdcd1b6,
    far: 0xcabfa6,
    trim: 0xb0a488,
    skirting: 0x9c8f74,
    stripe: 0xe8dfc8,
  },
  wood: {
    light: 0xf3ead9,
    base: 0xd3c1a5,
    mid: 0xbfab8c,
    edge: 0xb59b7c,
    dark: 0x8d7558,
    deep: 0x6d4c41,
  },
  glass: 0xbfe3ef,
  metal: {
    dark: 0x37474f,
    darker: 0x263238,
    light: 0xb0bec5,
    screen: 0x80deea,
  },
  accent: {
    base: 0xffb300,
    light: 0xffd54f,
    deep: 0xef6c00,
    warm: 0xffa726,
  },
  success: { base: 0x43a047, light: 0x66bb6a, deep: 0x2e7d32 },
  warning: { base: 0xffb300, light: 0xffca28, deep: 0xf57f17 },
  danger: { base: 0xe53935, light: 0xef5350, deep: 0xc62828 },
  panel: {
    /** Kortyta i menyer och paneler. */
    card: 0xfffdf6,
    bar: 0xfffbf0,
    edge: 0xffffff,
    shadow: 0x6d4c41,
  },
  text: {
    strong: 0x4e342e,
    body: 0x6d4c41,
    muted: 0x8d6e63,
    inverse: 0xfff8e1,
    onDark: 0xffffff,
  },
  /** Humörskala à la HappyOrNot: 0 gladast … 3 argast. */
  mood: [0x2ecc55, 0xf2c81e, 0xef8b3b, 0xe23b3b] as const,
  /** Kroppsfärger för figurgenereringen. */
  people: {
    shirts: [0xe57373, 0x64b5f6, 0xffd54f, 0xba68c8, 0x81c784, 0xff8a65, 0x4dd0e1, 0xf06292],
    hair: [0x4e342e, 0x212121, 0xffb74d, 0x8d6e63, 0x616161, 0xd84315],
    skin: [0xf2c9a1, 0xe0ac7e, 0xc68863, 0xf7d7b6],
    trousers: 0x3b4252,
    apron: 0xfff3e0,
  },
} as const;

// --- Isometrisk ljussättning -------------------------------------------

/**
 * Ljuset i spelet faller från övre vänster. Alla isometriska kroppar ska
 * hämta sina tre ytfärger härifrån, så att ljuset blir konsekvent oavsett
 * vem som ritar kuben.
 */
export const LIGHT = {
  topLift: 14,
  leftDrop: 4,
  rightDrop: 16,
} as const;

export interface IsoFaces {
  top: number;
  left: number;
  right: number;
}

/** Ljusramp för en isometrisk kropp: ljus ovansida, mörkast högersida. */
export function isoFaces(base: number): IsoFaces {
  return {
    top: lighten(base, LIGHT.topLift),
    left: darken(base, LIGHT.leftDrop),
    right: darken(base, LIGHT.rightDrop),
  };
}

/**
 * Ramp för texturer som färgas med `setTint` i efterhand. Vitt tar tinten rakt
 * av, och de två sidorna bär samma ljusförhållande som `isoFaces`.
 */
export const TINT_FACES: IsoFaces = {
  top: 0xffffff,
  left: 0xdedede,
  right: 0xb9b9b9,
};

// --- Typografi ---------------------------------------------------------

export const FONT = '"Baloo 2", sans-serif';

type TextStyle = Phaser.Types.GameObjects.Text.TextStyle;

/**
 * Typografiskala. Använd dessa istället för att upprepa stilobjekt; skicka in
 * `extra` för avvikelser (färg, stroke, wordWrap).
 */
export const TEXT = {
  title(extra: TextStyle = {}): TextStyle {
    return {
      fontFamily: FONT,
      fontSize: '56px',
      color: css(PALETTE.warning.deep),
      fontStyle: 'bold',
      ...extra,
    };
  },
  heading(extra: TextStyle = {}): TextStyle {
    return {
      fontFamily: FONT,
      fontSize: '22px',
      color: css(PALETTE.text.strong),
      fontStyle: 'bold',
      ...extra,
    };
  },
  body(extra: TextStyle = {}): TextStyle {
    return { fontFamily: FONT, fontSize: '18px', color: css(PALETTE.text.body), ...extra };
  },
  label(extra: TextStyle = {}): TextStyle {
    return { fontFamily: FONT, fontSize: '15px', color: css(PALETTE.text.body), ...extra };
  },
  small(extra: TextStyle = {}): TextStyle {
    return { fontFamily: FONT, fontSize: '12px', color: css(PALETTE.text.muted), ...extra };
  },
  button(extra: TextStyle = {}): TextStyle {
    return {
      fontFamily: FONT,
      fontSize: '20px',
      color: css(PALETTE.text.onDark),
      fontStyle: 'bold',
      ...extra,
    };
  },
} as const;

// --- Djupskala ---------------------------------------------------------

/**
 * Djupsorteringen är en painter's algorithm: världsobjekt sätter sitt djup
 * till sin y-koordinat (0–640), medan fasta lager ligger utanför det spannet.
 * Håll alla fasta lager här så att inget nytt krockar med något gammalt.
 */
export const DEPTH = {
  sky: -1400,
  farParallax: -1300,
  clouds: -1200,
  ground: -1100,
  floor: -1000,
  floorDecal: -995,
  lightPool: -980,
  walls: -960,
  wallDecor: -950,
  signage: -940,
  marker: -900,
  /** Världsobjekt ligger mellan 0 och 640 via setDepth(y). */
  daylight: 8800,
  vignette: 8900,
  progress: 9000,
  floatText: 9500,
  particles: 9600,
  hudPanel: 10000,
  hudText: 10001,
  overlay: 11000,
} as const;
