import { describe, it, expect } from 'vitest';
import { SailGame } from '../src/sail/sim/sailGame';
import { SYMPTOM, CRITICAL, START_WEAR, REPAIRED, BROKEN, stage, loudness, startRepair, wearStep, newWear, REPAIR_TIME } from '../src/sail/sim/wear';
import { newYacht, yachtStep } from '../src/sail/sim/landYacht';

const DT = 1 / 30;
const sail = { steer: 0, sheet: 0, brake: false, hike: false };

describe('Land yacht wear: symptoms before the break', () => {
  it('starts worn but quiet, every part below its symptoms', () => {
    const g = new SailGame();
    for (const v of Object.values(g.wear.w)) { expect(v).toBeLessThan(SYMPTOM); expect(loudness(v)).toBe(0); }
    expect(START_WEAR.bearing).toBeGreaterThan(0.2);
  });

  it('the bearing wears with the distance rolled, more on ash than on the road', () => {
    const y = newYacht(0, 0, 0);
    const a = newWear(), b = newWear();
    Object.assign(y, { u: 8, speed: 8, surface: 'ash' });
    for (let i = 0; i < 300; i++) wearStep(a, y, DT, false);
    Object.assign(y, { surface: 'road' });
    for (let i = 0; i < 300; i++) wearStep(b, y, DT, false);
    expect(a.w.bearing - START_WEAR.bearing).toBeGreaterThan(3 * (b.w.bearing - START_WEAR.bearing));
  });

  it('every part passes through symptom and critical before it breaks', () => {
    const g = new SailGame();
    g.wearRate = 40;
    const seen = new Set<string>();
    let broke: string | null = null;
    for (let t = 0; t < 400 && !broke; t += DT) {
      const ev = g.update(DT, { ...sail, steer: 0.15 });
      for (const v of Object.values(g.wear.w)) seen.add(stage(v));
      broke = ev.wear.broke;
    }
    expect(broke).not.toBeNull();
    expect(seen.has('symptom') && seen.has('critical')).toBe(true);
    expect(CRITICAL).toBeGreaterThan(SYMPTOM);
  });

  it('broken parts change the physics: a torn sail pulls half, a seized bearing drags', () => {
    const world = { surfaceAt: () => 'road' as const, slopeAt: () => ({ x: 0, y: 0 }), obstacles: [] };
    const wind = { dir: Math.PI / 2, speed: 8 };
    const run = (fault?: ReturnType<typeof newYacht>['fault']) => { const s = newYacht(0, 0, 0); s.fault = fault; for (let i = 0; i < 300; i++) yachtStep(s, DT, wind, sail, world); return s.speed; };
    const ok = run(), torn = run({ crr: 0, sail: BROKEN.sailPull, sheetFree: false }), seized = run({ crr: BROKEN.bearingCrr, sail: 1, sheetFree: false });
    expect(torn).toBeLessThan(ok * 0.85);
    expect(seized).toBeLessThan(ok * 0.85);
  });

  it('repair only when stopped, takes a few seconds, leaves the part patched', () => {
    const g = new SailGame();
    g.wear.w.sheet = 1;
    g.yacht.vx = 5; g.yacht.speed = 5;
    expect(startRepair(g.wear, g.yacht)).toBeNull();
    g.yacht.vx = 0; g.yacht.vy = 0; g.yacht.speed = 0;
    expect(startRepair(g.wear, g.yacht)).toBe('sheet');
    let fixed = null;
    for (let t = 0; t < REPAIR_TIME + 0.5 && !fixed; t += DT) fixed = g.update(DT, sail).wear.fixed; // no brake: the yacht is held while Wolt works
    expect(fixed).toBe('sheet');
    expect(g.wear.w.sheet).toBe(REPAIRED);
    expect(g.yacht.fault?.sheetFree).toBe(false);
  });

  it('nothing wears in the Q-1 simulator', () => {
    const g = new SailGame();
    g.wearOn = false; g.wearRate = 50;
    const w0 = { ...g.wear.w };
    for (let t = 0; t < 30; t += DT) g.update(DT, { ...sail, steer: 0.2 });
    expect(g.wear.w).toEqual(w0);
  });
});
