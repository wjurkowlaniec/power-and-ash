import { describe, it, expect } from 'vitest';
import { Station, P, DOOR_COST, REPAIR_TIME, CABLE_MAX, PLOT_DELAY, LEAVE_TIME } from '../src/game/sim/station';
import { findPath } from '../src/sim/path';
import { V2, sub, len } from '../src/sim/vec';

const DT = 1 / 30;
const inp = (o: Partial<{ move: V2; run: boolean; use: boolean; usePressed: boolean; drop: boolean }> = {}) =>
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
    expect(b - s.battery).toBeGreaterThanOrEqual(DOOR_COST - 0.5); // a little comes back at rest
    expect(goTo(s, { x: 11.5, y: 7.5 })).toBe(true);   // inside the workshop
  });

  it('transformer module on the tyre, cabinet swap, cable, plotter map, out through the gate', () => {
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
    expect(s.moduleOnTyre).toBe(true);
    // out and to the mast
    expect(goTo(s, { x: 26, y: 14.5 })).toBe(true);
    expect(goTo(s, { x: P.mastUse.x, y: P.mastUse.y + 0.3 })).toBe(true);
    expect(s.nearest()).toBe('mast');
    press(s); hold(s, REPAIR_TIME + 0.2);
    expect(s.turbine).toBe(true);
    expect(s.done).toBe(false);
    // leave the tyre, take the cable from the drum at the mast foot
    s.update(DT, inp({ drop: true }));
    expect(goTo(s, { x: 20.6, y: 24.4 })).toBe(true); // round the dropped tyre
    expect(goTo(s, { x: 24.6, y: 24.4 })).toBe(true);
    expect(goTo(s, { x: P.junction.x + 0.3, y: P.junction.y + 0.4 })).toBe(true);
    expect(s.nearest()).toBe('junction');
    press(s);
    expect(s.cableHeld).toBe(true);
    // to the machine room inlet; the cable wraps round what is in the way
    expect(goTo(s, { x: P.socket.x, y: P.socket.y + 0.4 })).toBe(true);
    expect(s.cableLength()).toBeLessThanOrEqual(CABLE_MAX);
    expect(s.nearest()).toBe('socket');
    press(s);
    expect(s.machinePowered).toBe(true);
    // the gate says nowhere to go yet
    for (let t = 0; t < PLOT_DELAY + 0.3; t += DT) s.update(DT, inp());
    expect(s.plotted).toBe(true);
    expect(s.done).toBe(false);
    // the plotter in the duty room prints the route to R-2
    expect(goTo(s, { x: P.plotter.x, y: P.plotter.y + 1.1 })).toBe(true);
    expect(s.nearest()).toBe('plotter');
    press(s);
    expect(s.routeKnown).toBe(true);
    s.closeNote();
    // out through the fence gate
    expect(goTo(s, { x: P.gate.x, y: P.gate.y - 0.6 })).toBe(true);
    expect(s.nearest()).toBe('gate');
    press(s);
    expect(s.leaving).toBeGreaterThan(0);
    for (let t = 0; t < LEAVE_TIME + 0.5; t += DT) s.update(DT, inp());
    expect(s.done).toBe(true);
    expect(s.battery).toBeGreaterThan(20);
  });

  it('notes: the technician on the door, the manager in the drawer', () => {
    const s = new Station(58);
    expect(goTo(s, { x: 13.4, y: 14.3 })).toBe(true);
    press(s);
    expect(s.reading).toBe('kartkaTechnika');
  });

  it('Q always lets go of the tyre, even next to the mast', () => {
    const s = new Station(58);
    s.pos = { x: P.mastUse.x + 1, y: P.mastUse.y }; s.tyre.pos = { x: P.mastUse.x - 1.2, y: P.mastUse.y }; s.towing = true;
    expect(s.nearest()).toBe('mast');
    s.update(DT, inp({ drop: true }));
    expect(s.towing).toBe(false);
  });

  it('a snagged tyre never traps Wolt: he can always move towards it', () => {
    const s = new Station(58);
    // tyre jammed on the far side of the mast pylon, rope taut across it
    s.tyre.pos = { x: 20.3, y: 21 }; s.pos = { x: 23.6, y: 21 }; s.facing = 0; s.towing = true;
    const x0 = s.pos.x;
    for (let t = 0; t < 1; t += DT) s.update(DT, inp({ move: { x: -1, y: 0 } }));
    expect(s.pos.x).toBeLessThan(x0);
  });

  it('Q-1 slowly recovers while Wolt rests', () => {
    const s = new Station(40);
    for (let t = 0; t < 10; t += DT) s.update(DT, inp());
    expect(s.charging).toBe(true);
    expect(s.battery).toBeGreaterThan(41);
  });

  it('the goal line follows progress', () => {
    const s = new Station(58);
    expect(s.goal()).toContain('port');
    s.doorOpen = 1;
    expect(s.goal()).toContain('drugiej półce');
  });

  it('the cable runs out after its length', () => {
    const s = new Station(58);
    s.turbine = true; s.pos = { x: P.junction.x, y: P.junction.y + 0.6 };
    press(s);
    expect(s.cableHeld).toBe(true);
    goTo(s, { x: 3, y: 15 }, 30);   // far west: more than the drum holds
    expect(s.cableLength()).toBeLessThanOrEqual(18.05);
    expect(s.pos.x).toBeGreaterThan(5);
  });
});
