import { V2 } from './vec';

/**
 * How Wolt's single wheel moves him: he rolls only along his heading, turns at a limited
 * rate (pivoting on the spot for sharp turns), speeds up and brakes smoothly, and can stop
 * on a mark instead of overshooting it. Pure logic, shared by the tech demo and the game.
 */
export interface DriveSpec {
  /** m/s² speeding up. */
  accel: number;
  /** m/s² slowing down (also when the wanted speed drops). */
  brake: number;
  /** rad/s top turning rate. */
  turn: number;
}

export const WOLT_DRIVE: DriveSpec = { accel: 10, brake: 16, turn: 10 };

/** The parts of a body the drive moves: heading (0 = +x) and forward speed in m/s. */
export interface DriveState { facing: number; speed: number }

export const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Turn the heading towards `target` (radians) at the drive's rate. Returns what is left. */
export function turnTowards(s: DriveState, target: number, dt: number, spec: DriveSpec = WOLT_DRIVE): number {
  const diff = wrapAngle(target - s.facing);
  // a slow wheel turns quicker on the spot than one that is rolling
  const rate = spec.turn * (1.25 - 0.45 * Math.min(1, Math.abs(s.speed) / 3));
  const step = Math.max(-rate * dt, Math.min(rate * dt, diff));
  s.facing = wrapAngle(s.facing + step);
  return diff - step;
}

/**
 * One frame of driving. `dir` is the wanted direction (length 0..1, 0 = let go), `max`
 * the top speed now, `stopIn` how far ahead he must come to a stop (for a click target).
 * Returns the displacement he would like to make; call `settle` with what really happened.
 */
export function drive(s: DriveState, dt: number, dir: V2, max: number, spec: DriveSpec = WOLT_DRIVE, stopIn = Infinity): V2 {
  const m = Math.min(1, Math.hypot(dir.x, dir.y));
  let want = 0;
  if (m > 0.01) {
    const left = turnTowards(s, Math.atan2(dir.y, dir.x), dt, spec);
    // roll only once roughly lined up: a sharp turn becomes a pivot, not a skid
    const align = Math.max(0, Math.cos(left));
    want = max * m * align * align;
  }
  if (stopIn < Infinity) want = Math.min(want, Math.sqrt(2 * spec.brake * 0.8 * Math.max(0, stopIn)));
  const a = want > s.speed ? spec.accel : spec.brake;
  const dv = want - s.speed;
  s.speed += Math.max(-a * dt, Math.min(a * dt, dv));
  if (s.speed < 1e-3 && want === 0) s.speed = 0;
  return { x: Math.cos(s.facing) * s.speed * dt, y: Math.sin(s.facing) * s.speed * dt };
}

/** After collisions: a wall or a taut rope takes the speed away, so he starts again gently. */
export function settle(s: DriveState, moved: number, dt: number) {
  if (dt > 0) s.speed = Math.min(s.speed, moved / dt);
}
