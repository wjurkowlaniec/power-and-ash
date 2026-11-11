import { describe, it, expect } from 'vitest';
import { surfaceAt, heightAt, buildObstacles, hitObstacle, LAKE, DUNES, START, MAP, ROAD } from '../src/sail/sim/terrain';
import { WindField, WIND } from '../src/sail/sim/windField';
import { newYacht, yachtStep, startSwap, sailCn, YACHT, YachtState, World, YachtInput } from '../src/sail/sim/landYacht';
import { COURSES, gatePoles, newRun, runStep } from '../src/sail/sim/courses';
import { SailGame } from '../src/sail/sim/sailGame';
import { SurfaceId, SURFACES } from '../src/sail/sim/terrain';

const flat = (surf: SurfaceId): World => ({ surfaceAt: () => surf, slopeAt: () => ({ x: 0, y: 0 }), obstacles: [] });
const idle: YachtInput = { steer: 0, sheet: 0, brake: false, hike: false };
/** Wind from the west (blowing towards +x) and a heading `deg` off where it comes from. */
const headingOff = (deg: number) => Math.PI - deg * Math.PI / 180;

function sail(s: YachtState, secs: number, wind: number, world: World, input: YachtInput = idle, hold = true) {
  const h = s.heading;
  let maxTip = 0, capsized = false;
  for (let t = 0; t < secs; t += 1 / 60) {
    const ev = yachtStep(s, 1 / 60, { dir: 0, speed: wind }, input, world);
    if (hold && s.capsized <= 0) { s.heading = h; s.yawRate = 0; }
    s.x = 200; s.y = 200;
    maxTip = Math.max(maxTip, Math.abs(s.tip));
    capsized ||= ev.capsized;
  }
  return { maxTip, capsized };
}

describe('sailing map', () => {
  it('has its features where the map says', () => {
    expect(surfaceAt(LAKE.x, LAKE.y)).toBe('lake');
    expect(surfaceAt(DUNES.x, DUNES.y)).toBe('loose');
    const onRoad = ROAD.slice(1, -1).filter(p => surfaceAt(p.x, p.y) === 'road').length;
    expect(onRoad).toBeGreaterThanOrEqual(ROAD.length - 3);
    expect(heightAt(-5, 200)).toBeGreaterThan(heightAt(20, 200) + 3); // the soft wall at the edge
    for (let x = 0; x < MAP.size; x += 37) for (let y = 0; y < MAP.size; y += 41) expect(Number.isFinite(heightAt(x, y))).toBe(true);
  });

  it('keeps the start and every gate clear of obstacles', () => {
    const obs = buildObstacles();
    expect(obs.length).toBeGreaterThan(100);
    expect(obs.some(o => o.kind === 'building')).toBe(true);
    const clear = (p: { x: number; y: number }, r: number) => obs.every(o => !hitObstacle(p, r, o));
    expect(clear(START, 6)).toBe(true);
    for (const c of COURSES) {
      expect(clear(c.start, 3)).toBe(true);
      c.gates.forEach((g, i) => {
        expect(clear(g, 2)).toBe(true);
        for (const p of gatePoles(c, i)) {
          expect(p.x).toBeGreaterThan(5); expect(p.x).toBeLessThan(MAP.size - 5);
          expect(p.y).toBeGreaterThan(5); expect(p.y).toBeLessThan(MAP.size - 5);
        }
      });
    }
  });
});

describe('wind field', () => {
  it('drops in the lee of a house and not upwind of it', () => {
    const house = { kind: 'building' as const, x: 100, y: 100, r: 7, hw: 5, hh: 5, height: 6, porous: 0, rot: 0, model: 0 };
    const w = new WindField([house], 1);
    w.cells = [];
    const ux = Math.cos(w.dir), uy = Math.sin(w.dir);
    const lee = w.at(100 + ux * 15, 100 + uy * 15), upwind = w.at(100 - ux * 15, 100 - uy * 15), far = w.at(100 + ux * 90, 100 + uy * 90);
    expect(lee.speed).toBeLessThan(upwind.speed * 0.5);
    expect(lee.shadow).toBeGreaterThan(0.5);
    expect(far.shadow).toBeLessThan(0.05);
    // a bare tree lets most of it through
    const tree = { ...house, kind: 'tree' as const, hw: undefined, hh: undefined, r: 0.6, porous: 0.55 };
    const wt = new WindField([tree], 1); wt.cells = [];
    expect(wt.at(100 + ux * 6, 100 + uy * 6).shadow).toBeLessThan(0.45);
  });

  it('carries gusts downwind and makes them blow harder', () => {
    const w = new WindField([], 3);
    w.cells = [{ x: 100, y: 100, r: 20, amp: 0.8, veer: 0, age: 10, life: 40 }];
    const before = w.at(100, 100).speed;
    expect(before).toBeGreaterThan(w.speed * 1.5);
    const x0 = w.cells[0].x;
    w.update(5, { x: 100, y: 100 });
    if (w.cells[0].life === 40) expect(w.cells[0].x).toBeGreaterThan(x0 + WIND.base * 0.5 * 5 * Math.cos(w.dir) * 0.5);
  });
});

describe('land yacht', () => {
  it('pulls hardest at a small angle of attack, not when luffing', () => {
    expect(sailCn(0)).toBe(0);
    expect(sailCn(YACHT.stall)).toBeGreaterThan(sailCn(0.1));
    expect(sailCn(YACHT.stall)).toBeGreaterThan(sailCn(0.7));
  });

  it('sails faster than the wind on a reach across the salt pan', () => {
    const s = newYacht(200, 200, headingOff(100));
    sail(s, 40, 7, flat('lake'));
    expect(s.speed).toBeGreaterThan(7 * 1.6);
  });

  it('cannot sail straight into the wind', () => {
    const s = newYacht(200, 200, headingOff(10));
    sail(s, 20, 7, flat('lake'));
    expect(s.u).toBeLessThan(0.5);
  });

  it('sinks on wheels in loose ash, glides on runners', () => {
    const w = newYacht(200, 200, headingOff(95), 'wheels'), r = newYacht(200, 200, headingOff(95), 'runners');
    sail(w, 30, 7, flat('loose')); sail(r, 30, 7, flat('loose'));
    expect(r.speed).toBeGreaterThan(w.speed + 5);
  });

  it('lifts a wheel and goes over when held hard in a strong wind, Q-1 eases it off', () => {
    const tight = newYacht(200, 200, headingOff(70));
    tight.auto = false; tight.sheet = 0.15;
    const hard = sail(tight, 15, 14, flat('road'));
    expect(hard.maxTip).toBeGreaterThan(1);
    expect(hard.capsized).toBe(true);
    const easy = newYacht(200, 200, headingOff(70));
    const q1 = sail(easy, 15, 13, flat('road'));
    expect(q1.capsized).toBe(false);
  });

  it('hiking out holds more', () => {
    const a = newYacht(200, 200, headingOff(70)), b = newYacht(200, 200, headingOff(70));
    for (const s of [a, b]) { s.auto = false; s.sheet = 0.3; }
    sail(a, 3, 10, flat('road'));
    sail(b, 3, 10, flat('road'), { ...idle, hike: true });
    expect(Math.abs(b.tip)).toBeLessThan(Math.abs(a.tip));
  });

  it('the ballast takes a moment to cross and hurts on the wrong side', () => {
    const s = newYacht(200, 200, headingOff(70));
    s.auto = false; s.sheet = 0.3;
    sail(s, 0.1, 10, flat('road'), { ...idle, hike: true });
    expect(Math.abs(s.ballast)).toBeGreaterThan(0.1);
    expect(Math.abs(s.ballast)).toBeLessThan(0.5);
    sail(s, 1, 10, flat('road'), { ...idle, hike: true });
    expect(Math.abs(s.ballast)).toBe(1);
    const held = Math.abs(s.tip);
    s.ballast = -s.ballast; // left to leeward after a tack
    sail(s, 0.02, 10, flat('road'));
    expect(Math.abs(s.tip)).toBeGreaterThan(held * 1.5);
    sail(s, 2, 10, flat('road'));
    expect(s.ballast).toBe(0);
  });

  it("Wolt's hub motor pushes in a calm and drains the battery, braking wins some back", () => {
    const s = newYacht(200, 200, 0);
    sail(s, 8, 0, flat('road'), { ...idle, motor: 1 });
    expect(s.speed).toBeGreaterThan(3);
    expect(s.speed).toBeLessThan(YACHT.motorTop + 0.1);
    expect(s.energy).toBeLessThan(0.95);
    const low = s.energy;
    sail(s, 1, 0, flat('road'), { ...idle, brake: true });
    expect(s.energy).toBeGreaterThan(low);
    // empty: no push
    const e = newYacht(200, 200, 0); e.energy = 0;
    sail(e, 4, 0, flat('road'), { ...idle, motor: 1 });
    expect(e.speed).toBeLessThan(0.1);
    // on runners his wheel sits in a runner and cannot drive
    const r = newYacht(200, 200, 0, 'runners');
    sail(r, 4, 0, flat('ash'), { ...idle, motor: 1 });
    expect(r.speed).toBeLessThan(0.1);
    // backing up
    const back = newYacht(200, 200, 0);
    sail(back, 3, 0, flat('road'), { ...idle, motor: -1 });
    expect(back.u).toBeLessThan(-0.5);
  });

  it("Wolt's narrow tyre pushes wide on loose ash", () => {
    const turn = (surf: 'ash' | 'loose') => {
      const s = newYacht(200, 200, 0);
      s.vx = 8;
      const h0 = s.heading;
      yachtStep(s, 1, { dir: 0, speed: 0 }, { ...idle, steer: 1 }, flat(surf));
      return Math.abs(s.heading - h0) / SURFACES[surf].grip.wheels;
    };
    expect(turn('loose')).toBeLessThan(turn('ash') * 0.9);
  });

  it('is back on its wheels after a capsize', () => {
    const s = newYacht(200, 200, headingOff(70));
    s.auto = false; s.sheet = 0.15;
    const r = sail(s, 15, 14, flat('road'), idle, true);
    expect(r.capsized).toBe(true);
    s.sheet = 1.3; s.auto = true;
    sail(s, YACHT.capsizeTime + 0.5, 0, flat('road'));
    expect(s.capsized).toBe(0);
    expect(s.heel).toBeCloseTo(0, 2);
  });

  it('slides when turned hard at speed on a slippery surface', () => {
    const s = newYacht(200, 200, 0);
    s.vx = 18;
    let slid = false;
    for (let t = 0; t < 1; t += 1 / 60) { yachtStep(s, 1 / 60, { dir: 0, speed: 0 }, { ...idle, steer: 1 }, flat('lake')); slid ||= s.sliding; }
    expect(slid).toBe(true);
  });

  it('brakes to a stop and swaps wheels for runners only when stopped', () => {
    const s = newYacht(200, 200, 0);
    s.vx = 10;
    expect(startSwap(s)).toBe(false);
    for (let t = 0; t < 5; t += 1 / 60) yachtStep(s, 1 / 60, { dir: 0, speed: 0 }, { ...idle, brake: true }, flat('ash'));
    expect(s.speed).toBeLessThan(0.1);
    expect(startSwap(s)).toBe(true);
    for (let t = 0; t < YACHT.swapTime + 0.2; t += 1 / 60) yachtStep(s, 1 / 60, { dir: 0, speed: 7 }, idle, flat('ash'));
    expect(s.gear).toBe('runners');
  });

  it('bounces off a house', () => {
    const house = { kind: 'building' as const, x: 210, y: 200, r: 7, hw: 5, hh: 5, height: 6, porous: 0, rot: 0, model: 0 };
    const s = newYacht(200, 200, 0);
    s.vx = 6;
    for (let t = 0; t < 2; t += 1 / 60) yachtStep(s, 1 / 60, { dir: 0, speed: 0 }, idle, { ...flat('ash'), obstacles: [house] });
    expect(s.x).toBeLessThan(205 - YACHT.radius + 0.01);
    expect(s.bump + 1).toBeGreaterThan(0);
  });
});

describe('courses', () => {
  it('times a run gate by gate and keeps the best time', () => {
    const c = COURSES[0];
    const run = newRun(c);
    let p = { ...c.start };
    // fly straight through every gate's middle
    for (let i = 0; i < c.gates.length; i++) {
      const g = c.gates[i];
      const steps = 30;
      for (let k = 1; k <= steps; k++) {
        const q = { x: p.x + (g.x - p.x) * k / steps * 1.02, y: p.y + (g.y - p.y) * k / steps * 1.02 };
        const prev = { x: p.x + (g.x - p.x) * (k - 1) / steps * 1.02, y: p.y + (g.y - p.y) * (k - 1) / steps * 1.02 };
        runStep(run, 0.1, prev, q);
      }
      p = { x: p.x + (g.x - p.x) * 1.02, y: p.y + (g.y - p.y) * 1.02 };
    }
    expect(run.done).toBe(true);
    expect(run.time).toBeGreaterThan(0);
    expect(run.splits.length).toBe(c.gates.length);
  });

  it('starts a course at its start line in the game', () => {
    const g = new SailGame();
    g.setCourse(COURSES[1]);
    expect(g.yacht.x).toBe(COURSES[1].start.x);
    g.cycleCourse();
    expect(g.run?.course.id).toBe(COURSES[2].id);
    for (let i = 0; i < 60; i++) g.update(1 / 60, idle);
    expect(Number.isFinite(g.yacht.x)).toBe(true);
  });
});
