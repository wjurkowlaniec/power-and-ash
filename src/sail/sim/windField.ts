import { V2 } from '../../sim/vec';
import { Obstacle, MAP } from './terrain';

/**
 * Wind that differs from place to place, so it can be read and used:
 * - the base wind turns and breathes slowly (a few degrees, a couple of m/s, over minutes);
 * - gusts and lulls: patches 12–35 m across that drift downwind with the air, grow, hold
 *   and fade. A gust is stronger and veers a little; a lull is a soft hole. The 3D view
 *   draws them as dark "cat's paws" on the ash, so a player sees a gust coming;
 * - wind shadow: behind a house, a wall or a wood the wind drops for up to ~10 heights
 *   downwind and turns gusty and shifty at the edges of the wake. A bare tree or a lattice
 *   pylon lets most of it through.
 * Pure and deterministic for a given seed, so it can be tested.
 */
export const WIND = {
  base: 7,
  /** rad: the base wind blows towards this (x east, y south): from the west-north-west. */
  dir: 0.32,
  cells: 26,
  /** Cells live around the player in this radius (further out nobody sees them). */
  around: 170,
  /** Wake length in obstacle heights, how much it widens per metre, max speed loss. */
  wake: 10,
  spread: 0.13,
  loss: 0.85,
} as const;

export interface GustCell {
  x: number; y: number;
  r: number;
  /** +0.3..+0.9 a gust, −0.5..−0.25 a lull (share of the base speed). */
  amp: number;
  /** Direction shift, rad. */
  veer: number;
  age: number;
  life: number;
}

export interface WindSample {
  /** Direction the air moves towards and speed, m/s. */
  dir: number;
  speed: number;
  /** 0..1 how much of the wind is blocked here (for the HUD and the ground). */
  shadow: number;
  /** −1..1 gust (+) or lull (−) here. */
  gust: number;
}

function rng(seed: number) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

/** Fade-in, hold, fade-out envelope of a cell over its life. */
export const cellEnvelope = (c: GustCell) => {
  const t = c.age / c.life;
  return t < 0 || t > 1 ? 0 : Math.min(1, t / 0.25, (1 - t) / 0.3);
};

export class WindField {
  time = 0;
  dir: number = WIND.dir;
  speed: number = WIND.base;
  cells: GustCell[] = [];
  /** The strength knob: 0.6 calm day … 1.5 a hard blow. */
  strength = 1;
  private rand: () => number;

  constructor(readonly obstacles: Obstacle[], seed = 7, focus: V2 = { x: MAP.size / 2, y: MAP.size / 2 }) {
    this.rand = rng(seed);
    for (let i = 0; i < WIND.cells; i++) { const c = this.spawn(focus); c.age = this.rand() * c.life; this.cells.push(c); }
  }

  private spawn(focus: V2): GustCell {
    const r = this.rand;
    // most cells start upwind of the player, so they come at him
    const a = this.dir + Math.PI + (r() - 0.5) * 2.6;
    const d = 20 + r() * WIND.around;
    const lull = r() < 0.3;
    return {
      x: focus.x + Math.cos(a) * d, y: focus.y + Math.sin(a) * d,
      r: 12 + r() * 23,
      amp: lull ? -(0.25 + r() * 0.25) : 0.3 + r() * 0.6,
      veer: (r() - 0.5) * 0.36,
      age: 0, life: 18 + r() * 26,
    };
  }

  /** Base wind at time t (breathes and turns slowly). */
  baseAt(t: number) {
    return {
      dir: WIND.dir + 0.22 * Math.sin(t * 0.011) + 0.08 * Math.sin(t * 0.047 + 1.3),
      speed: WIND.base * this.strength * (1 + 0.12 * Math.sin(t * 0.023 + 0.5) + 0.06 * Math.sin(t * 0.09)),
    };
  }

  update(dt: number, focus: V2) {
    this.time += dt;
    const b = this.baseAt(this.time);
    this.dir = b.dir; this.speed = b.speed;
    const ux = Math.cos(this.dir), uy = Math.sin(this.dir);
    for (let i = 0; i < this.cells.length; i++) {
      const c = this.cells[i];
      c.age += dt;
      // cells ride the wind a little slower than the air itself
      c.x += ux * this.speed * 0.75 * dt; c.y += uy * this.speed * 0.75 * dt;
      const far = Math.hypot(c.x - focus.x, c.y - focus.y) > WIND.around + 60;
      if (c.age > c.life || far) this.cells[i] = this.spawn(focus);
    }
  }

  /** 0..1 shadow of the obstacles at p for wind blowing along (ux, uy), and a turbulence weight. */
  shadowAt(x: number, y: number, ux: number, uy: number): { block: number; edge: number } {
    let keep = 1, edge = 0;
    for (const o of this.obstacles) {
      if (o.porous >= 0.95) continue;
      const dx = x - o.x, dy = y - o.y;
      const along = dx * ux + dy * uy;
      const L = o.height * WIND.wake;
      if (along < -o.r || along > L) continue;
      const across = Math.abs(-dx * uy + dy * ux);
      // the obstacle's width across the wind (a box shows more of itself at an angle)
      const half = o.hw !== undefined ? Math.abs(o.hw! * uy) + Math.abs(o.hh! * ux) : o.r;
      const w = half + WIND.spread * Math.max(0, along);
      if (across > w * 2.2) continue;
      // strongest just behind, recovering downwind; a soft edge across
      const len = along < 0 ? 0.35 * (1 + along / o.r) : Math.pow(1 - along / L, 1.4);
      const side = Math.exp(-Math.pow(across / w, 4));
      const b = WIND.loss * (1 - o.porous) * len * side;
      keep *= 1 - b;
      // the wake's edges are where the wind tumbles
      edge = Math.max(edge, (1 - o.porous) * len * Math.exp(-Math.pow((across - w) / (0.5 * w + 1), 2)));
    }
    return { block: 1 - keep, edge };
  }

  /** The wind at a point. */
  at(x: number, y: number): WindSample {
    let amp = 0, veer = 0;
    for (const c of this.cells) {
      const d2 = (x - c.x) ** 2 + (y - c.y) ** 2;
      if (d2 > 9 * c.r * c.r) continue;
      const g = Math.exp(-d2 / (c.r * c.r)) * cellEnvelope(c);
      amp += c.amp * g; veer += c.veer * g;
    }
    const ux = Math.cos(this.dir), uy = Math.sin(this.dir);
    const sh = this.shadowAt(x, y, ux, uy);
    // turbulence: fast flicker in the wakes, a slow wander everywhere
    const t = this.time;
    const flick = Math.sin(t * 2.3 + x * 0.31) * Math.sin(t * 1.7 - y * 0.27);
    const turbDir = 0.04 * Math.sin(t * 0.6 + x * 0.05 + y * 0.03) + sh.edge * 0.5 * flick;
    const turbSpd = 1 + sh.edge * 0.35 * flick;
    const speed = Math.max(0, this.speed * (1 + Math.max(-0.6, amp)) * (1 - sh.block) * turbSpd);
    return { dir: this.dir + veer + turbDir, speed, shadow: sh.block, gust: Math.max(-1, Math.min(1, amp)) };
  }
}
