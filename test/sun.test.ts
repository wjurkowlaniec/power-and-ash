import { describe, it, expect } from 'vitest';
import { CloudField, CLOUDS, wrap } from '../src/sun/sim/clouds';
import { SunGame, SUN, bufferRate } from '../src/sun/sim/sunGame';
import { MISSIONS } from '../src/sun/sim/missions';
import { MAP, buildObstacles } from '../src/sail/sim/terrain';
import { YachtInput } from '../src/sail/sim/landYacht';

const brake: YachtInput = { steer: 0, sheet: 1, brake: true, hike: false };
/** A sky that is always this bright. */
const sky = (light: number) => ({ update() {}, lightAt: () => light, shadeAt: () => 1 - light, puffs: function* () {} }) as unknown as CloudField;

function run(g: SunGame, secs: number, input = brake) {
  const evs = [];
  for (let t = 0; t < secs; t += 1 / 30) evs.push(g.update(1 / 30, input));
  return evs;
}

/** Park the yacht, stopped, at a point. */
function park(g: SunGame, p: { x: number; y: number }) { Object.assign(g.yacht, { x: p.x, y: p.y, vx: 0, vy: 0, speed: 0 }); }

describe('clouds', () => {
  it('cover roughly the asked share of the map', () => {
    for (const m of MISSIONS) {
      const f = new CloudField(m.cover, m.seed);
      let n = 0, sh = 0;
      for (let x = 0; x < MAP.size; x += 8) for (let y = 0; y < MAP.size; y += 8) { n++; if (f.shadeAt(x, y) > 0.5) sh++; }
      expect(sh / n).toBeGreaterThan(m.cover - 0.2);
      expect(sh / n).toBeLessThan(m.cover + 0.2);
    }
  });

  it('leave sunny gaps and full shade, with soft edges', () => {
    const f = new CloudField(0.45, 3);
    const v: number[] = [];
    for (let x = 0; x < MAP.size; x += 2) v.push(f.shadeAt(x, 200));
    expect(Math.min(...v)).toBe(0);
    expect(Math.max(...v)).toBe(1);
    expect(v.some(s => s > 0.1 && s < 0.9)).toBe(true);
  });

  it('drift downwind and wrap around the sky', () => {
    const f = new CloudField(0.4, 5);
    f.update(10, 0, 3);
    expect(f.offX).toBeCloseTo(30);
    expect(f.offY).toBeCloseTo(0);
    expect(f.shadeAt(50, 80)).toBeCloseTo(f.shadeAt(50 + CLOUDS.domain, 80 - CLOUDS.domain), 6);
    expect(wrap(CLOUDS.domain * 0.75)).toBeCloseTo(-CLOUDS.domain * 0.25);
  });

  it('light under a cloud is dim but not zero', () => {
    const f = new CloudField(0.5, 9);
    for (let x = 0; x < MAP.size; x += 5) {
      const l = f.lightAt(x, 150);
      expect(l).toBeGreaterThanOrEqual(CLOUDS.lightMin - 1e-9);
      expect(l).toBeLessThanOrEqual(1);
    }
  });
});

describe('the load buffer', () => {
  it('drains 1 s per s in full shade, holds at the need, refills in the sun', () => {
    expect(bufferRate(CLOUDS.lightMin)).toBeCloseTo(-1);
    expect(bufferRate(SUN.need)).toBeCloseTo(0);
    expect(bufferRate(1)).toBeCloseTo(SUN.refill);
    expect(bufferRate(0.4)).toBeLessThan(0);
    expect(bufferRate(0.4)).toBeGreaterThan(-1);
  });

  it('lasts about 20 s in full shade, then the load is lost', () => {
    const g = new SunGame(MISSIONS[0]);
    g.clouds = sky(1);
    park(g, MISSIONS[0].a);
    const evs = run(g, 2.5);
    expect(evs.some(e => e.loaded)).toBe(true);
    expect(g.delivery.phase).toBe('carrying');
    g.clouds = sky(CLOUDS.lightMin);
    let t = 0, lost = false;
    while (!lost && t < 40) { lost = g.update(1 / 30, brake).lost; t += 1 / 30; }
    expect(lost).toBe(true);
    expect(t).toBeGreaterThan(19.5);
    expect(t).toBeLessThan(20.5);
    expect(g.delivery.phase).toBe('failed');
  });

  it('a short shadow is survived and the sun tops the buffer up again', () => {
    const g = new SunGame(MISSIONS[1]);
    g.clouds = sky(1);
    park(g, MISSIONS[1].a);
    run(g, 2.5);
    g.clouds = sky(CLOUDS.lightMin);
    run(g, 12);
    expect(g.delivery.buffer).toBeLessThan(9);
    g.clouds = sky(1);
    run(g, 6);
    expect(g.delivery.buffer).toBe(SUN.buffer);
    expect(g.delivery.phase).toBe('carrying');
  });
});

describe('deliveries', () => {
  it('load at A, hand over at B, keep the best time', () => {
    const m = MISSIONS[2];
    const g = new SunGame(m);
    g.clouds = sky(1);
    park(g, m.b);
    run(g, 3);
    expect(g.delivery.phase).toBe('toPickup'); // B does nothing before loading
    park(g, m.a);
    run(g, 2.5);
    expect(g.delivery.phase).toBe('carrying');
    park(g, m.b);
    const evs = run(g, 2.5);
    const done = evs.find(e => e.delivered !== null);
    expect(done).toBeTruthy();
    expect(done!.record).toBe(true);
    expect(g.bestSun[m.id]).toBeGreaterThan(0);
    expect(g.delivery.phase).toBe('done');
  });

  it('loading needs the yacht stopped in the ring', () => {
    const g = new SunGame(MISSIONS[0]);
    g.clouds = sky(1);
    park(g, { x: MISSIONS[0].a.x + SUN.zone + 3, y: MISSIONS[0].a.y });
    run(g, 3);
    expect(g.delivery.phase).toBe('toPickup');
  });

  it('spare sun charges Wolt’s battery', () => {
    const g = new SunGame(MISSIONS[0]);
    g.clouds = sky(1);
    g.yacht.energy = 0.5;
    run(g, 10);
    expect(g.yacht.energy).toBeGreaterThan(0.55);
  });

  it('retry keeps the sky, another mission brings its own', () => {
    const g = new SunGame(MISSIONS[0]);
    const c = g.clouds;
    g.restartMission();
    expect(g.clouds).toBe(c);
    g.cycleMission();
    expect(g.delivery.mission).toBe(MISSIONS[1]);
    expect(g.clouds).not.toBe(c);
  });

  it('A and B are on the map and clear of obstacles', () => {
    const obs = buildObstacles();
    for (const m of MISSIONS) for (const p of [m.start, m.a, m.b]) {
      expect(p.x).toBeGreaterThan(10); expect(p.x).toBeLessThan(MAP.size - 10);
      expect(p.y).toBeGreaterThan(10); expect(p.y).toBeLessThan(MAP.size - 10);
      for (const o of obs) expect(Math.hypot(o.x - p.x, o.y - p.y) - o.r).toBeGreaterThan(3);
    }
  });
});
