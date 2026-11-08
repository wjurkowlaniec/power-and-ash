import { describe, it, expect } from 'vitest';
import { Hall, HallInput, layout, RESERVE_START, RESERVE_MIN, PRY_TIME, INSERT_TIME, TETHER_MAX, WAKE_TIME } from '../src/game/sim/hall';
import { V2, sub, len } from '../src/sim/vec';

const inp = (o: Partial<HallInput> = {}): HallInput => ({ move: { x: 0, y: 0 }, run: false, use: false, usePressed: false, ...o });

/** Walk straight-ish towards a point (greedy, with a tiny sidestep when stuck). */
function walkTo(h: Hall, p: V2, maxT = 60) {
  let stuck = 0;
  for (let t = 0; t < maxT; t += 1 / 30) {
    const d = sub(p, h.pos);
    if (len(d) < 0.25) return true;
    const before = { ...h.pos };
    h.update(1 / 30, inp({ move: { x: d.x / len(d), y: d.y / len(d) } }));
    // stuck against something while rolling (not just turning on the spot): sidestep
    if (len(sub(h.pos, before)) < 1e-4 && h.awake && ++stuck > 8) { stuck = 0; for (let i = 0; i < 10; i++) h.update(1 / 30, inp({ move: { x: 0, y: 1 } })); }
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
    idle(h, WAKE_TIME + 0.1);
    expect(h.awake).toBe(true);
  });

  it('the lever is too stiff bare-handed and costs reserve', () => {
    const h = new Hall();
    h.update(0.03, inp({ usePressed: true })); idle(h, WAKE_TIME + 0.1);
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
    h.update(0.03, inp({ usePressed: true })); idle(h, WAKE_TIME + 0.1);
    expect(walkTo(h, { x: layout.pipe.x, y: layout.pipe.y - 0.4 })).toBe(true);
    press(h);
    expect(h.hasPipe).toBe(true);
    expect(walkTo(h, { x: 8.1, y: 6.6 })).toBe(true);
    expect(walkTo(h, { x: 8.3, y: 5.0 })).toBe(true);
    press(h); hold(h, PRY_TIME + 0.2);
    expect(h.leverDown).toBe(true);
    idle(h, WAKE_TIME + 0.1);
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
    h.update(0.03, inp({ usePressed: true })); idle(h, WAKE_TIME + 0.1);
    walkTo(h, { x: 14.6, y: 5.5 });
    press(h); idle(h, 2);
    expect(h.doorOpen).toBe(0);
  });
});

describe('notes in the hall', () => {
  it('standing on a note and pressing E reads it; movement waits until it is put down', () => {
    const h = new Hall();
    h.update(0.03, inp({ usePressed: true })); idle(h, WAKE_TIME + 0.1);
    const n = layout.notes[0];
    expect(walkTo(h, n)).toBe(true);
    expect(h.nearest()).toBe('note');
    press(h);
    expect(h.reading).toBe(n.id);
    const p = { ...h.pos };
    h.update(0.5, inp({ move: { x: 1, y: 0 } }));
    expect(h.pos).toEqual(p);
    h.closeNote();
    h.update(0.5, inp({ move: { x: 1, y: 0 } }));
    expect(h.pos.x).toBeGreaterThan(p.x);
    expect(h.notesRead.has(n.id)).toBe(true);
  });
});

describe('the diagnostic cable (the battery drives the body remotely)', () => {
  it('keeps the body within reach of the chamber, wrapping around the chamber', () => {
    const h = new Hall();
    h.update(0.03, inp({ usePressed: true })); idle(h, WAKE_TIME + 0.1);
    // the far south-east corner is out of reach
    walkTo(h, { x: 13.5, y: 7.5 }, 20);
    walkTo(h, { x: 13.4, y: 10.6 }, 20);
    expect(h.tetherLength()).toBeLessThanOrEqual(TETHER_MAX + 0.01);
    expect(h.pos.y).toBeLessThan(10.4);
    // the test 4411 printout behind the chamber is reachable around its corner
    const h2 = new Hall();
    h2.update(0.03, inp({ usePressed: true })); idle(h2, 3);
    expect(walkTo(h2, { x: 8.3, y: 7.2 })).toBe(true);
    expect(walkTo(h2, { x: 12.6, y: 7.0 })).toBe(true);
    expect(walkTo(h2, { x: 13.2, y: 2.6 })).toBe(true);
    expect(h2.tether!.anchors.length).toBeGreaterThan(1);
  });
});
