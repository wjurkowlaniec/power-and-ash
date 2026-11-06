import { describe, it, expect } from 'vitest';
import { Hall, HallInput, layout, RESERVE_START, RESERVE_MIN, PRY_TIME, INSERT_TIME } from '../src/game/sim/hall';
import { V2, sub, len } from '../src/sim/vec';

const inp = (o: Partial<HallInput> = {}): HallInput => ({ move: { x: 0, y: 0 }, run: false, use: false, usePressed: false, ...o });

/** Walk straight-ish towards a point (greedy, with a tiny sidestep when stuck). */
function walkTo(h: Hall, p: V2, maxT = 60) {
  for (let t = 0; t < maxT; t += 1 / 30) {
    const d = sub(p, h.pos);
    if (len(d) < 0.25) return true;
    const before = { ...h.pos };
    h.update(1 / 30, inp({ move: { x: d.x / len(d), y: d.y / len(d) } }));
    if (len(sub(h.pos, before)) < 1e-4 && h.awake) h.update(1 / 30, inp({ move: { x: 0, y: 1 } }));
  }
  return false;
}
const press = (h: Hall) => h.update(1 / 30, inp({ usePressed: true, use: true }));
const hold = (h: Hall, s: number) => { for (let t = 0; t < s; t += 1 / 30) h.update(1 / 30, inp({ use: true })); };
const idle = (h: Hall, s: number) => { for (let t = 0; t < s; t += 1 / 30) h.update(1 / 30, inp()); };

describe('Scene 1: Hala pomiarowa', () => {
  it('Wolt lies still until the first input, then stands up', () => {
    const h = new Hall();
    idle(h, 5);
    expect(h.awake).toBe(false);
    h.update(0.03, inp({ move: { x: 1, y: 0 } }));
    idle(h, 3);
    expect(h.awake).toBe(true);
  });

  it('the lever is too stiff bare-handed and costs reserve', () => {
    const h = new Hall();
    h.update(0.03, inp({ usePressed: true })); idle(h, 3);
    expect(walkTo(h, { x: 8.1, y: 6.6 })).toBe(true);
    expect(walkTo(h, { x: 8.3, y: 5.0 })).toBe(true);
    expect(h.nearest()).toBe('lever');
    const r = h.reserve;
    press(h);
    hold(h, PRY_TIME + 1);
    expect(h.leverDown).toBe(false);
    expect(h.reserve).toBeLessThan(r);
    expect(h.message?.text).toMatch(/drgnie/);
  });

  it('the whole scene: pipe, lever, battery, door, exit', () => {
    const h = new Hall();
    h.update(0.03, inp({ usePressed: true })); idle(h, 3);
    expect(walkTo(h, { x: layout.pipe.x, y: layout.pipe.y - 0.4 })).toBe(true);
    press(h);
    expect(h.hasPipe).toBe(true);
    expect(walkTo(h, { x: 8.1, y: 6.6 })).toBe(true);
    expect(walkTo(h, { x: 8.3, y: 5.0 })).toBe(true);
    press(h); hold(h, PRY_TIME + 0.2);
    expect(h.leverDown).toBe(true);
    idle(h, 3);
    expect(h.chamberOpen).toBe(1);
    expect(walkTo(h, { x: layout.batteryUse.x, y: layout.batteryUse.y + 0.1 })).toBe(true);
    // walking in reserve mode drained, but never below the floor
    expect(h.reserve).toBeLessThan(RESERVE_START);
    expect(h.reserve).toBeGreaterThanOrEqual(RESERVE_MIN);
    press(h); idle(h, INSERT_TIME + 0.2);
    expect(h.powered).toBe(true);
    idle(h, 3.5);
    expect(h.logShown).toBe(true);
    expect(walkTo(h, { x: 14.6, y: 5.5 })).toBe(true);
    press(h); idle(h, 2);
    expect(h.doorOpen).toBe(1);
    expect(walkTo(h, { x: 15.7, y: 5.5 }, 10)).toBe(true);
    expect(h.exited).toBe(true);
  });

  it('the door stays shut without the battery', () => {
    const h = new Hall();
    h.update(0.03, inp({ usePressed: true })); idle(h, 3);
    walkTo(h, { x: 14.6, y: 5.5 });
    press(h); idle(h, 2);
    expect(h.doorOpen).toBe(0);
  });
});
