import { describe, it, expect } from 'vitest';
import { towStep, ROPE, LOADS, Load } from '../src/sim/tow';
import { World } from '../src/sim/world';
import { Game, idle, Input, WALK_SPEED } from '../src/sim/game';
import { level1 } from '../src/sim/level';
import { dist } from '../src/sim/vec';

const DT = 1 / 60;
const tick = (g: Game, s: number, inp: Partial<Input> = {}) => { for (let t = 0; t < s; t += DT) g.update(DT, { ...idle(), ...inp }); };

describe('towStep', () => {
  const world = new World(20, 20, [{ kind: 'rock', x: 10, y: 4, w: 1, h: 6 }]);
  const tyre = (x: number, y: number): Load => ({ id: 't', kind: 'tyre', pos: { x, y }, angle: 0 });
  const reach = ROPE + LOADS.tyre.radius;

  it('leaves the load alone while the rope is slack', () => {
    const l = tyre(5, 5);
    const s = towStep(world, l, { x: 5 + reach - 0.3, y: 5 });
    expect(s.pos).toEqual({ x: 5, y: 5 });
    expect(s.taut).toBe(false);
  });

  it('pulls the load to rope length behind the hitch', () => {
    const l = tyre(2, 5);
    const s = towStep(world, l, { x: 6, y: 5 });
    expect(dist(s.pos, { x: 6, y: 5 })).toBeCloseTo(reach, 5);
    expect(s.taut).toBe(true);
    expect(s.blocked).toBe(false);
    expect(s.angle).toBeCloseTo(0, 5); // trails behind, rope pointing +x
  });

  it('snags on a rock when pulled straight through it', () => {
    const l = tyre(9.4, 7);
    const s = towStep(world, l, { x: 13.5, y: 7 });
    expect(s.blocked).toBe(true);
    expect(s.pos.x).toBeLessThan(10 - LOADS.tyre.radius + 1e-6);
  });
});

describe('towing in the tech demo', () => {
  it('hooks the tyre with E and drags it along, slower than walking free', () => {
    const g = new Game(level1());
    const tyre = g.loads.find(l => l.kind === 'tyre')!;
    g.pos = { x: tyre.pos.x + 1.0, y: tyre.pos.y };
    g.update(DT, { ...idle(), interact: true });
    expect(g.tow).toBe(tyre);
    expect(g.events).toContain('hook');

    const start = { ...g.pos };
    tick(g, 1.5, { move: { x: 1, y: 0 } });
    const went = g.pos.x - start.x;
    expect(went).toBeGreaterThan(1);
    expect(went).toBeLessThan(WALK_SPEED * 1.5 * (1 - LOADS.tyre.drag) + 0.05);
    // the tyre follows at rope length behind the hitch
    expect(dist(tyre.pos, g.pos)).toBeLessThan(ROPE + LOADS.tyre.radius + 0.5);
    expect(tyre.pos.x).toBeGreaterThan(start.x - 1);

    // E again lets go; it stays where it was dropped
    g.update(DT, { ...idle(), interact: true });
    expect(g.tow).toBeNull();
    const left = { ...tyre.pos };
    tick(g, 1, { move: { x: 1, y: 0 } });
    expect(tyre.pos).toEqual(left);
  });

  it('dragging the bricks costs more energy than walking', () => {
    const free = new Game(level1()), towing = new Game(level1());
    for (const g of [free, towing]) { g.pos = { x: 5.6, y: 14.6 }; g.energy = 80; }
    const bricks = towing.loads.find(l => l.kind === 'bricks')!;
    towing.update(DT, { ...idle(), interact: true });
    expect(towing.tow).toBe(bricks);
    for (const g of [free, towing]) tick(g, 1.5, { move: { x: 1, y: 0 } });
    expect(towing.energy).toBeLessThan(free.energy - 0.5);
  });

  it('Wolt bumps into a load that is not on his hook', () => {
    const g = new Game(level1());
    const tyre = g.loads.find(l => l.kind === 'tyre')!;
    g.pos = { x: tyre.pos.x - 2, y: tyre.pos.y };
    tick(g, 1.5, { move: { x: 1, y: 0 } });
    expect(dist(g.pos, tyre.pos)).toBeGreaterThan(0.6);
    expect(tyre.pos).toEqual({ x: 12.6, y: 16.4 });
  });
});
