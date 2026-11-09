import { describe, it, expect } from 'vitest';
import { Inventory, Pool } from '../src/craft/sim/inventory';
import { CraftGame } from '../src/craft/sim/craftGame';
import { STAGES, yardAtStage, stageDone } from '../src/craft/sim/stages';
import { RECIPES, ITEMS, TECHS, TechId } from '../src/craft/data';
import { newSail, sailStep, SAIL } from '../src/craft/sim/sailing';

const still = { x: 0, y: 0 };
const run = (g: CraftGame, s: number, use = false) => { for (let t = 0; t < s; t += 0.05) g.update(0.05, still, false, use); };

describe('inventory', () => {
  it('stacks, overflows and refuses big things without the cart', () => {
    const inv = new Inventory(2);
    expect(inv.add('iron', 25)).toBe(0); // 20 + 5
    expect(inv.add('copper', 1)).toBe(1); // both slots taken
    expect(inv.add('solar', 1)).toBe(1); // too big for Wolt
    expect(new Inventory(1, true).add('solar', 1)).toBe(0);
    expect(inv.remove('iron', 22)).toBe(22);
    expect(inv.count('iron')).toBe(3);
    expect(inv.used()).toBe(1);
  });

  it('a pool takes from the cart first and gives to Wolt first', () => {
    const w = new Inventory(2), c = new Inventory(4, true);
    w.add('copper', 2); c.add('copper', 3);
    const p = new Pool([w, c]);
    expect(p.has({ copper: 5 })).toBe(true);
    p.take({ copper: 4 });
    expect(c.count('copper')).toBe(0);
    expect(w.count('copper')).toBe(1);
    p.give('plastic', 1);
    expect(w.count('plastic')).toBe(1);
  });
});

describe('crafting demo', () => {
  it('salvaging a pile gives loot and an observation', () => {
    const g = new CraftGame();
    const pile = g.scrap.find(s => s.kind === 'pile')!;
    g.pos = { x: pile.o.x - 0.6, y: pile.o.y + 0.5 };
    run(g, 4, true);
    expect(g.have('iron')).toBeGreaterThan(0);
    expect(g.obs.has('scrap')).toBe(true);
    expect(g.scrap.includes(pile)).toBe(false);
  });

  it('a full inventory drops the rest on the ground', () => {
    const g = new CraftGame();
    for (const id of ['iron', 'copper', 'plastic', 'glass', 'cells', 'bearings'] as const) g.inv.add(id, 20);
    g.give('silicon', 3);
    expect(g.drops.length).toBe(1);
    expect(g.drops[0].items[0]).toEqual({ id: 'silicon', n: 3 });
  });

  it('crafts cable by hand', () => {
    const g = new CraftGame();
    g.inv.add('copper', 1); g.inv.add('plastic', 1);
    const r = RECIPES.find(x => x.out === 'cable')!;
    expect(g.craft(r)).toBe(true);
    run(g, r.time + 0.2);
    expect(g.have('cable')).toBe(5);
  });

  it('research needs observations, then computes on spare power', () => {
    const g = new CraftGame();
    g.startResearch('tools');
    expect(g.research).toBe(null);
    g.obs.add('scrap'); g.obs.add('tools');
    g.startResearch('tools');
    expect(g.research).toBe('tools');
    g.energy = g.battery();
    run(g, TECHS.tools.cost / 1.5 + 1);
    expect(g.techs.has('tools')).toBe(true);
  });

  it('a cable from the repaired turbine powers the bench', () => {
    const g = yardAtStage(5);
    expect(stageDone(g, 4)).toBe(true);
    expect(g.benchPowered() || g.wind.strength < 0.1).toBe(true);
  });

  it('every stage shortcut meets that stage\'s goals', () => {
    for (let i = 0; i < STAGES.length - 1; i++) {
      const g = yardAtStage(i + 1);
      // the cradle goal needs Wolt on it
      if (STAGES[i].id === 'storage') { const c = g.buildings.find(b => b.kind === 'charger')!; g.pos = { x: c.x + 1, y: c.y + 1 }; g.docked = true; }
      const missing = STAGES[i].goals.filter(x => !x.done(g)).map(x => x.text);
      expect({ stage: STAGES[i].id, missing }).toEqual({ stage: STAGES[i].id, missing: [] });
    }
  });

  it('the battery store carries the grid through the night', () => {
    const g = yardAtStage(8);
    g.day = 0.95; // night, and no wind either
    for (const b of g.buildings) if (b.kind === 'oldturbine') b.on = false;
    g.update(0.05, still, false, false);
    const lamp = g.buildings.find(b => b.kind === 'lamp')!;
    expect(lamp.watts).toBeLessThan(0);
    const bat = g.buildings.find(b => b.kind === 'battery')!;
    const before = bat.stored;
    run(g, 10);
    expect(bat.stored).toBeLessThan(before);
    expect(g.powered(lamp)).toBe(true);
  });

  it('every recipe and technology refers to things that exist', () => {
    for (const r of RECIPES) {
      expect(ITEMS[r.out]).toBeTruthy();
      for (const id of Object.keys(r.in)) expect(ITEMS[id as keyof typeof ITEMS]).toBeTruthy();
      if (r.tech) expect(TECHS[r.tech]).toBeTruthy();
    }
    for (const t of Object.values(TECHS)) for (const n of t.needs) expect(TECHS[n as TechId]).toBeTruthy();
  });
});

describe('land yacht (Żaglowóz)', () => {
  const wind = { dir: Math.PI, strength: 8 }; // blowing towards −x
  const sailFor = (heading: number, secs: number, runners = true, auto = true) => {
    const s = newSail(heading); s.auto = auto;
    let d = 0;
    for (let t = 0; t < secs; t += 0.05) d += sailStep(s, 0.05, wind, { steer: 0, sheet: 0, brake: false }, runners);
    return { s, d };
  };

  it('a beam reach is fast, straight into the wind goes nowhere', () => {
    const beam = sailFor(Math.PI / 2, 15);
    expect(beam.s.v).toBeGreaterThan(5);
    const head = sailFor(0, 15); // heading +x, the wind comes from +x
    expect(head.s.v).toBe(0);
    expect(head.s.fill).toBeLessThan(0.05);
  });

  it('runners beat wheels in the ash, and it points upwind at an angle', () => {
    expect(sailFor(Math.PI / 2, 15, true).s.v).toBeGreaterThan(sailFor(Math.PI / 2, 15, false).s.v * 1.5);
    // 65° off the wind: close-hauled still moves
    const close = sailFor(65 * Math.PI / 180, 20);
    expect(close.s.v).toBeGreaterThan(2);
    expect(close.s.betaTrue).toBeLessThan(SAIL.upwind);
  });

  it('a sheet in too tight or too loose pulls less than the trimmed one', () => {
    const best = sailFor(Math.PI / 2, 10).s.v;
    const tight = newSail(Math.PI / 2); tight.sheet = SAIL.sheetMin;
    for (let t = 0; t < 10; t += 0.05) sailStep(tight, 0.05, wind, { steer: 0, sheet: 0, brake: false }, true);
    expect(tight.v).toBeLessThan(best * 0.6);
  });

  it('builds on the cart, sails in the yard and steps off', () => {
    const g = yardAtStage(STAGES.findIndex(s => s.id === 'yacht'));
    g.sandbox = true;
    g.cart.pos = { x: 52.5, y: 22.5 }; g.cart.angle = g.wind.dir + Math.PI / 2; g.hitched = false;
    for (const a of ['rigMast', 'rigSail', 'rigRunners'] as const) g.doAction({ kind: 'cart' }, a);
    expect(g.cart.rig).toEqual({ mast: true, sail: true, runners: true });
    g.doAction({ kind: 'cart' }, 'board');
    expect(g.aboard).toBe(true);
    g.yacht.auto = true;
    const e0 = g.energy;
    for (let t = 0; t < 8; t += 0.05) g.update(0.05, still, false, false);
    expect(g.sailed.dist).toBeGreaterThan(10);
    expect(g.energy).toBeGreaterThan(e0 - 2); // the wind does the work
    for (let t = 0; t < 6; t += 0.05) g.update(0.05, still, false, false, true);
    expect(g.yacht.v).toBeLessThan(0.6);
    expect(g.leave()).toBe(true);
    expect(g.aboard).toBe(false);
  });
});
