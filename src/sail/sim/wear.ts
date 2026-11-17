import { tr } from '../../i18n';
import { SurfaceId } from './terrain';
import { YachtState } from './landYacht';

/**
 * Wear of the land yacht (decision 2026-11-17, docs/DEMO-ZEGLUGA.md): every part breaks in
 * its own way, and you see and hear it coming long before it gives out. There is no "63%"
 * bar on screen: the symptoms are the gauge, the state card (K) only confirms them.
 *
 * - the wheel bearings: sand and ash grind them; they squeal with each turn of the wheel and
 *   the wheel starts to wobble; seized, they drag hard.
 * - the sail: flogging (a luffing sail) and strong wind fray it; a loose flap at the leech
 *   flutters and buzzes; torn, it pulls half as hard.
 * - the mainsheet: load near the tipping point and capsizes chafe it; it creaks and twangs and
 *   goes hairy; snapped, the boom swings free and the sail only flaps.
 *
 * Repair is short and physical: stop, X, a few seconds. Pure logic, no Three.js.
 */
export type PartId = 'bearing' | 'sail' | 'sheet';
export const PARTS: PartId[] = ['bearing', 'sail', 'sheet'];

/** From here the part shows and sounds wrong. */
export const SYMPTOM = 0.45;
/** From here the symptoms are loud: it will go soon. */
export const CRITICAL = 0.8;
/** s of work to fix one part (stopped). */
export const REPAIR_TIME = 3;
/** What a fixed part is left at (it is patched, not new). */
export const REPAIRED = 0.08;
/** The old yacht starts worn, so the first symptoms come within a few minutes of sailing. */
export const START_WEAR: Record<PartId, number> = { bearing: 0.36, sail: 0.3, sheet: 0.25 };

/** Bearing wear per metre rolled, by ground (grit gets in). */
const GRIT: Record<SurfaceId, number> = { road: 0.25, ash: 1, loose: 1.6, lake: 0.35, gravel: 1.3, mud: 1.5 };
const BEARING_PER_M = 2.6e-4;
/** Sail: per second of flogging at 10 m/s apparent wind, and per second of hard wind. */
const SAIL_FLOG = 0.006;
const SAIL_WIND = 0.0011;
/** Sheet: per second near the tipping point, and per capsize. */
const SHEET_LOAD = 0.006;
const SHEET_CAPSIZE = 0.07;

/** What a broken part does to the yacht (read by the physics). */
export const BROKEN = { bearingCrr: 0.09, sailPull: 0.5 } as const;

export interface Wear {
  w: Record<PartId, number>;
  /** The part being fixed and the seconds of work done. */
  repair: { part: PartId; t: number } | null;
}

export const newWear = (): Wear => ({ w: { ...START_WEAR }, repair: null });

export const stage = (v: number): 'ok' | 'symptom' | 'critical' | 'broken' => v >= 1 ? 'broken' : v >= CRITICAL ? 'critical' : v >= SYMPTOM ? 'symptom' : 'ok';
/** 0 below the symptom threshold, rising to 1 when it breaks: how loud and visible it is. */
export const loudness = (v: number): number => Math.max(0, Math.min(1, (v - SYMPTOM) / (1 - SYMPTOM)));

export const PART_NAME: Record<PartId, string> = {
  bearing: tr('łożyska kół', 'wheel bearings'),
  sail: tr('żagiel', 'sail'),
  sheet: tr('szot', 'mainsheet'),
};

export interface WearEvents { broke: PartId | null; fixed: PartId | null }

/** Advance wear by dt. `rate` speeds it up for testing (?wear=fast). */
export function wearStep(wr: Wear, s: YachtState, dt: number, capsized: boolean, rate = 1): WearEvents {
  const ev: WearEvents = { broke: null, fixed: null };
  const before = { ...wr.w };
  if (wr.repair) {
    // the yacht stands on its brake while Wolt works (s.hold); a capsize or a shove drops the repair
    if (s.speed > 1.5 || s.capsized > 0) wr.repair = null;
    else if ((wr.repair.t += dt) >= REPAIR_TIME) { wr.w[wr.repair.part] = REPAIRED; ev.fixed = wr.repair.part; wr.repair = null; }
    s.hold = !!wr.repair;
    applyFaults(wr, s);
    return ev;
  }
  const up = s.capsized <= 0 && s.dock >= 1;
  if (s.gear === 'wheels' && up) wr.w.bearing += Math.abs(s.u) * dt * GRIT[s.surface] * BEARING_PER_M * rate;
  if (up) {
    const flog = Math.max(0, 1 - s.cn / 0.4) * Math.min(1.5, s.app / 10);
    wr.w.sail += (flog * SAIL_FLOG + Math.max(0, s.app - 9) / 6 * SAIL_WIND) * dt * rate;
    wr.w.sheet += Math.max(0, Math.abs(s.tip) - 0.6) * SHEET_LOAD * dt * rate;
  }
  if (capsized) wr.w.sheet += SHEET_CAPSIZE * rate;
  for (const p of PARTS) {
    wr.w[p] = Math.min(1, wr.w[p]);
    if (before[p] < 1 && wr.w[p] >= 1) ev.broke = p;
  }
  applyFaults(wr, s);
  return ev;
}

/** Push the broken parts' effects into the yacht state for the physics. */
export function applyFaults(wr: Wear, s: YachtState) {
  s.fault = {
    crr: wr.w.bearing >= 1 && s.gear === 'wheels' ? BROKEN.bearingCrr : 0,
    sail: wr.w.sail >= 1 ? BROKEN.sailPull : 1,
    sheetFree: wr.w.sheet >= 1,
  };
}

/** The part most worth fixing now (the most worn), or null when nothing shows yet. */
export function worst(wr: Wear): PartId | null {
  let best: PartId | null = null;
  for (const p of PARTS) if (wr.w[p] >= SYMPTOM && (!best || wr.w[p] > wr.w[best])) best = p;
  return best;
}

/** Start fixing the worst part (stopped). Returns the part, or null with nothing to fix or moving. */
export function startRepair(wr: Wear, s: YachtState): PartId | null {
  if (wr.repair || s.speed > 0.6 || s.capsized > 0) return null;
  const p = worst(wr);
  if (p) { wr.repair = { part: p, t: 0 }; s.hold = true; }
  return p;
}
