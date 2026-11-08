import { V2, add, sub, scale, len, dist } from './vec';
import { World } from './world';
import { tr } from '../i18n';

/**
 * Loose things Wolt can hook onto his hitch and drag behind him: an old tyre, a sled of
 * bricks. Pure logic, no rendering. A load sits on the ground as a circle, it does not
 * block tiles (A* and the cable ignore it), but Wolt bumps into loads that are not his.
 */
export type LoadKind = 'tyre' | 'bricks' | 'cart';

export interface LoadSpec {
  name: string;      // as an object: Polish accusative ("doczep oponę"), English with "the"
  radius: number;    // m
  /** 0..1, how much the load slows Wolt down while towed. */
  drag: number;
  /** Extra drain in Wh/s while Wolt drags it. */
  drain: number;
}

export const LOADS: Record<LoadKind, LoadSpec> = {
  tyre: { name: tr('oponę', 'the tyre'), radius: 0.42, drag: 0.22, drain: 0.25 },
  bricks: { name: tr('sanki z cegłami', 'the brick sled'), radius: 0.48, drag: 0.45, drain: 0.6 },
  // the service cart in the crafting demo (/demo-craft/): on wheels, so it rolls easily
  cart: { name: tr('wózek', 'the cart'), radius: 0.7, drag: 0.15, drain: 0.2 },
};

export interface Load { id: string; kind: LoadKind; pos: V2; angle: number }

export const ROPE = 1.5;        // m of tow rope from the hitch to the load's edge
export const HITCH_BACK = 0.38; // m behind Wolt's centre
export const TOW_RANGE = 1.4;   // m from Wolt to the load's edge to hook it

export const hitchOf = (pos: V2, facing: number): V2 =>
  ({ x: pos.x - Math.cos(facing) * HITCH_BACK, y: pos.y - Math.sin(facing) * HITCH_BACK });

export interface TowStep { pos: V2; angle: number; taut: boolean; blocked: boolean }

/**
 * Where the load ends up when the hitch moves to `hitch`. The rope only pulls: while it
 * is slack the load stays put. When it pulls, the load slides straight towards the hitch
 * until the rope is just taut, sliding along walls per axis. `blocked` means it could not
 * follow far enough (snagged on a wall or a rock), so the hitch is too far away.
 */
export function towStep(world: World, load: Load, hitch: V2): TowStep {
  const r = LOADS[load.kind].radius;
  const reach = ROPE + r;
  const d = sub(load.pos, hitch);
  const l = len(d);
  if (l <= reach) return { pos: load.pos, angle: load.angle, taut: l > reach - 0.05, blocked: false };
  const want = add(hitch, scale(d, reach / l));
  // small steps, so a fast pull cannot hop the load over a thin wall
  let p = { ...load.pos };
  const n = Math.max(1, Math.ceil(dist(want, p) / 0.1));
  const st = scale(sub(want, p), 1 / n);
  for (let i = 0; i < n; i++) {
    const tx = { x: p.x + st.x, y: p.y };
    if (!world.circleBlocked(tx, r)) p = tx;
    const ty = { x: p.x, y: p.y + st.y };
    if (!world.circleBlocked(ty, r)) p = ty;
  }
  const moved = sub(p, load.pos);
  // the load turns to trail behind the rope
  const angle = len(moved) > 1e-4 ? Math.atan2(hitch.y - p.y, hitch.x - p.x) : load.angle;
  return { pos: p, angle, taut: true, blocked: dist(p, hitch) > reach + 0.02 };
}

/**
 * Wolt wants to roll to `cand` with the load on his hitch. The load follows on the rope;
 * when it snags, it still slides as far as it can and Wolt is held on the rope's circle
 * around it, so he slows to a stop pulling straight away and can swing round the snag,
 * instead of freezing on the spot. `free` says where Wolt's body may stand.
 */
export function towDrive(world: World, load: Load, from: V2, cand: V2, facing: number, free: (p: V2) => boolean): { pos: V2; step: TowStep } {
  const h = hitchOf(cand, facing);
  const s = towStep(world, load, h);
  if (!s.blocked) return { pos: cand, step: s };
  const d = sub(h, s.pos), l = len(d);
  // towards the load is always fine; away from it, he keeps his distance and slides round
  const keep = Math.max(ROPE + LOADS[load.kind].radius, dist(hitchOf(from, facing), s.pos));
  if (l <= keep) return { pos: cand, step: { ...s, taut: true } };
  const held = add(cand, sub(add(s.pos, scale(d, keep / Math.max(l, 1e-6))), h));
  const pos = free(held) ? held : from;
  return { pos, step: { pos: s.pos, angle: s.angle, taut: true, blocked: true } };
}
