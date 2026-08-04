import { GRID_W, GRID_H, isoToScreen, screenToIso } from '../utils/iso';

interface Cell {
  gx: number;
  gy: number;
}

/**
 * Enkel rutnätskarta med A*-sökning. Håller reda på vilka rutor som är
 * blockerade (hyllor, kassa, paketdisk) så att figurerna kan gå runt dem
 * i stället för rakt igenom.
 */
export class NavGrid {
  private blocked = new Set<string>();

  private static key(gx: number, gy: number): string {
    return `${gx},${gy}`;
  }

  /** Markera en ruta som blockerad. */
  block(gx: number, gy: number): void {
    if (this.inBounds(gx, gy)) this.blocked.add(NavGrid.key(gx, gy));
  }

  private inBounds(gx: number, gy: number): boolean {
    return gx >= 0 && gy >= 0 && gx < GRID_W && gy < GRID_H;
  }

  isFree(gx: number, gy: number): boolean {
    return this.inBounds(gx, gy) && !this.blocked.has(NavGrid.key(gx, gy));
  }

  private clampCell(gx: number, gy: number): Cell {
    return {
      gx: Math.min(GRID_W - 1, Math.max(0, Math.round(gx))),
      gy: Math.min(GRID_H - 1, Math.max(0, Math.round(gy))),
    };
  }

  /** Närmaste fria ruta i växande ringar (fallback om målrutan är blockerad). */
  private nearestFree(cell: Cell): Cell {
    if (this.isFree(cell.gx, cell.gy)) return cell;
    const maxR = Math.max(GRID_W, GRID_H);
    for (let r = 1; r < maxR; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const nx = cell.gx + dx;
          const ny = cell.gy + dy;
          if (this.isFree(nx, ny)) return { gx: nx, gy: ny };
        }
      }
    }
    return cell;
  }

  /**
   * Räknar ut en väg i skärmkoordinater mellan två punkter. Returnerar en lista
   * av delmål (waypoints) som figuren går till i tur och ordning.
   */
  route(fromX: number, fromY: number, toX: number, toY: number): { x: number; y: number }[] {
    const from = screenToIso(fromX, fromY);
    const to = screenToIso(toX, toY);
    const rawGoal = this.clampCell(to.gx, to.gy);
    const goalReachable = this.isFree(rawGoal.gx, rawGoal.gy);

    const start = this.nearestFree(this.clampCell(from.gx, from.gy));
    const goal = goalReachable ? rawGoal : this.nearestFree(rawGoal);

    const cells = this.aStar(start, goal);
    const points = cells.map((c) => isoToScreen(c.gx, c.gy));

    if (goalReachable) {
      // Sista steget går exakt till den begärda punkten (med ev. jitter).
      if (points.length > 0) points[points.length - 1] = { x: toX, y: toY };
      else points.push({ x: toX, y: toY });
    }

    return this.smooth(fromX, fromY, points);
  }

  private aStar(start: Cell, goal: Cell): Cell[] {
    if (start.gx === goal.gx && start.gy === goal.gy) return [];

    const open = new Set<string>([NavGrid.key(start.gx, start.gy)]);
    const cameFrom = new Map<string, string>();
    const gScore = new Map<string, number>();
    const fScore = new Map<string, number>();
    const startKey = NavGrid.key(start.gx, start.gy);
    gScore.set(startKey, 0);
    fScore.set(startKey, this.heuristic(start, goal));

    const neighbours: [number, number][] = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];

    while (open.size > 0) {
      // Ta noden med lägst f-värde.
      let currentKey: string | undefined;
      let best = Infinity;
      for (const k of open) {
        const f = fScore.get(k) ?? Infinity;
        if (f < best) {
          best = f;
          currentKey = k;
        }
      }
      if (!currentKey) break;

      const [cgx, cgy] = currentKey.split(',').map(Number);
      if (cgx === goal.gx && cgy === goal.gy) {
        return this.reconstruct(cameFrom, currentKey);
      }
      open.delete(currentKey);

      for (const [dx, dy] of neighbours) {
        const nx = cgx + dx;
        const ny = cgy + dy;
        if (!this.isFree(nx, ny)) continue;
        // Tillåt inte diagonala genvägar förbi ett hörn på ett hinder.
        if (dx !== 0 && dy !== 0 && (!this.isFree(cgx + dx, cgy) || !this.isFree(cgx, cgy + dy))) {
          continue;
        }
        const step = dx !== 0 && dy !== 0 ? Math.SQRT2 : 1;
        const neighbourKey = NavGrid.key(nx, ny);
        const tentative = (gScore.get(currentKey) ?? Infinity) + step;
        if (tentative < (gScore.get(neighbourKey) ?? Infinity)) {
          cameFrom.set(neighbourKey, currentKey);
          gScore.set(neighbourKey, tentative);
          fScore.set(neighbourKey, tentative + this.heuristic({ gx: nx, gy: ny }, goal));
          open.add(neighbourKey);
        }
      }
    }
    return [];
  }

  private heuristic(a: Cell, b: Cell): number {
    const dx = Math.abs(a.gx - b.gx);
    const dy = Math.abs(a.gy - b.gy);
    // Octile-avstånd (tillåter diagonaler).
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  }

  private reconstruct(cameFrom: Map<string, string>, endKey: string): Cell[] {
    const path: Cell[] = [];
    let key: string | undefined = endKey;
    while (key !== undefined) {
      const [gx, gy] = key.split(',').map(Number);
      path.unshift({ gx, gy });
      key = cameFrom.get(key);
    }
    // Hoppa över startrutan – figuren står redan där.
    path.shift();
    return path;
  }

  /**
   * Kortar av vägen: slår ihop waypoints så länge det finns fri sikt mellan dem.
   * Ger mjukare, rakare gång än ren ruta-för-ruta-rörelse.
   */
  private smooth(
    fromX: number,
    fromY: number,
    points: { x: number; y: number }[],
  ): { x: number; y: number }[] {
    if (points.length <= 1) return points;
    const all = [{ x: fromX, y: fromY }, ...points];
    const out: { x: number; y: number }[] = [];
    let i = 0;
    while (i < all.length - 1) {
      let j = all.length - 1;
      while (j > i + 1 && !this.lineClear(all[i], all[j])) j--;
      out.push(all[j]);
      i = j;
    }
    return out;
  }

  private lineClear(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(dist / 8));
    for (let k = 1; k < steps; k++) {
      const t = k / steps;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      const c = screenToIso(x, y);
      const cell = this.clampCell(c.gx, c.gy);
      // Punkter utanför rutnätet räknas som fria (öppen yta utanför hyllorna).
      if (this.inBounds(Math.round(c.gx), Math.round(c.gy)) && !this.isFree(cell.gx, cell.gy)) {
        return false;
      }
    }
    return true;
  }
}
