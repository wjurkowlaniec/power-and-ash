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
    tick(g, 2.1, { use: true });
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
    g.energy = 100;
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

describe('wind', () => {
  it('drifts within sane bounds and gusts come and go', async () => {
    const { Wind } = await import('../src/sim/wind');
    const w = new Wind(3);
    let minS = Infinity, maxS = 0, gusts = 0, prevGust = 0;
    const d0 = w.dir;
    let maxTurn = 0;
    for (let t = 0; t < 600; t += 0.1) {
      w.update(0.1);
      minS = Math.min(minS, w.strength); maxS = Math.max(maxS, w.strength);
      if (w.gust > 0.3 && prevGust <= 0.3) gusts++;
      prevGust = w.gust;
      maxTurn = Math.max(maxTurn, Math.abs(w.dir - d0));
    }
    expect(minS).toBeGreaterThan(0.4);
    expect(maxS).toBeLessThan(25);
    expect(gusts).toBeGreaterThan(5);
    expect(maxTurn).toBeGreaterThan(0.3);
  });
});

describe('Wolt facing', () => {
  it('faces the walking direction even when the cursor is behind him', () => {
    const g = new Game(level1());
    g.pos = { x: 30, y: 40 };
    for (let i = 0; i < 30; i++) g.update(DT, { ...idle(), move: { x: 1, y: 0 }, aim: { x: 20, y: 40 } });
    expect(Math.cos(g.facing)).toBeGreaterThan(0.99);
    // standing still, he turns to the cursor
    g.update(DT, { ...idle(), aim: { x: 20, y: 40 } });
    expect(Math.cos(g.facing)).toBeLessThan(-0.99);
  });
});

describe("Wolt's battery", () => {
  it('drains faster running than walking, and recovers standing still', () => {
    const g = new Game(level1());
    g.energy = 50; g.light = false;
    g.pos = { x: 30, y: 42 };
    tick(g, 2, { move: { x: 1, y: 0 } });
    const walked = 50 - g.energy;
    g.energy = 50; g.pos = { x: 30, y: 42 };
    tick(g, 2, { move: { x: 1, y: 0 }, run: true });
    const ran = 50 - g.energy;
    expect(ran).toBeGreaterThan(walked * 2);
    const e0 = g.energy;
    tick(g, 5);
    expect(g.energy).toBeGreaterThan(e0);
    expect(g.energySource).toBe('rest');
  });

  it('charges fast next to the live station port', () => {
    const g = new Game(level1());
    g.energy = 10;
    g.pos = { x: 32.8, y: 23.5 };
    tick(g, 3);
    expect(g.energySource).toBe('port');
    expect(g.energy).toBeGreaterThan(15);
  });

  it('cannot salvage on an empty battery, and the light goes out', () => {
    const g = new Game(level1());
    g.energy = 0.001;
    const pile = g.scrapLeft()[0];
    g.pos = { x: pile.x + pile.w / 2, y: pile.y - 0.6 };
    tick(g, 2, { use: true });
    expect(g.world.obstacles).toContain(pile);
    expect(g.light).toBe(false);
  });
});

describe('barrels', () => {
  it('can be salvaged for iron', () => {
    const g = new Game(level1());
    const b = g.world.obstacles.find(o => o.kind === 'barrel')!;
    expect(b.loot).toBeTruthy();
    g.pos = { x: b.x + 0.5, y: b.y - 0.6 };
    tick(g, 2.2, { use: true });
    expect(g.world.obstacles).not.toContain(b);
    expect(g.inv.iron).toBeGreaterThan(0);
  });
});

describe('mouse orders', () => {
  it('walks around the container wall to a clicked spot', () => {
    const g = new Game(level1());
    g.energy = 100;
    g.pos = { x: 22, y: 25 };
    g.command({ kind: 'ground', at: { x: 28, y: 25 } }, 'walk');
    tick(g, 12);
    expect(Math.hypot(g.pos.x - 28, g.pos.y - 25)).toBeLessThan(0.3);
    expect(g.order).toBeNull();
  });

  it('click on scrap: walks there and salvages it fully', () => {
    const g = new Game(level1());
    g.energy = 100;
    const pile = g.scrapLeft()[0];
    g.pos = { x: pile.x - 4, y: pile.y + 3 };
    g.command({ kind: 'scrap', o: pile }, 'salvage');
    tick(g, 6);
    expect(g.world.obstacles).not.toContain(pile);
    expect(g.order).toBeNull();
  });

  it('a plugged port offers both unplug and reel (context menu)', () => {
    const g = new Game(level1());
    g.reelOwned = 20;
    g.pos = { x: 33.0, y: 23.5 };
    g.command({ kind: 'port', id: 'station' }, 'grab');
    tick(g, 0.1);
    expect(g.held?.from).toBe('station');
    expect(g.actionsFor({ kind: 'port', id: 'station' }).map(a => a.id)).toEqual(['reel']);
    g.command({ kind: 'self' }, 'light');
    expect(g.light).toBe(false);
  });

  it('fabricator: craft everything at once', () => {
    const g = new Game(level1());
    g.inv.copper = 4; g.inv.plastic = 4;
    g.pos = { x: 8.5, y: 18.9 };
    const acts = g.actionsFor({ kind: 'point', id: 'fabricator' });
    expect(acts.map(a => a.id)).toEqual(['craft', 'craftAll']);
    g.command({ kind: 'point', id: 'fabricator' }, 'craftAll');
    tick(g, 6);
    expect(g.reelOwned).toBe(20);
  });
});
