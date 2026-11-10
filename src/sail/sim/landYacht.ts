import { V2 } from '../../sim/vec';
import { wrapAngle } from '../../sim/drive';
import { Obstacle, SurfaceId, SURFACES, MAP, hitObstacle } from './terrain';

/**
 * Physics of the land yacht (Żaglowóz) for the driving demo. A rigid body on the ground
 * plane with a sail, three wheels (or runners) and a heel, in pure TS.
 *
 * - The sail: the apparent wind (true wind minus own velocity) meets the sail at an angle of
 *   attack set by the sheet. Too loose and it luffs (no force), right and it pulls hardest,
 *   too tight and it stalls: less drive, more sideways push and heel. The force is normal to
 *   the sail, so close-hauled most of it pushes sideways and only a little forward; on a
 *   reach it drives. Faster than the wind is normal for a land yacht: the apparent wind
 *   swings forward and grows with speed.
 * - The wheels (runners) roll forward with a rolling resistance that depends on the surface
 *   and hold sideways with a stiff grip up to a friction limit; past it the yacht slides
 *   (drifts). Steering turns the front wheel; at speed the grip, not the wheel, decides the
 *   turn, so a hard turn at 15 m/s washes out.
 * - Slopes pull downhill; dunes are up and down.
 * - Heel: the sail's side force high up and the turn's centrifugal pull at the centre of
 *   mass try to tip the yacht over the leeward wheel; its weight times the half-track holds
 *   it. Past 1 a wheel lifts (fast, and on the edge); past the tip angle it capsizes and Wolt
 *   needs a few seconds to right it. Hiking (Wolt leans out to windward) and runners (a wider
 *   track) hold more.
 */
export const YACHT = {
  g: 9.81,
  wheelbase: 2.1,
  /** m/s² per (m/s)² of apparent wind at a sail normal coefficient of 1. */
  sail: 0.024,
  /** Hull and Wolt in the air, m/s² per (m/s)², along the apparent wind. */
  hullDrag: 0.0032,
  boomMax: 1.35,
  sheetMin: 0.06,
  /** rad/s hauling in or easing out. */
  sheetRate: 1.0,
  /** Best angle of attack (most pull). */
  stall: 0.3,
  /** rad, front wheel lock, and how fast it turns. */
  steerMax: 0.5,
  steerRate: 2.4,
  /** 1/s: how hard the tyres kill sideways speed before they slide. */
  latStiff: 28,
  /** m/s² of braking on a surface with full grip. */
  brake: 4.5,
  /** Height of the sail's centre of effort and of the centre of mass, m. */
  hce: 2.1,
  hcg: 0.75,
  /** Half track: how far out the leeward wheel (runner) is. */
  track: { wheels: 0.75, runners: 1.2 } as Record<Gear, number>,
  /** Wolt leaning out to windward adds this much righting arm. */
  hike: 0.35,
  /** s to swap the wheels for runners (stopped). */
  swapTime: 2.5,
  /** s on its side before Wolt has it back up. */
  capsizeTime: 3.2,
  radius: 1.3,
  /** A crash faster than this (m/s into the obstacle) knocks it over. */
  crash: 9,
} as const;

export type Gear = 'wheels' | 'runners';

export interface YachtInput {
  /** −1 … +1, + turns the heading angle up (to starboard on this map). */
  steer: number;
  /** −1 haul in … +1 ease out. */
  sheet: number;
  brake: boolean;
  hike: boolean;
}

export interface YachtState {
  x: number; y: number;
  vx: number; vy: number;
  heading: number;
  yawRate: number;
  /** Front wheel angle, rad. */
  steer: number;
  /** How far the sheet lets the boom out, rad. */
  sheet: number;
  /** Q-1 trims the sheet (and eases it when the yacht starts to lift). */
  auto: boolean;
  gear: Gear;
  /** s left of a wheel/runner swap, 0 = none. */
  swap: number;
  /** Heel, rad, signed: + leans to the right of the heading (+90°). */
  heel: number;
  heelVel: number;
  /** s left lying on its side, 0 = upright. */
  capsized: number;
  // read-outs, set by yachtStep
  speed: number;
  /** Forward and sideways speed (sideways = sliding). */
  u: number; w: number;
  app: number;
  /** Direction the apparent wind blows towards (world). */
  appDir: number;
  /** Apparent wind angle off the bow it comes from, 0..π. */
  beta: number;
  /** True wind angle off the bow, 0..π. */
  betaTrue: number;
  /** Boom angle off the centre line (≥ 0) and side (+1 boom to the right). */
  boom: number;
  side: number;
  aoa: number;
  /** Sail normal coefficient now, 0..1.25 (0 = luffing). */
  cn: number;
  /** m/s² forward drive from the sail. */
  drive: number;
  /** Best sheet now. */
  best: number;
  /** Heeling moment over the righting moment, signed (|tip| > 1: a wheel lifts). */
  tip: number;
  /** The tip angle for the current gear (past it: over). */
  tipAngle: number;
  /** Sliding sideways (the tyres gave up). */
  sliding: boolean;
  surface: SurfaceId;
  /** Normal speed of the last bump into something, m/s, decays. */
  bump: number;
  /** A wheel touched down after flying (m/s of heel rate), decays. */
  land: number;
}

export function newYacht(x: number, y: number, heading: number, gear: Gear = 'wheels'): YachtState {
  return {
    x, y, vx: 0, vy: 0, heading, yawRate: 0, steer: 0, sheet: 0.6, auto: true, gear, swap: 0, heel: 0, heelVel: 0, capsized: 0,
    speed: 0, u: 0, w: 0, app: 0, appDir: 0, beta: 0, betaTrue: 0, boom: 0, side: 1, aoa: 0, cn: 0, drive: 0, best: 0.6, tip: 0, tipAngle: tipAngle(gear), sliding: false, surface: 'ash', bump: 0, land: 0,
  };
}

export const tipAngle = (gear: Gear) => Math.atan2(YACHT.track[gear], YACHT.hcg);

/** Normal-force coefficient of the sail at angle of attack a (rad). */
export function sailCn(a: number): number {
  if (a <= 0) return 0;
  if (a < YACHT.stall) { const t = a / YACHT.stall; return 1.25 * t * (2 - t); } // rounds over near the peak
  if (a < 0.8) return 1.25 - 0.3 * (a - YACHT.stall) / (0.8 - YACHT.stall);
  return 0.95 + 0.25 * Math.min(1, (a - 0.8) / 0.77); // flat plate across the wind (running)
}

export interface World {
  surfaceAt(x: number, y: number): SurfaceId;
  slopeAt(x: number, y: number): V2;
  obstacles: Obstacle[];
}

export interface StepEvents { capsized: boolean; landed: number; bumped: number; swapped: boolean }

/** Advance the yacht by dt (split into small steps). The wind is the true wind at the yacht. */
export function yachtStep(s: YachtState, dt: number, wind: { dir: number; speed: number }, input: YachtInput, world: World): StepEvents {
  const ev: StepEvents = { capsized: false, landed: 0, bumped: 0, swapped: false };
  const n = Math.max(1, Math.ceil(dt / (1 / 120)));
  for (let i = 0; i < n; i++) substep(s, dt / n, wind, input, world, ev);
  s.bump = Math.max(0, s.bump - dt * 6);
  s.land = Math.max(0, s.land - dt * 4);
  return ev;
}

/** Start swapping wheels and runners (only when nearly stopped and upright). */
export function startSwap(s: YachtState): boolean {
  if (s.swap > 0 || s.capsized > 0 || Math.hypot(s.vx, s.vy) > 0.6) return false;
  s.swap = YACHT.swapTime;
  return true;
}

function substep(s: YachtState, dt: number, wind: { dir: number; speed: number }, input: YachtInput, world: World, ev: StepEvents) {
  const g = YACHT.g;
  const fx = Math.cos(s.heading), fy = Math.sin(s.heading); // forward
  const px = -fy, py = fx;                                  // right of the heading
  s.surface = world.surfaceAt(s.x, s.y);
  const surf = SURFACES[s.surface];
  const crr = surf.crr[s.gear], grip = surf.grip[s.gear];

  // apparent wind
  const wx = Math.cos(wind.dir) * wind.speed, wy = Math.sin(wind.dir) * wind.speed;
  const ax = wx - s.vx, ay = wy - s.vy;
  s.app = Math.hypot(ax, ay);
  s.appDir = Math.atan2(ay, ax);
  const from = wrapAngle(Math.atan2(-ay, -ax) - s.heading); // + = comes from the right
  s.beta = Math.abs(from);
  s.betaTrue = Math.abs(wrapAngle(Math.atan2(-wy, -wx) - s.heading));
  const lee = from >= 0 ? -1 : 1; // the sail pushes away from the wind
  s.side = lee;

  // the sheet: by hand, or Q-1 keeps it at the best angle and eases it when a wheel lifts
  s.best = Math.max(YACHT.sheetMin, Math.min(YACHT.boomMax, s.beta - YACHT.stall));
  if (s.auto) {
    const over = Math.max(0, Math.abs(s.tip) - 0.75, Math.abs(s.heel) > 0.012 ? 0.3 : 0);
    const want = Math.min(YACHT.boomMax, s.best + over * 4);
    const d = want - s.sheet;
    // it eases quickly when she starts to lift, and hauls in a little slower than a quick hand
    s.sheet += Math.sign(d) * Math.min(Math.abs(d), YACHT.sheetRate * (d > 0 && over > 0 ? 1.6 : 0.8) * dt);
  }
  if (input.sheet) { s.auto = false; s.sheet += input.sheet * YACHT.sheetRate * dt; }
  s.sheet = Math.max(YACHT.sheetMin, Math.min(YACHT.boomMax, s.sheet));

  const upright = s.capsized <= 0 && s.swap <= 0;
  s.boom = Math.min(s.beta, s.sheet, YACHT.boomMax);
  s.aoa = Math.max(0, s.beta - s.boom);
  // heeled, the sail sees less wind; on its side, none
  const heelCos = Math.cos(s.heel);
  s.cn = upright ? sailCn(s.aoa) : 0;
  const N = YACHT.sail * s.app * s.app * s.cn * heelCos * heelCos;
  const sailF = N * Math.sin(s.boom), sailS = N * Math.cos(s.boom) * lee;
  s.drive = sailF;

  // everything but the tyres: sail, the hull's drag, the slope
  const sl = world.slopeAt(s.x, s.y);
  let axF = sailF * fx + sailS * px + YACHT.hullDrag * s.app * ax - g * 0.85 * sl.x;
  let ayF = sailF * fy + sailS * py + YACHT.hullDrag * s.app * ay - g * 0.85 * sl.y;

  s.u = s.vx * fx + s.vy * fy;
  s.w = s.vx * px + s.vy * py;
  const aLongFree = axF * fx + ayF * fy;
  const aLatFree = axF * px + ayF * py;

  // forward: rolling resistance and the brake hold until the push beats them
  let aLong: number;
  if (s.capsized > 0) {
    aLong = -Math.sign(s.u) * Math.min(Math.abs(s.u) / dt, 6);
  } else {
    const hold = crr * g + (input.brake || s.swap > 0 ? YACHT.brake * Math.min(1, grip + 0.3) : 0);
    if (Math.abs(s.u) < 0.05 && Math.abs(aLongFree) <= hold) aLong = -s.u / dt;
    else {
      aLong = aLongFree - Math.sign(s.u || aLongFree) * hold;
      // resistance never pushes it backwards past zero
      if (Math.sign(s.u + aLong * dt) !== Math.sign(s.u) && Math.abs(s.u) > 1e-6 && Math.abs(aLongFree) <= hold) aLong = -s.u / dt;
    }
  }

  // sideways: the tyres kill sliding up to their grip
  const need = -s.w * YACHT.latStiff - aLatFree;
  const max = grip * g * (s.capsized > 0 ? 1.5 : 1);
  const tyre = Math.max(-max, Math.min(max, need));
  s.sliding = Math.abs(need) > max * 1.02 && Math.abs(s.w) > 0.4;
  const aLat = aLatFree + tyre;

  s.vx += (aLong * fx + aLat * px) * dt;
  s.vy += (aLong * fy + aLat * py) * dt;

  // steering
  const lock = YACHT.steerMax / (1 + Math.max(0, s.u) / 9);
  const wantSteer = (s.capsized > 0 ? 0 : Math.max(-1, Math.min(1, input.steer))) * lock;
  s.steer += Math.sign(wantSteer - s.steer) * Math.min(Math.abs(wantSteer - s.steer), YACHT.steerRate * dt);
  let r = s.u * Math.tan(s.steer) / YACHT.wheelbase;
  // the front tyre can only bend the path as hard as its grip allows: past that it pushes on
  const rMax = (grip * g * 1.1) / Math.max(1, Math.abs(s.u));
  r = Math.max(-rMax, Math.min(rMax, r));
  // nearly stopped, Wolt shoves the tail round
  if (Math.abs(s.u) < 1 && s.capsized <= 0) r += input.steer * 0.3 * (1 - Math.abs(s.u));
  s.yawRate += (r - s.yawRate) * Math.min(1, dt * 9);
  s.heading = wrapAngle(s.heading + s.yawRate * dt);

  // heel
  heel(s, dt, sailS, tyre, input, ev);

  // move, bump into things, stay on the map
  s.x += s.vx * dt; s.y += s.vy * dt;
  for (const o of world.obstacles) {
    if (Math.abs(o.x - s.x) > o.r + 4 || Math.abs(o.y - s.y) > o.r + 4) continue;
    const h = hitObstacle(s, YACHT.radius, o);
    if (!h) continue;
    s.x += h.nx * h.depth; s.y += h.ny * h.depth;
    const vn = s.vx * h.nx + s.vy * h.ny;
    if (vn < 0) {
      s.vx -= 1.3 * vn * h.nx; s.vy -= 1.3 * vn * h.ny;
      s.vx *= 0.75; s.vy *= 0.75;
      s.bump = Math.max(s.bump, -vn); ev.bumped = Math.max(ev.bumped, -vn);
      if (-vn > YACHT.crash && s.capsized <= 0) capsize(s, ev, Math.sign(s.heel) || 1);
    }
  }
  const lo = 2, hi = MAP.size - 2;
  if (s.x < lo || s.x > hi) { s.x = Math.max(lo, Math.min(hi, s.x)); s.vx *= -0.2; }
  if (s.y < lo || s.y > hi) { s.y = Math.max(lo, Math.min(hi, s.y)); s.vy *= -0.2; }

  // wheels <-> runners
  if (s.swap > 0) {
    s.swap -= dt;
    if (s.swap <= 0) { s.swap = 0; s.gear = s.gear === 'wheels' ? 'runners' : 'wheels'; s.tipAngle = tipAngle(s.gear); ev.swapped = true; }
  }
  s.speed = Math.hypot(s.vx, s.vy);
}

function capsize(s: YachtState, ev: StepEvents, side: number) {
  s.capsized = YACHT.capsizeTime;
  s.heelVel = side * 2;
  ev.capsized = true;
}

/** Heeling: sail side force high up, centrifugal pull at the centre of mass, weight holding it. */
function heel(s: YachtState, dt: number, sailS: number, tyre: number, input: YachtInput, ev: StepEvents) {
  const g = YACHT.g;
  const b0 = YACHT.track[s.gear];
  if (s.capsized > 0) {
    s.capsized -= dt;
    const side = Math.sign(s.heel) || 1;
    if (s.capsized > 1) {
      // falls onto its side and lies there
      s.heel += side * Math.max(0, 1.35 - Math.abs(s.heel)) * Math.min(1, dt * 6);
    } else {
      // Wolt has it back on its wheels
      s.heel = side * 1.35 * Math.max(0, s.capsized);
      if (s.capsized <= 0) { s.capsized = 0; s.heel = 0; s.heelVel = 0; s.vx = 0; s.vy = 0; s.yawRate = 0; }
    }
    s.tip = 0;
    return;
  }
  // moment towards +right (per unit mass): sail high up, the tyres' pull low down
  const Mh = sailS * (YACHT.hce - YACHT.hcg) - tyre * YACHT.hcg;
  const dir = Math.sign(Mh) || 1;
  // hiking: Wolt leans out on the side the wind comes from
  const b = b0 + (input.hike ? YACHT.hike : 0);
  s.tip = Mh / (g * b);
  const tipA = Math.atan2(b, YACHT.hcg);
  s.tipAngle = tipA;
  if (Math.abs(s.heel) < 0.012 && s.heelVel === 0) {
    // on all wheels: the springs lean a little
    if (Math.abs(s.tip) <= 1) { s.heel = s.tip * 0.008; return; }
    s.heel = dir * 0.013; s.heelVel = dir * 0.05;
  }
  // a wheel is up: rotate about the other one
  const side = Math.sign(s.heel);
  const th = Math.abs(s.heel);
  const arm = Math.hypot(b, YACHT.hcg);
  const right = g * arm * Math.cos(th + Math.atan2(YACHT.hcg, b)); // weight's arm shrinks as it tips; < 0 past the tip angle
  const push = Mh * side * Math.cos(th) * Math.cos(th);
  const acc = side * (push - right) / (arm * arm) - 2.2 * s.heelVel;
  s.heelVel += acc * dt;
  s.heel += s.heelVel * dt;
  if (Math.sign(s.heel) !== side || Math.abs(s.heel) < 0.012) {
    // touched down
    ev.landed = Math.max(ev.landed, Math.abs(s.heelVel));
    s.land = Math.max(s.land, Math.abs(s.heelVel));
    s.heel = 0; s.heelVel = 0;
  } else if (Math.abs(s.heel) > tipA) capsize(s, ev, side);
}
