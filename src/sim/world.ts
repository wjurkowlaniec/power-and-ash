import { V2 } from './vec';

export type ObstacleKind = 'rock' | 'scrap' | 'crate' | 'container' | 'yacht' | 'station' | 'pylon' | 'barrel' | 'tree';

/** Axis-aligned block in tile units: covers [x, x+w) × [y, y+h). */
export interface Obstacle {
  kind: ObstacleKind; x: number; y: number; w: number; h: number;
  /** Salvageable piles carry loot; the pile disappears after salvage. */
  loot?: Partial<Record<Material, number>>;
  /** What the pile is, for the mouse-over card (salvageable piles only). */
  name?: string;
  desc?: string;
}

export type Material = 'iron' | 'copper' | 'plastic' | 'glass';

/** Offset of cable corner points away from the obstacle, so a taut cable never touches the wall. */
export const CORNER_EPS = 0.08;

/**
 * Tile grid with blocked cells. 1 tile = 1 m. Pure logic, no rendering.
 */
export class World {
  readonly blocked: Uint8Array;
  corners: V2[] = [];
  readonly obstacles: Obstacle[];

  constructor(readonly width: number, readonly height: number, obstacles: Obstacle[]) {
    this.obstacles = [...obstacles];
    this.blocked = new Uint8Array(width * height);
    this.rebuild();
  }

  private rebuild() {
    this.blocked.fill(0);
    for (const o of this.obstacles)
      for (let j = o.y; j < o.y + o.h; j++)
        for (let i = o.x; i < o.x + o.w; i++) this.setBlocked(i, j);
    this.corners = [];
    this.computeCorners();
  }

  /** A new block (something built on the grid). */
  add(o: Obstacle) {
    this.obstacles.push(o);
    this.rebuild();
  }

  remove(o: Obstacle) {
    const i = this.obstacles.indexOf(o);
    if (i >= 0) { this.obstacles.splice(i, 1); this.rebuild(); }
  }

  /** Distance from point p to the obstacle rectangle (0 inside). */
  static distToRect(p: V2, o: Obstacle): number {
    const dx = Math.max(o.x - p.x, 0, p.x - (o.x + o.w));
    const dy = Math.max(o.y - p.y, 0, p.y - (o.y + o.h));
    return Math.hypot(dx, dy);
  }

  private setBlocked(i: number, j: number) {
    if (i >= 0 && j >= 0 && i < this.width && j < this.height) this.blocked[j * this.width + i] = 1;
  }

  isBlocked(i: number, j: number): boolean {
    if (i < 0 || j < 0 || i >= this.width || j >= this.height) return true;
    return this.blocked[j * this.width + i] === 1;
  }

  /**
   * Convex corners of the blocked area: grid vertices where exactly one of the four
   * surrounding tiles is blocked. The cable can only bend around these.
   */
  private computeCorners() {
    for (let y = 1; y < this.height; y++)
      for (let x = 1; x < this.width; x++) {
        const nw = this.isBlocked(x - 1, y - 1), ne = this.isBlocked(x, y - 1);
        const sw = this.isBlocked(x - 1, y), se = this.isBlocked(x, y);
        const n = +nw + +ne + +sw + +se;
        if (n !== 1) continue;
        // push the point diagonally away from the single blocked tile
        const dx = nw || sw ? 1 : -1;
        const dy = nw || ne ? 1 : -1;
        this.corners.push({ x: x + dx * CORNER_EPS, y: y + dy * CORNER_EPS });
      }
  }

  /** Does a circle of radius r at p overlap any blocked tile? */
  circleBlocked(p: V2, r: number): boolean {
    const i0 = Math.floor(p.x - r), i1 = Math.floor(p.x + r);
    const j0 = Math.floor(p.y - r), j1 = Math.floor(p.y + r);
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        if (!this.isBlocked(i, j)) continue;
        const cx = Math.max(i, Math.min(p.x, i + 1));
        const cy = Math.max(j, Math.min(p.y, j + 1));
        if ((p.x - cx) ** 2 + (p.y - cy) ** 2 < r * r) return true;
      }
    return false;
  }

  /** Does segment a→b pass through any blocked tile? (sampled; used for checks and tests) */
  segmentBlocked(a: V2, b: V2, step = 0.05): boolean {
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.ceil(d / step));
    for (let k = 1; k < n; k++) {
      const t = k / n;
      if (this.isBlocked(Math.floor(a.x + (b.x - a.x) * t), Math.floor(a.y + (b.y - a.y) * t))) return true;
    }
    return false;
  }
}
