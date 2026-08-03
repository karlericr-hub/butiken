export const TILE_W = 64;
export const TILE_H = 32;
export const ORIGIN_X = 480;
export const ORIGIN_Y = 150;

export const GRID_W = 10;
export const GRID_H = 10;

export function isoToScreen(gx: number, gy: number): { x: number; y: number } {
  return {
    x: ORIGIN_X + (gx - gy) * (TILE_W / 2),
    y: ORIGIN_Y + (gx + gy) * (TILE_H / 2),
  };
}

export function screenToIso(x: number, y: number): { gx: number; gy: number } {
  const dx = (x - ORIGIN_X) / (TILE_W / 2);
  const dy = (y - ORIGIN_Y) / (TILE_H / 2);
  return {
    gx: (dy + dx) / 2,
    gy: (dy - dx) / 2,
  };
}
