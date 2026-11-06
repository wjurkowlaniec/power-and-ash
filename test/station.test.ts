import { describe, it, expect } from 'vitest';
import { Station, P, DOOR_COST, REPAIR_TIME } from '../src/game/sim/station';
import { findPath } from '../src/sim/path';
import { V2, sub, len } from '../src/sim/vec';

const DT = 1 / 30;
const inp = (o: Partial<{ move: V2; run: boolean; use: boolean; usePressed: boolean }> = {}) =>
  ({ move: { x: 0, y: 0 }, run: false, use: false, usePressed: false, ...o });

/** Drive along an A* path (like a player would), with the tyre in tow if hooked. */
function goTo(s: Station, to: V2, maxT = 120): boolean {
  const path = findPath(s.world, s.pos, to, 0.34) ?? [to];
  let i = 0;
  for (let t = 0; t < maxT; t += DT) {
    while (i < path.length && len(sub(path[i], s.pos)) < 0.2) i++;
    if (i >= path.length) return true;
    const d = sub(path[i], s.pos);
    s.update(DT, inp({ move: { x: d.x / len(d), y: d.y / len(d) } }));
    if (s.reading) s.closeNote();
  }
  return false;
}
const press = (s: Station) => s.update(DT, inp({ use: true, usePressed: true }));
const hold = (s: Station, sec: number) => { for (let t = 0; t < sec; t += DT) s.update(DT, inp({ use: true })); };

describe('Scene 2: Martwa stacja, part one', () => {
  it('the workshop door opens from Wolt\'s own cable and costs battery', () => {
    const s = new Station(58);
    expect(goTo(s, { x: 10.2, y: 14.2 })).toBe(true);
    expect(s.nearest()).toBe('port');
    const b = s.battery;
    press(s);
    for (let t = 0; t < 2; t += DT) s.update(DT, inp());
    expect(s.doorOpen).toBe(1);
    expect(b - s.battery).toBeGreaterThanOrEqual(DOOR_COST - 0.01);
    expect(goTo(s, { x: 11.5, y: 7.5 })).toBe(true);   // inside the workshop
  });

  it('bearing on the tyre, dragged to the mast, the turbine turns', () => {
    const s = new Station(58);
    // the tyre lies in the yard: hook it
    expect(goTo(s, { x: P.tyre.x - 1.2, y: P.tyre.y })).toBe(true);
    expect(s.nearest()).toBe('tyre');
    press(s);
    expect(s.towing).toBe(true);
    // into the storage room, to the shelf
    expect(goTo(s, { x: 26, y: 14.5 })).toBe(true);
    expect(goTo(s, { x: 26, y: 6.4 })).toBe(true);
    expect(s.nearest()).toBe('shelf');
    press(s);
    expect(s.items.has('grease')).toBe(true);
    expect(s.bearingOnTyre).toBe(true);
    // out and to the mast
    expect(goTo(s, { x: 26, y: 14.5 })).toBe(true);
    expect(goTo(s, { x: P.mastUse.x, y: P.mastUse.y + 0.3 })).toBe(true);
    expect(s.nearest()).toBe('mast');
    press(s); hold(s, REPAIR_TIME + 0.2);
    expect(s.turbine).toBe(true);
    for (let t = 0; t < 7; t += DT) s.update(DT, inp());
    expect(s.done).toBe(true);
    expect(s.battery).toBeGreaterThan(20);
  });

  it('notes: the technician on the door, the manager in the drawer', () => {
    const s = new Station(58);
    expect(goTo(s, { x: 13.4, y: 14.3 })).toBe(true);
    press(s);
    expect(s.reading).toBe('kartkaTechnika');
  });
});
