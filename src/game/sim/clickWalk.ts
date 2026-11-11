import { V2, dist, len, sub, scale } from '../../sim/vec';
import { World } from '../../sim/world';
import { findPath } from '../../sim/path';

/**
 * Point-and-click for the game scenes (decision 2026-11-06: the basic controls can be
 * all mouse). Pure logic, no Three.js: it turns "go there" or "go to that thing and use
 * it" into the same input the keyboard gives (a direction, E pressed, E held), so the
 * scenes keep one input path and the keys always win.
 *
 * Arrival at a thing is decided by the scene's own `nearest()`: Wolt stops as soon as
 * the thing is the one E would use, so he never parks out of reach.
 */
export const ARRIVE_GROUND = 0.2;  // m from a ground mark that counts as there
export const WAYPOINT_R = 0.3;     // m from a waypoint before taking the next one
export const STUCK_TIME = 1.2;     // s barely moving before giving up (a wall, a cable at its end)
export const STUCK_SPEED = 0.15;   // m/s below which he counts as barely moving
export const HOLD_MAX = 8;         // s holding E at most (a repair or a pry ends sooner)

/** What a scene shows the click walker. */
export interface ClickBody {
  readonly world: World;
  readonly pos: V2;
  /** Id of the thing E would use now (notes as `note:<id>`), or null. */
  current(): string | null;
  /** The hint E would act on: a hold action carries `progress`. */
  hint(): { progress?: number } | null;
}

/** One frame of input from the walker (merged into the scene input). */
export interface ClickInput { move: V2; stopIn: number; use: boolean; usePressed: boolean }

interface Order {
  goal: V2;
  path: V2[];
  /** Thing to use on arrival, or null for a plain "go there". */
  target: string | null;
  stuck: number;
  last: V2;
  /** Arrived at the target: E was pressed and is held while the action needs it. */
  using: number;
}

export class ClickWalk {
  order: Order | null = null;

  constructor(private radius: number) {}

  /** Go to a ground point, or to a thing at `goal` and use it there. */
  go(b: ClickBody, goal: V2, target: string | null = null) {
    const path = findPath(b.world, b.pos, goal, this.radius) ?? [goal];
    this.order = { goal, path, target, stuck: 0, last: { ...b.pos }, using: 0 };
  }

  cancel() { this.order = null; }

  /** Input for this frame, or null when there is no order (the keyboard drives). */
  step(b: ClickBody, dt: number): ClickInput | null {
    const o = this.order;
    if (!o) return null;
    const none: ClickInput = { move: { x: 0, y: 0 }, stopIn: Infinity, use: false, usePressed: false };

    if (o.using > 0) {
      // keep holding E while the action fills its bar (pry, repair); a tap is done at once
      o.using += dt;
      const h = b.hint();
      if (b.current() !== o.target || !h || h.progress === undefined || o.using > HOLD_MAX) { this.order = null; return none; }
      return { ...none, use: true };
    }
    if (o.target && b.current() === o.target) {
      o.using = 1e-3;
      return { ...none, use: true, usePressed: true };
    }

    while (o.path.length > 1 && dist(b.pos, o.path[0]) < WAYPOINT_R) o.path.shift();
    const wp = o.path[0] ?? o.goal;
    const end = o.path[o.path.length - 1] ?? o.goal;
    const rem = dist(b.pos, end);
    if (rem < ARRIVE_GROUND) { this.order = null; return none; }

    // stuck = barely moved for a while
    o.stuck = dt > 0 && dist(o.last, b.pos) / dt < STUCK_SPEED ? o.stuck + dt : 0;
    o.last = { ...b.pos };
    if (o.stuck > STUCK_TIME) { this.order = null; return none; }

    const d = sub(wp, b.pos);
    const l = len(d);
    if (l < 1e-3) return none;
    // on the last leg of a plain walk, brake to stop on the mark instead of rolling past it
    const stopIn = o.path.length <= 1 && !o.target ? rem : Infinity;
    return { ...none, move: scale(d, 1 / l), stopIn };
  }
}

/**
 * Which thing a click picked: the usable thing closest to the click on screen, within
 * `px` pixels. A thing counts as a short upright post from the floor to `top` metres
 * (a note on a door, a shelf, a lever), so a click on its picture hits it.
 * `project(p, y)` maps a ground point at height y to screen pixels (the view's projection).
 */
export function pickThing<T extends { id: string; at: V2 }>(things: T[], click: { x: number; y: number }, project: (p: V2, y: number) => { x: number; y: number }, px = 40, top = 1.4): T | null {
  let best: T | null = null, bd = px;
  for (const t of things) {
    const a = project(t.at, 0), b = project(t.at, top);
    const d = segDist(click, a, b);
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}

/** Distance from p to the segment ab (screen px). */
function segDist(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const ab = { x: b.x - a.x, y: b.y - a.y };
  const l2 = ab.x * ab.x + ab.y * ab.y;
  const k = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / l2)) : 0;
  return Math.hypot(p.x - a.x - ab.x * k, p.y - a.y - ab.y * k);
}
