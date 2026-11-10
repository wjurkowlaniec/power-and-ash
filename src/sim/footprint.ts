import { V2 } from './vec';
import { World } from './world';

/**
 * Wolt's body seen from above. The wheel alone (one circle at his centre) let the capsule's
 * nose and the cable reel at the back poke into walls, glass and cabinets (issue: clipping).
 * Now the body is three circles along the heading: the wheel, the nose with the lamp, and
 * the reel with the hitch. The ends are a little smaller than the drawn parts so that a
 * pivot still fits in a corridor one metre wide (sweep radius 0.5 m).
 *
 * Pure logic, shared by the game scenes and the tech demo.
 */
export interface Circle { at: number; r: number }

/** Offsets along the heading (m, + = forward) and radii. The wheel's radius comes from the caller. */
export const NOSE: Circle = { at: 0.24, r: 0.18 };
export const TAIL: Circle = { at: -0.32, r: 0.18 };

const EPS = 1e-4;

/** How deep a circle sits in blocked tiles (0 = free). Outside the grid counts as blocked. */
export function circleDepth(world: World, p: V2, r: number): number {
  let deep = 0;
  const i0 = Math.floor(p.x - r), i1 = Math.floor(p.x + r);
  const j0 = Math.floor(p.y - r), j1 = Math.floor(p.y + r);
  for (let j = j0; j <= j1; j++)
    for (let i = i0; i <= i1; i++) {
      if (!world.isBlocked(i, j)) continue;
      const dx = Math.max(i - p.x, 0, p.x - (i + 1));
      const dy = Math.max(j - p.y, 0, p.y - (j + 1));
      const d = Math.hypot(dx, dy);
      if (d < r) deep = Math.max(deep, r - d);
    }
  return deep;
}

const along = (p: V2, f: number, at: number): V2 => ({ x: p.x + Math.cos(f) * at, y: p.y + Math.sin(f) * at });

/** How deep the nose and the tail sit in walls, together. */
export function endsDepth(world: World, p: V2, facing: number): number {
  return circleDepth(world, along(p, facing, NOSE.at), NOSE.r) + circleDepth(world, along(p, facing, TAIL.at), TAIL.r);
}

/** The whole body is clear of walls. */
export function bodyFree(world: World, p: V2, facing: number, wheelR: number): boolean {
  return !world.circleBlocked(p, wheelR) && endsDepth(world, p, facing) < EPS;
}

/**
 * May the body go from (from, fromFacing) to (to, toFacing)? The wheel must stay clear,
 * and the ends may not go deeper into a wall than they already are: a body that somehow
 * got stuck (an old save, a door closing) can always back out, never dig further in.
 */
export function bodyOk(world: World, from: V2, fromFacing: number, to: V2, toFacing: number, wheelR: number): boolean {
  if (world.circleBlocked(to, wheelR)) return false;
  const now = endsDepth(world, to, toFacing);
  return now < EPS || now <= endsDepth(world, from, fromFacing) + EPS;
}

const PUSH_DIRS = 16;
const PUSH_STEPS = [0.03, 0.06, 0.1, 0.14, 0.18, 0.24];

/**
 * After the drive turned the heading from `before` to `facing`: if the nose or the tail
 * would swing into a wall, roll the wheel a few centimetres away so the turn still fits
 * (sliding off the wall like the real body would). If nothing nearby fits, the turn is
 * undone. `ok` adds the scene's own limits (a cable's length, the hall's open door).
 */
export function guardTurn(world: World, pos: V2, before: number, facing: number, wheelR: number, ok: (p: V2) => boolean = () => true): { pos: V2; facing: number } {
  if (bodyOk(world, pos, before, pos, facing, wheelR)) return { pos, facing };
  const base = endsDepth(world, pos, before);
  for (const d of PUSH_STEPS)
    for (let k = 0; k < PUSH_DIRS; k++) {
      const a = (k / PUSH_DIRS) * Math.PI * 2;
      const p = { x: pos.x + Math.cos(a) * d, y: pos.y + Math.sin(a) * d };
      if (world.circleBlocked(p, wheelR) || !ok(p)) continue;
      const deep = endsDepth(world, p, facing);
      if (deep < EPS || deep <= base + EPS) return { pos: p, facing };
    }
  return { pos, facing: before };
}
