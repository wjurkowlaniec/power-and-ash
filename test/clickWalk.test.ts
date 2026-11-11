import { describe, it, expect } from 'vitest';
import { ClickWalk, pickThing } from '../src/game/sim/clickWalk';
import { Station, P, PLAYER_R as ST_R } from '../src/game/sim/station';
import { Hall, layout, PLAYER_R as H_R, WAKE_TIME, PRY_TIME } from '../src/game/sim/hall';
import { dist } from '../src/sim/vec';

const DT = 1 / 30;
const idle = { move: { x: 0, y: 0 }, run: false, use: false, usePressed: false };

/** Run the scene with only the click walker driving, until the order ends. */
function run(sim: Station | Hall, w: ClickWalk, maxT = 60) {
  for (let t = 0; t < maxT && w.order; t += DT) {
    const m = w.step(sim, DT);
    sim.update(DT, m ? { ...idle, ...m } : idle);
    if (sim.reading) break;
  }
}

describe('point-and-click in the game', () => {
  it('a click on the ground drives Wolt there and he stops on the mark', () => {
    const s = new Station(58), w = new ClickWalk(ST_R);
    const to = { x: 14, y: 17.5 };
    w.go(s, to);
    run(s, w);
    expect(w.order).toBeNull();
    expect(dist(s.pos, to)).toBeLessThan(0.45);
  });

  it('a click on a thing drives up to it and uses it: the lock port opens the workshop', () => {
    const s = new Station(58), w = new ClickWalk(ST_R);
    const port = s.usables().find(u => u.id === 'port')!;
    w.go(s, port.at, port.id);
    run(s, w);
    expect(s.doorOpen).toBeGreaterThan(0);
  });

  it('a click on a note walks there and opens it for reading', () => {
    const s = new Station(58), w = new ClickWalk(ST_R);
    w.go(s, P.doorNote, 'doorNote');
    run(s, w);
    expect(s.reading).toBe('kartkaTechnika');
  });

  it('in the hall a click on the pipe picks it up, a click on the lever holds E until it gives', () => {
    const h = new Hall(), w = new ClickWalk(H_R);
    h.update(DT, { ...idle, usePressed: true });
    for (let t = 0; t < WAKE_TIME + 0.1; t += DT) h.update(DT, idle);
    w.go(h, layout.pipe, 'pipe');
    run(h, w);
    expect(h.hasPipe).toBe(true);
    w.go(h, layout.lever, 'lever');
    run(h, w, 30 + PRY_TIME);
    expect(h.leverDown).toBe(true);
  });

  it('a wall in the way ends the order instead of pushing forever', () => {
    const s = new Station(58), w = new ClickWalk(ST_R);
    // the machine room behind the fallen cabinet: no way in
    w.go(s, { x: 33.5, y: 8 });
    run(s, w, 40);
    expect(w.order).toBeNull();
  });

  it('pickThing takes the thing closest to the click on screen, within reach', () => {
    const things = [{ id: 'a', at: { x: 0, y: 0 } }, { id: 'b', at: { x: 1, y: 0 } }];
    // a top-down-ish projection: height lifts the picture up the screen
    const proj = (p: { x: number; y: number }, y: number) => ({ x: p.x * 100, y: p.y * 100 - y * 50 });
    expect(pickThing(things, { x: 90, y: 10 }, proj)?.id).toBe('b');
    expect(pickThing(things, { x: 100, y: -60 }, proj)?.id).toBe('b'); // on the upper part of b
    expect(pickThing(things, { x: 50, y: 300 }, proj)).toBeNull();
  });
});
