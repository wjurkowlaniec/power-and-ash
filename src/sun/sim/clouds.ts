/**
 * Clouds over the ash country, seen only as their shadows on the ground.
 *
 * Each cloud is a loose cluster of soft round puffs. The whole sky drifts downwind with
 * the base wind, slower than the yacht can sail, and each puff slowly swells and shrinks,
 * so the gaps between clouds open and close. The sky is a torus a bit bigger than the map:
 * a cloud that drifts off one side comes back on the other.
 *
 * `shadeAt` is the one number the rest of the game needs: 0 in full sun, 1 under the
 * middle of a cloud, with soft edges a few metres wide. Pure and deterministic for a seed.
 */
export const CLOUDS = {
  /** Side of the sky torus, m, and its west/north corner (the map is 0..400). */
  domain: 640,
  origin: -120,
  /** Puff radius range, m. */
  rMin: 14, rMax: 34,
  /** Density where the shade starts and where it is full (sum of the puffs' bumps). */
  edge0: 0.5, edge1: 0.85,
  /** How much of the sun is left under a full cloud. */
  lightMin: 0.12,
  /** How much each puff breathes (share of its radius) and how fast, rad/s. */
  breathe: 0.18, breatheRate: 0.045,
} as const;

export interface Puff { dx: number; dy: number; r: number; phase: number }
export interface Cloud { x: number; y: number; puffs: Puff[] }

function rng(seed: number) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

/** Shortest signed distance on the torus. */
export const wrap = (d: number, D = CLOUDS.domain) => d - D * Math.round(d / D);

const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class CloudField {
  readonly clouds: Cloud[] = [];
  /** Rough share of the ground in shade, 0..1. */
  readonly cover: number;
  /** How far the whole sky has drifted, m. */
  offX = 0; offY = 0;
  time = 0;

  /**
   * @param cover rough share of the ground in shade, 0..1
   * @param seed  the same seed gives the same sky
   */
  constructor(cover: number, seed = 11) {
    this.cover = cover;
    const r = rng(seed * 7919 + 3);
    const D = CLOUDS.domain;
    // a cloud shades ~6000 m² on average and they overlap at random (Poisson): pick the count to hit the cover
    const n = Math.max(1, Math.round(-Math.log(1 - Math.min(0.9, cover)) * D * D / 6000));
    for (let i = 0; i < n; i++) {
      const puffs: Puff[] = [];
      const k = 3 + Math.floor(r() * 5);
      const stretch = 18 + r() * 26;
      const a = r() * Math.PI;
      for (let j = 0; j < k; j++) {
        const t = (j / Math.max(1, k - 1) - 0.5) * 2;
        const side = (r() - 0.5) * 18;
        puffs.push({
          dx: Math.cos(a) * t * stretch - Math.sin(a) * side,
          dy: Math.sin(a) * t * stretch + Math.cos(a) * side,
          r: CLOUDS.rMin + r() * (CLOUDS.rMax - CLOUDS.rMin),
          phase: r() * Math.PI * 2,
        });
      }
      this.clouds.push({ x: CLOUDS.origin + r() * D, y: CLOUDS.origin + r() * D, puffs });
    }
  }

  /** Drift the sky: `dir` the wind direction (towards), `speed` m/s of the clouds. */
  update(dt: number, dir: number, speed: number) {
    this.time += dt;
    this.offX += Math.cos(dir) * speed * dt;
    this.offY += Math.sin(dir) * speed * dt;
  }

  /** Every puff now: world position (the copy nearest to (nx, ny)) and radius. */
  *puffs(nx = 200, ny = 200): Generator<{ x: number; y: number; r: number }> {
    const w = CLOUDS.breathe, k = CLOUDS.breatheRate;
    for (const c of this.clouds) for (const p of c.puffs) {
      const x = c.x + p.dx + this.offX, y = c.y + p.dy + this.offY;
      yield { x: nx + wrap(x - nx), y: ny + wrap(y - ny), r: p.r * (1 + w * Math.sin(this.time * k + p.phase)) };
    }
  }

  /** Sum of the puffs' soft bumps at a point. */
  densityAt(x: number, y: number): number {
    let d = 0;
    for (const p of this.puffs(x, y)) {
      const dx = p.x - x, dy = p.y - y, q = (dx * dx + dy * dy) / (p.r * p.r);
      if (q < 9) d += Math.exp(-q);
    }
    return d;
  }

  /** 0 full sun … 1 full shade. */
  shadeAt(x: number, y: number): number { return smooth(CLOUDS.edge0, CLOUDS.edge1, this.densityAt(x, y)); }

  /** 1 full sun … `lightMin` under a cloud. */
  lightAt(x: number, y: number): number { return 1 - (1 - CLOUDS.lightMin) * this.shadeAt(x, y); }
}
