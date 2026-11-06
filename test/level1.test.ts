import { describe, it, expect } from 'vitest';
import { Game, CABLE_MAX, idle, Input } from '../src/sim/game';
import { level1 } from '../src/sim/level';
import { V2 } from '../src/sim/vec';

const DT = 1 / 60;
const tick = (g: Game, s: number, inp: Partial<Input> = {}) => { for (let t = 0; t < s; t += DT) g.update(DT, { ...idle(), ...inp }); };
const press = (g: Game) => g.update(DT, { ...idle(), interact: true });
const walk = (g: Game, to: V2, maxT = 20) => {
  for (let t = 0; t < maxT; t += DT) {
    const d = { x: to.x - g.pos.x, y: to.y - g.pos.y }, l = Math.hypot(d.x, d.y);
    if (l < 0.1) return true;
    g.update(DT, { ...idle(), move: { x: d.x / l, y: d.y / l } });
  }
  return false;
};

function salvageAll(g: Game) {
  for (const o of g.scrapLeft()) {
    g.pos = { x: o.x + o.w / 2, y: o.y - 0.6 };
    tick(g, 1.6, { use: true });
  }
}

describe('level 1 "Rozruch"', () => {
  it('starts with no cable: the port refuses', () => {
    const g = new Game(level1());
    g.pos = { x: 17.0, y: 24.5 };
    press(g);
    expect(g.held).toBeNull();
    expect(g.events).toContain('deny');
  });

  it('salvage gives materials and removes the pile from the grid', () => {
    const g = new Game(level1());
    const pile = g.scrapLeft()[0];
    g.pos = { x: pile.x + pile.w / 2, y: pile.y - 0.6 };
    tick(g, 0.5, { use: true });
    expect(g.world.isBlocked(pile.x, pile.y)).toBe(true);
    tick(g, 1.2, { use: true });
    expect(g.world.isBlocked(pile.x, pile.y)).toBe(false);
    expect(g.inv.copper).toBe(1);
  });

  it('full playthrough: salvage → craft 20 m → connect → charge → leave', () => {
    const g = new Game(level1());
    salvageAll(g);
    expect(g.inv.copper).toBeGreaterThanOrEqual(4);
    expect(g.inv.plastic).toBeGreaterThanOrEqual(4);

    g.pos = { x: 8.5, y: 18.9 };
    for (let i = 0; i < 4; i++) { press(g); tick(g, 1.3); }
    expect(g.reelOwned).toBe(20);

    g.pos = { x: 33.0, y: 23.5 };
    press(g);
    expect(g.held?.from).toBe('station');
    for (const p of [{ x: 33, y: 20.3 }, { x: 26.6, y: 20.3 }, { x: 23.4, y: 20.3 }, { x: 18, y: 22.6 }, { x: 17.0, y: 24.5 }]) walk(g, p);
    expect(g.heldLength()).toBeLessThanOrEqual(CABLE_MAX);
    press(g);
    expect(g.cables).toHaveLength(1);
    expect(g.yachtCharging()).toBe(true);

    tick(g, 30);
    expect(g.batteryFull()).toBe(true);

    g.pos = { x: 3.0, y: 23 };
    press(g);
    expect(g.phase).toBe('departing');
    tick(g, 7);
    expect(g.phase).toBe('done');
    expect(g.objectives().every(o => o.done)).toBe(true);
  });

  it('the south route around the wall is too long', () => {
    const g = new Game(level1());
    g.reelOwned = 20;
    g.pos = { x: 33.0, y: 23.5 };
    press(g);
    for (const p of [{ x: 33, y: 31.6 }, { x: 26.6, y: 31.6 }, { x: 23.4, y: 31.6 }, { x: 17.0, y: 24.5 }]) walk(g, p, 10);
    expect(g.heldLength()).toBeLessThanOrEqual(CABLE_MAX + 1e-3);
    expect(Math.hypot(g.pos.x - 17, g.pos.y - 24.5)).toBeGreaterThan(1.6);
  });
});
