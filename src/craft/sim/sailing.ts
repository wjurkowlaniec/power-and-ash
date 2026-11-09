import { V2 } from '../../sim/vec';
import { wrapAngle } from '../../sim/drive';

/**
 * Sailing physics for the land yacht (Żaglowóz) in the crafting demo. Pure logic,
 * no rendering, no world: the game moves the yacht and handles bumps.
 *
 * The model is a flat sail on a boom held by a sheet:
 * - the apparent wind is the true wind minus the yacht's own speed;
 * - the boom would stream with the wind, but the sheet stops it at `sheet` radians;
 * - the angle between the apparent wind and the boom is the angle of attack: near zero
 *   the sail luffs (flaps, no force), around `stall` it pulls hardest, more than that and
 *   it only pushes (downwind);
 * - the force on the sail is normal to it, so only `sin(boom)` of it drives the yacht
 *   forward: sheeted in tight you point high but slowly, eased out you go fast on a reach;
 * - the runners (or wheels) hold it sideways; rolling resistance in ash is small on
 *   runners and big on wheels, plus air drag.
 * Straight into the wind nothing pulls: that is the no-go zone, you tack around it.
 */
export const SAIL = {
  /** m/s² per (m/s)² of apparent wind at full drive. */
  push: 0.065,
  /** rad: angle of attack with the most pull. */
  stall: 0.35,
  /** rad: the shrouds stop the boom here. */
  boomMax: 1.3,
  sheetMin: 0.08,
  /** m/s² rolling resistance in loose ash. */
  roll: { runners: 0.3, wheels: 2.4 },
  /** Air and surface drag, m/s² per (m/s)². */
  air: 0.05,
  /** m/s² with the brake (the runners dig in). */
  brake: 5,
  /** rad/s steering at speed, and when nearly stopped (Wolt shoves the tail round). */
  turn: 0.9,
  turnSlow: 0.35,
  /** rad/s hauling in or easing out the sheet. */
  sheetRate: 0.9,
  /** Apparent wind (m/s) above which a loaded sail starts to fray, and how fast. */
  wearAbove: 11,
  wearRate: 0.004,
  /** A torn sail pulls this much less. */
  wearLoss: 0.6,
  /** rad: the true wind closer than this to the bow counts as sailing upwind. */
  upwind: 1.31,
} as const;

export interface SailState {
  /** Heading on the ground plane (0 = +x, π/2 = +y). */
  heading: number;
  /** Forward speed, m/s (never backwards). */
  v: number;
  /** How far the sheet lets the boom out, rad. */
  sheet: number;
  /** Q-1 trims the sheet by itself. */
  auto: boolean;
  /** 0..1 how frayed the sail is. */
  wear: number;
  // read-outs, set by sailStep
  /** Boom angle off the centre line, rad (always ≥ 0) and which side it is on (±1). */
  boom: number;
  side: number;
  /** Apparent wind: speed and the angle it comes from off the bow (0 = head-on, π = from behind). */
  app: number;
  beta: number;
  /** True wind angle off the bow, same convention. */
  betaTrue: number;
  aoa: number;
  /** 0..1 how full the sail is (0 = luffing). */
  fill: number;
  /** 0..1 forward share of the sail's pull. */
  drive: number;
  /** The sheet that would pull hardest now. */
  best: number;
  /** m/s² of push from the sail right now. */
  force: number;
}

export function newSail(heading = 0): SailState {
  return { heading, v: 0, sheet: 0.7, auto: false, wear: 0, boom: 0, side: 1, app: 0, beta: 0, betaTrue: 0, aoa: 0, fill: 0, drive: 0, best: 0.7, force: 0 };
}

export interface SailInput {
  /** −1 port … +1 starboard (heading angle grows with +1). */
  steer: number;
  /** −1 haul in … +1 ease out. */
  sheet: number;
  brake: boolean;
}

export interface WindNow { dir: number; strength: number }

/** Normal-force share of a flat sail at angle of attack `a`. */
export function sailLift(a: number): number {
  if (a <= 0) return 0;
  if (a < SAIL.stall) return a / SAIL.stall;
  return 1 - 0.25 * Math.min(1, (a - SAIL.stall) / 1.2);
}

/** One step of the sail and the yacht's speed and heading. Returns the distance run. */
export function sailStep(s: SailState, dt: number, wind: WindNow, input: SailInput, runners: boolean): number {
  // apparent wind = true wind − own velocity
  const wx = Math.cos(wind.dir) * wind.strength, wy = Math.sin(wind.dir) * wind.strength;
  const ax = wx - Math.cos(s.heading) * s.v, ay = wy - Math.sin(s.heading) * s.v;
  s.app = Math.hypot(ax, ay);
  // where it comes from, off the bow
  const from = wrapAngle(Math.atan2(-ay, -ax) - s.heading);
  s.beta = Math.abs(from);
  s.side = from >= 0 ? -1 : 1; // the boom swings away from the wind
  s.betaTrue = Math.abs(wrapAngle(Math.atan2(-wy, -wx) - s.heading));

  // the sheet: by hand, or Q-1 keeps it at the best angle
  s.best = Math.max(SAIL.sheetMin, Math.min(SAIL.boomMax, s.beta - SAIL.stall));
  if (s.auto) {
    const d = s.best - s.sheet;
    s.sheet += Math.sign(d) * Math.min(Math.abs(d), SAIL.sheetRate * dt);
  } else s.sheet += input.sheet * SAIL.sheetRate * dt;
  s.sheet = Math.max(SAIL.sheetMin, Math.min(SAIL.boomMax, s.sheet));

  // the boom streams with the wind until the sheet or the shrouds stop it
  s.boom = Math.min(s.beta, s.sheet, SAIL.boomMax);
  s.aoa = Math.max(0, s.beta - s.boom);
  s.fill = sailLift(s.aoa);
  s.drive = s.fill * Math.sin(s.boom);
  s.force = SAIL.push * s.app * s.app * s.drive * (1 - SAIL.wearLoss * s.wear);

  // a loaded sail in a strong wind frays
  if (s.app > SAIL.wearAbove && s.fill > 0.5) s.wear = Math.min(1, s.wear + SAIL.wearRate * (s.app - SAIL.wearAbove) * dt);

  const roll = runners ? SAIL.roll.runners : SAIL.roll.wheels;
  const resist = roll + SAIL.air * s.v * s.v + (input.brake ? SAIL.brake : 0);
  if (s.v < 0.02 && s.force <= roll) s.v = 0; // not enough to break it free
  else s.v = Math.max(0, s.v + (s.force - resist) * dt);

  // steering needs a bit of speed; nearly stopped, Wolt shoves the tail round
  const rate = SAIL.turnSlow + (SAIL.turn - SAIL.turnSlow) * Math.min(1, s.v / 2);
  s.heading = wrapAngle(s.heading + Math.max(-1, Math.min(1, input.steer)) * rate * dt);
  return s.v * dt;
}

/** Steer towards a point: −1, 0 or +1 with a small dead band. */
export function steerTowards(s: SailState, from: V2, to: V2): number {
  const d = wrapAngle(Math.atan2(to.y - from.y, to.x - from.x) - s.heading);
  return Math.abs(d) < 0.04 ? d / 0.04 : Math.sign(d);
}
